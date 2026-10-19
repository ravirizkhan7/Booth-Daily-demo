/**
 * BOOTH DAILY — DATA INTEGRITY & PERSISTENCE SAFETY TEST SUITE
 * 
 * Pengujian terisolasi untuk memastikan:
 * 1. Fresh install tetap memuat seed normal.
 * 2. Snapshot valid tetap dimuat.
 * 3. JSON rusak tidak ditimpa setelah mutasi.
 * 4. Schema invalid tidak dianggap fresh install.
 * 5. Kegagalan karantina tidak menyebabkan overwrite.
 * 6. QuotaExceeded dilaporkan kepada pemanggil & atomic state rollback.
 * 7. Storage unavailable tidak memberi kesan data tersimpan.
 * 8. Penulisan sukses tetap berjalan normal.
 * 9. Tidak ada perubahan perilaku bisnis pada transaksi, stok, refund, HPP, atau shift.
 * 
 * CATATAN PENTING:
 * Seluruh pengujian menggunakan driver memori terisolasi (MockIsolatedStorage).
 * Tidak ada data nyata di window.localStorage pengguna yang disentuh atau dimodifikasi.
 */

import { mockStore } from '../store';
import {
  setStorageDriver,
  StorageDriver,
  DEMO_STORAGE_KEY,
} from '../persistence/storage';
import { sessionManager } from '../repositories/sessionManager';
import { shiftService } from '../../services/shiftService';
import { transactionService } from '../../services/transactionService';
import { orderService } from '../../services/orderService';
import { userService } from '../../services/userService';
import { calculateShiftFinancials } from '../../utils/shiftCalculation';

class MockIsolatedStorage implements StorageDriver {
  public store: Record<string, string> = {};
  public throwOnSetItem: boolean = false;
  public throwOnQuarantine: boolean = false;

  getItem(key: string): string | null {
    return this.store[key] !== undefined ? this.store[key] : null;
  }

  setItem(key: string, value: string): void {
    if (this.throwOnSetItem) {
      const err = new Error('QuotaExceededError: The quota has been exceeded.');
      err.name = 'QuotaExceededError';
      (err as any).code = 22;
      throw err;
    }
    if (this.throwOnQuarantine && key.includes('_quarantine_')) {
      const err = new Error('QuotaExceededError: Failed to write quarantine data.');
      err.name = 'QuotaExceededError';
      throw err;
    }
    this.store[key] = String(value);
  }

  removeItem(key: string): void {
    delete this.store[key];
  }

  getAllKeys(): string[] {
    return Object.keys(this.store);
  }
}

export async function validateDataIntegrity(): Promise<{ pass: boolean; errors: string[] }> {
  const errors: string[] = [];

  try {
    // =========================================================================
    // 1. FRESH INSTALL MEMUAT SEED NORMAL
    // =========================================================================
    const storage1 = new MockIsolatedStorage();
    setStorageDriver(storage1);
    const res1 = mockStore.reinitializeFromStorage();

    if (res1.status !== 'FRESH_INSTALL') {
      errors.push(`[Test 1] Expected status FRESH_INSTALL, got ${res1.status}`);
    }
    if (res1.isWriteLocked !== false) {
      errors.push(`[Test 1] Expected isWriteLocked to be false on FRESH_INSTALL`);
    }
    if (mockStore.getProducts().length !== 15) {
      errors.push(`[Test 1] Expected 15 default seed products on FRESH_INSTALL, got ${mockStore.getProducts().length}`);
    }

    // =========================================================================
    // 2. SNAPSHOT VALID TETAP DIMUAT
    // =========================================================================
    const storage2 = new MockIsolatedStorage();
    const validSnapshot = mockStore.getSnapshot();
    validSnapshot.settings.store_name = 'BOOTH DAILY KOPI VALID';
    storage2.setItem(DEMO_STORAGE_KEY, JSON.stringify(validSnapshot));

    setStorageDriver(storage2);
    const res2 = mockStore.reinitializeFromStorage();

    if (res2.status !== 'SUCCESS') {
      errors.push(`[Test 2] Expected status SUCCESS, got ${res2.status}`);
    }
    if (res2.isWriteLocked !== false) {
      errors.push(`[Test 2] Expected isWriteLocked to be false on valid snapshot`);
    }
    if (mockStore.getSettings().store_name !== 'BOOTH DAILY KOPI VALID') {
      errors.push(`[Test 2] Expected store_name 'BOOTH DAILY KOPI VALID', got '${mockStore.getSettings().store_name}'`);
    }

    // =========================================================================
    // 3. JSON RUSAK TIDAK DITIMPA SETELAH MUTASI
    // =========================================================================
    const storage3 = new MockIsolatedStorage();
    const corruptedRaw = '{"users":[{"id":"usr-owner"}],"orders":[{"id":"ord-user-999","total":75000}'; // Broken JSON
    storage3.setItem(DEMO_STORAGE_KEY, corruptedRaw);

    setStorageDriver(storage3);
    const res3 = mockStore.reinitializeFromStorage();

    if (res3.status !== 'CORRUPTED_JSON') {
      errors.push(`[Test 3] Expected status CORRUPTED_JSON, got ${res3.status}`);
    }
    if (res3.isWriteLocked !== true) {
      errors.push(`[Test 3] Expected write-lock to be TRUE for CORRUPTED_JSON`);
    }

    // Pastikan karantina dibuat
    const quarantineKeys = Object.keys(storage3.store).filter(k => k.includes('_quarantine_'));
    if (quarantineKeys.length === 0) {
      errors.push('[Test 3] Expected quarantine key to be created for corrupted JSON');
    }

    // Coba lakukan mutasi saat write-locked (menggunakan sesi Owner yang sah)
    sessionManager.setSession({
      userId: 'usr-owner-01',
      token: 'test-owner-token',
      loggedInAt: new Date().toISOString(),
    });

    let mutationBlocked = false;
    try {
      mockStore.updateSettings({ store_name: 'Overwritten Toko' });
    } catch (err: any) {
      mutationBlocked = true;
      if (!err.message?.includes('DataIntegrityError')) {
        errors.push(`[Test 3] Expected DataIntegrityError on write-locked mutation, got: ${err.message}`);
      }
    } finally {
      sessionManager.clearSession();
    }

    if (!mutationBlocked) {
      errors.push('[Test 3] Mutation succeeded when storage was in CORRUPTED_JSON write-lock!');
    }

    // VERIFIKASI UTAMA: Raw data di DEMO_STORAGE_KEY TIDAK BOLEH BERUBAH/TERTIMPA!
    const rawAfterMutation = storage3.getItem(DEMO_STORAGE_KEY);
    if (rawAfterMutation !== corruptedRaw) {
      errors.push('[Test 3] FATAL: Raw corrupted data was overwritten in storage after mutation attempt!');
    }

    // =========================================================================
    // 4. SCHEMA INVALID TIDAK DIANGGAP FRESH INSTALL
    // =========================================================================
    const storage4 = new MockIsolatedStorage();
    const invalidSchemaRaw = JSON.stringify({
      users: [{ id: 'usr-1' }],
      categories: [],
      products: [],
      // missing orders, stocks, settings, etc.
    });
    storage4.setItem(DEMO_STORAGE_KEY, invalidSchemaRaw);

    setStorageDriver(storage4);
    const res4 = mockStore.reinitializeFromStorage();

    if (res4.status !== 'SCHEMA_INVALID') {
      errors.push(`[Test 4] Expected SCHEMA_INVALID, got ${res4.status}`);
    }
    if (res4.status === 'FRESH_INSTALL') {
      errors.push('[Test 4] Schema invalid was incorrectly treated as FRESH_INSTALL!');
    }
    if (res4.isWriteLocked !== true) {
      errors.push('[Test 4] Expected write-lock to be TRUE for SCHEMA_INVALID');
    }

    // =========================================================================
    // 5. KEGAGALAN KARANTINA TIDAK MENYEBABKAN OVERWRITE ATAU PENGHAPUSAN
    // =========================================================================
    const storage5 = new MockIsolatedStorage();
    storage5.setItem(DEMO_STORAGE_KEY, corruptedRaw);
    storage5.throwOnQuarantine = true; // Simulasi karantina gagal ditulis

    setStorageDriver(storage5);
    const res5 = mockStore.reinitializeFromStorage();

    if (res5.status !== 'CORRUPTED_JSON') {
      errors.push(`[Test 5] Expected status CORRUPTED_JSON even when quarantine failed, got ${res5.status}`);
    }
    // Sumber asli di DEMO_STORAGE_KEY harus tetap utuh!
    if (storage5.getItem(DEMO_STORAGE_KEY) !== corruptedRaw) {
      errors.push('[Test 5] Raw data was altered or deleted when quarantine write failed!');
    }

    // =========================================================================
    // 6. QUOTA EXCEEDED DILAPORKAN & ATOMIC ROLLBACK
    // =========================================================================
    const storage6 = new MockIsolatedStorage();
    setStorageDriver(storage6);
    mockStore.resetMockStore();

    const initialProductCount = mockStore.getProducts().length;
    storage6.throwOnSetItem = true; // Simulasi disk kuota penuh

    let quotaErrorThrown = false;
    try {
      mockStore.addProduct({
        name: 'Produk Uji Kuota Penuh',
        price: 25000,
        cost_price: 10000,
        category_id: 'cat-1',
        description: 'Test product for quota',
        image_url: '',
        is_favorite: false,
        is_active: true,
      });
    } catch (err: any) {
      quotaErrorThrown = true;
      if (!err.message?.includes('QuotaExceededError') && !err.message?.includes('Kuota')) {
        errors.push(`[Test 6] Expected QuotaExceededError message, got: ${err.message}`);
      }
    }

    if (!quotaErrorThrown) {
      errors.push('[Test 6] QuotaExceededError was not thrown to caller on persist failure!');
    }

    // Pastikan atomic rollback: Produk TIDAK tersisa di memory seolah-olah sukses!
    if (mockStore.getProducts().length !== initialProductCount) {
      errors.push(`[Test 6] Atomic rollback failed! Products in memory grew from ${initialProductCount} to ${mockStore.getProducts().length}`);
    }

    const lastSaveInfo = mockStore.getStorageStatusInfo().lastSaveResult;
    if (lastSaveInfo.errorCode !== 'QUOTA_EXCEEDED') {
      errors.push(`[Test 6] Expected errorCode QUOTA_EXCEEDED in lastSaveResult, got ${lastSaveInfo.errorCode}`);
    }

    // =========================================================================
    // 7. STORAGE UNAVAILABLE TIDAK MEMBERI KESAN DATA TERSIMPAN
    // =========================================================================
    setStorageDriver(null); // Storage driver dinonaktifkan
    const res7 = mockStore.reinitializeFromStorage();

    if (res7.status !== 'STORAGE_UNAVAILABLE') {
      errors.push(`[Test 7] Expected STORAGE_UNAVAILABLE, got ${res7.status}`);
    }
    if (res7.lastSaveResult.success !== false) {
      errors.push(`[Test 7] STORAGE_UNAVAILABLE must not report lastSaveResult.success = true`);
    }
    if (res7.lastSaveResult.errorCode !== 'STORAGE_UNAVAILABLE') {
      errors.push(`[Test 7] Expected errorCode STORAGE_UNAVAILABLE, got ${res7.lastSaveResult.errorCode}`);
    }

    // =========================================================================
    // 8. PENULISAN SUKSES TETAP BERJALAN NORMAL
    // =========================================================================
    const storage8 = new MockIsolatedStorage();
    setStorageDriver(storage8);
    mockStore.resetMockStore();

    mockStore.addProduct({
      name: 'Kopi Susu Uji Sukses',
      price: 20000,
      cost_price: 8000,
      category_id: 'cat-1',
      description: 'Test coffee',
      image_url: '',
      is_favorite: false,
      is_active: true,
    });

    const info8 = mockStore.getStorageStatusInfo();
    if (info8.lastSaveResult.success !== true) {
      errors.push(`[Test 8] Legitimate mutation did not report lastSaveResult.success = true`);
    }

    const raw8 = storage8.getItem(DEMO_STORAGE_KEY);
    if (!raw8 || !raw8.includes('Kopi Susu Uji Sukses')) {
      errors.push('[Test 8] Storage did not contain the newly created product after successful persist!');
    }

    // =========================================================================
    // 9. TIDAK ADA PERUBAHAN PERILAKU BISNIS (SHIFT, CHECKOUT, STOK, HPP)
    // =========================================================================
    const storage9 = new MockIsolatedStorage();
    setStorageDriver(storage9);
    mockStore.resetMockStore();

    const dinda = (await userService.verifyPin('5678'))?.user;
    if (!dinda) {
      errors.push('[Test 9] Failed to verify Dinda PIN for business test');
    } else {
      // 1. Open shift
      const openedShift = await shiftService.openShift(100000, dinda);
      const activeShift = await shiftService.getActiveShift();
      if (!activeShift || activeShift.cash_initial !== 100000) {
        errors.push('[Test 9] Shift opening failed or cash_initial mismatch');
      }

      // 2. Checkout Americano (1 cup @ 18.000 + 5% tax = 18.900, bayar 20.000, kembali 1.100)
      const coffeeStockBefore = mockStore.getStockById('stk-coffee-beans')?.current_amount ?? 0;
      const order = await transactionService.processTransaction({
        order_type: 'dine_in',
        items: [
          {
            product_id: 'prd-americano',
            product_name: 'Americano Classic',
            price: 18000,
            qty: 1,
          },
        ],
        payment_method: 'cash',
        amount_paid: 20000,
        user: dinda,
      });

      if (!order || order.total_amount !== 18900 || order.payment.change !== 1100) {
        errors.push(`[Test 9] Checkout math incorrect: total ${order?.total_amount}, change ${order?.payment?.change}`);
      }

      // 3. Stok terpotong sesuai resep Americano (18g biji kopi per cup)
      const coffeeStockAfter = mockStore.getStockById('stk-coffee-beans')?.current_amount ?? 0;
      if (coffeeStockBefore - coffeeStockAfter !== 18) {
        errors.push(`[Test 9] Stock deduction mismatch: expected 18g, got ${coffeeStockBefore - coffeeStockAfter}g`);
      }

      // 4. Refund transaksi (status payment order menjadi 'refunded', stok minuman yang sudah disajikan tetap terkonsumsi)
      const refunded = await orderService.refundOrder(order.id, {
        refunded_by_name: 'Dinda',
        refund_reason: 'Salah pesan',
      });
      if (refunded.payment?.status !== 'refunded') {
        errors.push(`[Test 9] Order payment status was not refunded: got ${refunded.payment?.status}`);
      }

      const coffeeStockAfterRefund = mockStore.getStockById('stk-coffee-beans')?.current_amount ?? 0;
      if (coffeeStockAfterRefund !== coffeeStockAfter) {
        errors.push(`[Test 9] Stock on beverage refund unexpectedly altered: expected ${coffeeStockAfter}, got ${coffeeStockAfterRefund}`);
      }
    }

    // =========================================================================
    // 10. MULTI-ENTITY ROLLBACK PADA CHECKOUT PERSISTENCE FAILURE (M-1)
    // =========================================================================
    const storage10 = new MockIsolatedStorage();
    setStorageDriver(storage10);
    mockStore.resetMockStore();

    const cashierUser = (await userService.verifyPin('5678'))?.user;
    if (!cashierUser) {
      errors.push('[Test 10] Failed to verify cashier user PIN for rollback test');
    } else {
      // 1. Buka shift terlebih dahulu
      await shiftService.openShift(100000, cashierUser);

      // 2. Catat baseline sebelum checkout yang akan gagal
      const ordersBefore = mockStore.getOrders().length;
      const coffeeStockBefore = mockStore.getStockById('stk-coffee-beans')?.current_amount ?? 0;
      const historyBefore = mockStore.getStockHistories().length;
      const shiftBefore = await shiftService.getActiveShift();
      const snapshotBeforeStr = JSON.stringify(mockStore.getSnapshot());

      // 3. Simulasikan kegagalan persistensi saat checkout
      storage10.throwOnSetItem = true;

      let checkoutFailed = false;
      try {
        await transactionService.processTransaction({
          order_type: 'dine_in',
          items: [
            {
              product_id: 'prd-americano',
              product_name: 'Americano Classic',
              price: 18000,
              qty: 2, // butuh 36g kopi
            },
          ],
          payment_method: 'cash',
          amount_paid: 40000,
          user: cashierUser,
        });
      } catch (err: any) {
        checkoutFailed = true;
        if (!err.message?.includes('DataIntegrityError') && !err.message?.includes('Kuota')) {
          errors.push(`[Test 10] Expected DataIntegrityError on checkout failure, got: ${err.message}`);
        }
      }

      if (!checkoutFailed) {
        errors.push('[Test 10] Checkout transaction did not throw error when storage persist failed!');
      }

      // 4. Verifikasi seluruh entitas kembali utuh secara atomik (zero mutation):
      const ordersAfter = mockStore.getOrders().length;
      if (ordersAfter !== ordersBefore) {
        errors.push(`[Test 10] Orders count changed despite failure: before ${ordersBefore}, after ${ordersAfter}`);
      }

      const coffeeStockAfter = mockStore.getStockById('stk-coffee-beans')?.current_amount ?? 0;
      if (coffeeStockAfter !== coffeeStockBefore) {
        errors.push(`[Test 10] Stock deducted despite checkout failure: before ${coffeeStockBefore}, after ${coffeeStockAfter}`);
      }

      const historyAfter = mockStore.getStockHistories().length;
      if (historyAfter !== historyBefore) {
        errors.push(`[Test 10] Stock histories increased despite checkout failure: before ${historyBefore}, after ${historyAfter}`);
      }

      const shiftAfter = await shiftService.getActiveShift();
      if (
        !shiftAfter ||
        shiftAfter.id !== shiftBefore?.id ||
        shiftAfter.status !== shiftBefore?.status ||
        shiftAfter.cash_initial !== shiftBefore?.cash_initial
      ) {
        errors.push('[Test 10] Active shift state changed despite checkout failure!');
      }

      if (shiftBefore && shiftAfter) {
        const finBefore = calculateShiftFinancials(shiftBefore, mockStore.getOrders());
        const finAfter = calculateShiftFinancials(shiftAfter, mockStore.getOrders());
        if (
          finAfter.total_orders_count !== finBefore.total_orders_count ||
          finAfter.gross_sales !== finBefore.gross_sales ||
          finAfter.net_sales !== finBefore.net_sales
        ) {
          errors.push('[Test 10] Shift financial calculations changed despite checkout failure!');
        }
      }

      const snapshotAfterStr = JSON.stringify(mockStore.getSnapshot());
      if (snapshotAfterStr !== snapshotBeforeStr) {
        errors.push('[Test 10] Store snapshot diverged from pre-checkout state after failure!');
      }

      // 5. Pulihkan storage dan verifikasi bahwa transaksi berikutnya menghasilkan nomor order yang konsisten
      storage10.throwOnSetItem = false;
      const nextOrder = await transactionService.processTransaction({
        order_type: 'dine_in',
        items: [
          {
            product_id: 'prd-americano',
            product_name: 'Americano Classic',
            price: 18000,
            qty: 1,
          },
        ],
        payment_method: 'cash',
        amount_paid: 20000,
        user: cashierUser,
      });

      if (!nextOrder.order_number || !nextOrder.order_number.startsWith('ORD-')) {
        errors.push(`[Test 10] Order number corrupted after rollback recovery: ${nextOrder.order_number}`);
      }
    }

    // =========================================================================
    // 11. DEDUPLIKASI KARANTINA, KEY YANG SUDAH ADA & VERIFIKASI BACA (H-1 & L-1)
    // =========================================================================
    const storage11 = new MockIsolatedStorage();
    const brokenDataA = '{"corrupted_data_A": true, broken: [';
    storage11.setItem(DEMO_STORAGE_KEY, brokenDataA);
    setStorageDriver(storage11);

    // Load 1: Harus membuat key karantina pertama
    const res11_1 = mockStore.reinitializeFromStorage();
    const qKey1 = res11_1.corruptionDetails?.quarantineKey;
    if (!qKey1) {
      errors.push('[Test 11] Failed to create first quarantine key');
    } else {
      if (storage11.getItem(qKey1) !== brokenDataA) {
        errors.push('[Test 11] Quarantine content is not identical to raw source data');
      }
    }

    const qKeysCountAfterFirstLoad = Object.keys(storage11.store).filter(k => k.includes('_quarantine_')).length;
    if (qKeysCountAfterFirstLoad !== 1) {
      errors.push(`[Test 11] Expected 1 quarantine key, got ${qKeysCountAfterFirstLoad}`);
    }

    // Load 2: Reload dengan sumber data rusak yang SAMA PERSIS (deduplikasi aktif)
    const res11_2 = mockStore.reinitializeFromStorage();
    const qKey2 = res11_2.corruptionDetails?.quarantineKey;
    if (qKey2 !== qKey1) {
      errors.push(`[Test 11] Quarantine deduplication failed: expected reused key ${qKey1}, got ${qKey2}`);
    }

    const qKeysCountAfterSecondLoad = Object.keys(storage11.store).filter(k => k.includes('_quarantine_')).length;
    if (qKeysCountAfterSecondLoad !== 1) {
      errors.push(`[Test 11] Identical corrupted reload duplicated quarantine keys! Count grew to ${qKeysCountAfterSecondLoad}`);
    }

    // Load 3: Simulasikan ada data rusak BARU / BERBEDA di DEMO_STORAGE_KEY
    const brokenDataB = '{"different_corrupted_data_B": 12345, broken: [';
    storage11.setItem(DEMO_STORAGE_KEY, brokenDataB);

    const res11_3 = mockStore.reinitializeFromStorage();
    const qKey3 = res11_3.corruptionDetails?.quarantineKey;
    if (!qKey3 || qKey3 === qKey1) {
      errors.push('[Test 11] Distinct corrupted data did not receive new distinct quarantine key');
    }

    // Pastikan salinan karantina pertama (brokenDataA) TIDAK tertimpa oleh data baru!
    if (qKey1 && storage11.getItem(qKey1) !== brokenDataA) {
      errors.push('[Test 11] Previous quarantine copy was overwritten by different corrupted data!');
    }
    if (qKey3 && storage11.getItem(qKey3) !== brokenDataB) {
      errors.push('[Test 11] New quarantine copy content does not match brokenDataB');
    }

    const qKeysCountTotal = Object.keys(storage11.store).filter(k => k.includes('_quarantine_')).length;
    if (qKeysCountTotal !== 2) {
      errors.push(`[Test 11] Expected 2 distinct quarantine keys, got ${qKeysCountTotal}`);
    }

    // =========================================================================
    // 12. STORAGE_UNAVAILABLE SETELAH RESET INTERNAL & KEGAGALAN EKSPLISIT (H-2)
    // =========================================================================
    setStorageDriver(null); // Storage benar-benar tidak tersedia

    // Reset internal dipanggil saat storage unavailable
    mockStore.resetMockStore();
    const statusPostReset = mockStore.getStorageStatusInfo();

    if (statusPostReset.status !== 'STORAGE_UNAVAILABLE') {
      errors.push(`[Test 12] Expected status STORAGE_UNAVAILABLE post resetMockStore, got ${statusPostReset.status}`);
    }
    if (statusPostReset.isWriteLocked !== true) {
      errors.push('[Test 12] resetMockStore unlocked write-lock when storage was UNAVAILABLE!');
    }
    if (statusPostReset.lastSaveResult.success !== false) {
      errors.push('[Test 12] lastSaveResult reported success = true when storage was UNAVAILABLE');
    }
    if (statusPostReset.lastSaveResult.errorCode !== 'STORAGE_UNAVAILABLE') {
      errors.push(`[Test 12] Expected errorCode STORAGE_UNAVAILABLE, got ${statusPostReset.lastSaveResult.errorCode}`);
    }

    // Pastikan mutasi normal GAGAL secara eksplisit dan melempar DataIntegrityError
    let mutationPostResetFailed = false;
    const productsBeforeUnavailableMutation = mockStore.getProducts().length;
    try {
      mockStore.addProduct({
        name: 'Produk Saat Storage Rusak',
        price: 30000,
        cost_price: 12000,
        category_id: 'cat-1',
        description: 'Test unavailable storage',
        image_url: '',
        is_favorite: false,
        is_active: true,
      });
    } catch (err: any) {
      mutationPostResetFailed = true;
      if (!err.message?.includes('DataIntegrityError')) {
        errors.push(`[Test 12] Expected DataIntegrityError on unavailable mutation, got: ${err.message}`);
      }
    }

    if (!mutationPostResetFailed) {
      errors.push('[Test 12] Mutation succeeded in RAM when storage was STORAGE_UNAVAILABLE!');
    }

    // Pastikan atomic rollback: produk tidak bertambah di RAM
    if (mockStore.getProducts().length !== productsBeforeUnavailableMutation) {
      errors.push('[Test 12] Atomic rollback failed: RAM products increased under STORAGE_UNAVAILABLE');
    }
  } finally {
    // Bersihkan storage driver tiruan agar lingkungan kembali ke default
    setStorageDriver(undefined);
  }

  return {
    pass: errors.length === 0,
    errors,
  };
}

// CLI Execution
if (import.meta.url.endsWith('validateDataIntegrity.ts') || process.argv[1]?.includes('validateDataIntegrity')) {
  console.log('====================================================');
  console.log('   BOOTH DAILY — DATA INTEGRITY & PERSISTENCE SUITE');
  console.log('====================================================');

  validateDataIntegrity().then((report) => {
    console.log(`1. Fresh Install Memuat Seed Normal          : ${!report.errors.some(e => e.includes('[Test 1]')) ? 'PASS' : 'FAIL'}`);
    console.log(`2. Snapshot Valid Tetap Dimuat               : ${!report.errors.some(e => e.includes('[Test 2]')) ? 'PASS' : 'FAIL'}`);
    console.log(`3. JSON Rusak Tidak Ditimpa Setelah Mutasi   : ${!report.errors.some(e => e.includes('[Test 3]')) ? 'PASS' : 'FAIL'}`);
    console.log(`4. Schema Invalid Bukan Fresh Install        : ${!report.errors.some(e => e.includes('[Test 4]')) ? 'PASS' : 'FAIL'}`);
    console.log(`5. Karantina Gagal Tidak Menimpa Data Asli   : ${!report.errors.some(e => e.includes('[Test 5]')) ? 'PASS' : 'FAIL'}`);
    console.log(`6. QuotaExceeded Dilaporkan & Atomic Rollback: ${!report.errors.some(e => e.includes('[Test 6]')) ? 'PASS' : 'FAIL'}`);
    console.log(`7. Storage Unavailable Tidak Klaim Sukses    : ${!report.errors.some(e => e.includes('[Test 7]')) ? 'PASS' : 'FAIL'}`);
    console.log(`8. Penulisan Sukses Tetap Berjalan Normal    : ${!report.errors.some(e => e.includes('[Test 8]')) ? 'PASS' : 'FAIL'}`);
    console.log(`9. Perilaku Bisnis (HPP, Stok, Shift) Utuh   : ${!report.errors.some(e => e.includes('[Test 9]')) ? 'PASS' : 'FAIL'}`);
    console.log(`10. Multi-entity Rollback Checkout (M-1)     : ${!report.errors.some(e => e.includes('[Test 10]')) ? 'PASS' : 'FAIL'}`);
    console.log(`11. Deduplikasi Karantina & Read-Back (H-1)  : ${!report.errors.some(e => e.includes('[Test 11]')) ? 'PASS' : 'FAIL'}`);
    console.log(`12. Storage Unavailable Post-Reset (H-2)     : ${!report.errors.some(e => e.includes('[Test 12]')) ? 'PASS' : 'FAIL'}`);
    console.log('----------------------------------------------------');

    if (report.pass) {
      console.log('OVERALL STATUS                             : ALL CHECKS PASSED (EXIT 0)');
      console.log('====================================================');
      process.exit(0);
    } else {
      console.error('FAILURES DETECTED:');
      report.errors.forEach(err => console.error('  - ' + err));
      console.log('====================================================');
      process.exit(1);
    }
  });
}
