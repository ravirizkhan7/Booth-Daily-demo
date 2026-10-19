/**
 * Backup and Restore Service (S3)
 * 
 * Mengelola pembuatan cadangan terenkripsi (AES-GCM 256-bit + PBKDF2-HMAC-SHA-256 600.000 iterasi)
 * dan pemulihan data atomik lintas LocalStorage dan IndexedDB dengan jurnal pemulihan.
 */

import { mockStore } from '../mock/store';
import { mediaStorage } from './mediaStorage';
import { userService } from './userService';
import { sessionManager } from '../mock/repositories/sessionManager';
import {
  saveRestoreJournal,
  getRestoreJournal,
  clearRestoreJournal,
  RestoreRecoveryJournal,
} from '../mock/persistence/storage';
import { MockStoreState } from '../mock/types';
import { User, Category, Product, Stock, Recipe, Shift } from '../types';

export const BACKUP_APP_IDENTIFIER = 'booth_daily_backup';
export const BACKUP_FORMAT_VERSION = 1;
export const APP_VERSION = '1.0.0';
export const KDF_ITERATIONS = 600000;
export const SALT_BYTES_LENGTH = 16;
export const IV_BYTES_LENGTH = 12;

export interface RecoveryResult {
  recovered: boolean;
  success: boolean;
  stage?: string;
  message?: string;
  error?: string;
}

let ongoingRecoveryPromise: Promise<RecoveryResult> | null = null;

export interface BackupContainer {
  app_identifier: 'booth_daily_backup';
  backup_version: number;
  app_version: string;
  created_at: string;
  crypto: {
    algorithm: 'AES-GCM';
    key_length: 256;
    iv: string; // Base64
    kdf: {
      name: 'PBKDF2';
      hash: 'SHA-256';
      iterations: number;
      salt: string; // Base64
    };
  };
  ciphertext: string; // Base64 ciphertext + auth tag
}

export interface BackupPayload {
  format: 'booth_daily_encrypted_payload';
  version: number;
  timestamp: string;
  store: MockStoreState;
  media: {
    app_logo: string | null;
    printer_logo: string | null;
  };
}

export interface BackupPreviewSummary {
  created_at: string;
  app_version: string;
  store_name: string;
  users_count: number;
  products_count: number;
  categories_count: number;
  orders_count: number;
  shifts_count: number;
  stocks_count: number;
  recipes_count: number;
  has_active_shift: boolean;
  has_app_logo: boolean;
  has_printer_logo: boolean;
  active_owners: string[];
}

// ----------------------------------------------------
// CRYPTO UTILITIES (Web Crypto API)
// ----------------------------------------------------

function getWebCrypto(): Crypto {
  const cryptoObj =
    typeof globalThis !== 'undefined' && globalThis.crypto
      ? globalThis.crypto
      : typeof window !== 'undefined' && window.crypto
      ? window.crypto
      : null;

  if (!cryptoObj || !cryptoObj.subtle) {
    throw new Error(
      'Web Crypto API tidak tersedia pada browser/lingkungan ini (pastikan menggunakan koneksi aman HTTPS atau localhost). Operasi dibatalkan demi keamanan data.'
    );
  }
  return cryptoObj;
}

export function uint8ArrayToBase64(bytes: Uint8Array): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

export function base64ToUint8Array(base64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(base64, 'base64'));
  }
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function deriveKey(
  cryptoObj: Crypto,
  password: string,
  salt: Uint8Array,
  iterations: number = KDF_ITERATIONS
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const passwordKey = await cryptoObj.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return cryptoObj.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: iterations,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptData(
  plaintext: string,
  password: string
): Promise<{ ciphertext: string; salt: string; iv: string }> {
  const cryptoObj = getWebCrypto();
  const salt = cryptoObj.getRandomValues(new Uint8Array(SALT_BYTES_LENGTH));
  const iv = cryptoObj.getRandomValues(new Uint8Array(IV_BYTES_LENGTH));

  const key = await deriveKey(cryptoObj, password, salt, KDF_ITERATIONS);
  const enc = new TextEncoder();
  const ciphertextBuffer = await cryptoObj.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    enc.encode(plaintext) as any
  );

  return {
    ciphertext: uint8ArrayToBase64(new Uint8Array(ciphertextBuffer)),
    salt: uint8ArrayToBase64(salt),
    iv: uint8ArrayToBase64(iv),
  };
}

async function decryptData(
  ciphertextBase64: string,
  password: string,
  saltBase64: string,
  ivBase64: string,
  iterations: number = KDF_ITERATIONS
): Promise<string> {
  const cryptoObj = getWebCrypto();
  const salt = base64ToUint8Array(saltBase64);
  const iv = base64ToUint8Array(ivBase64);
  const ciphertext = base64ToUint8Array(ciphertextBase64);

  let key: CryptoKey;
  try {
    key = await deriveKey(cryptoObj, password, salt, iterations);
  } catch (err: any) {
    throw new Error(`Gagal menderivasi kunci enkripsi: ${err?.message || 'Kesalahan KDF'}`);
  }

  let decryptedBuffer: ArrayBuffer;
  try {
    decryptedBuffer = await cryptoObj.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as any },
      key,
      ciphertext as any
    );
  } catch {
    throw new Error(
      'Kata sandi backup salah atau data cadangan telah dimodifikasi (verifikasi autentikasi AES-GCM gagal).'
    );
  }

  const dec = new TextDecoder();
  return dec.decode(decryptedBuffer);
}

// ----------------------------------------------------
// VALIDATION LOGIC
// ----------------------------------------------------

export function validateContainer(data: any): BackupContainer {
  if (!data || typeof data !== 'object') {
    throw new Error('Format file cadangan tidak valid: Konten bukan objek JSON.');
  }

  if (data.app_identifier !== BACKUP_APP_IDENTIFIER) {
    throw new Error(
      `File ini bukan file cadangan Booth Daily yang sah (app_identifier tidak sesuai: "${data.app_identifier}").`
    );
  }

  if (typeof data.backup_version !== 'number' || data.backup_version < 1) {
    throw new Error('Versi format file cadangan tidak valid.');
  }

  if (data.backup_version > BACKUP_FORMAT_VERSION) {
    throw new Error(
      `Versi format backup (v${data.backup_version}) lebih baru dari versi yang didukung aplikasi ini (v${BACKUP_FORMAT_VERSION}). Silakan perbarui aplikasi.`
    );
  }

  if (!data.crypto || typeof data.crypto !== 'object') {
    throw new Error('Parameter kriptografi pada file cadangan tidak lengkap.');
  }

  if (data.crypto.algorithm !== 'AES-GCM' || data.crypto.key_length !== 256) {
    throw new Error('Algoritma enkripsi tidak didukung. Booth Daily hanya menerima AES-GCM 256-bit.');
  }

  if (!data.crypto.iv || typeof data.crypto.iv !== 'string') {
    throw new Error('Inisialisasi vektor (IV) pada file cadangan tidak valid.');
  }

  if (
    !data.crypto.kdf ||
    data.crypto.kdf.name !== 'PBKDF2' ||
    data.crypto.kdf.hash !== 'SHA-256' ||
    typeof data.crypto.kdf.iterations !== 'number' ||
    data.crypto.kdf.iterations < 100000 ||
    !data.crypto.kdf.salt
  ) {
    throw new Error('Parameter KDF (PBKDF2) pada file cadangan tidak memenuhi standar keamanan.');
  }

  if (!data.ciphertext || typeof data.ciphertext !== 'string') {
    throw new Error('Data ciphertext terenkripsi tidak ditemukan pada file cadangan.');
  }

  return data as BackupContainer;
}

export function validateBackupPayload(payload: any): BackupPayload {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Data payload yang didekripsi bukan objek valid.');
  }

  if (payload.format !== 'booth_daily_encrypted_payload') {
    throw new Error('Tanda pengenal payload terenkripsi tidak valid.');
  }

  if (payload.version !== BACKUP_FORMAT_VERSION) {
    if (payload.version > BACKUP_FORMAT_VERSION) {
      throw new Error(
        `Versi skema payload (v${payload.version}) lebih baru dari versi yang didukung (v${BACKUP_FORMAT_VERSION}).`
      );
    }
    throw new Error('Versi skema payload tidak valid.');
  }

  const { store, media } = payload;
  if (!store || typeof store !== 'object') {
    throw new Error('State toko tidak ditemukan dalam payload cadangan.');
  }

  // 1. Validasi Users & Owner
  if (!Array.isArray(store.users) || store.users.length === 0) {
    throw new Error('Data pengguna kosong atau tidak valid.');
  }
  const userIds = new Set<string>();
  const userPins = new Set<string>();
  let activeOwnerCount = 0;
  const activeOwners: string[] = [];

  for (const u of store.users as User[]) {
    if (!u.id || !u.name || !u.role || typeof u.is_active !== 'boolean') {
      throw new Error(`Data pengguna tidak lengkap pada ID: "${u.id || 'unknown'}".`);
    }
    if (userIds.has(String(u.id))) {
      throw new Error(`Ditemukan ID pengguna duplikat: "${u.id}".`);
    }
    userIds.add(String(u.id));

    if (u.pin) {
      const cleanPin = u.pin.trim();
      if (userPins.has(cleanPin)) {
        throw new Error(`Ditemukan PIN duplikat pada data pengguna: "${u.name}".`);
      }
      userPins.add(cleanPin);
    }

    if (u.role === 'owner' && u.is_active) {
      activeOwnerCount++;
      activeOwners.push(u.name);
    }
  }

  if (activeOwnerCount < 1) {
    throw new Error('Data cadangan ditolak: Harus memiliki minimal satu akun Owner yang aktif.');
  }

  // 2. Validasi Kategori
  if (!Array.isArray(store.categories)) {
    throw new Error('Data kategori tidak valid.');
  }
  const categoryIds = new Set<string>();
  for (const c of store.categories as Category[]) {
    if (!c.id || !c.name) {
      throw new Error(`Kategori tidak lengkap pada ID: "${c.id || 'unknown'}".`);
    }
    if (categoryIds.has(String(c.id))) {
      throw new Error(`Ditemukan ID kategori duplikat: "${c.id}".`);
    }
    categoryIds.add(String(c.id));
  }

  // 3. Validasi Produk & Relasi Kategori
  if (!Array.isArray(store.products)) {
    throw new Error('Data produk tidak valid.');
  }
  const productIds = new Set<string>();
  for (const p of store.products as Product[]) {
    if (!p.id || !p.name || typeof p.price !== 'number' || p.price < 0) {
      throw new Error(`Produk tidak valid atau harga bernilai negatif pada produk: "${p.name || p.id}".`);
    }
    if (productIds.has(String(p.id))) {
      throw new Error(`Ditemukan ID produk duplikat: "${p.id}".`);
    }
    productIds.add(String(p.id));

    if (p.category_id && !categoryIds.has(String(p.category_id))) {
      throw new Error(
        `Integritas relasi rusak: Produk "${p.name}" merujuk pada kategori ID "${p.category_id}" yang tidak terdaftar.`
      );
    }
  }

  // 4. Validasi Stok Bahan Baku
  if (!Array.isArray(store.stocks)) {
    throw new Error('Data stok bahan baku tidak valid.');
  }
  const stockIds = new Set<string>();
  for (const s of store.stocks as Stock[]) {
    if (!s.id || !s.name || typeof s.current_amount !== 'number' || isNaN(s.current_amount)) {
      throw new Error(`Data stok tidak valid pada bahan baku: "${s.name || s.id}".`);
    }
    if (stockIds.has(String(s.id))) {
      throw new Error(`Ditemukan ID stok duplikat: "${s.id}".`);
    }
    stockIds.add(String(s.id));
  }

  // 5. Validasi Resep & Relasi Produk-Stok
  if (!Array.isArray(store.recipes)) {
    throw new Error('Data resep tidak valid.');
  }
  const recipeIds = new Set<string>();
  for (const r of store.recipes as Recipe[]) {
    if (!r.id || !r.product_id) {
      throw new Error(`Data resep tidak lengkap pada ID "${r.id || 'unknown'}".`);
    }
    if (recipeIds.has(String(r.id))) {
      throw new Error(`Ditemukan ID resep duplikat: "${r.id}".`);
    }
    recipeIds.add(String(r.id));

    if (!productIds.has(String(r.product_id))) {
      throw new Error(`Integritas resep rusak: Resep merujuk pada produk ID "${r.product_id}" yang tidak ada.`);
    }

    if (Array.isArray(r.ingredients)) {
      for (const item of r.ingredients) {
        if (!stockIds.has(String(item.stock_id))) {
          throw new Error(
            `Integritas resep rusak: Bahan resep merujuk pada stok ID "${item.stock_id}" yang tidak terdaftar.`
          );
        }
        if (typeof item.amount !== 'number' || item.amount <= 0 || isNaN(item.amount)) {
          throw new Error(`Jumlah bahan pada resep produk "${r.product_id}" harus berupa angka positif.`);
        }
      }
    }
  }

  // 6. Validasi Pengaturan Toko
  if (!store.settings || typeof store.settings !== 'object') {
    throw new Error('Pengaturan toko (settings) tidak ditemukan.');
  }
  if (!store.settings.store_name || typeof store.settings.store_name !== 'string') {
    throw new Error('Nama toko pada pengaturan tidak boleh kosong.');
  }
  const tax = Number(store.settings.tax_percentage ?? 0);
  if (isNaN(tax) || tax < 0 || tax > 100) {
    throw new Error('Tarif pajak pada pengaturan harus berada di antara 0% hingga 100%.');
  }
  const cutoff = (store.settings.operational_day_cutoff_time || '04:00').trim();
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(cutoff)) {
    throw new Error(`Format jam cutoff operasional ("${cutoff}") tidak valid. Gunakan format 24 jam HH:mm.`);
  }

  // 7. Validasi Shift & activeShiftId
  if (!Array.isArray(store.shifts)) {
    throw new Error('Data riwayat shift tidak valid.');
  }
  const shiftMap = new Map<string, Shift>();
  for (const sh of store.shifts as Shift[]) {
    if (!sh.id || !sh.opened_by_user_id || !sh.status) {
      throw new Error(`Data shift tidak lengkap pada ID "${sh.id || 'unknown'}".`);
    }
    if (shiftMap.has(String(sh.id))) {
      throw new Error(`Ditemukan ID shift duplikat: "${sh.id}".`);
    }
    if (!userIds.has(String(sh.opened_by_user_id))) {
      throw new Error(`Shift "${sh.id}" merujuk pada kasir pembuka ID "${sh.opened_by_user_id}" yang tidak terdaftar.`);
    }
    if (sh.closed_by_user_id && !userIds.has(String(sh.closed_by_user_id))) {
      throw new Error(`Shift "${sh.id}" merujuk pada kasir penutup ID "${sh.closed_by_user_id}" yang tidak terdaftar.`);
    }
    shiftMap.set(String(sh.id), sh);
  }

  if (store.activeShiftId !== null && store.activeShiftId !== undefined) {
    const activeShift = shiftMap.get(String(store.activeShiftId));
    if (!activeShift) {
      throw new Error(
        `Integritas shift rusak: activeShiftId "${store.activeShiftId}" tidak ditemukan dalam daftar shift.`
      );
    }
    if (activeShift.status !== 'open') {
      throw new Error(
        `Integritas shift rusak: activeShiftId "${store.activeShiftId}" merujuk pada shift yang sudah berstatus "${activeShift.status}" (bukan open).`
      );
    }
  }

  // 8. Validasi Media (Logo Aplikasi & Printer)
  if (!media || typeof media !== 'object') {
    throw new Error('Struktur media logo tidak ditemukan dalam payload.');
  }
  if (media.app_logo !== null && typeof media.app_logo !== 'string') {
    throw new Error('Format data logo aplikasi tidak valid.');
  }
  if (media.printer_logo !== null && typeof media.printer_logo !== 'string') {
    throw new Error('Format data logo printer struk tidak valid.');
  }
  if (media.app_logo && !media.app_logo.startsWith('data:image/')) {
    throw new Error('Logo aplikasi harus berupa data URL gambar yang valid.');
  }
  if (media.printer_logo && !media.printer_logo.startsWith('data:image/')) {
    throw new Error('Logo printer struk harus berupa data URL gambar yang valid.');
  }

  return payload as BackupPayload;
}

function generateBackupFilename(date: Date = new Date()): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `boothdaily_backup_${yyyy}${mm}${dd}_${hh}${min}.enc.json`;
}

function extractSummary(payload: BackupPayload): BackupPreviewSummary {
  const activeOwners = (payload.store.users || [])
    .filter(u => u.role === 'owner' && u.is_active)
    .map(u => u.name);

  return {
    created_at: payload.timestamp,
    app_version: APP_VERSION,
    store_name: payload.store.settings?.store_name || 'Booth Daily',
    users_count: payload.store.users?.length || 0,
    products_count: payload.store.products?.length || 0,
    categories_count: payload.store.categories?.length || 0,
    orders_count: payload.store.orders?.length || 0,
    shifts_count: payload.store.shifts?.length || 0,
    stocks_count: payload.store.stocks?.length || 0,
    recipes_count: payload.store.recipes?.length || 0,
    has_active_shift: Boolean(payload.store.activeShiftId),
    has_app_logo: Boolean(payload.media.app_logo),
    has_printer_logo: Boolean(payload.media.printer_logo),
    active_owners: activeOwners,
  };
}

// ----------------------------------------------------
// MAIN BACKUP SERVICE
// ----------------------------------------------------

export const backupService = {
  /**
   * Mengukur durasi derivasi kunci PBKDF2 pada lingkungan target.
   */
  async benchmarkKDF(iterations: number = KDF_ITERATIONS): Promise<{ durationMs: number; iterations: number }> {
    const cryptoObj = getWebCrypto();
    const testSalt = cryptoObj.getRandomValues(new Uint8Array(SALT_BYTES_LENGTH));
    const start = performance.now();
    await deriveKey(cryptoObj, 'BenchmarkSecretKey123!', testSalt, iterations);
    const end = performance.now();
    return {
      durationMs: Math.round((end - start) * 100) / 100,
      iterations,
    };
  },

  /**
   * Mengekspor seluruh database dan logo menjadi file cadangan terenkripsi.
   * Hanya dapat dipanggil oleh Owner aktif.
   */
  async exportBackup(password: string): Promise<{ container: BackupContainer; filename: string }> {
    // 1. Otorisasi Owner Aktif
    mockStore.assertActiveOwnerSession('membuat cadangan data toko');

    // 2. Validasi kata sandi
    if (!password || typeof password !== 'string' || password.trim().length < 6) {
      throw new Error('Kata sandi backup harus memiliki minimal 6 karakter.');
    }

    // 3. Ambil data store persisten
    const storeSnapshot = mockStore.getSnapshot();

    // 4. Ambil kedua logo dari IndexedDB
    let mediaSnapshot: { app_logo: string | null; printer_logo: string | null };
    try {
      const media = await mediaStorage.getAllMedia();
      mediaSnapshot = {
        app_logo: media.appLogo,
        printer_logo: media.printerLogo,
      };
    } catch (err: any) {
      throw new Error(`Gagal membaca logo dari penyimpanan media: ${err?.message || 'IndexedDB Error'}`);
    }

    // 5. Susun Payload di memori
    const nowIso = new Date().toISOString();
    const payload: BackupPayload = {
      format: 'booth_daily_encrypted_payload',
      version: BACKUP_FORMAT_VERSION,
      timestamp: nowIso,
      store: storeSnapshot,
      media: mediaSnapshot,
    };

    // 6. Enkripsi dengan AES-GCM 256-bit + PBKDF2 600.000 iterasi
    const serializedPayload = JSON.stringify(payload);
    const encrypted = await encryptData(serializedPayload, password);

    // 7. Kemas Container publik (tanpa data sensitif plaintext)
    const container: BackupContainer = {
      app_identifier: BACKUP_APP_IDENTIFIER,
      backup_version: BACKUP_FORMAT_VERSION,
      app_version: APP_VERSION,
      created_at: nowIso,
      crypto: {
        algorithm: 'AES-GCM',
        key_length: 256,
        iv: encrypted.iv,
        kdf: {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations: KDF_ITERATIONS,
          salt: encrypted.salt,
        },
      },
      ciphertext: encrypted.ciphertext,
    };

    const filename = generateBackupFilename(new Date(nowIso));
    return { container, filename };
  },

  /**
   * Men-dekripsi dan memvalidasi file cadangan di memori staging tanpa melakukan mutasi data.
   * Mengembalikan ringkasan data cadangan untuk dikonfirmasi oleh Owner.
   */
  async previewBackup(
    containerOrJson: string | BackupContainer,
    password: string
  ): Promise<BackupPreviewSummary> {
    // 1. Otorisasi Owner Aktif
    mockStore.assertActiveOwnerSession('memeriksa pratinjau cadangan');

    let container: BackupContainer;
    if (typeof containerOrJson === 'string') {
      try {
        container = JSON.parse(containerOrJson);
      } catch {
        throw new Error('File cadangan tidak dapat diurai: Bukan format JSON yang valid.');
      }
    } else {
      container = containerOrJson;
    }

    // 2. Validasi struktur container
    validateContainer(container);

    // 3. Dekripsi AES-GCM di memori
    const decryptedJson = await decryptData(
      container.ciphertext,
      password,
      container.crypto.kdf.salt,
      container.crypto.iv,
      container.crypto.kdf.iterations
    );

    // 4. Parse dan validasi skema menyeluruh
    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(decryptedJson);
    } catch {
      throw new Error('Data payload terenkripsi rusak atau gagal diurai sebagai JSON.');
    }

    const validatedPayload = validateBackupPayload(parsedPayload);
    return extractSummary(validatedPayload);
  },

  /**
   * Melakukan pemulihan atomik (2PC) lintas LocalStorage dan IndexedDB.
   * Dilindungi otorisasi Owner, verifikasi PIN Owner aktif, dan jurnal pemulihan.
   */
  async restoreBackup(
    containerOrJson: string | BackupContainer,
    password: string,
    ownerPin: string
  ): Promise<{
    success: boolean;
    requireRelogin: boolean;
    summary: BackupPreviewSummary;
    message: string;
  }> {
    // 1. Otorisasi Sesi Owner
    const currentOwner = mockStore.assertActiveOwnerSession('memulihkan data cadangan');

    // 2. Verifikasi Ulang PIN Owner Aktif
    if (!ownerPin || typeof ownerPin !== 'string') {
      throw new Error('PIN Owner diperlukan untuk otorisasi pemulihan data.');
    }
    const pinAuth = await userService.verifyPin(ownerPin);
    if (
      !pinAuth ||
      String(pinAuth.user.id) !== String(currentOwner.id) ||
      pinAuth.user.role !== 'owner' ||
      !pinAuth.user.is_active
    ) {
      throw new Error('Otorisasi ditolak: PIN Owner tidak valid atau tidak cocok dengan akun yang sedang login.');
    }

    // 3. Dekripsi & Validasi Menyeluruh di Memori Staging
    let container: BackupContainer;
    if (typeof containerOrJson === 'string') {
      try {
        container = JSON.parse(containerOrJson);
      } catch {
        throw new Error('File cadangan tidak valid: Gagal mengurai JSON.');
      }
    } else {
      container = containerOrJson;
    }

    validateContainer(container);

    const decryptedJson = await decryptData(
      container.ciphertext,
      password,
      container.crypto.kdf.salt,
      container.crypto.iv,
      container.crypto.kdf.iterations
    );

    let parsedPayload: any;
    try {
      parsedPayload = JSON.parse(decryptedJson);
    } catch {
      throw new Error('Payload cadangan rusak.');
    }

    const validatedPayload = validateBackupPayload(parsedPayload);
    const summary = extractSummary(validatedPayload);

    // 4. Siapkan Snapshot Lama & Logo Lama Sebelum Mutasi
    const oldState = mockStore.getSnapshot();
    const oldMedia = await mediaStorage.getAllMedia();

    // 5. Tulis Jurnal Pemulihan (Recovery Journal) - hanya oldState & oldMedia untuk rollback
    const journal: RestoreRecoveryJournal = {
      id: `restore-journal-${Date.now()}`,
      startedAt: new Date().toISOString(),
      stage: 'COMMITTING_LOCAL_STORAGE',
      oldState,
      oldMedia,
    };

    try {
      saveRestoreJournal(journal);
    } catch (journalErr: any) {
      throw new Error(
        `Pemulihan dibatalkan: Gagal menyimpan jurnal pemulihan (${journalErr?.message || 'Penyimpanan penuh'}). Tidak ada data yang diubah.`
      );
    }

    // 6. Tahap 1: Commit ke LocalStorage
    try {
      mockStore.restoreSnapshot(validatedPayload.store);
    } catch (err: any) {
      try {
        clearRestoreJournal();
      } catch {}
      throw new Error(
        `Pemulihan dibatalkan: Gagal menyimpan data ke LocalStorage (${err?.message || 'Error'}). Data lama tetap utuh.`
      );
    }

    // 7. Tahap 2: Update Jurnal & Commit ke IndexedDB (Media Logo)
    journal.stage = 'COMMITTING_INDEXEDDB';
    try {
      saveRestoreJournal(journal);
    } catch (journalUpdateErr: any) {
      console.error('[BackupService] Gagal memperbarui stage jurnal ke COMMITTING_INDEXEDDB:', journalUpdateErr);
      mockStore.restoreSnapshot(oldState, true);
      try {
        clearRestoreJournal();
      } catch {}
      throw new Error(
        `Pemulihan dibatalkan: Gagal memperbarui status jurnal pemulihan (${journalUpdateErr?.message}). Data LocalStorage telah di-rollback.`
      );
    }

    try {
      await mediaStorage.restoreMedia({
        appLogo: validatedPayload.media.app_logo,
        printerLogo: validatedPayload.media.printer_logo,
      });
    } catch (mediaErr: any) {
      // IndexedDB Gagal: Jalankan Rollback Atomik!
      console.error('[BackupService] Commit media gagal, memulai rollback atomik:', mediaErr);
      let rollbackSucceeded = false;
      try {
        // Rollback LocalStorage ke snapshot lama
        mockStore.restoreSnapshot(oldState, true);

        // Rollback IndexedDB ke logo lama
        await mediaStorage.restoreMedia(oldMedia);

        // Verifikasi hasil rollback
        const verifyState = mockStore.getSnapshot();
        const verifyMedia = await mediaStorage.getAllMedia();

        const stateRollbackOk =
          verifyState.settings.store_name === oldState.settings.store_name &&
          verifyState.users.length === oldState.users.length;
        const mediaRollbackOk =
          verifyMedia.appLogo === oldMedia.appLogo &&
          verifyMedia.printerLogo === oldMedia.printerLogo;

        if (!stateRollbackOk || !mediaRollbackOk) {
          throw new Error('Verifikasi rollback gagal: Inkonsistensi terdeteksi');
        }

        clearRestoreJournal();
        rollbackSucceeded = true;
      } catch (rollbackErr: any) {
        journal.stage = 'ROLLBACK_FAILED';
        try {
          saveRestoreJournal(journal);
        } catch {}
        mockStore.setWriteLock(true);
        throw new Error(
          `Kegagalan Kritis: Pemulihan media gagal dan rollback gagal diselesaikan (${rollbackErr?.message}). Sistem dikunci untuk mencegah kerusakan data.`
        );
      }

      if (rollbackSucceeded) {
        throw new Error(
          `Pemulihan dibatalkan: Gagal menyimpan logo ke IndexedDB (${mediaErr?.message || 'Media storage error'}). Seluruh data dan logo lama berhasil dipulihkan secara atomik tanpa perubahan.`
        );
      }
    }

    // 8. Tahap 3: Verifikasi Kedua Penyimpanan Pasca-Commit
    journal.stage = 'VERIFYING';
    try {
      saveRestoreJournal(journal);
    } catch (verifyJournalErr: any) {
      console.warn('[BackupService] Gagal memperbarui status jurnal ke VERIFYING:', verifyJournalErr);
    }

    const verifiedState = mockStore.getSnapshot();
    const verifiedMedia = await mediaStorage.getAllMedia();

    if (
      verifiedState.settings.store_name !== validatedPayload.store.settings.store_name ||
      verifiedMedia.appLogo !== validatedPayload.media.app_logo ||
      verifiedMedia.printerLogo !== validatedPayload.media.printer_logo
    ) {
      throw new Error('Verifikasi akhir pasca-commit gagal: Data atau media tidak sesuai dengan cadangan.');
    }

    // 9. Bersihkan Jurnal Pemulihan (Tidak ada file/jurnal sensitif tertinggal)
    try {
      clearRestoreJournal();
    } catch (cleanErr: any) {
      throw new Error(
        `Peringatan Kritis: Data berhasil dipulihkan namun pembersihan jurnal gagal (${cleanErr?.message}).`
      );
    }

    // 10. Validasi Kembali Sesi Owner Aktif
    let requireRelogin = false;
    const restoredUser = (validatedPayload.store.users || []).find(
      u => String(u.id) === String(currentOwner.id)
    );

    if (!restoredUser || !restoredUser.is_active || restoredUser.role !== 'owner') {
      sessionManager.clearSession();
      requireRelogin = true;
    }

    return {
      success: true,
      requireRelogin,
      summary,
      message: requireRelogin
        ? 'Data cadangan berhasil dipulihkan. Akun Owner sebelumnya tidak ditemukan atau dinonaktifkan pada data baru. Silakan login kembali.'
        : 'Data cadangan berhasil dipulihkan dengan sempurna.',
    };
  },

  /**
   * Memeriksa dan memulihkan jurnal pemulihan yang terhenti di tengah jalan (misal akibat browser crash).
   * Menerapkan strategi Fail-Safe Rollback to Baseline secara atomik lintas LocalStorage dan IndexedDB.
   */
  async checkAndRecoverInterruptedRestore(targetStore = mockStore): Promise<RecoveryResult> {
    if (ongoingRecoveryPromise) {
      return ongoingRecoveryPromise;
    }

    ongoingRecoveryPromise = (async () => {
      const journal = getRestoreJournal();
      if (!journal) {
        return { recovered: false, success: true };
      }

      if (journal.stage === 'ROLLBACK_FAILED') {
        targetStore.setWriteLock(true);
        if (targetStore !== mockStore) mockStore.setWriteLock(true);
        return {
          recovered: true,
          success: false,
          stage: 'ROLLBACK_FAILED',
          error: 'Sistem dalam kondisi terkunci: Proses rollback sebelumnya gagal diselesaikan. Hubungi administrator.',
        };
      }

      // Untuk stage COMMITTING_LOCAL_STORAGE, COMMITTING_INDEXEDDB, dan VERIFYING:
      // Terapkan strategi Fail-Safe Rollback to Baseline:
      console.warn(
        `[BackupService] Terdeteksi proses restore terhenti pada stage "${journal.stage}". Memulai rollback darurat ke baseline.`
      );

      try {
        // 1. Pulihkan LocalStorage ke oldState
        targetStore.restoreSnapshot(journal.oldState, true);
        if (targetStore !== mockStore) mockStore.restoreSnapshot(journal.oldState, true);

        // 2. Pulihkan IndexedDB ke oldMedia
        await mediaStorage.restoreMedia(journal.oldMedia);

        // 3. Verifikasi kedua storage
        const verifyState = targetStore.getSnapshot();
        const verifyMedia = await mediaStorage.getAllMedia();

        const stateOk =
          verifyState.settings.store_name === journal.oldState.settings.store_name &&
          verifyState.users.length === journal.oldState.users.length;
        const mediaOk =
          verifyMedia.appLogo === journal.oldMedia.appLogo &&
          verifyMedia.printerLogo === journal.oldMedia.printerLogo;

        if (!stateOk || !mediaOk) {
          throw new Error('Verifikasi hasil recovery gagal: Data atau media tidak sesuai dengan snapshot awal.');
        }

        // 4. Bersihkan jurnal pemulihan setelah verifikasi kedua storage berhasil
        clearRestoreJournal();
        targetStore.setWriteLock(false);
        if (targetStore !== mockStore) mockStore.setWriteLock(false);

        return {
          recovered: true,
          success: true,
          stage: journal.stage,
          message: 'Proses restore sebelumnya yang terputus berhasil di-rollback secara atomik ke kondisi awal.',
        };
      } catch (err: any) {
        console.error('[BackupService] Rollback recovery gagal:', err);
        // Gagal pulih: Catat status ROLLBACK_FAILED, kunci aplikasi
        try {
          saveRestoreJournal({ ...journal, stage: 'ROLLBACK_FAILED' });
        } catch {}
        targetStore.setWriteLock(true);
        if (targetStore !== mockStore) mockStore.setWriteLock(true);
        return {
          recovered: true,
          success: false,
          stage: 'ROLLBACK_FAILED',
          error: `Kegagalan Kritis saat memulihkan proses terhenti: ${err?.message || 'Error tidak diketahui'}. Sistem dikunci.`,
        };
      }
    })();

    try {
      return await ongoingRecoveryPromise;
    } finally {
      ongoingRecoveryPromise = null;
    }
  },

  /**
   * Memicu unduhan file cadangan pada browser secara aman di memori.
   */
  downloadBackupFile(container: BackupContainer, filename?: string): void {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    const jsonStr = JSON.stringify(container, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || generateBackupFilename();
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
};
