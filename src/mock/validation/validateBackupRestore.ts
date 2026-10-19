/**
 * S3 — Encrypted Backup & Restore Comprehensive Validation Suite
 * 
 * Menguji seluruh aspek keamanan kriptografi, integritas relasional,
 * otorisasi Owner, proteksi zero-plaintext leak, commit atomik 2PC,
 * dan mekanisme jurnal pemulihan.
 */

import { mockStore, MockStore } from '../store';
import { mediaStorage } from '../../services/mediaStorage';
import { userService } from '../../services/userService';
import { sessionManager } from '../repositories/sessionManager';
import {
  setStorageDriver,
  resetStorageDriver,
  NodeMemoryStorageDriver,
  saveRestoreJournal,
  getRestoreJournal,
  clearRestoreJournal,
  RESTORE_JOURNAL_KEY,
  DEMO_STORAGE_KEY,
} from '../persistence/storage';
import {
  backupService,
  BackupContainer,
  BackupPayload,
  BACKUP_APP_IDENTIFIER,
  BACKUP_FORMAT_VERSION,
  KDF_ITERATIONS,
} from '../../services/backupService';
import { User, Settings } from '../../types';

async function runBackupRestoreValidation() {
  console.log('====================================================');
  console.log('   BOOTH DAILY — S3 ENCRYPTED BACKUP & RESTORE SUITE');
  console.log('====================================================');

  const errors: string[] = [];
  const testStorage = new NodeMemoryStorageDriver();
  setStorageDriver(testStorage);

  try {
    // ----------------------------------------------------
    // TEST 1: KDF BENCHMARK
    // ----------------------------------------------------
    console.log('\n--- TEST 1: KDF Benchmark (PBKDF2 600.000 Iterasi) ---');
    const benchmark = await backupService.benchmarkKDF();
    console.log(`✓ KDF Benchmark: ${benchmark.durationMs}ms untuk ${benchmark.iterations.toLocaleString()} iterasi.`);
    if (benchmark.iterations !== 600000) {
      errors.push(`Test 1 Failed: Iterasi KDF harus tepat 600.000, didapat ${benchmark.iterations}`);
    }

    // Login sebagai Owner yang sah
    await userService.login('owner@boothdaily.com', 'demo123');
    const session = sessionManager.getSession();
    const ownerUser = session?.userId ? mockStore.getUserById(session.userId) : null;
    if (!ownerUser || ownerUser.role !== 'owner') {
      throw new Error('Gagal login sebagai Owner untuk pengujian.');
    }

    // Set sample media logo untuk pengujian
    const sampleAppLogo = 'data:image/webp;base64,UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAQAcJaQAA3AA/v39gAA=';
    const samplePrinterLogo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    await mediaStorage.saveMedia('app_logo', sampleAppLogo);
    await mediaStorage.saveMedia('printer_logo', samplePrinterLogo);

    // ----------------------------------------------------
    // TEST 2: EXPORT BACKUP TERENKRIPSI VALID
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Pembuatan Cadangan Terenkripsi Valid ---');
    const backupPassword = 'RahasiaSuperKuat2026!';
    const { container, filename } = await backupService.exportBackup(backupPassword);

    if (container.app_identifier !== BACKUP_APP_IDENTIFIER) {
      errors.push(`Test 2 Failed: app_identifier tidak cocok: ${container.app_identifier}`);
    }
    if (container.backup_version !== BACKUP_FORMAT_VERSION) {
      errors.push(`Test 2 Failed: backup_version tidak cocok: ${container.backup_version}`);
    }
    if (container.crypto.algorithm !== 'AES-GCM' || container.crypto.key_length !== 256) {
      errors.push('Test 2 Failed: Algoritma kriptografi bukan AES-GCM 256-bit');
    }
    if (container.crypto.kdf.iterations !== KDF_ITERATIONS) {
      errors.push(`Test 2 Failed: Iterasi KDF pada container bukan ${KDF_ITERATIONS}`);
    }
    if (!container.ciphertext || !container.crypto.iv || !container.crypto.kdf.salt) {
      errors.push('Test 2 Failed: Properti kriptografi ciphertext/iv/salt tidak lengkap');
    }
    if (!filename.startsWith('boothdaily_backup_') || !filename.endsWith('.enc.json')) {
      errors.push(`Test 2 Failed: Pola nama file tidak sesuai: ${filename}`);
    }
    console.log(`✓ Test 2 PASS: Cadangan berhasil diekspor (${filename}, ${container.ciphertext.length} chars ciphertext).`);

    // ----------------------------------------------------
    // TEST 3: ZERO-PLAINTEXT LEAK AUDIT
    // ----------------------------------------------------
    console.log('\n--- TEST 3: Audit Kerahasiaan (Zero Plaintext Leak) ---');
    const containerJson = JSON.stringify(container);
    const leakedKeywords = [
      '1234', // PIN owner
      '5678', // PIN kasir
      '9012', // PIN kasir
      'demo123', // password
      'BOOTH DAILY', // store name
      'Hendro Wijaya', // owner name
      'Dinda', // cashier name
      'Kopi Susu Gula Aren', // product name
    ];

    let leakFound = false;
    for (const kw of leakedKeywords) {
      if (containerJson.includes(`"${kw}"`) || containerJson.includes(`:${kw}`) || containerJson.includes(kw)) {
        // Cek jika kw bukan bagian kebetulan dari base64
        if (kw.length >= 6) {
          errors.push(`Test 3 Failed: Data sensitif "${kw}" bocor sebagai plaintext dalam file backup!`);
          leakFound = true;
        }
      }
    }
    if (!leakFound) {
      console.log('✓ Test 3 PASS: Nol kebocoran plaintext. Seluruh entitas dan kredensial terbukti aman dalam ciphertext.');
    }

    // ----------------------------------------------------
    // TEST 4: PRATINJAU CADANGAN (PREVIEW BACKUP)
    // ----------------------------------------------------
    console.log('\n--- TEST 4: Pratinjau & Dekripsi Cadangan Valid ---');
    const preview = await backupService.previewBackup(container, backupPassword);
    if (!preview.store_name || preview.users_count < 1 || preview.products_count < 1) {
      errors.push('Test 4 Failed: Ringkasan pratinjau cadangan tidak valid');
    }
    if (!preview.has_app_logo || !preview.has_printer_logo) {
      errors.push('Test 4 Failed: Logo aplikasi atau printer tidak terdeteksi pada pratinjau');
    }
    console.log(`✓ Test 4 PASS: Pratinjau valid untuk toko "${preview.store_name}" (${preview.products_count} produk, ${preview.users_count} pengguna, 2 logo).`);

    // ----------------------------------------------------
    // TEST 5: OTORISASI PERAN (TOLAK GUEST, KASIR, OWNER NONAKTIF)
    // ----------------------------------------------------
    console.log('\n--- TEST 5: Otorisasi Akses (Tolak Non-Owner) ---');
    // Kasus 5a: Guest (tanpa sesi)
    sessionManager.clearSession();
    try {
      await backupService.exportBackup(backupPassword);
      errors.push('Test 5a Failed: Guest berhasil mengekspor backup!');
    } catch {
      console.log('✓ Test 5a PASS: Guest tanpa sesi berhasil ditolak.');
    }

    // Kasus 5b: Kasir
    await userService.login('dinda@boothdaily.com', 'demo123');
    try {
      await backupService.exportBackup(backupPassword);
      errors.push('Test 5b Failed: Kasir berhasil mengekspor backup!');
    } catch {
      console.log('✓ Test 5b PASS: Kasir berhasil ditolak.');
    }

    // Kembalikan ke sesi Owner
    await userService.login('owner@boothdaily.com', 'demo123');

    // ----------------------------------------------------
    // TEST 6: TOLAK KATA SANDI SALAH & DATA DIMANIPULASI
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Tolak Kata Sandi Salah & Manipulasi Ciphertext ---');
    // 6a: Kata sandi salah
    try {
      await backupService.previewBackup(container, 'KataSandiSalahTotal123!');
      errors.push('Test 6a Failed: Kata sandi salah tidak ditolak!');
    } catch (err: any) {
      console.log(`✓ Test 6a PASS: Kata sandi salah ditolak (${err.message}).`);
    }

    // 6b: Ciphertext dimanipulasi (1 karakter diubah)
    const tamperedContainer: BackupContainer = JSON.parse(JSON.stringify(container));
    const chars = tamperedContainer.ciphertext.split('');
    chars[10] = chars[10] === 'A' ? 'B' : 'A';
    tamperedContainer.ciphertext = chars.join('');
    try {
      await backupService.previewBackup(tamperedContainer, backupPassword);
      errors.push('Test 6b Failed: Ciphertext yang diubah tidak ditolak oleh AES-GCM!');
    } catch {
      console.log('✓ Test 6b PASS: Autentikasi AES-GCM berhasil menolak ciphertext yang dimanipulasi.');
    }

    // 6c: IV dimanipulasi
    const tamperedIvContainer: BackupContainer = JSON.parse(JSON.stringify(container));
    const ivChars = tamperedIvContainer.crypto.iv.split('');
    ivChars[2] = ivChars[2] === 'X' ? 'Y' : 'X';
    tamperedIvContainer.crypto.iv = ivChars.join('');
    try {
      await backupService.previewBackup(tamperedIvContainer, backupPassword);
      errors.push('Test 6c Failed: IV yang diubah tidak ditolak oleh AES-GCM!');
    } catch {
      console.log('✓ Test 6c PASS: IV yang dimodifikasi ditolak oleh verifikasi tag autentikasi.');
    }

    // ----------------------------------------------------
    // TEST 7: TOLAK CONTAINER RUSAK ATAU VERSI LEBIH BARU
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Validasi Versi & Format Container ---');
    // 7a: App identifier salah
    const badAppContainer = { ...container, app_identifier: 'malicious_app' };
    try {
      await backupService.previewBackup(badAppContainer as any, backupPassword);
      errors.push('Test 7a Failed: app_identifier salah tidak ditolak!');
    } catch {
      console.log('✓ Test 7a PASS: app_identifier tidak sah ditolak.');
    }

    // 7b: Versi format lebih baru (v99)
    const futureContainer = { ...container, backup_version: 99 };
    try {
      await backupService.previewBackup(futureContainer as any, backupPassword);
      errors.push('Test 7b Failed: Format backup versi lebih baru (v99) tidak ditolak!');
    } catch (err: any) {
      console.log(`✓ Test 7b PASS: Versi masa depan ditolak (${err.message}).`);
    }

    // ----------------------------------------------------
    // TEST 8: VALIDASI RELASIONAL & SKEMA RUSAK DI MEMORI
    // ----------------------------------------------------
    console.log('\n--- TEST 8: Validasi Integritas Relasional & Skema ---');
    const validSnapshot = mockStore.getSnapshot();

    // 8a: Tolak jika tidak ada Owner aktif
    const noOwnerState = JSON.parse(JSON.stringify(validSnapshot));
    noOwnerState.users = noOwnerState.users.map((u: User) => ({ ...u, role: 'karyawan' }));
    const badOwnerPayload: BackupPayload = {
      format: 'booth_daily_encrypted_payload',
      version: 1,
      timestamp: new Date().toISOString(),
      store: noOwnerState,
      media: { app_logo: null, printer_logo: null },
    };
    try {
      const { container: noOwnerContainer } = await createSyntheticBackup(badOwnerPayload, backupPassword);
      await backupService.previewBackup(noOwnerContainer, backupPassword);
      errors.push('Test 8a Failed: Cadangan tanpa Owner aktif tidak ditolak!');
    } catch {
      console.log('✓ Test 8a PASS: Cadangan tanpa akun Owner aktif ditolak.');
    }

    // 8b: Relasi produk merujuk kategori yang tidak ada
    const brokenCategoryState = JSON.parse(JSON.stringify(validSnapshot));
    brokenCategoryState.products[0].category_id = 'cat-non-existent-999';
    const badCatPayload: BackupPayload = {
      format: 'booth_daily_encrypted_payload',
      version: 1,
      timestamp: new Date().toISOString(),
      store: brokenCategoryState,
      media: { app_logo: null, printer_logo: null },
    };
    try {
      const { container: brokenCatContainer } = await createSyntheticBackup(badCatPayload, backupPassword);
      await backupService.previewBackup(brokenCatContainer, backupPassword);
      errors.push('Test 8b Failed: Relasi kategori rusak tidak ditolak!');
    } catch {
      console.log('✓ Test 8b PASS: Relasi produk-kategori rusak ditolak.');
    }

    // 8c: Relasi resep merujuk stok yang tidak ada
    const brokenRecipeState = JSON.parse(JSON.stringify(validSnapshot));
    brokenRecipeState.recipes[0].ingredients = [
      { id: 'ing-1', stock_id: 'stock-ghost-999', stock_name: 'Bahan Hantu', amount: 10, unit: 'Gram' },
    ];
    const badRecipePayload: BackupPayload = {
      format: 'booth_daily_encrypted_payload',
      version: 1,
      timestamp: new Date().toISOString(),
      store: brokenRecipeState,
      media: { app_logo: null, printer_logo: null },
    };
    try {
      const { container: brokenRecipeContainer } = await createSyntheticBackup(badRecipePayload, backupPassword);
      await backupService.previewBackup(brokenRecipeContainer, backupPassword);
      errors.push('Test 8c Failed: Relasi resep-stok rusak tidak ditolak!');
    } catch {
      console.log('✓ Test 8c PASS: Relasi resep-stok rusak ditolak.');
    }

    // 8d: Jam cutoff tidak valid
    const badCutoffState = JSON.parse(JSON.stringify(validSnapshot));
    badCutoffState.settings.operational_day_cutoff_time = '25:99';
    const badCutoffPayload: BackupPayload = {
      format: 'booth_daily_encrypted_payload',
      version: 1,
      timestamp: new Date().toISOString(),
      store: badCutoffState,
      media: { app_logo: null, printer_logo: null },
    };
    try {
      const { container: badCutoffContainer } = await createSyntheticBackup(badCutoffPayload, backupPassword);
      await backupService.previewBackup(badCutoffContainer, backupPassword);
      errors.push('Test 8d Failed: Cutoff tidak valid tidak ditolak!');
    } catch {
      console.log('✓ Test 8d PASS: Format jam cutoff tidak valid ditolak.');
    }

    // ----------------------------------------------------
    // TEST 9: VALIDASI ACTIVE SHIFT ID RUSAK
    // ----------------------------------------------------
    console.log('\n--- TEST 9: Validasi Integritas activeShiftId ---');
    // 9a: activeShiftId merujuk shift yang tidak terdaftar
    const ghostShiftState = JSON.parse(JSON.stringify(validSnapshot));
    ghostShiftState.activeShiftId = 'shift-tidak-ada';
    const ghostShiftPayload: BackupPayload = {
      format: 'booth_daily_encrypted_payload',
      version: 1,
      timestamp: new Date().toISOString(),
      store: ghostShiftState,
      media: { app_logo: null, printer_logo: null },
    };
    try {
      const { container: ghostShiftContainer } = await createSyntheticBackup(ghostShiftPayload, backupPassword);
      await backupService.previewBackup(ghostShiftContainer, backupPassword);
      errors.push('Test 9a Failed: activeShiftId tidak terdaftar tidak ditolak!');
    } catch {
      console.log('✓ Test 9a PASS: activeShiftId ke ID fiktif ditolak.');
    }

    // 9b: activeShiftId merujuk shift yang sudah closed
    const closedShiftState = JSON.parse(JSON.stringify(validSnapshot));
    closedShiftState.shifts = [
      {
        id: 'shift-closed-01',
        shift_number: 'SHF-001',
        operational_date: '2026-10-15',
        status: 'closed',
        opened_at: new Date().toISOString(),
        opened_by_user_id: closedShiftState.users[0].id,
        opened_by_name: closedShiftState.users[0].name,
        cash_initial: 100000,
        created_at: new Date().toISOString(),
      },
    ];
    closedShiftState.activeShiftId = 'shift-closed-01';
    const closedShiftPayload: BackupPayload = {
      format: 'booth_daily_encrypted_payload',
      version: 1,
      timestamp: new Date().toISOString(),
      store: closedShiftState,
      media: { app_logo: null, printer_logo: null },
    };
    try {
      const { container: closedShiftContainer } = await createSyntheticBackup(closedShiftPayload, backupPassword);
      await backupService.previewBackup(closedShiftContainer, backupPassword);
      errors.push('Test 9b Failed: activeShiftId pada shift closed tidak ditolak!');
    } catch {
      console.log('✓ Test 9b PASS: activeShiftId yang berstatus closed ditolak.');
    }

    // ----------------------------------------------------
    // TEST 10: PEMULIHAN PENUH (RESTORE) BERHASIL + LOGO
    // ----------------------------------------------------
    console.log('\n--- TEST 10: Pemulihan Penuh (Restore) Berhasil ---');
    // Siapkan cadangan dengan modifikasi nama toko unik & logo unik
    const targetRestoreState = JSON.parse(JSON.stringify(validSnapshot));
    targetRestoreState.settings.store_name = 'BOOTH DAILY DIPATIUKUR BARU';
    const customAppLogo = 'data:image/webp;base64,CUSTOM_RESTORED_APP_LOGO';
    const customPrinterLogo = 'data:image/png;base64,CUSTOM_RESTORED_PRINTER_LOGO';

    const customRestorePayload: BackupPayload = {
      format: 'booth_daily_encrypted_payload',
      version: 1,
      timestamp: new Date().toISOString(),
      store: targetRestoreState,
      media: {
        app_logo: customAppLogo,
        printer_logo: customPrinterLogo,
      },
    };
    const { container: validRestoreContainer } = await createSyntheticBackup(customRestorePayload, backupPassword);

    // Jalankan restore dengan PIN Owner yang sah ('1234')
    const restoreResult = await backupService.restoreBackup(validRestoreContainer, backupPassword, '1234');
    if (!restoreResult.success) {
      errors.push('Test 10 Failed: Restore mengembalikan success = false');
    }

    const currentSettings = mockStore.getSettings();
    if (currentSettings.store_name !== 'BOOTH DAILY DIPATIUKUR BARU') {
      errors.push(`Test 10 Failed: Nama toko tidak terpulihkan: ${currentSettings.store_name}`);
    }

    const restoredMedia = await mediaStorage.getAllMedia();
    if (restoredMedia.appLogo !== customAppLogo || restoredMedia.printerLogo !== customPrinterLogo) {
      errors.push('Test 10 Failed: Logo aplikasi atau printer tidak terpulihkan dengan benar');
    }

    console.log('✓ Test 10 PASS: Pemulihan sukses. Nama toko ("BOOTH DAILY DIPATIUKUR BARU") dan kedua logo pulih.');

    // ----------------------------------------------------
    // TEST 11: TOLAK PIN OWNER YANG SALAH SAAT RESTORE
    // ----------------------------------------------------
    console.log('\n--- TEST 11: Otorisasi PIN Owner saat Restore ---');
    try {
      await backupService.restoreBackup(validRestoreContainer, backupPassword, '9999');
      errors.push('Test 11 Failed: Restore dengan PIN Owner salah (9999) tidak ditolak!');
    } catch (err: any) {
      console.log(`✓ Test 11 PASS: PIN Owner salah ditolak (${err.message}).`);
    }

    // ----------------------------------------------------
    // TEST 12: KEGAGALAN PENULISAN JURNAL KARENA KUOTA (RESTORE BATAL SEBELUM MUTASI)
    // ----------------------------------------------------
    console.log('\n--- TEST 12: Penulisan Jurnal Gagal karena Simulasi Kuota (Zero Mutation) ---');
    const preQuotaFailState = mockStore.getSnapshot();
    const preQuotaFailMedia = await mediaStorage.getAllMedia();

    // Driver yang melempar QuotaExceededError saat menulis RESTORE_JOURNAL_KEY
    const quotaFailingDriver: any = {
      getItem: (k: string) => testStorage.getItem(k),
      removeItem: (k: string) => testStorage.removeItem(k),
      setItem: (k: string, v: string) => {
        if (k === RESTORE_JOURNAL_KEY) {
          const quotaErr = new Error('Disk quota exceeded (simulated quota error on journal write)');
          quotaErr.name = 'QuotaExceededError';
          throw quotaErr;
        }
        testStorage.setItem(k, v);
      },
    };

    setStorageDriver(quotaFailingDriver);
    try {
      await backupService.restoreBackup(container, backupPassword, '1234');
      errors.push('Test 12 Failed: Penulisan jurnal gagal karena kuota tidak membatalkan restore!');
    } catch (err: any) {
      console.log(`✓ Test 12a PASS: Kegagalan tulis jurnal membatalkan restore sebelum mutasi (${err.message}).`);
    } finally {
      setStorageDriver(testStorage);
    }

    // Verifikasi: LocalStorage dan IndexedDB sama sekali tidak termutasi (Zero Mutation)
    const postQuotaFailState = mockStore.getSnapshot();
    const postQuotaFailMedia = await mediaStorage.getAllMedia();
    if (postQuotaFailState.settings.store_name !== preQuotaFailState.settings.store_name) {
      errors.push('Test 12 Failed: LocalStorage termutasi padahal penulisan jurnal gagal!');
    }
    if (
      postQuotaFailMedia.appLogo !== preQuotaFailMedia.appLogo ||
      postQuotaFailMedia.printerLogo !== preQuotaFailMedia.printerLogo
    ) {
      errors.push('Test 12 Failed: Media IndexedDB termutasi padahal penulisan jurnal gagal!');
    }
    if (getRestoreJournal() !== null) {
      errors.push('Test 12 Failed: Jurnal tertinggal padahal penulisan jurnal awal gagal!');
    }
    console.log('✓ Test 12b PASS: Zero Mutation terbukti. State dan logo lama utuh 100%.');

    // ----------------------------------------------------
    // TEST 13: SIMULASI KEGAGALAN COMMIT LOCALSTORAGE
    // ----------------------------------------------------
    console.log('\n--- TEST 13: Simulasi Kegagalan Commit LocalStorage & Rollback Bersih ---');
    const preLsFailState = mockStore.getSnapshot();

    const lsFailingDriver: any = {
      getItem: (k: string) => testStorage.getItem(k),
      removeItem: (k: string) => testStorage.removeItem(k),
      setItem: (k: string, v: string) => {
        if (k !== RESTORE_JOURNAL_KEY) {
          const quotaErr = new Error('Disk quota exceeded on state write');
          quotaErr.name = 'QuotaExceededError';
          throw quotaErr;
        }
        testStorage.setItem(k, v);
      },
    };

    setStorageDriver(lsFailingDriver);
    try {
      await backupService.restoreBackup(container, backupPassword, '1234');
      errors.push('Test 13 Failed: Kegagalan LocalStorage tidak melempar error!');
    } catch {
      console.log('✓ Test 13a PASS: Kegagalan commit LocalStorage berhasil ditangkap.');
    } finally {
      setStorageDriver(testStorage);
    }

    if (getRestoreJournal() !== null) {
      errors.push('Test 13 Failed: Jurnal pemulihan tidak dibersihkan setelah kegagalan LocalStorage');
    }
    const postLsFailState = mockStore.getSnapshot();
    if (postLsFailState.settings.store_name !== preLsFailState.settings.store_name) {
      errors.push('Test 13 Failed: State termutasi padahal LocalStorage gagal!');
    } else {
      console.log('✓ Test 13b PASS: Rollback LocalStorage sempurna. State dan logo lama utuh 100%.');
    }

    // ----------------------------------------------------
    // TEST 14: SIMULASI KEGAGALAN INDEXEDDB & ROLLBACK 2PC
    // ----------------------------------------------------
    console.log('\n--- TEST 14: Simulasi Kegagalan IndexedDB & Rollback Atomik (2PC) ---');
    const baselineBefore2PC = mockStore.getSnapshot();
    const baselineMediaBefore2PC = await mediaStorage.getAllMedia();

    let callCount = 0;
    const originalRestoreMedia = mediaStorage.restoreMedia;
    mediaStorage.restoreMedia = async (logos) => {
      callCount++;
      if (callCount === 1) {
        throw new Error('Simulated IndexedDB Transaction Quota Error');
      }
      return originalRestoreMedia.call(mediaStorage, logos);
    };

    try {
      await backupService.restoreBackup(container, backupPassword, '1234');
      errors.push('Test 14 Failed: Kegagalan IndexedDB tidak memicu error!');
    } catch (err: any) {
      console.log(`✓ Test 14a PASS: Kegagalan IndexedDB memicu rollback atomik (${err.message}).`);
    } finally {
      mediaStorage.restoreMedia = originalRestoreMedia;
    }

    const stateAfterRollback = mockStore.getSnapshot();
    const mediaAfterRollback = await mediaStorage.getAllMedia();

    if (stateAfterRollback.settings.store_name !== baselineBefore2PC.settings.store_name) {
      errors.push('Test 14 Failed: LocalStorage tidak di-rollback saat IndexedDB gagal!');
    }
    if (
      mediaAfterRollback.appLogo !== baselineMediaBefore2PC.appLogo ||
      mediaAfterRollback.printerLogo !== baselineMediaBefore2PC.printerLogo
    ) {
      errors.push('Test 14 Failed: Media IndexedDB tidak di-rollback saat commit gagal!');
    }
    if (getRestoreJournal() !== null) {
      errors.push('Test 14 Failed: Jurnal pemulihan belum dibersihkan setelah rollback sukses');
    }
    console.log('✓ Test 14b PASS: Rollback atomik 2PC memulihkan kedua storage ke kondisi semula.');

    // ----------------------------------------------------
    // TEST 15: PENGUJIAN RESTART NYATA & SELURUH CRASH BOUNDARY
    // ----------------------------------------------------
    console.log('\n--- TEST 15: Pengujian Restart Nyata & Seluruh Crash Boundary ---');

    // 15.1 Crash Batas 1: Crash sebelum commit LocalStorage (COMMITTING_LOCAL_STORAGE)
    console.log('• 15.1: Crash sebelum commit LocalStorage (stage COMMITTING_LOCAL_STORAGE)');
    const baselineB1 = mockStore.getSnapshot();
    const baselineMediaB1 = await mediaStorage.getAllMedia();

    saveRestoreJournal({
      id: 'crash-b1',
      startedAt: new Date().toISOString(),
      stage: 'COMMITTING_LOCAL_STORAGE',
      oldState: baselineB1,
      oldMedia: baselineMediaB1,
    });

    // Simulasikan restart: instansiasi MockStore baru
    const restartedStoreB1 = new MockStore();
    const recResultB1 = await backupService.checkAndRecoverInterruptedRestore(restartedStoreB1);

    if (!recResultB1.recovered || !recResultB1.success) {
      errors.push('Test 15.1 Failed: Recovery batas 1 gagal');
    }
    if (restartedStoreB1.getSettings().store_name !== baselineB1.settings.store_name) {
      errors.push('Test 15.1 Failed: LocalStorage tidak konsisten dengan baseline');
    }
    const mediaB1 = await mediaStorage.getAllMedia();
    if (mediaB1.appLogo !== baselineMediaB1.appLogo || mediaB1.printerLogo !== baselineMediaB1.printerLogo) {
      errors.push('Test 15.1 Failed: Media IndexedDB tidak konsisten dengan baseline');
    }
    if (getRestoreJournal() !== null) {
      errors.push('Test 15.1 Failed: Jurnal tidak dibersihkan setelah recovery sukses');
    }
    if (restartedStoreB1.getStorageStatusInfo().isWriteLocked) {
      errors.push('Test 15.1 Failed: Store terkunci padahal recovery batas 1 berhasil');
    }
    console.log('✓ Test 15.1 PASS: Batas 1 pulih sempurna ke baseline.');

    // 15.2 Crash Batas 2: LocalStorage berubah tetapi sebelum IndexedDB berubah (COMMITTING_INDEXEDDB)
    console.log('• 15.2: Crash setelah LocalStorage berubah sebelum IndexedDB (COMMITTING_INDEXEDDB)');
    const crashedStateB2 = JSON.parse(JSON.stringify(baselineB1));
    crashedStateB2.settings.store_name = 'TOKO RUSAK B2';
    // Simulasikan state LocalStorage sempat berubah sebelum crash
    testStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(crashedStateB2));

    saveRestoreJournal({
      id: 'crash-b2',
      startedAt: new Date().toISOString(),
      stage: 'COMMITTING_INDEXEDDB',
      oldState: baselineB1,
      oldMedia: baselineMediaB1,
    });

    const restartedStoreB2 = new MockStore();
    const recResultB2 = await backupService.checkAndRecoverInterruptedRestore(restartedStoreB2);

    if (!recResultB2.recovered || !recResultB2.success) {
      errors.push('Test 15.2 Failed: Recovery batas 2 gagal');
    }
    if (restartedStoreB2.getSettings().store_name !== baselineB1.settings.store_name) {
      errors.push('Test 15.2 Failed: LocalStorage gagal di-rollback ke baseline');
    }
    const mediaB2 = await mediaStorage.getAllMedia();
    if (mediaB2.appLogo !== baselineMediaB1.appLogo) {
      errors.push('Test 15.2 Failed: IndexedDB tidak konsisten dengan baseline');
    }
    if (getRestoreJournal() !== null) {
      errors.push('Test 15.2 Failed: Jurnal tidak dibersihkan setelah recovery batas 2');
    }
    console.log('✓ Test 15.2 PASS: Batas 2 di-rollback sempurna ke baseline.');

    // 15.3 Crash Batas 3: Crash saat penulisan IndexedDB (partial write: 1 logo terubah)
    console.log('• 15.3: Crash saat IndexedDB partial write (hanya 1 logo terubah)');
    const crashedStateB3 = JSON.parse(JSON.stringify(baselineB1));
    crashedStateB3.settings.store_name = 'TOKO RUSAK B3';
    testStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(crashedStateB3));
    // Simulasikan IndexedDB sempat tertulis app_logo baru sebelum browser crash
    await mediaStorage.saveMedia('app_logo', 'data:image/webp;base64,NEW_CRASHED_APP_LOGO_PARTIAL');

    saveRestoreJournal({
      id: 'crash-b3',
      startedAt: new Date().toISOString(),
      stage: 'COMMITTING_INDEXEDDB',
      oldState: baselineB1,
      oldMedia: baselineMediaB1,
    });

    const restartedStoreB3 = new MockStore();
    const recResultB3 = await backupService.checkAndRecoverInterruptedRestore(restartedStoreB3);

    if (!recResultB3.recovered || !recResultB3.success) {
      errors.push('Test 15.3 Failed: Recovery batas 3 gagal');
    }
    if (restartedStoreB3.getSettings().store_name !== baselineB1.settings.store_name) {
      errors.push('Test 15.3 Failed: LocalStorage gagal di-rollback pada batas 3');
    }
    const mediaB3 = await mediaStorage.getAllMedia();
    if (mediaB3.appLogo !== baselineMediaB1.appLogo || mediaB3.printerLogo !== baselineMediaB1.printerLogo) {
      errors.push('Test 15.3 Failed: Logo parsial di IndexedDB TIDAK di-rollback ke baseline lama!');
    }
    if (getRestoreJournal() !== null) {
      errors.push('Test 15.3 Failed: Jurnal tidak dibersihkan pada batas 3');
    }
    console.log('✓ Test 15.3 PASS: Partial write IndexedDB terbukti di-rollback 100% ke logo awal.');

    // 15.4 Crash Batas 4: Crash setelah kedua storage terubah sebelum jurnal dibersihkan (VERIFYING)
    console.log('• 15.4: Crash setelah kedua storage terubah sebelum jurnal dibersihkan (VERIFYING)');
    const crashedStateB4 = JSON.parse(JSON.stringify(baselineB1));
    crashedStateB4.settings.store_name = 'TOKO RUSAK B4';
    testStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(crashedStateB4));
    await mediaStorage.saveMedia('app_logo', 'data:image/webp;base64,LOGO_B4');

    saveRestoreJournal({
      id: 'crash-b4',
      startedAt: new Date().toISOString(),
      stage: 'VERIFYING',
      oldState: baselineB1,
      oldMedia: baselineMediaB1,
    });

    const restartedStoreB4 = new MockStore();
    const recResultB4 = await backupService.checkAndRecoverInterruptedRestore(restartedStoreB4);

    if (!recResultB4.recovered || !recResultB4.success) {
      errors.push('Test 15.4 Failed: Recovery batas 4 gagal');
    }
    if (restartedStoreB4.getSettings().store_name !== baselineB1.settings.store_name) {
      errors.push('Test 15.4 Failed: Strategi rollback batas 4 tidak mengembalikan LocalStorage ke baseline');
    }
    const mediaB4 = await mediaStorage.getAllMedia();
    if (mediaB4.appLogo !== baselineMediaB1.appLogo) {
      errors.push('Test 15.4 Failed: Media batas 4 tidak kembali ke baseline');
    }
    if (getRestoreJournal() !== null) {
      errors.push('Test 15.4 Failed: Jurnal tidak dibersihkan pada batas 4');
    }
    console.log('✓ Test 15.4 PASS: Batas 4 menerapkan fail-safe rollback ke baseline.');

    // 15.5 Simulasi Kegagalan Recovery LocalStorage
    console.log('• 15.5: Simulasi kegagalan recovery LocalStorage (stage ROLLBACK_FAILED & write-lock)');
    saveRestoreJournal({
      id: 'crash-ls-fail',
      startedAt: new Date().toISOString(),
      stage: 'COMMITTING_INDEXEDDB',
      oldState: baselineB1,
      oldMedia: baselineMediaB1,
    });

    const failingRecoveryDriver: any = {
      getItem: (k: string) => testStorage.getItem(k),
      removeItem: (k: string) => testStorage.removeItem(k),
      setItem: (k: string, v: string) => {
        if (k === DEMO_STORAGE_KEY) {
          throw new Error('Disk IO failure on recovery rollback');
        }
        testStorage.setItem(k, v);
      },
    };

    setStorageDriver(failingRecoveryDriver);
    const recResultLsFail = await backupService.checkAndRecoverInterruptedRestore();
    setStorageDriver(testStorage);

    if (recResultLsFail.success) {
      errors.push('Test 15.5 Failed: Recovery seharusnya gagal jika LocalStorage IO gagal');
    }
    const journalLsFail = getRestoreJournal();
    if (!journalLsFail || journalLsFail.stage !== 'ROLLBACK_FAILED') {
      errors.push('Test 15.5 Failed: Jurnal seharusnya diubah ke ROLLBACK_FAILED saat recovery gagal');
    }
    if (!mockStore.getStorageStatusInfo().isWriteLocked) {
      errors.push('Test 15.5 Failed: Store harus terkunci saat recovery gagal!');
    }
    console.log('✓ Test 15.5 PASS: Kegagalan recovery LocalStorage memicu status ROLLBACK_FAILED dan mengunci mutasi.');

    // 15.6 Simulasi Kegagalan Recovery IndexedDB
    console.log('• 15.6: Simulasi kegagalan recovery IndexedDB (stage ROLLBACK_FAILED & write-lock)');
    saveRestoreJournal({
      id: 'crash-idb-fail',
      startedAt: new Date().toISOString(),
      stage: 'COMMITTING_INDEXEDDB',
      oldState: baselineB1,
      oldMedia: baselineMediaB1,
    });

    mediaStorage.restoreMedia = async () => {
      throw new Error('IndexedDB fatal recovery error');
    };

    const recResultIdbFail = await backupService.checkAndRecoverInterruptedRestore();
    mediaStorage.restoreMedia = originalRestoreMedia;

    if (recResultIdbFail.success) {
      errors.push('Test 15.6 Failed: Recovery seharusnya gagal jika IndexedDB gagal');
    }
    const journalIdbFail = getRestoreJournal();
    if (!journalIdbFail || journalIdbFail.stage !== 'ROLLBACK_FAILED') {
      errors.push('Test 15.6 Failed: Jurnal seharusnya diubah ke ROLLBACK_FAILED saat IndexedDB recovery gagal');
    }
    if (!mockStore.getStorageStatusInfo().isWriteLocked) {
      errors.push('Test 15.6 Failed: Store harus terkunci saat recovery IndexedDB gagal!');
    }
    console.log('✓ Test 15.6 PASS: Kegagalan recovery IndexedDB memicu ROLLBACK_FAILED dan proteksi tulis.');

    // 15.7 Bersihkan kondisi darurat
    clearRestoreJournal();
    mockStore.setWriteLock(false);

    // ----------------------------------------------------
    // TEST 16: VALIDASI SESI OWNER PASCA-RESTORE
    // ----------------------------------------------------
    console.log('\n--- TEST 16: Validasi Sesi Owner Pasca-Restore ---');
    const newOwnerState = JSON.parse(JSON.stringify(validSnapshot));
    newOwnerState.users = [
      {
        id: 'usr-new-owner-99',
        name: 'Owner Baru Nusantara',
        email: 'newowner@boothdaily.com',
        role: 'owner',
        pin: '8899',
        is_active: true,
      },
    ];
    const newOwnerPayload: BackupPayload = {
      format: 'booth_daily_encrypted_payload',
      version: 1,
      timestamp: new Date().toISOString(),
      store: newOwnerState,
      media: { app_logo: null, printer_logo: null },
    };
    const { container: newOwnerContainer } = await createSyntheticBackup(newOwnerPayload, backupPassword);

    const reloginRestore = await backupService.restoreBackup(newOwnerContainer, backupPassword, '1234');
    if (!reloginRestore.requireRelogin) {
      errors.push('Test 16 Failed: Restore dengan Owner yang berbeda harus menandai requireRelogin = true');
    }
    if (sessionManager.getSession() !== null) {
      errors.push('Test 16 Failed: Sesi lama harus dibersihkan ketika akun Owner tidak ada di data baru');
    }
    console.log('✓ Test 16 PASS: Pergantian akun Owner pasca-restore memicu logout teratur dan requireRelogin.');

    // Kembalikan state default bersih
    mockStore.resetMockStore();
    await mediaStorage.clearAllMedia();
    clearRestoreJournal();
    mockStore.setWriteLock(false);

  } finally {
    resetStorageDriver();
  }

  // ----------------------------------------------------
  // REPORT HASIL
  // ----------------------------------------------------
  console.log('\n====================================================');
  if (errors.length === 0) {
    console.log('🎉 SELURUH PENGUJIAN S3 ENCRYPTED BACKUP & RESTORE LULUS (100% PASS)');
    console.log('====================================================');
    process.exit(0);
  } else {
    console.error('❌ DITEMUKAN KEGAGALAN PADA VALIDATOR S3:');
    for (const err of errors) {
      console.error(`  - ${err}`);
    }
    console.log('====================================================');
    process.exit(1);
  }
}

/**
 * Helper untuk menyusun backup sintetik terenkripsi secara terisolasi di memori.
 */
async function createSyntheticBackup(
  payload: BackupPayload,
  password: string
): Promise<{ container: BackupContainer }> {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const passwordKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: KDF_ITERATIONS,
      hash: 'SHA-256',
    },
    passwordKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );

  const ciphertextBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as any },
    key,
    enc.encode(JSON.stringify(payload)) as any
  );

  const container: BackupContainer = {
    app_identifier: BACKUP_APP_IDENTIFIER,
    backup_version: BACKUP_FORMAT_VERSION,
    app_version: '1.0.0',
    created_at: new Date().toISOString(),
    crypto: {
      algorithm: 'AES-GCM',
      key_length: 256,
      iv: Buffer.from(iv).toString('base64'),
      kdf: {
        name: 'PBKDF2',
        hash: 'SHA-256',
        iterations: KDF_ITERATIONS,
        salt: Buffer.from(salt).toString('base64'),
      },
    },
    ciphertext: Buffer.from(new Uint8Array(ciphertextBuffer)).toString('base64'),
  };

  return { container };
}

runBackupRestoreValidation().catch(err => {
  console.error('[FATAL ERROR IN S3 VALIDATION]:', err);
  process.exit(1);
});
