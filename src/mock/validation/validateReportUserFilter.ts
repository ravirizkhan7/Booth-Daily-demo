import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { computeReportData, getOrderOperationalDate, getPeriodRange } from '../../utils/reportUtils';
import { getOperationalDate } from '../../utils/shiftCalculation';
import { Order, Product, Recipe, Stock, Purchase, User, Shift } from '../../types';
import { exportReportToExcel } from '../../services/excelExport';

// In Node environment, configure XLSX fs support
if (typeof XLSX.set_fs === 'function') {
  XLSX.set_fs(fs);
}

export function runReportUserFilterTests() {
  console.log('===============================================================');
  console.log('   BOOTH DAILY — USER FILTER IN REPORTS VALIDATION SUITE');
  console.log('===============================================================');

  // Setup mock products, recipes, stocks
  const products: Product[] = [
    {
      id: 'prod-coffee',
      name: 'Kopi Susu Gula Aren',
      price: 18000,
      cost_price: 8000,
      category_id: 'cat-1',
      image_url: '',
      description: '',
      is_active: true,
      is_favorite: false,
    },
    {
      id: 'prod-croissant',
      name: 'Butter Croissant',
      price: 25000,
      cost_price: 12000,
      category_id: 'cat-2',
      image_url: '',
      description: '',
      is_active: true,
      is_favorite: false,
    }
  ];

  const stocks: Stock[] = [];
  const recipes: Recipe[] = [];
  const purchases: Purchase[] = [];

  const userA: User = {
    id: 'usr-budi',
    name: 'Budi Santoso',
    email: 'budi@boothdaily.com',
    role: 'karyawan',
    pin: '1234',
    is_active: true,
  };

  const userB: User = {
    id: 'usr-ravi',
    name: 'Ravi',
    email: 'ravi@boothdaily.com',
    role: 'owner',
    pin: '9999',
    is_active: true,
  };

  // Tanggal pengujian deterministik independen dari jam sistem komputer
  const FIXED_TEST_DATE_STR = '2026-10-23';
  const FIXED_REFERENCE_DATE = new Date(2026, 9, 23, 12, 0, 0); // 23 Oct 2026, 12:00 local time

  // Helper untuk membuat timestamp ISO deterministik pada jam lokal pengujian
  const makeFixedIso = (hours: number, minutes: number): string => {
    const d = new Date(2026, 9, 23, hours, minutes, 0, 0);
    return d.toISOString();
  };

  // 1. Order attributed to User A (Budi, Karyawan) - with snapshot HPP
  const orderA1: Order = {
    id: 'ord-a1',
    order_number: 'ORD-A1',
    order_type: 'take_away',
    created_by_user_id: userA.id,
    created_by_name: userA.name,
    created_by_role: userA.role,
    subtotal: 18000,
    tax: 0,
    discount: 0,
    total_amount: 18000,
    total_hpp: 8000,
    hpp_source: 'transaction_snapshot',
    items: [
      {
        id: 'it-1',
        product_id: 'prod-coffee',
        product_name: 'Kopi Susu Gula Aren',
        price: 18000,
        qty: 1,
        subtotal: 18000,
        unit_cost_price: 8000,
        subtotal_cost: 8000,
      }
    ],
    payment: {
      id: 'pay-a1',
      order_id: 'ord-a1',
      method: 'cash',
      amount_paid: 20000,
      change: 2000,
      status: 'completed',
    },
    created_at: makeFixedIso(8, 30),
    operational_date: FIXED_TEST_DATE_STR,
  };

  const orderA2: Order = {
    id: 'ord-a2',
    order_number: 'ORD-A2',
    order_type: 'dine_in',
    created_by_user_id: userA.id,
    created_by_name: userA.name,
    created_by_role: userA.role,
    subtotal: 36000,
    tax: 0,
    discount: 0,
    total_amount: 36000,
    total_hpp: 16000,
    hpp_source: 'transaction_snapshot',
    items: [
      {
        id: 'it-2',
        product_id: 'prod-coffee',
        product_name: 'Kopi Susu Gula Aren',
        price: 18000,
        qty: 2,
        subtotal: 36000,
        unit_cost_price: 8000,
        subtotal_cost: 16000,
      }
    ],
    payment: {
      id: 'pay-a2',
      order_id: 'ord-a2',
      method: 'qris',
      amount_paid: 36000,
      change: 0,
      status: 'completed',
    },
    created_at: makeFixedIso(9, 15),
    operational_date: FIXED_TEST_DATE_STR,
  };

  // 2. Order attributed to User B (Ravi, Owner) - with partial snapshot
  const orderB1: Order = {
    id: 'ord-b1',
    order_number: 'ORD-B1',
    order_type: 'take_away',
    created_by_user_id: userB.id,
    created_by_name: userB.name,
    created_by_role: userB.role,
    subtotal: 25000,
    tax: 0,
    discount: 0,
    total_amount: 25000,
    total_hpp: 12000,
    hpp_source: 'partial_snapshot',
    items: [
      {
        id: 'it-3',
        product_id: 'prod-croissant',
        product_name: 'Butter Croissant',
        price: 25000,
        qty: 1,
        subtotal: 25000,
      }
    ],
    payment: {
      id: 'pay-b1',
      order_id: 'ord-b1',
      method: 'cash',
      amount_paid: 50000,
      change: 25000,
      status: 'completed',
    },
    created_at: makeFixedIso(10, 0),
    operational_date: FIXED_TEST_DATE_STR,
  };

  // 3. Legacy Unassigned Order - missing created_by_user_id (legacy estimate HPP)
  const legacyOrder: Order = {
    id: 'ord-legacy-1',
    order_number: 'ORD-LEGACY-1',
    order_type: 'take_away',
    // No created_by_user_id!
    created_by_user_id: undefined,
    created_by_name: undefined,
    created_by_role: undefined,
    subtotal: 18000,
    tax: 0,
    discount: 0,
    total_amount: 18000,
    // total_hpp computed via fallback (cost_price 8000)
    items: [
      {
        id: 'it-4',
        product_id: 'prod-coffee',
        product_name: 'Kopi Susu Gula Aren',
        price: 18000,
        qty: 1,
        subtotal: 18000,
      }
    ],
    payment: {
      id: 'pay-leg-1',
      order_id: 'ord-legacy-1',
      method: 'cash',
      amount_paid: 20000,
      change: 2000,
      status: 'completed',
    },
    created_at: makeFixedIso(7, 45),
    operational_date: FIXED_TEST_DATE_STR,
  };

  // 4. Refunded Order belonging to User A
  const refundedOrderA: Order = {
    id: 'ord-ref-a',
    order_number: 'ORD-REF-A',
    order_type: 'take_away',
    created_by_user_id: userA.id,
    created_by_name: userA.name,
    created_by_role: userA.role,
    subtotal: 18000,
    tax: 0,
    discount: 0,
    total_amount: 18000,
    total_hpp: 8000,
    items: [
      {
        id: 'it-5',
        product_id: 'prod-coffee',
        product_name: 'Kopi Susu Gula Aren',
        price: 18000,
        qty: 1,
        subtotal: 18000,
      }
    ],
    payment: {
      id: 'pay-ref-a',
      order_id: 'ord-ref-a',
      method: 'cash',
      amount_paid: 18000,
      change: 0,
      status: 'refunded',
    },
    refund_reason: 'Salah pesan',
    refunded_at: makeFixedIso(9, 0),
    created_at: makeFixedIso(8, 50),
    operational_date: FIXED_TEST_DATE_STR,
  };

  const allOrders = [orderA1, orderA2, orderB1, legacyOrder, refundedOrderA];

  const baseParams = {
    orders: allOrders,
    purchases,
    products,
    recipes,
    stocks,
    dateFilter: 'today' as const,
    startDate: FIXED_TEST_DATE_STR,
    endDate: FIXED_TEST_DATE_STR,
    cutoffTime: '04:00',
    referenceDate: FIXED_REFERENCE_DATE,
  };

  // -------------------------------------------------------------------------
  // Scenario 1: Default 'Semua pengguna' preserves existing report totals
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 1: Default Semua pengguna ---');
  const repAll = computeReportData({ ...baseParams, userId: 'all' });
  // Successful orders: orderA1 (18000), orderA2 (36000), orderB1 (25000), legacyOrder (18000) = 97000
  // Total HPP includes consumed materials from refunded order (8000 + 16000 + 12000 + 8000 + 8000) = 52000
  console.log(`Total Sales: ${repAll.totalSales} (Expected: 97000)`);
  console.log(`Total Orders: ${repAll.totalOrdersCount} (Expected: 4)`);
  console.log(`Refund Count: ${repAll.refundCount} (Expected: 1)`);
  console.log(`Total HPP: ${repAll.totalEstimatedHPP} (Expected: 52000)`);
  console.log(`Gross Profit: ${repAll.estimatedGrossProfit} (Expected: 97000 - 52000 = 45000)`);
  if (repAll.totalSales !== 97000 || repAll.totalOrdersCount !== 4 || repAll.totalEstimatedHPP !== 52000 || repAll.estimatedGrossProfit !== 45000) {
    throw new Error('Scenario 1 Failed: Semua pengguna total mismatch');
  }
  console.log('✔ Scenario 1 Passed');

  // -------------------------------------------------------------------------
  // Scenario 2: Selecting User A includes only reliably attributed transactions for User A
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 2: Filter User A (Budi Santoso, Karyawan) ---');
  const repUserA = computeReportData({
    ...baseParams,
    userId: userA.id,
    userName: userA.name,
    userRole: 'Karyawan',
  });
  // Successful orders for User A: orderA1 (18000), orderA2 (36000) = 54000
  // HPP includes A1 (8000) + A2 (16000) + Refunded A (8000) = 32000
  console.log(`User A Sales: ${repUserA.totalSales} (Expected: 54000)`);
  console.log(`User A Orders: ${repUserA.totalOrdersCount} (Expected: 2)`);
  console.log(`User A Refund Count: ${repUserA.refundCount} (Expected: 1)`);
  console.log(`User A HPP: ${repUserA.totalEstimatedHPP} (Expected: 32000)`);
  console.log(`User A Gross Profit: ${repUserA.estimatedGrossProfit} (Expected: 22000)`);
  console.log(`User A Filter Metadata: ${repUserA.filterUserName} (${repUserA.filterUserRole})`);
  if (repUserA.totalSales !== 54000 || repUserA.totalOrdersCount !== 2 || repUserA.totalEstimatedHPP !== 32000 || repUserA.estimatedGrossProfit !== 22000) {
    throw new Error('Scenario 2 Failed: User A totals mismatch');
  }
  if (repUserA.filterUserId !== userA.id || repUserA.filterUserName !== userA.name || repUserA.filterUserRole !== 'Karyawan') {
    throw new Error('Scenario 2 Failed: User A filter metadata missing');
  }
  console.log('✔ Scenario 2 Passed');

  // -------------------------------------------------------------------------
  // Scenario 3: Selecting User B produces separate correct subset
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 3: Filter User B (Ravi, Owner) ---');
  const repUserB = computeReportData({
    ...baseParams,
    userId: userB.id,
    userName: userB.name,
    userRole: 'Owner',
  });
  // Successful orders for User B: orderB1 (25000)
  console.log(`User B Sales: ${repUserB.totalSales} (Expected: 25000)`);
  console.log(`User B Orders: ${repUserB.totalOrdersCount} (Expected: 1)`);
  console.log(`User B Refund Count: ${repUserB.refundCount} (Expected: 0)`);
  console.log(`User B HPP: ${repUserB.totalEstimatedHPP} (Expected: 12000)`);
  console.log(`User B Gross Profit: ${repUserB.estimatedGrossProfit} (Expected: 13000)`);
  if (repUserB.totalSales !== 25000 || repUserB.totalOrdersCount !== 1 || repUserB.totalEstimatedHPP !== 12000) {
    throw new Error('Scenario 3 Failed: User B totals mismatch');
  }
  console.log('✔ Scenario 3 Passed');

  // -------------------------------------------------------------------------
  // Scenario 4: Role labels (Owner vs Karyawan)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 4: Role Labels in Filter Metadata ---');
  if (repUserA.filterUserRole !== 'Karyawan' || repUserB.filterUserRole !== 'Owner') {
    throw new Error('Scenario 4 Failed: Role labels mismatch');
  }
  console.log('✔ Scenario 4 Passed: Karyawan and Owner role labels formatted correctly');

  // -------------------------------------------------------------------------
  // Scenario 5: Unassigned legacy transactions appear under dedicated option and do not leak
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 5: Dedicated Unassigned Legacy Filter ---');
  const repUnassigned = computeReportData({
    ...baseParams,
    userId: 'unassigned',
    userName: 'Tidak Diketahui / Sistem',
    userRole: 'Sistem / Legacy',
  });
  // Successful orders for unassigned: legacyOrder (18000)
  console.log(`Unassigned Sales: ${repUnassigned.totalSales} (Expected: 18000)`);
  console.log(`Unassigned Orders: ${repUnassigned.totalOrdersCount} (Expected: 1)`);
  console.log(`Unassigned HPP: ${repUnassigned.totalEstimatedHPP} (Expected: 8000)`);
  if (repUnassigned.totalSales !== 18000 || repUnassigned.totalOrdersCount !== 1) {
    throw new Error('Scenario 5 Failed: Unassigned totals mismatch');
  }

  // Verify non-leakage: sum of User A + User B + Unassigned equals All
  const sumSales = repUserA.totalSales + repUserB.totalSales + repUnassigned.totalSales;
  const sumOrders = repUserA.totalOrdersCount + repUserB.totalOrdersCount + repUnassigned.totalOrdersCount;
  const sumHPP = repUserA.totalEstimatedHPP + repUserB.totalEstimatedHPP + repUnassigned.totalEstimatedHPP;
  console.log(`Sum of buckets: Sales ${sumSales}, Orders ${sumOrders}, HPP ${sumHPP}`);
  if (sumSales !== repAll.totalSales || sumOrders !== repAll.totalOrdersCount || sumHPP !== repAll.totalEstimatedHPP) {
    throw new Error('Scenario 5 Failed: User attribution buckets do not partition total sales cleanly without leakage or duplication');
  }
  console.log('✔ Scenario 5 Passed: No leakage between named users and unassigned transactions');

  // -------------------------------------------------------------------------
  // Scenario 6: Date, status, and user filters compose correctly
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 6: Date, Status, and User Filter Composition ---');
  // If date range is outside, user filter yields 0
  const repOutside = computeReportData({
    ...baseParams,
    dateFilter: 'custom',
    startDate: '2026-10-01',
    endDate: '2026-10-02',
    userId: userA.id,
  });
  console.log(`Outside Date Range Orders: ${repOutside.totalOrdersCount} (Expected: 0)`);
  if (repOutside.totalOrdersCount !== 0 || repOutside.totalSales !== 0) {
    throw new Error('Scenario 6 Failed: Date filter did not compose with user filter');
  }
  console.log('✔ Scenario 6 Passed: Filter composition works accurately');

  // -------------------------------------------------------------------------
  // Scenario 7: KPI totals match transaction-detail totals
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 7: KPI Totals Match Transaction Details ---');
  [repAll, repUserA, repUserB, repUnassigned].forEach((rd, idx) => {
    let detailSales = 0;
    let detailHPP = 0;
    let detailGP = 0;
    let completedCount = 0;

    rd.transactionDetails.forEach(d => {
      if (d.order.payment?.status !== 'refunded') {
        detailSales += d.omzet;
        completedCount++;
      }
      detailHPP += d.hpp;
      detailGP += d.grossProfit;
    });

    if (detailSales !== rd.totalSales || completedCount !== rd.totalOrdersCount || detailHPP !== rd.totalEstimatedHPP) {
      throw new Error(`Scenario 7 Failed: Dataset ${idx} detail totals do not match KPI cards!`);
    }
  });
  console.log('✔ Scenario 7 Passed: KPI cards and transaction detail tables match 100%');

  // -------------------------------------------------------------------------
  // Scenario 8: HPP and gross profit consistency
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 8: Gross Profit and Margin Formula Consistency ---');
  [repAll, repUserA, repUserB, repUnassigned].forEach(rd => {
    const expectedGP = rd.totalSales - rd.totalEstimatedHPP;
    if (rd.estimatedGrossProfit !== expectedGP) {
      throw new Error('Scenario 8 Failed: Gross profit is not totalSales - totalHPP');
    }
  });
  console.log('✔ Scenario 8 Passed: HPP and Gross profit formulas strictly preserved');

  // -------------------------------------------------------------------------
  // Scenario 9: Excel export contains filter metadata and matching data
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 9: Excel Export Generation with User Filter ---');
  const excelFileName = `Laporan_Keuangan_Booth_Daily_Test_${new Date().toISOString().slice(0, 10)}.xlsx`;
  try {
    exportReportToExcel({
      reportData: repUserA,
      storeName: 'Booth Daily Test',
    });
    if (!fs.existsSync(excelFileName)) {
      throw new Error(`File ${excelFileName} was not created`);
    }
    // Read back workbook and inspect cells
    const wb = XLSX.readFile(excelFileName);
    const summarySheet = wb.Sheets['Ringkasan Laporan'];
    if (!summarySheet) {
      throw new Error('Ringkasan Laporan sheet missing in Excel');
    }
    // Check whether Filter Kasir / User is present in the sheet
    const sheetCsv = XLSX.utils.sheet_to_csv(summarySheet);
    if (!sheetCsv.includes('Filter Kasir / User') || !sheetCsv.includes('Budi Santoso (Karyawan)')) {
      throw new Error('Filter Kasir / User metadata not found in Excel summary sheet');
    }
    console.log('✔ Scenario 9 Passed: Excel workbook contains verified "Filter Kasir / User: Budi Santoso (Karyawan)"');
  } catch (err) {
    throw new Error(`Scenario 9 Failed: Excel export error: ${err}`);
  } finally {
    if (fs.existsSync(excelFileName)) {
      try { fs.unlinkSync(excelFileName); } catch (_) {}
    }
  }

  // -------------------------------------------------------------------------
  // Scenario 10: Switching back to All restores full report scope
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 10: Reset back to Semua Pengguna ---');
  const repRestored = computeReportData({ ...baseParams, userId: 'all' });
  if (repRestored.totalSales !== repAll.totalSales || repRestored.totalOrdersCount !== repAll.totalOrdersCount) {
    throw new Error('Scenario 10 Failed: Restoring All users did not recover full original dataset');
  }
  console.log('✔ Scenario 10 Passed: Full prior report scope successfully restored');

  // -------------------------------------------------------------------------
  // Scenario 11: Existing HPP provenance categories preserved
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 11: HPP Provenance Categories Intact ---');
  console.log(`User A Snapshot Orders: ${repUserA.hppSnapshotOrdersCount} (Expected: 2)`);
  console.log(`User B Partial Snapshot Orders: ${repUserB.hppPartialSnapshotOrdersCount} (Expected: 1)`);
  console.log(`Unassigned Legacy Estimate Orders: ${repUnassigned.hppLegacyEstimateOrdersCount} (Expected: 1)`);
  if (repUserA.hppSnapshotOrdersCount !== 2 || repUserB.hppPartialSnapshotOrdersCount !== 1 || repUnassigned.hppLegacyEstimateOrdersCount !== 1) {
    throw new Error('Scenario 11 Failed: HPP provenance breakdown corrupted');
  }
  console.log('✔ Scenario 11 Passed: HPP provenance categories completely intact');

  // =========================================================================
  // F. SKENARIO PENGUJIAN HARMONISASI CUTOFF OPERASIONAL TOKO (12 ITEM WAJIB)
  // =========================================================================

  // -------------------------------------------------------------------------
  // Scenario 12: Transaksi Sebelum Cutoff (01:30 dengan Cutoff 04:00 -> Hari Kemarin)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 12: Transaksi Sebelum Cutoff (Pukul 01:30, Cutoff 04:00) ---');
  // Transaksi dibuat tanggal 5 Nov 2026 pukul 01:30 dini hari tanpa field operational_date manual
  const dBeforeCutoff = new Date(2026, 10, 5, 1, 30, 0, 0);
  const ordBeforeCutoff: Order = {
    ...orderA1,
    id: 'ord-cutoff-before',
    order_number: 'ORD-CUTOFF-1',
    created_at: dBeforeCutoff.toISOString(),
    operational_date: undefined,
  };
  const opDateBefore = getOrderOperationalDate(ordBeforeCutoff, '04:00');
  if (opDateBefore !== '2026-11-04') {
    throw new Error(`Scenario 12 Failed: Expected operational date '2026-11-04', got '${opDateBefore}'`);
  }
  // Masuk laporan hari operasional kemarin (2026-11-04)
  const repIncludedBefore = computeReportData({
    ...baseParams,
    orders: [ordBeforeCutoff],
    dateFilter: 'custom',
    startDate: '2026-11-04',
    endDate: '2026-11-04',
    cutoffTime: '04:00',
    userId: 'all',
  });
  if (repIncludedBefore.totalOrdersCount !== 1 || repIncludedBefore.totalSales !== 18000) {
    throw new Error('Scenario 12 Failed: Order sebelum cutoff tidak masuk ke laporan hari operasional kemarin');
  }
  // Tidak masuk ke laporan hari kalender baru (2026-11-05)
  const repExcludedBefore = computeReportData({
    ...baseParams,
    orders: [ordBeforeCutoff],
    dateFilter: 'custom',
    startDate: '2026-11-05',
    endDate: '2026-11-05',
    cutoffTime: '04:00',
    userId: 'all',
  });
  if (repExcludedBefore.totalOrdersCount !== 0) {
    throw new Error('Scenario 12 Failed: Order sebelum cutoff bocor ke hari operasional berikutnya');
  }
  console.log('✔ Scenario 12 Passed: Transaksi pukul 01:30 masuk ke hari operasional sebelumnya (2026-11-04)');

  // -------------------------------------------------------------------------
  // Scenario 13: Transaksi Tepat pada Cutoff (04:00 dengan Cutoff 04:00 -> Hari Baru)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 13: Transaksi Tepat pada Cutoff (Pukul 04:00, Cutoff 04:00) ---');
  const dExactCutoff = new Date(2026, 10, 5, 4, 0, 0, 0);
  const ordExactCutoff: Order = {
    ...orderA1,
    id: 'ord-cutoff-exact',
    order_number: 'ORD-CUTOFF-EXACT',
    created_at: dExactCutoff.toISOString(),
    operational_date: undefined,
  };
  const opDateExact = getOrderOperationalDate(ordExactCutoff, '04:00');
  if (opDateExact !== '2026-11-05') {
    throw new Error(`Scenario 13 Failed: Expected operational date '2026-11-05', got '${opDateExact}'`);
  }
  const repExact = computeReportData({
    ...baseParams,
    orders: [ordExactCutoff],
    dateFilter: 'custom',
    startDate: '2026-11-05',
    endDate: '2026-11-05',
    cutoffTime: '04:00',
    userId: 'all',
  });
  if (repExact.totalOrdersCount !== 1) {
    throw new Error('Scenario 13 Failed: Transaksi tepat jam cutoff tidak masuk ke hari operasional baru');
  }
  console.log('✔ Scenario 13 Passed: Transaksi tepat pukul 04:00 masuk ke hari operasional baru (2026-11-05)');

  // -------------------------------------------------------------------------
  // Scenario 14: Transaksi Setelah Cutoff (04:01 dengan Cutoff 04:00 -> Hari Baru)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 14: Transaksi Setelah Cutoff (Pukul 04:01, Cutoff 04:00) ---');
  const dAfterCutoff = new Date(2026, 10, 5, 4, 1, 0, 0);
  const ordAfterCutoff: Order = {
    ...orderA1,
    id: 'ord-cutoff-after',
    order_number: 'ORD-CUTOFF-AFTER',
    created_at: dAfterCutoff.toISOString(),
    operational_date: undefined,
  };
  const opDateAfter = getOrderOperationalDate(ordAfterCutoff, '04:00');
  if (opDateAfter !== '2026-11-05') {
    throw new Error(`Scenario 14 Failed: Expected operational date '2026-11-05', got '${opDateAfter}'`);
  }
  console.log('✔ Scenario 14 Passed: Transaksi pukul 04:01 masuk ke hari operasional baru (2026-11-05)');

  // -------------------------------------------------------------------------
  // Scenario 15: Pergantian Tanggal Kalender Setelah Tengah Malam (00:30)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 15: Pergantian Tanggal Kalender Setelah Tengah Malam ---');
  const dMidnight = new Date(2026, 10, 5, 0, 30, 0, 0);
  const ordMidnight: Order = {
    ...orderB1,
    id: 'ord-midnight-1',
    order_number: 'ORD-MIDNIGHT-1',
    created_at: dMidnight.toISOString(),
    operational_date: undefined,
  };
  const opDateMidnight = getOrderOperationalDate(ordMidnight, '04:00');
  if (opDateMidnight !== '2026-11-04') {
    throw new Error(`Scenario 15 Failed: Order 00:30 harus tetap di hari operasional 2026-11-04, got '${opDateMidnight}'`);
  }
  console.log('✔ Scenario 15 Passed: Transaksi pukul 00:30 tetap dalam hari operasional kemarin (tidak dipecah tengah malam)');

  // -------------------------------------------------------------------------
  // Scenario 16: Jendela 24 Jam Operasional Penuh Cutoff 04:00
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 16: Jendela Siklus 24 Jam Cutoff 04:00 ---');
  const sampleTimes = [
    new Date(2026, 10, 4, 4, 0, 0, 0),    // 4 Nov 04:00
    new Date(2026, 10, 4, 12, 30, 0, 0),  // 4 Nov 12:30
    new Date(2026, 10, 4, 23, 59, 0, 0),  // 4 Nov 23:59
    new Date(2026, 10, 5, 0, 15, 0, 0),   // 5 Nov 00:15
    new Date(2026, 10, 5, 3, 59, 59, 0),  // 5 Nov 03:59:59
  ];
  const cycleOrders: Order[] = sampleTimes.map((t, idx) => ({
    ...orderA1,
    id: `ord-cycle-${idx}`,
    order_number: `ORD-CYC-${idx}`,
    created_at: t.toISOString(),
    operational_date: undefined,
  }));
  cycleOrders.forEach((o, idx) => {
    const op = getOrderOperationalDate(o, '04:00');
    if (op !== '2026-11-04') {
      throw new Error(`Scenario 16 Failed: Item ${idx} in 24h cycle has operational date ${op}`);
    }
  });
  const repCycle = computeReportData({
    ...baseParams,
    orders: cycleOrders,
    dateFilter: 'custom',
    startDate: '2026-11-04',
    endDate: '2026-11-04',
    cutoffTime: '04:00',
    userId: 'all',
  });
  if (repCycle.totalOrdersCount !== 5) {
    throw new Error(`Scenario 16 Failed: Expected 5 orders in 24h cycle, got ${repCycle.totalOrdersCount}`);
  }
  console.log('✔ Scenario 16 Passed: Seluruh 5 transaksi dari jam 04:00 s/d 03:59:59 terhitung utuh dalam 1 siklus operasional');

  // -------------------------------------------------------------------------
  // Scenario 17: Cutoff Pukul 00:00 (Perilaku Kalender Murni)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 17: Cutoff Pukul 00:00 (Batas Kalender Murni) ---');
  const dMidnightCutoff = new Date(2026, 10, 5, 0, 30, 0, 0);
  const ordZeroCutoff: Order = {
    ...orderA1,
    id: 'ord-zero-cutoff',
    order_number: 'ORD-ZERO',
    created_at: dMidnightCutoff.toISOString(),
    operational_date: undefined,
  };
  const opDateZero = getOrderOperationalDate(ordZeroCutoff, '00:00');
  if (opDateZero !== '2026-11-05') {
    throw new Error(`Scenario 17 Failed: Cutoff 00:00 harus menghasilkan 2026-11-05, got '${opDateZero}'`);
  }
  const repZero = computeReportData({
    ...baseParams,
    orders: [ordZeroCutoff],
    dateFilter: 'custom',
    startDate: '2026-11-05',
    endDate: '2026-11-05',
    cutoffTime: '00:00',
    userId: 'all',
  });
  if (repZero.totalOrdersCount !== 1) {
    throw new Error('Scenario 17 Failed: Order 00:30 harus masuk ke tanggal 2026-11-05 pada cutoff 00:00');
  }
  console.log('✔ Scenario 17 Passed: Cutoff 00:00 bekerja konsisten dengan pergantian hari kalender');

  // -------------------------------------------------------------------------
  // Scenario 18: Filter Hari Ini dan Kemarin Saat Jam Dini Hari (02:00 Pagi)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 18: Filter Hari Ini & Kemarin Saat Dini Hari (02:00 AM) ---');
  // Jam saat kasir membuka laporan adalah 5 Nov 2026 pukul 02:00 pagi
  const refEarlyMorning = new Date(2026, 10, 5, 2, 0, 0, 0);
  const todayPeriod = getPeriodRange('today', undefined, undefined, '04:00', refEarlyMorning);
  if (todayPeriod.startOperationalDate !== '2026-11-04' || todayPeriod.endOperationalDate !== '2026-11-04') {
    throw new Error(`Scenario 18 Failed: Hari ini pada 02:00 pagi harusnya 2026-11-04, got ${todayPeriod.startOperationalDate}`);
  }
  const repEarlyToday = computeReportData({
    ...baseParams,
    orders: [ordBeforeCutoff], // dibuat 5 Nov 01:30
    dateFilter: 'today',
    referenceDate: refEarlyMorning,
    cutoffTime: '04:00',
    userId: 'all',
  });
  if (repEarlyToday.totalOrdersCount !== 1) {
    throw new Error('Scenario 18 Failed: Transaksi dini hari 01:30 harus terangkum dalam "Hari Ini" saat dicek pukul 02:00');
  }
  console.log('✔ Scenario 18 Passed: "Hari Ini" pada jam 02:00 secara tepat mengacu pada hari operasional 4 Nov');

  // -------------------------------------------------------------------------
  // Scenario 19: Filter Mingguan (7 Hari Operasional Inklusif)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 19: Filter Mingguan (7 Hari Operasional) ---');
  const weekPeriod = getPeriodRange('week', undefined, undefined, '04:00', refEarlyMorning);
  if (weekPeriod.startOperationalDate !== '2026-10-29' || weekPeriod.endOperationalDate !== '2026-11-04') {
    throw new Error(`Scenario 19 Failed: Rentang mingguan salah: ${weekPeriod.startOperationalDate} s/d ${weekPeriod.endOperationalDate}`);
  }
  // Order 29 Okt 04:00 masuk (awal hari ke-7)
  const ordWeekStart: Order = {
    ...orderA1,
    id: 'ord-wk-start',
    created_at: new Date(2026, 9, 29, 4, 0, 0, 0).toISOString(),
    operational_date: undefined,
  };
  // Order 29 Okt 03:30 keluar (hari ke-8, 2026-10-28)
  const ordWeekOld: Order = {
    ...orderA1,
    id: 'ord-wk-old',
    created_at: new Date(2026, 9, 29, 3, 30, 0, 0).toISOString(),
    operational_date: undefined,
  };
  const repWeek = computeReportData({
    ...baseParams,
    orders: [ordWeekStart, ordWeekOld, ordBeforeCutoff],
    dateFilter: 'week',
    referenceDate: refEarlyMorning,
    cutoffTime: '04:00',
    userId: 'all',
  });
  if (repWeek.totalOrdersCount !== 2) {
    throw new Error(`Scenario 19 Failed: Expected 2 orders in weekly filter, got ${repWeek.totalOrdersCount}`);
  }
  console.log('✔ Scenario 19 Passed: Filter mingguan mencakup tepat 7 hari operasional inklusif');

  // -------------------------------------------------------------------------
  // Scenario 20: Filter Bulanan (1 Bulan Operasional Penuh)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 20: Filter Bulanan (1 Bulan Operasional Penuh) ---');
  // Dicek pada 1 Desember 2026 pukul 02:00 pagi (sebelum cutoff)
  const refDecFirstEarly = new Date(2026, 11, 1, 2, 0, 0, 0);
  const monthPeriod = getPeriodRange('month', undefined, undefined, '04:00', refDecFirstEarly);
  if (monthPeriod.startOperationalDate !== '2026-11-01' || monthPeriod.endOperationalDate !== '2026-11-30') {
    throw new Error(`Scenario 20 Failed: Bulan ini pada 1 Des 02:00 pagi harusnya Nov, got ${monthPeriod.startOperationalDate} s/d ${monthPeriod.endOperationalDate}`);
  }
  // Transaksi 1 Des 01:30 masuk ke bulan November
  const ordDecFirstBeforeCutoff: Order = {
    ...orderA1,
    id: 'ord-dec-first-early',
    created_at: new Date(2026, 11, 1, 1, 30, 0, 0).toISOString(),
    operational_date: undefined,
  };
  // Transaksi 1 Des 04:00 masuk ke bulan Desember (keluar dari Nov)
  const ordDecFirstAfterCutoff: Order = {
    ...orderA1,
    id: 'ord-dec-first-late',
    created_at: new Date(2026, 11, 1, 4, 0, 0, 0).toISOString(),
    operational_date: undefined,
  };
  const repMonth = computeReportData({
    ...baseParams,
    orders: [ordDecFirstBeforeCutoff, ordDecFirstAfterCutoff],
    dateFilter: 'month',
    referenceDate: refDecFirstEarly,
    cutoffTime: '04:00',
    userId: 'all',
  });
  if (repMonth.totalOrdersCount !== 1 || repMonth.totalSales !== 18000) {
    throw new Error(`Scenario 20 Failed: Filter bulanan salah menyaring pesanan di batas awal bulan baru`);
  }
  console.log('✔ Scenario 20 Passed: Filter bulanan tetap mempertahankan transaksi akhir bulan sebelum cutoff');

  // -------------------------------------------------------------------------
  // Scenario 21: Rentang Tanggal Manual (Custom Range)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 21: Rentang Tanggal Manual (Custom Range) ---');
  const repCustom = computeReportData({
    ...baseParams,
    orders: [
      { ...orderA1, id: 'ord-c1', created_at: new Date(2026, 10, 4, 2, 0, 0, 0).toISOString(), operational_date: undefined }, // opDate 2026-11-03
      { ...orderA1, id: 'ord-c2', created_at: new Date(2026, 10, 4, 5, 0, 0, 0).toISOString(), operational_date: undefined }, // opDate 2026-11-04
    ],
    dateFilter: 'custom',
    startDate: '2026-11-01',
    endDate: '2026-11-03',
    cutoffTime: '04:00',
    userId: 'all',
  });
  if (repCustom.totalOrdersCount !== 1) {
    throw new Error(`Scenario 21 Failed: Custom range should match 1 order with opDate 2026-11-03, got ${repCustom.totalOrdersCount}`);
  }
  console.log('✔ Scenario 21 Passed: Rentang tanggal kustom menyaring berdasarkan tanggal operasional');

  // -------------------------------------------------------------------------
  // Scenario 22: Tanggal Lokal Tidak Bergeser & Prioritas operational_date
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 22: Integritas Zona Waktu UTC/Lokal & Prioritas Single Source of Truth ---');
  // Order dengan operational_date eksplisit terisi
  const ordExplicitOpDate: Order = {
    ...orderA1,
    id: 'ord-explicit-op',
    created_at: '2026-11-04T18:30:00.000Z', // Timestamp UTC yang mungkin beda hari lokal
    operational_date: '2026-11-04',
  };
  const resolvedOpDate = getOrderOperationalDate(ordExplicitOpDate, '04:00');
  if (resolvedOpDate !== '2026-11-04') {
    throw new Error(`Scenario 22 Failed: operational_date eksplisit harus diprioritaskan, got '${resolvedOpDate}'`);
  }
  console.log('✔ Scenario 22 Passed: Single source of truth operational_date diprioritaskan tanpa shift ganda');

  // -------------------------------------------------------------------------
  // Scenario 23: Konsistensi Transaksi Laporan dengan Rekap Shift
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 23: Konsistensi Transaksi Laporan dengan Rekap Shift ---');
  const mockShift: Shift = {
    id: 'shift-audited-1',
    shift_number: 'SH-20261104-01',
    operational_date: '2026-11-04',
    status: 'closed',
    opened_at: new Date(2026, 10, 4, 16, 0, 0, 0).toISOString(),
    closed_at: new Date(2026, 10, 5, 2, 30, 0, 0).toISOString(), // Ditutup lewat tengah malam
    opened_by_user_id: userA.id,
    opened_by_name: userA.name,
    cash_initial: 100000,
    created_at: new Date(2026, 10, 4, 16, 0, 0, 0).toISOString(),
  };

  const shiftOrderEarlyNight: Order = {
    ...orderA1,
    id: 'ord-sh-1',
    order_number: 'ORD-SH-1',
    total_amount: 80000,
    created_at: new Date(2026, 10, 4, 19, 0, 0, 0).toISOString(),
    operational_date: mockShift.operational_date,
  };
  const shiftOrderPostMidnight: Order = {
    ...orderB1,
    id: 'ord-sh-2',
    order_number: 'ORD-SH-2',
    total_amount: 70000,
    created_at: new Date(2026, 10, 5, 1, 30, 0, 0).toISOString(),
    operational_date: mockShift.operational_date,
  };

  const shiftTotalSales = shiftOrderEarlyNight.total_amount + shiftOrderPostMidnight.total_amount; // 150000

  const repShiftReport = computeReportData({
    ...baseParams,
    orders: [shiftOrderEarlyNight, shiftOrderPostMidnight],
    dateFilter: 'custom',
    startDate: mockShift.operational_date,
    endDate: mockShift.operational_date,
    cutoffTime: '04:00',
    userId: 'all',
  });

  if (repShiftReport.totalSales !== shiftTotalSales || repShiftReport.totalOrdersCount !== 2) {
    throw new Error(`Scenario 23 Failed: Total sales laporan (${repShiftReport.totalSales}) tidak cocok dengan shift sales (${shiftTotalSales})`);
  }
  console.log('✔ Scenario 23 Passed: Laporan finansial 100% konsisten dengan rekapitulasi shift lintas tengah malam');

  // -------------------------------------------------------------------------
  // Scenario 24: Prioritas 1 — Order dengan operational_date eksplisit & valid
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 24: Prioritas 1 — Order dengan operational_date eksplisit & valid ---');
  const shiftForPrio: Shift = {
    ...mockShift,
    id: 'shift-prio-1',
    operational_date: '2026-11-04',
  };
  const orderWithExplicitOpDate: Order = {
    ...orderA1,
    id: 'ord-prio-1',
    shift_id: shiftForPrio.id,
    created_at: new Date(2026, 10, 5, 2, 0, 0, 0).toISOString(),
    operational_date: '2026-11-05', // Berbeda dari shift-nya
  };
  // Prioritas 1 harus mengambil order.operational_date ('2026-11-05'), bukan shift ('2026-11-04')
  const opDatePrio1 = getOrderOperationalDate(orderWithExplicitOpDate, '04:00', [shiftForPrio]);
  if (opDatePrio1 !== '2026-11-05') {
    throw new Error(`Scenario 24 Failed: Expected '2026-11-05' from order.operational_date, got '${opDatePrio1}'`);
  }
  console.log('✔ Scenario 24 Passed: Prioritas 1 memilih order.operational_date saat terisi dan valid');

  // -------------------------------------------------------------------------
  // Scenario 25: Prioritas 2 — Order tanpa operational_date tetapi memiliki shift_id valid
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 25: Prioritas 2 — Fallback ke shift.operational_date saat order tidak memilikinya ---');
  const orderWithoutOpDateWithShift: Order = {
    ...orderA1,
    id: 'ord-prio-2',
    shift_id: shiftForPrio.id,
    created_at: new Date(2026, 10, 5, 2, 0, 0, 0).toISOString(),
    operational_date: undefined,
  };
  // Array lookup
  const opDatePrio2Array = getOrderOperationalDate(orderWithoutOpDateWithShift, '04:00', [shiftForPrio]);
  if (opDatePrio2Array !== '2026-11-04') {
    throw new Error(`Scenario 25 Failed (Array): Expected '2026-11-04' from shift, got '${opDatePrio2Array}'`);
  }
  // Map lookup
  const shiftMapPrio = new Map<string, Shift>([[shiftForPrio.id, shiftForPrio]]);
  const opDatePrio2Map = getOrderOperationalDate(orderWithoutOpDateWithShift, '04:00', shiftMapPrio);
  if (opDatePrio2Map !== '2026-11-04') {
    throw new Error(`Scenario 25 Failed (Map): Expected '2026-11-04' from shift map, got '${opDatePrio2Map}'`);
  }
  console.log('✔ Scenario 25 Passed: Prioritas 2 berhasil me-resolve tanggal operasional dari shift yang menaunginya');

  // -------------------------------------------------------------------------
  // Scenario 26: Kekebalan terhadap Perubahan Cutoff Toko (Cutoff 03:00 -> 04:00)
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 26: Imunitas terhadap Perubahan Cutoff Toko (03:00 vs 04:00) ---');
  // Order jam 03:30 tanggal 5 Nov (lokal).
  // Dengan cutoff 03:00, 03:30 adalah hari baru (2026-11-05).
  // Namun dengan cutoff 04:00, 03:30 secara kalkulasi cutoff naive akan tergeser ke hari sebelumnya (2026-11-04).
  // Karena order terikat ke shift dengan operational_date '2026-11-05', tanggalnya HARUS TETAP '2026-11-05'!
  const shiftNov5: Shift = {
    ...mockShift,
    id: 'shift-nov5',
    operational_date: '2026-11-05',
  };
  const orderAt330am: Order = {
    ...orderA1,
    id: 'ord-at-330',
    shift_id: shiftNov5.id,
    created_at: new Date(2026, 10, 5, 3, 30, 0, 0).toISOString(),
    operational_date: undefined,
  };
  const opDateWithCutoff03 = getOrderOperationalDate(orderAt330am, '03:00', [shiftNov5]);
  const opDateWithCutoff04 = getOrderOperationalDate(orderAt330am, '04:00', [shiftNov5]);
  if (opDateWithCutoff03 !== '2026-11-05' || opDateWithCutoff04 !== '2026-11-05') {
    throw new Error(`Scenario 26 Failed: Shift-linked order must remain '2026-11-05' regardless of cutoff changes, got 03:00='${opDateWithCutoff03}', 04:00='${opDateWithCutoff04}'`);
  }
  // Sebaliknya, jika order TIDAK terikat ke shift, ia akan terpengaruh cutoff
  const orderUnlinkedAt330am: Order = {
    ...orderAt330am,
    id: 'ord-unlinked-330',
    shift_id: undefined,
  };
  const unlinkedWith03 = getOrderOperationalDate(orderUnlinkedAt330am, '03:00', [shiftNov5]);
  const unlinkedWith04 = getOrderOperationalDate(orderUnlinkedAt330am, '04:00', [shiftNov5]);
  if (unlinkedWith03 !== '2026-11-05' || unlinkedWith04 !== '2026-11-04') {
    throw new Error(`Scenario 26 Failed: Unlinked order should shift with cutoff (expected 03:00='2026-11-05', 04:00='2026-11-04'), got 03:00='${unlinkedWith03}', 04:00='${unlinkedWith04}'`);
  }
  console.log('✔ Scenario 26 Passed: Transaksi terikat shift 100% imun terhadap perubahan jam cutoff toko');

  // -------------------------------------------------------------------------
  // Scenario 27: Prioritas 3 — Order tanpa operational_date dan tanpa shift_id
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 27: Prioritas 3 — Fallback ke kalkulasi cutoff saat tidak ada shift & opDate ---');
  const orderNoShiftNoOpDate: Order = {
    ...orderA1,
    id: 'ord-prio-3',
    shift_id: undefined,
    operational_date: undefined,
    created_at: new Date(2026, 10, 5, 1, 15, 0, 0).toISOString(), // 01:15 subuh
  };
  const opDatePrio3 = getOrderOperationalDate(orderNoShiftNoOpDate, '04:00', [shiftForPrio]);
  // 01:15 pada 5 Nov sebelum 04:00 cutoff harus jatuh pada 2026-11-04
  if (opDatePrio3 !== '2026-11-04') {
    throw new Error(`Scenario 27 Failed: Expected '2026-11-04' via cutoff calculation, got '${opDatePrio3}'`);
  }
  console.log('✔ Scenario 27 Passed: Prioritas 3 menghitung tanggal operasional via jam cutoff secara benar');

  // -------------------------------------------------------------------------
  // Scenario 28: Defensive Fallback — Order dengan shift_id yang tidak dapat di-resolve
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 28: Ketahanan terhadap shift_id yang tidak ditemukan ---');
  const orderWithUnresolvableShift: Order = {
    ...orderA1,
    id: 'ord-ghost-shift',
    shift_id: 'non-existent-shift-id',
    operational_date: undefined,
    created_at: new Date(2026, 10, 5, 1, 45, 0, 0).toISOString(),
  };
  // Tidak boleh melempar error dan harus jatuh ke Prioritas 3 (cutoff fallback)
  const opDateGhostShift = getOrderOperationalDate(orderWithUnresolvableShift, '04:00', [shiftForPrio]);
  if (opDateGhostShift !== '2026-11-04') {
    throw new Error(`Scenario 28 Failed: Expected graceful fallback to '2026-11-04', got '${opDateGhostShift}'`);
  }
  console.log('✔ Scenario 28 Passed: Penanganan defensif aman saat shift_id tidak ditemukan');

  // -------------------------------------------------------------------------
  // Scenario 29: Defensive Fallback — Shift dengan operational_date tidak valid / kosong
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 29: Ketahanan terhadap shift dengan operational_date kosong / tidak valid ---');
  const shiftCorruptedDate: Shift = {
    ...mockShift,
    id: 'shift-corrupted',
    operational_date: 'invalid-date-format',
  };
  const orderWithCorruptedShift: Order = {
    ...orderA1,
    id: 'ord-corrupted-shift',
    shift_id: shiftCorruptedDate.id,
    operational_date: undefined,
    created_at: new Date(2026, 10, 5, 2, 10, 0, 0).toISOString(),
  };
  const opDateCorrupted = getOrderOperationalDate(orderWithCorruptedShift, '04:00', [shiftCorruptedDate]);
  if (opDateCorrupted !== '2026-11-04') {
    throw new Error(`Scenario 29 Failed: Expected fallback to '2026-11-04' when shift date is invalid, got '${opDateCorrupted}'`);
  }
  console.log('✔ Scenario 29 Passed: Penanganan defensif aman saat data shift rusak/kosong');

  // -------------------------------------------------------------------------
  // Scenario 30: Konsistensi Total Laporan dengan Rekap Shift melalui computeReportData
  // -------------------------------------------------------------------------
  console.log('\n--- Scenario 30: Konsistensi Total Laporan dengan Rekap Shift (computeReportData) ---');
  const targetShift: Shift = {
    ...mockShift,
    id: 'shift-reconcile-target',
    operational_date: '2026-11-05',
  };
  // Order 1: memiliki explicit operational_date '2026-11-05'
  const ordReconcile1: Order = {
    ...orderA1,
    id: 'ord-rec-1',
    shift_id: targetShift.id,
    total_amount: 50000,
    created_at: new Date(2026, 10, 5, 20, 0, 0, 0).toISOString(),
    operational_date: '2026-11-05',
  };
  // Order 2: transaksi historis tanpa operational_date, tapi terikat shift_id
  const ordReconcile2: Order = {
    ...orderB1,
    id: 'ord-rec-2',
    shift_id: targetShift.id,
    total_amount: 75000,
    created_at: new Date(2026, 10, 6, 3, 45, 0, 0).toISOString(), // 03:45 tanggal 6 Nov
    operational_date: undefined,
  };
  // Hitung laporan dengan mengirimkan shifts: [targetShift]
  const repReconciled = computeReportData({
    ...baseParams,
    orders: [ordReconcile1, ordReconcile2],
    shifts: [targetShift],
    dateFilter: 'custom',
    startDate: '2026-11-05',
    endDate: '2026-11-05',
    cutoffTime: '04:00',
    userId: 'all',
  });

  const expectedSales = ordReconcile1.total_amount + ordReconcile2.total_amount; // 125000
  if (repReconciled.totalSales !== expectedSales || repReconciled.totalOrdersCount !== 2) {
    throw new Error(`Scenario 30 Failed: Expected totalSales ${expectedSales} and count 2, got ${repReconciled.totalSales} and ${repReconciled.totalOrdersCount}`);
  }
  console.log('✔ Scenario 30 Passed: computeReportData dengan parameter shifts menghasilkan total omzet 100% cocok dengan rekap shift');

  console.log('\n===============================================================');
  console.log('   ALL 30 ACCEPTANCE CRITERIA PASSED (100%)');
  console.log('   - 11 User Filter & Provenance Criteria Passed');
  console.log('   - 12 Operational Cutoff Harmonization Criteria Passed');
  console.log('   - 7 Historical Shift Operational Date Fallback Criteria Passed');
  console.log('===============================================================');
}

// Execute tests if invoked directly
runReportUserFilterTests();
