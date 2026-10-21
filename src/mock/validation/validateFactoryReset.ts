/**
 * S4 — Factory Reset (Reset Data Demo) Comprehensive Validation Suite
 * 
 * Menguji kepatuhan keamanan otorisasi Owner, verifikasi PIN, allowlist storage,
 * pembersihan media IndexedDB, reset data seed default, dan proteksi recovery fail-closed.
 */

import { mockStore } from '../store';
import { mediaStorage } from '../../services/mediaStorage';
import { userService } from '../../services/userService';
import { sessionManager } from '../repositories/sessionManager';
import {
  setStorageDriver,
  NodeMemoryStorageDriver,
  saveRestoreJournal,
  clearRestoreJournal,
  saveFactoryResetJournal,
  getFactoryResetJournal,
  clearFactoryResetJournal,
  FACTORY_RESET_JOURNAL_KEY,
  savePersistedSnapshot,
  DEMO_STORAGE_KEY,
  isAppStorageKey,
} from '../persistence/storage';
import { factoryResetService } from '../../services/factoryResetService';

async function runFactoryResetValidation() {
  console.log('====================================================');
  console.log('   BOOTH DAILY — S4 FACTORY RESET VALIDATION SUITE');
  console.log('====================================================');

  const errors: string[] = [];
  const testStorage = new NodeMemoryStorageDriver();
  setStorageDriver(testStorage);
  mockStore.resetMockStore();
  await mediaStorage.clearAllMedia();
  sessionManager.clearSession();

  // Helper untuk assert
  function assert(condition: boolean, testName: string, detail?: string) {
    if (!condition) {
      const msg = `❌ [GAGAL] ${testName}${detail ? `: ${detail}` : ''}`;
      console.error(msg);
      errors.push(msg);
    } else {
      console.log(`✅ [LULUS] ${testName}`);
    }
  }

  try {
    // ----------------------------------------------------
    // TEST 1: RESET TANPA SESI OWNER DITOLAK
    // ----------------------------------------------------
    console.log('\n--- TEST 1: Reset Tanpa Sesi Owner Ditolak ---');
    sessionManager.clearSession();
    let threwWithoutSession = false;
    try {
      await factoryResetService.executeFactoryReset('1234');
    } catch (err: any) {
      threwWithoutSession = true;
      assert(
        err.message.includes('Otorisasi sesi diperlukan') ||
        err.message.includes('Sesi tidak valid') ||
        err.message.includes('Owner'),
        'Test 1: Pesan error otorisasi sesi sesuai',
        err.message
      );
    }
    assert(threwWithoutSession, 'Test 1: Eksekusi reset tanpa sesi harus melempar error');

    // ----------------------------------------------------
    // TEST 2: KASIR DITOLAK (ROLE CHECK)
    // ----------------------------------------------------
    console.log('\n--- TEST 2: Kasir / Karyawan Ditolak ---');
    await userService.login('dinda@boothdaily.com', 'demo123');
    const cashierSession = sessionManager.getSession();
    assert(Boolean(cashierSession), 'Test 2: Sesi kasir berhasil dibuat');

    let threwForCashier = false;
    try {
      await factoryResetService.executeFactoryReset('5678');
    } catch (err: any) {
      threwForCashier = true;
      assert(
        err.message.includes('Hanya Owner') || err.message.includes('Owner'),
        'Test 2: Pesan penolakan khusus peran kasir',
        err.message
      );
    }
    assert(threwForCashier, 'Test 2: Kasir dilarang keras melakukan factory reset');

    // ----------------------------------------------------
    // TEST 3: PIN SALAH DITOLAK TANPA MUTASI DATA (ZERO MUTATION)
    // ----------------------------------------------------
    console.log('\n--- TEST 3: PIN Salah Ditolak & Zero Mutation ---');
    sessionManager.clearSession();
    await userService.login('owner@boothdaily.com', 'demo123');
    const ownerSession = sessionManager.getSession();
    assert(Boolean(ownerSession), 'Test 3: Sesi Owner berhasil dibuat');

    // Mutasi state toko untuk membuktikan tidak ada data yang terhapus saat PIN salah
    mockStore.updateSettings({ store_name: 'TOKO UJI MUTASI SEBELUM RESET' });
    await mediaStorage.saveMedia('app_logo', 'data:image/webp;base64,dummy_app_logo_content');

    let threwWrongPin = false;
    try {
      await factoryResetService.executeFactoryReset('9999'); // PIN salah
    } catch (err: any) {
      threwWrongPin = true;
      assert(
        err.message.includes('PIN Owner tidak valid') || err.message.includes('Otorisasi ditolak'),
        'Test 3: Pesan penolakan PIN salah tepat',
        err.message
      );
    }
    assert(threwWrongPin, 'Test 3: PIN salah wajib ditolak');

    // Verifikasi data toko dan logo TIDAK tersentuh
    assert(
      mockStore.getSettings().store_name === 'TOKO UJI MUTASI SEBELUM RESET',
      'Test 3: Nama toko kustom tidak termutasi saat PIN salah'
    );
    const mediaCheckBefore = await mediaStorage.getAllMedia();
    assert(
      mediaCheckBefore.appLogo === 'data:image/webp;base64,dummy_app_logo_content',
      'Test 3: Logo IndexedDB tidak terhapus saat PIN salah'
    );

    // ----------------------------------------------------
    // TEST 4 & 5: OWNER SAH BERHASIL RESET & ALLOWLIST STORAGE TERBUKTI
    // ----------------------------------------------------
    console.log('\n--- TEST 4 & 5: Reset Sah, Pembersihan Allowlist & Perlindungan Key Asing ---');

    // Tambahkan data non-aplikasi (pihak ketiga / sistem) ke storage
    testStorage.setItem('third_party_analytics_token', 'secure_token_12345');
    testStorage.setItem('theme_preference', 'dark');
    testStorage.setItem('custom_browser_key', 'do_not_delete_me');

    // Tambahkan data sekunder dan karantina milik aplikasi
    testStorage.setItem('boothdaily_cached_products', JSON.stringify([{ id: 'fake_p1' }]));
    testStorage.setItem('boothdaily_cached_stocks', JSON.stringify([{ id: 'fake_s1' }]));
    testStorage.setItem('boothdaily_quarantine_12345', 'corrupted_sample');
    await mediaStorage.saveMedia('printer_logo', 'data:image/png;base64,dummy_printer_logo');

    // Jalankan Factory Reset dengan PIN Owner yang sah (1234)
    const resetResult = await factoryResetService.executeFactoryReset('1234');
    assert(resetResult.success === true, 'Test 4: Factory reset berhasil sukses');

    // Uji proteksi key asing (TIDAK BOLEH TERHAPUS)
    assert(
      testStorage.getItem('third_party_analytics_token') === 'secure_token_12345',
      'Test 5: Key analitik pihak ketiga tetap aman'
    );
    assert(
      testStorage.getItem('theme_preference') === 'dark',
      'Test 5: Key tema preferensi non-aplikasi tetap aman'
    );
    assert(
      testStorage.getItem('custom_browser_key') === 'do_not_delete_me',
      'Test 5: Key asing di luar allowlist tidak terhapus'
    );

    // Uji pembersihan allowlist milik aplikasi
    assert(
      testStorage.getItem('boothdaily_cached_products') === null,
      'Test 5: Cache produk sekunder berhasil dibersihkan'
    );
    assert(
      testStorage.getItem('boothdaily_cached_stocks') === null,
      'Test 5: Cache stok sekunder berhasil dibersihkan'
    );
    assert(
      testStorage.getItem('boothdaily_quarantine_12345') === null,
      'Test 5: Key karantina aplikasi berhasil dibersihkan'
    );
    assert(
      testStorage.getItem('boothdaily_demo_session') === null,
      'Test 5: Sesi demo aplikasi berhasil dihapus dari storage'
    );

    // ----------------------------------------------------
    // TEST 6: KEDUA LOGO KUSTOM DIHAPUS DARI INDEXEDDB
    // ----------------------------------------------------
    console.log('\n--- TEST 6: Kedua Logo Kustom Dihapus dari IndexedDB ---');
    const mediaAfterReset = await mediaStorage.getAllMedia();
    assert(
      mediaAfterReset.appLogo === null && mediaAfterReset.printerLogo === null,
      'Test 6: IndexedDB media branding bersih (kedua logo null)'
    );

    // ----------------------------------------------------
    // TEST 7: SESI DAN SHIFT LAMA TIDAK TERTINGGAL
    // ----------------------------------------------------
    console.log('\n--- TEST 7: Sesi dan Shift Lama Tidak Tertinggal ---');
    assert(
      sessionManager.getSession() === null,
      'Test 7: Sesi Owner aktif telah diakhiri'
    );
    assert(
      mockStore.getActiveShift() === null,
      'Test 7: Shift kasir aktif di-reset ke null'
    );

    // ----------------------------------------------------
    // TEST 8: DATA SEED KEMBALI VALID & TIDAK TERDUPLIKASI
    // ----------------------------------------------------
    console.log('\n--- TEST 8: Data Seed Kembali Valid & Bersih ---');
    const resetProducts = mockStore.getProducts();
    const resetSettings = mockStore.getSettings();
    const resetCategories = mockStore.getCategories();
    const resetStocks = mockStore.getStocks();

    assert(
      resetProducts.length === 15,
      'Test 8: Jumlah katalog produk tepat 15 item seed bawaan',
      `Didapat: ${resetProducts.length}`
    );
    assert(
      resetSettings.store_name === 'BOOTH DAILY',
      'Test 8: Nama toko kembali ke default "BOOTH DAILY"',
      resetSettings.store_name
    );
    assert(
      resetCategories.length === 6,
      'Test 8: Jumlah kategori tepat 6 item seed bawaan',
      `Didapat: ${resetCategories.length}`
    );
    assert(
      resetStocks.length >= 10,
      'Test 8: Stok bahan baku kembali ke seed standar'
    );

    // Snapshot baru tersimpan di DEMO_STORAGE_KEY
    const diskSnapshot = testStorage.getItem(DEMO_STORAGE_KEY);
    assert(Boolean(diskSnapshot), 'Test 8: Snapshot seed baru tersimpan rapi di LocalStorage');

    // ----------------------------------------------------
    // TEST 9: RESET DITOLAK JIKA RECOVERY JOURNAL TERTUNDA / ROLLBACK_FAILED
    // ----------------------------------------------------
    console.log('\n--- TEST 9: Pengecualian Recovery Journal (Fail-Closed) ---');
    // Login Owner lagi untuk menguji proteksi journal
    await userService.login('owner@boothdaily.com', 'demo123');

    // Simulasikan jurnal pemulihan tertunda
    saveRestoreJournal({
      id: 'journal-pending-test',
      startedAt: new Date().toISOString(),
      stage: 'COMMITTING_INDEXEDDB',
      oldState: mockStore.getSnapshot(),
      oldMedia: { appLogo: null, printerLogo: null },
    });

    let threwOnPendingJournal = false;
    try {
      await factoryResetService.executeFactoryReset('1234');
    } catch (err: any) {
      threwOnPendingJournal = true;
      assert(
        err.message.includes('Reset pabrik diblokir') && err.message.includes('COMMITTING_INDEXEDDB'),
        'Test 9: Reset diblokir saat jurnal recovery aktif',
        err.message
      );
    }
    assert(threwOnPendingJournal, 'Test 9: Wajib menolak reset saat proses recovery belum tuntas');

    // Simulasikan stage ROLLBACK_FAILED
    saveRestoreJournal({
      id: 'journal-rollback-failed-test',
      startedAt: new Date().toISOString(),
      stage: 'ROLLBACK_FAILED',
      oldState: mockStore.getSnapshot(),
      oldMedia: { appLogo: null, printerLogo: null },
    });

    let threwOnRollbackFailed = false;
    try {
      await factoryResetService.executeFactoryReset('1234');
    } catch (err: any) {
      threwOnRollbackFailed = true;
      assert(
        err.message.includes('Reset pabrik diblokir') && err.message.includes('ROLLBACK_FAILED'),
        'Test 9: Reset diblokir saat recovery berstatus ROLLBACK_FAILED',
        err.message
      );
    }
    assert(threwOnRollbackFailed, 'Test 9: Wajib menolak reset saat status ROLLBACK_FAILED');

    // Bersihkan jurnal pengujian
    clearRestoreJournal();

    // ----------------------------------------------------
    // TEST 10: KEGAGALAN STORAGE / INDEXEDDB DITANGANI EKSPLISIT
    // ----------------------------------------------------
    console.log('\n--- TEST 10: Penanganan Kegagalan Storage & Media Eksplisit ---');
    // Simulasikan error pada IndexedDB
    const originalClearAllMedia = mediaStorage.clearAllMedia;
    mediaStorage.clearAllMedia = async () => {
      throw new Error('Database IndexedDB terkunci atau korup secara fisik.');
    };

    let threwOnMediaFailure = false;
    try {
      await factoryResetService.executeFactoryReset('1234');
    } catch (err: any) {
      threwOnMediaFailure = true;
      assert(
        err.message.includes('Gagal membersihkan media logo'),
        'Test 10: Error IndexedDB ditangkap dan dilaporkan dengan jelas',
        err.message
      );
    }
    assert(threwOnMediaFailure, 'Test 10: Tidak boleh mengembalikan status sukses palsu saat media gagal dibersihkan');

    // Kembalikan method asli dan bersihkan jurnal pengujian Test 10
    mediaStorage.clearAllMedia = originalClearAllMedia;
    clearFactoryResetJournal();
    mockStore.setWriteLock(false);

    // ----------------------------------------------------
    // TEST 11: IS_APP_STORAGE_KEY ALLOWLIST ACCURACY
    // ----------------------------------------------------
    console.log('\n--- TEST 11: Akurasi Fungsi Allowlist Key ---');
    assert(isAppStorageKey('boothdaily_demo_store'), 'Test 11: boothdaily_demo_store dikenali');
    assert(isAppStorageKey('boothdaily_quarantine_99999'), 'Test 11: boothdaily_quarantine_* dikenali');
    assert(isAppStorageKey('token'), 'Test 11: token dikenali');
    assert(!isAppStorageKey('google_analytics_id'), 'Test 11: key eksternal ditolak dari allowlist');
    assert(!isAppStorageKey('app_settings_other'), 'Test 11: key asing ditolak');

    // ----------------------------------------------------
    // TEST 12: TIKET RESEED TEROTORISASI & SEKALI PAKAI
    // ----------------------------------------------------
    console.log('\n--- TEST 12: Tiket Reseed Terotorisasi & Sekali Pakai ---');
    sessionManager.clearSession();
    await userService.login('owner@boothdaily.com', 'demo123');
    const auth12 = await userService.verifyPin('1234');
    assert(Boolean(auth12?.token), 'Test 12: Tiket verifikasi PIN berhasil diperoleh');

    const reseedToken = mockStore.issueReseedTicket(auth12!.token!);
    assert(
      typeof reseedToken === 'string' && reseedToken.startsWith('rst_usr-owner-01_'),
      'Test 12: Format tiket reseed terikat pada Owner aktif',
      reseedToken
    );

    // Coba gunakan tiket PIN yang sama dua kali -> wajib ditolak
    let threwReusedPinToken = false;
    try {
      mockStore.issueReseedTicket(auth12!.token!);
    } catch (err: any) {
      threwReusedPinToken = true;
      assert(
        err.message.includes('kedaluwarsa atau sudah digunakan'),
        'Test 12: Tiket verifikasi PIN tidak dapat digunakan ulang',
        err.message
      );
    }
    assert(threwReusedPinToken, 'Test 12: Single-use tiket PIN terbukti aman');

    // ----------------------------------------------------
    // TEST 13: STAGE-GATE JURNAL PADA reseedStore()
    // ----------------------------------------------------
    console.log('\n--- TEST 13: Stage-Gate Jurnal pada reseedStore() ---');
    clearFactoryResetJournal();

    let threwWithoutJournal = false;
    try {
      mockStore.reseedStore({ type: 'OWNER_TICKET', ticket: reseedToken });
    } catch (err: any) {
      threwWithoutJournal = true;
      assert(
        err.message.includes('Reseed ditolak') && err.message.includes('NONE'),
        'Test 13: reseedStore menolak pemanggilan tanpa jurnal aktif',
        err.message
      );
    }
    assert(threwWithoutJournal, 'Test 13: reseedStore dilindungi jurnal');

    // Simulasikan jurnal pada stage 1 (belum storage cleared)
    saveFactoryResetJournal({
      id: 'journal-stage1-test',
      startedAt: new Date().toISOString(),
      stage: 'STAGE_1_INITIALIZED',
    });

    let threwOnStage1 = false;
    try {
      mockStore.reseedStore({ type: 'OWNER_TICKET', ticket: reseedToken });
    } catch (err: any) {
      threwOnStage1 = true;
      assert(
        err.message.includes('STAGE_3_STORAGE_CLEARED'),
        'Test 13: reseedStore menolak jika belum STAGE_3_STORAGE_CLEARED',
        err.message
      );
    }
    assert(threwOnStage1, 'Test 13: Stage-gate STAGE_3_STORAGE_CLEARED terbukti');
    clearFactoryResetJournal();

    // ----------------------------------------------------
    // TEST 14: MITIGASI TULIS LINTAS-TAB DI savePersistedSnapshot()
    // ----------------------------------------------------
    console.log('\n--- TEST 14: Mitigasi Tulis Lintas-Tab di savePersistedSnapshot() ---');
    saveFactoryResetJournal({
      id: 'journal-crosstab-test',
      startedAt: new Date().toISOString(),
      stage: 'STAGE_1_INITIALIZED',
    });

    // Penulisan bisnis biasa (tanpa allowReseedPersist) wajib ditolak
    const normalWriteResult = savePersistedSnapshot(mockStore.getSnapshot());
    assert(
      normalWriteResult.success === false && normalWriteResult.errorCode === 'WRITE_LOCKED',
      'Test 14: Penulisan bisnis ditolak saat jurnal reset aktif di storage'
    );

    // Penulisan reseed resmi (dengan allowReseedPersist) diizinkan
    const reseedWriteResult = savePersistedSnapshot(mockStore.getSnapshot(), {
      allowReseedPersist: true,
    });
    assert(
      reseedWriteResult.success === true,
      'Test 14: Penulisan reseed dengan flag allowReseedPersist diizinkan'
    );
    clearFactoryResetJournal();

    // ----------------------------------------------------
    // TEST 15: POST-COMMITMENT FAILURE MENGUNCI KE STAGE_FAILED & isWriteLocked
    // ----------------------------------------------------
    console.log('\n--- TEST 15: Post-Commitment Failure Mengunci ke STAGE_FAILED & UI Gate ---');
    sessionManager.clearSession();
    await userService.login('owner@boothdaily.com', 'demo123');

    let startedCallbackCalled = false;
    let failedCallbackCalled = false;
    let failedCallbackError = '';

    mediaStorage.clearAllMedia = async () => {
      throw new Error('Simulasi IndexedDB Crash Pasca-Komitmen');
    };

    let threwPostCommit = false;
    try {
      await factoryResetService.executeFactoryReset('1234', {
        onResetStarted: () => {
          startedCallbackCalled = true;
        },
        onResetFailed: (err) => {
          failedCallbackCalled = true;
          failedCallbackError = err;
        },
      });
    } catch (err: any) {
      threwPostCommit = true;
    }
    assert(threwPostCommit, 'Test 15: Exception pasca-komitmen dilempar ke caller');
    assert(startedCallbackCalled, 'Test 15: onResetStarted callback dipanggil saat commit point');
    assert(failedCallbackCalled, 'Test 15: onResetFailed callback dipanggil saat kegagalan');
    assert(
      failedCallbackError.includes('Simulasi IndexedDB Crash Pasca-Komitmen'),
      'Test 15: Pesan error kegagalan diteruskan ke UI Gate'
    );

    const failedJournal = getFactoryResetJournal();
    assert(
      failedJournal?.stage === 'STAGE_FAILED' && failedJournal?.failedAtStage === 'STAGE_1_INITIALIZED',
      'Test 15: Jurnal tercatat berstatus STAGE_FAILED dengan failedAtStage'
    );
    assert(
      mockStore.getIsWriteLocked() === true,
      'Test 15: Write-lock tetap aktif (fail-closed) setelah kegagalan'
    );

    mediaStorage.clearAllMedia = originalClearAllMedia;

    // ----------------------------------------------------
    // TEST 16: IDEMPOTENT CRASH RECOVERY VIA recoverInterruptedReset()
    // ----------------------------------------------------
    console.log('\n--- TEST 16: Idempotent Crash Recovery via recoverInterruptedReset() ---');
    const recoverResult = await factoryResetService.recoverInterruptedReset();
    assert(recoverResult.success === true, 'Test 16: recoverInterruptedReset berhasil tuntas');
    assert(getFactoryResetJournal() === null, 'Test 16: Jurnal dibersihkan setelah pemulihan sukses');
    assert(mockStore.getIsWriteLocked() === false, 'Test 16: Write-lock dibuka setelah pemulihan tuntas');

    // ----------------------------------------------------
    // TEST 17: VERIFIKASI AKHIR STATE LENGKAP
    // ----------------------------------------------------
    console.log('\n--- TEST 17: Verifikasi Akhir State Lengkap ---');
    assert(mockStore.getProducts().length === 15, 'Test 17: Tepat 15 produk seed bawaan');
    assert(mockStore.getCategories().length === 6, 'Test 17: Tepat 6 kategori seed bawaan');
    assert(mockStore.getStocks().length === 13, 'Test 17: Tepat 13 stok seed bawaan');
    assert(mockStore.getRecipes().length === 15, 'Test 17: Tepat 15 resep produk seed bawaan');
    const finalIngCount = mockStore.getRecipes().reduce(
      (sum, r) => sum + (Array.isArray(r.ingredients) ? r.ingredients.length : 0),
      0
    );
    assert(finalIngCount === 30, 'Test 17: Tepat 30 relasi bahan resep terverifikasi');
    assert(mockStore.getSettings().store_name === 'BOOTH DAILY', 'Test 17: Nama toko kembali "BOOTH DAILY"');
    assert(sessionManager.getSession() === null, 'Test 17: Sesi pengguna telah dinonaktifkan (null)');
    const finalMedia = await mediaStorage.getAllMedia();
    assert(finalMedia.appLogo === null && finalMedia.printerLogo === null, 'Test 17: Seluruh media branding null');

    // ----------------------------------------------------
    // HASIL AKHIR
    // ----------------------------------------------------
    console.log('\n====================================================');
    if (errors.length > 0) {
      console.error(`❌ VALIDASI S4 GAGAL dengan ${errors.length} kesalahan!`);
      for (const e of errors) console.error(`  - ${e}`);
      process.exit(1);
    } else {
      console.log('🎉 SEMUA PENGUJIAN S4 FACTORY RESET BERHASIL 100%! [17/17 PASS]');
      console.log('====================================================\n');
    }
  } catch (globalErr: any) {
    console.error('CRITICAL UNHANDLED ERROR IN VALIDATOR:', globalErr);
    process.exit(1);
  }
}

runFactoryResetValidation();
