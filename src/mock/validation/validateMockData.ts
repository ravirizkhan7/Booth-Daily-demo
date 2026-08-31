import { mockStore } from '../store';
import { initialUsers } from '../data/users';
import { initialCategories } from '../data/categories';
import { initialProducts } from '../data/products';
import { initialStocks } from '../data/stocks';
import { initialRecipes } from '../data/recipes';
import { initialOrders } from '../data/orders';
import { initialPurchases } from '../data/purchases';
import { initialStockHistories } from '../data/stockHistories';
import { initialDiscountRules } from '../data/discountRules';
import { initialSettings } from '../data/settings';

export interface ValidationReport {
  referentialIntegrity: boolean;
  businessRules: boolean;
  recipeCoverage: boolean;
  orderIntegrity: boolean;
  persistenceSchema: boolean;
  errors: string[];
}

export function validateMockData(): ValidationReport {
  const errors: string[] = [];

  const users = initialUsers;
  const categories = initialCategories;
  const products = initialProducts;
  const stocks = initialStocks;
  const recipes = initialRecipes;
  const orders = initialOrders;
  const purchases = initialPurchases;
  const stockHistories = initialStockHistories;
  const discountRules = initialDiscountRules;
  const settings = initialSettings;

  const categoryIds = new Set(categories.map(c => String(c.id)));
  const productIds = new Set(products.map(p => String(p.id)));
  const stockIds = new Set(stocks.map(s => String(s.id)));
  const userIds = new Set(users.map(u => String(u.id)));

  // 1. REFERENTIAL INTEGRITY
  // 1a. Products -> Category
  products.forEach(p => {
    if (!categoryIds.has(String(p.category_id))) {
      errors.push(`[Referential] Product "${p.name}" (ID: ${p.id}) has invalid category_id: ${p.category_id}`);
    }
  });

  // 1b. Recipes -> Product & Stock
  recipes.forEach(r => {
    if (!productIds.has(String(r.product_id))) {
      errors.push(`[Referential] Recipe (ID: ${r.id}) references unknown product_id: ${r.product_id}`);
    }
    if (!Array.isArray(r.ingredients) || r.ingredients.length === 0) {
      errors.push(`[Referential] Recipe for product ${r.product_id} has no ingredients`);
    } else {
      r.ingredients.forEach(ing => {
        if (!stockIds.has(String(ing.stock_id))) {
          errors.push(`[Referential] Recipe (ID: ${r.id}) ingredient "${ing.stock_name}" has invalid stock_id: ${ing.stock_id}`);
        }
      });
    }
  });

  // 1c. Orders -> Product & User
  orders.forEach(o => {
    if (o.created_by_user_id && !userIds.has(String(o.created_by_user_id))) {
      errors.push(`[Referential] Order "${o.order_number}" references unknown user_id: ${o.created_by_user_id}`);
    }
    if (!Array.isArray(o.items) || o.items.length === 0) {
      errors.push(`[Referential] Order "${o.order_number}" has no items`);
    } else {
      o.items.forEach(item => {
        if (!productIds.has(String(item.product_id))) {
          errors.push(`[Referential] Order "${o.order_number}" item "${item.product_name}" references unknown product_id: ${item.product_id}`);
        }
      });
    }
  });

  // 1d. Purchases -> Stock
  purchases.forEach(pur => {
    if (!Array.isArray(pur.items) || pur.items.length === 0) {
      errors.push(`[Referential] Purchase "${pur.purchase_number}" has no items`);
    } else {
      pur.items.forEach(item => {
        if (!stockIds.has(String(item.stock_id))) {
          errors.push(`[Referential] Purchase "${pur.purchase_number}" item "${item.stock_name}" references unknown stock_id: ${item.stock_id}`);
        }
      });
    }
  });

  // 1e. Stock History -> Stock
  stockHistories.forEach(h => {
    if (!stockIds.has(String(h.stock_id))) {
      errors.push(`[Referential] StockHistory (ID: ${h.id}) references unknown stock_id: ${h.stock_id}`);
    }
  });

  const referentialIntegrity = errors.length === 0;
  const refErrorCount = errors.length;

  // 2. BUSINESS RULES
  // 2a. Product prices
  products.forEach(p => {
    if (typeof p.price !== 'number' || p.price < 0) {
      errors.push(`[Business] Product "${p.name}" has invalid price: ${p.price}`);
    }
    if (typeof p.cost_price !== 'number' || p.cost_price < 0) {
      errors.push(`[Business] Product "${p.name}" has invalid cost_price: ${p.cost_price}`);
    }
  });

  // 2b. Stocks
  stocks.forEach(s => {
    if (typeof s.current_amount !== 'number' || s.current_amount < 0) {
      errors.push(`[Business] Stock "${s.name}" has invalid current_amount: ${s.current_amount}`);
    }
    if (typeof s.min_amount !== 'number' || s.min_amount < 0) {
      errors.push(`[Business] Stock "${s.name}" has invalid min_amount: ${s.min_amount}`);
    }
    if (typeof s.cost_per_unit !== 'number' || s.cost_per_unit < 0) {
      errors.push(`[Business] Stock "${s.name}" has invalid cost_per_unit: ${s.cost_per_unit}`);
    }
  });

  // 2c. Recipe amounts
  recipes.forEach(r => {
    if (typeof r.prep_time_minutes !== 'number' || r.prep_time_minutes <= 0) {
      errors.push(`[Business] Recipe (ID: ${r.id}) has invalid prep_time_minutes: ${r.prep_time_minutes}`);
    }
    r.ingredients.forEach(ing => {
      if (typeof ing.amount !== 'number' || ing.amount <= 0) {
        errors.push(`[Business] Recipe (ID: ${r.id}) ingredient "${ing.stock_name}" has non-positive amount: ${ing.amount}`);
      }
    });
  });

  // 2d. Order quantities & math
  orders.forEach(o => {
    if (typeof o.subtotal !== 'number' || o.subtotal < 0) {
      errors.push(`[Business] Order "${o.order_number}" has invalid subtotal: ${o.subtotal}`);
    }
    if (typeof o.total_amount !== 'number' || o.total_amount < 0) {
      errors.push(`[Business] Order "${o.order_number}" has invalid total_amount: ${o.total_amount}`);
    }
    if (!o.payment || typeof o.payment.amount_paid !== 'number' || o.payment.amount_paid < 0) {
      errors.push(`[Business] Order "${o.order_number}" has invalid payment amount_paid`);
    }

    let calculatedSubtotal = 0;
    o.items.forEach(item => {
      if (typeof item.qty !== 'number' || item.qty <= 0) {
        errors.push(`[Business] Order "${o.order_number}" item "${item.product_name}" has non-positive qty: ${item.qty}`);
      }
      calculatedSubtotal += item.price * item.qty;
    });

    if (calculatedSubtotal !== o.subtotal) {
      errors.push(`[Business] Order "${o.order_number}" item sum (${calculatedSubtotal}) does not match order subtotal (${o.subtotal})`);
    }
  });

  const businessRules = errors.length === refErrorCount;
  const bizErrorCount = errors.length;

  // 3. RECIPE COVERAGE
  const coveredProductIds = new Set(recipes.map(r => String(r.product_id)));
  const sellableActiveProducts = products.filter(p => p.is_active);
  let uncoveredCount = 0;

  sellableActiveProducts.forEach(p => {
    if (!coveredProductIds.has(String(p.id))) {
      errors.push(`[RecipeCoverage] Active sellable product "${p.name}" (ID: ${p.id}) has NO recipe!`);
      uncoveredCount++;
    }
  });

  const recipeCoverage = uncoveredCount === 0;
  const recipeErrorCount = errors.length;

  // 4. ORDER INTEGRITY
  let orderIntegrity = true;
  if (orders.length < 30) {
    errors.push(`[OrderIntegrity] Insufficient historical orders (${orders.length}). Minimum 30 required for 30-day reporting.`);
    orderIntegrity = false;
  }

  // Verify orders span multiple dates
  const orderDates = new Set(orders.map(o => o.created_at.slice(0, 10)));
  if (orderDates.size < 7) {
    errors.push(`[OrderIntegrity] Orders only span ${orderDates.size} distinct days. Must be distributed across the month.`);
    orderIntegrity = false;
  }

  // 5. PERSISTENCE SCHEMA VALIDATION
  const snapshot = mockStore.getSnapshot();
  let persistenceSchema = true;
  if (
    !snapshot.users || snapshot.users.length !== users.length ||
    !snapshot.categories || snapshot.categories.length !== categories.length ||
    !snapshot.products || snapshot.products.length !== products.length ||
    !snapshot.stocks || snapshot.stocks.length !== stocks.length ||
    !snapshot.recipes || snapshot.recipes.length !== recipes.length ||
    !snapshot.orders || snapshot.orders.length !== orders.length ||
    !snapshot.purchases || snapshot.purchases.length !== purchases.length ||
    !snapshot.stockHistories || snapshot.stockHistories.length !== stockHistories.length ||
    !snapshot.discountRules || snapshot.discountRules.length !== discountRules.length ||
    !snapshot.settings || snapshot.settings.store_name !== settings.store_name
  ) {
    errors.push(`[PersistenceSchema] Mock store snapshot did not match expected structure or counts.`);
    persistenceSchema = false;
  }

  return {
    referentialIntegrity,
    businessRules,
    recipeCoverage,
    orderIntegrity,
    persistenceSchema,
    errors,
  };
}

// Direct CLI Execution
if (import.meta.url.endsWith('validateMockData.ts') || process.argv[1]?.includes('validateMockData')) {
  console.log('====================================================');
  console.log('    BOOTH DAILY — MOCK DATA VALIDATION SUITE');
  console.log('====================================================');

  console.log(`Users           : ${initialUsers.length} (1 Owner, ${initialUsers.length - 1} Karyawan)`);
  console.log(`Categories      : ${initialCategories.length}`);
  console.log(`Products        : ${initialProducts.length}`);
  console.log(`Stocks          : ${initialStocks.length}`);
  console.log(`Recipes         : ${initialRecipes.length}`);
  console.log(`Orders          : ${initialOrders.length}`);
  console.log(`Purchases       : ${initialPurchases.length}`);
  console.log(`Stock Histories : ${initialStockHistories.length}`);
  console.log(`Discount Rules  : ${initialDiscountRules.length}`);
  console.log(`Settings        : "${initialSettings.store_name}" (Tax: ${initialSettings.tax_percentage}%)`);
  console.log('----------------------------------------------------');

  const report = validateMockData();

  console.log(`Referential Integrity : ${report.referentialIntegrity ? 'PASS' : 'FAIL'}`);
  console.log(`Business Rules        : ${report.businessRules ? 'PASS' : 'FAIL'}`);
  console.log(`Recipe Coverage       : ${report.recipeCoverage ? 'PASS (100% of products covered)' : 'FAIL'}`);
  console.log(`Order Integrity       : ${report.orderIntegrity ? 'PASS' : 'FAIL'}`);
  console.log(`Persistence Schema    : ${report.persistenceSchema ? 'PASS' : 'FAIL'}`);
  console.log('----------------------------------------------------');

  if (report.errors.length > 0) {
    console.error(`\nVALIDATION FAILED WITH ${report.errors.length} ERROR(S):`);
    report.errors.forEach((err, idx) => {
      console.error(`  ${idx + 1}. ${err}`);
    });
    console.log('====================================================');
    process.exit(1);
  } else {
    console.log('OVERALL STATUS        : ALL CHECKS PASSED (EXIT 0)');
    console.log('====================================================\n');
    process.exit(0);
  }
}
