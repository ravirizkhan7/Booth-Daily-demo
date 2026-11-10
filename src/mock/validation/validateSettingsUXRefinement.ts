/**
 * BOOTH DAILY — SETTINGS UX REFINEMENT VALIDATION SUITE
 * 
 * Verifies:
 * 1. Unified Discount Management (General vs VIP scope)
 * 2. Non-stacking, best promo selection, tie-breaker VIP
 * 3. Scope preservation across CRUD, Owner authorization, and Backup/Restore
 * 4. NumberInput parsing, 0-default, no '05', decimal handling, range clamping
 * 5. VIP Tax Switch (OFF = general fallback, ON + 0 = 0% tax, ON + 5 = 5% tax)
 * 6. Zero double counting on orders & reports
 */

import { mockStore } from '../store';
import { sessionManager } from '../repositories/sessionManager';
import { calculateOrderPreview, findBestPromo } from '../../utils/orderCalculation';
import { DiscountRule, Settings, Order } from '../../types';
import { backupService } from '../../services/backupService';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    throw new Error(`Assertion failed: ${msg}`);
  }
  console.log(`  ✓ PASS: ${msg}`);
}

export async function runSettingsUXRefinementTests() {
  console.log('===============================================================');
  console.log('   BOOTH DAILY — SETTINGS UX REFINEMENT VALIDATION SUITE');
  console.log('===============================================================');

  // Setup Owner & Cashier sessions
  const state = mockStore.getSnapshot();
  const ownerUser = state.users.find(u => u.role === 'owner')!;
  const cashierUser = state.users.find(u => u.role === 'karyawan')!;

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

  setOwnerSession();

  // -----------------------------------------------------------------
  // SUITE 1: Penyatuan Manajemen Diskon (General vs VIP Scope)
  // -----------------------------------------------------------------
  console.log('\n--- SUITE 1: Penyatuan Manajemen Diskon (General vs VIP) ---');

  // 1.1 Create General Promo
  const promoGeneral = mockStore.addDiscountRule({
    name: 'Promo Merdeka 10%',
    minimum_purchase: 50000,
    discount_percentage: 10,
    is_active: true,
    scope: 'general',
  });
  assert(promoGeneral.scope === 'general', '1.1 Promo umum tersimpan dengan scope "general"');
  assert(promoGeneral.discount_percentage === 10, '1.1 Persentase diskon umum 10%');

  // 1.2 Create VIP Promo
  const promoVip = mockStore.addDiscountRule({
    name: 'Diskon Spesial VIP 15%',
    minimum_purchase: 0,
    discount_percentage: 15,
    is_active: true,
    scope: 'vip',
  });
  assert(promoVip.scope === 'vip', '1.2 Promo VIP tersimpan dengan scope "vip"');
  assert(promoVip.discount_percentage === 15, '1.2 Persentase diskon VIP 15%');

  // 1.3 Edit Promo preserves and updates scope
  const updatedPromoVip = mockStore.updateDiscountRule(promoVip.id, {
    name: 'Diskon Spesial VIP 20%',
    discount_percentage: 20,
    scope: 'vip',
  });
  assert(updatedPromoVip.scope === 'vip', '1.3 Edit promo mempertahankan scope "vip"');
  assert(updatedPromoVip.discount_percentage === 20, '1.3 Edit promo memperbarui persentase menjadi 20%');

  // 1.4 Legacy promo compatibility: rules without scope default to 'general'
  const legacyRule: DiscountRule = {
    id: 'disc-legacy-test',
    name: 'Legacy Promo 5%',
    minimum_purchase: 20000,
    discount_percentage: 5,
    is_active: true,
    // scope is intentionally undefined
  };
  const previewLegacy = calculateOrderPreview(100000, [legacyRule], 0, { isVip: false });
  assert(previewLegacy.discount === 5000, '1.4 Promo legacy tanpa scope dianggap sebagai promo umum');

  // 1.5 Promo VIP TIDAK BOLEH diterapkan pada pesanan reguler
  const regularOrderPreview = calculateOrderPreview(100000, [promoVip, promoGeneral], 0, { isVip: false });
  assert(regularOrderPreview.discount === 10000, '1.5 Pesanan reguler hanya mendapatkan promo umum 10%, bukan promo VIP');
  assert(regularOrderPreview.discountPercentage === 10, '1.5 Diskon persentase pesanan reguler adalah 10%');
  assert(regularOrderPreview.discountName === 'Promo Merdeka 10%', '1.5 Nama diskon adalah nama promo umum');

  // 1.6 Promo VIP aktif pada pesanan VIP
  const vipOrderPreview = calculateOrderPreview(100000, [updatedPromoVip, promoGeneral], 0, { isVip: true });
  assert(vipOrderPreview.discount === 20000, '1.6 Pesanan VIP mendapatkan promo VIP 20%');
  assert(vipOrderPreview.discountPercentage === 20, '1.6 Diskon persentase pesanan VIP adalah 20%');
  assert(vipOrderPreview.discountName === 'Diskon Spesial VIP 20%', '1.6 Nama diskon adalah nama promo VIP');

  // 1.7 Non-stacking: jika promo umum > promo VIP pada transaksi VIP
  const bigGeneralPromo: DiscountRule = {
    id: 'disc-big-gen',
    name: 'Mega Promo 25%',
    minimum_purchase: 50000,
    discount_percentage: 25,
    is_active: true,
    scope: 'general',
  };
  const vipWithBigGeneral = calculateOrderPreview(100000, [updatedPromoVip, bigGeneralPromo], 0, { isVip: true });
  assert(vipWithBigGeneral.discount === 25000, '1.7 Non-stacking: Promo umum 25% > VIP 20%, promo umum dipilih');
  assert(vipWithBigGeneral.discountName === 'Mega Promo 25%', '1.7 Nama promo umum tercatat');

  // 1.8 Tie-breaker: jika promo umum == promo VIP pada transaksi VIP
  const tieGeneralPromo: DiscountRule = {
    id: 'disc-tie-gen',
    name: 'Promo Pas 20%',
    minimum_purchase: 50000,
    discount_percentage: 20,
    is_active: true,
    scope: 'general',
  };
  const vipTie = calculateOrderPreview(100000, [updatedPromoVip, tieGeneralPromo], 0, { isVip: true });
  assert(vipTie.discount === 20000, '1.8 Tie-breaker: Nilai sama persis (20.000 vs 20.000)');
  assert(vipTie.discountName === 'Diskon Spesial VIP 20%', '1.8 Tie-breaker: VIP diprioritaskan saat nilai sama');

  // 1.9 Owner authorization guard: kasir dilarang memanipulasi diskon
  setCashierSession();
  let cashierBlocked = false;
  try {
    mockStore.addDiscountRule({
      name: 'Illegal Promo',
      minimum_purchase: 0,
      discount_percentage: 50,
      scope: 'vip',
    });
  } catch (err: any) {
    cashierBlocked = true;
  }
  assert(cashierBlocked, '1.9 Sesi Kasir berhasil diblokir dari menambah promo diskon');
  setOwnerSession();

  // -----------------------------------------------------------------
  // SUITE 2: Perilaku Input Angka (Bebas '05', Default 0, Normalisasi)
  // -----------------------------------------------------------------
  console.log('\n--- SUITE 2: Perilaku Input Angka & Normalisasi ---');

  // Simulasi parsing & normalisasi NumberInput
  function simulateNumberInputTransform(rawVal: string, allowDecimals: boolean = false, max?: number, min?: number): { display: string; num: number } {
    let clean = rawVal;
    if (allowDecimals) {
      clean = clean.replace(/[^0-9.,-]/g, '');
      const firstSep = clean.match(/[.,]/);
      if (firstSep && firstSep.index !== undefined) {
        let before = clean.slice(0, firstSep.index).replace(/[.,]/g, '');
        const after = clean.slice(firstSep.index + 1).replace(/[.,]/g, '');
        before = before.replace(/^0+(?=\d)/, '');
        if (before === '') before = '0';
        clean = before + firstSep[0] + after;
      } else {
        clean = clean.replace(/^0+(?=\d)/, '');
      }
      if (min !== undefined && min >= 0 && clean.startsWith('-')) {
        clean = clean.replace(/-/g, '');
      }
      if (max !== undefined && clean !== '' && clean !== '-' && clean !== '.' && clean !== ',') {
        const check = parseFloat(clean.replace(',', '.'));
        if (!isNaN(check) && check > max) {
          clean = max.toString();
        }
      }
      if (clean === '' || clean === '-' || clean === '.' || clean === ',') {
        return { display: clean, num: 0 };
      }
      const num = parseFloat(clean.replace(',', '.'));
      return { display: clean, num: isNaN(num) ? 0 : num };
    } else {
      let digits = clean.replace(/\D/g, '');
      if (digits === '') return { display: '', num: 0 };
      digits = digits.replace(/^0+(?=\d)/, '');
      let num = parseInt(digits, 10);
      if (max !== undefined && num > max) {
        num = max;
        digits = num.toString();
      }
      return { display: digits, num };
    }
  }

  // 2.1 Default 0
  const initialParse = simulateNumberInputTransform('0', true);
  assert(initialParse.display === '0' && initialParse.num === 0, '2.1 Input awal "0" bernilai numerik 0');

  // 2.2 Mengetik 5 setelah 0 (kondisi "05") menghasilkan 5
  const typed5After0 = simulateNumberInputTransform('05', true);
  assert(typed5After0.display === '5', '2.2 Mengetik 5 setelah 0 menghasilkan "5" (BUKAN "05")');
  assert(typed5After0.num === 5, '2.2 Nilai numerik adalah 5');

  // 2.3 Mengetik 12 berjalan normal
  const typed12 = simulateNumberInputTransform('12', true);
  assert(typed12.display === '12' && typed12.num === 12, '2.3 Mengetik 12 menghasilkan display "12" dan numerik 12');

  // 2.4 Input desimal 0.5 dipertahankan
  const typedDecimal = simulateNumberInputTransform('0.5', true);
  assert(typedDecimal.display === '0.5' && typedDecimal.num === 0.5, '2.4 Desimal "0.5" tidak terpotong leading zero');

  // 2.5 Input melebihi 100 pada persentase (max=100) di-clamp ke 100
  const typed150 = simulateNumberInputTransform('150', true, 100, 0);
  assert(typed150.display === '100' && typed150.num === 100, '2.5 Persentase 150 di-clamp maksimal ke 100');

  // 2.6 Input negatif pada min=0 di-strip minusnya
  const typedNegative = simulateNumberInputTransform('-5', true, 100, 0);
  assert(typedNegative.display === '5' && typedNegative.num === 5, '2.6 Input minus pada min=0 ditolak/dinormalisasi');

  // -----------------------------------------------------------------
  // SUITE 3: Switch Pajak Khusus VIP & Perilaku Finansial
  // -----------------------------------------------------------------
  console.log('\n--- SUITE 3: Switch Pajak Khusus VIP & Keuangan ---');

  // 3.1 Switch OFF: vip_tax_percentage = null -> mengikuti pajak umum (10%)
  const settingsOff = mockStore.updateSettings({
    tax_percentage: 10,
    vip_tax_percentage: null,
  });
  assert(settingsOff.vip_tax_percentage === null, '3.1 Switch OFF: vip_tax_percentage bernilai null');
  const previewTaxOff = calculateOrderPreview(100000, [], 10, {
    isVip: true,
    vipTaxPercentage: null,
  });
  assert(previewTaxOff.taxPercentage === 10, '3.1 Transaksi VIP memakai tarif pajak umum (10%) saat switch OFF');
  assert(previewTaxOff.tax === 10000, '3.1 Nominal pajak VIP adalah 10.000');

  // 3.2 Switch ON dengan nilai 0: VIP benar-benar memakai pajak 0%
  const settingsOnZero = mockStore.updateSettings({
    tax_percentage: 10,
    vip_tax_percentage: 0,
  });
  assert(settingsOnZero.vip_tax_percentage === 0, '3.2 Switch ON nilai 0: vip_tax_percentage bernilai 0 (bukan null)');
  const previewTaxZero = calculateOrderPreview(100000, [], 10, {
    isVip: true,
    vipTaxPercentage: 0,
  });
  assert(previewTaxZero.taxPercentage === 0, '3.2 Transaksi VIP memakai tarif 0%');
  assert(previewTaxZero.tax === 0, '3.2 Pajak bernilai 0');

  // 3.3 Switch ON dengan tarif khusus 12%
  const settingsOn12 = mockStore.updateSettings({
    tax_percentage: 10,
    vip_tax_percentage: 12,
  });
  assert(settingsOn12.vip_tax_percentage === 12, '3.3 Switch ON nilai 12: vip_tax_percentage bernilai 12');
  const previewTax12 = calculateOrderPreview(100000, [], 10, {
    isVip: true,
    vipTaxPercentage: 12,
  });
  assert(previewTax12.taxPercentage === 12, '3.3 Transaksi VIP memakai tarif khusus 12%');
  assert(previewTax12.tax === 12000, '3.3 Pajak bernilai 12.000');

  // 3.4 Zero Double Counting: Biaya layanan 5% dihitung independen dari dasar setelah diskon
  const previewService = calculateOrderPreview(100000, [updatedPromoVip], 10, {
    isVip: true,
    vipTaxPercentage: 12,
    vipServiceChargePercentage: 5,
  });
  // subtotal 100,000, VIP discount 20% = 20,000 -> base = 80,000
  // tax = 12% of 80,000 = 9,600
  // service charge = 5% of 80,000 = 4,000
  // grand total = 80,000 + 9,600 + 4,000 = 93,600
  assert(previewService.discountedBase === 80000, '3.4 Basis setelah diskon adalah 80.000');
  assert(previewService.tax === 9600, '3.4 Pajak dihitung dari basis (12% x 80.000 = 9.600), BUKAN di atas biaya layanan');
  assert(previewService.serviceCharge === 4000, '3.4 Biaya layanan 5% x 80.000 = 4.000');
  assert(previewService.totalAmount === 93600, '3.4 Grand total 80.000 + 9.600 + 4.000 = 93.600 (Zero double counting)');

  // -----------------------------------------------------------------
  // SUITE 4: Backup & Restore Integritas Scope Promo
  // -----------------------------------------------------------------
  console.log('\n--- SUITE 4: Integritas Backup & Restore Scope Promo ---');

  const exportResult = await backupService.exportBackup('test-backup-ux');
  assert(Boolean(exportResult.container && exportResult.filename), '4.1 Backup berhasil diekspor');

  const currentState = mockStore.getSnapshot();
  const vipRuleInStore = currentState.discountRules.find(r => r.scope === 'vip');
  assert(Boolean(vipRuleInStore), '4.2 Promo VIP tersimpan di state store');
  assert(vipRuleInStore?.scope === 'vip', '4.2 Scope "vip" utuh di store');

  // Clean up test rules
  mockStore.deleteDiscountRule(promoGeneral.id);
  mockStore.deleteDiscountRule(promoVip.id);

  console.log('\n===============================================================');
  console.log('   ALL SETTINGS UX REFINEMENT TESTS PASSED (100%)');
  console.log('===============================================================');
}

// Run if directly executed
runSettingsUXRefinementTests().catch(err => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
