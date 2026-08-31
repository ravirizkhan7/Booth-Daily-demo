import {
  User,
  Category,
  Product,
  Stock,
  StockHistory,
  Recipe,
  Order,
  Purchase,
  DiscountRule,
  Settings,
} from '../types';
import { MockStoreState } from './types';
import { initialUsers } from './data/users';
import { initialCategories } from './data/categories';
import { initialStocks } from './data/stocks';
import { initialStockHistories } from './data/stockHistories';
import { initialProducts } from './data/products';
import { initialRecipes } from './data/recipes';
import { initialOrders } from './data/orders';
import { initialPurchases } from './data/purchases';
import { initialDiscountRules } from './data/discountRules';
import { initialSettings } from './data/settings';
import {
  loadPersistedSnapshot,
  savePersistedSnapshot,
  clearPersistedSnapshot,
} from './persistence/storage';

/**
 * Deep clone utility to ensure callers receive isolated copies of data.
 */
function deepClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

export class MockStore {
  private state: MockStoreState;

  constructor() {
    this.state = this.initInitialState();
  }

  private initInitialState(): MockStoreState {
    const persisted = loadPersistedSnapshot();
    if (persisted) {
      return persisted;
    }

    return {
      users: deepClone(initialUsers),
      categories: deepClone(initialCategories),
      products: deepClone(initialProducts),
      stocks: deepClone(initialStocks),
      stockHistories: deepClone(initialStockHistories),
      recipes: deepClone(initialRecipes),
      orders: deepClone(initialOrders),
      purchases: deepClone(initialPurchases),
      discountRules: deepClone(initialDiscountRules),
      settings: deepClone(initialSettings),
    };
  }

  private persist(): void {
    savePersistedSnapshot(this.state);
  }

  // ----------------------------------------------------
  // RESET / SNAPSHOT
  // ----------------------------------------------------
  public resetMockStore(): void {
    clearPersistedSnapshot();
    this.state = {
      users: deepClone(initialUsers),
      categories: deepClone(initialCategories),
      products: deepClone(initialProducts),
      stocks: deepClone(initialStocks),
      stockHistories: deepClone(initialStockHistories),
      recipes: deepClone(initialRecipes),
      orders: deepClone(initialOrders),
      purchases: deepClone(initialPurchases),
      discountRules: deepClone(initialDiscountRules),
      settings: deepClone(initialSettings),
    };
    this.persist();
  }

  public getSnapshot(): MockStoreState {
    return deepClone(this.state);
  }

  // ----------------------------------------------------
  // USERS
  // ----------------------------------------------------
  public getUsers(): User[] {
    return deepClone(this.state.users);
  }

  public getUserById(id: string): User | undefined {
    const user = this.state.users.find(u => String(u.id) === String(id));
    return user ? deepClone(user) : undefined;
  }

  public getUserByEmail(email: string): User | undefined {
    const user = this.state.users.find(
      u => u.email.toLowerCase() === email.toLowerCase()
    );
    return user ? deepClone(user) : undefined;
  }

  public getUserByPin(pin: string): User | undefined {
    const user = this.state.users.find(
      u => u.pin === pin && u.is_active
    );
    return user ? deepClone(user) : undefined;
  }

  public addUser(userData: Omit<User, 'id'> & { id?: string }): User {
    const emailLower = (userData.email || '').trim().toLowerCase();
    if (this.state.users.some(u => u.email.trim().toLowerCase() === emailLower)) {
      throw new Error('Email sudah digunakan oleh pengguna lain');
    }
    if (userData.pin && this.state.users.some(u => u.pin === userData.pin)) {
      throw new Error('PIN sudah digunakan oleh pengguna lain');
    }
    const newUser: User = {
      ...userData,
      id: userData.id || `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      email: emailLower,
      password: userData.password || 'demo123',
      is_active: userData.is_active ?? true,
    };
    this.state.users.push(newUser);
    this.persist();
    return deepClone(newUser);
  }

  public updateUser(id: string, userData: Partial<User>): User {
    const index = this.state.users.findIndex(u => String(u.id) === String(id));
    if (index === -1) {
      throw new Error(`User with ID ${id} not found`);
    }
    if (userData.email) {
      const emailLower = userData.email.trim().toLowerCase();
      if (
        this.state.users.some(
          u => String(u.id) !== String(id) && u.email.trim().toLowerCase() === emailLower
        )
      ) {
        throw new Error('Email sudah digunakan oleh pengguna lain');
      }
    }
    if (userData.pin) {
      if (
        this.state.users.some(
          u => String(u.id) !== String(id) && u.pin === userData.pin
        )
      ) {
        throw new Error('PIN sudah digunakan oleh pengguna lain');
      }
    }
    const updated: User = {
      ...this.state.users[index],
      ...userData,
      id: this.state.users[index].id,
    };
    this.state.users[index] = updated;
    this.persist();
    return deepClone(updated);
  }

  public deleteUser(id: string): boolean {
    if (String(id) === 'usr-owner-01') {
      throw new Error('Akun Owner utama tidak dapat dihapus');
    }
    const initialLen = this.state.users.length;
    this.state.users = this.state.users.filter(u => String(u.id) !== String(id));
    const deleted = this.state.users.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  // ----------------------------------------------------
  // CATEGORIES
  // ----------------------------------------------------
  public getCategories(): Category[] {
    return deepClone(this.state.categories);
  }

  public getCategoryById(id: string): Category | undefined {
    const cat = this.state.categories.find(c => String(c.id) === String(id));
    return cat ? deepClone(cat) : undefined;
  }

  public addCategory(catData: Omit<Category, 'id' | 'slug'> & { slug?: string; id?: string }): Category {
    const slug = catData.slug || catData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    const newCategory: Category = {
      ...catData,
      id: catData.id || `cat-${Date.now()}`,
      slug,
      icon_name: catData.icon_name || 'Tag',
    };
    this.state.categories.push(newCategory);
    this.persist();
    return deepClone(newCategory);
  }

  public updateCategory(id: string, catData: Partial<Category>): Category {
    const index = this.state.categories.findIndex(c => String(c.id) === String(id));
    if (index === -1) {
      throw new Error(`Category with ID ${id} not found`);
    }
    const updated: Category = {
      ...this.state.categories[index],
      ...catData,
      id: this.state.categories[index].id,
    };
    if (catData.name && !catData.slug) {
      updated.slug = catData.name.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
    }
    this.state.categories[index] = updated;
    this.persist();
    return deepClone(updated);
  }

  public deleteCategory(id: string): boolean {
    const isUsed = this.state.products.some(p => String(p.category_id) === String(id));
    if (isUsed) {
      throw new Error('Kategori tidak dapat dihapus karena masih digunakan oleh produk aktif');
    }
    const initialLen = this.state.categories.length;
    this.state.categories = this.state.categories.filter(c => String(c.id) !== String(id));
    const deleted = this.state.categories.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  // ----------------------------------------------------
  // PRODUCTS
  // ----------------------------------------------------
  public getProducts(): Product[] {
    return deepClone(this.state.products);
  }

  public getProductById(id: string): Product | undefined {
    const product = this.state.products.find(p => String(p.id) === String(id));
    return product ? deepClone(product) : undefined;
  }

  public addProduct(productData: Omit<Product, 'id'> & { id?: string }): Product {
    const catExists = this.state.categories.some(c => String(c.id) === String(productData.category_id));
    if (!catExists) {
      throw new Error('Kategori yang dipilih tidak valid');
    }
    const newProduct: Product = {
      ...productData,
      id: productData.id || `prd-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      category_id: String(productData.category_id),
      price: Number(productData.price) || 0,
      cost_price: Number(productData.cost_price) || 0,
      is_active: productData.is_active ?? true,
      is_favorite: productData.is_favorite ?? false,
    };
    this.state.products.push(newProduct);
    this.persist();
    return deepClone(newProduct);
  }

  public updateProduct(id: string, productData: Partial<Product>): Product {
    const index = this.state.products.findIndex(p => String(p.id) === String(id));
    if (index === -1) {
      throw new Error(`Product with ID ${id} not found`);
    }
    if (productData.category_id !== undefined) {
      const catExists = this.state.categories.some(c => String(c.id) === String(productData.category_id));
      if (!catExists) {
        throw new Error('Kategori yang dipilih tidak valid');
      }
    }
    const updated: Product = {
      ...this.state.products[index],
      ...productData,
      id: this.state.products[index].id,
      category_id: productData.category_id !== undefined ? String(productData.category_id) : this.state.products[index].category_id,
      price: productData.price !== undefined ? Number(productData.price) : this.state.products[index].price,
      cost_price: productData.cost_price !== undefined ? Number(productData.cost_price) : this.state.products[index].cost_price,
    };
    this.state.products[index] = updated;
    this.persist();
    return deepClone(updated);
  }

  public deleteProduct(id: string): boolean {
    const initialLen = this.state.products.length;
    this.state.products = this.state.products.filter(p => String(p.id) !== String(id));
    this.state.recipes = this.state.recipes.filter(r => String(r.product_id) !== String(id));
    const deleted = this.state.products.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  public toggleProductFavorite(id: string): { is_favorite: boolean } {
    const index = this.state.products.findIndex(p => String(p.id) === String(id));
    if (index === -1) {
      throw new Error(`Product with ID ${id} not found`);
    }
    const current = Boolean(this.state.products[index].is_favorite);
    this.state.products[index].is_favorite = !current;
    this.persist();
    return { is_favorite: !current };
  }

  // ----------------------------------------------------
  // STOCKS
  // ----------------------------------------------------
  public getStocks(): Stock[] {
    return deepClone(this.state.stocks);
  }

  public getStockById(id: string): Stock | undefined {
    const stock = this.state.stocks.find(s => String(s.id) === String(id));
    return stock ? deepClone(stock) : undefined;
  }

  public addStock(stockData: Omit<Stock, 'id'> & { id?: string }): Stock {
    const newStock: Stock = {
      ...stockData,
      id: stockData.id || `stk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      current_amount: Number(stockData.current_amount) || 0,
      min_amount: Number(stockData.min_amount) || 0,
      cost_per_unit: Number(stockData.cost_per_unit) || 0,
    };
    this.state.stocks.push(newStock);
    this.persist();
    return deepClone(newStock);
  }

  public updateStock(id: string, stockData: Partial<Stock>): Stock {
    const index = this.state.stocks.findIndex(s => String(s.id) === String(id));
    if (index === -1) {
      throw new Error(`Stock with ID ${id} not found`);
    }
    const updated: Stock = {
      ...this.state.stocks[index],
      ...stockData,
      id: this.state.stocks[index].id,
      current_amount: stockData.current_amount !== undefined ? Number(stockData.current_amount) : this.state.stocks[index].current_amount,
      min_amount: stockData.min_amount !== undefined ? Number(stockData.min_amount) : this.state.stocks[index].min_amount,
      cost_per_unit: stockData.cost_per_unit !== undefined ? Number(stockData.cost_per_unit) : this.state.stocks[index].cost_per_unit,
    };
    this.state.stocks[index] = updated;
    this.persist();
    return deepClone(updated);
  }

  public deleteStock(id: string): boolean {
    const isUsedInRecipe = this.state.recipes.some(r =>
      Array.isArray(r.ingredients) && r.ingredients.some(i => String(i.stock_id) === String(id))
    );
    if (isUsedInRecipe) {
      throw new Error('Bahan baku tidak dapat dihapus karena masih digunakan dalam resep produk');
    }
    const initialLen = this.state.stocks.length;
    this.state.stocks = this.state.stocks.filter(s => String(s.id) !== String(id));
    const deleted = this.state.stocks.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  public adjustStock(
    stockId: string,
    changeAmount: number,
    reason: string,
    userName: string = 'Owner'
  ): Stock {
    const index = this.state.stocks.findIndex(s => String(s.id) === String(stockId));
    if (index === -1) {
      throw new Error(`Stock with ID ${stockId} not found`);
    }
    const stock = this.state.stocks[index];
    if (stock.current_amount + changeAmount < 0) {
      throw new Error('Penyesuaian gagal: stok tidak boleh menjadi negatif');
    }
    const newAmount = stock.current_amount + changeAmount;
    stock.current_amount = newAmount;

    // Record stock history entry
    const historyEntry: StockHistory = {
      id: `sth-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      stock_id: stock.id,
      stock_name: stock.name,
      change_amount: changeAmount,
      unit: stock.unit,
      type: 'penyesuaian',
      reference: reason,
      user_name: userName,
      final_amount: newAmount,
      created_at: new Date().toISOString(),
    };
    this.state.stockHistories.unshift(historyEntry);

    this.persist();
    return deepClone(stock);
  }

  // ----------------------------------------------------
  // STOCK HISTORIES
  // ----------------------------------------------------
  public getStockHistories(): StockHistory[] {
    return deepClone(this.state.stockHistories);
  }

  // ----------------------------------------------------
  // RECIPES
  // ----------------------------------------------------
  public getRecipes(): Recipe[] {
    return deepClone(this.state.recipes);
  }

  public getRecipeById(id: string): Recipe | undefined {
    const recipe = this.state.recipes.find(r => String(r.id) === String(id));
    return recipe ? deepClone(recipe) : undefined;
  }

  public getRecipeByProductId(productId: string): Recipe | undefined {
    const recipe = this.state.recipes.find(r => String(r.product_id) === String(productId));
    return recipe ? deepClone(recipe) : undefined;
  }

  public addRecipe(recipeData: Omit<Recipe, 'id'> & { id?: string }): Recipe {
    const product = this.state.products.find(p => String(p.id) === String(recipeData.product_id));
    if (!product) {
      throw new Error('Produk untuk resep tidak ditemukan');
    }
    const existing = this.state.recipes.find(
      r => String(r.product_id) === String(recipeData.product_id)
    );
    if (existing) {
      throw new Error(`Resep untuk produk "${product.name}" sudah ada`);
    }

    if (Array.isArray(recipeData.ingredients)) {
      for (const ing of recipeData.ingredients) {
        const stock = this.state.stocks.find(s => String(s.id) === String(ing.stock_id));
        if (!stock) {
          throw new Error(`Bahan baku dengan ID ${ing.stock_id} tidak ditemukan`);
        }
        if (Number(ing.amount) <= 0) {
          throw new Error('Jumlah takaran bahan baku harus lebih besar dari 0');
        }
      }
    }

    const newRecipe: Recipe = {
      ...recipeData,
      id: recipeData.id || `rcp-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    this.state.recipes.push(newRecipe);
    this.persist();
    return deepClone(newRecipe);
  }

  public updateRecipe(id: string, recipeData: Partial<Recipe>): Recipe {
    const index = this.state.recipes.findIndex(r => String(r.id) === String(id));
    if (index === -1) {
      throw new Error(`Recipe with ID ${id} not found`);
    }
    if (recipeData.product_id !== undefined) {
      const product = this.state.products.find(p => String(p.id) === String(recipeData.product_id));
      if (!product) {
        throw new Error('Produk untuk resep tidak ditemukan');
      }
    }
    if (Array.isArray(recipeData.ingredients)) {
      for (const ing of recipeData.ingredients) {
        const stock = this.state.stocks.find(s => String(s.id) === String(ing.stock_id));
        if (!stock) {
          throw new Error(`Bahan baku dengan ID ${ing.stock_id} tidak ditemukan`);
        }
        if (Number(ing.amount) <= 0) {
          throw new Error('Jumlah takaran bahan baku harus lebih besar dari 0');
        }
      }
    }
    const updated: Recipe = {
      ...this.state.recipes[index],
      ...recipeData,
      id: this.state.recipes[index].id,
    };
    this.state.recipes[index] = updated;
    this.persist();
    return deepClone(updated);
  }

  public deleteRecipe(id: string): boolean {
    const initialLen = this.state.recipes.length;
    this.state.recipes = this.state.recipes.filter(r => String(r.id) !== String(id));
    const deleted = this.state.recipes.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  // ----------------------------------------------------
  // ORDERS
  // ----------------------------------------------------
  public getOrders(params?: {
    date?: string;
    start_date?: string;
    end_date?: string;
    payment_method?: string;
    order_type?: string;
    limit?: number;
  }): Order[] {
    let result = [...this.state.orders];

    if (params?.date) {
      result = result.filter(o => o.created_at.startsWith(params.date!));
    }
    if (params?.start_date) {
      const start = new Date(params.start_date);
      start.setHours(0, 0, 0, 0);
      result = result.filter(o => new Date(o.created_at) >= start);
    }
    if (params?.end_date) {
      const end = new Date(params.end_date);
      end.setHours(23, 59, 59, 999);
      result = result.filter(o => new Date(o.created_at) <= end);
    }
    if (params?.payment_method && params.payment_method !== 'all') {
      result = result.filter(o => o.payment?.method === params.payment_method);
    }
    if (params?.order_type && params.order_type !== 'all') {
      result = result.filter(o => o.order_type === params.order_type);
    }

    // Sort newest first
    result.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    if (params?.limit && params.limit > 0) {
      result = result.slice(0, params.limit);
    }

    return deepClone(result);
  }

  public getOrderById(id: string): Order | undefined {
    const order = this.state.orders.find(o => String(o.id) === String(id));
    return order ? deepClone(order) : undefined;
  }

  /**
   * Add a new order atomically to the mock store:
   * 1. Auto-generate sequential unique order_number (ORD-YYYYMMDD-XXXX) if not provided.
   * 2. Pre-validate stock availability for all aggregated recipe ingredients across all items.
   * 3. Atomically deduct ingredient stock and record StockHistory entries ('penjualan').
   * 4. Prepend order to orders collection and persist to storage.
   * If any precondition fails, aborts immediately without any state mutations.
   */
  public addOrder(orderData: Omit<Order, 'id'> & { id?: string; order_number?: string }): Order {
    const items = Array.isArray(orderData.items) ? orderData.items : [];

    // Calculate aggregated ingredient requirements across all items
    const requiredMap = new Map<string, { stockId: string; stockName: string; amount: number; unit: string }>();

    for (const item of items) {
      const recipe = this.state.recipes.find(r => String(r.product_id) === String(item.product_id));
      if (!recipe) {
        throw new Error(`Produk "${item.product_name}" belum memiliki resep yang valid`);
      }

      if (Array.isArray(recipe.ingredients)) {
        for (const ing of recipe.ingredients) {
          const stockId = String(ing.stock_id);
          const consumed = ing.amount * item.qty;
          const existing = requiredMap.get(stockId);

          if (existing) {
            existing.amount += consumed;
          } else {
            requiredMap.set(stockId, {
              stockId,
              stockName: ing.stock_name,
              amount: consumed,
              unit: ing.unit,
            });
          }
        }
      }
    }

    const requirements = Array.from(requiredMap.values());

    // Pre-validate stock sufficiency BEFORE modifying any state
    for (const req of requirements) {
      const stock = this.state.stocks.find(s => String(s.id) === req.stockId);
      if (!stock) {
        throw new Error(`Bahan baku "${req.stockName}" (ID: ${req.stockId}) tidak ditemukan di inventaris`);
      }
      if (stock.current_amount < req.amount) {
        throw new Error(
          `Stok bahan baku "${stock.name}" tidak mencukupi! Dibutuhkan ${req.amount} ${stock.unit}, namun hanya tersisa ${stock.current_amount} ${stock.unit}.`
        );
      }
    }

    // Generate deterministic sequential order number if needed (ORD-YYYYMMDD-XXXX)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;
    const prefix = `ORD-${dateStr}-`;

    let maxSeq = 0;
    this.state.orders.forEach(o => {
      if (o.order_number && o.order_number.startsWith(prefix)) {
        const parts = o.order_number.split('-');
        if (parts.length === 3) {
          const seq = parseInt(parts[2], 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      }
    });

    const generatedOrderNumber = `${prefix}${String(maxSeq + 1).padStart(4, '0')}`;
    const orderNumber = orderData.order_number || generatedOrderNumber;
    const orderId = orderData.id || `ord-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newOrder: Order = {
      ...orderData,
      id: orderId,
      order_number: orderNumber,
      payment: {
        ...orderData.payment,
        order_id: orderId,
      },
    };

    // Execute atomic mutations
    for (const req of requirements) {
      const stockIndex = this.state.stocks.findIndex(s => String(s.id) === req.stockId);
      if (stockIndex !== -1) {
        this.state.stocks[stockIndex].current_amount = Math.max(
          0,
          this.state.stocks[stockIndex].current_amount - req.amount
        );

        this.state.stockHistories.unshift({
          id: `sth-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
          stock_id: req.stockId,
          stock_name: req.stockName,
          change_amount: -req.amount,
          unit: req.unit,
          type: 'penjualan',
          reference: `Penjualan #${newOrder.order_number}`,
          user_name: newOrder.created_by_name || 'Kasir',
          final_amount: this.state.stocks[stockIndex].current_amount,
          created_at: newOrder.created_at || new Date().toISOString(),
        });
      }
    }

    this.state.orders.unshift(newOrder);
    this.persist();
    return deepClone(newOrder);
  }

  public updateOrder(id: string, orderData: Partial<Order>): Order {
    const index = this.state.orders.findIndex(o => String(o.id) === String(id));
    if (index === -1) {
      throw new Error(`Order with ID ${id} not found`);
    }
    const updated: Order = {
      ...this.state.orders[index],
      ...orderData,
      id: this.state.orders[index].id,
    };
    this.state.orders[index] = updated;
    this.persist();
    return deepClone(updated);
  }

  public refundOrder(id: string): Order {
    const index = this.state.orders.findIndex(o => String(o.id) === String(id));
    if (index === -1) {
      throw new Error(`Order with ID ${id} not found`);
    }
    const order = this.state.orders[index];
    if (order.payment?.status === 'refunded') {
      throw new Error('Pesanan sudah pernah direfund sebelumnya');
    }
    if (order.payment) {
      order.payment.status = 'refunded';
    }

    // Revert stock consumption
    if (Array.isArray(order.items)) {
      order.items.forEach(item => {
        const recipe = this.state.recipes.find(
          r => String(r.product_id) === String(item.product_id)
        );
        if (recipe && Array.isArray(recipe.ingredients)) {
          recipe.ingredients.forEach(ing => {
            const stockIndex = this.state.stocks.findIndex(
              s => String(s.id) === String(ing.stock_id)
            );
            if (stockIndex !== -1) {
              const returned = ing.amount * item.qty;
              this.state.stocks[stockIndex].current_amount += returned;

              // Add refund mutation log
              this.state.stockHistories.unshift({
                id: `sth-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                stock_id: this.state.stocks[stockIndex].id,
                stock_name: this.state.stocks[stockIndex].name,
                change_amount: returned,
                unit: this.state.stocks[stockIndex].unit,
                type: 'penyesuaian',
                reference: `Refund Pesanan #${order.order_number}`,
                user_name: 'Owner',
                final_amount: this.state.stocks[stockIndex].current_amount,
                created_at: new Date().toISOString(),
              });
            }
          });
        }
      });
    }

    this.persist();
    return deepClone(order);
  }

  // ----------------------------------------------------
  // PURCHASES
  // ----------------------------------------------------
  public getPurchases(): Purchase[] {
    return deepClone(this.state.purchases);
  }

  public getPurchaseById(id: string): Purchase | undefined {
    const pur = this.state.purchases.find(p => String(p.id) === String(id));
    return pur ? deepClone(pur) : undefined;
  }

  public addPurchase(purchaseData: Omit<Purchase, 'id'> & { id?: string }): Purchase {
    const newPurchase: Purchase = {
      ...purchaseData,
      id: purchaseData.id || `pur-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    };
    this.state.purchases.unshift(newPurchase);

    // Auto increase stock amounts
    if (Array.isArray(newPurchase.items)) {
      newPurchase.items.forEach(item => {
        const stockIndex = this.state.stocks.findIndex(
          s => String(s.id) === String(item.stock_id)
        );
        if (stockIndex !== -1) {
          this.state.stocks[stockIndex].current_amount += item.qty;
          if (item.unit_cost > 0) {
            this.state.stocks[stockIndex].cost_per_unit = item.unit_cost;
          }

          this.state.stockHistories.unshift({
            id: `sth-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            stock_id: this.state.stocks[stockIndex].id,
            stock_name: this.state.stocks[stockIndex].name,
            change_amount: item.qty,
            unit: item.unit,
            type: 'pembelian',
            reference: `Pembelian #${newPurchase.purchase_number}`,
            user_name: 'Owner',
            final_amount: this.state.stocks[stockIndex].current_amount,
            created_at: newPurchase.date ? `${newPurchase.date}T08:00:00.000Z` : new Date().toISOString(),
          });
        }
      });
    }

    this.persist();
    return deepClone(newPurchase);
  }

  public updatePurchase(id: string, purchaseData: Partial<Purchase>): Purchase {
    const index = this.state.purchases.findIndex(p => String(p.id) === String(id));
    if (index === -1) {
      throw new Error(`Purchase with ID ${id} not found`);
    }
    const updated: Purchase = {
      ...this.state.purchases[index],
      ...purchaseData,
      id: this.state.purchases[index].id,
    };
    this.state.purchases[index] = updated;
    this.persist();
    return deepClone(updated);
  }

  public deletePurchase(id: string): boolean {
    const purchase = this.state.purchases.find(p => String(p.id) === String(id));
    if (!purchase) return false;

    // Revert stock amounts added by this purchase
    if (Array.isArray(purchase.items)) {
      purchase.items.forEach(item => {
        const stockIndex = this.state.stocks.findIndex(
          s => String(s.id) === String(item.stock_id)
        );
        if (stockIndex !== -1) {
          this.state.stocks[stockIndex].current_amount = Math.max(
            0,
            this.state.stocks[stockIndex].current_amount - item.qty
          );
        }
      });
    }

    this.state.purchases = this.state.purchases.filter(p => String(p.id) !== String(id));
    this.persist();
    return true;
  }

  // ----------------------------------------------------
  // DISCOUNT RULES
  // ----------------------------------------------------
  public getDiscountRules(activeOnly: boolean = false): DiscountRule[] {
    const rules = activeOnly
      ? this.state.discountRules.filter(r => Boolean(r.is_active))
      : this.state.discountRules;
    return deepClone(rules);
  }

  public addDiscountRule(payload: {
    name: string;
    minimum_purchase: number;
    discount_percentage: number;
    is_active?: boolean;
  }): DiscountRule {
    const newRule: DiscountRule = {
      id: `disc-${Date.now()}`,
      name: payload.name,
      minimum_purchase: Number(payload.minimum_purchase) || 0,
      discount_percentage: Number(payload.discount_percentage) || 0,
      is_active: payload.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.state.discountRules.push(newRule);
    this.persist();
    return deepClone(newRule);
  }

  public updateDiscountRule(
    id: string | number,
    payload: Partial<DiscountRule>
  ): DiscountRule {
    const index = this.state.discountRules.findIndex(
      r => String(r.id) === String(id)
    );
    if (index === -1) {
      throw new Error(`DiscountRule with ID ${id} not found`);
    }
    const updated: DiscountRule = {
      ...this.state.discountRules[index],
      ...payload,
      id: this.state.discountRules[index].id,
      updated_at: new Date().toISOString(),
    };
    this.state.discountRules[index] = updated;
    this.persist();
    return deepClone(updated);
  }

  public toggleActiveDiscountRule(id: string | number): DiscountRule {
    const index = this.state.discountRules.findIndex(
      r => String(r.id) === String(id)
    );
    if (index === -1) {
      throw new Error(`DiscountRule with ID ${id} not found`);
    }
    const current = Boolean(this.state.discountRules[index].is_active);
    this.state.discountRules[index].is_active = !current;
    this.state.discountRules[index].updated_at = new Date().toISOString();
    this.persist();
    return deepClone(this.state.discountRules[index]);
  }

  public deleteDiscountRule(id: string | number): boolean {
    const initialLen = this.state.discountRules.length;
    this.state.discountRules = this.state.discountRules.filter(
      r => String(r.id) !== String(id)
    );
    const deleted = this.state.discountRules.length < initialLen;
    if (deleted) this.persist();
    return deleted;
  }

  // ----------------------------------------------------
  // SETTINGS
  // ----------------------------------------------------
  public getSettings(): Settings {
    return deepClone(this.state.settings);
  }

  public updateSettings(newSettings: Partial<Settings>): Settings {
    this.state.settings = {
      ...this.state.settings,
      ...newSettings,
      tax_percentage:
        newSettings.tax_percentage !== undefined
          ? Number(newSettings.tax_percentage)
          : this.state.settings.tax_percentage,
    };
    this.persist();
    return deepClone(this.state.settings);
  }
}

// Export singleton instance
export const mockStore = new MockStore();
