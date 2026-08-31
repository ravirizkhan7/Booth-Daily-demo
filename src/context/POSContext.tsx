import React, { createContext, useContext, useEffect, useCallback, useRef, ReactNode } from 'react';
import { Product, Category, Recipe, Order, Stock, Purchase, User, OrderType, PaymentMethod, Settings, StockHistory, DiscountRule } from '../types';
import { productService } from '../services/productService';
import { recipeService } from '../services/recipeService';
import { userService } from '../services/userService';
import { orderService } from '../services/orderService';
import { stockService } from '../services/stockService';
import { discountService } from '../services/discountService';
import { settingsService } from '../services/settingsService';
import { subscribePosPublic, leavePosPublic, subscribePosBooth, leavePosBooth, onEchoConnected } from '../services/echo';

import { usePOSToast } from './pos/usePOSToast';
import { usePOSAuth } from './pos/usePOSAuth';
import { usePOSProducts } from './pos/usePOSProducts';
import { usePOSRecipes } from './pos/usePOSRecipes';
import { usePOSStock } from './pos/usePOSStock';
import { usePOSPurchases } from './pos/usePOSPurchases';
import { usePOSCart, CartItem } from './pos/usePOSCart';
import { usePOSOrders } from './pos/usePOSOrders';
import { usePOSPayments } from './pos/usePOSPayments';
import { usePOSSettings } from './pos/usePOSSettings';
import { usePOSUsers } from './pos/usePOSUsers';
import { usePOSDiscounts } from './pos/usePOSDiscounts';

export type { CartItem };

interface POSContextType {
  currentUser: User | null;
  setCurrentUser: React.Dispatch<React.SetStateAction<User | null>>;
  authReady: boolean;
  products: Product[];
  categories: Category[];
  recipes: Recipe[];
  orders: Order[];
  stocks: Stock[];
  stockHistories: StockHistory[];
  purchases: Purchase[];
  usersList: User[];
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  discountRules: DiscountRule[];
  refreshDiscounts: () => Promise<DiscountRule[]>;
  addDiscountRule: (payload: { name: string; minimum_purchase: number; discount_percentage: number; is_active?: boolean }) => Promise<DiscountRule>;
  editDiscountRule: (id: number | string, payload: { name?: string; minimum_purchase?: number; discount_percentage?: number; is_active?: boolean }) => Promise<DiscountRule>;
  toggleDiscountRuleStatus: (id: number | string) => Promise<DiscountRule>;
  removeDiscountRule: (id: number | string) => Promise<boolean>;

  // POS Workspace state
  cart: CartItem[];
  orderType: OrderType;
  setOrderType: (type: OrderType) => void;
  customerName: string;
  setCustomerName: (name: string) => void;
  selectedCategory: string;
  setSelectedCategory: (catId: string) => void;

  // Auth Modals & Actions
  isLoginModalOpen: boolean;
  openLoginModal: () => void;
  closeLoginModal: () => void;
  isEditAccountModalOpen: boolean;
  openEditAccountModal: () => void;
  closeEditAccountModal: () => void;
  isLogoutModalOpen: boolean;
  openLogoutModal: () => void;
  closeLogoutModal: () => void;
  loginUser: (identifier: string, secret: string) => Promise<{ success: boolean; message: string; user?: User }>;
  logoutUser: () => void;
  updateCurrentUserAccount: (updatedData: Partial<User>, avatarFile?: File | null) => Promise<{ success: boolean; message: string; user?: User }>;

  // Product
  addProduct: (productData: Omit<Product, 'id'>, imageFile?: File | null) => Promise<Product>;
  editProduct: (id: string, productData: Partial<Product>, imageFile?: File | null) => Promise<Product>;
  removeProduct: (id: string) => Promise<boolean>;

  // Category
  addCategory: (categoryData: Omit<Category, 'id' | 'slug'>) => Promise<Category>;
  editCategory: (id: string, categoryData: Partial<Category>) => Promise<Category>;
  removeCategory: (id: string) => Promise<boolean>;

  // Recipe
  saveRecipeData: (recipeData: Omit<Recipe, 'id'>, recipeId?: string, imageFile?: File | null) => Promise<Recipe>;
  removeRecipe: (id: string) => Promise<boolean>;

  // Stock
  addStockItem: (stockData: Omit<Stock, 'id'>) => Promise<Stock>;
  editStockItem: (id: string, stockData: Partial<Stock>) => Promise<Stock>;
  removeStockItem: (id: string) => Promise<boolean>;
  adjustStockQuantity: (stockId: string, changeAmount: number, reason: string) => Promise<Stock>;

  // Purchase
  addPurchase: (purchaseData: Omit<Purchase, 'id'>) => Promise<Purchase>;
  editPurchase: (id: string, purchaseData: Partial<Purchase>) => Promise<Purchase>;
  removePurchase: (id: string) => Promise<boolean>;

  // Cart Actions
  addToCart: (product: Product, quantityToAdd?: number) => void;
  updateCartQty: (productId: string, newQty: number) => void;
  updateCartNotes: (productId: string, notes: string) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;

  selectedRecipe: Recipe | null;
  selectedRecipeProduct: Product | null;
  openRecipeModal: (product: Product) => void;
  closeRecipeModal: () => void;

  // Transaction & PIN
  isPinModalOpen: boolean;
  openPinModal: () => void;
  closePinModal: () => void;
  processPaymentWithPin: (pin: string, paymentMethod: PaymentMethod, amountPaid: number) => Promise<{ success: boolean; message: string; order?: Order }>;
  refundOrder: (orderId: string) => Promise<{ success: boolean; message: string; order?: Order }>;

  // Receipt Modal
  currentReceiptOrder: Order | null;
  isReceiptModalOpen: boolean;
  openReceiptModal: (order: Order) => void;
  closeReceiptModal: () => void;

  // Favorites & Data Reload
  toggleFavorite: (productId: string) => Promise<void>;
  refreshData: () => Promise<boolean>;

  // Toast
  toast: { message: string; type: 'success' | 'error' | 'info' } | null;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Domain 1: Toast
  const { toast, showToast } = usePOSToast();

  // Domain 10: Settings
  const { settings, setSettings } = usePOSSettings();

  // Domain 11: Users List
  const { usersList, setUsersList } = usePOSUsers();

  // Domain 12: Discounts
  const {
    discountRules,
    setDiscountRules,
    refreshDiscounts,
    addDiscountRule,
    editDiscountRule,
    toggleDiscountRuleStatus,
    removeDiscountRule,
    handleDiscountRuleRealtimeChange,
  } = usePOSDiscounts();

  const refreshDataRef = useRef<() => Promise<boolean>>(() => Promise.resolve(false));

  // Domain 2: Auth
  const auth = usePOSAuth({
    showToast,
    onAuthSuccess: async () => {
      if (refreshDataRef.current) {
        await refreshDataRef.current();
      }
    },
    onAuthLogout: () => {
      setPurchases([]);
      setUsersList([]);
      setStockHistories([]);
    },
    onUserUpdated: (updated) => {
      setUsersList(prev => prev.map(u => u.id === updated.id ? updated : u));
    },
  });

  const {
    currentUser,
    setCurrentUser,
    authReady,
    setAuthReady,
    isLoginModalOpen,
    openLoginModal,
    closeLoginModal,
    isEditAccountModalOpen,
    openEditAccountModal,
    closeEditAccountModal,
    isLogoutModalOpen,
    openLogoutModal,
    closeLogoutModal,
    loginUser,
    logoutUser,
    updateCurrentUserAccount,
  } = auth;

  // Domain 3: Products & Categories
  const productsDomain = usePOSProducts({ showToast });
  const {
    products,
    setProducts,
    categories,
    setCategories,
    selectedCategory,
    setSelectedCategory,
    addProduct,
    editProduct,
    removeProduct,
    toggleFavorite,
    addCategory,
    editCategory,
    removeCategory,
    handleProductRealtimeChange,
    handleCategoryRealtimeChange,
  } = productsDomain;

  // Domain 4: Recipes
  const recipesDomain = usePOSRecipes({ showToast });
  const {
    recipes,
    setRecipes,
    selectedRecipe,
    selectedRecipeProduct,
    openRecipeModal,
    closeRecipeModal,
    saveRecipeData,
    removeRecipe,
    handleRecipeRealtimeChange,
  } = recipesDomain;

  // Domain 5: Stock & Histories
  const stockDomain = usePOSStock({ currentUser, showToast });
  const {
    stocks,
    setStocks,
    stockHistories,
    setStockHistories,
    refreshStocksAndHistories,
    addStockItem,
    editStockItem,
    removeStockItem,
    adjustStockQuantity,
    handleStockRealtimeChange,
  } = stockDomain;

  // Domain 6: Purchases
  const purchasesDomain = usePOSPurchases({
    currentUser,
    onStockChange: refreshStocksAndHistories,
    showToast,
  });
  const {
    purchases,
    setPurchases,
    addPurchase,
    editPurchase,
    removePurchase,
    handlePurchaseRealtimeChange,
  } = purchasesDomain;

  // Domain 7: Cart
  const cartDomain = usePOSCart({
    recipes,
    stocks,
    showToast,
  });
  const {
    cart,
    setCart,
    orderType,
    setOrderType,
    customerName,
    setCustomerName,
    addToCart,
    updateCartQty,
    updateCartNotes,
    removeFromCart,
    clearCart,
  } = cartDomain;

  // Domain 8: Orders
  const ordersDomain = usePOSOrders({
    currentUser,
    onStockChange: refreshStocksAndHistories,
    showToast,
  });
  const {
    orders,
    setOrders,
    refundOrder,
    handleOrderCreatedRealtime,
    handleOrderRefundedRealtime,
  } = ordersDomain;

  // Domain 9: Payments
  const paymentsDomain = usePOSPayments({
    cart,
    orderType,
    customerName,
    currentUser,
    clearCart,
    onOrderCreated: (newOrder) => {
      setOrders(prev => [newOrder, ...prev]);
    },
    onStockChange: refreshStocksAndHistories,
    showToast,
  });
  const {
    isPinModalOpen,
    openPinModal,
    closePinModal,
    isReceiptModalOpen,
    openReceiptModal,
    closeReceiptModal,
    currentReceiptOrder,
    processPaymentWithPin,
  } = paymentsDomain;

  // Orchestrator: refreshData
  const refreshData = useCallback(async (): Promise<boolean> => {
    let hasFailures = false;
    let hasSuccesses = false;

    try {
      const [prds, cats, rcps, stks, stgRes, discRes] = await Promise.allSettled([
        productService.getProducts(),
        productService.getCategories(),
        recipeService.getRecipes(),
        stockService.getStocks(),
        settingsService.getSettings(),
        discountService.getDiscountRules(),
      ]);

      if (prds.status === 'fulfilled') {
        setProducts(prds.value);
        hasSuccesses = true;
        try {
          localStorage.setItem('boothdaily_cached_products', JSON.stringify(prds.value));
        } catch {}
      } else {
        hasFailures = true;
        console.warn('GET /products failed:', prds.reason);
      }

      if (cats.status === 'fulfilled') {
        setCategories(cats.value);
        hasSuccesses = true;
        try {
          localStorage.setItem('boothdaily_cached_categories', JSON.stringify(cats.value));
        } catch {}
      } else {
        hasFailures = true;
        console.warn('GET /categories failed:', cats.reason);
      }

      if (rcps.status === 'fulfilled') {
        setRecipes(rcps.value);
        hasSuccesses = true;
      } else {
        hasFailures = true;
        console.warn('GET /recipes failed:', rcps.reason);
      }

      if (stks.status === 'fulfilled') {
        setStocks(stks.value);
        hasSuccesses = true;
        try {
          localStorage.setItem('boothdaily_cached_stocks', JSON.stringify(stks.value));
        } catch {}
      } else {
        hasFailures = true;
        console.warn('GET /stocks failed:', stks.reason);
      }

      if (stgRes.status === 'fulfilled') {
        const settingsData = stgRes.value;

        if (settingsData?.store_name) {
          setSettings(settingsData);
        }
        hasSuccesses = true;
      } else {
        hasFailures = true;
        console.warn('GET /settings failed:', stgRes.reason);
      }

      if (discRes.status === 'fulfilled') {
        setDiscountRules(discRes.value);
        hasSuccesses = true;
      } else {
        console.warn('GET /discount-rules failed:', discRes.reason);
      }

      let authenticatedUser: User | null = null;

      try {
        const me = await userService.getMe();

        if (me?.id) {
          authenticatedUser = me;
          setCurrentUser(prev => {
            if (
              prev &&
              prev.id === me.id &&
              prev.role === me.role &&
              prev.name === me.name &&
              prev.username === me.username &&
              prev.avatar === me.avatar
            ) {
              return prev;
            }
            return me;
          });
          hasSuccesses = true;
        }
      } catch {
        setCurrentUser(null);
      }

      if (!authenticatedUser) {
        return hasSuccesses && !hasFailures;
      }

      const userRole = String(
        authenticatedUser.role ?? ''
      ).toLowerCase();

      const isOwner = userRole === 'owner';
      const isKaryawan =
        userRole === 'karyawan' ||
        userRole === 'employee';

      const dataRequests: PromiseSettledResult<any>[] = await Promise.allSettled([
        orderService.getOrders(),
        stockService.getStockHistories(),
        ...(isOwner
          ? [
            stockService.getPurchases(),
            userService.getUsers(),
          ]
          : []),
      ]);

      const ordersResult = dataRequests[0];
      const stockHistoriesResult = dataRequests[1];

      if (ordersResult.status === 'fulfilled') {
        setOrders(ordersResult.value);
        hasSuccesses = true;
      } else {
        hasFailures = true;
        console.warn('GET /orders failed:', ordersResult.reason);
      }

      if (stockHistoriesResult.status === 'fulfilled') {
        setStockHistories(stockHistoriesResult.value);
        hasSuccesses = true;
      } else {
        hasFailures = true;
        console.warn('GET /stocks/histories failed:', stockHistoriesResult.reason);
      }

      if (isOwner) {
        const purchasesResult = dataRequests[2];
        const usersResult = dataRequests[3];

        if (purchasesResult?.status === 'fulfilled') {
          setPurchases(purchasesResult.value);
          hasSuccesses = true;
        } else if (purchasesResult) {
          hasFailures = true;
          console.warn(
            'GET /purchases failed:',
            purchasesResult.reason
          );
        }

        if (usersResult?.status === 'fulfilled') {
          setUsersList(usersResult.value);
          hasSuccesses = true;
        } else if (usersResult) {
          hasFailures = true;
          console.warn(
            'GET /users failed:',
            usersResult.reason
          );
        }
      } else if (isKaryawan) {
        setPurchases([]);
        setUsersList([]);
      }

      return hasSuccesses && !hasFailures;
    } catch (error) {
      console.error('refreshData unexpected error:', error);
      return false;
    } finally {
      setAuthReady(true);
    }
  }, [
    setProducts,
    setCategories,
    setRecipes,
    setStocks,
    setSettings,
    setDiscountRules,
    setCurrentUser,
    setOrders,
    setStockHistories,
    setPurchases,
    setUsersList,
    setAuthReady,
  ]);

  // Keep refreshDataRef up to date for onAuthSuccess callback
  useEffect(() => {
    refreshDataRef.current = refreshData;
  }, [refreshData]);

  // Initial Data Fetch
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Realtime Reconnect & Data Synchronization Handler
  useEffect(() => {
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const unbind = onEchoConnected(() => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        refreshData();
      }, 1000);
    });

    return () => {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      unbind();
    };
  }, [refreshData]);

  // Public Realtime WebSocket Subscription (pos-public channel for Guest, Karyawan, Owner)
  useEffect(() => {
    const publicChannel = subscribePosPublic();
    if (!publicChannel) {
      return;
    }

    // 1. StockUpdated Listener
    publicChannel.listen('.stock.updated', handleStockRealtimeChange);

    // 2. RecipeChanged Listener
    publicChannel.listen('.recipe.changed', handleRecipeRealtimeChange);

    // 3. ProductChanged Listener
    publicChannel.listen('.product.changed', handleProductRealtimeChange);

    // 4. CategoryChanged Listener
    publicChannel.listen('.category.changed', handleCategoryRealtimeChange);

    // 5. DiscountRuleChanged Listener (Realtime Discount Synchronization)
    publicChannel.listen('.discount-rule.changed', handleDiscountRuleRealtimeChange);

    // 6. SettingChanged Listener (Realtime Tax & Store Settings)
    publicChannel.listen(
      '.setting.changed',
      (payload: { settings: any }) => {
        if (payload?.settings) {
          const normalizedSettings: Settings = {
            store_name: payload.settings.store_name || 'BOOTH DAILY',
            tagline: payload.settings.tagline || '',
            address: payload.settings.address || '',
            phone: payload.settings.phone || '',
            receipt_header: payload.settings.receipt_header || '',
            receipt_footer: payload.settings.receipt_footer || '',
            tax_percentage: Number(payload.settings.tax_percentage || 0),
            service_charge_percentage: Number(payload.settings.service_charge_percentage || 0),
            currency_symbol: payload.settings.currency_symbol || 'Rp',
          };
          setSettings(normalizedSettings);
        }
      }
    );

    // 7. UserSessionInvalidated Listener (Realtime Single Session Enforcement)
    publicChannel.listen(
      '.user.session-invalidated',
      (payload: {
        user_id: string;
        active_token_id: string;
        revoked_at?: string;
      }) => {
        const currentToken = localStorage.getItem('token');
        if (!currentToken) return;

        const storedUserId = localStorage.getItem('boothdaily_user_session');
        if (String(storedUserId) !== String(payload.user_id)) return;

        const storedTokenId =
          localStorage.getItem('token_id') ||
          (currentToken.includes('|') ? currentToken.split('|')[0] : '');

        // Jangan logout session yang baru saja login.
        if (
          storedTokenId &&
          String(storedTokenId) === String(payload.active_token_id)
        ) {
          return;
        }

        // Session lama telah dicabut oleh login baru.
        localStorage.removeItem('token');
        localStorage.removeItem('token_id');
        localStorage.removeItem('boothdaily_user_session');
        localStorage.removeItem('boothdaily_user_data');

        setCurrentUser(null);
        leavePosBooth();

        setPurchases([]);
        setUsersList([]);
        setStockHistories([]);

        showToast(
          'Sesi Anda telah berakhir karena akun ini login di perangkat lain.',
          'error'
        );
      }
    );

    return () => {
      leavePosPublic();
    };
  }, [
    handleStockRealtimeChange,
    handleRecipeRealtimeChange,
    handleProductRealtimeChange,
    handleCategoryRealtimeChange,
    handleDiscountRuleRealtimeChange,
    setSettings,
    setCurrentUser,
    setPurchases,
    setUsersList,
    setStockHistories,
    showToast,
  ]);

  // Private Reverb Realtime WebSocket Subscription (pos-booth for authenticated staff/owner)
  useEffect(() => {
    if (!authReady || !currentUser) {
      leavePosBooth();
      return;
    }

    const role = String(currentUser.role || '').toLowerCase();
    if (role !== 'owner' && role !== 'karyawan' && role !== 'employee') {
      leavePosBooth();
      return;
    }

    const channel = subscribePosBooth();
    if (!channel) {
      return;
    }

    // 1. OrderCreated Listener
    channel.listen('.order.created', (payload: { order: Order }) => {
      handleOrderCreatedRealtime(payload.order);
    });

    // 2. OrderRefunded Listener
    channel.listen('.order.refunded', (payload: { order: Order }) => {
      handleOrderRefundedRealtime(payload.order);
    });

    // 3. PurchaseRecorded Listener
    channel.listen('.purchase.recorded', handlePurchaseRealtimeChange);

    // 4. UserSessionInvalidated Listener on private channel
    channel.listen(
      '.user.session-invalidated',
      (payload: {
        user_id: string;
        active_token_id: string;
        revoked_at?: string;
      }) => {
        const currentToken = localStorage.getItem('token');
        if (!currentToken) return;

        const storedUserId = localStorage.getItem('boothdaily_user_session');
        if (String(storedUserId) !== String(payload.user_id)) return;

        const storedTokenId =
          localStorage.getItem('token_id') ||
          (currentToken.includes('|') ? currentToken.split('|')[0] : '');

        // Jangan logout session yang baru saja login.
        if (
          storedTokenId &&
          String(storedTokenId) === String(payload.active_token_id)
        ) {
          return;
        }

        // Session lama telah dicabut oleh login baru.
        localStorage.removeItem('token');
        localStorage.removeItem('token_id');
        localStorage.removeItem('boothdaily_user_session');
        localStorage.removeItem('boothdaily_user_data');

        setCurrentUser(null);
        leavePosBooth();

        setPurchases([]);
        setUsersList([]);
        setStockHistories([]);

        showToast(
          'Sesi Anda telah berakhir karena akun ini login di perangkat lain.',
          'error'
        );
      }
    );

    return () => {
      leavePosBooth();
    };
  }, [
    authReady,
    currentUser?.id,
    currentUser?.role,
    handleOrderCreatedRealtime,
    handleOrderRefundedRealtime,
    handlePurchaseRealtimeChange,
    setCurrentUser,
    setPurchases,
    setUsersList,
    setStockHistories,
    showToast,
  ]);

  return (
    <POSContext.Provider
      value={{
        currentUser,
        setCurrentUser,
        authReady,
        products,
        categories,
        recipes,
        orders,
        stocks,
        stockHistories,
        purchases,
        usersList,
        settings,
        setSettings,
        discountRules,
        refreshDiscounts,
        addDiscountRule,
        editDiscountRule,
        toggleDiscountRuleStatus,
        removeDiscountRule,
        cart,
        orderType,
        setOrderType,
        customerName,
        setCustomerName,
        selectedCategory,
        setSelectedCategory,
        isLoginModalOpen,
        openLoginModal,
        closeLoginModal,
        isEditAccountModalOpen,
        openEditAccountModal,
        closeEditAccountModal,
        isLogoutModalOpen,
        openLogoutModal,
        closeLogoutModal,
        loginUser,
        logoutUser,
        updateCurrentUserAccount,
        addProduct,
        editProduct,
        removeProduct,
        addCategory,
        editCategory,
        removeCategory,
        saveRecipeData,
        removeRecipe,
        addStockItem,
        editStockItem,
        removeStockItem,
        adjustStockQuantity,
        addPurchase,
        editPurchase,
        removePurchase,
        addToCart,
        updateCartQty,
        updateCartNotes,
        removeFromCart,
        clearCart,
        selectedRecipe,
        selectedRecipeProduct,
        openRecipeModal,
        closeRecipeModal,
        isPinModalOpen,
        openPinModal,
        closePinModal,
        processPaymentWithPin,
        currentReceiptOrder,
        isReceiptModalOpen,
        openReceiptModal,
        closeReceiptModal,
        toggleFavorite,
        refundOrder,
        refreshData,
        toast,
        showToast,
      }}
    >
      {children}
    </POSContext.Provider>
  );
};

export const usePOS = () => {
  const context = useContext(POSContext);
  if (!context) {
    throw new Error('usePOS must be used within a POSProvider');
  }
  return context;
};
