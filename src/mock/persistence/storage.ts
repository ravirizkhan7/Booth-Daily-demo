import { MockStoreState } from '../types';

export const DEMO_STORAGE_KEY = 'boothdaily_demo_store';

export type StorageLoadStatus =
  | 'FRESH_INSTALL'
  | 'SUCCESS'
  | 'CORRUPTED_JSON'
  | 'SCHEMA_INVALID'
  | 'STORAGE_UNAVAILABLE';

export interface StorageLoadResult {
  status: StorageLoadStatus;
  data: MockStoreState | null;
  raw?: string | null;
  error?: string;
  missingFields?: string[];
  quarantineKey?: string | null;
}

export type StorageSaveErrorCode =
  | 'STORAGE_UNAVAILABLE'
  | 'WRITE_LOCKED'
  | 'QUOTA_EXCEEDED'
  | 'SERIALIZATION_FAILED'
  | 'WRITE_FAILED';

export interface StorageSaveResult {
  success: boolean;
  errorCode?: StorageSaveErrorCode;
  error?: string;
}

export interface StorageDriver {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  getAllKeys?(): string[];
  key?(index: number): string | null;
  length?: number;
}

export class NodeMemoryStorageDriver implements StorageDriver {
  private data = new Map<string, string>();

  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }

  setItem(key: string, value: string): void {
    this.data.set(key, String(value));
  }

  removeItem(key: string): void {
    this.data.delete(key);
  }

  getAllKeys(): string[] {
    return Array.from(this.data.keys());
  }

  get length(): number {
    return this.data.size;
  }

  key(index: number): string | null {
    const keys = Array.from(this.data.keys());
    return keys[index] ?? null;
  }

  clear(): void {
    this.data.clear();
  }
}

const nodeDefaultDriver = new NodeMemoryStorageDriver();
let customStorageDriver: StorageDriver | null | undefined = undefined;

/**
 * Memasang driver storage khusus (digunakan untuk pengujian terisolasi
 * tanpa menyentuh window.localStorage riil pengguna).
 * Mengirimkan null mensimulasikan kondisi storage tidak tersedia.
 */
export function setStorageDriver(driver: StorageDriver | null | undefined): void {
  customStorageDriver = driver;
}

export function resetStorageDriver(): void {
  customStorageDriver = undefined;
}

export function getActiveStorage(): StorageDriver | null {
  // Jika driver khusus dipasang secara eksplisit (termasuk null untuk simulasi kegagalan)
  if (customStorageDriver !== undefined) {
    return customStorageDriver;
  }

  // Lingkungan browser nyata
  if (typeof window !== 'undefined') {
    try {
      if (typeof window.localStorage !== 'undefined' && window.localStorage !== null) {
        return window.localStorage;
      }
    } catch {
      return null;
    }
    return null;
  }

  // Lingkungan headless Node.js (CLI validator)
  return nodeDefaultDriver;
}

export const isLocalStorageAvailable = (): boolean => {
  return getActiveStorage() !== null;
};

/**
 * Mengambil seluruh keys dari storage driver secara aman
 */
export function getStorageKeys(storage: StorageDriver): string[] {
  if (typeof storage.getAllKeys === 'function') {
    try {
      return storage.getAllKeys();
    } catch {}
  }
  if (typeof (storage as any).store === 'object' && (storage as any).store !== null) {
    return Object.keys((storage as any).store);
  }
  if (typeof storage.length === 'number' && typeof storage.key === 'function') {
    const keys: string[] = [];
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (k) keys.push(k);
    }
    return keys;
  }
  try {
    return Object.keys(storage);
  } catch {
    return [];
  }
}

/**
 * Menyimpan salinan data mentah rusak ke karantina dengan deduplikasi aman:
 * - Cek apakah sudah ada key karantina yang isinya identik dengan raw.
 * - Jika sudah ada, gunakan kembali key tersebut tanpa melakukan penulisan baru (hemat kuota & cegah duplikasi).
 * - Jika belum ada, buat key baru unik berbasis timestamp dan verifikasi hasil tulis.
 * - Jika penyimpanan penuh atau penulisan/verifikasi gagal, jangan modifikasi/hapus key sumber.
 */
function quarantineRawData(storage: StorageDriver, raw: string): string | null {
  try {
    const existingKeys = getStorageKeys(storage).filter(k =>
      k.startsWith(`${DEMO_STORAGE_KEY}_quarantine_`)
    );

    // 1. Cek deduplikasi: jika ada salinan karantina yang isinya sama persis, gunakan kembali
    for (const key of existingKeys) {
      try {
        const existingContent = storage.getItem(key);
        if (existingContent === raw) {
          return key;
        }
      } catch {}
    }

    // 2. Buat key karantina baru yang unik tanpa menimpa key karantina lain yang sudah ada
    const qKey = `${DEMO_STORAGE_KEY}_quarantine_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    storage.setItem(qKey, raw);

    // 3. Verifikasi salinan berhasil ditulis dan isinya sama dengan data mentah sumber
    const readBack = storage.getItem(qKey);
    if (readBack !== raw) {
      console.warn('[MockStorage] Verifikasi karantina gagal: isi data hasil baca tidak identik dengan sumber.');
      try {
        storage.removeItem(qKey);
      } catch {}
      return null;
    }

    return qKey;
  } catch (err) {
    console.warn('[MockStorage] Karantina otomatis gagal disimpan (storage penuh/terblokir):', err);
    return null;
  }
}

/**
 * Membaca snapshot state dari storage dengan klasifikasi diagnostik ketat:
 * - FRESH_INSTALL: Key belum pernah dibuat sama sekali (null/kosong).
 * - SUCCESS: Data ada, valid secara JSON dan memenuhi kontrak skema.
 * - CORRUPTED_JSON: Key ada tetapi gagal di-parse (sintaks rusak). Dikarantina otomatis.
 * - SCHEMA_INVALID: JSON valid tetapi struktur data cacat/field hilang. Dikarantina otomatis.
 * - STORAGE_UNAVAILABLE: Storage tidak dapat diakses (misal mode privat terblokir atau headless).
 */
export function loadPersistedSnapshot(): StorageLoadResult {
  const storage = getActiveStorage();
  if (!storage) {
    return {
      status: 'STORAGE_UNAVAILABLE',
      data: null,
      error: 'Penyimpanan browser tidak tersedia atau dinonaktifkan.',
    };
  }

  let raw: string | null = null;
  try {
    raw = storage.getItem(DEMO_STORAGE_KEY);
  } catch (err: any) {
    return {
      status: 'STORAGE_UNAVAILABLE',
      data: null,
      error: err?.message || 'Gagal membaca dari penyimpanan.',
    };
  }

  // Kondisi 1: Penyimpanan benar-benar belum pernah dibuat (Fresh Install)
  if (raw === null || raw.trim() === '') {
    return {
      status: 'FRESH_INSTALL',
      data: null,
    };
  }

  // Kondisi 2 & 3: Coba parse JSON
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (err: any) {
    const errorMsg = err?.message || 'Format JSON tidak valid atau terpotong.';
    console.warn('[MockStorage] Gagal mengurai snapshot JSON:', errorMsg);

    // Karantina data mentah ke key darurat agar data pengguna tidak musnah
    const quarantineKey = quarantineRawData(storage, raw);

    return {
      status: 'CORRUPTED_JSON',
      data: null,
      raw,
      error: errorMsg,
      quarantineKey,
    };
  }

  // Kondisi 4: Validasi kontrak skema secara eksplisit
  const missingFields: string[] = [];
  if (!parsed || typeof parsed !== 'object') {
    missingFields.push('root_object');
  } else {
    const requiredArrayFields: (keyof MockStoreState)[] = [
      'users',
      'categories',
      'products',
      'stocks',
      'stockHistories',
      'recipes',
      'orders',
      'purchases',
      'discountRules',
      'shifts',
    ];

    for (const field of requiredArrayFields) {
      if (!Array.isArray(parsed[field])) {
        missingFields.push(field);
      }
    }

    if (!parsed.settings || typeof parsed.settings !== 'object') {
      missingFields.push('settings');
    }
  }

  if (missingFields.length > 0) {
    console.warn('[MockStorage] Struktur snapshot tidak memenuhi kontrak skema:', missingFields);

    const quarantineKey = quarantineRawData(storage, raw);

    return {
      status: 'SCHEMA_INVALID',
      data: null,
      raw,
      missingFields,
      error: `Kontrak skema tidak valid. Field berikut hilang atau bukan array: ${missingFields.join(', ')}`,
      quarantineKey,
    };
  }

  if (typeof parsed.activeShiftId === 'undefined') {
    parsed.activeShiftId = null;
  }

  return {
    status: 'SUCCESS',
    data: parsed as MockStoreState,
  };
}

/**
 * Menyimpan snapshot state ke storage.
 * Menangani proteksi write-lock, QuotaExceededError, dan kegagalan serialisasi secara eksplisit.
 */
export function savePersistedSnapshot(
  state: MockStoreState,
  options?: { isWriteLocked?: boolean; allowReseedPersist?: boolean }
): StorageSaveResult {
  if (options?.isWriteLocked) {
    return {
      success: false,
      errorCode: 'WRITE_LOCKED',
      error: 'Penulisan diblokir: Penyimpanan sedang dalam mode proteksi tulis (data korup/terkunci).',
    };
  }

  const storage = getActiveStorage();
  if (!storage) {
    return {
      success: false,
      errorCode: 'STORAGE_UNAVAILABLE',
      error: 'Penyimpanan browser tidak tersedia atau dinonaktifkan.',
    };
  }

  let serialized: string;
  try {
    serialized = JSON.stringify(state);
  } catch (err: any) {
    console.error('[MockStorage] Serialisasi snapshot gagal:', err);
    return {
      success: false,
      errorCode: 'SERIALIZATION_FAILED',
      error: err?.message || 'Gagal melakukan serialisasi data snapshot.',
    };
  }

  // Multi-tab best-effort mitigation: periksa apakah ada jurnal reset pabrik aktif sebelum penulisan snapshot bisnis
  if (!options?.allowReseedPersist) {
    const activeJournal = storage.getItem(FACTORY_RESET_JOURNAL_KEY);
    if (activeJournal) {
      return {
        success: false,
        errorCode: 'WRITE_LOCKED',
        error: 'Penulisan diblokir: Sistem sedang dalam proses reset data pabrik.',
      };
    }
  }

  try {
    storage.setItem(DEMO_STORAGE_KEY, serialized);
    return { success: true };
  } catch (err: any) {
    console.error('[MockStorage] Gagal menyimpan snapshot ke storage:', err);
    const isQuota =
      err?.name === 'QuotaExceededError' ||
      err?.code === 22 ||
      err?.code === 1014 ||
      (typeof err?.message === 'string' &&
        err.message.toLowerCase().includes('quota'));

    return {
      success: false,
      errorCode: isQuota ? 'QUOTA_EXCEEDED' : 'WRITE_FAILED',
      error: err?.message || 'Gagal menyimpan snapshot ke storage.',
    };
  }
}

/**
 * Menghapus snapshot utama dari storage (misal saat reset eksplisit).
 */
export function clearPersistedSnapshot(): StorageSaveResult {
  const storage = getActiveStorage();
  if (!storage) {
    return {
      success: false,
      errorCode: 'STORAGE_UNAVAILABLE',
      error: 'Penyimpanan browser tidak tersedia.',
    };
  }

  try {
    storage.removeItem(DEMO_STORAGE_KEY);
    return { success: true };
  } catch (err: any) {
    console.error('[MockStorage] Gagal menghapus snapshot dari storage:', err);
    return {
      success: false,
      errorCode: 'WRITE_FAILED',
      error: err?.message || 'Gagal menghapus snapshot.',
    };
  }
}

/**
 * Allowlist key LocalStorage yang benar-benar dimiliki oleh aplikasi Booth Daily.
 * Menjamin factory reset tidak menghapus key pihak ketiga / sistem lain di browser.
 */
export const APP_ALLOWLIST_STORAGE_KEYS = [
  DEMO_STORAGE_KEY,
  'boothdaily_demo_session',
  'boothdaily_user_session',
  'boothdaily_user_data',
  'token',
  'token_id',
  'boothdaily_cached_products',
  'boothdaily_cached_categories',
  'boothdaily_cached_stocks',
] as const;

/**
 * Memeriksa apakah sebuah key storage adalah milik aplikasi Booth Daily.
 */
export function isAppStorageKey(key: string): boolean {
  if ((APP_ALLOWLIST_STORAGE_KEYS as readonly string[]).includes(key)) {
    return true;
  }
  if (key.startsWith('boothdaily_quarantine_')) {
    return true;
  }
  return false;
}

/**
 * Menghapus seluruh data aplikasi dari storage berdasarkan allowlist resmi.
 * Key di luar allowlist (milik aplikasi lain atau sistem) tidak akan tersentuh.
 */
export function clearAppStorageAllowlist(options?: { removeJournal?: boolean }): StorageSaveResult {
  const storage = getActiveStorage();
  if (!storage) {
    return {
      success: false,
      errorCode: 'STORAGE_UNAVAILABLE',
      error: 'Penyimpanan browser tidak tersedia.',
    };
  }

  try {
    const failedKeys: string[] = [];
    // 1. Hapus key terdaftar pada allowlist
    for (const key of APP_ALLOWLIST_STORAGE_KEYS) {
      try {
        storage.removeItem(key);
      } catch (keyErr) {
        console.warn(`[MockStorage] Gagal menghapus key allowlist (${key}):`, keyErr);
        failedKeys.push(key);
      }
    }

    if (failedKeys.length > 0) {
      return {
        success: false,
        errorCode: 'WRITE_FAILED',
        error: `Gagal membersihkan key penyimpanan allowlist: ${failedKeys.join(', ')}`,
      };
    }

    // 2. Jika diizinkan secara eksplisit, hapus restore journal
    if (options?.removeJournal) {
      try {
        storage.removeItem(RESTORE_JOURNAL_KEY);
      } catch (jErr) {
        console.warn('[MockStorage] Gagal menghapus restore journal:', jErr);
      }
    }

    // 3. Hapus dynamic quarantine keys yang dibuat oleh booth daily
    if (typeof storage.getAllKeys === 'function') {
      const allKeys = storage.getAllKeys();
      for (const k of allKeys) {
        if (k.startsWith('boothdaily_quarantine_')) {
          storage.removeItem(k);
        }
      }
    } else if (typeof window !== 'undefined' && window.localStorage) {
      const keysToRemove: string[] = [];
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i);
        if (k && k.startsWith('boothdaily_quarantine_')) {
          keysToRemove.push(k);
        }
      }
      for (const k of keysToRemove) {
        window.localStorage.removeItem(k);
      }
    }

    return { success: true };
  } catch (err: any) {
    console.error('[MockStorage] Gagal membersihkan storage allowlist:', err);
    return {
      success: false,
      errorCode: 'WRITE_FAILED',
      error: err?.message || 'Gagal membersihkan storage aplikasi.',
    };
  }
}

/**
 * Menyimpan data ke cache sekunder secara aman:
 * - Tidak boleh menulis saat sistem dalam mode proteksi write-lock.
 * - Tidak boleh menulis saat storage unavailable.
 * - Kegagalan cache ditangani secara diam tanpa merusak transaksi atau melempar error unhandled.
 * - Tidak menyentuh key transaksi utama (DEMO_STORAGE_KEY).
 */
export function saveSecondaryCache(
  key: string,
  data: any,
  options?: { isWriteLocked?: boolean }
): void {
  if (options?.isWriteLocked) {
    return;
  }
  const storage = getActiveStorage();
  if (!storage) {
    return;
  }
  try {
    storage.setItem(key, JSON.stringify(data));
  } catch (err) {
    console.warn(`[MockStorage] Gagal menyimpan cache sekunder (${key}):`, err);
  }
}

/**
 * Membaca data dari cache sekunder secara aman
 */
export function getSecondaryCache<T>(key: string): T | null {
  const storage = getActiveStorage();
  if (!storage) {
    return null;
  }
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ----------------------------------------------------
// ATOMIC RESTORE RECOVERY JOURNAL (S3)
// ----------------------------------------------------
export const RESTORE_JOURNAL_KEY = 'boothdaily_restore_journal';

export type RestoreJournalStage =
  | 'COMMITTING_LOCAL_STORAGE'
  | 'COMMITTING_INDEXEDDB'
  | 'VERIFYING'
  | 'ROLLBACK_FAILED';

export interface RestoreRecoveryJournal {
  id: string;
  startedAt: string;
  stage: RestoreJournalStage;
  oldState: MockStoreState;
  oldMedia: {
    appLogo: string | null;
    printerLogo: string | null;
  };
}

/**
 * Menyimpan jurnal pemulihan atomik ke storage.
 * Melempar error (termasuk QuotaExceededError) jika penulisan gagal, agar transaksi tidak lanjut tanpa proteksi.
 */
export function saveRestoreJournal(journal: RestoreRecoveryJournal): void {
  const storage = getActiveStorage();
  if (!storage) {
    throw new Error('Penyimpanan lokal tidak tersedia untuk mencatat jurnal pemulihan.');
  }
  storage.setItem(RESTORE_JOURNAL_KEY, JSON.stringify(journal));
}

export function getRestoreJournal(): RestoreRecoveryJournal | null {
  const storage = getActiveStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(RESTORE_JOURNAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearRestoreJournal(): void {
  const storage = getActiveStorage();
  if (!storage) return;
  storage.removeItem(RESTORE_JOURNAL_KEY);
}

// ----------------------------------------------------
// ATOMIC FACTORY RESET RECOVERY JOURNAL (S4)
// ----------------------------------------------------
export const FACTORY_RESET_JOURNAL_KEY = 'boothdaily_factory_reset_journal';

export type FactoryResetStage =
  | 'STAGE_1_INITIALIZED'
  | 'STAGE_2_INDEXEDDB_CLEARED'
  | 'STAGE_3_STORAGE_CLEARED'
  | 'STAGE_4_STORE_RESEEDED'
  | 'STAGE_5_VERIFIED'
  | 'STAGE_FAILED';

export interface FactoryResetJournal {
  id: string;
  startedAt: string;
  stage: FactoryResetStage;
  failedAtStage?: FactoryResetStage;
  error?: string;
  retryCount?: number;
}

/**
 * Menyimpan jurnal Factory Reset ke storage secara aman.
 */
export function saveFactoryResetJournal(journal: FactoryResetJournal): StorageSaveResult {
  const storage = getActiveStorage();
  if (!storage) {
    return {
      success: false,
      errorCode: 'STORAGE_UNAVAILABLE',
      error: 'Penyimpanan lokal tidak tersedia untuk mencatat jurnal reset pabrik.',
    };
  }
  try {
    storage.setItem(FACTORY_RESET_JOURNAL_KEY, JSON.stringify(journal));
    return { success: true };
  } catch (err: any) {
    console.error('[MockStorage] Gagal menyimpan jurnal reset pabrik:', err);
    return {
      success: false,
      errorCode: 'WRITE_FAILED',
      error: err?.message || 'Gagal menyimpan jurnal reset pabrik.',
    };
  }
}

/**
 * Membaca jurnal Factory Reset aktif dari storage.
 */
export function getFactoryResetJournal(): FactoryResetJournal | null {
  const storage = getActiveStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(FACTORY_RESET_JOURNAL_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

/**
 * Menghapus jurnal Factory Reset setelah seluruh verifikasi berhasil.
 */
export function clearFactoryResetJournal(): void {
  const storage = getActiveStorage();
  if (!storage) return;
  try {
    storage.removeItem(FACTORY_RESET_JOURNAL_KEY);
  } catch (err) {
    console.warn('[MockStorage] Gagal menghapus jurnal reset pabrik:', err);
  }
}



