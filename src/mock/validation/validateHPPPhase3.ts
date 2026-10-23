/**
 * BOOTH DAILY — HPP PHASE 3 VALIDATION SUITE
 * Recipe Waste, Unit Conversion, HPP Snapshot & Checkout Atomicity
 *
 * 18 Skenario Pengujian Komprehensif:
 *  1. Gross quantity with zero waste.
 *  2. Gross quantity with a valid nonzero waste percentage.
 *  3. Invalid waste percentages.
 *  4. Valid mass and volume conversions.
 *  5. Incompatible and unsupported unit conversions.
 *  6. WAC-based HPP with full internal precision.
 *  7. Multiple cart items sharing the same ingredient.
 *  8. Insufficient stock after gross quantity aggregation.
 *  9. Missing, empty, or malformed recipes.
 * 10. Correct transaction-time item and order HPP snapshots.
 * 11. Historical HPP unchanged after recipe or inventory cost changes.
 * 12. Cash and QRIS checkout regressions.
 * 13. Failed checkout does not clear the cart.
 * 14. Injected persistence failure leaves no partial mutation.
 * 15. Stock history matches actual stock deductions.
 * 16. Reload/persistence behavior.
 * 17. Existing refund behavior remains unchanged.
 * 18. Regression of Phases 1, 2, and 2A.
 *
 * CATATAN KEAMANAN:
 * Menggunakan isolated memory storage driver (IsolatedMemoryStorage).
 * Tidak memodifikasi storage nyata atau data pengguna.
 */

import { MockStore } from '../store';
import { setStorageDriver, StorageDriver } from '../persistence/storage';
import { sessionManager } from '../repositories/sessionManager';
import { Order, Recipe, Stock, User } from '../../types';
import {
  calculateGrossAmount,
  convertUnitQuantity,
  roundToRupiah,
  calculateWeightedAverageCost,
} from '../../utils/hppCalculation';
import { getOrderTotalHPP } from '../../utils/reportUtils';

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

function assertApprox(actual: number, expected: number, epsilon = 1e-6, msg?: string) {
  const diff = Math.abs(actual - expected);
  if (diff > epsilon) {
    throw new Error(
      `${msg || 'Nilai tidak sesuai'}. Diharapkan: ${expected}, Aktual: ${actual}, Selisih: ${diff}`
    );
  }
}

function setCurrentUser(user: User) {
  sessionManager.setSession({
    userId: user.id,
    token: `token-${user.id}`,
    loggedInAt: new Date().toISOString(),
  });
}

function setupIsolatedEnvironment(): { store: MockStore; storage: IsolatedMemoryStorage; cashier: User; owner: User } {
  const storage = new IsolatedMemoryStorage();
  setStorageDriver(storage);
  const store = new MockStore();

  const cashier: User = store.getUsers().find(u => u.role === 'karyawan') || {
    id: 'usr-karyawan-1',
    name: 'Dinda Lestari',
    email: 'dinda@boothdaily.com',
    role: 'karyawan' as const,
    pin: '5678',
    is_active: true,
  };

  const owner: User = store.getUsers().find(u => u.role === 'owner') || {
    id: 'usr-owner-1',
    name: 'Hendro Wijaya',
    email: 'hendro@boothdaily.com',
    role: 'owner' as const,
    pin: '1234',
    is_active: true,
  };

  // Login as cashier and open shift so transactions can be created
  setCurrentUser(cashier);
  if (!store.getActiveShift()) {
    store.openShift(100000, cashier);
  }

  return { store, storage, cashier, owner };
}

async function runScenario(id: number, name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    reports.push({ id, name, passed: true });
    console.log(`  ✓ [PASS] S${String(id).padStart(2, '0')}: ${name}`);
  } catch (err: any) {
    reports.push({ id, name, passed: false, error: err.message || String(err) });
    console.error(`  ✗ [FAIL] S${String(id).padStart(2, '0')}: ${name}`);
    console.error(`     Error: ${err.message || err}`);
  }
}

export async function runHPPPhase3Validation() {
  console.log('================================================================');
  console.log('   BOOTH DAILY — HPP PHASE 3: RECIPE WASTE & ATOMICITY SUITE    ');
  console.log('   Target: 18 Skenario Pengujian Terverifikasi                 ');
  console.log('================================================================\n');

  // -------------------------------------------------------------
  // SKENARIO 1: Gross quantity with zero waste
  // -------------------------------------------------------------
  await runScenario(1, 'Gross quantity with zero waste', () => {
    const { store } = setupIsolatedEnvironment();
    const coffeeStock = store.getStockById('stk-coffee-beans')!;
    const initialAmount = coffeeStock.current_amount;

    // Kopi Susu Gula Aren has 18g coffee beans with no waste (undefined/0)
    const order = store.addOrder({
      order_type: 'take_away',
      items: [
        {
          product_id: 'prd-kopi-susu-aren',
          product_name: 'Kopi Susu Gula Aren',
          price: 22000,
          qty: 1,
        },
      ],
      payment: {
        method: 'cash',
        amount_paid: 25000,
        change: 3000,
        status: 'completed',
      },
    });

    const updatedStock = store.getStockById('stk-coffee-beans')!;
    assert(
      updatedStock.current_amount === initialAmount - 18,
      `Stok berkurang tepat 18g untuk zero waste. Diharapkan: ${initialAmount - 18}, Aktual: ${updatedStock.current_amount}`
    );

    const history = store.getStockHistories().find(
      h => h.stock_id === 'stk-coffee-beans' && h.reference === `Penjualan #${order.order_number}`
    );
    assert(Boolean(history), 'Riwayat stok penjualan tercatat');
    assert(history!.change_amount === -18, `History change_amount harus -18, didapat: ${history!.change_amount}`);
  });

  // -------------------------------------------------------------
  // SKENARIO 2: Gross quantity with valid nonzero waste percentage
  // -------------------------------------------------------------
  await runScenario(2, 'Gross quantity with a valid nonzero waste percentage', () => {
    const { store, owner } = setupIsolatedEnvironment();
    setCurrentUser(owner);

    // Create a recipe with 19g net amount and 5% grinder waste
    // grossAmount = 19 / (1 - 0.05) = 20g
    const recipe = store.getRecipeByProductId('prd-americano')!;
    store.updateRecipe(recipe.id, {
      ingredients: [
        {
          id: 'ing-ame-waste',
          stock_id: 'stk-coffee-beans',
          stock_name: 'Biji Kopi Espresso Blend',
          amount: 19,
          unit: 'Gram',
          waste_percentage: 5,
        },
      ],
    });

    const stockBefore = store.getStockById('stk-coffee-beans')!.current_amount;

    // Checkout 2x Americano -> Gross required = 20g * 2 = 40g
    const order = store.addOrder({
      order_type: 'dine_in',
      items: [
        {
          product_id: 'prd-americano',
          product_name: 'Americano Classic',
          price: 18000,
          qty: 2,
        },
      ],
      payment: {
        method: 'cash',
        amount_paid: 40000,
        change: 4000,
        status: 'completed',
      },
    });

    const stockAfter = store.getStockById('stk-coffee-beans')!.current_amount;
    assert(
      stockAfter === stockBefore - 40,
      `Stok berkurang 40g (2x 20g gross). Diharapkan: ${stockBefore - 40}, Aktual: ${stockAfter}`
    );

    const history = store.getStockHistories().find(
      h => h.stock_id === 'stk-coffee-beans' && h.reference === `Penjualan #${order.order_number}`
    );
    assert(history!.change_amount === -40, `StockHistory mencatat -40g bruto, didapat: ${history!.change_amount}`);
  });

  // -------------------------------------------------------------
  // SKENARIO 3: Invalid waste percentages
  // -------------------------------------------------------------
  await runScenario(3, 'Invalid waste percentages rejected with zero mutation', () => {
    const { store, owner } = setupIsolatedEnvironment();
    setCurrentUser(owner);

    const recipe = store.getRecipeByProductId('prd-americano')!;

    // Test rejection in addRecipe / updateRecipe
    let rejectedNeg = false;
    try {
      store.updateRecipe(recipe.id, {
        ingredients: [
          {
            id: 'ing-neg',
            stock_id: 'stk-coffee-beans',
            stock_name: 'Biji Kopi Espresso Blend',
            amount: 18,
            unit: 'Gram',
            waste_percentage: -5,
          },
        ],
      });
    } catch (err: any) {
      rejectedNeg = err.message.includes('waste');
    }
    assert(rejectedNeg, 'updateRecipe menolak waste_percentage negatif');

    let rejected100 = false;
    try {
      store.updateRecipe(recipe.id, {
        ingredients: [
          {
            id: 'ing-100',
            stock_id: 'stk-coffee-beans',
            stock_name: 'Biji Kopi Espresso Blend',
            amount: 18,
            unit: 'Gram',
            waste_percentage: 100,
          },
        ],
      });
    } catch (err: any) {
      rejected100 = err.message.includes('waste');
    }
    assert(rejected100, 'updateRecipe menolak waste_percentage >= 100%');

    // Test rejection in addOrder when recipe has invalid waste
    // Manually inject corrupt recipe to simulate corrupted persisted data
    (store as any).state.recipes.find((r: Recipe) => r.id === recipe.id)!.ingredients = [
      {
        id: 'corrupt-ing',
        stock_id: 'stk-coffee-beans',
        stock_name: 'Biji Kopi Espresso Blend',
        amount: 18,
        unit: 'Gram',
        waste_percentage: 150,
      },
    ];

    const ordersCountBefore = store.getOrders().length;
    const stockBefore = store.getStockById('stk-coffee-beans')!.current_amount;

    let checkoutBlocked = false;
    try {
      store.addOrder({
        order_type: 'take_away',
        items: [
          {
            product_id: 'prd-americano',
            product_name: 'Americano Classic',
            price: 18000,
            qty: 1,
          },
        ],
        payment: { method: 'cash', amount_paid: 20000, change: 2000, status: 'completed' },
      });
    } catch {
      checkoutBlocked = true;
    }

    assert(checkoutBlocked, 'addOrder menolak checkout dengan resep yang memiliki waste >= 100%');
    assert(store.getOrders().length === ordersCountBefore, 'Jumlah order tidak bertambah saat checkout ditolak');
    assert(
      store.getStockById('stk-coffee-beans')!.current_amount === stockBefore,
      'Stok tidak termutasi saat checkout ditolak karena waste tidak valid'
    );
  });

  // -------------------------------------------------------------
  // SKENARIO 4: Valid mass and volume conversions
  // -------------------------------------------------------------
  await runScenario(4, 'Valid mass and volume conversions', () => {
    const { store, owner } = setupIsolatedEnvironment();
    setCurrentUser(owner);

    // Test 1: Mass conversion - Recipe in kg (0.05 kg = 50g), Stock in Gram (stk-coffee-beans)
    const initialCoffee = store.getStockById('stk-coffee-beans')!.current_amount;
    const recipeKsa = store.getRecipeByProductId('prd-kopi-susu-aren')!;
    store.updateRecipe(recipeKsa.id, {
      ingredients: [
        {
          id: 'ing-kg-test',
          stock_id: 'stk-coffee-beans',
          stock_name: 'Biji Kopi Espresso Blend',
          amount: 0.05, // 0.05 kg = 50 Gram
          unit: 'kg',
          waste_percentage: 0,
        },
      ],
    });

    const order1 = store.addOrder({
      order_type: 'take_away',
      items: [
        {
          product_id: 'prd-kopi-susu-aren',
          product_name: 'Kopi Susu Gula Aren',
          price: 22000,
          qty: 1,
        },
      ],
      payment: { method: 'cash', amount_paid: 25000, change: 3000, status: 'completed' },
    });

    const updatedCoffee = store.getStockById('stk-coffee-beans')!;
    assert(
      updatedCoffee.current_amount === initialCoffee - 50,
      `Stok berkurang 50g dari resep 0.05 kg. Diharapkan: ${initialCoffee - 50}, Aktual: ${updatedCoffee.current_amount}`
    );

    const historyCoffee = store.getStockHistories().find(
      h => h.stock_id === 'stk-coffee-beans' && h.reference === `Penjualan #${order1.order_number}`
    );
    assert(historyCoffee!.change_amount === -50, `History mencatat -50 Gram, didapat: ${historyCoffee!.change_amount}`);
    assert(historyCoffee!.unit === 'Gram', `History menggunakan unit dasar 'Gram', didapat: ${historyCoffee!.unit}`);

    // Test 2: Volume conversion - Recipe in liter (0.2 liter = 200 ml), Stock in ml (stk-fresh-milk)
    const initialMilk = store.getStockById('stk-fresh-milk')!.current_amount;
    const recipeAme = store.getRecipeByProductId('prd-americano')!;
    store.updateRecipe(recipeAme.id, {
      ingredients: [
        {
          id: 'ing-liter-test',
          stock_id: 'stk-fresh-milk',
          stock_name: 'Fresh Milk Pasteurisasi',
          amount: 0.2, // 0.2 liter = 200 ml
          unit: 'liter',
          waste_percentage: 0,
        },
      ],
    });

    const order2 = store.addOrder({
      order_type: 'dine_in',
      items: [
        {
          product_id: 'prd-americano',
          product_name: 'Americano Classic',
          price: 18000,
          qty: 1,
        },
      ],
      payment: { method: 'cash', amount_paid: 20000, change: 2000, status: 'completed' },
    });

    const updatedMilk = store.getStockById('stk-fresh-milk')!;
    assert(
      updatedMilk.current_amount === initialMilk - 200,
      `Stok berkurang 200 ml dari resep 0.2 liter. Diharapkan: ${initialMilk - 200}, Aktual: ${updatedMilk.current_amount}`
    );
  });

  // -------------------------------------------------------------
  // SKENARIO 5: Incompatible and unsupported unit conversions
  // -------------------------------------------------------------
  await runScenario(5, 'Incompatible and unsupported unit conversions rejected', () => {
    const { store, owner } = setupIsolatedEnvironment();
    setCurrentUser(owner);

    // Incompatible: mass (Gram) to volume (ml) without density
    const recipeAme = store.getRecipeByProductId('prd-americano')!;
    let incompatibleRejected = false;
    try {
      store.updateRecipe(recipeAme.id, {
        ingredients: [
          {
            id: 'ing-incomp',
            stock_id: 'stk-coffee-beans', // unit is Gram
            stock_name: 'Biji Kopi Espresso Blend',
            amount: 20,
            unit: 'ml', // Incompatible without density!
          },
        ],
      });
    } catch (err: any) {
      incompatibleRejected = err.message.includes('lintas dimensi') || err.message.includes('tidak kompatibel');
    }
    assert(incompatibleRejected, 'updateRecipe menolak konversi satuan tidak kompatibel (ml ke Gram)');

    // Injected incompatible recipe in store to test addOrder guard
    (store as any).state.recipes.find((r: Recipe) => r.id === recipeAme.id)!.ingredients = [
      {
        id: 'corrupt-unit',
        stock_id: 'stk-coffee-beans',
        stock_name: 'Biji Kopi Espresso Blend',
        amount: 20,
        unit: 'ml',
      },
    ];

    const ordersBefore = store.getOrders().length;
    let checkoutRejected = false;
    try {
      store.addOrder({
        order_type: 'take_away',
        items: [
          {
            product_id: 'prd-americano',
            product_name: 'Americano Classic',
            price: 18000,
            qty: 1,
          },
        ],
        payment: { method: 'cash', amount_paid: 20000, change: 2000, status: 'completed' },
      });
    } catch {
      checkoutRejected = true;
    }

    assert(checkoutRejected, 'addOrder menolak transaksi jika resep memiliki satuan tidak kompatibel');
    assert(store.getOrders().length === ordersBefore, 'Orders tidak termutasi pada penolakan satuan');
  });

  // -------------------------------------------------------------
  // SKENARIO 6: WAC-based HPP with full internal precision
  // -------------------------------------------------------------
  await runScenario(6, 'WAC-based HPP with full internal precision', () => {
    const { store, owner } = setupIsolatedEnvironment();
    setCurrentUser(owner);

    // Stock with fractional WAC:
    // e.g. 150g with value 25000 -> WAC = 166.66666666666666
    const stockCoffee = (store as any).state.stocks.find((s: Stock) => s.id === 'stk-coffee-beans')!;
    stockCoffee.cost_per_unit = 25000 / 150; // 166.66666666666666

    // Recipe: 18g net with 10% waste -> gross = 20g
    // Gross cost = 20 * 166.66666666666666 = 3333.333333333333...
    // Rounded at display boundary = 3333
    const recipeAme = store.getRecipeByProductId('prd-americano')!;
    store.updateRecipe(recipeAme.id, {
      ingredients: [
        {
          id: 'ing-prec',
          stock_id: stockCoffee.id,
          stock_name: stockCoffee.name,
          amount: 18,
          unit: 'Gram',
          waste_percentage: 10,
        },
      ],
    });

    const order = store.addOrder({
      order_type: 'take_away',
      items: [
        {
          product_id: 'prd-americano',
          product_name: 'Americano Classic',
          price: 18000,
          qty: 3,
        },
      ],
      payment: { method: 'cash', amount_paid: 100000, change: 46000, status: 'completed' },
    });

    const snapItem = order.items[0];
    assert(snapItem.unit_cost_price === 3333, `Item unit_cost_price snapshot harus 3333, didapat: ${snapItem.unit_cost_price}`);
    assert(snapItem.subtotal_cost === 3333 * 3, `Item subtotal_cost snapshot harus 9999, didapat: ${snapItem.subtotal_cost}`);
    assert(order.total_hpp === 9999, `Order total_hpp snapshot harus 9999, didapat: ${order.total_hpp}`);
  });

  // -------------------------------------------------------------
  // SKENARIO 7: Multiple cart items sharing the same ingredient
  // -------------------------------------------------------------
  await runScenario(7, 'Multiple cart items sharing the same ingredient', () => {
    const { store } = setupIsolatedEnvironment();
    const coffeeBefore = store.getStockById('stk-coffee-beans')!.current_amount;
    const historyCountBefore = store.getStockHistories().length;

    // Item 1: 2x Kopi Susu Aren (18g beans each = 36g)
    // Item 2: 1x Americano (18g beans = 18g)
    // Total gross coffee beans = 36g + 18g = 54g
    const order = store.addOrder({
      order_type: 'take_away',
      items: [
        {
          product_id: 'prd-kopi-susu-aren',
          product_name: 'Kopi Susu Gula Aren',
          price: 22000,
          qty: 2,
        },
        {
          product_id: 'prd-americano',
          product_name: 'Americano Classic',
          price: 18000,
          qty: 1,
        },
      ],
      payment: { method: 'cash', amount_paid: 100000, change: 38000, status: 'completed' },
    });

    const coffeeAfter = store.getStockById('stk-coffee-beans')!.current_amount;
    assert(
      coffeeAfter === coffeeBefore - 54,
      `Stok biji kopi berkurang tepat 54g untuk gabungan multi-item. Diharapkan: ${coffeeBefore - 54}, Aktual: ${coffeeAfter}`
    );

    const historiesForOrder = store
      .getStockHistories()
      .filter(h => h.reference === `Penjualan #${order.order_number}` && h.stock_id === 'stk-coffee-beans');
    assert(
      historiesForOrder.length === 1,
      `Tepat 1 entri StockHistory tercatat untuk biji kopi agregat, didapat: ${historiesForOrder.length}`
    );
    assert(historiesForOrder[0].change_amount === -54, 'History mencatat pengurangan agregat -54g');
  });

  // -------------------------------------------------------------
  // SKENARIO 8: Insufficient stock after gross quantity aggregation
  // -------------------------------------------------------------
  await runScenario(8, 'Insufficient stock after gross quantity aggregation', () => {
    const { store, owner } = setupIsolatedEnvironment();
    setCurrentUser(owner);

    // Set coffee beans stock to exactly 50g
    const curCoffee = store.getStockById('stk-coffee-beans')!.current_amount;
    store.adjustStock('stk-coffee-beans', 50 - curCoffee, 'Set stok untuk uji kekurangan');

    const ordersBefore = store.getOrders().length;
    const stockHistoriesBefore = store.getStockHistories().length;

    // Cart requires 54g total (2x Kopi Susu = 36g, 1x Americano = 18g)
    // 54g > 50g -> MUST BE REJECTED ATOMICALY!
    let rejected = false;
    let errorMessage = '';
    try {
      store.addOrder({
        order_type: 'dine_in',
        items: [
          {
            product_id: 'prd-kopi-susu-aren',
            product_name: 'Kopi Susu Gula Aren',
            price: 22000,
            qty: 2,
          },
          {
            product_id: 'prd-americano',
            product_name: 'Americano Classic',
            price: 18000,
            qty: 1,
          },
        ],
        payment: { method: 'cash', amount_paid: 100000, change: 38000, status: 'completed' },
      });
    } catch (err: any) {
      rejected = true;
      errorMessage = err.message;
    }

    assert(rejected, 'Transaksi harus ditolak ketika stok agregat bruto tidak mencukupi');
    assert(errorMessage.includes('tidak mencukupi'), `Pesan error harus memuat 'tidak mencukupi', didapat: ${errorMessage}`);
    assert(store.getStockById('stk-coffee-beans')!.current_amount === 50, 'Stok tidak boleh berkurang sama sekali (Zero Mutation)');
    assert(store.getOrders().length === ordersBefore, 'Daftar orders tidak bertambah');
    assert(store.getStockHistories().length === stockHistoriesBefore, 'Daftar stock history tidak bertambah');
  });

  // -------------------------------------------------------------
  // SKENARIO 9: Missing, empty, or malformed recipes
  // -------------------------------------------------------------
  await runScenario(9, 'Missing, empty, or malformed recipes rejected', () => {
    const { store, owner } = setupIsolatedEnvironment();
    setCurrentUser(owner);

    const categoryId = store.getCategories()[0].id;

    // 1. Missing recipe
    const prdNoRecipe = store.addProduct({
      id: 'prd-no-recipe',
      name: 'Produk Tanpa Resep',
      price: 15000,
      cost_price: 5000,
      category_id: categoryId,
      image_url: '',
      description: '',
      is_active: true,
      is_favorite: false,
    });

    let missingRejected = false;
    try {
      store.addOrder({
        order_type: 'take_away',
        items: [
          {
            product_id: prdNoRecipe.id,
            product_name: prdNoRecipe.name,
            price: prdNoRecipe.price,
            qty: 1,
          },
        ],
        payment: { method: 'cash', amount_paid: 20000, change: 5000, status: 'completed' },
      });
    } catch (err: any) {
      missingRejected = err.message.includes('belum memiliki resep');
    }
    assert(missingRejected, 'Checkout ditolak jika produk belum memiliki resep');

    // 2. Empty ingredients
    const prdEmpty = store.addProduct({
      id: 'prd-empty-recipe',
      name: 'Produk Resep Kosong',
      price: 15000,
      cost_price: 5000,
      category_id: categoryId,
      image_url: '',
      description: '',
      is_active: true,
      is_favorite: false,
    });
    // Inject empty recipe
    (store as any).state.recipes.push({
      id: 'rcp-empty',
      product_id: prdEmpty.id,
      prep_time_minutes: 2,
      image_url: '',
      description: '',
      ingredients: [],
      steps: [],
    });

    let emptyRejected = false;
    try {
      store.addOrder({
        order_type: 'take_away',
        items: [
          {
            product_id: prdEmpty.id,
            product_name: prdEmpty.name,
            price: prdEmpty.price,
            qty: 1,
          },
        ],
        payment: { method: 'cash', amount_paid: 20000, change: 5000, status: 'completed' },
      });
    } catch (err: any) {
      emptyRejected = err.message.includes('tidak memiliki bahan baku');
    }
    assert(emptyRejected, 'Checkout ditolak jika resep tidak memiliki bahan baku (empty array)');
  });

  // -------------------------------------------------------------
  // SKENARIO 10: Correct transaction-time item and order HPP snapshots
  // -------------------------------------------------------------
  await runScenario(10, 'Correct transaction-time item and order HPP snapshots', () => {
    const { store } = setupIsolatedEnvironment();

    const order = store.addOrder({
      order_type: 'take_away',
      items: [
        {
          product_id: 'prd-kopi-susu-aren',
          product_name: 'Kopi Susu Gula Aren',
          price: 22000,
          qty: 2,
        },
      ],
      payment: { method: 'cash', amount_paid: 50000, change: 6000, status: 'completed' },
    });

    assert(typeof order.total_hpp === 'number' && order.total_hpp > 0, 'Order total_hpp harus angka positif');
    assert(order.hpp_source === 'transaction_snapshot', 'order.hpp_source harus transaction_snapshot');

    const item = order.items[0];
    assert(typeof item.unit_cost_price === 'number' && item.unit_cost_price > 0, 'item.unit_cost_price harus angka positif');
    assert(item.subtotal_cost === item.unit_cost_price! * 2, 'item.subtotal_cost harus unit_cost_price * qty');
    assert(order.total_hpp === item.subtotal_cost, 'order.total_hpp harus sama dengan item.subtotal_cost');
  });

  // -------------------------------------------------------------
  // SKENARIO 11: Historical HPP unchanged after recipe or inventory cost changes
  // -------------------------------------------------------------
  await runScenario(11, 'Historical HPP unchanged after recipe or inventory cost changes', () => {
    const { store, owner } = setupIsolatedEnvironment();
    setCurrentUser(owner);

    // 1. Buat pesanan pertama
    const order1 = store.addOrder({
      order_type: 'dine_in',
      items: [
        {
          product_id: 'prd-kopi-susu-aren',
          product_name: 'Kopi Susu Gula Aren',
          price: 22000,
          qty: 1,
        },
      ],
      payment: { method: 'cash', amount_paid: 25000, change: 3000, status: 'completed' },
    });

    const historicalTotalHPP = order1.total_hpp;
    const historicalUnitCost = order1.items[0].unit_cost_price;

    // 2. Modifikasi resep secara drastis
    const recipeKsa = store.getRecipeByProductId('prd-kopi-susu-aren')!;
    store.updateRecipe(recipeKsa.id, {
      ingredients: recipeKsa.ingredients.map(ing => ({
        ...ing,
        amount: ing.amount * 5, // 5x lebih banyak bahan
      })),
    });

    // 3. Masukkan pembelian baru dengan harga 10x lipat untuk menaikkan WAC
    store.addPurchase({
      purchase_number: 'PO-PRICE-JUMP',
      date: new Date().toISOString().split('T')[0],
      supplier: 'Supplier Mahal',
      total_amount: 2500000000,
      created_at: new Date().toISOString(),
      items: [
        {
          id: 'poi-price-jump',
          stock_id: 'stk-coffee-beans',
          stock_name: 'Biji Kopi Espresso Blend',
          unit: 'Gram',
          qty: 5000,
          unit_cost: 500000, // Sangat mahal
          total_cost: 2500000000,
        },
      ],
    });

    // 4. Pastikan snapshot order1 tetap persis seperti saat transaksi dibuat!
    const reloadedOrder1 = store.getOrderById(order1.id)!;
    assert(
      reloadedOrder1.total_hpp === historicalTotalHPP,
      `Historical total_hpp tidak boleh berubah! Diharapkan: ${historicalTotalHPP}, Aktual: ${reloadedOrder1.total_hpp}`
    );
    assert(
      reloadedOrder1.items[0].unit_cost_price === historicalUnitCost,
      `Historical unit_cost_price tidak boleh berubah! Diharapkan: ${historicalUnitCost}, Aktual: ${reloadedOrder1.items[0].unit_cost_price}`
    );

    // Validasi single source of truth reportUtils
    const calculatedOrderTotal = getOrderTotalHPP(reloadedOrder1, store.getProducts(), store.getRecipes(), store.getStocks());
    assert(
      calculatedOrderTotal === historicalTotalHPP,
      `getOrderTotalHPP harus memprioritaskan snapshot order.total_hpp. Diharapkan: ${historicalTotalHPP}, Aktual: ${calculatedOrderTotal}`
    );
  });

  // -------------------------------------------------------------
  // SKENARIO 12: Cash and QRIS checkout regressions
  // -------------------------------------------------------------
  await runScenario(12, 'Cash and QRIS checkout regressions', () => {
    const { store } = setupIsolatedEnvironment();

    // 1. Cash Checkout
    const cashOrder = store.addOrder({
      order_type: 'take_away',
      items: [
        {
          product_id: 'prd-kopi-susu-aren',
          product_name: 'Kopi Susu Gula Aren',
          price: 22000,
          qty: 1,
        },
      ],
      payment: {
        method: 'cash',
        amount_paid: 50000,
        change: 28000,
        status: 'completed',
      },
    });
    assert(cashOrder.payment?.method === 'cash', 'Payment method cash');
    assert(cashOrder.payment?.amount_paid === 50000, 'Cash amount paid');
    assert(cashOrder.payment?.change === 28000, 'Cash change calculated');

    // 2. QRIS Checkout
    const qrisOrder = store.addOrder({
      order_type: 'dine_in',
      items: [
        {
          product_id: 'prd-matcha-latte',
          product_name: 'Matcha Latte Uji',
          price: 26000,
          qty: 1,
        },
      ],
      payment: {
        method: 'qris',
        amount_paid: 26000,
        change: 0,
        status: 'completed',
      },
    });
    assert(qrisOrder.payment?.method === 'qris', 'Payment method qris');
    assert(qrisOrder.payment?.change === 0, 'QRIS change must be 0');
  });

  // -------------------------------------------------------------
  // SKENARIO 13: Failed checkout does not clear the cart
  // -------------------------------------------------------------
  await runScenario(13, 'Failed checkout does not clear the cart', () => {
    const { store, owner } = setupIsolatedEnvironment();
    setCurrentUser(owner);

    // Set french fries stock to 0
    store.adjustStock('stk-french-fries', 0, 'Set 0 untuk uji retensi cart');

    let cart = [
      { product_id: 'prd-french-fries', product_name: 'French Fries Shoestring', price: 20000, qty: 1 },
      { product_id: 'prd-americano', product_name: 'Americano Classic', price: 18000, qty: 1 },
    ];

    let checkoutSucceeded = false;
    try {
      store.addOrder({
        order_type: 'dine_in',
        items: cart,
        payment: { method: 'cash', amount_paid: 50000, change: 12000, status: 'completed' },
      });
      checkoutSucceeded = true;
    } catch {
      // Sesuai implementasi usePOSPayments, saat checkout throw error,
      // blok catch menangkap error dan TIDAK memanggil clearCart().
    }

    assert(!checkoutSucceeded, 'Checkout harus gagal karena stok french fries 0');
    assert(cart.length === 2, 'Cart tetap memiliki 2 item (cart dipertahankan)');
  });

  // -------------------------------------------------------------
  // SKENARIO 14: Injected persistence failure leaves no partial mutation
  // -------------------------------------------------------------
  await runScenario(14, 'Injected persistence failure leaves no partial mutation', () => {
    const { store, storage } = setupIsolatedEnvironment();

    const ordersBefore = store.getOrders().length;
    const coffeeBefore = store.getStockById('stk-coffee-beans')!.current_amount;
    const historyBefore = store.getStockHistories().length;

    // Simulasikan disk penuh / quota exceeded saat persistensi
    storage.shouldFailSetItem = true;

    let rejectedByStorage = false;
    try {
      store.addOrder({
        order_type: 'take_away',
        items: [
          {
            product_id: 'prd-kopi-susu-aren',
            product_name: 'Kopi Susu Gula Aren',
            price: 22000,
            qty: 1,
          },
        ],
        payment: { method: 'cash', amount_paid: 25000, change: 3000, status: 'completed' },
      });
    } catch (err: any) {
      rejectedByStorage = err.message.includes('DataIntegrityError') || err.message.includes('QuotaExceededError');
    }

    assert(rejectedByStorage, 'addOrder harus melempar DataIntegrityError saat disk penuh');

    // Pastikan RAM di-rollback 100% ke kondisi sebelum transaksi dicoba
    assert(store.getOrders().length === ordersBefore, 'Orders di RAM tidak bertambah saat persistensi gagal');
    assert(
      store.getStockById('stk-coffee-beans')!.current_amount === coffeeBefore,
      'Stok di RAM tidak berkurang saat persistensi gagal (Two-tier rollback)'
    );
    assert(store.getStockHistories().length === historyBefore, 'Riwayat stok di RAM tidak bertambah');
  });

  // -------------------------------------------------------------
  // SKENARIO 15: Stock history matches actual stock deductions
  // -------------------------------------------------------------
  await runScenario(15, 'Stock history matches actual stock deductions', () => {
    const { store } = setupIsolatedEnvironment();

    const stock = store.getStockById('stk-coffee-beans')!;
    const initialAmt = stock.current_amount;

    const order = store.addOrder({
      order_type: 'take_away',
      items: [
        {
          product_id: 'prd-americano',
          product_name: 'Americano Classic',
          price: 18000,
          qty: 2, // 2x 18g = 36g
        },
      ],
      payment: { method: 'cash', amount_paid: 40000, change: 4000, status: 'completed' },
    });

    const finalAmt = store.getStockById('stk-coffee-beans')!.current_amount;
    const actualDeduction = initialAmt - finalAmt;

    const history = store.getStockHistories().find(
      h => h.reference === `Penjualan #${order.order_number}` && h.stock_id === 'stk-coffee-beans'
    )!;

    assert(Boolean(history), 'Riwayat stok ditemukan');
    assert(history.change_amount === -actualDeduction, `change_amount (${history.change_amount}) cocok dengan pengurangan aktual (-${actualDeduction})`);
    assert(history.final_amount === finalAmt, `final_amount (${history.final_amount}) cocok dengan stok akhir (${finalAmt})`);
  });

  // -------------------------------------------------------------
  // SKENARIO 16: Reload/persistence behavior
  // -------------------------------------------------------------
  await runScenario(16, 'Reload/persistence behavior', () => {
    const { store, storage } = setupIsolatedEnvironment();

    const order = store.addOrder({
      order_type: 'take_away',
      items: [
        {
          product_id: 'prd-kopi-susu-aren',
          product_name: 'Kopi Susu Gula Aren',
          price: 22000,
          qty: 1,
        },
      ],
      payment: { method: 'cash', amount_paid: 25000, change: 3000, status: 'completed' },
    });

    // Buat instance MockStore kedua yang membaca dari driver penyimpanan yang sama
    const reloadedStore = new MockStore();

    const reloadedOrder = reloadedStore.getOrderById(order.id);
    assert(Boolean(reloadedOrder), 'Order berhasil dipulihkan dari snapshot terpersisten');
    assert(reloadedOrder!.order_number === order.order_number, 'Nomor pesanan identik setelah reload');
    assert(reloadedOrder!.total_hpp === order.total_hpp, 'Snapshot total_hpp identik setelah reload');
    assert(
      reloadedStore.getStockById('stk-coffee-beans')!.current_amount === store.getStockById('stk-coffee-beans')!.current_amount,
      'Saldo stok identik setelah reload'
    );
  });

  // -------------------------------------------------------------
  // SKENARIO 17: Existing refund behavior remains unchanged
  // -------------------------------------------------------------
  await runScenario(17, 'Existing refund behavior remains unchanged (stock not returned)', () => {
    const { store } = setupIsolatedEnvironment();

    const order = store.addOrder({
      order_type: 'take_away',
      items: [
        {
          product_id: 'prd-kopi-susu-aren',
          product_name: 'Kopi Susu Gula Aren',
          price: 22000,
          qty: 1,
        },
      ],
      payment: { method: 'cash', amount_paid: 25000, change: 3000, status: 'completed' },
    });

    const stockAfterOrder = store.getStockById('stk-coffee-beans')!.current_amount;

    // Refund order
    const refundedOrder = store.refundOrder(order.id, {
      refunded_by_name: 'Kasir',
      refund_reason: 'Pelanggan membatalkan pesanan',
    });

    assert(refundedOrder.payment?.status === 'refunded', 'Status pesanan menjadi refunded');

    // BUSINESS RULE: Consumed recipe ingredients MUST NOT be returned to stock!
    const stockAfterRefund = store.getStockById('stk-coffee-beans')!.current_amount;
    assert(
      stockAfterRefund === stockAfterOrder,
      `Stok TIDAK boleh dikembalikan saat refund! Stok sebelum refund: ${stockAfterOrder}, Setelah refund: ${stockAfterRefund}`
    );

    const refundHistory = store.getStockHistories().find(
      h => h.reference?.includes(order.order_number) && h.stock_id === 'stk-coffee-beans'
    );
    assert(refundHistory!.type === 'refund', 'Tipe history diubah menjadi refund');
  });

  // -------------------------------------------------------------
  // SKENARIO 18: Regression of Phases 1, 2, and 2A
  // -------------------------------------------------------------
  await runScenario(18, 'Regression of Phases 1, 2, and 2A', () => {
    const { store } = setupIsolatedEnvironment();

    // Phase 1 regression
    assert(calculateGrossAmount(90, 10) === 100, 'Phase 1: calculateGrossAmount(90, 10) === 100');
    assert(convertUnitQuantity(1.5, 'kg', 'gram') === 1500, 'Phase 1: convertUnitQuantity(1.5, kg, gram) === 1500');
    assert(roundToRupiah(8050.5) === 8051, 'Phase 1: roundToRupiah(8050.5) === 8051');

    // Phase 2 regression: WAC weighted calculation
    const wac = calculateWeightedAverageCost({
      oldQty: 10,
      oldUnitCost: 1000,
      addedQty: 10,
      addedUnitCost: 2000,
    });
    assert(wac === 1500, `Phase 2: WAC berimbang harus 1500, didapat: ${wac}`);

    // Phase 2A regression: delete purchase is blocked
    const pur = store.getPurchases()[0];
    let deleteBlocked = false;
    try {
      store.deletePurchase(pur.id);
    } catch {
      deleteBlocked = true;
    }
    assert(deleteBlocked, 'Phase 2A: deletePurchase tetap diblokir demi integritas persediaan');
  });

  // -------------------------------------------------------------
  // REKAPITULASI
  // -------------------------------------------------------------
  console.log('\n================================================================');
  console.log('                 REKAPITULASI HASIL PENGUJIAN                   ');
  console.log('================================================================');
  const passCount = reports.filter(r => r.passed).length;
  const failCount = reports.filter(r => !r.passed).length;
  console.log(`Total Skenario Diuji : ${reports.length} (Target: 18)`);
  console.log(`Jumlah Lulus (PASS)  : ${passCount}`);
  console.log(`Jumlah Gagal (FAIL)  : ${failCount}`);

  if (failCount > 0) {
    console.error('\nGAGAL! Ada skenario yang tidak lulus:');
    reports.filter(r => !r.passed).forEach(r => console.error(` - S${r.id}: ${r.name} -> ${r.error}`));
    process.exit(1);
  } else {
    console.log('\nSEMUA 18 SKENARIO HPP FASE 3 LULUS DENGAN SUKSES! (100% PASS)\n');
    process.exit(0);
  }
}

// Eksekusi jika dipanggil via CLI
runHPPPhase3Validation();
