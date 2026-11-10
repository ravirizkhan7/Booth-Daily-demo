/**
 * BOOTH DAILY — LEGACY VIP DISCOUNT DEPRECATION VALIDATION SUITE
 *
 * Memverifikasi bahwa `settings.vip_discount_percentage` TIDAK lagi menjadi sumber diskon
 * transaksi baru dan `discountRules` adalah satu-satunya sumber, serta migrasi legacy satu kali
 * berjalan aman (idempoten, ber-penanda, atomik, kompatibel backup/restore).
 *
 * Seluruh pengujian memakai driver storage memori terisolasi (NodeMemoryStorageDriver / wrapper).
 * Tidak ada data browser/pengguna nyata yang disentuh.
 */

import * as fs from 'fs';
import * as path from 'path';
import { mockStore } from '../store';
import {
  setStorageDriver,
  resetStorageDriver,
  NodeMemoryStorageDriver,
  StorageDriver,
  DEMO_STORAGE_KEY,
} from '../persistence/storage';
import { sessionManager } from '../repositories/sessionManager';
import { calculateOrderPreview } from '../../utils/orderCalculation';
import {
  LEGACY_VIP_DISCOUNT_MIGRATION_RULE_ID,
  LEGACY_VIP_DISCOUNT_MIGRATION_RULE_NAME,
} from '../../utils/legacyVipDiscountMigration';
import { transactionService } from '../../services/transactionService';
import { userService } from '../../services/userService';
import { backupService } from '../../services/backupService';
import { DiscountRule } from '../../types';

let total = 0;
let failed = 0;

function assert(condition: boolean, name: string, detail?: string) {
  total++;
  if (condition) {
    console.log(`  ✓ PASS: ${name}`);
  } else {
    failed++;
    console.error(`  ✗ FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

class FailingWritesDriver implements StorageDriver {
  public failWrites = false;
  constructor(public inner: NodeMemoryStorageDriver) {}
  getItem(key: string) {
    return this.inner.getItem(key);
  }
  setItem(key: string, value: string) {
    if (this.failWrites) {
      const err: any = new Error('QuotaExceededError: simulated');
      err.name = 'QuotaExceededError';
      err.code = 22;
      throw err;
    }
    this.inner.setItem(key, value);
  }
  removeItem(key: string) {
    this.inner.removeItem(key);
  }
  getAllKeys() {
    return this.inner.getAllKeys();
  }
}

const OWNER_ID = 'usr-owner-01';

function setOwner() {
  sessionManager.setSession({ userId: OWNER_ID, token: 'owner-token', loggedInAt: new Date().toISOString() });
}
function setCashier() {
  const cashier = mockStore.getSnapshot().users.find(u => u.role === 'karyawan')!;
  sessionManager.setSession({ userId: cashier.id, token: 'cashier-token', loggedInAt: new Date().toISOString() });
  return cashier;
}

const vipRule = (id: string, pct: number, min = 0, active = true): DiscountRule => ({
  id,
  name: `Promo VIP ${pct}%`,
  minimum_purchase: min,
  discount_percentage: pct,
  is_active: active,
  scope: 'vip',
});
const generalRule = (id: string, pct: number, min = 0): DiscountRule => ({
  id,
  name: `Promo Umum ${pct}%`,
  minimum_purchase: min,
  discount_percentage: pct,
  is_active: true,
  scope: 'general',
});

interface LoadOpts {
  legacy?: number | null | undefined;
  marker?: boolean | undefined;
  rules: DiscountRule[];
  driver?: StorageDriver;
}

/** Menanam snapshot legacy ke storage terisolasi lalu memuat store dari storage (jalur startup/reload). */
function loadFromStorage(opts: LoadOpts): { storage: StorageDriver; info: ReturnType<typeof mockStore.reinitializeFromStorage> } {
  const base = new NodeMemoryStorageDriver();
  setStorageDriver(base);
  mockStore.resetMockStore();
  const snap = mockStore.getSnapshot();
  snap.discountRules = JSON.parse(JSON.stringify(opts.rules));
  if (opts.legacy === undefined) delete (snap.settings as any).vip_discount_percentage;
  else (snap.settings as any).vip_discount_percentage = opts.legacy;
  if (opts.marker === undefined) delete (snap.settings as any).vip_discount_legacy_migrated;
  else snap.settings.vip_discount_legacy_migrated = opts.marker;
  base.setItem(DEMO_STORAGE_KEY, JSON.stringify(snap));
  const storage = opts.driver ? (opts.driver as FailingWritesDriver) : base;
  if (opts.driver) {
    (opts.driver as FailingWritesDriver).inner = base;
  }
  setStorageDriver(storage);
  const info = mockStore.reinitializeFromStorage();
  return { storage, info };
}

const vipRulesOf = () => mockStore.getDiscountRules().filter(r => r.scope === 'vip');
const rawDisk = (storage: StorageDriver) => JSON.parse(storage.getItem(DEMO_STORAGE_KEY) || '{}');

let shiftReady = false;
async function placeOrder(isVip: boolean, price = 100000) {
  const cashier = setCashier();
  if (!mockStore.getActiveShift()) {
    mockStore.openShift({ cash_initial: 200000, user: cashier });
  }
  const product = mockStore.getProducts()[0];
  shiftReady = true;
  return transactionService.processTransaction({
    order_type: 'dine_in',
    order_area: isVip ? 'vip' : 'regular',
    is_vip: isVip,
    items: [{ product_id: product.id, product_name: product.name, price, qty: 1 }],
    payment_method: 'cash',
    amount_paid: 1000000,
    user: cashier,
  });
}

async function run() {
  console.log('===============================================================');
  console.log('   BOOTH DAILY — LEGACY VIP DISCOUNT DEPRECATION VALIDATION');
  console.log('===============================================================');

  // ------------------------------------------------------------------
  // A. KALKULASI TRANSAKSI BARU
  // ------------------------------------------------------------------
  console.log('\n--- A. Kalkulasi Transaksi Baru (hanya discountRules) ---');

  // A1. Legacy VIP 10% (setting), tanpa promo VIP -> end-to-end via transactionService
  loadFromStorage({ legacy: 10, marker: true, rules: [] });
  setOwner();
  const a1 = await placeOrder(true);
  assert(a1.discount === 0, 'A1 Legacy VIP 10% tanpa promo VIP: diskon order VIP = Rp0', `discount=${a1.discount}`);
  assert(a1.discount_name == null, 'A1 discount_name kosong (tidak ada nama "Diskon Ruang VIP")', String(a1.discount_name));
  assert(mockStore.getSettings().vip_discount_percentage === 10, 'A1 Field legacy tetap tersimpan 10 (hanya tidak dipakai kalkulasi)');

  // A2. Legacy 10% + promo VIP 15% aktif -> hanya promo VIP
  loadFromStorage({ legacy: 10, marker: true, rules: [vipRule('vip-15', 15)] });
  const a2 = await placeOrder(true);
  assert(a2.discount === 15000, 'A2 Legacy 10% + promo VIP 15%: diskon = 15.000 (bukan 10.000 / 25.000)', `discount=${a2.discount}`);
  assert(a2.discount_name === 'Promo VIP 15%', 'A2 discount_name = nama promo VIP');

  // A3. Promo VIP min 100.000, transaksi 50.000 -> Rp0
  const a3 = calculateOrderPreview(50000, [vipRule('vip-min', 20, 100000)], 0, { isVip: true });
  assert(a3.discount === 0 && a3.discountName === null, 'A3 Promo VIP min Rp100.000, transaksi Rp50.000: diskon Rp0');
  const a3b = calculateOrderPreview(100000, [vipRule('vip-min', 20, 100000)], 0, { isVip: true });
  assert(a3b.discount === 20000, 'A3 Promo VIP min Rp100.000, transaksi Rp100.000: diskon 20.000 (memenuhi syarat)');

  // A4. Tidak ada promo VIP -> diskon VIP Rp0 (tanpa fallback apa pun)
  const a4 = calculateOrderPreview(100000, [], 10, { isVip: true });
  assert(a4.discount === 0 && a4.discountName === null && a4.discountPercentage === 0, 'A4 Tanpa promo VIP: diskon VIP Rp0');
  assert(a4.bestPromo === null, 'A4 bestPromo null');

  // A5. Promo umum tetap bekerja
  const a5r = calculateOrderPreview(100000, [generalRule('g-10', 10)], 0, { isVip: false });
  const a5v = calculateOrderPreview(100000, [generalRule('g-10', 10)], 0, { isVip: true });
  assert(a5r.discount === 10000 && a5v.discount === 10000, 'A5 Promo umum 10% berlaku pada order reguler dan VIP');
  const a5min = calculateOrderPreview(40000, [generalRule('g-min', 10, 50000)], 0, { isVip: false });
  assert(a5min.discount === 0, 'A5 Promo umum menghormati minimum belanja');
  const legacyNoScope: DiscountRule = { id: 'legacy-noscope', name: 'Legacy', minimum_purchase: 0, discount_percentage: 5, is_active: true };
  assert(calculateOrderPreview(100000, [legacyNoScope], 0, { isVip: true }).discount === 5000, 'A5 Rule tanpa scope tetap dianggap promo umum');

  // A6. Order umum tidak dapat memakai promo VIP
  const a6 = calculateOrderPreview(100000, [vipRule('vip-30', 30)], 0, { isVip: false });
  assert(a6.discount === 0, 'A6 Order reguler tidak dapat memakai promo VIP 30%');

  // A7. VIP membandingkan promo umum & VIP
  const a7a = calculateOrderPreview(100000, [generalRule('g-25', 25), vipRule('vip-20', 20)], 0, { isVip: true });
  assert(a7a.discount === 25000 && a7a.discountName === 'Promo Umum 25%', 'A7 Umum 25% > VIP 20%: promo umum dipilih');
  const a7b = calculateOrderPreview(100000, [generalRule('g-10', 10), vipRule('vip-20', 20)], 0, { isVip: true });
  assert(a7b.discount === 20000 && a7b.discountName === 'Promo VIP 20%', 'A7 VIP 20% > Umum 10%: promo VIP dipilih');

  // A8. Nominal seri -> VIP menang
  const a8 = calculateOrderPreview(100000, [generalRule('g-15', 15), vipRule('vip-15', 15)], 0, { isVip: true });
  assert(a8.discount === 15000 && a8.discountName === 'Promo VIP 15%', 'A8 Nominal seri: tie-breaker memenangkan VIP');

  // A9. Tidak pernah bertumpuk
  const a9 = calculateOrderPreview(100000, [generalRule('g-10', 10), vipRule('vip-15', 15)], 0, { isVip: true });
  assert(a9.discount === 15000, 'A9 Diskon = max(10.000, 15.000) = 15.000, bukan 25.000');
  assert(a9.discountedBase === 85000, 'A9 Basis setelah diskon = 85.000');

  // ------------------------------------------------------------------
  // B. MIGRASI LEGACY
  // ------------------------------------------------------------------
  console.log('\n--- B. Migrasi Legacy ---');

  // B10/11. Legacy 10% tanpa aturan VIP -> 1 promo migrasi, min 0 (tanpa sesi login: startup)
  sessionManager.clearSession();
  const b10 = loadFromStorage({ legacy: 10, marker: undefined, rules: [generalRule('g-keep', 5, 20000)] });
  const migrated = vipRulesOf();
  assert(b10.info.status === 'SUCCESS', 'B10 Snapshot legacy termuat (SUCCESS) tanpa sesi login');
  assert(migrated.length === 1 && migrated[0].id === LEGACY_VIP_DISCOUNT_MIGRATION_RULE_ID, 'B10 Tepat 1 promo VIP migrasi dengan ID deterministik');
  assert(migrated[0].name === LEGACY_VIP_DISCOUNT_MIGRATION_RULE_NAME, 'B10 Nama promo migrasi jelas', migrated[0].name);
  assert(migrated[0].discount_percentage === 10 && migrated[0].is_active === true, 'B10 Persentase 10% & aktif');
  assert(migrated[0].minimum_purchase === 0, 'B11 minimum_purchase promo migrasi = 0');
  assert(mockStore.getDiscountRules().some(r => r.id === 'g-keep'), 'B10 Promo umum yang ada tidak diubah');
  assert(mockStore.getSettings().vip_discount_legacy_migrated === true, 'B10 Penanda migrasi = true');
  assert(b10.info.hasPendingMigration === false, 'B10 Migrasi sudah dipersist (tidak pending)');
  const disk10 = rawDisk(b10.storage);
  assert(
    disk10.settings.vip_discount_legacy_migrated === true &&
      disk10.discountRules.filter((r: DiscountRule) => r.scope === 'vip').length === 1,
    'B10 Disk memuat penanda + 1 promo migrasi'
  );
  const b10order = calculateOrderPreview(100000, mockStore.getDiscountRules(), 0, { isVip: true });
  assert(b10order.discount === 10000, 'B10 Perilaku lama terjaga: order VIP tanpa minimum belanja tetap diskon 10%');

  // B12. Reload berulang
  for (let i = 0; i < 3; i++) mockStore.reinitializeFromStorage();
  assert(vipRulesOf().length === 1, 'B12 Reload berulang (3x) tidak menciptakan duplikasi');

  // B14. Sudah ada aturan VIP aktif
  const existingActive = vipRule('vip-existing', 12, 30000, true);
  loadFromStorage({ legacy: 10, marker: undefined, rules: [existingActive] });
  const b14 = vipRulesOf();
  assert(b14.length === 1 && b14[0].id === 'vip-existing', 'B14 Aturan VIP aktif sudah ada: tidak membuat promo migrasi');
  assert(
    b14[0].discount_percentage === 12 && b14[0].minimum_purchase === 30000 && b14[0].is_active === true && b14[0].name === 'Promo VIP 12%',
    'B14 Aturan VIP yang ada tidak berubah (persen/min/nama/status)'
  );
  assert(mockStore.getSettings().vip_discount_legacy_migrated === true, 'B14 Penanda ditandai sudah ditangani');
  assert(
    calculateOrderPreview(20000, mockStore.getDiscountRules(), 0, { isVip: true }).discount === 0,
    'B14 Legacy 10% tidak memengaruhi transaksi di bawah minimum promo VIP'
  );

  // B15. Aturan VIP nonaktif
  loadFromStorage({ legacy: 10, marker: undefined, rules: [vipRule('vip-off', 12, 0, false)] });
  const b15 = vipRulesOf();
  assert(b15.length === 1 && b15[0].id === 'vip-off' && b15[0].is_active === false, 'B15 Aturan VIP nonaktif tidak dihidupkan & tidak ada promo migrasi tambahan');
  assert(
    calculateOrderPreview(100000, mockStore.getDiscountRules(), 0, { isVip: true }).discount === 0,
    'B15 Semua promo VIP nonaktif: tidak ada diskon VIP (legacy tidak dibangkitkan)'
  );
  mockStore.reinitializeFromStorage();
  assert(vipRulesOf().length === 1, 'B15 Reload tidak membangkitkan diskon legacy');

  // B16. Owner menghapus promo migrasi -> reload tidak membangkitkan kembali
  loadFromStorage({ legacy: 10, marker: undefined, rules: [] });
  assert(vipRulesOf().length === 1, 'B16 (prasyarat) promo migrasi terbentuk');
  setOwner();
  const deleted = mockStore.deleteDiscountRule(LEGACY_VIP_DISCOUNT_MIGRATION_RULE_ID);
  assert(deleted === true && vipRulesOf().length === 0, 'B16 Owner menghapus promo migrasi');
  mockStore.reinitializeFromStorage();
  assert(vipRulesOf().length === 0, 'B16 Reload tidak membangkitkan kembali promo yang dihapus Owner');
  assert(
    calculateOrderPreview(100000, mockStore.getDiscountRules(), 0, { isVip: true }).discount === 0,
    'B16 Order VIP setelah dihapus: diskon Rp0'
  );
  // Nonaktif oleh Owner juga tidak dihidupkan
  loadFromStorage({ legacy: 10, marker: undefined, rules: [] });
  setOwner();
  mockStore.toggleActiveDiscountRule(LEGACY_VIP_DISCOUNT_MIGRATION_RULE_ID);
  mockStore.reinitializeFromStorage();
  const toggled = vipRulesOf();
  assert(toggled.length === 1 && toggled[0].is_active === false, 'B16 Promo migrasi yang dinonaktifkan Owner tetap nonaktif setelah reload');

  // B17. Legacy 0 / null / undefined -> tanpa promo otomatis
  for (const [label, legacy] of [['0', 0], ['null', null], ['undefined', undefined]] as const) {
    loadFromStorage({ legacy: legacy as any, marker: undefined, rules: [] });
    assert(vipRulesOf().length === 0, `B17 Legacy ${label}: tidak menghasilkan promo otomatis`);
    assert(mockStore.getSettings().vip_discount_legacy_migrated === true, `B17 Legacy ${label}: ditandai sudah ditangani`);
    assert(
      calculateOrderPreview(100000, mockStore.getDiscountRules(), 0, { isVip: true }).discount === 0,
      `B17 Legacy ${label}: tidak ada diskon VIP tersembunyi`
    );
  }

  // B18. Kegagalan persistensi -> tidak ada perubahan parsial
  const failing = new FailingWritesDriver(new NodeMemoryStorageDriver());
  const legacySnapRules: DiscountRule[] = [generalRule('g-keep', 5, 20000)];
  // Siapkan disk legacy memakai driver normal terlebih dahulu, lalu aktifkan kegagalan tulis sebelum reload.
  const prep = loadFromStorage({ legacy: 10, marker: undefined, rules: legacySnapRules, driver: failing });
  // loadFromStorage sudah memuat dengan failWrites=false (migrasi berhasil). Ulangi dengan disk legacy murni:
  const legacyDisk = JSON.stringify({
    ...JSON.parse(prep.storage.getItem(DEMO_STORAGE_KEY)!),
    discountRules: JSON.parse(JSON.stringify(legacySnapRules)),
    settings: (() => {
      const s = { ...JSON.parse(prep.storage.getItem(DEMO_STORAGE_KEY)!).settings };
      delete s.vip_discount_legacy_migrated;
      s.vip_discount_percentage = 10;
      return s;
    })(),
  });
  failing.inner.setItem(DEMO_STORAGE_KEY, legacyDisk);
  failing.failWrites = true;
  const b18 = mockStore.reinitializeFromStorage();
  assert(b18.hasPendingMigration === true, 'B18 Persist gagal: status migrasi tetap pending');
  assert(failing.inner.getItem(DEMO_STORAGE_KEY) === legacyDisk, 'B18 Disk tetap utuh persis (tanpa penanda/promo parsial)');
  setOwner();
  let blocked = false;
  try {
    mockStore.addDiscountRule({ name: 'Tidak Boleh Masuk', minimum_purchase: 0, discount_percentage: 5, scope: 'general' });
  } catch (err: any) {
    blocked = String(err?.message || '').includes('DataIntegrityError');
  }
  assert(blocked, 'B18 Mutasi ditolak (DataIntegrityError) selama migrasi belum dapat dipersist');
  assert(failing.inner.getItem(DEMO_STORAGE_KEY) === legacyDisk, 'B18 Disk tetap utuh setelah mutasi ditolak');
  failing.failWrites = false;
  mockStore.reinitializeFromStorage();
  assert(vipRulesOf().length === 1 && vipRulesOf()[0].id === LEGACY_VIP_DISCOUNT_MIGRATION_RULE_ID, 'B18 Setelah storage pulih: tepat 1 promo migrasi (tanpa duplikasi)');
  assert(rawDisk(failing).settings.vip_discount_legacy_migrated === true, 'B18 Setelah pulih: penanda tersimpan di disk');

  // B18b. restoreSnapshot gagal persist -> rollback RAM
  const failing2 = new FailingWritesDriver(new NodeMemoryStorageDriver());
  loadFromStorage({ legacy: 0, marker: true, rules: [], driver: failing2 });
  setOwner();
  const legacyState = mockStore.getSnapshot();
  delete (legacyState.settings as any).vip_discount_legacy_migrated;
  legacyState.settings.vip_discount_percentage = 10;
  legacyState.discountRules = [];
  failing2.failWrites = true;
  let restoreThrew = false;
  try {
    mockStore.restoreSnapshot(legacyState);
  } catch {
    restoreThrew = true;
  }
  failing2.failWrites = false;
  assert(restoreThrew, 'B18 restoreSnapshot gagal persist melempar error');
  assert(vipRulesOf().length === 0 && mockStore.getSettings().vip_discount_percentage === 0, 'B18 RAM di-rollback: tidak ada promo migrasi parsial & setting lama utuh');

  // ------------------------------------------------------------------
  // C. HISTORI, BACKUP & KEAMANAN
  // ------------------------------------------------------------------
  console.log('\n--- C. Histori, Backup & Otorisasi ---');

  // C19. Transaksi historis tidak berubah akibat migrasi
  const seedStorage = new NodeMemoryStorageDriver();
  setStorageDriver(seedStorage);
  mockStore.resetMockStore();
  const seedOrders = mockStore.getOrders();
  const pick = (os: ReturnType<typeof mockStore.getOrders>) =>
    JSON.stringify(
      os
        .map(o => [o.id, o.subtotal, o.discount, o.discount_name ?? null, o.tax, o.tax_percentage ?? null, o.service_charge ?? null, o.total_amount])
        .sort((a, b) => String(a[0]).localeCompare(String(b[0])))
    );
  const before = pick(seedOrders);
  // Sisipkan satu order VIP historis berdiskon legacy untuk memastikan nama snapshot lama tidak disentuh
  const histSnap = mockStore.getSnapshot();
  if (histSnap.orders.length > 0) {
    histSnap.orders[0].discount = 777;
    histSnap.orders[0].discount_name = 'Diskon Ruang VIP (10%)';
  }
  delete (histSnap.settings as any).vip_discount_legacy_migrated;
  histSnap.settings.vip_discount_percentage = 10;
  histSnap.discountRules = [];
  const histBefore = pick(histSnap.orders);
  seedStorage.setItem(DEMO_STORAGE_KEY, JSON.stringify(histSnap));
  mockStore.reinitializeFromStorage();
  assert(vipRulesOf().length === 1, 'C19 (prasyarat) migrasi terjadi pada snapshot dengan histori');
  assert(pick(mockStore.getOrders()) === histBefore, 'C19 Seluruh nominal & discount_name order historis tidak berubah setelah migrasi');
  assert(histBefore !== before || seedOrders.length === 0, 'C19 Fixture historis memuat snapshot diskon legacy (777 / nama lama)');

  // C20/21. Backup legacy nonzero dapat dibaca & dipulihkan; backup sesudah migrasi utuh
  const bkStorage = new NodeMemoryStorageDriver();
  setStorageDriver(bkStorage);
  mockStore.resetMockStore();
  await userService.login('owner@boothdaily.com', 'demo123');
  const legacyBackupState = mockStore.getSnapshot();
  delete (legacyBackupState.settings as any).vip_discount_legacy_migrated;
  legacyBackupState.settings.vip_discount_percentage = 10;
  legacyBackupState.discountRules = [generalRule('g-bk', 8, 10000)];
  mockStore.restoreSnapshot(legacyBackupState, true); // bypass: menyiapkan fixture legacy murni
  assert(mockStore.getSettings().vip_discount_legacy_migrated === undefined, 'C20 (prasyarat) fixture legacy murni tanpa penanda');
  const pwd = 'RahasiaSuperKuat2026!';
  const { container: legacyContainer } = await backupService.exportBackup(pwd);
  const preview = await backupService.previewBackup(legacyContainer, pwd);
  assert(preview.products_count > 0, 'C20 Backup lama dengan field legacy nonzero tetap dapat dibaca (preview)');

  mockStore.resetMockStore();
  await userService.login('owner@boothdaily.com', 'demo123');
  const rr = await backupService.restoreBackup(legacyContainer, pwd, '1234');
  assert(rr.success === true, 'C20 Restore backup legacy berhasil');
  let afterRestore = vipRulesOf();
  assert(afterRestore.length === 1 && afterRestore[0].id === LEGACY_VIP_DISCOUNT_MIGRATION_RULE_ID, 'B13 Restore backup legacy menghasilkan tepat 1 promo migrasi');
  assert(afterRestore[0].minimum_purchase === 0 && afterRestore[0].discount_percentage === 10, 'B13 Promo migrasi dari restore: 10% & min 0');
  assert(mockStore.getDiscountRules().some(r => r.id === 'g-bk'), 'B13 Promo umum dari backup ikut pulih');
  mockStore.reinitializeFromStorage();
  assert(vipRulesOf().length === 1, 'B13 Reload setelah restore tidak menciptakan duplikasi');
  await userService.login('owner@boothdaily.com', 'demo123');
  await backupService.restoreBackup(legacyContainer, pwd, '1234');
  assert(vipRulesOf().length === 1, 'B13 Restore ulang backup legacy yang sama tidak menciptakan duplikasi');

  // C21. Backup sesudah migrasi memuat seluruh promo utuh dan tidak memigrasi ulang
  setOwner();
  mockStore.addDiscountRule({ name: 'Promo VIP Baru', minimum_purchase: 50000, discount_percentage: 18, scope: 'vip' });
  mockStore.deleteDiscountRule(LEGACY_VIP_DISCOUNT_MIGRATION_RULE_ID); // Owner menghapus promo migrasi
  const expectedRules = JSON.stringify(mockStore.getDiscountRules());
  const { container: postContainer } = await backupService.exportBackup(pwd);
  mockStore.resetMockStore();
  await userService.login('owner@boothdaily.com', 'demo123');
  await backupService.restoreBackup(postContainer, pwd, '1234');
  assert(JSON.stringify(mockStore.getDiscountRules()) === expectedRules, 'C21 Backup sesudah migrasi memuat seluruh promo utuh (termasuk scope) dan tidak membangkitkan promo yang dihapus');
  assert(mockStore.getSettings().vip_discount_legacy_migrated === true, 'C21 Penanda migrasi ikut tersimpan di backup (metadata settings.vip_discount_legacy_migrated)');

  // C22. Perubahan Settings legacy tidak memengaruhi checkout
  loadFromStorage({ legacy: 0, marker: true, rules: [] });
  setOwner();
  mockStore.updateSettings({ vip_discount_percentage: 50 });
  const c22 = await placeOrder(true);
  assert(c22.discount === 0, 'C22 Mengubah vip_discount_percentage ke 50 tidak memberi diskon pada checkout VIP', `discount=${c22.discount}`);
  setOwner();
  mockStore.updateSettings({ vip_discount_legacy_migrated: false });
  assert(mockStore.getSettings().vip_discount_legacy_migrated === true, 'C22 Penanda migrasi tidak dapat di-reset melalui updateSettings');
  mockStore.reinitializeFromStorage();
  assert(vipRulesOf().length === 0, 'C22 Reload setelah perubahan legacy tidak membuat promo migrasi');

  // C23. Otorisasi Owner pada CRUD promo
  loadFromStorage({ legacy: 0, marker: true, rules: [generalRule('g-auth', 5)] });
  const countBefore = mockStore.getDiscountRules().length;
  setCashier();
  const attempts: Array<() => unknown> = [
    () => mockStore.addDiscountRule({ name: 'X', minimum_purchase: 0, discount_percentage: 5, scope: 'vip' }),
    () => mockStore.updateDiscountRule('g-auth', { discount_percentage: 99 }),
    () => mockStore.toggleActiveDiscountRule('g-auth'),
    () => mockStore.deleteDiscountRule('g-auth'),
  ];
  let allBlocked = true;
  for (const attempt of attempts) {
    try {
      attempt();
      allBlocked = false;
    } catch {
      /* expected */
    }
  }
  const authRule = mockStore.getDiscountRules().find(r => r.id === 'g-auth');
  assert(
    allBlocked && mockStore.getDiscountRules().length === countBefore && authRule?.discount_percentage === 5 && authRule?.is_active === true,
    'C23 Sesi Kasir ditolak pada add/update/toggle/delete promo tanpa mutasi'
  );
  sessionManager.clearSession();
  let noSessionBlocked = false;
  try {
    mockStore.addDiscountRule({ name: 'X', minimum_purchase: 0, discount_percentage: 5 });
  } catch {
    noSessionBlocked = true;
  }
  assert(noSessionBlocked, 'C23 Tanpa sesi ditolak');

  // C24. Bukti statis: jalur kalkulasi tidak membaca field legacy
  const root = path.resolve(process.cwd(), 'src');
  const calcFiles = [
    'utils/orderCalculation.ts',
    'services/transactionService.ts',
    'components/pos/CartSidebar.tsx',
    'components/common/PINModal.tsx',
  ];
  for (const rel of calcFiles) {
    const src = fs.readFileSync(path.join(root, rel), 'utf8');
    assert(
      !/vip_discount_percentage|vipDiscountPercentage/.test(src),
      `C24 ${rel} tidak membaca vip_discount_percentage / vipDiscountPercentage`
    );
  }

  resetStorageDriver();
  console.log('\n===============================================================');
  if (failed > 0) {
    console.error(`   LEGACY VIP DISCOUNT VALIDATION: ${total - failed}/${total} PASSED, ${failed} FAILED`);
    console.log('===============================================================');
    process.exit(1);
  }
  console.log(`   LEGACY VIP DISCOUNT VALIDATION: ${total}/${total} ASSERTIONS PASSED (0 FAILED)`);
  console.log('===============================================================');
}

run().catch(err => {
  console.error('❌ Unhandled error in legacy VIP discount validation:', err);
  process.exit(1);
});
