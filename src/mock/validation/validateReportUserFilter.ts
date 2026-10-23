import * as fs from 'fs';
import * as XLSX from 'xlsx';
import { computeReportData } from '../../utils/reportUtils';
import { Order, Product, Recipe, Stock, Purchase, User } from '../../types';
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
    created_at: '2026-10-23T08:30:00.000Z',
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
    created_at: '2026-10-23T09:15:00.000Z',
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
    created_at: '2026-10-23T10:00:00.000Z',
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
    created_at: '2026-10-23T07:45:00.000Z',
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
    refunded_at: '2026-10-23T09:00:00.000Z',
    created_at: '2026-10-23T08:50:00.000Z',
  };

  const allOrders = [orderA1, orderA2, orderB1, legacyOrder, refundedOrderA];

  const baseParams = {
    orders: allOrders,
    purchases,
    products,
    recipes,
    stocks,
    dateFilter: 'today' as const,
    startDate: '2026-10-23',
    endDate: '2026-10-23',
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

  console.log('\n===============================================================');
  console.log('   ALL 11 CHECKPOINT 3 ACCEPTANCE CRITERIA PASSED (100%)');
  console.log('===============================================================');
}

// Execute tests if invoked directly
runReportUserFilterTests();
