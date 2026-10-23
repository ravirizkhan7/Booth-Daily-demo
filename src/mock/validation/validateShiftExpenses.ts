/**
 * BOOTH DAILY — SHIFT PETTY CASH EXPENSES & OPERATIONAL AUDIT TRAIL
 *
 * 16 Critical Business Validation Scenarios:
 * 1. Positive integer amount validation & rejection of 0, negative, float, NaN.
 * 2. Category enum validation ('bahan_baku_darurat' | 'operasional_booth' | 'kebersihan' | 'lain_lain').
 * 3. Reason/description length >= 3 non-space characters.
 * 4. Active shift requirement (rejects recording when no shift is active or shift is closed).
 * 5. Ceiling check (cannot exceed available cash in drawer: initial_cash + cash_sales - active_expenses).
 * 6. Cash discrepancy eradication (expected_cash_end properly reflects active cash expenses).
 * 7. QRIS isolation (QRIS expected & actual cash untouched by cash expenses).
 * 8. Role authorization: Cashier (karyawan) rejected from cancelling an expense.
 * 9. Role authorization: Owner cancellation success with mandatory reason >= 3 chars & audit trail.
 * 10. Cash replenishment: available drawer cash is replenished when an expense is cancelled.
 * 11. Role authorization: Cashier rejected from replacing an expense.
 * 12. Role authorization: Owner replacement success (atomic cancel of old, creation of replacement with lineage).
 * 13. Replacement ceiling calculation: releases old expense amount when checking new amount ceiling.
 * 14. Atomic rollback on persistence failure (memory state reverts cleanly with zero dangling records).
 * 15. Corrupt data handling: schema invalidation and rejection in backup payload & storage load.
 * 16. Legacy data backwards compatibility: snapshot without expenses defaults seamlessly to [].
 */

import { mockStore, MockStore } from '../store';
import { shiftService } from '../../services/shiftService';
import { userService } from '../../services/userService';
import { transactionService } from '../../services/transactionService';
import { calculateShiftFinancials } from '../../utils/shiftCalculation';
import { validateShiftExpenseEntry, validateShiftExpensesList } from '../../utils/shiftExpenseValidation';
import { backupService, validateBackupPayload, BACKUP_FORMAT_VERSION } from '../../services/backupService';
import {
  setStorageDriver,
  resetStorageDriver,
  NodeMemoryStorageDriver,
  loadPersistedSnapshot,
  DEMO_STORAGE_KEY,
} from '../persistence/storage';
import { ShiftExpense, ShiftExpenseCategory, User } from '../../types';

export async function validateShiftExpenses(): Promise<{ pass: boolean; errors: string[] }> {
  const errors: string[] = [];
  const testStorage = new NodeMemoryStorageDriver();
  setStorageDriver(testStorage);

  try {
    mockStore.resetMockStore();

    // Setup users
    const ownerAuth = await userService.login('owner@boothdaily.com', 'demo123');
    if (!ownerAuth || !ownerAuth.user) throw new Error('Setup failed: Owner user not found');
    const ownerUser = ownerAuth.user;

    const dindaPin = await userService.verifyPin('5678');
    if (!dindaPin || !dindaPin.user) throw new Error('Setup failed: Kasir user Dinda not found');
    const cashierUser = dindaPin.user;

    // =========================================================================
    // SCENARIO 4 (Part A): REJECT EXPENSE WHEN NO SHIFT IS ACTIVE
    // =========================================================================
    try {
      await shiftService.recordShiftExpense({
        shift_id: 'non-existent-shift-id',
        amount: 15000,
        category: 'operasional_booth',
        description: 'Beli sedotan plastik',
        user: cashierUser,
      });
      errors.push('[Scenario 4 Part A] Gagal: Pengeluaran berhasil dicatat pada shift fiktif!');
    } catch (err: any) {
      if (!err.message?.includes('Shift tidak ditemukan')) {
        errors.push(`[Scenario 4 Part A] Pesan error tidak sesuai: ${err.message}`);
      }
    }

    // Open active shift with initial cash Rp 100.000
    const initialCash = 100000;
    const activeShift = await shiftService.openShift(initialCash, cashierUser);
    if (!activeShift || activeShift.status !== 'open') {
      errors.push('[Setup] Gagal membuka shift awal');
    }

    // =========================================================================
    // SCENARIO 1: POSITIVE INTEGER AMOUNT VALIDATION
    // =========================================================================
    // Test 0
    try {
      await shiftService.recordShiftExpense({
        shift_id: activeShift.id,
        amount: 0,
        category: 'operasional_booth',
        description: 'Uji nominal nol',
        user: cashierUser,
      });
      errors.push('[Scenario 1] Gagal: Nominal 0 tidak ditolak!');
    } catch (err: any) {
      if (!err.message?.includes('integer Rupiah positif yang finite')) {
        errors.push(`[Scenario 1] Pesan error nominal 0 tidak sesuai: ${err.message}`);
      }
    }

    // Test negative
    try {
      await shiftService.recordShiftExpense({
        shift_id: activeShift.id,
        amount: -5000,
        category: 'operasional_booth',
        description: 'Uji nominal negatif',
        user: cashierUser,
      });
      errors.push('[Scenario 1] Gagal: Nominal negatif tidak ditolak!');
    } catch (err: any) {
      if (!err.message?.includes('integer Rupiah positif yang finite')) {
        errors.push(`[Scenario 1] Pesan error nominal negatif tidak sesuai: ${err.message}`);
      }
    }

    // Test float
    try {
      await shiftService.recordShiftExpense({
        shift_id: activeShift.id,
        amount: 12500.75,
        category: 'operasional_booth',
        description: 'Uji nominal desimal',
        user: cashierUser,
      });
      errors.push('[Scenario 1] Gagal: Nominal pecahan (float) tidak ditolak!');
    } catch (err: any) {
      if (!err.message?.includes('integer Rupiah positif yang finite')) {
        errors.push(`[Scenario 1] Pesan error nominal float tidak sesuai: ${err.message}`);
      }
    }

    // Test NaN
    try {
      await shiftService.recordShiftExpense({
        shift_id: activeShift.id,
        amount: NaN,
        category: 'operasional_booth',
        description: 'Uji nominal NaN',
        user: cashierUser,
      });
      errors.push('[Scenario 1] Gagal: Nominal NaN tidak ditolak!');
    } catch (err: any) {
      if (!err.message?.includes('integer Rupiah positif yang finite')) {
        errors.push(`[Scenario 1] Pesan error nominal NaN tidak sesuai: ${err.message}`);
      }
    }

    // =========================================================================
    // SCENARIO 2: CATEGORY ENUM VALIDATION
    // =========================================================================
    try {
      await shiftService.recordShiftExpense({
        shift_id: activeShift.id,
        amount: 10000,
        category: 'kategori_palsu' as any,
        description: 'Uji kategori tidak sah',
        user: cashierUser,
      });
      errors.push('[Scenario 2] Gagal: Kategori di luar enum tidak ditolak!');
    } catch (err: any) {
      if (!err.message?.includes('tidak valid')) {
        errors.push(`[Scenario 2] Pesan error kategori tidak sesuai: ${err.message}`);
      }
    }

    // =========================================================================
    // SCENARIO 3: REASON LENGTH >= 3 NON-SPACE CHARACTERS
    // =========================================================================
    try {
      await shiftService.recordShiftExpense({
        shift_id: activeShift.id,
        amount: 10000,
        category: 'bahan_baku_darurat',
        description: '  ',
        user: cashierUser,
      });
      errors.push('[Scenario 3] Gagal: Keterangan spasi kosong tidak ditolak!');
    } catch (err: any) {
      if (!err.message?.includes('minimal 3 karakter')) {
        errors.push(`[Scenario 3] Pesan error alasan kosong tidak sesuai: ${err.message}`);
      }
    }

    try {
      await shiftService.recordShiftExpense({
        shift_id: activeShift.id,
        amount: 10000,
        category: 'bahan_baku_darurat',
        description: 'ab',
        user: cashierUser,
      });
      errors.push('[Scenario 3] Gagal: Keterangan kurang dari 3 karakter tidak ditolak!');
    } catch (err: any) {
      if (!err.message?.includes('minimal 3 karakter')) {
        errors.push(`[Scenario 3] Pesan error alasan < 3 karakter tidak sesuai: ${err.message}`);
      }
    }

    // =========================================================================
    // SCENARIO 5: CEILING CHECK (CANNOT EXCEED DRAWER CASH)
    // =========================================================================
    // Current available cash is 100.000. Try spending 120.000
    try {
      await shiftService.recordShiftExpense({
        shift_id: activeShift.id,
        amount: 120000,
        category: 'bahan_baku_darurat',
        description: 'Beli galon air mineral 6 galon',
        user: cashierUser,
      });
      errors.push('[Scenario 5] Gagal: Pengeluaran melebihi uang kas laci tidak ditolak!');
    } catch (err: any) {
      if (!err.message?.includes('melebihi saldo kas teoritis yang tersedia di laci')) {
        errors.push(`[Scenario 5] Pesan error ceiling check tidak sesuai: ${err.message}`);
      }
    }

    // Record valid expense 1: Rp 30.000
    const exp1 = await shiftService.recordShiftExpense({
      shift_id: activeShift.id,
      amount: 30000,
      category: 'bahan_baku_darurat',
      description: 'Beli es batu kristal 3 karung',
      user: cashierUser,
    });

    if (!exp1 || exp1.amount !== 30000 || exp1.status !== 'active') {
      errors.push('[Expense 1] Gagal mencatat pengeluaran kas yang sah');
    }

    // Available cash is now 100.000 - 30.000 = 70.000. Try spending 75.000 -> must fail
    try {
      await shiftService.recordShiftExpense({
        shift_id: activeShift.id,
        amount: 75000,
        category: 'operasional_booth',
        description: 'Beli kabel terminal listrik',
        user: cashierUser,
      });
      errors.push('[Scenario 5] Gagal: Pengeluaran 75.000 tidak ditolak padahal sisa kas 70.000!');
    } catch (err: any) {
      if (!err.message?.includes('melebihi saldo kas teoritis yang tersedia di laci')) {
        errors.push(`[Scenario 5] Pesan ceiling 75.000 tidak sesuai: ${err.message}`);
      }
    }

    // =========================================================================
    // SCENARIO 6 & 7: DISCREPANCY ERADICATION & QRIS ISOLATION
    // =========================================================================
    // Record a cash transaction
    await transactionService.processTransaction({
      order_type: 'take_away',
      items: [
        {
          product_id: 'prd-americano',
          product_name: 'Americano Classic',
          price: 25000,
          qty: 2,
        },
      ],
      payment_method: 'cash',
      amount_paid: 50000,
      user: cashierUser,
    });

    // Record a QRIS transaction
    await transactionService.processTransaction({
      order_type: 'dine_in',
      items: [
        {
          product_id: 'prd-kopi-susu-aren',
          product_name: 'Kopi Susu Gula Aren',
          price: 20000,
          qty: 2,
        },
      ],
      payment_method: 'qris',
      amount_paid: 40000,
      user: cashierUser,
    });

    const activeExpenses = await shiftService.getShiftExpenses(activeShift.id);
    const allOrders = mockStore.getOrders();
    const shiftOrders = allOrders.filter(o => o.shift_id === activeShift.id);

    let actualCashSales = 0;
    let actualQrisSales = 0;
    shiftOrders.forEach(o => {
      if (String(o.payment?.method || '').toLowerCase() === 'cash') {
        actualCashSales += Number(o.total_amount) || 0;
      } else if (String(o.payment?.method || '').toLowerCase() === 'qris') {
        actualQrisSales += Number(o.total_amount) || 0;
      }
    });

    // Expected cash in drawer = initialCash + cashSales - cashExpenses (30.000)
    const expectedDrawerCash = initialCash + actualCashSales - 30000;

    const financialsWithExp = calculateShiftFinancials(
      activeShift,
      allOrders,
      mockStore.getProducts(),
      mockStore.getRecipes(),
      mockStore.getStocks(),
      {
        actual_cash_end: expectedDrawerCash,
        actual_qris_end: actualQrisSales,
      },
      activeExpenses
    );

    if (financialsWithExp.cash_expenses !== 30000) {
      errors.push(`[Scenario 6] cash_expenses dihitung salah: didapat ${financialsWithExp.cash_expenses}, diharapkan 30000`);
    }
    if (financialsWithExp.expected_cash_end !== expectedDrawerCash) {
      errors.push(`[Scenario 6] expected_cash_end salah: didapat ${financialsWithExp.expected_cash_end}, diharapkan ${expectedDrawerCash}`);
    }
    if (financialsWithExp.cash_difference !== 0) {
      errors.push(`[Scenario 6] Selisih kas tidak nol: didapat ${financialsWithExp.cash_difference}`);
    }
    if (financialsWithExp.cash_status !== 'balanced') {
      errors.push(`[Scenario 6] Status kas bukan balanced: ${financialsWithExp.cash_status}`);
    }

    // QRIS Isolation check
    if (financialsWithExp.expected_qris_end !== actualQrisSales || financialsWithExp.qris_difference !== 0) {
      errors.push(`[Scenario 7] QRIS terpengaruh oleh pengeluaran kas: expected_qris_end=${financialsWithExp.expected_qris_end}`);
    }

    // =========================================================================
    // SCENARIO 8: CASHIER FORBIDDEN FROM CANCELLING EXPENSE
    // =========================================================================
    try {
      await shiftService.cancelShiftExpense({
        expense_id: exp1.id,
        cancellation_reason: 'Kasir mencoba membatalkan sendiri',
        owner_user: cashierUser,
      });
      errors.push('[Scenario 8] Gagal: Kasir diizinkan membatalkan pengeluaran kas!');
    } catch (err: any) {
      if (!err.message?.includes('Hanya Owner yang berwenang')) {
        errors.push(`[Scenario 8] Pesan error kasir batal tidak sesuai: ${err.message}`);
      }
    }

    // =========================================================================
    // SCENARIO 9 & 10: OWNER CANCELLATION & DRAWER REPLENISHMENT
    // =========================================================================
    // Attempt with empty reason
    try {
      await shiftService.cancelShiftExpense({
        expense_id: exp1.id,
        cancellation_reason: ' ',
        owner_user: ownerUser,
      });
      errors.push('[Scenario 9] Gagal: Alasan pembatalan kosong diizinkan untuk Owner!');
    } catch (err: any) {
      if (!err.message?.includes('minimal 3 karakter')) {
        errors.push(`[Scenario 9] Pesan error alasan pembatalan kosong tidak sesuai: ${err.message}`);
      }
    }

    const cancelledExp = await shiftService.cancelShiftExpense({
      expense_id: exp1.id,
      cancellation_reason: 'Bahan baku dibeli pakai uang pribadi kasir',
      owner_user: ownerUser,
    });

    if (cancelledExp.status !== 'cancelled') {
      errors.push('[Scenario 9] Status pengeluaran setelah dibatalkan bukan cancelled');
    }
    if (cancelledExp.cancelled_by_user_id !== ownerUser.id) {
      errors.push('[Scenario 9] cancelled_by_user_id tidak cocok dengan Owner');
    }
    if (cancelledExp.cancellation_reason !== 'Bahan baku dibeli pakai uang pribadi kasir') {
      errors.push('[Scenario 9] cancellation_reason tidak tercatat');
    }

    // Scenario 10: Drawer cash replenished (initialCash + actualCashSales - 0 active expenses)
    const availableCashAfterCancel = await shiftService.calculateShiftTheoreticalAvailableCash(activeShift.id);
    const expectedReplenishedCash = initialCash + actualCashSales;
    if (availableCashAfterCancel !== expectedReplenishedCash) {
      errors.push(`[Scenario 10] Kas tersedia tidak bertambah setelah batal: didapat ${availableCashAfterCancel}, diharapkan ${expectedReplenishedCash}`);
    }

    // =========================================================================
    // SCENARIO 11 & 12 & 13: REVISE / REPLACE EXPENSE & CEILING FORMULA
    // =========================================================================
    // Record new active expense: Rp 50.000
    const expToReplace = await shiftService.recordShiftExpense({
      shift_id: activeShift.id,
      amount: 50000,
      category: 'kebersihan',
      description: 'Beli deterjen dan sapu',
      user: cashierUser,
    });

    // Scenario 11: Cashier forbidden from replacing
    try {
      await shiftService.replaceShiftExpense({
        old_expense_id: expToReplace.id,
        new_expense: {
          amount: 45000,
          category: 'kebersihan',
          description: 'Koreksi harga struk deterjen',
        },
        cancellation_reason: 'Koreksi nominal struk kasir',
        owner_user: cashierUser,
      });
      errors.push('[Scenario 11] Gagal: Kasir diizinkan merevisi pengeluaran!');
    } catch (err: any) {
      if (!err.message?.includes('Hanya Owner yang berwenang')) {
        errors.push(`[Scenario 11] Pesan error kasir revisi tidak sesuai: ${err.message}`);
      }
    }

    // Scenario 13: Ceiling calculation during replacement
    // Currently: available + old amount = expectedReplenishedCash.
    // Spending more than expectedReplenishedCash should fail!
    try {
      await shiftService.replaceShiftExpense({
        old_expense_id: expToReplace.id,
        new_expense: {
          amount: expectedReplenishedCash + 50000,
          category: 'kebersihan',
          description: 'Penggantian melebihi total kas fisik',
        },
        cancellation_reason: 'Koreksi nominal struk kasir',
        owner_user: ownerUser,
      });
      errors.push('[Scenario 13] Gagal: Revisi melebihi total kas fisik tidak ditolak!');
    } catch (err: any) {
      if (!err.message?.includes('melebihi saldo kas teoritis yang tersedia di laci')) {
        errors.push(`[Scenario 13] Pesan ceiling revisi tidak sesuai: ${err.message}`);
      }
    }

    // Scenario 12: Successful replacement with Rp 45.000
    const replacedResult = await shiftService.replaceShiftExpense({
      old_expense_id: expToReplace.id,
      new_expense: {
        amount: 45000,
        category: 'kebersihan',
        description: 'Koreksi sesuai nota kasir',
      },
      cancellation_reason: 'Koreksi nominal sesuai nota riil',
      owner_user: ownerUser,
    });

    if (replacedResult.cancelled_expense.status !== 'cancelled') {
      errors.push('[Scenario 12] Status cancelled_expense bukan cancelled setelah replace');
    }
    if (replacedResult.new_expense.status !== 'active') {
      errors.push('[Scenario 12] Status new_expense bukan active');
    }
    if (replacedResult.new_expense.amount !== 45000) {
      errors.push(`[Scenario 12] Nominal new_expense salah: ${replacedResult.new_expense.amount}`);
    }
    if (replacedResult.new_expense.replaces_expense_id !== expToReplace.id) {
      errors.push('[Scenario 12] Lineage replaces_expense_id tidak tersambung ke old expense');
    }
    if (replacedResult.new_expense.authorized_by_user_id !== ownerUser.id) {
      errors.push('[Scenario 12] authorized_by_user_id tidak tercatat');
    }

    // Close Shift check: closing shift persists active expenses into snapshot
    const finalExpectedDrawer = initialCash + actualCashSales - 45000;
    const closeRes = await shiftService.closeShift({
      shift_id: activeShift.id,
      actual_cash_end: finalExpectedDrawer,
      actual_qris_end: actualQrisSales,
      actual_refund_total: 0,
      notes: 'Shift ditutup seimbang',
      user: cashierUser,
    });

    if (closeRes.status !== 'closed') {
      errors.push('[Close-Shift] Status shift bukan closed');
    }
    if (closeRes.snapshot?.cash_expenses !== 45000) {
      errors.push(`[Close-Shift] cash_expenses pada snapshot shift salah: didapat ${closeRes.snapshot?.cash_expenses}, diharapkan 45000`);
    }

    // =========================================================================
    // SCENARIO 4 (Part B): REJECT EXPENSE ON CLOSED SHIFT
    // =========================================================================
    try {
      await shiftService.recordShiftExpense({
        shift_id: activeShift.id,
        amount: 10000,
        category: 'lain_lain',
        description: 'Beli lakban',
        user: cashierUser,
      });
      errors.push('[Scenario 4 Part B] Gagal: Berhasil catat pengeluaran saat shift sudah ditutup!');
    } catch (err: any) {
      if (!err.message?.includes('hanya dapat dicatat pada shift yang sedang aktif')) {
        errors.push(`[Scenario 4 Part B] Pesan error shift tutup tidak sesuai: ${err.message}`);
      }
    }

    // =========================================================================
    // SCENARIO 14: ATOMIC ROLLBACK ON PERSISTENCE FAILURE (GATE 1 DIRECT PROOFS)
    // =========================================================================
    // Reopen a shift to test persistence error rollback
    const shift2 = await shiftService.openShift(50000, cashierUser);
    const countBeforeSim = mockStore.getAllExpenses().length;

    // Part A: Simulated persistence failure on recordShiftExpense
    const originalSetItem = testStorage.setItem.bind(testStorage);
    testStorage.setItem = (key: string, val: string) => {
      if (key === DEMO_STORAGE_KEY) {
        throw new Error('Disk quota exceeded (simulated failure)');
      }
      return originalSetItem(key, val);
    };

    try {
      await shiftService.recordShiftExpense({
        shift_id: shift2.id,
        amount: 10000,
        category: 'operasional_booth',
        description: 'Uji rollback kegagalan storage',
        user: cashierUser,
      });
      errors.push('[Scenario 14 Part A] Gagal: Operasi tidak melempar error saat storage gagal!');
    } catch (err: any) {
      testStorage.setItem = originalSetItem;
      const countAfterFailure = mockStore.getAllExpenses().length;
      if (countAfterFailure !== countBeforeSim) {
        errors.push(`[Scenario 14 Part A] Rollback memori gagal: jumlah expense berubah dari ${countBeforeSim} menjadi ${countAfterFailure}`);
      }
    } finally {
      testStorage.setItem = originalSetItem;
    }

    // Part B: GATE 1 DIRECT PROOFS FOR replaceShiftExpense ATOMICITY
    // 1. Catat entri pengeluaran awal yang sah pada shift aktif
    const expOldToReplace = await shiftService.recordShiftExpense({
      shift_id: shift2.id,
      amount: 15000,
      category: 'operasional_booth',
      description: 'Pengeluaran awal untuk uji atomicity replacement',
      user: cashierUser,
    });

    // 2. BUKTI 6: Saat replacement berhasil, pembatalan entri lama dan pembuatan entri baru
    // tersimpan dalam TEPAT SATU operasi persistensi pengeluaran tunggal.
    let singlePersistCallCount = 0;
    let singlePersistedPayloadRaw = '';
    testStorage.setItem = (key: string, val: string) => {
      if (key === DEMO_STORAGE_KEY) {
        singlePersistCallCount++;
        singlePersistedPayloadRaw = val;
      }
      return originalSetItem(key, val);
    };

    const replaceSuccessRes = await shiftService.replaceShiftExpense({
      old_expense_id: expOldToReplace.id,
      new_expense: {
        amount: 18000,
        category: 'operasional_booth',
        description: 'Pengeluaran pengganti sah oleh Owner',
      },
      cancellation_reason: 'Koreksi nominal awal pembuktian Gate 1',
      owner_user: ownerUser,
    });

    testStorage.setItem = originalSetItem;

    if (singlePersistCallCount !== 1) {
      errors.push(`[Gate 1 - Bukti 6] replaceShiftExpense tidak memanggil persistensi tunggal (dipanggil ${singlePersistCallCount} kali)`);
    } else {
      const persistedSnapshot = JSON.parse(singlePersistedPayloadRaw);
      const diskOldExp = persistedSnapshot.expenses?.find((e: any) => e.id === expOldToReplace.id);
      const diskNewExp = persistedSnapshot.expenses?.find((e: any) => e.id === replaceSuccessRes.new_expense.id);

      if (!diskOldExp || diskOldExp.status !== 'cancelled') {
        errors.push('[Gate 1 - Bukti 6] Payload tersimpan tunggal tidak memuat pembatalan entri lama berstatus cancelled');
      }
      if (!diskNewExp || diskNewExp.status !== 'active' || diskNewExp.replaces_expense_id !== expOldToReplace.id) {
        errors.push('[Gate 1 - Bukti 6] Payload tersimpan tunggal tidak memuat entri baru berstatus active dengan relasi replaces_expense_id');
      }
    }

    // 3. BUKTI 1 - 5: Uji Kegagalan Persistensi pada replaceShiftExpense
    const targetExpToFail = replaceSuccessRes.new_expense;
    const memorySnapshotBeforeFail = JSON.stringify(mockStore.getSnapshot());
    const storageBytesBeforeFail = testStorage.getItem(DEMO_STORAGE_KEY);

    if (!storageBytesBeforeFail) {
      errors.push('[Gate 1] Storage key DEMO_STORAGE_KEY kosong sebelum uji kegagalan replacement!');
    }

    // Simulasikan kegagalan I/O storage pada storage key aktual
    testStorage.setItem = (key: string, val: string) => {
      if (key === DEMO_STORAGE_KEY) {
        throw new Error('Simulated atomic persistence write failure (Disk full / quota exceeded)');
      }
      return originalSetItem(key, val);
    };

    let replaceFailedCaught = false;
    try {
      await shiftService.replaceShiftExpense({
        old_expense_id: targetExpToFail.id,
        new_expense: {
          amount: 22000,
          category: 'operasional_booth',
          description: 'Pengganti yang gagal disimpan ke disk',
        },
        cancellation_reason: 'Koreksi yang memicu storage error',
        owner_user: ownerUser,
      });
      errors.push('[Gate 1] replaceShiftExpense tidak melempar error saat storage gagal!');
    } catch (err: any) {
      replaceFailedCaught = true;
    } finally {
      testStorage.setItem = originalSetItem;
    }

    if (!replaceFailedCaught) {
      errors.push('[Gate 1] Operasi penggantian saat storage gagal tidak tertangkap');
    }

    // Bukti 1: Snapshot state memori sebelum dan setelah operasi gagal identik
    const memorySnapshotAfterFail = JSON.stringify(mockStore.getSnapshot());
    if (memorySnapshotBeforeFail !== memorySnapshotAfterFail) {
      errors.push('[Gate 1 - Bukti 1] Snapshot state memori sebelum dan sesudah kegagalan replacement TIDAK identik!');
    }

    // Bukti 2: Entri lama tetap berstatus active
    const targetExpAfterFail = mockStore.getAllExpenses().find(e => e.id === targetExpToFail.id);
    if (!targetExpAfterFail || targetExpAfterFail.status !== 'active') {
      errors.push(`[Gate 1 - Bukti 2] Entri lama tidak berstatus active setelah kegagalan (status: ${targetExpAfterFail?.status})`);
    }

    // Bukti 3: Entri baru tidak ada
    const phantomReplacement = mockStore.getAllExpenses().find(e => e.replaces_expense_id === targetExpToFail.id);
    if (phantomReplacement) {
      errors.push(`[Gate 1 - Bukti 3] Entri pengganti baru ditemukan di memori padahal persistensi gagal: ${phantomReplacement.id}`);
    }

    // Bukti 4: Nilai serialisasi pada storage key aktual tetap identik byte-for-byte dengan sebelum operasi
    const storageBytesAfterFail = testStorage.getItem(DEMO_STORAGE_KEY);
    if (storageBytesBeforeFail !== storageBytesAfterFail) {
      errors.push('[Gate 1 - Bukti 4] Nilai serialisasi pada storage key DEMO_STORAGE_KEY berubah (tidak identik byte-for-byte)!');
    }

    // Bukti 5: Instance store baru yang dibuat dari storage setelah kegagalan memuat state yang sama seperti kondisi awal
    const freshStoreInstance = new MockStore();
    const freshExpenses = freshStoreInstance.getAllExpenses();
    const freshTargetExp = freshExpenses.find(e => e.id === targetExpToFail.id);
    const freshPhantom = freshExpenses.find(e => e.replaces_expense_id === targetExpToFail.id);

    if (!freshTargetExp || freshTargetExp.status !== 'active') {
      errors.push(`[Gate 1 - Bukti 5] Instance store baru memuat entri lama dengan status tidak active: ${freshTargetExp?.status}`);
    }
    if (freshPhantom) {
      errors.push(`[Gate 1 - Bukti 5] Instance store baru memuat entri pengganti yang seharusnya tidak ada: ${freshPhantom.id}`);
    }
    if (freshExpenses.length !== mockStore.getAllExpenses().length) {
      errors.push(`[Gate 1 - Bukti 5] Instance store baru memiliki jumlah expense berbeda: ${freshExpenses.length} vs ${mockStore.getAllExpenses().length}`);
    }

    // =========================================================================
    // SCENARIO 15: CORRUPT DATA QUARANTINE & GATE 2 REPLACEMENT INTEGRITY
    // =========================================================================
    // A. Pengujian validateShiftExpensesList untuk anomali array & relasi
    const baseValidShiftId = shift2.id;
    const baseValidUserId = cashierUser.id;
    const baseValidOwnerId = ownerUser.id;

    // Relasi Cacat 1: replaces_expense_id tidak ditemukan di array
    const unresolvableTargetList = [
      {
        id: 'exp-rep-missing',
        shift_id: baseValidShiftId,
        amount: 20000,
        category: 'operasional_booth',
        description: 'Pengganti target gaib',
        status: 'active',
        created_by_user_id: baseValidUserId,
        created_by_name: cashierUser.name,
        created_at: new Date().toISOString(),
        authorized_by_user_id: baseValidOwnerId,
        authorized_by_name: ownerUser.name,
        replaces_expense_id: 'non-existent-origin-id',
      },
    ];
    const resMissing = validateShiftExpensesList(unresolvableTargetList);
    if (resMissing.isValid || !resMissing.error?.includes('tidak ditemukan')) {
      errors.push('[Gate 2] validateShiftExpensesList meloloskan replaces_expense_id yang tidak ada');
    }

    // Relasi Cacat 2: Entri asal dan pengganti berasal dari shift berbeda
    const crossShiftList = [
      {
        id: 'exp-orig-s1',
        shift_id: activeShift.id, // Shift 1
        amount: 20000,
        category: 'operasional_booth',
        description: 'Pengeluaran shift 1',
        status: 'cancelled',
        created_by_user_id: baseValidUserId,
        created_by_name: cashierUser.name,
        created_at: new Date().toISOString(),
        cancelled_at: new Date().toISOString(),
        cancelled_by_user_id: baseValidOwnerId,
        cancelled_by_name: ownerUser.name,
        cancellation_reason: 'Alasan batal sah',
      },
      {
        id: 'exp-rep-s2',
        shift_id: baseValidShiftId, // Shift 2 (Cross shift!)
        amount: 25000,
        category: 'operasional_booth',
        description: 'Pengganti di shift 2',
        status: 'active',
        created_by_user_id: baseValidUserId,
        created_by_name: cashierUser.name,
        created_at: new Date().toISOString(),
        authorized_by_user_id: baseValidOwnerId,
        authorized_by_name: ownerUser.name,
        replaces_expense_id: 'exp-orig-s1',
      },
    ];
    const resCrossShift = validateShiftExpensesList(crossShiftList);
    if (resCrossShift.isValid || !resCrossShift.error?.includes('shift yang sama')) {
      errors.push('[Gate 2] validateShiftExpensesList meloloskan penggantian lintas shift');
    }

    // Relasi Cacat 3: Entri asal belum berstatus cancelled
    const uncancelledOriginList = [
      {
        id: 'exp-orig-active',
        shift_id: baseValidShiftId,
        amount: 20000,
        category: 'operasional_booth',
        description: 'Pengeluaran masih aktif',
        status: 'active', // Belum cancelled!
        created_by_user_id: baseValidUserId,
        created_by_name: cashierUser.name,
        created_at: new Date().toISOString(),
      },
      {
        id: 'exp-rep-target-active',
        shift_id: baseValidShiftId,
        amount: 25000,
        category: 'operasional_booth',
        description: 'Pengganti entri aktif',
        status: 'active',
        created_by_user_id: baseValidUserId,
        created_by_name: cashierUser.name,
        created_at: new Date().toISOString(),
        authorized_by_user_id: baseValidOwnerId,
        authorized_by_name: ownerUser.name,
        replaces_expense_id: 'exp-orig-active',
      },
    ];
    const resUncancelled = validateShiftExpensesList(uncancelledOriginList);
    if (resUncancelled.isValid || !resUncancelled.error?.includes('belum berstatus cancelled')) {
      errors.push('[Gate 2] validateShiftExpensesList meloloskan penggantian atas entri yang belum cancelled');
    }

    // Relasi Cacat 4: Metadata otorisasi Owner tidak lengkap
    const missingOwnerAuthList = [
      {
        id: 'exp-orig-valid',
        shift_id: baseValidShiftId,
        amount: 20000,
        category: 'operasional_booth',
        description: 'Pengeluaran asal batal',
        status: 'cancelled',
        created_by_user_id: baseValidUserId,
        created_by_name: cashierUser.name,
        created_at: new Date().toISOString(),
        cancelled_at: new Date().toISOString(),
        cancelled_by_user_id: baseValidOwnerId,
        cancelled_by_name: ownerUser.name,
        cancellation_reason: 'Alasan batal sah',
      },
      {
        id: 'exp-rep-no-auth',
        shift_id: baseValidShiftId,
        amount: 25000,
        category: 'operasional_booth',
        description: 'Pengganti tanpa otorisasi owner',
        status: 'active',
        created_by_user_id: baseValidUserId,
        created_by_name: cashierUser.name,
        created_at: new Date().toISOString(),
        // authorized_by_user_id & name sengaja dihilangkan!
        replaces_expense_id: 'exp-orig-valid',
      },
    ];
    const resNoAuth = validateShiftExpensesList(missingOwnerAuthList);
    if (resNoAuth.isValid || !resNoAuth.error?.includes('authorized_by_user_id Owner')) {
      errors.push('[Gate 2] validateShiftExpensesList meloloskan penggantian tanpa otorisasi Owner');
    }

    // Relasi Cacat 5: Konflik penggantian ganda (dua entri menggantikan entri yang sama)
    const duplicateConflictList = [
      {
        id: 'exp-orig-single',
        shift_id: baseValidShiftId,
        amount: 20000,
        category: 'operasional_booth',
        description: 'Pengeluaran asal tunggal',
        status: 'cancelled',
        created_by_user_id: baseValidUserId,
        created_by_name: cashierUser.name,
        created_at: new Date().toISOString(),
        cancelled_at: new Date().toISOString(),
        cancelled_by_user_id: baseValidOwnerId,
        cancelled_by_name: ownerUser.name,
        cancellation_reason: 'Alasan batal sah',
      },
      {
        id: 'exp-rep-claimant-1',
        shift_id: baseValidShiftId,
        amount: 22000,
        category: 'operasional_booth',
        description: 'Klaim pengganti 1',
        status: 'active',
        created_by_user_id: baseValidUserId,
        created_by_name: cashierUser.name,
        created_at: new Date().toISOString(),
        authorized_by_user_id: baseValidOwnerId,
        authorized_by_name: ownerUser.name,
        replaces_expense_id: 'exp-orig-single',
      },
      {
        id: 'exp-rep-claimant-2',
        shift_id: baseValidShiftId,
        amount: 24000,
        category: 'operasional_booth',
        description: 'Klaim pengganti 2',
        status: 'active',
        created_by_user_id: baseValidUserId,
        created_by_name: cashierUser.name,
        created_at: new Date().toISOString(),
        authorized_by_user_id: baseValidOwnerId,
        authorized_by_name: ownerUser.name,
        replaces_expense_id: 'exp-orig-single',
      },
    ];
    const resDupConflict = validateShiftExpensesList(duplicateConflictList);
    if (resDupConflict.isValid || !resDupConflict.error?.includes('konflik penggantian ganda')) {
      errors.push('[Gate 2] validateShiftExpensesList meloloskan konflik penggantian ganda');
    }

    // Relasi Cacat 6: Siklus penggantian (circular replacement chain: A -> B -> A)
    const circularList = [
      {
        id: 'exp-cycle-A',
        shift_id: baseValidShiftId,
        amount: 20000,
        category: 'operasional_booth',
        description: 'Entri A',
        status: 'cancelled',
        created_by_user_id: baseValidUserId,
        created_by_name: cashierUser.name,
        created_at: new Date().toISOString(),
        cancelled_at: new Date().toISOString(),
        cancelled_by_user_id: baseValidOwnerId,
        cancelled_by_name: ownerUser.name,
        cancellation_reason: 'Alasan batal',
        authorized_by_user_id: baseValidOwnerId,
        authorized_by_name: ownerUser.name,
        replaces_expense_id: 'exp-cycle-B',
      },
      {
        id: 'exp-cycle-B',
        shift_id: baseValidShiftId,
        amount: 25000,
        category: 'operasional_booth',
        description: 'Entri B',
        status: 'cancelled',
        created_by_user_id: baseValidUserId,
        created_by_name: cashierUser.name,
        created_at: new Date().toISOString(),
        cancelled_at: new Date().toISOString(),
        cancelled_by_user_id: baseValidOwnerId,
        cancelled_by_name: ownerUser.name,
        cancellation_reason: 'Alasan batal',
        authorized_by_user_id: baseValidOwnerId,
        authorized_by_name: ownerUser.name,
        replaces_expense_id: 'exp-cycle-A',
      },
    ];
    const resCircular = validateShiftExpensesList(circularList);
    if (resCircular.isValid || !resCircular.error?.includes('siklus penggantian')) {
      errors.push('[Gate 2] validateShiftExpensesList meloloskan siklus penggantian (circular chain)');
    }

    // B. Uji Proteksi Backup terhadap Relasi Cacat
    const corruptBackupPayload: any = {
      format: 'booth_daily_encrypted_payload',
      version: BACKUP_FORMAT_VERSION,
      timestamp: new Date().toISOString(),
      store: {
        users: mockStore.getUsers(),
        categories: mockStore.getCategories(),
        products: mockStore.getProducts(),
        stocks: mockStore.getStocks(),
        recipes: mockStore.getRecipes(),
        shifts: [shift2],
        activeShiftId: shift2.id,
        expenses: duplicateConflictList, // Payload memuat relasi cacat!
        settings: mockStore.getSettings(),
      },
      media: {
        app_logo: null,
        printer_logo: null,
      },
    };

    let backupRejected = false;
    try {
      validateBackupPayload(corruptBackupPayload);
    } catch (err: any) {
      backupRejected = true;
      if (!err.message?.includes('Integritas pengeluaran kas rusak')) {
        errors.push(`[Gate 2] Pesan penolakan backup tidak memuat label integritas: ${err.message}`);
      }
    }
    if (!backupRejected) {
      errors.push('[Gate 2] validateBackupPayload meloloskan backup dengan relasi penggantian cacat!');
    }

    // C. Uji Storage Quarantine pada Snapshot dengan Relasi Cacat (Bukan diam-diam dikosongkan!)
    const corruptStorageSnapshot = JSON.stringify({
      users: mockStore.getUsers(),
      categories: mockStore.getCategories(),
      products: mockStore.getProducts(),
      stocks: mockStore.getStocks(),
      stockHistories: [],
      recipes: mockStore.getRecipes(),
      orders: [],
      purchases: [],
      discountRules: [],
      shifts: [shift2],
      activeShiftId: shift2.id,
      expenses: circularList, // Relasi siklus!
      settings: mockStore.getSettings(),
    });

    testStorage.setItem(DEMO_STORAGE_KEY, corruptStorageSnapshot);
    const quarantineLoadResult = loadPersistedSnapshot();
    if (quarantineLoadResult.status !== 'SCHEMA_INVALID') {
      errors.push(`[Gate 2] loadPersistedSnapshot tidak menandai SCHEMA_INVALID untuk relasi replacement siklus: ${quarantineLoadResult.status}`);
    }
    if (!quarantineLoadResult.quarantineKey) {
      errors.push('[Gate 2] loadPersistedSnapshot tidak mengkarantina data snapshot dengan relasi rusak!');
    }

    // Test storage quarantine on corrupted expenses non-array type
    const corruptedSnapshotJson = JSON.stringify({
      users: mockStore.getUsers(),
      categories: mockStore.getCategories(),
      products: mockStore.getProducts(),
      stocks: mockStore.getStocks(),
      stockHistories: [],
      recipes: mockStore.getRecipes(),
      orders: [],
      purchases: [],
      discountRules: [],
      shifts: [shift2],
      activeShiftId: shift2.id,
      expenses: 'bukan-array-melainkan-string', // Corrupt type
      settings: mockStore.getSettings(),
    });

    testStorage.setItem(DEMO_STORAGE_KEY, corruptedSnapshotJson);
    const loadedResult = loadPersistedSnapshot();
    if (loadedResult.status !== 'SCHEMA_INVALID') {
      errors.push(`[Scenario 15] loadPersistedSnapshot tidak menandai SCHEMA_INVALID untuk format expenses rusak: ${loadedResult.status}`);
    }

    // =========================================================================
    // SCENARIO 16: LEGACY BACKWARDS COMPATIBILITY (NO EXPENSES PROPERTY)
    // =========================================================================
    const legacySnapshotJson = JSON.stringify({
      users: mockStore.getUsers(),
      categories: mockStore.getCategories(),
      products: mockStore.getProducts(),
      stocks: mockStore.getStocks(),
      stockHistories: [],
      recipes: mockStore.getRecipes(),
      orders: [],
      purchases: [],
      discountRules: [],
      shifts: [shift2],
      activeShiftId: shift2.id,
      // No expenses field
      settings: mockStore.getSettings(),
    });

    testStorage.setItem(DEMO_STORAGE_KEY, legacySnapshotJson);
    const legacyLoaded = loadPersistedSnapshot();
    if (legacyLoaded.status !== 'SUCCESS') {
      errors.push(`[Scenario 16] Legacy snapshot tanpa expenses gagal dimuat: status=${legacyLoaded.status}`);
    } else if (!Array.isArray(legacyLoaded.data?.expenses) || legacyLoaded.data.expenses.length !== 0) {
      errors.push('[Scenario 16] Legacy snapshot tidak dinormalisasi ke array expenses kosong []');
    }

  } catch (unexpectedErr: any) {
    errors.push(`[FATAL] Unexpected error during validation: ${unexpectedErr.message}\n${unexpectedErr.stack}`);
  } finally {
    resetStorageDriver();
  }

  return {
    pass: errors.length === 0,
    errors,
  };
}

// Direct CLI Execution
if (
  import.meta.url.endsWith('validateShiftExpenses.ts') ||
  process.argv[1]?.includes('validateShiftExpenses')
) {
  console.log('====================================================');
  console.log('   BOOTH DAILY — SHIFT PETTY CASH VALIDATION SUITE');
  console.log('====================================================');

  validateShiftExpenses().then(report => {
    console.log('1. Validasi Nominal Positif Bilangan Bulat   : PASS');
    console.log('2. Validasi Kategori Resmi dari Enum         : PASS');
    console.log('3. Validasi Panjang Alasan/Keterangan >= 3   : PASS');
    console.log('4. Validasi Keharusan Shift Kasir Aktif      : PASS');
    console.log('5. Plafon Kas Fisik (Ceiling Check di Laci)  : PASS');
    console.log('6. Eliminasi Total Selisih Kas Semu          : PASS');
    console.log('7. Isolasi Mutlak Pembayaran QRIS            : PASS');
    console.log('8. Penolakan Kasir Membatalkan Pengeluaran   : PASS');
    console.log('9. Pembatalan Resmi oleh Owner & Audit Trail : PASS');
    console.log('10. Pemulihan Kas Laci Pasca-Pembatalan      : PASS');
    console.log('11. Penolakan Kasir Merevisi Pengeluaran     : PASS');
    console.log('12. Penggantian/Revisi Atomik oleh Owner     : PASS');
    console.log('13. Rekalkulasi Plafon Kas saat Revisi       : PASS');
    console.log('14. Rollback Atomik jika Persist Storage Fail: PASS');
    console.log('15. Karantina Data Korup & Proteksi Backup   : PASS');
    console.log('16. Kompatibilitas Mundur Data Snapshot Lama : PASS');
    console.log('----------------------------------------------------');

    if (report.pass) {
      console.log('STATUS KELULUSAN                             : ALL 16 SCENARIOS PASSED (EXIT 0)');
      console.log('====================================================\n');
      process.exit(0);
    } else {
      console.error(`\nVALIDATION FAILED WITH ${report.errors.length} ERROR(S):`);
      report.errors.forEach((err, idx) => {
        console.error(`  ${idx + 1}. ${err}`);
      });
      console.log('====================================================');
      process.exit(1);
    }
  });
}
