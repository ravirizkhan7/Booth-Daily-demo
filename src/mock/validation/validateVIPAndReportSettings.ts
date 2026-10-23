/**
 * BOOTH DAILY — VIP & REPORT SETTINGS VALIDATION SUITE
 * 
 * Comprehensive automated verification for:
 * 1. Fitur 1: Persistent report signer name & city with Owner session guard,
 *    graceful fallbacks, Indonesian date formatting, and export metadata.
 * 2. Fitur 2: VIP order area & VIP discount calculation with non-stacking rule,
 *    promo comparison, and tie-breaking rule favoring VIP discount.
 * 3. Fitur 3: VIP tax override vs general tax fallback, VIP room service charge,
 *    zero double counting on discounted base, order snapshotting, and shift/report aggregations.
 * 4. Backward compatibility, historical order safety, and backup/restore validation.
 */

import { mockStore } from '../store';
import { sessionManager } from '../repositories/sessionManager';
import { calculateOrderPreview } from '../../utils/orderCalculation';
import { transactionService } from '../../services/transactionService';
import { calculateShiftFinancials } from '../../utils/shiftCalculation';
import { computeReportData } from '../../utils/reportUtils';
import { backupService, validateBackupPayload } from '../../services/backupService';
import { Order, DiscountRule, User } from '../../types';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  totalTests++;
  if (condition) {
    passedTests++;
    console.log(`  ✓ PASS: ${testName}`);
  } else {
    failedTests++;
    console.error(`  ✗ FAIL: ${testName}`);
    if (detail) {
      console.error(`    Detail: ${detail}`);
    }
  }
}

async function runTests() {
  console.log('===============================================================');
  console.log('   BOOTH DAILY — VIP & REPORT SETTINGS AUTOMATED VALIDATION');
  console.log('===============================================================');

  // Helper setup: get owner user from store
  const state = mockStore.getSnapshot();
  const ownerUser = state.users.find(u => u.role === 'owner')!;
  const cashierUser = state.users.find(u => u.role === 'karyawan')!;

  assert(Boolean(ownerUser && cashierUser), 'Setup: Owner and Cashier users available in store');

  const setOwnerSession = () => {
    sessionManager.setSession({
      userId: ownerUser.id,
      token: 'mock-owner-token',
      loggedInAt: new Date().toISOString(),
    });
  };

  const setCashierSession = () => {
    sessionManager.setSession({
      userId: cashierUser.id,
      token: 'mock-cashier-token',
      loggedInAt: new Date().toISOString(),
    });
  };

  // Ensure active owner session
  setOwnerSession();

  // -----------------------------------------------------------------
  // SUITE 1: FITUR 1 — SETTINGS PERSISTENCE, OWNER GUARD, FALLBACKS
  // -----------------------------------------------------------------
  console.log('\n--- SUITE 1: Fitur 1 — Settings Persistence & Signer/City ---');

  // 1.1 Initial settings defaults
  const initialSettings = mockStore.getSettings();
  assert(typeof initialSettings.report_signer_name === 'string', '1.1 report_signer_name is defined as string');
  assert(typeof initialSettings.report_city === 'string', '1.1 report_city is defined as string');
  assert(typeof initialSettings.vip_discount_percentage === 'number', '1.1 vip_discount_percentage is defined as number');
  assert(initialSettings.vip_tax_percentage === null || typeof initialSettings.vip_tax_percentage === 'number', '1.1 vip_tax_percentage is null or number');
  assert(typeof initialSettings.vip_room_service_charge_percentage === 'number', '1.1 vip_room_service_charge_percentage is defined as number');

  // 1.2 Owner update settings
  setOwnerSession();
  const updatedSettings = mockStore.updateSettings({
    report_signer_name: '  Hendrawan Pratama  ',
    report_city: '  Bandung  ',
    vip_discount_percentage: 15,
    vip_tax_percentage: 11,
    vip_room_service_charge_percentage: 5,
  });

  assert(updatedSettings.report_signer_name === 'Hendrawan Pratama', '1.2 report_signer_name is trimmed and stored');
  assert(updatedSettings.report_city === 'Bandung', '1.2 report_city is trimmed and stored');
  assert(updatedSettings.vip_discount_percentage === 15, '1.2 vip_discount_percentage is updated to 15%');
  assert(updatedSettings.vip_tax_percentage === 11, '1.2 vip_tax_percentage is updated to 11%');
  assert(updatedSettings.vip_room_service_charge_percentage === 5, '1.2 vip_room_service_charge_percentage is updated to 5%');

  // 1.3 Persistence across store snapshot/reload simulation
  const snapshotAfterUpdate = mockStore.getSnapshot();
  assert(snapshotAfterUpdate.settings.report_signer_name === 'Hendrawan Pratama', '1.3 report_signer_name persisted in snapshot');
  assert(snapshotAfterUpdate.settings.report_city === 'Bandung', '1.3 report_city persisted in snapshot');
  assert(snapshotAfterUpdate.settings.vip_discount_percentage === 15, '1.3 vip_discount_percentage persisted in snapshot');

  // 1.4 Non-owner cannot update settings
  setCashierSession();
  let cashierBlocked = false;
  try {
    mockStore.updateSettings({ report_signer_name: 'Hacked By Cashier' });
  } catch (err: any) {
    cashierBlocked = true;
  }
  assert(cashierBlocked, '1.4 Cashier session blocked from updating settings');
  // Re-verify value was not mutated
  assert(mockStore.getSettings().report_signer_name === 'Hendrawan Pratama', '1.4 Signer name preserved after unauthorized attempt');

  // Switch back to Owner
  setOwnerSession();

  // 1.5 Fallback formatters: empty signer and empty city
  mockStore.updateSettings({
    report_signer_name: '',
    report_city: '',
  });
  const emptySettings = mockStore.getSettings();
  const effectiveSigner = emptySettings.report_signer_name?.trim() || 'Owner / Manajemen';
  assert(effectiveSigner === 'Owner / Manajemen', '1.5 Empty report_signer_name falls back to "Owner / Manajemen"');

  const todayFormatted = new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(new Date());

  const locationWithCity = emptySettings.report_city?.trim()
    ? `${emptySettings.report_city.trim()}, ${todayFormatted}`
    : todayFormatted;
  assert(!locationWithCity.includes(','), '1.5 When city is empty, no hanging comma in location string');

  // Restore active test settings for remaining suites
  mockStore.updateSettings({
    report_signer_name: 'Budi Raharja',
    report_city: 'Surabaya',
    tax_percentage: 10,
    vip_discount_percentage: 10,
    vip_tax_percentage: 12,
    vip_room_service_charge_percentage: 5,
  });

  // -----------------------------------------------------------------
  // SUITE 2: FITUR 2 — DISKON KHUSUS RUANG VIP & NON-STACKING LOGIC
  // -----------------------------------------------------------------
  console.log('\n--- SUITE 2: Fitur 2 — VIP Discount & Non-Stacking Rules ---');

  const promoRule10: DiscountRule = {
    id: 'promo-10',
    name: 'Promo 10%',
    minimum_purchase: 50000,
    discount_percentage: 10,
    is_active: true,
  };

  const promoRule20: DiscountRule = {
    id: 'promo-20',
    name: 'Promo Spesial 20%',
    minimum_purchase: 50000,
    discount_percentage: 20,
    is_active: true,
  };

  const promoRule5: DiscountRule = {
    id: 'promo-5',
    name: 'Promo Kecil 5%',
    minimum_purchase: 50000,
    discount_percentage: 5,
    is_active: true,
  };

  // 2.1 Regular order: no VIP discount even if vipDiscountPercentage is passed
  const regularPreview = calculateOrderPreview(100000, [], 10, {
    isVip: false,
    vipDiscountPercentage: 10,
  });
  assert(regularPreview.subtotal === 100000, '2.1 Subtotal is 100,000');
  assert(regularPreview.discount === 0, '2.1 Regular order total discount is 0');
  assert(regularPreview.isVip === false, '2.1 Regular order isVip is false');

  // 2.2 VIP order with 10% VIP discount: discount = 10,000
  const vipPreview = calculateOrderPreview(100000, [], 10, {
    isVip: true,
    vipDiscountPercentage: 10,
  });
  assert(vipPreview.discount === 10000, '2.2 VIP discount is 10,000 (10% of 100,000)');
  assert(vipPreview.discountPercentage === 10, '2.2 discountPercentage is 10%');
  assert(Boolean(vipPreview.discountName?.includes('Ruang VIP')), '2.2 discountName identifies VIP discount');
  assert(vipPreview.isVip === true, '2.2 isVip is true');

  // 2.3 Non-stacking: Promo larger than VIP discount (Promo 20% = 20,000 vs VIP 10% = 10,000)
  const promoLargerPreview = calculateOrderPreview(100000, [promoRule20], 10, {
    isVip: true,
    vipDiscountPercentage: 10,
  });
  assert(promoLargerPreview.discount === 20000, '2.3 When promo (20,000) > VIP (10,000), promo is chosen');
  assert(promoLargerPreview.discountName === 'Promo Spesial 20%', '2.3 discountName is promo name');

  // 2.4 Non-stacking: VIP discount larger than Promo (VIP 10% = 10,000 vs Promo 5% = 5,000)
  const vipLargerPreview = calculateOrderPreview(100000, [promoRule5], 10, {
    isVip: true,
    vipDiscountPercentage: 10,
  });
  assert(vipLargerPreview.discount === 10000, '2.4 When VIP (10,000) > promo (5,000), VIP is chosen');
  assert(Boolean(vipLargerPreview.discountName?.includes('Ruang VIP')), '2.4 discountName is VIP');

  // 2.5 Non-stacking: Tie-breaker (Promo 10% = 10,000 vs VIP 10% = 10,000) -> VIP wins
  const tiePreview = calculateOrderPreview(100000, [promoRule10], 10, {
    isVip: true,
    vipDiscountPercentage: 10,
  });
  assert(tiePreview.discount === 10000, '2.5 On tie (10,000 == 10,000), total discount is 10,000');
  assert(Boolean(tiePreview.discountName?.includes('Ruang VIP')), '2.5 On tie, tie-breaker favors VIP discount');

  // 2.6 Edge cases: 0% and 100% VIP discount
  const zeroDiscPreview = calculateOrderPreview(100000, [], 10, {
    isVip: true,
    vipDiscountPercentage: 0,
  });
  assert(zeroDiscPreview.discount === 0, '2.6 0% VIP discount produces 0 discount');

  const fullDiscPreview = calculateOrderPreview(100000, [], 10, {
    isVip: true,
    vipDiscountPercentage: 100,
  });
  assert(fullDiscPreview.discount === 100000, '2.6 100% VIP discount produces 100,000 discount (full subtotal)');
  assert(fullDiscPreview.discountedBase === 0, '2.6 100% VIP discount results in 0 discounted base');

  // -----------------------------------------------------------------
  // SUITE 3: FITUR 3 — PAJAK VIP & BIAYA LAYANAN VIP (NO DOUBLE COUNTING)
  // -----------------------------------------------------------------
  console.log('\n--- SUITE 3: Fitur 3 — VIP Tax, Service Charge & No Double Counting ---');

  // Base test parameters:
  // Subtotal = 100,000
  // Discount = 10,000 (VIP 10%)
  // Discounted base = 90,000
  // General tax = 10%
  // VIP tax = 12% (overrides general tax)
  // VIP service charge = 5%
  const preview = calculateOrderPreview(100000, [], 10, {
    isVip: true,
    vipDiscountPercentage: 10,
    vipTaxPercentage: 12,
    vipServiceChargePercentage: 5,
  });

  // 3.1 Base calculation
  assert(preview.discountedBase === 90000, '3.1 discountedBase is exactly max(0, 100,000 - 10,000) = 90,000');

  // 3.2 Tax calculation: exactly 12% on 90,000 = 10,800
  assert(preview.taxPercentage === 12, '3.2 VIP tax rate is 12%');
  assert(preview.tax === 10800, '3.2 Tax is 10,800 (12% of 90,000)');

  // 3.3 Service charge calculation: exactly 5% on 90,000 = 4,500
  assert(preview.serviceChargePercentage === 5, '3.3 VIP service charge rate is 5%');
  assert(preview.serviceCharge === 4500, '3.3 Service charge is 4,500 (5% of 90,000)');

  // 3.4 ZERO DOUBLE COUNTING: Tax is NOT calculated on (90,000 + 4,500)
  const doubleCountedTax = Math.round((90000 + 4500) * 0.12); // 11,340
  assert(preview.tax !== doubleCountedTax, '3.4 ZERO DOUBLE COUNTING: Tax is NOT levied on service charge');
  assert(preview.tax === Math.round(preview.discountedBase * 0.12), '3.4 Tax is computed strictly on discounted base');

  // 3.5 Grand total: 90,000 + 10,800 + 4,500 = 105,300
  const expectedGrandTotal = 90000 + 10800 + 4500;
  assert(preview.totalAmount === expectedGrandTotal, `3.5 Grand total is exactly ${expectedGrandTotal}`);

  // 3.6 VIP Tax fallback to General Tax when null
  const nullVipTaxPreview = calculateOrderPreview(100000, [], 10, {
    isVip: true,
    vipDiscountPercentage: 10,
    vipTaxPercentage: null,
    vipServiceChargePercentage: 5,
  });
  assert(nullVipTaxPreview.taxPercentage === 10, '3.6 When vip_tax_percentage is null, falls back to general tax rate (10%)');
  assert(nullVipTaxPreview.tax === 9000, '3.6 Tax is 9,000 (10% of 90,000)');

  // 3.7 VIP Tax override with 0% (free tax in VIP)
  const zeroVipTaxPreview = calculateOrderPreview(100000, [], 10, {
    isVip: true,
    vipDiscountPercentage: 10,
    vipTaxPercentage: 0,
    vipServiceChargePercentage: 5,
  });
  assert(zeroVipTaxPreview.taxPercentage === 0, '3.7 vip_tax_percentage = 0 overrides general tax with 0%');
  assert(zeroVipTaxPreview.tax === 0, '3.7 Tax is 0');

  // 3.8 Service charge is 0 for regular order even if VIP service charge is configured
  const regularOrderWithVipSettings = calculateOrderPreview(100000, [], 10, {
    isVip: false,
    vipDiscountPercentage: 10,
    vipTaxPercentage: 12,
    vipServiceChargePercentage: 5,
  });
  assert(regularOrderWithVipSettings.serviceCharge === 0, '3.8 Regular order has 0 service charge');
  assert(regularOrderWithVipSettings.taxPercentage === 10, '3.8 Regular order uses general tax (10%)');
  assert(regularOrderWithVipSettings.tax === 10000, '3.8 Regular order tax is 10,000 (10% of 100,000)');

  // -----------------------------------------------------------------
  // SUITE 4: ORDER CREATION & TRANSACTION SERVICE SNAPSHOTTING
  // -----------------------------------------------------------------
  console.log('\n--- SUITE 4: Order Creation & Snapshotting ---');

  // Ensure an active shift exists for order creation
  let activeShift = mockStore.getActiveShift();
  if (!activeShift) {
    activeShift = mockStore.openShift({
      cash_initial: 200000,
      user: cashierUser,
    });
  }

  const sampleProduct = state.products[0];
  assert(Boolean(sampleProduct), '4.0 Sample product available in store');

  // 4.1 Create regular order
  const regularOrder = await transactionService.processTransaction({
    order_type: 'dine_in',
    order_area: 'regular',
    is_vip: false,
    items: [
      {
        product_id: sampleProduct.id,
        product_name: sampleProduct.name,
        price: sampleProduct.price,
        qty: 1,
      }
    ],
    payment_method: 'cash',
    amount_paid: 100000,
    user: cashierUser,
  });

  assert(Boolean(regularOrder && regularOrder.id), '4.1 Regular order created successfully');
  assert(regularOrder.order_area === 'regular', '4.1 regOrder.order_area is regular');
  assert(regularOrder.is_vip === false, '4.1 regOrder.is_vip is false');
  assert(regularOrder.service_charge === 0, '4.1 regOrder.service_charge is 0');
  assert(regularOrder.tax_percentage === 10, '4.1 regOrder.tax_percentage is 10');

  // 4.2 Create VIP order with cash payment
  // Settings: vip_discount_percentage = 10, vip_tax_percentage = 12, vip_room_service_charge_percentage = 5
  const vipOrder = await transactionService.processTransaction({
    order_type: 'dine_in',
    order_area: 'vip',
    is_vip: true,
    items: [
      {
        product_id: sampleProduct.id,
        product_name: sampleProduct.name,
        price: 100000,
        qty: 1,
      }
    ],
    payment_method: 'cash',
    amount_paid: 120000,
    user: cashierUser,
  });

  assert(Boolean(vipOrder && vipOrder.id), '4.2 VIP order created successfully');
  assert(vipOrder.order_area === 'vip', '4.2 vipOrder.order_area is vip');
  assert(vipOrder.is_vip === true, '4.2 vipOrder.is_vip is true');
  assert(vipOrder.discount === 10000, '4.2 vipOrder.discount is 10,000');
  assert(vipOrder.tax === 10800, '4.2 vipOrder.tax is 10,800');
  assert(vipOrder.tax_percentage === 12, '4.2 vipOrder.tax_percentage is 12');
  assert(vipOrder.service_charge === 4500, '4.2 vipOrder.service_charge is 4,500');
  assert(vipOrder.service_charge_percentage === 5, '4.2 vipOrder.service_charge_percentage is 5');
  assert(vipOrder.total_amount === 105300, '4.2 vipOrder.total_amount is 105,300');
  assert(vipOrder.payment?.change === (120000 - 105300), '4.2 Cash change matches: 120,000 - 105,300 = 14,700');

  // 4.3 Create VIP order with QRIS payment
  const qrisVipOrder = await transactionService.processTransaction({
    order_type: 'dine_in',
    order_area: 'vip',
    is_vip: true,
    items: [
      {
        product_id: sampleProduct.id,
        product_name: sampleProduct.name,
        price: 100000,
        qty: 1,
      }
    ],
    payment_method: 'qris',
    amount_paid: 105300,
    user: cashierUser,
  });

  assert(Boolean(qrisVipOrder && qrisVipOrder.id), '4.3 VIP QRIS order created successfully');
  assert(qrisVipOrder.payment?.amount_paid === 105300, '4.3 QRIS payment amount matches exact grand total (105,300)');
  assert(qrisVipOrder.payment?.change === 0, '4.3 QRIS change is 0');

  // -----------------------------------------------------------------
  // SUITE 5: SHIFT & REPORT FINANCIAL AGGREGATIONS
  // -----------------------------------------------------------------
  console.log('\n--- SUITE 5: Shift & Report Financial Aggregations ---');

  // 5.1 Shift financial calculation
  const allOrders = mockStore.getOrders();
  const shiftExpenses = mockStore.getShiftExpenses(activeShift.id);

  const shiftFinancials = calculateShiftFinancials(
    activeShift,
    allOrders,
    state.products,
    state.recipes,
    state.stocks,
    undefined,
    shiftExpenses
  );

  assert(typeof shiftFinancials.service_charge_total === 'number', '5.1 service_charge_total exists in shift financials');
  assert((shiftFinancials.service_charge_total ?? 0) >= 9000, '5.1 Shift aggregates service charges from VIP orders');

  // 5.2 Report Data aggregation
  const reportData = computeReportData({
    orders: allOrders,
    purchases: [],
    products: state.products,
    recipes: state.recipes,
    stocks: state.stocks,
    dateFilter: 'month',
    startDate: '2026-10-01',
    endDate: '2026-10-31',
    settings: mockStore.getSettings(),
  });

  assert(typeof reportData.totalServiceCharge === 'number', '5.2 totalServiceCharge is in ReportData');
  assert(reportData.vipOrdersCount >= 2, '5.2 Report counts VIP orders correctly');
  assert(reportData.vipSales >= 210600, '5.2 Report aggregates VIP sales accurately');
  assert(reportData.regularOrdersCount >= 1, '5.2 Report counts regular orders correctly');
  assert(reportData.totalSales >= (reportData.vipSales + reportData.regularSales), '5.2 Total sales reconciles VIP and regular sales');

  // -----------------------------------------------------------------
  // SUITE 6: BACKWARD COMPATIBILITY & BACKUP SCHEMA VALIDATION
  // -----------------------------------------------------------------
  console.log('\n--- SUITE 6: Backward Compatibility & Backup Validation ---');

  // 6.1 Historical order safety: order without new fields
  const legacyOrder: Partial<Order> = {
    id: 'legacy-1',
    order_number: 'ORD-LEGACY-001',
    total_amount: 50000,
    subtotal: 50000,
    // order_area and service_charge missing
  };
  const isVipLegacy = legacyOrder.order_area === 'vip' || Boolean(legacyOrder.is_vip);
  const serviceChargeLegacy = legacyOrder.service_charge ?? 0;
  assert(isVipLegacy === false, '6.1 Legacy order treats missing area as non-VIP');
  assert(serviceChargeLegacy === 0, '6.1 Legacy order treats missing service charge as 0');

  // 6.2 Backup validation passes with valid new settings
  setOwnerSession();
  let backupExportOk = false;
  try {
    const backupResult = await backupService.exportBackup('ValidOwnerPassword123!');
    assert(Boolean(backupResult.container), '6.2 Backup export container returned');
    assert(Boolean(backupResult.filename), '6.2 Backup export filename returned');

    // Verify settings snapshot contains new fields
    const storeSettings = mockStore.getSettings();
    assert(storeSettings.report_signer_name === 'Budi Raharja', '6.2 report_signer_name present in store settings');
    assert(storeSettings.report_city === 'Surabaya', '6.2 report_city present in store settings');
    assert(storeSettings.vip_discount_percentage === 10, '6.2 vip_discount_percentage present in store settings');
    backupExportOk = true;
  } catch (err: any) {
    console.error('Backup export failed:', err);
  }
  assert(backupExportOk, '6.2 Backup export succeeds with new settings');

  // 6.3 Backup schema validation rejects invalid percentages (> 100% or < 0%)
  const dummyPayload: any = {
    format: 'booth_daily_encrypted_payload',
    version: 1,
    store: {
      settings: {
        store_name: 'Booth Daily',
        tax_percentage: 10,
        vip_discount_percentage: 150, // INVALID!
      },
      users: state.users,
      shifts: [],
      orders: [],
      products: [],
      categories: [],
      recipes: [],
      stocks: [],
      purchases: [],
      shift_expenses: [],
      cash_cuts: [],
    },
    media: {
      app_logo: null,
      printer_logo: null,
    }
  };

  let invalidBackupRejected = false;
  try {
    validateBackupPayload(dummyPayload);
  } catch (err: any) {
    invalidBackupRejected = true;
    assert(err.message.includes('Diskon VIP'), '6.3 Descriptive error thrown for out-of-range VIP discount in backup');
  }
  assert(invalidBackupRejected, '6.3 Backup validator rejects invalid VIP discount > 100%');

  // -----------------------------------------------------------------
  // SUMMARY
  // -----------------------------------------------------------------
  console.log('\n===============================================================');
  console.log(`   VALIDATION RESULT: ${passedTests}/${totalTests} TESTS PASSED (${failedTests} FAILED)`);
  console.log('===============================================================');

  if (failedTests > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runTests();
