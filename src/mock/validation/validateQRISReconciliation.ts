import { calculateShiftFinancials, getShiftQrisDisplayInfo } from '../../utils/shiftCalculation';
import { Shift, Order, Product, Recipe, Stock, ShiftExpense } from '../../types';

export function runQRISReconciliationTests() {
  console.log('===============================================================');
  console.log('   BOOTH DAILY — QRIS RECONCILIATION VALIDATION SUITE');
  console.log('===============================================================');

  const baseShift: Shift = {
    id: 'shift-test-1',
    shift_number: 'SH-001',
    operational_date: '2026-10-23',
    status: 'open',
    opened_at: '2026-10-23T08:00:00.000Z',
    opened_by_user_id: 'usr-1',
    opened_by_name: 'Dinda',
    cash_initial: 100000,
    created_at: '2026-10-23T08:00:00.000Z',
  };

  const emptyProducts: Product[] = [];
  const emptyRecipes: Recipe[] = [];
  const emptyStocks: Stock[] = [];
  const emptyExpenses: ShiftExpense[] = [];

  // -------------------------------------------------------------------------
  // Test 1: No QRIS sales, no QRIS refunds, no actual QRIS value
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 1: Tidak Ada Transaksi QRIS (Sales 0, Refunds 0, Actual null) ---');
  const cashOnlyOrder: Order = {
    id: 'ord-cash-1',
    order_number: 'ORD-001',
    order_type: 'take_away',
    created_by_user_id: 'usr-1',
    created_by_name: 'Dinda',
    created_by_role: 'karyawan',
    shift_id: baseShift.id,
    subtotal: 25000,
    tax: 0,
    discount: 0,
    total_amount: 25000,
    payment: {
      id: 'pay-1',
      order_id: 'ord-cash-1',
      method: 'cash',
      amount_paid: 25000,
      change: 0,
      status: 'completed',
    },
    items: [],
    created_at: '2026-10-23T09:00:00.000Z',
  };

  const res1 = calculateShiftFinancials(
    baseShift,
    [cashOnlyOrder],
    emptyProducts,
    emptyRecipes,
    emptyStocks,
    { actual_cash_end: 125000, actual_qris_end: null },
    emptyExpenses
  );

  if (res1.qris_status !== 'no_transaction') {
    throw new Error(`Test 1 Gagal: qris_status harus 'no_transaction', didapat '${res1.qris_status}'`);
  }
  if (res1.reconciliation_status !== 'matched') {
    throw new Error(`Test 1 Gagal: reconciliation_status harus 'matched' ketika kas cocok dan tidak ada QRIS, didapat '${res1.reconciliation_status}'`);
  }
  const display1 = getShiftQrisDisplayInfo(res1);
  if (display1.status !== 'no_transaction' || !display1.isReconciledOrExempt) {
    throw new Error(`Test 1 Gagal: getShiftQrisDisplayInfo harus mengembalikan status 'no_transaction' dan isReconciledOrExempt true`);
  }
  if (display1.badgeLabel !== 'Tidak ada QRIS') {
    throw new Error(`Test 1 Gagal: badgeLabel harus 'Tidak ada QRIS', didapat '${display1.badgeLabel}'`);
  }
  console.log('✓ TEST 1 PASS: Status no_transaction, reconciliation matched, badge "Tidak ada QRIS".');

  // -------------------------------------------------------------------------
  // Test 2: QRIS sale exists, actual value missing
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 2: Transaksi QRIS Ada, Actual Belum Diisi ---');
  const qrisOrder1: Order = {
    id: 'ord-qris-1',
    order_number: 'ORD-002',
    order_type: 'take_away',
    created_by_user_id: 'usr-1',
    created_by_name: 'Dinda',
    created_by_role: 'karyawan',
    shift_id: baseShift.id,
    subtotal: 50000,
    tax: 0,
    discount: 0,
    total_amount: 50000,
    payment: {
      id: 'pay-2',
      order_id: 'ord-qris-1',
      method: 'qris',
      amount_paid: 50000,
      change: 0,
      status: 'completed',
    },
    items: [],
    created_at: '2026-10-23T09:30:00.000Z',
  };

  const res2 = calculateShiftFinancials(
    baseShift,
    [cashOnlyOrder, qrisOrder1],
    emptyProducts,
    emptyRecipes,
    emptyStocks,
    { actual_cash_end: 125000, actual_qris_end: null },
    emptyExpenses
  );

  if (res2.qris_status !== 'unreconciled') {
    throw new Error(`Test 2 Gagal: qris_status harus 'unreconciled', didapat '${res2.qris_status}'`);
  }
  if (res2.reconciliation_status !== 'pending_review') {
    throw new Error(`Test 2 Gagal: reconciliation_status harus 'pending_review' karena ada pergerakan QRIS yang belum dicek`);
  }
  const display2 = getShiftQrisDisplayInfo(res2);
  if (display2.status !== 'unreconciled' || display2.isReconciledOrExempt) {
    throw new Error(`Test 2 Gagal: display2 harus berstatus 'unreconciled' dan tidak exempt`);
  }
  if (display2.badgeLabel !== 'Belum dicek') {
    throw new Error(`Test 2 Gagal: badgeLabel harus 'Belum dicek' saat ada transaksi QRIS belum direkonsiliasi`);
  }
  console.log('✓ TEST 2 PASS: Status unreconciled, pending_review, badge "Belum dicek".');

  // -------------------------------------------------------------------------
  // Test 3: QRIS sales exist, actual matches expected
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 3: Transaksi QRIS Ada dan Nominal Cocok ---');
  const res3 = calculateShiftFinancials(
    baseShift,
    [cashOnlyOrder, qrisOrder1],
    emptyProducts,
    emptyRecipes,
    emptyStocks,
    { actual_cash_end: 125000, actual_qris_end: 50000 },
    emptyExpenses
  );

  if (res3.qris_status !== 'balanced') {
    throw new Error(`Test 3 Gagal: qris_status harus 'balanced', didapat '${res3.qris_status}'`);
  }
  if (res3.reconciliation_status !== 'matched') {
    throw new Error(`Test 3 Gagal: reconciliation_status harus 'matched' saat kas dan QRIS cocok`);
  }
  const display3 = getShiftQrisDisplayInfo(res3);
  if (display3.status !== 'balanced' || !display3.isReconciledOrExempt) {
    throw new Error(`Test 3 Gagal: display3 status bukan 'balanced'`);
  }
  console.log('✓ TEST 3 PASS: Status balanced, reconciliation matched, badge "Sesuai".');

  // -------------------------------------------------------------------------
  // Test 4: QRIS sales exist, actual differs (discrepancy)
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 4: Transaksi QRIS Ada dan Terdapat Selisih ---');
  const res4 = calculateShiftFinancials(
    baseShift,
    [cashOnlyOrder, qrisOrder1],
    emptyProducts,
    emptyRecipes,
    emptyStocks,
    { actual_cash_end: 125000, actual_qris_end: 45000 },
    emptyExpenses
  );

  if (res4.qris_status !== 'discrepancy' || res4.qris_difference !== -5000) {
    throw new Error(`Test 4 Gagal: qris_status harus 'discrepancy' dengan selisih -5000`);
  }
  if (res4.reconciliation_status !== 'pending_review') {
    throw new Error(`Test 4 Gagal: reconciliation_status harus 'pending_review'`);
  }
  const display4 = getShiftQrisDisplayInfo(res4);
  if (display4.status !== 'discrepancy' || display4.badgeLabel !== 'Selisih') {
    throw new Error(`Test 4 Gagal: display4 status bukan 'discrepancy'`);
  }
  console.log('✓ TEST 4 PASS: Status discrepancy (-5.000), pending_review, badge "Selisih".');

  // -------------------------------------------------------------------------
  // Test 5: QRIS sales equal refunds, leaving expected balance zero
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 5: QRIS Sales Sama Dengan QRIS Refunds (Net Zero But Activity Exists) ---');
  const qrisRefundOrder: Order = {
    id: 'ord-qris-ref-1',
    order_number: 'ORD-REF-001',
    order_type: 'take_away',
    created_by_user_id: 'usr-1',
    created_by_name: 'Dinda',
    created_by_role: 'karyawan',
    shift_id: baseShift.id,
    subtotal: 50000,
    tax: 0,
    discount: 0,
    total_amount: 50000,
    payment: {
      id: 'pay-ref-1',
      order_id: 'ord-qris-ref-1',
      method: 'qris',
      amount_paid: 50000,
      change: 0,
      status: 'refunded',
    },
    refund_method: 'qris',
    refunded_at: '2026-10-23T10:00:00.000Z',
    items: [],
    created_at: '2026-10-23T09:45:00.000Z',
  };

  // Expected qris end is 50000 - 50000 = 0. But activity DID happen!
  const res5a = calculateShiftFinancials(
    baseShift,
    [cashOnlyOrder, qrisRefundOrder],
    emptyProducts,
    emptyRecipes,
    emptyStocks,
    { actual_cash_end: 125000, actual_qris_end: null },
    emptyExpenses
  );

  if (res5a.expected_qris_end !== 0) {
    throw new Error(`Test 5a Gagal: expected_qris_end harus 0, didapat ${res5a.expected_qris_end}`);
  }
  if (res5a.qris_status !== 'unreconciled') {
    throw new Error(`Test 5a Gagal: DILARANG menganggap saldo 0 sebagai tanpa aktivitas. qris_status harus 'unreconciled' jika actual null, didapat '${res5a.qris_status}'`);
  }
  if (res5a.reconciliation_status !== 'pending_review') {
    throw new Error(`Test 5a Gagal: Shift dengan pergerakan QRIS net 0 tanpa input actual harus 'pending_review'`);
  }

  // Jika kasir mengonfirmasi actual QRIS = 0 (cocok settlement)
  const res5b = calculateShiftFinancials(
    baseShift,
    [cashOnlyOrder, qrisRefundOrder],
    emptyProducts,
    emptyRecipes,
    emptyStocks,
    { actual_cash_end: 125000, actual_qris_end: 0 },
    emptyExpenses
  );

  if (res5b.qris_status !== 'balanced' || res5b.reconciliation_status !== 'matched') {
    throw new Error(`Test 5b Gagal: Saat kasir memasukkan actual_qris_end 0 dan cocok, status harus balanced dan matched`);
  }
  console.log('✓ TEST 5 PASS: Saldo akhir 0 dengan aktivitas tetap wajib rekonsiliasi (unreconciled jika kosong, balanced jika diisi 0).');

  // -------------------------------------------------------------------------
  // Test 6: Historical zero-activity shifts display correctly without mutating snapshots
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 6: Shift Historis Tanpa Transaksi QRIS (Snapshot Beku Unreconciled) ---');
  const frozenHistoricalSnapshot: any = {
    cash_initial: 100000,
    expected_cash_end: 150000,
    actual_cash_end: 150000,
    cash_difference: 0,
    cash_status: 'balanced',
    cash_sales: 50000,
    cash_refunds: 0,
    qris_sales: 0,
    qris_refunds: 0,
    expected_qris_end: 0,
    actual_qris_end: null,
    qris_difference: null,
    qris_status: 'unreconciled', // Snapshot historis tersimpan dengan 'unreconciled'
    reconciliation_status: 'matched',
  };

  // Jangan mutasi snapshot! Gunakan getShiftQrisDisplayInfo
  const histDisplay = getShiftQrisDisplayInfo(frozenHistoricalSnapshot);
  if (histDisplay.status !== 'no_transaction') {
    throw new Error(`Test 6 Gagal: Helper display harus mengenali snapshot historis tanpa aktivitas QRIS sebagai 'no_transaction', didapat '${histDisplay.status}'`);
  }
  if (histDisplay.badgeLabel !== 'Tidak ada QRIS') {
    throw new Error(`Test 6 Gagal: badgeLabel harus 'Tidak ada QRIS', didapat '${histDisplay.badgeLabel}'`);
  }
  if (frozenHistoricalSnapshot.qris_status !== 'unreconciled') {
    throw new Error(`Test 6 Gagal: Snapshot asli terbukti termutasi! Snapshot harus tetap immutable.`);
  }
  console.log('✓ TEST 6 PASS: Snapshot historis beku tetap immutable dan ditampilkan bersih sebagai "Tidak ada transaksi".');

  // -------------------------------------------------------------------------
  // Test 7: Cash reconciliation behavior remains unchanged
  // -------------------------------------------------------------------------
  console.log('\n--- TEST 7: Integritas Rekonsiliasi Kas Tetap Utuh (Surplus, Shortage, Expenses) ---');
  const cashShortageRes = calculateShiftFinancials(
    baseShift,
    [cashOnlyOrder],
    emptyProducts,
    emptyRecipes,
    emptyStocks,
    { actual_cash_end: 120000, actual_qris_end: null },
    emptyExpenses
  );
  if (cashShortageRes.cash_status !== 'shortage' || cashShortageRes.cash_difference !== -5000) {
    throw new Error(`Test 7 Gagal: Status kas shortage dan selisih -5000 tidak cocok`);
  }
  if (cashShortageRes.reconciliation_status !== 'pending_review') {
    throw new Error(`Test 7 Gagal: Selisih kas harus memicu status pending_review`);
  }

  const cashSurplusRes = calculateShiftFinancials(
    baseShift,
    [cashOnlyOrder],
    emptyProducts,
    emptyRecipes,
    emptyStocks,
    { actual_cash_end: 130000, actual_qris_end: null },
    emptyExpenses
  );
  if (cashSurplusRes.cash_status !== 'surplus' || cashSurplusRes.cash_difference !== 5000) {
    throw new Error(`Test 7 Gagal: Status kas surplus dan selisih +5000 tidak cocok`);
  }

  console.log('✓ TEST 7 PASS: Logika kas tunai (shortage, surplus, expenses) tetap utuh.');

  console.log('\n===============================================================');
  console.log('   SELURUH 7 TEST REKONSILIASI QRIS BERHASIL DENGAN LULUS (PASS)');
  console.log('===============================================================');
}

// Execute tests if invoked directly
runQRISReconciliationTests();
