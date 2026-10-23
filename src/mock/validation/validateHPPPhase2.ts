/**
 * BOOTH DAILY — HPP PHASE 2 VALIDATION SUITE
 * Weighted Average Cost (WAC) & Purchase Integrity
 *
 * 20 Skenario Pengujian Komprehensif:
 *  1. Pembelian perdana ketika stok nol.
 *  2. WAC pembelian berbobot sama.
 *  3. WAC pembelian dengan bobot berbeda.
 *  4. Presisi desimal tetap dipertahankan.
 *  5. Penolakan pembelian ketika stok awal negatif.
 *  6. Penolakan harga atau kuantitas tidak valid.
 *  7. Konversi unit kemasan yang valid.
 *  8. Penolakan konversi atau faktor yang tidak valid.
 *  9. Nota multi-item dengan bahan berbeda.
 * 10. Nota dengan beberapa baris untuk stock_id yang sama.
 * 11. Satu item tidak valid: seluruh nota batal tanpa perubahan parsial.
 * 12. Kegagalan persistensi: state RAM dipulihkan dan persistensi konsisten.
 * 13. updatePurchase rincian item ditolak tanpa mutasi.
 * 14. deletePurchase ditolak tanpa mutasi.
 * 15. Edit header hanya jika kebijakan mengizinkannya; pastikan WAC dan stok tidak berubah.
 * 16. adjustStock tidak mengubah WAC.
 * 17. Penjualan tidak mengubah WAC per unit.
 * 18. Snapshot HPP transaksi lama tetap tidak berubah setelah pembelian baru.
 * 19. Penanganan duplikasi ID/referensi item jika relevan dengan model aktual.
 * 20. Regresi untuk tes lama yang mengharapkan latest-cost overwrite.
 *
 * CATATAN KEAMANAN:
 * Menggunakan isolated memory storage driver (IsolatedMemoryStorage).
 * Tidak memodifikasi storage nyata atau data pengguna.
 */

import { MockStore } from '../store';
import { setStorageDriver, StorageDriver } from '../persistence/storage';
import { sessionManager } from '../repositories/sessionManager';
import { Purchase, PurchaseItem, Stock } from '../../types';

class IsolatedMemoryStorage implements StorageDriver {
  public store: Record<string, string> = {};
  public shouldFailSetItem = false;

  getItem(key: string): string | null {
    return this.store[key] !== undefined ? this.store[key] : null;
  }

  setItem(key: string, value: string): void {
    if (this.shouldFailSetItem) {
      const err = new Error('QuotaExceededError: Simulated storage full / disk quota exceeded');
      err.name = 'QuotaExceededError';
      (err as any).code = 22;
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

  clear(): void {
    this.store = {};
    this.shouldFailSetItem = false;
  }
}

interface TestReport {
  id: number;
  name: string;
  passed: boolean;
  error?: string;
}

const reports: TestReport[] = [];

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertApprox(actual: number, expected: number, epsilon = 1e-9, msg?: string) {
  const diff = Math.abs(actual - expected);
  if (diff > epsilon) {
    throw new Error(
      `${msg || 'Nilai tidak sesuai'}. Diharapkan: ${expected}, Aktual: ${actual}, Selisih: ${diff}`
    );
  }
}

function snapshotRelevantState(store: MockStore) {
  return {
    stocks: store.getStocks(),
    purchases: store.getPurchases(),
    stockHistories: store.getStockHistories(),
    orders: store.getOrders(),
  };
}

function assertZeroMutation(before: ReturnType<typeof snapshotRelevantState>, after: ReturnType<typeof snapshotRelevantState>, context: string) {
  assert(
    JSON.stringify(before.stocks) === JSON.stringify(after.stocks),
    `[Zero-Mutation ${context}] Stok termutasi padahal operasi harus dibatalkan.`
  );
  assert(
    JSON.stringify(before.purchases) === JSON.stringify(after.purchases),
    `[Zero-Mutation ${context}] Nota pembelian termutasi padahal operasi harus dibatalkan.`
  );
  assert(
    JSON.stringify(before.stockHistories) === JSON.stringify(after.stockHistories),
    `[Zero-Mutation ${context}] Riwayat mutasi stok berubah padahal operasi harus dibatalkan.`
  );
  assert(
    JSON.stringify(before.orders) === JSON.stringify(after.orders),
    `[Zero-Mutation ${context}] Snapshot pesanan berubah padahal operasi harus dibatalkan.`
  );
}

function makePurchasePayload(data: {
  purchase_number: string;
  supplier: string;
  date?: string;
  notes?: string;
  items: Array<{
    id?: string;
    stock_id: string;
    stock_name?: string;
    qty?: number;
    unit?: string;
    unit_cost?: number;
    total_cost?: number;
    package_qty?: number;
    package_unit?: string;
    conversion_ratio?: number;
    package_price?: number;
  }>;
}): Omit<Purchase, 'id'> {
  const processed: PurchaseItem[] = data.items.map((it, idx) => ({
    id: it.id || `item-gen-${idx + 1}`,
    stock_id: it.stock_id,
    stock_name: it.stock_name || 'Bahan Test',
    qty: it.qty ?? 0,
    unit: it.unit || 'Gram',
    unit_cost: it.unit_cost ?? 0,
    total_cost: it.total_cost !== undefined ? it.total_cost : (it.qty ?? 0) * (it.unit_cost ?? 0),
    package_qty: it.package_qty,
    package_unit: it.package_unit,
    conversion_ratio: it.conversion_ratio,
    package_price: it.package_price,
  }));
  const total = processed.reduce((sum, it) => sum + (it.total_cost || 0), 0);
  return {
    purchase_number: data.purchase_number,
    supplier: data.supplier,
    date: data.date || '2026-10-22',
    total_amount: total,
    created_at: new Date().toISOString(),
    notes: data.notes,
    items: processed,
  };
}

async function runScenario(id: number, name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    reports.push({ id, name, passed: true });
    console.log(`  ✓ [PASS] S${String(id).padStart(2, '0')}: ${name}`);
  } catch (err: any) {
    reports.push({ id, name, passed: false, error: err?.message || String(err) });
    console.error(`  ✗ [FAIL] S${String(id).padStart(2, '0')}: ${name}`);
    console.error(`     Error: ${err?.message || err}`);
  }
}

export async function runHPPPhase2Validation() {
  console.log('================================================================');
  console.log('   BOOTH DAILY — HPP PHASE 2: WAC & PURCHASE INTEGRITY SUITE    ');
  console.log('   Target: 20 Skenario Pengujian Terverifikasi                 ');
  console.log('================================================================\n');

  const memoryDriver = new IsolatedMemoryStorage();
  setStorageDriver(memoryDriver);

  // Set active Owner session (Hendro Wijaya, usr-owner-01) for managerial operations
  const setOwnerSession = () => {
    sessionManager.setSession({
      userId: 'usr-owner-01',
      token: 'test_token_phase2',
      loggedInAt: new Date().toISOString(),
    });
  };
  setOwnerSession();

  // Helper untuk membuat store pengujian baru yang bersih dan terisolasi
  function createCleanStore(): MockStore {
    memoryDriver.clear();
    const store = new MockStore();
    setOwnerSession();
    return store;
  }

  // Helper membuat dummy stock baru untuk uji WAC yang bersih
  function createTestStock(store: MockStore, name: string, unit: string, initialQty: number, initialCost: number): Stock {
    setOwnerSession();
    return store.addStock({
      id: `stk-test-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      name,
      unit,
      current_amount: initialQty,
      min_amount: 10,
      cost_per_unit: initialCost,
      baseline_cost_per_unit: initialCost > 0 ? initialCost : undefined,
      baseline_source: initialCost > 0 ? 'owner_confirmed' : undefined,
    });
  }

  // --- Skenario 1 ---
  await runScenario(1, 'Pembelian perdana ketika stok nol menghasilkan WAC = harga satuan pembelian baru', () => {
    const store = createCleanStore();
    const stock = createTestStock(store, 'Bubuk Matcha Murni', 'Gram', 0, 0);

    const purchase = store.addPurchase(
      makePurchasePayload({
        purchase_number: 'PO-PH2-001',
        supplier: 'Supplier Matcha Kyoto',
        date: '2026-10-22',
        items: [
          {
            id: 'item-m-1',
            stock_id: stock.id,
            stock_name: stock.name,
            qty: 500,
            unit: 'Gram',
            unit_cost: 250,
            total_cost: 125000,
          },
        ],
      })
    );

    const updatedStock = store.getStocks().find(s => s.id === stock.id)!;
    assert(updatedStock.current_amount === 500, `Stok harus 500, didapat: ${updatedStock.current_amount}`);
    assert(updatedStock.cost_per_unit === 250, `WAC harus 250, didapat: ${updatedStock.cost_per_unit}`);
    assert(purchase.total_amount === 125000, 'Total nota harus Rp125.000');
  });

  // --- Skenario 2 ---
  await runScenario(2, 'WAC pembelian berbobot sama (10 unit @1000 + 10 unit @2000 -> WAC 1500)', () => {
    const store = createCleanStore();
    const stock = createTestStock(store, 'Biji Kopi Arabika Test', 'Gram', 10, 1000);

    store.addPurchase(
      makePurchasePayload({
        purchase_number: 'PO-PH2-002',
        supplier: 'Supplier Kopi Roastery',
        date: '2026-10-22',
        items: [
          {
            stock_id: stock.id,
            stock_name: stock.name,
            qty: 10,
            unit: 'Gram',
            unit_cost: 2000,
            total_cost: 20000,
          },
        ],
      })
    );

    const updatedStock = store.getStocks().find(s => s.id === stock.id)!;
    assert(updatedStock.current_amount === 20, `Stok akhir harus 20, didapat: ${updatedStock.current_amount}`);
    assert(updatedStock.cost_per_unit === 1500, `WAC harus 1500, didapat: ${updatedStock.cost_per_unit}`);
  });

  // --- Skenario 3 ---
  await runScenario(3, 'WAC pembelian berbobot berbeda (20 unit @1000 + 10 unit @2500 -> WAC 1500)', () => {
    const store = createCleanStore();
    const stock = createTestStock(store, 'Sirup Hazelnut Test', 'ml', 20, 1000);

    store.addPurchase(
      makePurchasePayload({
        purchase_number: 'PO-PH2-003',
        supplier: 'Supplier Sirup Premium',
        date: '2026-10-22',
        items: [
          {
            stock_id: stock.id,
            stock_name: stock.name,
            qty: 10,
            unit: 'ml',
            unit_cost: 2500,
            total_cost: 25000,
          },
        ],
      })
    );

    const updatedStock = store.getStocks().find(s => s.id === stock.id)!;
    assert(updatedStock.current_amount === 30, `Stok akhir harus 30, didapat: ${updatedStock.current_amount}`);
    // (20 * 1000 + 10 * 2500) / (20 + 10) = 45000 / 30 = 1500
    assert(updatedStock.cost_per_unit === 1500, `WAC harus 1500, didapat: ${updatedStock.cost_per_unit}`);
  });

  // --- Skenario 4 ---
  await runScenario(4, 'Presisi desimal internal tetap dipertahankan tanpa pembulatan rupiah dini', () => {
    const store = createCleanStore();
    const stock = createTestStock(store, 'Cokelat Bubuk Belga', 'Gram', 100, 10);

    // Beli 200g @ Rp20/g. Total: 300g, total nilai: 100*10 + 200*20 = 5000 -> WAC = 5000/300 = 16.666666666666668
    store.addPurchase(
      makePurchasePayload({
        purchase_number: 'PO-PH2-004',
        supplier: 'Supplier Kakao Nusantara',
        date: '2026-10-22',
        items: [
          {
            stock_id: stock.id,
            stock_name: stock.name,
            qty: 200,
            unit: 'Gram',
            unit_cost: 20,
            total_cost: 4000,
          },
        ],
      })
    );

    const updatedStock = store.getStocks().find(s => s.id === stock.id)!;
    assert(updatedStock.current_amount === 300, `Stok harus 300, didapat: ${updatedStock.current_amount}`);
    assertApprox(
      updatedStock.cost_per_unit,
      16.666666666666668,
      1e-9,
      'WAC harus mempertahankan presisi desimal internal (16,666666...)'
    );
    assert(updatedStock.cost_per_unit !== 17, 'WAC internal tidak boleh dibulatkan prematur ke integer (17)');
  });

  // --- Skenario 5 ---
  await runScenario(5, 'Penolakan pembelian ketika stok awal negatif (zero-mutation)', () => {
    const store = createCleanStore();
    const stock = createTestStock(store, 'Gula Aren Cair', 'ml', 0, 15);

    // Paksa stok awal negatif untuk simulasi inkonsistensi fisik
    (store as any).state.stocks.find((s: Stock) => s.id === stock.id)!.current_amount = -50;

    const snapshotBefore = snapshotRelevantState(store);
    let errorThrown = false;

    try {
      store.addPurchase(
        makePurchasePayload({
          purchase_number: 'PO-PH2-005',
          supplier: 'Grosir Aren',
          date: '2026-10-22',
          items: [
            {
              stock_id: stock.id,
              stock_name: stock.name,
              qty: 100,
              unit: 'ml',
              unit_cost: 20,
              total_cost: 2000,
            },
          ],
        })
      );
    } catch (err: any) {
      errorThrown = true;
      assert(
        err.message.includes('negatif'),
        `Pesan error harus menjelaskan saldo negatif: "${err.message}"`
      );
    }

    assert(errorThrown, 'Pembelian dengan saldo stok negatif wajib ditolak');
    const snapshotAfter = snapshotRelevantState(store);
    assertZeroMutation(snapshotBefore, snapshotAfter, 'Penolakan Stok Negatif');
  });

  // --- Skenario 6 ---
  await runScenario(6, 'Penolakan harga atau kuantitas tidak valid (qty <= 0, harga < 0, NaN, Infinity)', () => {
    const store = createCleanStore();
    const stock = createTestStock(store, 'Paper Cup 12oz', 'Pcs', 100, 350);

    const testInvalidPayloads = [
      { qty: 0, unit_cost: 350, desc: 'qty = 0' },
      { qty: -10, unit_cost: 350, desc: 'qty negatif' },
      { qty: NaN, unit_cost: 350, desc: 'qty NaN' },
      { qty: Infinity, unit_cost: 350, desc: 'qty Infinity' },
      { qty: 10, unit_cost: -50, desc: 'unit_cost negatif' },
      { qty: 10, unit_cost: NaN, desc: 'unit_cost NaN' },
      { qty: 10, unit_cost: Infinity, desc: 'unit_cost Infinity' },
    ];

    for (const invalid of testInvalidPayloads) {
      const snapshotBefore = snapshotRelevantState(store);
      let failed = false;

      try {
        store.addPurchase({
          purchase_number: `PO-INVALID-${invalid.desc}`,
          supplier: 'Supplier Kemasan',
          date: '2026-10-22',
          total_amount: (invalid.qty || 1) * (invalid.unit_cost || 1),
          created_at: new Date().toISOString(),
          items: [
            {
              id: 'it-inv',
              stock_id: stock.id,
              stock_name: stock.name,
              qty: invalid.qty,
              unit: 'Pcs',
              unit_cost: invalid.unit_cost,
              total_cost: (invalid.qty || 1) * (invalid.unit_cost || 1),
            },
          ],
        });
      } catch {
        failed = true;
      }

      assert(failed, `Pembelian dengan ${invalid.desc} wajib ditolak.`);
      const snapshotAfter = snapshotRelevantState(store);
      assertZeroMutation(snapshotBefore, snapshotAfter, `Validasi Invalid Input: ${invalid.desc}`);
    }
  });

  // --- Skenario 7 ---
  await runScenario(7, 'Konversi unit kemasan yang valid (2 Box @12 Pcs @Rp24.000 -> +24 Pcs @Rp1.000/Pcs)', () => {
    const store = createCleanStore();
    const stock = createTestStock(store, 'Sedotan Kertas Steril', 'Pcs', 10, 800);

    // Stok awal: 10 Pcs @ Rp800. Nilai: 8.000
    // Pembelian: 2 Box kemasan. Isi: 12 Pcs/Box. Harga per box: Rp24.000.
    // Base qty masuk: 24 Pcs. Harga per Pcs: Rp1.000. Total belanja: Rp48.000.
    // Total stok akhir: 34 Pcs. Total nilai: 8.000 + 48.000 = 56.000.
    // WAC akhir = 56.000 / 34 = 1647.0588235294117
    store.addPurchase(
      makePurchasePayload({
        purchase_number: 'PO-PH2-007',
        supplier: 'Pabrik Sedotan Eco',
        date: '2026-10-22',
        items: [
          {
            stock_id: stock.id,
            stock_name: stock.name,
            package_qty: 2,
            package_unit: 'Box',
            conversion_ratio: 12,
            package_price: 24000,
            qty: 24,
            unit: 'Pcs',
            unit_cost: 1000,
            total_cost: 48000,
          },
        ],
      })
    );

    const updatedStock = store.getStocks().find(s => s.id === stock.id)!;
    assert(updatedStock.current_amount === 34, `Stok akhir harus 34 Pcs, didapat: ${updatedStock.current_amount}`);
    assertApprox(updatedStock.cost_per_unit, 56000 / 34, 1e-9, 'WAC konversi kemasan harus tepat');
    assert(updatedStock.default_package_unit === 'Box', 'Preferensi kemasan Box tersimpan');
    assert(updatedStock.default_package_size === 12, 'Preferensi ukuran kemasan tersimpan');
  });

  // --- Skenario 8 ---
  await runScenario(8, 'Penolakan konversi kemasan tidak valid (massa ke volume tanpa faktor, ratio <= 0)', () => {
    const store = createCleanStore();
    const stock = createTestStock(store, 'Bubuk Teh Earl Grey', 'Gram', 100, 150);

    const snapshotBefore = snapshotRelevantState(store);
    let rejectedCrossDimension = false;

    try {
      // Tolak kemasan volume (Liter) untuk stok massa (Gram)
      store.addPurchase(
        makePurchasePayload({
          purchase_number: 'PO-REJECT-PKG-1',
          supplier: 'Grosir Teh',
          date: '2026-10-22',
          items: [
            {
              stock_id: stock.id,
              stock_name: stock.name,
              package_qty: 2,
              package_unit: 'Liter',
              conversion_ratio: 1000,
              package_price: 150000,
              qty: 2000,
              unit: 'Gram',
              unit_cost: 75,
              total_cost: 300000,
            },
          ],
        })
      );
    } catch (err: any) {
      rejectedCrossDimension = true;
      assert(err.message.includes('lintas dimensi'), `Pesan error: ${err.message}`);
    }

    assert(rejectedCrossDimension, 'Konversi lintas dimensi tanpa density wajib ditolak');
    const snapshotAfter = snapshotRelevantState(store);
    assertZeroMutation(snapshotBefore, snapshotAfter, 'Penolakan Kemasan Lintas Dimensi');
  });

  // --- Skenario 9 ---
  await runScenario(9, 'Nota multi-item dengan bahan berbeda memutasi WAC dan stok masing-masing secara independen', () => {
    const store = createCleanStore();
    const stockKopi = createTestStock(store, 'Espresso Roast Sidikalang', 'Gram', 1000, 120);
    const stockSusu = createTestStock(store, 'Fresh Milk Pasteurisasi', 'ml', 2000, 20);

    // Kopi: 1000g @120 (nilai 120.000) + Beli 1000g @180 (nilai 180.000) -> 2000g @150
    // Susu: 2000ml @20 (nilai 40.000) + Beli 3000ml @25 (nilai 75.000) -> 5000ml @23
    store.addPurchase(
      makePurchasePayload({
        purchase_number: 'PO-MULTI-STOCK',
        supplier: 'Distributor F&B Lengkap',
        date: '2026-10-22',
        items: [
          {
            stock_id: stockKopi.id,
            stock_name: stockKopi.name,
            qty: 1000,
            unit: 'Gram',
            unit_cost: 180,
            total_cost: 180000,
          },
          {
            stock_id: stockSusu.id,
            stock_name: stockSusu.name,
            qty: 3000,
            unit: 'ml',
            unit_cost: 25,
            total_cost: 75000,
          },
        ],
      })
    );

    const resKopi = store.getStocks().find(s => s.id === stockKopi.id)!;
    const resSusu = store.getStocks().find(s => s.id === stockSusu.id)!;

    assert(resKopi.current_amount === 2000, `Stok Kopi harus 2000g, didapat: ${resKopi.current_amount}`);
    assert(resKopi.cost_per_unit === 150, `WAC Kopi harus 150, didapat: ${resKopi.cost_per_unit}`);

    assert(resSusu.current_amount === 5000, `Stok Susu harus 5000ml, didapat: ${resSusu.current_amount}`);
    assert(resSusu.cost_per_unit === 23, `WAC Susu harus 23, didapat: ${resSusu.cost_per_unit}`);
  });

  // --- Skenario 10 ---
  await runScenario(10, 'Nota dengan beberapa baris untuk stock_id yang sama (agregasi WAC contoh prompt: 0g -> 100g @10 + 200g @20 = 300g @16.666666...)', () => {
    const store = createCleanStore();
    const stock = createTestStock(store, 'Bubuk Cokelat Dark Agregat', 'Gram', 0, 0);

    // Sesuai spesifikasi prompt:
    // Stok awal: 0 g.
    // Baris pertama: 100 g dengan biaya Rp10/g.
    // Baris kedua: 200 g dengan biaya Rp20/g.
    // Hasil: 300 g, total nilai Rp5.000, WAC Rp16,666666.../g tanpa pembulatan internal dini.
    const pur = store.addPurchase(
      makePurchasePayload({
        purchase_number: 'PO-MULTI-LINE-SAME-STOCK',
        supplier: 'Supplier Kakao',
        date: '2026-10-22',
        items: [
          {
            id: 'line-1',
            stock_id: stock.id,
            stock_name: stock.name,
            qty: 100,
            unit: 'Gram',
            unit_cost: 10,
            total_cost: 1000,
          },
          {
            id: 'line-2',
            stock_id: stock.id,
            stock_name: stock.name,
            qty: 200,
            unit: 'Gram',
            unit_cost: 20,
            total_cost: 4000,
          },
        ],
      })
    );

    const res = store.getStocks().find(s => s.id === stock.id)!;
    assert(res.current_amount === 300, `Kuantitas akhir harus 300 g, didapat: ${res.current_amount}`);
    assertApprox(res.cost_per_unit, 5000 / 300, 1e-9, 'WAC harus Rp16,666666.../g');
    assert(pur.total_amount === 5000, `Total belanja nota harus Rp5.000, didapat: ${pur.total_amount}`);

    // Pastikan kedua baris item tercatat riwayat mutasinya secara sekuensial
    const histories = store.getStockHistories().filter(h => h.stock_id === stock.id);
    assert(histories.length === 2, `Harus ada 2 entri histori untuk 2 baris item, didapat: ${histories.length}`);
  });

  // --- Skenario 11 ---
  await runScenario(11, 'Satu item tidak valid: seluruh nota batal tanpa perubahan parsial (All-or-Nothing)', () => {
    const store = createCleanStore();
    const stockValid = createTestStock(store, 'Bahan Valid A', 'Gram', 100, 100);
    const snapshotBefore = snapshotRelevantState(store);

    let rejected = false;
    try {
      store.addPurchase(
        makePurchasePayload({
          purchase_number: 'PO-PARTIAL-FAIL',
          supplier: 'Supplier Campuran',
          date: '2026-10-22',
          items: [
            {
              stock_id: stockValid.id,
              stock_name: stockValid.name,
              qty: 50,
              unit: 'Gram',
              unit_cost: 120,
              total_cost: 6000,
            },
            {
              // Item 2 invalid: stock_id fiktif
              stock_id: 'stk-fictional-99999',
              stock_name: 'Bahan Fiktif',
              qty: 10,
              unit: 'Gram',
              unit_cost: 50,
              total_cost: 500,
            },
          ],
        })
      );
    } catch (err: any) {
      rejected = true;
      assert(err.message.includes('tidak ditemukan'), `Pesan error: ${err.message}`);
    }

    assert(rejected, 'Nota dengan 1 item invalid harus ditolak sepenuhnya');
    const snapshotAfter = snapshotRelevantState(store);
    assertZeroMutation(snapshotBefore, snapshotAfter, 'All-or-Nothing Partial Item Failure');
  });

  // --- Skenario 12 ---
  await runScenario(12, 'Kegagalan persistensi: state RAM dipulihkan dan persistensi konsisten', () => {
    const store = createCleanStore();
    const stock = createTestStock(store, 'Bahan Rollback Persistence', 'Gram', 100, 50);
    const snapshotBefore = snapshotRelevantState(store);

    // Kunci storage agar melempar QuotaExceededError saat persist()
    memoryDriver.shouldFailSetItem = true;

    let caughtPersistenceError = false;
    try {
      store.addPurchase(
        makePurchasePayload({
          purchase_number: 'PO-PERSIST-FAIL',
          supplier: 'Supplier Storage Error',
          date: '2026-10-22',
          items: [
            {
              stock_id: stock.id,
              stock_name: stock.name,
              qty: 200,
              unit: 'Gram',
              unit_cost: 75,
              total_cost: 15000,
            },
          ],
        })
      );
    } catch (err: any) {
      caughtPersistenceError = true;
      assert(err.message.includes('QuotaExceeded') || err.message.includes('storage'), `Error: ${err.message}`);
    } finally {
      memoryDriver.shouldFailSetItem = false;
    }

    assert(caughtPersistenceError, 'Kegagalan storage driver harus terdeteksi');
    const snapshotAfter = snapshotRelevantState(store);
    assertZeroMutation(snapshotBefore, snapshotAfter, 'Persistence Failure RAM Rollback');
  });

  // --- Skenario 13 ---
  await runScenario(13, 'updatePurchase rincian item ditolak tanpa mutasi (Conservative Policy)', () => {
    const store = createCleanStore();
    const stock = createTestStock(store, 'Kopi Gayo Test Edit', 'Gram', 1000, 150);

    const initialPurchase = store.addPurchase(
      makePurchasePayload({
        purchase_number: 'PO-IMMUTABLE-TEST',
        supplier: 'Koperasi Gayo',
        date: '2026-10-22',
        items: [
          {
            stock_id: stock.id,
            stock_name: stock.name,
            qty: 500,
            unit: 'Gram',
            unit_cost: 160,
            total_cost: 80000,
          },
        ],
      })
    );

    const snapshotBefore = snapshotRelevantState(store);
    let editRejected = false;

    try {
      // Coba edit rincian item (mengubah kuantitas atau harga item)
      store.updatePurchase(initialPurchase.id, {
        items: [
          {
            id: initialPurchase.items[0].id,
            stock_id: stock.id,
            stock_name: stock.name,
            qty: 1000, // diubah dari 500 ke 1000
            unit: 'Gram',
            unit_cost: 160,
            total_cost: 160000,
          },
        ],
      });
    } catch (err: any) {
      editRejected = true;
      assert(
        err.message.includes('tidak dapat diubah rincian itemnya') || err.message.includes('integritas nilai persediaan'),
        `Pesan error penolakan edit item: "${err.message}"`
      );
    }

    assert(editRejected, 'updatePurchase dengan modifikasi item wajib ditolak.');
    const snapshotAfter = snapshotRelevantState(store);
    assertZeroMutation(snapshotBefore, snapshotAfter, 'Penolakan Edit Item Purchase');
  });

  // --- Skenario 14 ---
  await runScenario(14, 'deletePurchase ditolak tanpa mutasi demi menjaga integritas WAC', () => {
    const store = createCleanStore();
    const stock = createTestStock(store, 'Sirup Vanilla Test Delete', 'ml', 500, 40);

    const initialPurchase = store.addPurchase(
      makePurchasePayload({
        purchase_number: 'PO-NO-DELETE-TEST',
        supplier: 'Supplier Sirup',
        date: '2026-10-22',
        items: [
          {
            stock_id: stock.id,
            stock_name: stock.name,
            qty: 500,
            unit: 'ml',
            unit_cost: 50,
            total_cost: 25000,
          },
        ],
      })
    );

    const snapshotBefore = snapshotRelevantState(store);
    let deleteRejected = false;

    try {
      store.deletePurchase(initialPurchase.id);
    } catch (err: any) {
      deleteRejected = true;
      assert(
        err.message.includes('tidak diizinkan') || err.message.includes('integritas'),
        `Pesan error penolakan delete: "${err.message}"`
      );
    }

    assert(deleteRejected, 'deletePurchase terhadap nota yang telah dibukukan wajib ditolak.');
    const snapshotAfter = snapshotRelevantState(store);
    assertZeroMutation(snapshotBefore, snapshotAfter, 'Penolakan Delete Purchase');
  });

  // --- Skenario 15 ---
  await runScenario(15, 'Edit header non-akuntansi (notes, supplier) diizinkan tanpa mengubah WAC atau stok', () => {
    const store = createCleanStore();
    const stock = createTestStock(store, 'Teh Melati Header Edit', 'Gram', 100, 20);

    const purchase = store.addPurchase(
      makePurchasePayload({
        purchase_number: 'PO-HEADER-EDIT-1',
        supplier: 'Supplier Lama',
        notes: 'Catatan awal',
        date: '2026-10-22',
        items: [
          {
            stock_id: stock.id,
            stock_name: stock.name,
            qty: 100,
            unit: 'Gram',
            unit_cost: 30,
            total_cost: 3000,
          },
        ],
      })
    );

    const stockBeforeEdit = store.getStocks().find(s => s.id === stock.id)!;
    const wacBefore = stockBeforeEdit.cost_per_unit;
    const qtyBefore = stockBeforeEdit.current_amount;

    // Edit hanya header: notes dan supplier (tanpa items atau items identik)
    const updatedPur = store.updatePurchase(purchase.id, {
      notes: 'Catatan baru telah diperbarui oleh Owner',
      supplier: 'Supplier Resmi Baru',
    });

    assert(updatedPur.notes === 'Catatan baru telah diperbarui oleh Owner', 'Notes harus terupdate');
    assert(updatedPur.supplier === 'Supplier Resmi Baru', 'Supplier harus terupdate');

    const stockAfterEdit = store.getStocks().find(s => s.id === stock.id)!;
    assert(stockAfterEdit.cost_per_unit === wacBefore, 'WAC stok sama sekali tidak boleh berubah oleh edit header');
    assert(stockAfterEdit.current_amount === qtyBefore, 'Kuantitas stok sama sekali tidak boleh berubah oleh edit header');
  });

  // --- Skenario 16 ---
  await runScenario(16, 'adjustStock tetap mengubah kuantitas fisik tanpa mengubah cost_per_unit (WAC)', () => {
    const store = createCleanStore();
    const stock = createTestStock(store, 'Biji Kopi Opname Fisik', 'Gram', 500, 150);

    // Penyesuaian opname stok fisik: +50 gram
    const adjustedPos = store.adjustStock(stock.id, 50, 'Opname Fisik Rutin', 'Owner Demo', 'Selisih timbangan');
    assert(adjustedPos.current_amount === 550, `Kuantitas harus bertambah ke 550, didapat: ${adjustedPos.current_amount}`);
    assert(adjustedPos.cost_per_unit === 150, `WAC harus tetap 150, didapat: ${adjustedPos.cost_per_unit}`);

    // Penyesuaian opname stok fisik: -30 gram
    const adjustedNeg = store.adjustStock(stock.id, -30, 'Bahan Tumpah', 'Owner Demo', 'Tercecer saat barista racik');
    assert(adjustedNeg.current_amount === 520, `Kuantitas harus berkurang ke 520, didapat: ${adjustedNeg.current_amount}`);
    assert(adjustedNeg.cost_per_unit === 150, `WAC harus tetap 150, didapat: ${adjustedNeg.cost_per_unit}`);
  });

function makeOrderPayload(product: any, overrides: any = {}) {
  return {
    customer_name: 'Pelanggan WAC Test',
    order_type: 'dine_in' as const,
    created_by_user_id: 'usr-owner-01',
    created_by_name: 'Hendro Wijaya',
    created_by_role: 'owner' as const,
    total_amount: product.price,
    subtotal: product.price,
    tax_amount: 0,
    discount_amount: 0,
    created_at: new Date().toISOString(),
    items: [
      {
        id: `ord-item-${Date.now()}`,
        product_id: product.id,
        product_name: product.name,
        price: product.price,
        qty: 1,
        subtotal: product.price,
      },
    ],
    payment: {
      id: `pay-${Date.now()}`,
      order_id: '',
      method: 'cash' as const,
      amount_paid: product.price,
      change: 0,
      status: 'completed' as const,
    },
    ...overrides,
  };
}

  // --- Skenario 17 ---
  await runScenario(17, 'Penjualan (addOrder checkout) mengurangi stok tanpa mengubah WAC per unit', () => {
    const store = createCleanStore();
    const ownerUser = store.getUsers().find(u => u.role === 'owner')!;
    store.openShift(100000, ownerUser);

    const stocks = store.getStocks();
    const coffeeStock = stocks.find(s => s.unit === 'Gram' && s.current_amount > 500)!;
    const initialCost = coffeeStock.cost_per_unit;
    const initialQty = coffeeStock.current_amount;

    // Tambahkan order normal melalui store
    const products = store.getProducts();
    const productWithRecipe = products[0];

    const order = store.addOrder(makeOrderPayload(productWithRecipe));

    const updatedStock = store.getStocks().find(s => s.id === coffeeStock.id)!;
    assert(updatedStock.cost_per_unit === initialCost, 'WAC per unit tidak boleh berubah akibat transaksi penjualan');
    assert(updatedStock.current_amount <= initialQty, 'Kuantitas stok berkurang sesuai resep');
    assert((order.total_hpp ?? 0) > 0, 'Total HPP pesanan harus terbentuk');
  });

  // --- Skenario 18 ---
  await runScenario(18, 'Snapshot HPP transaksi lama tetap tidak berubah setelah pembelian baru dengan harga berbeda', () => {
    const store = createCleanStore();
    const ownerUser = store.getUsers().find(u => u.role === 'owner')!;
    store.openShift(100000, ownerUser);

    const products = store.getProducts();
    const product = products[0];

    // 1. Buat pesanan pertama
    const order1 = store.addOrder(makeOrderPayload(product, { customer_name: 'Pelanggan Lama' }));

    const frozenOrder1HPP = order1.total_hpp;
    const frozenItem1UnitCost = order1.items[0].unit_cost_price;

    // 2. Lakukan pembelian bahan baku resep dengan lonjakan harga besar
    const recipe = store.getRecipes().find(r => r.product_id === product.id)!;
    const primaryStockId = recipe.ingredients[0].stock_id;
    const primaryStock = store.getStocks().find(s => s.id === primaryStockId)!;

    store.addPurchase(
      makePurchasePayload({
        purchase_number: 'PO-PRICE-HIKE',
        supplier: 'Supplier Inflasi',
        date: '2026-10-22',
        items: [
          {
            stock_id: primaryStock.id,
            stock_name: primaryStock.name,
            qty: 5000,
            unit: primaryStock.unit,
            unit_cost: (primaryStock.cost_per_unit || 100) * 10, // 10x lipat harga
            total_cost: 5000 * (primaryStock.cost_per_unit || 100) * 10,
          },
        ],
      })
    );

    // 3. Verifikasi order lama tidak terpengaruh oleh lonjakan harga pembelian baru
    const reloadedOrder1 = store.getOrders().find(o => o.id === order1.id)!;
    assert(
      reloadedOrder1.total_hpp === frozenOrder1HPP,
      `Snapshot total_hpp order lama harus tetap ${frozenOrder1HPP}, didapat: ${reloadedOrder1.total_hpp}`
    );
    assert(
      reloadedOrder1.items[0].unit_cost_price === frozenItem1UnitCost,
      `Snapshot unit_cost_price order lama harus tetap ${frozenItem1UnitCost}, didapat: ${reloadedOrder1.items[0].unit_cost_price}`
    );
  });

  // --- Skenario 19 ---
  await runScenario(19, 'Penanganan duplikasi ID item dalam nota belanja menghasilkan ID unik tanpa tabrakan', () => {
    const store = createCleanStore();
    const stock = createTestStock(store, 'Gelas Plastik Cup 16oz', 'Pcs', 50, 400);

    // Kirim item dengan ID yang sama atau tanpa ID
    const pur = store.addPurchase(
      makePurchasePayload({
        purchase_number: 'PO-DUP-ITEM-IDS',
        supplier: 'Pabrik Plastik',
        date: '2026-10-22',
        items: [
          {
            id: 'duplicate-item-id-1',
            stock_id: stock.id,
            stock_name: stock.name,
            qty: 25,
            unit: 'Pcs',
            unit_cost: 420,
            total_cost: 10500,
          },
          {
            id: 'duplicate-item-id-1', // Duplikat disengaja
            stock_id: stock.id,
            stock_name: stock.name,
            qty: 25,
            unit: 'Pcs',
            unit_cost: 420,
            total_cost: 10500,
          },
        ],
      })
    );

    const itemIds = pur.items.map(it => it.id);
    const uniqueIds = new Set(itemIds);
    assert(uniqueIds.size === pur.items.length, 'Seluruh item nota harus memiliki ID unik setelah diproses');
  });

  // --- Skenario 20 ---
  await runScenario(20, 'Regresi untuk tes lama: latest-cost overwrite kini dicegah oleh WAC dan integritas nota', () => {
    const store = createCleanStore();
    const stock = createTestStock(store, 'Susu UHT Full Cream Diamond', 'ml', 1000, 20);

    // Pembelian baru dengan harga lebih tinggi (Rp 30/ml) untuk 1000 ml
    // Dibawah sistem LAMA: cost_per_unit ditimpa menjadi 30 (latest cost overwrite)
    // Dibawah sistem BARU (WAC): cost_per_unit menjadi (1000*20 + 1000*30) / 2000 = 25
    store.addPurchase(
      makePurchasePayload({
        purchase_number: 'PO-OLD-LATEST-COST-TEST',
        supplier: 'Distributor Susu',
        date: '2026-10-22',
        items: [
          {
            stock_id: stock.id,
            stock_name: stock.name,
            qty: 1000,
            unit: 'ml',
            unit_cost: 30,
            total_cost: 30000,
          },
        ],
      })
    );

    const updatedStock = store.getStocks().find(s => s.id === stock.id)!;
    assert(
      updatedStock.cost_per_unit === 25,
      `WAC harus 25, bukan 30 (latest-cost overwrite dicegah). Aktual: ${updatedStock.cost_per_unit}`
    );
    assert(
      updatedStock.cost_per_unit !== 30,
      'Stok TIDAK boleh ditimpa langsung dengan harga nota terakhir (latest cost overwrite terbukti berhasil dicegah).'
    );

    // Edit item nota lama kini ditolak aman
    const purchaseToEdit = store.getPurchases()[0];
    let editBlocked = false;
    try {
      store.updatePurchase(purchaseToEdit.id, {
        items: [{ ...purchaseToEdit.items[0], qty: 9999 }],
      });
    } catch {
      editBlocked = true;
    }
    assert(editBlocked, 'Edit rincian item nota lama kini diblokir demi integritas WAC.');

    // Delete nota lama kini ditolak aman
    let deleteBlocked = false;
    try {
      store.deletePurchase(purchaseToEdit.id);
    } catch {
      deleteBlocked = true;
    }
    assert(deleteBlocked, 'Delete nota lama kini diblokir demi integritas persediaan.');
  });

  console.log('\n================================================================');
  console.log('                 REKAPITULASI HASIL PENGUJIAN                   ');
  console.log('================================================================');
  const passCount = reports.filter(r => r.passed).length;
  const failCount = reports.filter(r => !r.passed).length;
  console.log(`Total Skenario Diuji : ${reports.length} (Target: 20)`);
  console.log(`Jumlah Lulus (PASS)  : ${passCount}`);
  console.log(`Jumlah Gagal (FAIL)  : ${failCount}`);

  if (failCount > 0) {
    console.error('\nGAGAL! Ada skenario yang tidak lulus:');
    reports.filter(r => !r.passed).forEach(r => console.error(` - S${r.id}: ${r.name} -> ${r.error}`));
    process.exit(1);
  } else {
    console.log('\nSEMUA 20 SKENARIO HPP FASE 2 LULUS DENGAN SUKSES! (100% PASS)\n');
    process.exit(0);
  }
}

// Eksekusi jika dijalankan langsung via CLI
runHPPPhase2Validation();
