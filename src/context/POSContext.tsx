import React, { createContext, useContext, useEffect, useCallback, useRef, useState, ReactNode, useMemo } from 'react';
import { Product, Category, Recipe, Order, Stock, Purchase, User, OrderType, PaymentMethod, Settings, StockHistory, DiscountRule, Shift } from '../types';
import { productService } from '../services/productService';
import { recipeService } from '../services/recipeService';
import { userService } from '../services/userService';
import { orderService } from '../services/orderService';
import { stockService } from '../services/stockService';
import { discountService } from '../services/discountService';
import { settingsService } from '../services/settingsService';
import { subscribePosPublic, leavePosPublic, subscribePosBooth, leavePosBooth, onEchoConnected } from '../services/echo';
import { mockStore, StorageStatusInfo } from '../mock/store';
import { saveSecondaryCache, getRestoreJournal } from '../mock/persistence/storage';
import { backupService, RecoveryResult } from '../services/backupService';

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
import { usePOSShift } from './pos/usePOSShift';
import { usePOSMedia } from './pos/usePOSMedia';

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

  // Shift & Reconciliation
  shifts: Shift[];
  activeShift: Shift | null;
  isShiftActive: boolean;
  isOpenShiftModalOpen: boolean;
  openOpenShiftModal: () => void;
  closeOpenShiftModal: () => void;
  isCloseShiftModalOpen: boolean;
  openCloseShiftModal: () => void;
  closeCloseShiftModal: () => void;
  openShift: (cashInitial: number, pin: string) => Promise<{ success: boolean; message: string; shift?: Shift }>;
  closeShift: (payload: { actual_cash_end: number; actual_qris_end: number | null; actual_refund_total: number | null; cash_difference_reason?: string; qris_difference_reason?: string; notes?: string; pin: string }) => Promise<{ success: boolean; message: string; shift?: Shift }>;
  reviewShift: (payload: { shift_id: string; action: 'approved_variance' | 'correction_requested'; notes?: string; pin: string }) => Promise<{ success: boolean; message: string; shift?: Shift }>;
  correctShift: (payload: { shift_id: string; actual_cash_end: number; actual_qris_end: number | null; actual_refund_total?: number | null; cash_difference_reason?: string; qris_difference_reason?: string; correction_notes?: string; pin: string }) => Promise<{ success: boolean; message: string; shift?: Shift }>;
  refreshShifts: () => Promise<void>;

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
  editStockItem: (id: string, stockData: Partial<Stock>, metadata?: { notes?: string }) => Promise<Stock>;
  removeStockItem: (id: string) => Promise<boolean>;
  adjustStockQuantity: (stockId: string, changeAmount: number, reason: string, notes?: string) => Promise<Stock>;

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
  refundOrder: (orderId: string, metadata?: { refunded_by_name?: string; refund_reason?: string; refund_method?: PaymentMethod }) => Promise<{ success: boolean; message: string; order?: Order }>;

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

  // Storage Integrity
  storageStatusInfo?: StorageStatusInfo;

  // Media & Branding Logos
  appLogo: string | null;
  printerLogo: string | null;
  isLoadingMedia: boolean;
  uploadAppLogo: (file: File) => Promise<string>;
  deleteAppLogo: () => Promise<void>;
  uploadPrinterLogo: (file: File) => Promise<string>;
  deletePrinterLogo: () => Promise<void>;
  refreshMedia?: () => Promise<void>;
}

const POSContext = createContext<POSContextType | undefined>(undefined);

export const POSProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Domain 1: Toast
  const { toast, showToast } = usePOSToast();

  // ===== FAIL-CLOSED BOOTSTRAP GATE (S3 R1) =====
  // Recovery MUST complete before any child component mounts or uses data.
  // States: 'pending' = recovery in progress, 'ready' = safe to proceed, 'failed' = permanent lock
  type RecoveryState = 'pending' | 'ready' | 'failed';
  const [recoveryState, setRecoveryState] = useState<RecoveryState>(() =>
    getRestoreJournal() ? 'pending' : 'ready'
  );
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const recoveryRanRef = useRef(false);

  useEffect(() => {
    if (recoveryRanRef.current) return;
    recoveryRanRef.current = true;

    if (!getRestoreJournal()) {
      setRecoveryState('ready');
      return;
    }

    console.warn('[POSContext] Jurnal pemulihan terdeteksi. Menjalankan crash recovery sebelum bootstrap...');

    backupService
      .checkAndRecoverInterruptedRestore()
      .then((rec: RecoveryResult) => {
        if (rec.recovered) {
          if (rec.success) {
            showToast(rec.message || 'Pemulihan cadangan yang terputus berhasil dinormalisasi.', 'info');
            setRecoveryState('ready');
          } else {
            // ROLLBACK_FAILED — permanent lock
            const errMsg = rec.error || 'Kegagalan kritis pemulihan cadangan. Sistem terkunci.';
            setRecoveryError(errMsg);
            setRecoveryState('failed');
          }
        } else {
          // No recovery needed (journal was stale or empty)
          setRecoveryState('ready');
        }
      })
      .catch((err: any) => {
        console.error('[POSContext] Error fatal saat recovery startup:', err);
        const errMsg = err?.message || 'Kesalahan tidak diketahui saat pemulihan darurat.';
        setRecoveryError(errMsg);
        setRecoveryState('failed');
      });
  }, [showToast]);

  // Domain 0: Storage Integrity Tracking
  const [storageStatusInfo, setStorageStatusInfo] = useState<StorageStatusInfo>(() => mockStore.getStorageStatusInfo());
  const hasShownBootWarningRef = useRef(false);

  useEffect(() => {
    // Only run storage warnings after recovery is complete
    if (recoveryState !== 'ready') return;

    const initialInfo = mockStore.getStorageStatusInfo();
    setStorageStatusInfo(initialInfo);

    if (!hasShownBootWarningRef.current) {
      hasShownBootWarningRef.current = true;

      if (
        initialInfo.isWriteLocked &&
        (initialInfo.status === 'CORRUPTED_JSON' || initialInfo.status === 'SCHEMA_INVALID')
      ) {
        showToast(
          'Peringatan: Penyimpanan data lokal terdeteksi rusak atau tidak valid. Proteksi tulis aktif agar data lama tidak tertimpa.',
          'error'
        );
      } else if (initialInfo.status === 'STORAGE_UNAVAILABLE') {
        showToast(
          'Peringatan: Penyimpanan browser tidak tersedia atau dinonaktifkan. Data transaksi tidak akan tersimpan secara permanen.',
          'error'
        );
      }
    }

    const unsubscribe = mockStore.subscribeStorageStatus((info) => {
      setStorageStatusInfo(info);
      if (info.lastSaveResult.errorCode === 'QUOTA_EXCEEDED') {
        showToast(
          'Penyimpanan browser penuh (Quota Exceeded). Perubahan tidak dapat disimpan permanen.',
          'error'
        );
      } else if (info.lastSaveResult.errorCode === 'WRITE_LOCKED') {
        showToast(
          'Penulisan dibatalkan: Penyimpanan terkunci dalam mode darurat untuk melindungi data lama.',
          'error'
        );
      } else if (info.lastSaveResult.errorCode === 'STORAGE_UNAVAILABLE') {
        showToast(
          'Penyimpanan browser tidak tersedia. Perubahan tidak dapat disimpan permanen.',
          'error'
        );
      }
    });

    return unsubscribe;
  }, [showToast, recoveryState]);

  // Domain 10: Settings
  const { settings, setSettings } = usePOSSettings();

  // Domain 13: Media (App Logo & Printer Logo)
  const {
    appLogo,
    printerLogo,
    isLoadingMedia,
    uploadAppLogo,
    deleteAppLogo,
    uploadPrinterLogo,
    deletePrinterLogo,
    refreshMedia,
  } = usePOSMedia({ showToast, enabled: recoveryState === 'ready' });

  // Dynamic Browser Tab Favicon
  useEffect(() => {
    if (typeof document === 'undefined') return;
    let link: HTMLLinkElement | null = document.querySelector("link[rel*='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = appLogo || '/src/assets/icon.png';
  }, [appLogo]);

  // Dynamic Browser Tab Title
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const storeName = settings?.store_name?.trim();
    if (storeName) {
      document.title = `${storeName}`;
    } else {
      document.title = 'Booth Daily';
    }
  }, [settings?.store_name]);

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

  // Domain 13: Shift
  const shiftDomain = usePOSShift({
    currentUser,
    showToast,
    enabled: recoveryState === 'ready',
  });
  const {
    shifts,
    activeShift,
    isShiftActive,
    isOpenShiftModalOpen,
    openOpenShiftModal,
    closeOpenShiftModal,
    isCloseShiftModalOpen,
    openCloseShiftModal,
    closeCloseShiftModal,
    openShift,
    closeShift,
    reviewShift,
    correctShift,
    refreshShifts,
  } = shiftDomain;

  // Domain 7: Cart
  const cartDomain = usePOSCart({
    recipes,
    stocks,
    isShiftActive,
    showToast,
  });
  const {
    cart,
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
      refreshShifts();
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
        saveSecondaryCache('boothdaily_cached_products', prds.value, {
          isWriteLocked: mockStore.getStorageStatusInfo().isWriteLocked,
        });
      } else {
        hasFailures = true;
        console.warn('GET /products failed:', prds.reason);
      }

      if (cats.status === 'fulfilled') {
        setCategories(cats.value);
        hasSuccesses = true;
        saveSecondaryCache('boothdaily_cached_categories', cats.value, {
          isWriteLocked: mockStore.getStorageStatusInfo().isWriteLocked,
        });
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
        saveSecondaryCache('boothdaily_cached_stocks', stks.value, {
          isWriteLocked: mockStore.getStorageStatusInfo().isWriteLocked,
        });
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

      try {
        await refreshShifts();
      } catch { }

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
    refreshShifts,
  ]);

  // Keep refreshDataRef up to date for onAuthSuccess callback
  useEffect(() => {
    refreshDataRef.current = refreshData;
  }, [refreshData]);

  // Initial Data Fetch — only after recovery gate is cleared
  useEffect(() => {
    if (recoveryState !== 'ready') return;
    refreshData();
  }, [refreshData, recoveryState]);

  // Realtime Reconnect & Data Synchronization Handler
  useEffect(() => {
    if (recoveryState !== 'ready') return;

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
  }, [refreshData, recoveryState]);

  // Public Realtime WebSocket Subscription (pos-public channel for Guest, Karyawan, Owner)
  useEffect(() => {
    if (recoveryState !== 'ready') return;

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
            store_name: payload.settings.store_name?.trim() ? payload.settings.store_name.trim() : 'BOOTH DAILY',
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
    recoveryState,
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

  // ===== BOOTSTRAP GATE RENDERING =====
  // Fail-closed: Block entire app tree until crash recovery completes

  if (recoveryState === 'failed') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', width: '100vw', background: '#1a1a1a', color: '#fff',
        fontFamily: 'system-ui, -apple-system, sans-serif', padding: '2rem', textAlign: 'center',
      }}>
        <div style={{
          background: '#2d1515', border: '1px solid #7f1d1d', borderRadius: '12px',
          padding: '2rem', maxWidth: '480px', width: '100%',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '0.5rem' }}>⚠️</div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#fca5a5', marginBottom: '0.75rem' }}>
            Kegagalan Kritis Pemulihan Data
          </h1>
          <p style={{ fontSize: '0.875rem', color: '#d4d4d4', lineHeight: 1.6, marginBottom: '1rem' }}>
            Proses pemulihan cadangan yang terputus tidak dapat diselesaikan. Sistem dikunci untuk
            mencegah kerusakan data lebih lanjut.
          </p>
          {recoveryError && (
            <p style={{
              fontSize: '0.75rem', color: '#a1a1aa', background: '#18181b',
              borderRadius: '6px', padding: '0.75rem', wordBreak: 'break-word',
              border: '1px solid #3f3f46',
            }}>
              {recoveryError}
            </p>
          )}
          <p style={{ fontSize: '0.75rem', color: '#a1a1aa', marginTop: '1rem' }}>
            Muat ulang halaman atau hubungi administrator untuk bantuan.
          </p>
        </div>
      </div>
    );
  }

  if (recoveryState === 'pending') {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', width: '100vw', background: '#fafaf9', color: '#44403c',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}>
        <div style={{
          width: '2.5rem', height: '2.5rem', border: '3px solid #C68B59',
          borderTopColor: 'transparent', borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }} />
        <p style={{ marginTop: '1rem', fontSize: '0.875rem', fontWeight: 500, color: '#78716c' }}>
          Memulihkan data dari interupsi sebelumnya...
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

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
        shifts,
        activeShift,
        isShiftActive,
        isOpenShiftModalOpen,
        openOpenShiftModal,
        closeOpenShiftModal,
        isCloseShiftModalOpen,
        openCloseShiftModal,
        closeCloseShiftModal,
        openShift,
        closeShift,
        reviewShift,
        correctShift,
        refreshShifts,
        toast,
        showToast,
        storageStatusInfo,
        appLogo,
        printerLogo,
        isLoadingMedia,
        uploadAppLogo,
        deleteAppLogo,
        uploadPrinterLogo,
        deletePrinterLogo,
        refreshMedia,
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
