import {
  User,
  UserRole,
  Category,
  Product,
  Stock,
  StockHistory,
  Recipe,
  Order,
  OrderHPPSource,
  Purchase,
  PurchaseItem,
  DiscountRule,
  Settings,
  Shift,
  PaymentMethod,
  BaseUnit,
  BaselineSource,
} from '../types';
import { MockStoreState } from './types';
import { getOperationalDate, calculateShiftFinancials } from '../utils/shiftCalculation';
import { calculateItemUnitHPP } from '../utils/reportUtils';
import { validatePackagingConversion } from '../utils/stockUtils';
import { sessionManager } from './repositories/sessionManager';
import { initialUsers } from './data/users';
import { initialCategories } from './data/categories';
import { initialStocks, CANONICAL_SEED_STOCK_IDS } from './data/stocks';
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
  getRestoreJournal,
  clearRestoreJournal,
  getFactoryResetJournal,
  StorageLoadStatus,
  StorageLoadResult,
  StorageSaveResult,
  StorageSaveErrorCode,
} from './persistence/storage';

export type ReseedAuth =
  | { type: 'OWNER_TICKET'; ticket: string }
  | { type: 'RECOVERY_JOURNAL'; journalId: string };

export interface StorageStatusInfo {
  status: StorageLoadStatus;
  isWriteLocked: boolean;
  hasPendingMigration?: boolean;
  lastSaveResult: StorageSaveResult;
  corruptionDetails: {
    status: StorageLoadStatus;
    error?: string;
    missingFields?: string[];
    quarantineKey?: string | null;
    raw?: string | null;
  } | null;
}

/**
 * Deep clone utility to ensure callers receive isolated copies of data.
 */
function deepClone<T>(obj: T): T {
  if (typeof structuredClone === 'function') {
    return structuredClone(obj);
  }
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Validates price or cost price at the store boundary.
 * Rejects negative values, NaN, and Infinity.
 * Allows zero and valid numeric strings (parsed to numbers).
 */
function parseAndValidatePrice(val: unknown, fieldName: string): number {
  if (val === null || val === undefined || val === '') {
    throw new Error(`${fieldName} wajib diisi`);
  }
  const num = typeof val === 'number' ? val : Number(val);
  if (typeof num !== 'number' || isNaN(num) || !isFinite(num)) {
    throw new Error(`${fieldName} harus berupa angka numerik yang valid (bukan NaN atau Infinity)`);
  }
  if (num < 0) {
    throw new Error(`${fieldName} tidak boleh bernilai negatif`);
  }
  return num;
}

export interface PinVerificationTicket {
  ticketId: string;
  userId: string;
  userRole: UserRole;
  createdAt: number;
  expiresAt: number;
  used: boolean;
}

export interface OrderHPPMigrationReport {
  hasChanges: boolean;
  totalProcessed: number;
  alreadySnapshottedCount: number;
  migratedCount: number;
  partialCount: number;
  specialHandlingCount: number;
}

export class MockStore {
  private state: MockStoreState;
  private lastSavedState!: MockStoreState;
  private storageStatus: StorageLoadStatus = 'STORAGE_UNAVAILABLE';
  private isWriteLocked: boolean = false;
  private lastSaveResult: StorageSaveResult = { success: true };
  private corruptionDetails: {
    status: StorageLoadStatus;
    error?: string;
    missingFields?: string[];
    quarantineKey?: string | null;
    raw?: string | null;
  } | null = null;
  private storageListeners: ((info: StorageStatusInfo) => void)[] = [];
  private pinVerificationTickets = new Map<string, PinVerificationTicket>();
  private usedTicketIds = new Set<string>();
  private activeReseedTicket: {
    ticketId: string;
    ownerId: string;
    expiresAt: number;
  } | null = null;
  private needsNormalizedPersist: boolean = false;
  private hasPendingMigrationPersist: boolean = false;

  constructor() {
    this.state = this.initInitialState();
    if (this.needsNormalizedPersist && !this.isWriteLocked && this.storageStatus === 'SUCCESS') {
      try {
        const saveRes = savePersistedSnapshot(this.state, { isWriteLocked: this.isWriteLocked });
        this.lastSaveResult = saveRes;
        if (saveRes.success) {
          this.hasPendingMigrationPersist = false;
          this.needsNormalizedPersist = false;
          this.lastSavedState = deepClone(this.state);
        } else {
          this.hasPendingMigrationPersist = true;
        }
      } catch (err: any) {
        this.hasPendingMigrationPersist = true;
        this.lastSaveResult = {
          success: false,
          errorCode: 'WRITE_FAILED',
          error: err?.message || 'Auto-persist normalisasi status legacy gagal disimpan ke storage',
        };
        console.warn('[MockStore] Auto-persist normalisasi status legacy gagal disimpan ke storage:', err);
      }
    }
  }

  /**
   * Menerbitkan tiket verifikasi PIN non-deterministik terikat pengguna Owner.
   * Masa berlaku standar 5 menit, single-use, tanpa menyimpan atau mencatat PIN mentah.
   */
  public issuePinVerificationTicket(
    userId: string,
    options?: { customTicketId?: string; expiresInMs?: number }
  ): PinVerificationTicket {
    const user = (this.state.users || []).find(u => String(u.id) === String(userId) && u.is_active);
    if (!user) {
      throw new Error('Tidak dapat menerbitkan tiket: Pengguna tidak ditemukan atau tidak aktif');
    }

    const now = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const ticketId = options?.customTicketId || `pvt_${user.id}_${now}_${randomSuffix}`;
    const duration = typeof options?.expiresInMs === 'number' ? options.expiresInMs : 5 * 60 * 1000;
    const ticket: PinVerificationTicket = {
      ticketId,
      userId: user.id,
      userRole: user.role,
      createdAt: now,
      expiresAt: now + duration,
      used: false,
    };

    this.pinVerificationTickets.set(ticketId, ticket);
    return deepClone(ticket);
  }

  public registerPinVerification(userId: string, token: string): void {
    this.issuePinVerificationTicket(userId, { customTicketId: token });
  }

  public getPinVerificationTicket(ticketId: string): PinVerificationTicket | undefined {
    const t = this.pinVerificationTickets.get(ticketId);
    return t ? deepClone(t) : undefined;
  }

  /**
   * Menerbitkan tiket reseed pabrik internal sekali-pakai (TTL 60 detik).
   * Hanya dapat dipanggil oleh Owner aktif dengan tiket verifikasi PIN yang sah.
   */
  public issueReseedTicket(pinVerificationToken: string): string {
    const owner = this.assertActiveOwnerSession('menerbitkan tiket reseed pabrik');
    if (!pinVerificationToken || typeof pinVerificationToken !== 'string') {
      throw new Error('Tiket verifikasi PIN sah diperlukan untuk otorisasi reseed pabrik.');
    }

    const pinTicket = this.pinVerificationTickets.get(pinVerificationToken);
    if (!pinTicket) {
      throw new Error('Tiket verifikasi PIN tidak ditemukan.');
    }

    if (String(pinTicket.userId) !== String(owner.id)) {
      throw new Error('Tiket verifikasi PIN tidak cocok dengan sesi Owner aktif.');
    }

    if (pinTicket.expiresAt <= Date.now() || pinTicket.used || this.usedTicketIds.has(pinVerificationToken)) {
      throw new Error('Tiket verifikasi PIN telah kedaluwarsa atau sudah digunakan.');
    }

    // Konsumsi tiket PIN agar tidak dapat dipakai ulang
    pinTicket.used = true;
    this.usedTicketIds.add(pinVerificationToken);

    const now = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 10) + Math.random().toString(36).substring(2, 10);
    const ticketId = `rst_${owner.id}_${now}_${randomSuffix}`;
    this.activeReseedTicket = {
      ticketId,
      ownerId: owner.id,
      expiresAt: now + 60 * 1000,
    };

    return ticketId;
  }

  /**
   * Normalisasi pengaturan toko (Settings) untuk kompatibilitas data legacy:
   * 1. Memastikan field operational_day_cutoff_time memiliki default '04:00'
   *    jika data lama di storage belum memilikinya.
   * 2. Memastikan field receipt_paper_size memiliki default '80mm' (max-width: 78mm)
   *    jika data lama di storage belum memilikinya atau nilainya tidak valid.
   */
  public normalizeSettings(settings: Settings): boolean {
    if (!settings || typeof settings !== 'object') return false;
    let hasChanges = false;
    if (!settings.operational_day_cutoff_time || !settings.operational_day_cutoff_time.trim()) {
      settings.operational_day_cutoff_time = '04:00';
      hasChanges = true;
    }
    if (!settings.receipt_paper_size || (settings.receipt_paper_size !== '58mm' && settings.receipt_paper_size !== '80mm')) {
      settings.receipt_paper_size = '80mm';
      hasChanges = true;
    }
    return hasChanges;
  }

  /**
   * Normalisasi satuan bahan baku dan pembersihan false-positive status verifikasi:
   * 1. Menyelaraskan casing satuan standar ('Gram', 'ml', 'Pcs').
   * 2. Seed demo kanonikal (13 item eksplisit) tetap 'verified'.
   * 3. Bahan non-seed yang memiliki bukti migrasi Owner valid di stockHistories tetap 'verified'.
   * 4. Bahan non-seed tanpa bukti migrasi sah (termasuk yang terdampak bug lama sehingga telanjur
   *    tersimpan sebagai 'verified') WAJIB diperlakukan sebagai 'unverified_legacy'.
   * 5. Bahan tanpa conversion_status ditetapkan sebagai 'unverified_legacy'.
   * 6. Mengembalikan boolean yang menandakan apakah ada perubahan status pada stocks.
   */
  public normalizeStocks(stocks: Stock[], stockHistories?: StockHistory[]): boolean {
    if (!Array.isArray(stocks)) return false;

    const historiesToInspect = Array.isArray(stockHistories)
      ? stockHistories
      : (Array.isArray(this.state?.stockHistories) ? this.state.stockHistories : []);

    let hasChanges = false;

    for (const s of stocks) {
      if (s.unit) {
        const lower = s.unit.trim().toLowerCase();
        let normalizedUnit = s.unit;
        if (lower === 'gram' || lower === 'g') {
          normalizedUnit = 'Gram';
        } else if (lower === 'ml') {
          normalizedUnit = 'ml';
        } else if (lower === 'pcs') {
          normalizedUnit = 'Pcs';
        }
        if (s.unit !== normalizedUnit) {
          s.unit = normalizedUnit;
          hasChanges = true;
        }
      }

      // Evaluasi keabsahan status verifikasi (Provenance Check):
      const isCanonicalSeed = CANONICAL_SEED_STOCK_IDS.has(String(s.id));
      const hasOwnerMigrationProof = historiesToInspect.some(
        h => String(h.stock_id) === String(s.id) &&
             h.reference === 'Migrasi Satuan Dasar & Verifikasi Resep Terkait' &&
             h.type === 'penyesuaian'
      );

      const targetStatus: 'verified' | 'unverified_legacy' = (isCanonicalSeed || hasOwnerMigrationProof)
        ? 'verified'
        : 'unverified_legacy';

      if (s.conversion_status !== targetStatus) {
        s.conversion_status = targetStatus;
        hasChanges = true;
      }

      // Evaluasi keabsahan provenance baseline:
      if (s.baseline_cost_per_unit !== undefined && s.baseline_cost_per_unit > 0) {
        if (!s.baseline_source) {
          const hasOwnerConfirmationProof = historiesToInspect.some(
            h => String(h.stock_id) === String(s.id) &&
                 (h.reason === 'Pembaruan Baseline Biaya' || h.reason === 'Konfirmasi Baseline Biaya' || (h.reference && h.reference.includes('Baseline Biaya'))) &&
                 h.type === 'penyesuaian'
          );
          s.baseline_source = hasOwnerConfirmationProof ? 'owner_confirmed' : 'unverified_legacy';
          hasChanges = true;
        }
      } else if (s.baseline_source !== undefined && (s.baseline_cost_per_unit === undefined || s.baseline_cost_per_unit <= 0)) {
        s.baseline_source = undefined;
        hasChanges = true;
      }
    }

    return hasChanges;
  }

  /**
   * PHASE 1B.3 — LEGACY HPP SNAPSHOT STABILIZATION
   * Menstabilkan HPP historis pesanan (Order) secara aman, idempotent, dan transparan:
   * 1. Order yang sudah memiliki snapshot total_hpp dan biaya item lengkap TIDAK diubah sama sekali.
   * 2. Order legacy tanpa snapshot biaya dihitung satu kali menggunakan Unit-First Integer Policy,
   *    dibekukan ke total_hpp, item.unit_cost_price, item.subtotal_cost, ditandai hpp_source: 'legacy_estimate',
   *    dan item.is_estimated_cost: true.
   * 3. Order dengan snapshot parsial ditangani secara defensif:
   *    - Jika total_hpp sudah ada, nilainya dipertahankan (tidak dioverwrite).
   *    - Nilai item yang sudah valid dipertahankan, nilai yang kosong dilengkapi tanpa merusak snapshot sah.
   * 4. Fallback 40% dari selling price dibekukan sebagai estimasi jika resep/biaya produk tidak tersedia.
   * 5. Seluruh field non-HPP (subtotal, total_amount, pajak, diskon, tanggal, metode pembayaran, refund, shift)
   *    dijamin 100% tidak berubah (immutabel).
   */
  public stabilizeLegacyOrderHPPSnapshots(
    orders: Order[],
    products?: Product[],
    recipes?: Recipe[],
    stocks?: Stock[],
    options?: { migrationTimestamp?: string }
  ): OrderHPPMigrationReport {
    if (!Array.isArray(orders) || orders.length === 0) {
      return {
        hasChanges: false,
        totalProcessed: 0,
        alreadySnapshottedCount: 0,
        migratedCount: 0,
        partialCount: 0,
        specialHandlingCount: 0,
      };
    }

    const effectiveProducts = Array.isArray(products) ? products : (this.state?.products || []);
    const effectiveRecipes = Array.isArray(recipes) ? recipes : (this.state?.recipes || []);
    const effectiveStocks = Array.isArray(stocks) ? stocks : (this.state?.stocks || []);
    const nowIso = options?.migrationTimestamp || new Date().toISOString();

    let hasChanges = false;
    let alreadySnapshottedCount = 0;
    let migratedCount = 0;
    let partialCount = 0;
    let specialHandlingCount = 0;

    for (const order of orders) {
      const hasOrderTotalHPP = typeof order.total_hpp === 'number' && order.total_hpp >= 0;
      const items = Array.isArray(order.items) ? order.items : [];

      if (items.length === 0) {
        // Special handling: pesanan tanpa item
        if (order.total_hpp === undefined) {
          order.total_hpp = 0;
          order.hpp_source = 'legacy_estimate';
          order.hpp_migrated_at = nowIso;
          hasChanges = true;
          specialHandlingCount++;
        } else {
          if (!order.hpp_source) {
            order.hpp_source = 'transaction_snapshot';
            hasChanges = true;
          }
          alreadySnapshottedCount++;
        }
        continue;
      }

      // Periksa kelengkapan snapshot pada baris item
      const itemSnapshotStatuses = items.map(it => {
        const hasUnitCost = typeof it.unit_cost_price === 'number' && it.unit_cost_price >= 0;
        const hasSubtotalCost = typeof it.subtotal_cost === 'number' && it.subtotal_cost >= 0;
        return { hasUnitCost, hasSubtotalCost };
      });

      const allItemsSnapshotted = itemSnapshotStatuses.every(s => s.hasUnitCost && s.hasSubtotalCost);
      const someItemsSnapshotted = itemSnapshotStatuses.some(s => s.hasUnitCost || s.hasSubtotalCost);

      // KASUS 1: Order sudah mempunyai snapshot lengkap (total_hpp dan semua item valid)
      if (hasOrderTotalHPP && allItemsSnapshotted) {
        alreadySnapshottedCount++;
        if (!order.hpp_source) {
          order.hpp_source = 'transaction_snapshot';
          hasChanges = true;
        }
        continue; // Immutabilitas: Jangan hitung ulang atau timpa apapun!
      }

      // KASUS 2: Order memiliki snapshot parsial (total_hpp ada tetapi item belum lengkap)
      if (hasOrderTotalHPP && !allItemsSnapshotted) {
        partialCount++;
        // Immutabilitas total_hpp: JANGAN menimpa order.total_hpp!
        // Klasifikasi transparan: total adalah snapshot transaksi yang ada, tetapi rincian item mengandung estimasi
        order.hpp_source = 'partial_snapshot';
        order.hpp_migrated_at = order.hpp_migrated_at || nowIso;
        hasChanges = true;

        let accumulatedItemSubtotal = 0;

        // Pertahankan snapshot biaya item yang sudah valid, estimasikan HANYA item yang belum memiliki snapshot
        items.forEach(it => {
          const qty = Number(it.qty) || 1;
          if (typeof it.unit_cost_price === 'number' && it.unit_cost_price >= 0) {
            const roundedUnit = Math.round(it.unit_cost_price);
            it.unit_cost_price = roundedUnit;
            if (typeof it.subtotal_cost !== 'number' || it.subtotal_cost < 0) {
              it.subtotal_cost = roundedUnit * qty;
              hasChanges = true;
            }
            accumulatedItemSubtotal += it.subtotal_cost;
          } else {
            const { unitCost } = calculateItemUnitHPP(
              it.product_id,
              Number(it.price) || 0,
              effectiveProducts,
              effectiveRecipes,
              effectiveStocks
            );
            const roundedUnit = Math.round(unitCost);
            it.unit_cost_price = roundedUnit;
            it.subtotal_cost = roundedUnit * qty;
            it.is_estimated_cost = true;
            accumulatedItemSubtotal += it.subtotal_cost;
            hasChanges = true;
          }
        });

        // Hitung variansi antara snapshot total_hpp dengan akumulasi rincian item tanpa memaksakan rekonsiliasi palsu
        const variance = Math.round(order.total_hpp! - accumulatedItemSubtotal);
        if (variance !== 0) {
          order.hpp_variance = variance;
        }
        continue;
      }

      // KASUS 3: Order tanpa total_hpp tetapi sebagian item memiliki snapshot biaya (snapshot parsial item)
      if (!hasOrderTotalHPP && someItemsSnapshotted) {
        partialCount++;
        migratedCount++;
        hasChanges = true;

        let accumulatedOrderHPP = 0;
        items.forEach(it => {
          const qty = Number(it.qty) || 1;
          if (typeof it.unit_cost_price === 'number' && it.unit_cost_price >= 0) {
            const roundedUnit = Math.round(it.unit_cost_price);
            it.unit_cost_price = roundedUnit;
            if (typeof it.subtotal_cost !== 'number' || it.subtotal_cost < 0) {
              it.subtotal_cost = roundedUnit * qty;
            }
            accumulatedOrderHPP += it.subtotal_cost;
          } else {
            // Estimasi item yang belum mempunyai snapshot biaya
            const { unitCost } = calculateItemUnitHPP(
              it.product_id,
              Number(it.price) || 0,
              effectiveProducts,
              effectiveRecipes,
              effectiveStocks
            );
            const roundedUnit = Math.round(unitCost);
            it.unit_cost_price = roundedUnit;
            it.subtotal_cost = roundedUnit * qty;
            it.is_estimated_cost = true;
            accumulatedOrderHPP += it.subtotal_cost;
          }
        });

        order.total_hpp = Math.round(accumulatedOrderHPP);
        order.hpp_source = 'legacy_estimate';
        order.hpp_migrated_at = nowIso;
        continue;
      }

      // KASUS 4: Order legacy standar tanpa snapshot (tidak ada total_hpp dan tidak ada biaya item)
      migratedCount++;
      hasChanges = true;

      let calculatedOrderHPP = 0;
      items.forEach(it => {
        const qty = Number(it.qty) || 1;
        const price = Number(it.price) || 0;

        const { unitCost } = calculateItemUnitHPP(
          it.product_id,
          price,
          effectiveProducts,
          effectiveRecipes,
          effectiveStocks
        );

        // Unit-First Integer Policy
        const roundedUnit = Math.round(unitCost);
        const subtotal = roundedUnit * qty;

        it.unit_cost_price = roundedUnit;
        it.subtotal_cost = subtotal;
        it.is_estimated_cost = true; // Ditandai eksplisit sebagai estimasi
        calculatedOrderHPP += subtotal;
      });

      order.total_hpp = Math.round(calculatedOrderHPP);
      order.hpp_source = 'legacy_estimate';
      order.hpp_migrated_at = nowIso;
    }

    return {
      hasChanges,
      totalProcessed: orders.length,
      alreadySnapshottedCount,
      migratedCount,
      partialCount,
      specialHandlingCount,
    };
  }

  private createDefaultSeedState(): MockStoreState {
    const seed = {
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
      shifts: [],
      activeShiftId: null,
    };
    this.normalizeStocks(seed.stocks, seed.stockHistories);
    this.stabilizeLegacyOrderHPPSnapshots(seed.orders, seed.products, seed.recipes, seed.stocks);
    return seed;
  }

  private initInitialState(): MockStoreState {
    // Cek apakah terdapat jurnal reset pabrik S4 yang aktif atau terputus
    const factoryJournal = getFactoryResetJournal();
    if (factoryJournal) {
      console.warn(`[MockStore] Terdeteksi jurnal reset pabrik pada stage "${factoryJournal.stage}". Mengunci penyimpanan dan memuat default seed ke RAM.`);
      this.isWriteLocked = true;
      this.storageStatus = 'SUCCESS';
      this.lastSaveResult = {
        success: false,
        errorCode: 'WRITE_LOCKED',
        error: `Sistem terkunci: Sedang dalam proses pemulihan reset pabrik (${factoryJournal.stage}).`,
      };
      this.needsNormalizedPersist = false;
      this.hasPendingMigrationPersist = false;
      const seed = this.createDefaultSeedState();
      this.lastSavedState = deepClone(seed);
      return seed;
    }

    // Cek apakah terdapat jurnal pemulihan restore yang terputus di tengah jalan
    const pendingJournal = getRestoreJournal();
    if (pendingJournal) {
      if (pendingJournal.stage === 'ROLLBACK_FAILED') {
        console.error('[MockStore] Jurnal pemulihan berstatus ROLLBACK_FAILED. Mengunci penyimpanan.');
        this.isWriteLocked = true;
      } else {
        // Terdapat transaksi restore yang terputus di tengah jalan.
        // Terapkan strategi Fail-Safe Rollback to Baseline:
        // 1. Pulihkan LocalStorage ke oldState secara sinkron agar tidak ada data parsial aktif di RAM/Storage.
        // 2. Kunci penulisan (isWriteLocked = true) hingga IndexedDB tervalidasi pulih.
        // 3. JANGAN hapus jurnal! Jurnal wajib dipertahankan agar recovery asinkron media
        //    dapat dijalankan dan memulihkan IndexedDB di lifecycle bootstrap aplikasi.
        console.warn(`[MockStore] Terdeteksi proses restore terhenti pada stage "${pendingJournal.stage}". Menyiapkan snapshot awal LocalStorage dan mengunci mutasi.`);
        savePersistedSnapshot(pendingJournal.oldState);
        this.isWriteLocked = true;
      }
    }

    const loadResult = loadPersistedSnapshot();
    this.storageStatus = loadResult.status;

    if (loadResult.status === 'SUCCESS' && loadResult.data) {
      this.isWriteLocked = pendingJournal ? true : false;
      this.lastSaveResult = { success: true };
      this.corruptionDetails = null;

      // Tangkap snapshot awal yang benar-benar tersimpan di storage sebelum migrasi RAM berjalan
      const diskSnapshot = deepClone(loadResult.data);
      this.lastSavedState = diskSnapshot;

      this.normalizeSettings(loadResult.data.settings);
      const stocksChanged = this.normalizeStocks(loadResult.data.stocks, loadResult.data.stockHistories);
      const ordersMigration = this.stabilizeLegacyOrderHPPSnapshots(
        loadResult.data.orders,
        loadResult.data.products,
        loadResult.data.recipes,
        loadResult.data.stocks
      );
      if (stocksChanged || ordersMigration.hasChanges) {
        this.needsNormalizedPersist = true;
        this.hasPendingMigrationPersist = true;
      } else {
        this.needsNormalizedPersist = false;
        this.hasPendingMigrationPersist = false;
      }
      return loadResult.data;
    }

    if (loadResult.status === 'FRESH_INSTALL') {
      this.isWriteLocked = false;
      this.lastSaveResult = { success: true };
      this.corruptionDetails = null;
      this.needsNormalizedPersist = false;
      this.hasPendingMigrationPersist = false;
      const seed = this.createDefaultSeedState();
      this.lastSavedState = deepClone(seed);
      return seed;
    }

    if (loadResult.status === 'CORRUPTED_JSON' || loadResult.status === 'SCHEMA_INVALID') {
      this.isWriteLocked = true;
      this.lastSaveResult = {
        success: false,
        errorCode: 'WRITE_LOCKED',
        error: `Penyimpanan terkunci dalam mode darurat data: ${loadResult.error || 'Data rusak/tidak valid'}.`,
      };
      this.corruptionDetails = {
        status: loadResult.status,
        error: loadResult.error,
        missingFields: loadResult.missingFields,
        quarantineKey: loadResult.quarantineKey,
        raw: loadResult.raw,
      };

      console.error(
        `[MockStore] DATA INTEGRITY PROTECT: Terdeteksi ${loadResult.status}. Write-lock diaktifkan. Key utama dilindungi dari overwrite.`
      );

      // Sediakan seed di RAM agar komponen UI tidak mengalami crash reference,
      // tetapi kunci penulisan aktif sehingga key penyimpanan utama tidak pernah tertimpa.
      this.needsNormalizedPersist = false;
      this.hasPendingMigrationPersist = false;
      const seed = this.createDefaultSeedState();
      this.lastSavedState = deepClone(seed);
      return seed;
    }

    // STORAGE_UNAVAILABLE
    this.isWriteLocked = true;
    this.lastSaveResult = {
      success: false,
      errorCode: 'STORAGE_UNAVAILABLE',
      error: 'Penyimpanan browser tidak tersedia.',
    };
    this.corruptionDetails = null;
    this.needsNormalizedPersist = false;
    this.hasPendingMigrationPersist = false;
    const seed = this.createDefaultSeedState();
    this.lastSavedState = deepClone(seed);
    return seed;
  }

  private persist(): StorageSaveResult {
    const saveResult = savePersistedSnapshot(this.state, {
      isWriteLocked: this.isWriteLocked,
    });
    this.lastSaveResult = saveResult;

    if (!saveResult.success) {
      this.notifyStorageListeners();

      if (this.isWriteLocked) {
        // Rollback state ke lastSavedState secara atomik agar memori tidak berubah seolah-olah sukses
        this.state = deepClone(this.lastSavedState);
        throw new Error(
          `[DataIntegrityError] Operasi dibatalkan: Penyimpanan dalam mode proteksi tulis (${this.storageStatus}). Data persisten tidak diubah untuk melindungi data lama.`
        );
      }

      if (saveResult.errorCode === 'QUOTA_EXCEEDED') {
        // Rollback state ke lastSavedState secara atomik agar tidak terjadi desinkronisasi memori vs disk
        this.state = deepClone(this.lastSavedState);
        throw new Error(
          '[DataIntegrityError] Penyimpanan gagal: Kuota penyimpanan browser penuh (QuotaExceededError). Perubahan dibatalkan untuk menjaga konsistensi data.'
        );
      }

      if (saveResult.errorCode === 'STORAGE_UNAVAILABLE') {
        // Rollback state ke lastSavedState secara atomik: mutasi tidak boleh sukses hanya di RAM saat storage tidak tersedia
        this.state = deepClone(this.lastSavedState);
        throw new Error(
          '[DataIntegrityError] Penyimpanan gagal: Penyimpanan browser tidak tersedia atau dinonaktifkan. Perubahan dibatalkan untuk mencegah kehilangan data.'
        );
      }

      this.state = deepClone(this.lastSavedState);
      throw new Error(
        `[DataIntegrityError] Gagal menyimpan data ke penyimpanan: ${saveResult.error || 'Terjadi kesalahan penulisan'}`
      );
    }

    // Persistensi sukses: sinkronkan lastSavedState dan bersihkan status pending jika ada
    this.lastSavedState = deepClone(this.state);
    if (this.hasPendingMigrationPersist || this.needsNormalizedPersist) {
      this.hasPendingMigrationPersist = false;
      this.needsNormalizedPersist = false;
    }
    this.notifyStorageListeners();
    return saveResult;
  }

  // ----------------------------------------------------
  // RESET / SNAPSHOT / INTEGRITY QUERIES
  // ----------------------------------------------------
  /**
   * @internal KHUSUS PENGUJIAN OTOMATIS (TEST HARNESS)
   * Mengembalikan in-memory store ke default seed state untuk isolasi deterministic test.
   * Dilarang digunakan pada komponen UI runtime aplikasi.
   * Untuk reset pabrik resmi aplikasi, gunakan factoryResetService.executeFactoryReset().
   */
  public resetMockStore(): void {
    const clearResult = clearPersistedSnapshot();
    if (!clearResult.success && clearResult.errorCode === 'STORAGE_UNAVAILABLE') {
      this.isWriteLocked = true;
      this.storageStatus = 'STORAGE_UNAVAILABLE';
      this.corruptionDetails = null;
      this.state = this.createDefaultSeedState();
      this.lastSavedState = deepClone(this.state);
      this.lastSaveResult = clearResult;
      this.notifyStorageListeners();
      return;
    }

    this.isWriteLocked = false;
    this.hasPendingMigrationPersist = false;
    this.needsNormalizedPersist = false;
    this.storageStatus = 'SUCCESS';
    this.corruptionDetails = null;
    this.state = this.createDefaultSeedState();
    this.lastSavedState = deepClone(this.state);
    this.lastSaveResult = { success: true };
    this.persist();
  }

  /**
   * @internal Reseed store ke kondisi awal bawaan pabrik.
   * Wajib memiliki otorisasi sah (OWNER_TICKET atau RECOVERY_JOURNAL)
   * dan jurnal berada pada STAGE_3_STORAGE_CLEARED.
   */
  public reseedStore(auth: ReseedAuth): void {
    const journal = getFactoryResetJournal();
    if (!journal || journal.stage !== 'STAGE_3_STORAGE_CLEARED') {
      throw new Error(
        `Reseed ditolak: Tahap jurnal tidak valid (${journal?.stage || 'NONE'}). Reseed hanya diizinkan pada STAGE_3_STORAGE_CLEARED.`
      );
    }

    if (auth.type === 'OWNER_TICKET') {
      if (!this.activeReseedTicket) {
        throw new Error('Reseed ditolak: Tidak ada tiket reseed aktif.');
      }
      if (this.activeReseedTicket.ticketId !== auth.ticket) {
        throw new Error('Reseed ditolak: Tiket reseed tidak cocok.');
      }
      if (this.activeReseedTicket.expiresAt <= Date.now()) {
        this.activeReseedTicket = null;
        throw new Error('Reseed ditolak: Tiket reseed telah kedaluwarsa.');
      }
      // Konsumsi tiket (sekali pakai)
      this.activeReseedTicket = null;
    } else if (auth.type === 'RECOVERY_JOURNAL') {
      if (journal.id !== auth.journalId) {
        throw new Error('Reseed ditolak: ID jurnal pemulihan tidak cocok.');
      }
    } else {
      throw new Error('Reseed ditolak: Metode otorisasi tidak dikenal.');
    }

    this.hasPendingMigrationPersist = false;
    this.needsNormalizedPersist = false;
    this.storageStatus = 'SUCCESS';
    this.corruptionDetails = null;
    this.state = this.createDefaultSeedState();

    // Simpan snapshot seed secara eksplisit
    const saveResult = savePersistedSnapshot(this.state, {
      isWriteLocked: false,
      allowReseedPersist: true,
    });
    this.lastSaveResult = saveResult;

    if (!saveResult.success) {
      this.state = deepClone(this.lastSavedState);
      throw new Error(
        `[DataIntegrityError] Gagal menyimpan snapshot seed bawaan: ${saveResult.error || saveResult.errorCode}`
      );
    }

    this.lastSavedState = deepClone(this.state);
    // Write-lock tetap aktif hingga verifikasi dan cleanup jurnal selesai di service
    this.notifyStorageListeners();
  }

  /**
   * Memulihkan seluruh snapshot state dari cadangan yang telah divalidasi.
   * Dilindungi oleh otorisasi Owner aktif dan persistensi atomik ke LocalStorage.
   */
  public restoreSnapshot(newState: MockStoreState, bypassSessionGuard: boolean = false): void {
    if (!bypassSessionGuard) {
      this.assertActiveOwnerSession('memulihkan data cadangan');
    }
    this.state = deepClone(newState);
    this.isWriteLocked = false;
    this.hasPendingMigrationPersist = false;
    this.needsNormalizedPersist = false;
    this.storageStatus = 'SUCCESS';
    this.corruptionDetails = null;
    this.persist();
  }

  /**
   * Mengatur status proteksi tulis (write-lock) secara terkendali.
   */
  public setWriteLock(locked: boolean): void {
    this.isWriteLocked = locked;
    this.notifyStorageListeners();
  }

  /**
   * Mengembalikan status proteksi tulis (write-lock) saat ini.
   */
  public getIsWriteLocked(): boolean {
    return this.isWriteLocked;
  }

  /**
   * Memastikan bahwa migrasi HPP historis telah persisten ke storage sebelum mengizinkan mutasi finansial atau state.
   * Jika storage pulih, otomatis menyimpan seluruh snapshot migrasi secara atomik.
   * Jika storage masih gagal, operasi ditolak untuk mencegah desinkronisasi memori vs disk.
   */
  private ensureMigrationPersisted(): void {
    if (!this.hasPendingMigrationPersist) {
      return;
    }

    // Coba pulihkan persistensi jika storage sudah pulih
    try {
      const recoveryResult = savePersistedSnapshot(this.state, {
        isWriteLocked: this.isWriteLocked,
      });
      this.lastSaveResult = recoveryResult;
      if (recoveryResult.success) {
        this.hasPendingMigrationPersist = false;
        this.needsNormalizedPersist = false;
        this.lastSavedState = deepClone(this.state);
        this.notifyStorageListeners();
        return;
      }
    } catch (err: any) {
      this.lastSaveResult = {
        success: false,
        errorCode: 'WRITE_FAILED',
        error: err?.message || 'Gagal menyimpan snapshot ke storage',
      };
    }

    this.notifyStorageListeners();
    throw new Error(
      `[DataIntegrityError] Mutasi finansial ditolak: Migrasi HPP historis belum berhasil dipersist ke penyimpanan (${this.lastSaveResult.errorCode || 'PENDING_MIGRATION'}). Pulihkan penyimpanan terlebih dahulu.`
    );
  }

  public flushPendingMigration(): StorageSaveResult {
    if (!this.hasPendingMigrationPersist) {
      return { success: true };
    }
    const saveRes = savePersistedSnapshot(this.state, { isWriteLocked: this.isWriteLocked });
    this.lastSaveResult = saveRes;
    if (saveRes.success) {
      this.hasPendingMigrationPersist = false;
      this.needsNormalizedPersist = false;
      this.lastSavedState = deepClone(this.state);
    }
    this.notifyStorageListeners();
    return saveRes;
  }

  public isMigrationPersisted(): boolean {
    return !this.hasPendingMigrationPersist;
  }

  public getStorageStatusInfo(): StorageStatusInfo {
    return {
      status: this.storageStatus,
      isWriteLocked: this.isWriteLocked,
      hasPendingMigration: this.hasPendingMigrationPersist,
      lastSaveResult: deepClone(this.lastSaveResult),
      corruptionDetails: this.corruptionDetails ? deepClone(this.corruptionDetails) : null,
    };
  }

  public subscribeStorageStatus(listener: (info: StorageStatusInfo) => void): () => void {
    this.storageListeners.push(listener);
    return () => {
      this.storageListeners = this.storageListeners.filter(l => l !== listener);
    };
  }

  private notifyStorageListeners(): void {
    const info = this.getStorageStatusInfo();
    for (const listener of this.storageListeners) {
      try {
        listener(info);
      } catch (err) {
        console.error('[MockStore] Error notifying storage listener:', err);
      }
    }
  }

  /**
   * Reinitialize state dari storage secara terkendali untuk pengujian terisolasi
   * tanpa menyentuh storage browser nyata.
   */
  public reinitializeFromStorage(): StorageStatusInfo {
    this.state = this.initInitialState();
    if (this.needsNormalizedPersist && !this.isWriteLocked && this.storageStatus === 'SUCCESS') {
      try {
        const saveRes = savePersistedSnapshot(this.state, { isWriteLocked: this.isWriteLocked });
        this.lastSaveResult = saveRes;
        if (saveRes.success) {
          this.hasPendingMigrationPersist = false;
          this.needsNormalizedPersist = false;
          this.lastSavedState = deepClone(this.state);
        } else {
          this.hasPendingMigrationPersist = true;
        }
      } catch (err: any) {
        this.hasPendingMigrationPersist = true;
        this.lastSaveResult = {
          success: false,
          errorCode: 'WRITE_FAILED',
          error: err?.message || 'Auto-persist normalisasi status legacy gagal disimpan ke storage',
        };
        console.warn('[MockStore] Auto-persist normalisasi status legacy gagal disimpan ke storage:', err);
      }
    }
    this.notifyStorageListeners();
    return this.getStorageStatusInfo();
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
    const cleanPin = pin.trim();
    const matching = this.state.users.filter(
      u => u.pin && u.pin.trim() === cleanPin && u.is_active
    );
    // Tolak autentikasi jika PIN tidak ditemukan atau ambigu (duplikat di data tersimpan)
    if (matching.length !== 1) {
      return undefined;
    }
    return deepClone(matching[0]);
  }

  /**
   * Memvalidasi bahwa pemanggil memiliki sesi aktif yang terikat pada
   * pengguna terdaftar, aktif, dan memiliki role 'owner'.
   * Tidak mempercayai metadata atau payload caller.
   */
  public assertActiveOwnerSession(actionDescription: string): User {
    const session = sessionManager.getSession();
    if (!session?.userId) {
      throw new Error(`Aksi ditolak: Sesi login Owner aktif diperlukan untuk ${actionDescription}.`);
    }

    const sessionUser = (this.state.users || []).find(
      u => String(u.id) === String(session.userId)
    );

    if (!sessionUser) {
      throw new Error(`Aksi ditolak: Pengguna sesi tidak ditemukan.`);
    }

    if (!sessionUser.is_active) {
      throw new Error(`Aksi ditolak: Akun pengguna dinonaktifkan atau tidak aktif.`);
    }

    if (sessionUser.role !== 'owner') {
      throw new Error(`Hanya Owner yang berwenang ${actionDescription}.`);
    }

    return sessionUser;
  }

  public addUser(userData: Omit<User, 'id'> & { id?: string }): User {
    this.ensureMigrationPersisted();
    this.assertActiveOwnerSession('menambahkan pengguna baru');
    const memorySnapshot = deepClone(this.state);
    try {
      const emailLower = (userData.email || '').trim().toLowerCase();
      if (this.state.users.some(u => u.email.trim().toLowerCase() === emailLower)) {
        throw new Error('Email sudah digunakan oleh pengguna lain');
      }
      if (userData.pin) {
        const cleanPin = userData.pin.trim();
        if (!/^\d{4}$/.test(cleanPin)) {
          throw new Error('PIN harus berupa 4 digit angka numerik (0-9)');
        }
        if (this.state.users.some(u => u.pin && u.pin.trim() === cleanPin)) {
          throw new Error(`PIN "${cleanPin}" sudah digunakan oleh akun lain. Setiap pengguna wajib memiliki PIN unik.`);
        }
        userData.pin = cleanPin;
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
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  public updateUser(id: string, userData: Partial<User>): User {
    this.ensureMigrationPersisted();
    this.assertActiveOwnerSession('memperbarui data pengguna');
    const memorySnapshot = deepClone(this.state);
    try {
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
        const cleanPin = userData.pin.trim();
        if (!/^\d{4}$/.test(cleanPin)) {
          throw new Error('PIN harus berupa 4 digit angka numerik (0-9)');
        }
        if (
          this.state.users.some(
            u => String(u.id) !== String(id) && u.pin && u.pin.trim() === cleanPin
          )
        ) {
          throw new Error(`PIN "${cleanPin}" sudah digunakan oleh akun lain. Setiap pengguna wajib memiliki PIN unik.`);
        }
        userData.pin = cleanPin;
      }
      const updated: User = {
        ...this.state.users[index],
        ...userData,
        id: this.state.users[index].id,
      };
      this.state.users[index] = updated;
      this.persist();
      return deepClone(updated);
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  public deleteUser(id: string): boolean {
    this.ensureMigrationPersisted();
    this.assertActiveOwnerSession('menghapus pengguna');
    const memorySnapshot = deepClone(this.state);
    try {
      if (String(id) === 'usr-owner-01') {
        throw new Error('Akun Owner utama tidak dapat dihapus');
      }
      const initialLen = this.state.users.length;
      this.state.users = this.state.users.filter(u => String(u.id) !== String(id));
      const deleted = this.state.users.length < initialLen;
      if (deleted) this.persist();
      return deleted;
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
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
    this.ensureMigrationPersisted();
    this.assertActiveOwnerSession('menambahkan kategori produk');
    const memorySnapshot = deepClone(this.state);
    try {
      const rawName = catData.name !== undefined && catData.name !== null ? String(catData.name) : '';
      const cleanName = rawName.trim();
      if (!cleanName) {
        throw new Error('Nama kategori wajib diisi dan tidak boleh hanya berisi spasi');
      }
      const lowerName = cleanName.toLowerCase();
      const isDuplicate = this.state.categories.some(
        c => (c.name || '').trim().toLowerCase() === lowerName
      );
      if (isDuplicate) {
        throw new Error(`Nama kategori "${cleanName}" sudah terdaftar. Gunakan nama lain.`);
      }

      const slug = catData.slug || cleanName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
      const newCategory: Category = {
        ...catData,
        id: catData.id || `cat-${Date.now()}`,
        name: cleanName,
        slug,
        icon_name: catData.icon_name || 'Tag',
      };
      this.state.categories.push(newCategory);
      this.persist();
      return deepClone(newCategory);
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  public updateCategory(id: string, catData: Partial<Category>): Category {
    this.ensureMigrationPersisted();
    this.assertActiveOwnerSession('memperbarui kategori produk');
    const memorySnapshot = deepClone(this.state);
    try {
      const index = this.state.categories.findIndex(c => String(c.id) === String(id));
      if (index === -1) {
        throw new Error(`Category with ID ${id} not found`);
      }

      let updatedName = this.state.categories[index].name;
      let updatedSlug = this.state.categories[index].slug;

      if (catData.name !== undefined) {
        const rawName = catData.name !== null ? String(catData.name) : '';
        const cleanName = rawName.trim();
        if (!cleanName) {
          throw new Error('Nama kategori wajib diisi dan tidak boleh hanya berisi spasi');
        }
        const lowerName = cleanName.toLowerCase();
        const isDuplicate = this.state.categories.some(
          c => String(c.id) !== String(id) && (c.name || '').trim().toLowerCase() === lowerName
        );
        if (isDuplicate) {
          throw new Error(`Nama kategori "${cleanName}" sudah terdaftar. Gunakan nama lain.`);
        }
        updatedName = cleanName;
        if (!catData.slug) {
          updatedSlug = cleanName.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
        }
      }

      const updated: Category = {
        ...this.state.categories[index],
        ...catData,
        id: this.state.categories[index].id,
        name: updatedName,
        slug: catData.slug !== undefined ? catData.slug : updatedSlug,
      };
      this.state.categories[index] = updated;
      this.persist();
      return deepClone(updated);
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  public deleteCategory(id: string): boolean {
    this.ensureMigrationPersisted();
    this.assertActiveOwnerSession('menghapus kategori produk');
    const memorySnapshot = deepClone(this.state);
    try {
      const isUsed = this.state.products.some(p => String(p.category_id) === String(id));
      if (isUsed) {
        throw new Error('Kategori tidak dapat dihapus karena masih digunakan oleh produk aktif');
      }
      const initialLen = this.state.categories.length;
      this.state.categories = this.state.categories.filter(c => String(c.id) !== String(id));
      const deleted = this.state.categories.length < initialLen;
      if (deleted) this.persist();
      return deleted;
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
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
    this.ensureMigrationPersisted();
    this.assertActiveOwnerSession('menambahkan produk baru');
    const memorySnapshot = deepClone(this.state);
    try {
      const catExists = this.state.categories.some(c => String(c.id) === String(productData.category_id));
      if (!catExists) {
        throw new Error('Kategori yang dipilih tidak valid');
      }

      const rawName = productData.name !== undefined && productData.name !== null ? String(productData.name) : '';
      const cleanName = rawName.trim();
      if (!cleanName) {
        throw new Error('Nama produk wajib diisi');
      }

      const validPrice = parseAndValidatePrice(productData.price, 'Harga jual');
      const validCostPrice = productData.cost_price !== undefined
        ? parseAndValidatePrice(productData.cost_price, 'Harga modal (cost price)')
        : 0;

      const newProduct: Product = {
        ...productData,
        id: productData.id || `prd-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        name: cleanName,
        category_id: String(productData.category_id),
        price: validPrice,
        cost_price: validCostPrice,
        is_active: productData.is_active ?? true,
        is_favorite: productData.is_favorite ?? false,
      };
      this.state.products.push(newProduct);
      this.persist();
      return deepClone(newProduct);
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  public updateProduct(id: string, productData: Partial<Product>): Product {
    this.ensureMigrationPersisted();
    this.assertActiveOwnerSession('memperbarui produk');
    const memorySnapshot = deepClone(this.state);
    try {
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

      let updatedPrice = this.state.products[index].price;
      if (productData.price !== undefined) {
        updatedPrice = parseAndValidatePrice(productData.price, 'Harga jual');
      }

      let updatedCostPrice = this.state.products[index].cost_price;
      if (productData.cost_price !== undefined) {
        updatedCostPrice = parseAndValidatePrice(productData.cost_price, 'Harga modal (cost price)');
      }

      let updatedName = this.state.products[index].name;
      if (productData.name !== undefined) {
        const cleanName = String(productData.name).trim();
        if (!cleanName) {
          throw new Error('Nama produk tidak boleh kosong');
        }
        updatedName = cleanName;
      }

      const updated: Product = {
        ...this.state.products[index],
        ...productData,
        id: this.state.products[index].id,
        name: updatedName,
        category_id: productData.category_id !== undefined ? String(productData.category_id) : this.state.products[index].category_id,
        price: updatedPrice,
        cost_price: updatedCostPrice,
      };
      this.state.products[index] = updated;
      this.persist();
      return deepClone(updated);
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  public deleteProduct(id: string): boolean {
    this.ensureMigrationPersisted();
    this.assertActiveOwnerSession('menghapus produk');
    const memorySnapshot = deepClone(this.state);
    try {
      const initialLen = this.state.products.length;
      this.state.products = this.state.products.filter(p => String(p.id) !== String(id));
      this.state.recipes = this.state.recipes.filter(r => String(r.product_id) !== String(id));
      const deleted = this.state.products.length < initialLen;
      if (deleted) this.persist();
      return deleted;
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  public toggleProductFavorite(id: string): { is_favorite: boolean } {
    this.ensureMigrationPersisted();
    this.assertActiveOwnerSession('mengubah status favorit produk');
    const memorySnapshot = deepClone(this.state);
    try {
      const index = this.state.products.findIndex(p => String(p.id) === String(id));
      if (index === -1) {
        throw new Error(`Product with ID ${id} not found`);
      }
      const current = Boolean(this.state.products[index].is_favorite);
      this.state.products[index].is_favorite = !current;
      this.persist();
      return { is_favorite: !current };
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
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
    this.ensureMigrationPersisted();
    this.assertActiveOwnerSession('menambahkan bahan baku baru');
    const memorySnapshot = deepClone(this.state);
    try {
      const costPerUnit = Number(stockData.cost_per_unit) || 0;
      let initialBaseline: number | undefined = undefined;
      let initialSource: BaselineSource | undefined = undefined;

      if (stockData.baseline_cost_per_unit !== undefined) {
        const bVal = Number(stockData.baseline_cost_per_unit);
        if (isNaN(bVal) || !isFinite(bVal) || bVal < 0) {
          throw new Error('Biaya dasar awal (baseline) harus berupa angka valid dan tidak boleh negatif');
        }
        if (bVal > 0) {
          initialBaseline = bVal;
          initialSource = stockData.baseline_source || 'initial_stock_cost';
        }
      } else if (costPerUnit > 0) {
        // Aturan: Bahan baru memperoleh baseline awal dari biaya modal awal per satuan dasar
        initialBaseline = costPerUnit;
        initialSource = stockData.baseline_source || 'initial_stock_cost';
      }

      const nowIso = new Date().toISOString();
      const newStock: Stock = {
        ...stockData,
        id: stockData.id || `stk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        current_amount: Number(stockData.current_amount) || 0,
        min_amount: Number(stockData.min_amount) || 0,
        cost_per_unit: costPerUnit,
        baseline_cost_per_unit: initialBaseline,
        baseline_source: initialSource,
        baseline_updated_at: initialSource ? nowIso : undefined,
        baseline_updated_by: initialSource ? 'System (Initial Stock)' : undefined,
      };
      this.normalizeStocks([newStock], this.state.stockHistories);
      this.state.stocks.push(newStock);
      this.persist();
      return deepClone(newStock);
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  public updateStock(
    id: string,
    stockData: Partial<Stock>,
    metadata?: { notes?: string; user_name?: string; role?: string }
  ): Stock {
    this.ensureMigrationPersisted();
    const memorySnapshot = deepClone(this.state);
    try {
      const index = this.state.stocks.findIndex(s => String(s.id) === String(id));
      if (index === -1) {
        throw new Error(`Stock with ID ${id} not found`);
      }
      const currentStock = this.state.stocks[index];
      const prevAmount = currentStock.current_amount;
      const hasNewAmount = stockData.current_amount !== undefined && stockData.current_amount !== null;
      const newAmount = hasNewAmount ? Number(stockData.current_amount) : prevAmount;

      if (newAmount < 0) {
        throw new Error('Jumlah stok tidak boleh negatif');
      }

      // Validasi Baseline Biaya & Provenance & Otorisasi Sesi Owner
      const hasBaselineInput = stockData.baseline_cost_per_unit !== undefined;
      let newBaseline = currentStock.baseline_cost_per_unit;
      let verifiedOwnerUser: User | null = null;

      if (hasBaselineInput) {
        const bVal = Number(stockData.baseline_cost_per_unit);
        if (isNaN(bVal) || !isFinite(bVal) || bVal < 0) {
          throw new Error('Biaya dasar awal (baseline) harus berupa angka valid dan tidak boleh negatif');
        }
        newBaseline = bVal > 0 ? bVal : undefined;

        // 1. Tolak jika caller secara eksplisit mengirimkan role non-owner
        const callerRole = metadata?.role ? metadata.role.toLowerCase() : undefined;
        if (callerRole && callerRole !== 'owner') {
          throw new Error('Aksi ditolak: Hanya peran Owner yang berhak mengubah baseline biaya bahan baku.');
        }

        // 2. Setiap perubahan atau konfirmasi baseline WAJIB memvalidasi sesi aktif Owner melalui sessionManager
        const session = sessionManager.getSession();
        if (!session?.userId) {
          throw new Error('Aksi ditolak: Sesi login Owner aktif diperlukan untuk mengelola baseline biaya bahan baku.');
        }

        // 3. Cocokkan session.userId dengan pengguna nyata dan aktif di this.state.users
        const sessionUser = this.state.users.find(
          u => String(u.id) === String(session.userId) && Boolean(u.is_active)
        );
        if (!sessionUser) {
          throw new Error('Aksi ditolak: Pengguna sesi tidak ditemukan atau tidak aktif.');
        }

        // 4. Pastikan peran pengguna pada sesi adalah 'owner' (tidak mempercayai metadata.role caller)
        if (sessionUser.role !== 'owner') {
          throw new Error('Aksi ditolak: Hanya peran Owner yang berhak mengubah baseline biaya bahan baku.');
        }

        verifiedOwnerUser = sessionUser;
      }

      const nowIso = new Date().toISOString();
      let updatedBaselineSource = currentStock.baseline_source;
      let updatedBaselineAt = currentStock.baseline_updated_at;
      let updatedBaselineBy = currentStock.baseline_updated_by;

      if (hasBaselineInput && verifiedOwnerUser) {
        if (newBaseline !== undefined) {
          updatedBaselineSource = 'owner_confirmed';
          updatedBaselineAt = nowIso;
          updatedBaselineBy = verifiedOwnerUser.name;
        } else {
          updatedBaselineSource = undefined;
          updatedBaselineAt = nowIso;
          updatedBaselineBy = verifiedOwnerUser.name;
        }
      }

      const updated: Stock = {
        ...currentStock,
        ...stockData,
        id: currentStock.id,
        current_amount: newAmount,
        min_amount: stockData.min_amount !== undefined ? Number(stockData.min_amount) : currentStock.min_amount,
        cost_per_unit: stockData.cost_per_unit !== undefined ? Number(stockData.cost_per_unit) : currentStock.cost_per_unit,
        baseline_cost_per_unit: newBaseline,
        baseline_source: updatedBaselineSource,
        baseline_updated_at: updatedBaselineAt,
        baseline_updated_by: updatedBaselineBy,
      };
      this.normalizeStocks([updated], this.state.stockHistories);
      this.state.stocks[index] = updated;

      // 1. Record history kuantitas stok (hanya jika kuantitas berubah)
      if (hasNewAmount && newAmount !== prevAmount) {
        const changeAmount = Math.round((newAmount - prevAmount) * 1000) / 1000;
        const notes = metadata?.notes?.trim() || 'Edit kuantitas stok manual';
        const userName = verifiedOwnerUser?.name || metadata?.user_name?.trim() || 'Owner';
        const historyEntry: StockHistory = {
          id: `sth-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          stock_id: updated.id,
          stock_name: updated.name,
          initial_amount: prevAmount,
          change_amount: changeAmount,
          final_amount: newAmount,
          unit: updated.unit,
          type: 'edit_manual',
          reason: 'Edit Manual Kuantitas',
          notes: notes,
          reference: `Edit Manual Kuantitas — ${notes}`,
          user_name: userName,
          created_at: nowIso,
        };
        this.state.stockHistories.unshift(historyEntry);
      }

      // 2. Record history perubahan atau konfirmasi baseline biaya
      if (hasBaselineInput && verifiedOwnerUser) {
        const actorName = verifiedOwnerUser.name;
        const isValueChanged = newBaseline !== currentStock.baseline_cost_per_unit;
        const prevStr = currentStock.baseline_cost_per_unit !== undefined
          ? `Rp ${currentStock.baseline_cost_per_unit.toLocaleString('id-ID')}`
          : 'Belum ditentukan';
        const nextStr = newBaseline !== undefined
          ? `Rp ${newBaseline.toLocaleString('id-ID')}`
          : 'Dikosongkan';

        const isReconfirmation = !isValueChanged;

        const baselineHistoryEntry: StockHistory = {
          id: `sth-${Date.now()}-${Math.floor(Math.random() * 1000) + 1}`,
          stock_id: updated.id,
          stock_name: updated.name,
          initial_amount: updated.current_amount,
          change_amount: 0, // Saldo stok fisik utuh
          final_amount: updated.current_amount,
          unit: updated.unit,
          type: 'penyesuaian',
          reason: isReconfirmation ? 'Konfirmasi Baseline Biaya' : 'Pembaruan Baseline Biaya',
          notes: isReconfirmation
            ? `Baseline biaya satuan dikonfirmasi ulang oleh Owner sebesar ${nextStr}/${updated.unit} (Sumber: owner_confirmed)`
            : `Baseline biaya satuan diubah dari ${prevStr} menjadi ${nextStr}/${updated.unit} (Sumber: owner_confirmed)`,
          reference: isReconfirmation
            ? `Konfirmasi Baseline Biaya — ${metadata?.notes?.trim() || 'Konfirmasi Ulang Owner'}`
            : `Pembaruan Baseline Biaya — ${metadata?.notes?.trim() || 'Penyesuaian Owner'}`,
          user_name: actorName,
          created_at: nowIso,
        };
        this.state.stockHistories.unshift(baselineHistoryEntry);
      }

      this.persist();
      return deepClone(updated);
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  public deleteStock(id: string): boolean {
    this.ensureMigrationPersisted();
    this.assertActiveOwnerSession('menghapus bahan baku');
    const memorySnapshot = deepClone(this.state);
    try {
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
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  public adjustStock(
    stockId: string,
    changeAmount: number,
    reason: string,
    userName: string = 'Owner',
    notes?: string
  ): Stock {
    this.ensureMigrationPersisted();
    const verifiedOwner = this.assertActiveOwnerSession('menyesuaikan stok bahan baku');
    const memorySnapshot = deepClone(this.state);
    try {
      const index = this.state.stocks.findIndex(s => String(s.id) === String(stockId));
      if (index === -1) {
        throw new Error(`Stock with ID ${stockId} not found`);
      }
      const stock = this.state.stocks[index];
      const prevAmount = stock.current_amount;
      if (prevAmount + changeAmount < 0) {
        throw new Error('Penyesuaian gagal: stok tidak boleh menjadi negatif');
      }
      const newAmount = Math.round((prevAmount + changeAmount) * 1000) / 1000;
      stock.current_amount = newAmount;

      const trimmedNotes = notes?.trim();
      const reference = trimmedNotes ? `${reason} — ${trimmedNotes}` : reason;

      // Record stock history entry with verified Owner name
      const historyEntry: StockHistory = {
        id: `sth-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        stock_id: stock.id,
        stock_name: stock.name,
        initial_amount: prevAmount,
        change_amount: changeAmount,
        final_amount: newAmount,
        unit: stock.unit,
        type: 'penyesuaian',
        reason: reason,
        notes: trimmedNotes,
        reference: reference,
        user_name: verifiedOwner.name || userName,
        created_at: new Date().toISOString(),
      };
      this.state.stockHistories.unshift(historyEntry);

      this.persist();
      return deepClone(stock);
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  /**
   * Migrasi satuan bahan baku legacy dan penyelarasan atomik seluruh resep aktif terkait.
   * Dilindungi kontrak:
   * 1. Otorisasi Owner aktif via sessionManager atau bukti token verifyPin (bukan objek semu).
   * 2. Validasi numerik finite ketat: stok aktual >= 0, biaya modal >= 0, takaran resep > 0.
   * 3. Validasi keutuhan resep dependen: 100% resep aktif wajib diselaraskan, ID unik, relevan.
   * 4. Two-tier atomic rollback: snapshot RAM dipulihkan 100% jika terjadi kesalahan validasi maupun kegagalan persistensi.
   */
  public migrateStockAndRecipes(payload: {
    stock_id: string;
    base_unit: BaseUnit;
    actual_physical_stock: number;
    cost_per_base_unit: number;
    recipe_adjustments: Array<{
      recipe_id: string;
      amount: number;
      unit: BaseUnit;
    }>;
    reason: string;
    actor_id: string;
    auth_token?: string;
    ticket_id?: string;
  }): { success: boolean; stock: Stock } {
    this.ensureMigrationPersisted();
    // TIER 1: Tangkap snapshot RAM sebelum menyentuh state apa pun
    const memorySnapshot = deepClone(this.state);

    let ticketToConsume: PinVerificationTicket | null = null;

    try {
      // 1. Otorisasi Owner
      // Jangan menerima objek role: 'owner' buatan pemanggil.
      // Identitas pengguna dan role WAJIB diverifikasi dari master state users yang aktif.
      if (!payload.actor_id || typeof payload.actor_id !== 'string') {
        throw new Error('[AuthError] Aksi ditolak: actor_id wajib disertakan.');
      }

      const actor = (this.state.users || []).find(
        u => String(u.id) === String(payload.actor_id) && u.is_active
      );
      if (!actor) {
        throw new Error('[AuthError] Aksi ditolak: Pengguna tidak valid atau tidak terdaftar sebagai pengguna aktif.');
      }

      if (actor.role !== 'owner') {
        throw new Error('[AuthError] Aksi ditolak: Hanya Owner aktif yang berwenang memverifikasi bahan baku.');
      }

      // 2. Validasi Tiket Verifikasi PIN Terbaru
      // Sesi login aktif saja TIDAK mencukupi dan TIDAK boleh melewati verifikasi PIN.
      // Token deterministik (seperti mock_pin_token_${userId}) DITOLAK.
      const providedTicketId = payload.ticket_id || payload.auth_token;
      if (!providedTicketId || typeof providedTicketId !== 'string' || !providedTicketId.trim()) {
        throw new Error(
          '[AuthError] Aksi ditolak: Tiket verifikasi PIN terbaru wajib disertakan. Sesi login saja tidak mencukupi.'
        );
      }

      const cleanTicketId = providedTicketId.trim();

      // Tolak token deterministik atau string tebakan
      if (cleanTicketId.startsWith('mock_pin_token_')) {
        throw new Error(
          '[AuthError] Aksi ditolak: Token deterministik tidak diterima sebagai bukti verifikasi PIN terbaru.'
        );
      }

      if (this.usedTicketIds.has(cleanTicketId)) {
        throw new Error(
          '[AuthError] Aksi ditolak: Tiket verifikasi PIN telah digunakan sebelumnya.'
        );
      }

      const ticket = this.pinVerificationTickets.get(cleanTicketId);
      if (!ticket) {
        throw new Error(
          '[AuthError] Aksi ditolak: Tiket verifikasi PIN tidak valid atau tidak ditemukan.'
        );
      }

      // Pastikan tiket terikat ke Owner yang bersangkutan
      if (String(ticket.userId) !== String(actor.id)) {
        throw new Error(
          '[AuthError] Aksi ditolak: Tiket verifikasi PIN milik pengguna lain dan tidak dapat digunakan.'
        );
      }

      if (ticket.userRole !== 'owner') {
        throw new Error(
          '[AuthError] Aksi ditolak: Tiket verifikasi PIN bukan diterbitkan untuk Owner.'
        );
      }

      // Periksa masa berlaku tiket (5 menit)
      if (Date.now() > ticket.expiresAt) {
        this.pinVerificationTickets.delete(ticket.ticketId);
        throw new Error(
          '[AuthError] Aksi ditolak: Tiket verifikasi PIN telah kedaluwarsa. Silakan masukkan PIN ulang.'
        );
      }

      // Periksa status penggunaan tiket (single-use replay protection)
      if (ticket.used) {
        throw new Error(
          '[AuthError] Aksi ditolak: Tiket verifikasi PIN telah digunakan sebelumnya.'
        );
      }

      ticketToConsume = ticket;

      // 2. Validasi Parameter Bahan
      const stockIndex = (this.state.stocks || []).findIndex(s => String(s.id) === String(payload.stock_id));
      if (stockIndex === -1) {
        throw new Error(`Bahan baku dengan ID "${payload.stock_id}" tidak ditemukan.`);
      }

      if (!['Gram', 'ml', 'Pcs'].includes(payload.base_unit)) {
        throw new Error('Satuan dasar wajib berupa Gram, ml, atau Pcs.');
      }

      if (
        typeof payload.actual_physical_stock !== 'number' ||
        !Number.isFinite(payload.actual_physical_stock) ||
        payload.actual_physical_stock < 0
      ) {
        throw new Error('Kuantitas stok fisik aktual harus berupa angka valid (finite) lebih besar atau sama dengan 0.');
      }

      if (
        typeof payload.cost_per_base_unit !== 'number' ||
        !Number.isFinite(payload.cost_per_base_unit) ||
        payload.cost_per_base_unit < 0
      ) {
        throw new Error('Harga modal dasar harus berupa angka valid (finite) lebih besar atau sama dengan 0.');
      }

      // 3. Validasi Seluruh Resep Dependen Aktif
      const dependentRecipes = (this.state.recipes || []).filter(r =>
        Array.isArray(r.ingredients) && r.ingredients.some(ing => String(ing.stock_id) === String(payload.stock_id))
      );

      if (!Array.isArray(payload.recipe_adjustments)) {
        throw new Error('Daftar penyesuaian resep wajib disertakan.');
      }

      const adjIds = payload.recipe_adjustments.map(a => String(a.recipe_id));
      if (new Set(adjIds).size !== adjIds.length) {
        throw new Error('Validasi resep gagal: Terdapat duplikasi ID resep dalam daftar konfirmasi.');
      }

      if (payload.recipe_adjustments.length !== dependentRecipes.length) {
        throw new Error(
          `Validasi resep gagal: Terdapat ${dependentRecipes.length} resep aktif yang menggunakan bahan ini, namun hanya ${payload.recipe_adjustments.length} yang dikonfirmasi. Seluruh resep dependen wajib diverifikasi.`
        );
      }

      for (const adj of payload.recipe_adjustments) {
        const matchedRecipe = dependentRecipes.find(r => String(r.id) === String(adj.recipe_id));
        if (!matchedRecipe) {
          throw new Error(`Validasi resep gagal: Resep dengan ID "${adj.recipe_id}" tidak relevan atau tidak menggunakan bahan ini.`);
        }

        if (typeof adj.amount !== 'number' || !Number.isFinite(adj.amount) || adj.amount <= 0) {
          throw new Error(`Validasi resep gagal: Takaran bahan pada resep "${matchedRecipe.id}" harus berupa angka valid (finite) lebih besar dari 0.`);
        }

        if (adj.unit !== payload.base_unit) {
          throw new Error(
            `Validasi resep gagal: Satuan resep "${matchedRecipe.id}" (${adj.unit}) tidak sesuai dengan satuan dasar bahan (${payload.base_unit}).`
          );
        }
      }

      // 4. Eksekusi Mutasi ke RAM
      const oldAmount = this.state.stocks[stockIndex].current_amount;
      this.state.stocks[stockIndex].unit = payload.base_unit;
      this.state.stocks[stockIndex].current_amount = payload.actual_physical_stock;
      this.state.stocks[stockIndex].cost_per_unit = payload.cost_per_base_unit;
      this.state.stocks[stockIndex].conversion_status = 'verified';

      for (const adj of payload.recipe_adjustments) {
        const rIdx = this.state.recipes.findIndex(r => String(r.id) === String(adj.recipe_id));
        if (rIdx !== -1) {
          const ingIdx = this.state.recipes[rIdx].ingredients.findIndex(
            ing => String(ing.stock_id) === String(payload.stock_id)
          );
          if (ingIdx !== -1) {
            this.state.recipes[rIdx].ingredients[ingIdx].amount = adj.amount;
            this.state.recipes[rIdx].ingredients[ingIdx].unit = payload.base_unit;
          }
        }
      }

      this.state.stockHistories.unshift({
        id: `sth-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        stock_id: payload.stock_id,
        stock_name: this.state.stocks[stockIndex].name,
        change_amount: payload.actual_physical_stock - oldAmount,
        unit: payload.base_unit,
        type: 'penyesuaian',
        reference: 'Migrasi Satuan Dasar & Verifikasi Resep Terkait',
        user_name: actor.name || 'Owner',
        final_amount: payload.actual_physical_stock,
        notes: payload.reason || 'Verifikasi migrasi satuan dasar dan takaran resep oleh Owner',
        created_at: new Date().toISOString(),
      });

      // Konsumsi tiket verifikasi PIN setelah seluruh mutasi RAM berhasil untuk mencegah replay
      if (ticketToConsume) {
        ticketToConsume.used = true;
        this.usedTicketIds.add(ticketToConsume.ticketId);
        this.pinVerificationTickets.delete(ticketToConsume.ticketId);
      }

      // 5. TIER 2: Persistensi ke disk (dilindungi kontrak storage integrity)
      this.persist();

      return { success: true, stock: deepClone(this.state.stocks[stockIndex]) };
    } catch (err) {
      // Rollback 100% jika terjadi kesalahan validasi, logic, atau disk error
      this.state = memorySnapshot;
      throw err;
    }
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
    this.ensureMigrationPersisted();
    this.assertActiveOwnerSession('menambahkan resep produk');
    const memorySnapshot = deepClone(this.state);
    try {
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
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  public updateRecipe(id: string, recipeData: Partial<Recipe>): Recipe {
    this.ensureMigrationPersisted();
    this.assertActiveOwnerSession('memperbarui resep produk');
    const memorySnapshot = deepClone(this.state);
    try {
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
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  public deleteRecipe(id: string): boolean {
    this.ensureMigrationPersisted();
    this.assertActiveOwnerSession('menghapus resep produk');
    const memorySnapshot = deepClone(this.state);
    try {
      const initialLen = this.state.recipes.length;
      this.state.recipes = this.state.recipes.filter(r => String(r.id) !== String(id));
      const deleted = this.state.recipes.length < initialLen;
      if (deleted) this.persist();
      return deleted;
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  // ----------------------------------------------------
  // SHIFTS
  // ----------------------------------------------------
  public getShifts(): Shift[] {
    return deepClone(this.state.shifts || []);
  }

  public getShiftById(id: string): Shift | undefined {
    const shift = (this.state.shifts || []).find(s => s.id === id);
    return shift ? deepClone(shift) : undefined;
  }

  public getActiveShift(): Shift | null {
    if (!this.state.activeShiftId) return null;
    const shift = (this.state.shifts || []).find(
      s => s.id === this.state.activeShiftId && s.status === 'open'
    );
    return shift ? deepClone(shift) : null;
  }

  public openShift(
    payloadOrCash: { cash_initial: number; user: User } | number,
    maybeUser?: User
  ): Shift {
    this.ensureMigrationPersisted();
    const payload = typeof payloadOrCash === 'object'
      ? payloadOrCash
      : { cash_initial: payloadOrCash, user: maybeUser! };

    if (!payload.user) {
      throw new Error('Identitas petugas pembuka shift wajib disertakan.');
    }

    if (this.state.activeShiftId) {
      const current = (this.state.shifts || []).find(s => s.id === this.state.activeShiftId);
      if (current && current.status === 'open') {
        throw new Error('Shift aktif sudah ada. Hanya satu shift aktif yang diperbolehkan pada perangkat kasir.');
      }
    }

    const cashInitial = Math.max(0, Number(payload.cash_initial) || 0);
    const now = new Date();
    const cutoff = this.state.settings?.operational_day_cutoff_time || '04:00';
    const operationalDate = getOperationalDate(now, cutoff);

    // Generate sequence number for shift: SHF-YYYYMMDD-01
    const dateCompact = operationalDate.replace(/-/g, '');
    const prefix = `SHF-${dateCompact}-`;
    let maxSeq = 0;
    (this.state.shifts || []).forEach(s => {
      if (s.shift_number && s.shift_number.startsWith(prefix)) {
        const parts = s.shift_number.split('-');
        if (parts.length === 3) {
          const seq = parseInt(parts[2], 10);
          if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
        }
      }
    });

    const shiftNumber = `${prefix}${String(maxSeq + 1).padStart(2, '0')}`;
    const shiftId = `shf-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const newShift: Shift = {
      id: shiftId,
      shift_number: shiftNumber,
      operational_date: operationalDate,
      status: 'open',
      opened_at: now.toISOString(),
      opened_by_user_id: payload.user.id,
      opened_by_name: payload.user.name,
      opened_by_role: payload.user.role,
      cash_initial: cashInitial,
      created_at: now.toISOString(),
    };

    if (!Array.isArray(this.state.shifts)) {
      this.state.shifts = [];
    }

    this.state.shifts.unshift(newShift);
    this.state.activeShiftId = shiftId;
    this.persist();
    return deepClone(newShift);
  }

  public closeShift(payload: {
    shift_id: string;
    actual_cash_end: number;
    actual_qris_end?: number | null;
    actual_refund_total?: number | null;
    cash_difference_reason?: string;
    qris_difference_reason?: string;
    notes?: string;
    user: User;
  }): Shift {
    this.ensureMigrationPersisted();
    const shiftIndex = (this.state.shifts || []).findIndex(s => s.id === payload.shift_id);
    if (shiftIndex === -1) {
      throw new Error('Data shift tidak ditemukan.');
    }

    const shift = this.state.shifts[shiftIndex];
    if (shift.status !== 'open') {
      throw new Error('Shift ini sudah ditutup sebelumnya.');
    }

    // Freeze permanent snapshot using single source of truth calculation
    const snapshot = calculateShiftFinancials(
      shift,
      this.state.orders,
      this.state.products,
      this.state.recipes,
      this.state.stocks,
      {
        actual_cash_end: payload.actual_cash_end,
        actual_qris_end: payload.actual_qris_end,
        actual_refund_total: payload.actual_refund_total,
        cash_difference_reason: payload.cash_difference_reason,
        qris_difference_reason: payload.qris_difference_reason,
        notes: payload.notes,
      }
    );

    // Validasi alasan selisih jika ada selisih
    const cashHasDiff = Math.abs(snapshot.cash_difference) >= 0.01;
    const qrisHasDiff = snapshot.qris_difference !== null && Math.abs(snapshot.qris_difference) >= 0.01;

    const effectiveCashReason = payload.cash_difference_reason || (cashHasDiff ? payload.notes : undefined);
    const effectiveQrisReason = payload.qris_difference_reason || (qrisHasDiff ? payload.notes : undefined);

    if (cashHasDiff && (!effectiveCashReason || !effectiveCashReason.trim())) {
      throw new Error('Alasan selisih kas wajib diisi ketika ada selisih uang kas di laci.');
    }

    if (qrisHasDiff && (!effectiveQrisReason || !effectiveQrisReason.trim())) {
      throw new Error('Alasan selisih QRIS wajib diisi ketika ada selisih nominal QRIS.');
    }

    const now = new Date();
    shift.status = 'closed';
    shift.closed_at = now.toISOString();
    shift.closed_by_user_id = payload.user.id;
    shift.closed_by_name = payload.user.name;
    shift.closed_by_role = payload.user.role;
    shift.notes = payload.notes;
    shift.reconciliation_status = snapshot.reconciliation_status;
    shift.cash_difference_reason = effectiveCashReason;
    shift.qris_difference_reason = effectiveQrisReason;
    shift.snapshot = {
      ...snapshot,
      cash_difference_reason: effectiveCashReason,
      qris_difference_reason: effectiveQrisReason,
    };

    // Rekam Audit Trail penutupan shift
    const closeAudit = {
      id: `sat-${Date.now()}-close`,
      action: 'closed' as const,
      user_id: payload.user.id,
      user_name: payload.user.name,
      user_role: payload.user.role,
      timestamp: now.toISOString(),
      notes: payload.notes,
      new_status: snapshot.reconciliation_status,
      details: {
        actual_cash_end: payload.actual_cash_end,
        actual_qris_end: payload.actual_qris_end,
        cash_difference: snapshot.cash_difference,
        qris_difference: snapshot.qris_difference,
        cash_difference_reason: effectiveCashReason,
        qris_difference_reason: effectiveQrisReason,
      },
    };

    if (!Array.isArray(shift.audit_trail)) {
      shift.audit_trail = [];
    }
    shift.audit_trail.push(closeAudit);

    if (this.state.activeShiftId === shift.id) {
      this.state.activeShiftId = null;
    }

    this.persist();
    return deepClone(shift);
  }

  public reviewShiftReconciliation(payload: {
    shift_id: string;
    action: 'approved_variance' | 'correction_requested';
    notes?: string;
    user?: User;
  }): Shift {
    this.ensureMigrationPersisted();
    const verifiedOwner = this.assertActiveOwnerSession('meninjau atau menyetujui selisih rekonsiliasi shift');

    const memorySnapshot = deepClone(this.state);
    try {
      const shiftIndex = (this.state.shifts || []).findIndex(s => s.id === payload.shift_id);
      if (shiftIndex === -1) {
        throw new Error('Data shift tidak ditemukan.');
      }

      const shift = this.state.shifts[shiftIndex];
      if (shift.status !== 'closed') {
        throw new Error('Hanya shift yang sudah ditutup yang dapat direview.');
      }

      if (!shift.snapshot) {
        throw new Error('Snapshot keuangan shift tidak ditemukan.');
      }

      const currentStatus = shift.reconciliation_status || shift.snapshot.reconciliation_status;
      if (currentStatus === 'approved_variance' || currentStatus === 'matched' || currentStatus === 'matched_corrected') {
        throw new Error('Shift sudah memiliki status final dan tidak dapat direview ulang.');
      }

      const prevStatus = currentStatus;
      const newStatus = payload.action === 'approved_variance'
        ? ('approved_variance' as const)
        : ('correction_requested' as const);

      const now = new Date();
      shift.reconciliation_status = newStatus;
      shift.snapshot.reconciliation_status = newStatus;
      shift.reviewed_by_user_id = verifiedOwner.id;
      shift.reviewed_by_name = verifiedOwner.name;
      shift.reviewed_at = now.toISOString();
      shift.review_action = payload.action;
      shift.review_notes = payload.notes || undefined;

      const reviewAudit = {
        id: `sat-${Date.now()}-review`,
        action: payload.action === 'approved_variance' ? ('review_approved' as const) : ('review_rejected' as const),
        user_id: verifiedOwner.id,
        user_name: verifiedOwner.name,
        user_role: verifiedOwner.role,
        timestamp: now.toISOString(),
        notes: payload.notes || undefined,
        previous_status: prevStatus,
        new_status: newStatus,
      };

      if (!Array.isArray(shift.audit_trail)) {
        shift.audit_trail = [];
      }
      shift.audit_trail.push(reviewAudit);

      this.persist();
      return deepClone(shift);
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  public correctShiftReconciliation(payload: {
    shift_id: string;
    actual_cash_end: number;
    actual_qris_end: number | null;
    actual_refund_total?: number | null;
    cash_difference_reason?: string;
    qris_difference_reason?: string;
    correction_notes?: string;
    user: User;
  }): Shift {
    this.ensureMigrationPersisted();
    const shiftIndex = (this.state.shifts || []).findIndex(s => s.id === payload.shift_id);
    if (shiftIndex === -1) {
      throw new Error('Data shift tidak ditemukan.');
    }

    const shift = this.state.shifts[shiftIndex];
    if (shift.status !== 'closed') {
      throw new Error('Hanya shift yang sudah ditutup yang dapat dikoreksi.');
    }

    if (shift.reconciliation_status !== 'correction_requested') {
      throw new Error('Koreksi hanya dapat dilakukan pada shift yang berstatus perlu koreksi.');
    }

    const prevSnapshot = deepClone(shift.snapshot!);
    const prevStatus = shift.reconciliation_status;

    // Hitung ulang snapshot dengan actuals terkoreksi
    const newSnapshot = calculateShiftFinancials(
      shift,
      this.state.orders,
      this.state.products,
      this.state.recipes,
      this.state.stocks,
      {
        actual_cash_end: payload.actual_cash_end,
        actual_qris_end: payload.actual_qris_end,
        actual_refund_total: payload.actual_refund_total ?? shift.snapshot?.actual_refund_total,
        cash_difference_reason: payload.cash_difference_reason,
        qris_difference_reason: payload.qris_difference_reason,
        notes: shift.notes,
      }
    );

    const now = new Date();
    if (newSnapshot.reconciliation_status === 'matched') {
      newSnapshot.reconciliation_status = 'matched_corrected';
      shift.reconciliation_status = 'matched_corrected';
    } else {
      shift.reconciliation_status = newSnapshot.reconciliation_status;
    }
    shift.snapshot = newSnapshot;
    shift.cash_difference_reason = payload.cash_difference_reason;
    shift.qris_difference_reason = payload.qris_difference_reason;

    const correctionAudit = {
      id: `sat-${Date.now()}-correct`,
      action: 'corrected' as const,
      user_id: payload.user.id,
      user_name: payload.user.name,
      user_role: payload.user.role,
      timestamp: now.toISOString(),
      notes: payload.correction_notes,
      previous_status: prevStatus,
      new_status: shift.reconciliation_status,
      details: {
        previous_cash_end: prevSnapshot.actual_cash_end,
        corrected_cash_end: payload.actual_cash_end,
        previous_qris_end: prevSnapshot.actual_qris_end,
        corrected_qris_end: payload.actual_qris_end,
      },
    };

    if (!Array.isArray(shift.audit_trail)) {
      shift.audit_trail = [];
    }
    shift.audit_trail.push(correctionAudit);

    this.persist();
    return deepClone(shift);
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
    shift_id?: string;
    operational_date?: string;
    include_refunds_in_range?: boolean;
  }): Order[] {
    let result = [...this.state.orders];

    if (params?.shift_id) {
      result = result.filter(o => o.shift_id === params.shift_id);
    }
    if (params?.operational_date) {
      result = result.filter(o => o.operational_date === params.operational_date);
    }
    if (params?.date) {
      result = result.filter(o => o.created_at.startsWith(params.date!));
    }
    if (params?.include_refunds_in_range && (params?.start_date || params?.end_date)) {
      const start = params.start_date
        ? new Date(params.start_date.includes('T') ? params.start_date : `${params.start_date}T00:00:00`)
        : null;
      if (start) start.setHours(0, 0, 0, 0);
      const end = params.end_date
        ? new Date(params.end_date.includes('T') ? params.end_date : `${params.end_date}T23:59:59.999`)
        : null;
      if (end) end.setHours(23, 59, 59, 999);

      result = result.filter(o => {
        const orderDate = new Date(o.created_at);
        const inOrderRange = (!start || orderDate >= start) && (!end || orderDate <= end);
        const hasValidRefundDate = Boolean(o.refunded_at && !isNaN(new Date(o.refunded_at).getTime()));
        const refundDate = hasValidRefundDate ? new Date(o.refunded_at!) : null;
        const inRefundRange = Boolean(
          refundDate &&
          (!start || refundDate >= start) &&
          (!end || refundDate <= end)
        );
        return inOrderRange || inRefundRange;
      });
    } else {
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
   * 1. Validate that an active shift exists and bind order to active shift and operational date.
   * 2. Auto-generate sequential unique order_number (ORD-YYYYMMDD-XXXX) if not provided.
   * 3. Pre-validate stock availability for all aggregated recipe ingredients across all items.
   * 4. Atomically deduct ingredient stock and record StockHistory entries ('penjualan').
   * 5. Prepend order to orders collection and persist to storage.
   * If any precondition fails, aborts immediately without any state mutations.
   */
  public addOrder(orderData: Omit<Order, 'id' | 'order_number'> & { id?: string; order_number?: string }): Order {
    this.ensureMigrationPersisted();
    // Validate that an active shift is open on this cashier device
    const activeShift = this.getActiveShift();
    const effectiveShiftId = orderData.shift_id || activeShift?.id;
    if (!effectiveShiftId) {
      throw new Error('Shift kasir belum dibuka. Buka shift kasir terlebih dahulu untuk memproses transaksi.');
    }

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

    // Pre-validate stock sufficiency and verification status BEFORE modifying any state
    for (const req of requirements) {
      const stock = this.state.stocks.find(s => String(s.id) === req.stockId);
      if (!stock) {
        throw new Error(`Bahan baku "${req.stockName}" (ID: ${req.stockId}) tidak ditemukan di inventaris`);
      }
      if ((stock as any).conversion_status === 'unverified_legacy') {
        throw new Error(
          `Transaksi ditolak: Bahan baku "${stock.name}" memiliki satuan lama (${stock.unit}) yang belum diverifikasi. Harap lakukan verifikasi satuan dasar di menu Inventaris terlebih dahulu.`
        );
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

    const cutoff = this.state.settings?.operational_day_cutoff_time || '04:00';
    const effectiveOperationalDate = orderData.operational_date || activeShift?.operational_date || getOperationalDate(now, cutoff);

    // Snapshot HPP per item and total order HPP at transaction creation (Unit-First Integer Policy)
    let orderTotalHPP = 0;
    const snapshottedItems = items.map((item, idx) => {
      const qty = Number(item.qty) || 1;
      const price = Number(item.price) || 0;

      // If unit_cost_price already present and valid, preserve it
      if (typeof item.unit_cost_price === 'number' && item.unit_cost_price >= 0) {
        const roundedUnitCost = Math.round(item.unit_cost_price);
        const itemSubtotalCost = typeof item.subtotal_cost === 'number' && item.subtotal_cost >= 0
          ? item.subtotal_cost
          : roundedUnitCost * qty;
        orderTotalHPP += itemSubtotalCost;
        return {
          ...item,
          id: item.id || `item-${Date.now()}-${idx + 1}`,
          price,
          qty,
          subtotal: Number(item.subtotal) || price * qty,
          unit_cost_price: roundedUnitCost,
          subtotal_cost: itemSubtotalCost,
          is_estimated_cost: Boolean(item.is_estimated_cost),
        };
      }

      // Compute HPP snapshot using single source of truth helper
      const { unitCost, isEstimatedFallback } = calculateItemUnitHPP(
        item.product_id,
        price,
        this.state.products,
        this.state.recipes,
        this.state.stocks
      );
      // Unit-First Integer Policy: Round unit cost to integer Rupiah first, then multiply by qty
      const roundedUnitCost = Math.round(unitCost);
      const subtotalCost = roundedUnitCost * qty;
      orderTotalHPP += subtotalCost;

      return {
        ...item,
        id: item.id || `item-${Date.now()}-${idx + 1}`,
        price,
        qty,
        subtotal: Number(item.subtotal) || price * qty,
        unit_cost_price: roundedUnitCost,
        subtotal_cost: subtotalCost,
        is_estimated_cost: isEstimatedFallback,
      };
    });

    const newOrder: Order = {
      ...orderData,
      id: orderId,
      order_number: orderNumber,
      shift_id: effectiveShiftId,
      operational_date: effectiveOperationalDate,
      items: snapshottedItems,
      total_hpp: Math.round(orderTotalHPP),
      hpp_source: orderData.hpp_source || 'transaction_snapshot',
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
    this.ensureMigrationPersisted();
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

  public refundOrder(
    id: string,
    metadata?: { refunded_by_name?: string; refund_reason?: string; refund_method?: PaymentMethod }
  ): Order {
    this.ensureMigrationPersisted();
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

    // Record audit trail & shift association
    order.refunded_at = new Date().toISOString();
    if (metadata?.refunded_by_name) {
      order.refunded_by_name = metadata.refunded_by_name;
    }
    if (metadata?.refund_reason) {
      order.refund_reason = metadata.refund_reason;
    }
    if (this.state.activeShiftId) {
      order.refund_shift_id = this.state.activeShiftId;
    }
    if (metadata?.refund_method) {
      order.refund_method = metadata.refund_method;
    } else {
      order.refund_method = undefined;
    }

    // BUSINESS RULE: Consumed recipe ingredients MUST NOT be returned to stock!
    // Stock quantity is retained without mutation (no +returned, no double deduction).
    // Instead, update existing consumption history entries for this order from 'penjualan' to 'refund'.
    const orderNum = order.order_number;
    if (orderNum && Array.isArray(this.state.stockHistories)) {
      this.state.stockHistories.forEach(h => {
        if (h.reference && h.reference.includes(orderNum)) {
          h.type = 'refund';
          if (h.reference.startsWith('Penjualan #')) {
            h.reference = h.reference.replace('Penjualan #', 'Refund Penjualan #');
          } else if (!h.reference.startsWith('Refund Penjualan')) {
            h.reference = `Refund Penjualan #${orderNum}`;
          }
          if (metadata?.refunded_by_name) {
            h.user_name = metadata.refunded_by_name;
          }
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
    this.ensureMigrationPersisted();
    const memorySnapshot = deepClone(this.state);

    try {
      const items = Array.isArray(purchaseData.items) ? purchaseData.items : [];
      if (items.length === 0) {
        throw new Error('Daftar barang belanjaan wajib diisi (minimal 1 barang).');
      }

      // TIER 1: Pre-validasi dan kalkulasi seluruh item secara atomik
      const processedItems: PurchaseItem[] = [];
      const stockMutations: Array<{
        stockIndex: number;
        baseQtyToAdd: number;
        costPerBaseUnit: number;
        historyNote: string;
        packageUnit?: string;
        conversionRatio?: number;
        packagePrice?: number;
      }> = [];

      for (let idx = 0; idx < items.length; idx++) {
        const item = items[idx];
        if (!item.stock_id) {
          throw new Error(`Item #${idx + 1}: Bahan baku wajib dipilih.`);
        }

        const stockIndex = (this.state.stocks || []).findIndex(
          s => String(s.id) === String(item.stock_id)
        );
        if (stockIndex === -1) {
          throw new Error(`Item #${idx + 1}: Bahan baku dengan ID "${item.stock_id}" tidak ditemukan di inventaris.`);
        }
        const stock = this.state.stocks[stockIndex];

        // Tentukan apakah pembelian memakai kemasan supplier atau langsung satuan dasar
        const hasPackageInput = item.package_qty !== undefined || item.conversion_ratio !== undefined || item.package_price !== undefined;

        let packageQty = hasPackageInput ? Number(item.package_qty) : Number(item.qty);
        let conversionRatio = hasPackageInput ? Number(item.conversion_ratio) : 1;
        let packageUnit = hasPackageInput ? (item.package_unit || 'Kemasan').trim() : stock.unit;
        let packagePrice = hasPackageInput ? Number(item.package_price) : Number(item.unit_cost);

        // Jika tidak ada package input eksplisit, tapi ada qty dan unit_cost
        if (!hasPackageInput) {
          packageQty = Number(item.qty);
          conversionRatio = 1;
          packageUnit = stock.unit;
          packagePrice = Number(item.unit_cost);
        }

        // Jalankan validasi konversi kemasan ketat
        const validation = validatePackagingConversion({
          stockName: stock.name,
          baseUnit: stock.unit,
          packageQty,
          conversionRatio,
          packagePrice,
          packageUnit,
        });

        if (!validation.isValid) {
          throw new Error(validation.error || `Validasi item "${stock.name}" gagal.`);
        }

        const totalBaseQty = validation.totalBaseQuantity!;
        const costPerBaseUnit = validation.costPerBaseUnit!;
        const totalCost = validation.totalCost!;

        const processedItem: PurchaseItem = {
          ...item,
          id: item.id || `pur-item-${Date.now()}-${idx + 1}`,
          stock_id: stock.id,
          stock_name: stock.name,
          package_qty: packageQty,
          package_unit: packageUnit,
          package_price: packagePrice,
          conversion_ratio: conversionRatio,
          qty: totalBaseQty,
          unit: stock.unit,
          unit_cost: costPerBaseUnit,
          total_cost: totalCost,
          conversion_status: 'verified',
        };

        processedItems.push(processedItem);

        const historyNote = hasPackageInput && conversionRatio !== 1
          ? `Beli ${packageQty} ${packageUnit} @ Rp${packagePrice.toLocaleString('id-ID')} (isi ${conversionRatio} ${stock.unit}/${packageUnit})`
          : `Beli langsung ${totalBaseQty} ${stock.unit} @ Rp${costPerBaseUnit.toLocaleString('id-ID')}/${stock.unit}`;

        stockMutations.push({
          stockIndex,
          baseQtyToAdd: totalBaseQty,
          costPerBaseUnit,
          historyNote,
          packageUnit,
          conversionRatio,
          packagePrice,
        });
      }

      // Hitung total belanja dari seluruh item yang sudah divalidasi
      const totalAmount = processedItems.reduce((sum, it) => sum + it.total_cost, 0);

      const purchaseId = purchaseData.id || `pur-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const purchaseNumber = purchaseData.purchase_number || `PO-${Date.now()}`;

      const newPurchase: Purchase = {
        ...purchaseData,
        id: purchaseId,
        purchase_number: purchaseNumber,
        total_amount: totalAmount,
        items: processedItems,
      };

      // TIER 2: Mutasi ke RAM (stocks dan stockHistories)
      this.state.purchases.unshift(newPurchase);

      for (const mut of stockMutations) {
        const targetStock = this.state.stocks[mut.stockIndex];
        targetStock.current_amount += mut.baseQtyToAdd;
        if (mut.costPerBaseUnit > 0) {
          targetStock.cost_per_unit = mut.costPerBaseUnit;
        }
        // Simpan preferensi kemasan terakhir untuk prefill berikutnya
        targetStock.default_package_unit = mut.packageUnit;
        targetStock.default_package_size = mut.conversionRatio;
        targetStock.default_package_price = mut.packagePrice;

        this.state.stockHistories.unshift({
          id: `sth-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          stock_id: targetStock.id,
          stock_name: targetStock.name,
          change_amount: mut.baseQtyToAdd,
          unit: targetStock.unit,
          type: 'pembelian',
          reference: `Pembelian #${newPurchase.purchase_number}`,
          user_name: 'Owner',
          final_amount: targetStock.current_amount,
          notes: mut.historyNote,
          created_at: newPurchase.date ? `${newPurchase.date}T08:00:00.000Z` : new Date().toISOString(),
        });
      }

      // TIER 3: Persist ke LocalStorage
      this.persist();

      return deepClone(newPurchase);
    } catch (err) {
      // Rollback 100% RAM jika terjadi kegagalan validasi, logic, atau persistensi
      this.state = memorySnapshot;
      throw err;
    }
  }

  public updatePurchase(id: string, purchaseData: Partial<Purchase>): Purchase {
    this.ensureMigrationPersisted();
    const memorySnapshot = deepClone(this.state);
    try {
      const index = this.state.purchases.findIndex(p => String(p.id) === String(id));
      if (index === -1) {
        throw new Error(`Nota pembelian dengan ID ${id} tidak ditemukan.`);
      }
      const oldPurchase = this.state.purchases[index];

      // ── TIER 1: Tentukan daftar item baru ──────────────────────────────────────
      // Jika purchaseData membawa items baru, validasi dan proses semuanya.
      // Jika tidak membawa items, pertahankan items lama (perubahan header saja).
      const incomingItems = purchaseData.items;
      const hasNewItems = Array.isArray(incomingItems) && incomingItems.length > 0;

      let newProcessedItems: PurchaseItem[];
      type StockMutation = {
        stockIndex: number;
        stockId: string;
        baseQtyDelta: number;      // positif = tambah, negatif = kurangi
        newCostPerBaseUnit: number | null; // null = tidak ada perubahan harga
        historyNote: string;
      };
      const stockMutations: StockMutation[] = [];

      if (hasNewItems) {
        // ── TIER 1a: Validasi seluruh item baru secara atomik ──────────────────
        const processedItems: PurchaseItem[] = [];
        type RawMutation = {
          stockIndex: number;
          stockId: string;
          baseQtyToAdd: number;
          costPerBaseUnit: number;
          historyNote: string;
          packageUnit?: string;
          conversionRatio?: number;
          packagePrice?: number;
        };
        const rawMutations: RawMutation[] = [];

        for (let idx = 0; idx < incomingItems!.length; idx++) {
          const item = incomingItems![idx];
          if (!item.stock_id) {
            throw new Error(`Item #${idx + 1}: Bahan baku wajib dipilih.`);
          }
          const stockIndex = (this.state.stocks || []).findIndex(
            s => String(s.id) === String(item.stock_id)
          );
          if (stockIndex === -1) {
            throw new Error(`Item #${idx + 1}: Bahan baku ID "${item.stock_id}" tidak ditemukan.`);
          }
          const stock = this.state.stocks[stockIndex];

          const hasPackageInput = item.package_qty !== undefined || item.conversion_ratio !== undefined || item.package_price !== undefined;
          const packageQty    = hasPackageInput ? Number(item.package_qty)    : Number(item.qty);
          const conversionRatio = hasPackageInput ? Number(item.conversion_ratio) : 1;
          const packageUnit   = hasPackageInput ? (item.package_unit || 'Kemasan').trim() : stock.unit;
          const packagePrice  = hasPackageInput ? Number(item.package_price)   : Number(item.unit_cost);

          const validation = validatePackagingConversion({
            stockName: stock.name,
            baseUnit: stock.unit,
            packageQty,
            conversionRatio,
            packagePrice,
            packageUnit,
          });
          if (!validation.isValid) {
            throw new Error(validation.error || `Validasi item "${stock.name}" gagal.`);
          }

          const totalBaseQty    = validation.totalBaseQuantity!;
          const costPerBaseUnit = validation.costPerBaseUnit!;
          const totalCost       = validation.totalCost!;

          const historyNote = hasPackageInput && conversionRatio !== 1
            ? `Edit nota #${oldPurchase.purchase_number}: beli ${packageQty} ${packageUnit} @ Rp${packagePrice.toLocaleString('id-ID')} (isi ${conversionRatio} ${stock.unit}/${packageUnit})`
            : `Edit nota #${oldPurchase.purchase_number}: beli langsung ${totalBaseQty} ${stock.unit} @ Rp${costPerBaseUnit.toLocaleString('id-ID')}/${stock.unit}`;

          processedItems.push({
            ...item,
            id: item.id || `pur-item-${Date.now()}-${idx + 1}`,
            stock_id: stock.id,
            stock_name: stock.name,
            package_qty: packageQty,
            package_unit: packageUnit,
            package_price: packagePrice,
            conversion_ratio: conversionRatio,
            qty: totalBaseQty,
            unit: stock.unit,
            unit_cost: costPerBaseUnit,
            total_cost: totalCost,
            conversion_status: 'verified',
          });

          rawMutations.push({ stockIndex, stockId: stock.id, baseQtyToAdd: totalBaseQty, costPerBaseUnit, historyNote, packageUnit, conversionRatio, packagePrice });
        }

        // ── TIER 1b: Bangun peta delta per stok (new qty − old qty) ───────────
        // Kumpulkan kontribusi qty lama per stock_id
        const oldQtyMap: Record<string, number> = {};
        for (const oldItem of oldPurchase.items) {
          const sid = String(oldItem.stock_id);
          oldQtyMap[sid] = (oldQtyMap[sid] || 0) + Number(oldItem.qty);
        }
        // Kumpulkan kontribusi qty baru per stock_id
        const newQtyMap: Record<string, number> = {};
        const newCostMap: Record<string, number> = {};
        for (let i = 0; i < rawMutations.length; i++) {
          const sid = String(rawMutations[i].stockId);
          newQtyMap[sid] = (newQtyMap[sid] || 0) + rawMutations[i].baseQtyToAdd;
          // Simpan biaya terakhir (nanti dipakai untuk update cost_per_unit)
          newCostMap[sid] = rawMutations[i].costPerBaseUnit;
        }

        // Gabungkan semua stock_id yang terlibat (lama + baru)
        const allStockIds = new Set([...Object.keys(oldQtyMap), ...Object.keys(newQtyMap)]);
        for (const sid of allStockIds) {
          const sIdx = this.state.stocks.findIndex(s => String(s.id) === sid);
          if (sIdx === -1) continue;
          const delta = (newQtyMap[sid] || 0) - (oldQtyMap[sid] || 0);
          const resultingAmount = this.state.stocks[sIdx].current_amount + delta;
          if (resultingAmount < 0) {
            throw new Error(
              `Pengeditan nota akan membuat stok "${this.state.stocks[sIdx].name}" menjadi negatif ` +
              `(saat ini: ${this.state.stocks[sIdx].current_amount}, delta: ${delta}). Operasi dibatalkan.`
            );
          }
          const newCost = newCostMap[sid] !== undefined ? newCostMap[sid] : null;
          // Ambil catatan dari raw mutation pertama untuk stok ini
          const refMut = rawMutations.find(m => String(m.stockId) === sid);
          const note = refMut
            ? refMut.historyNote
            : `Edit nota #${oldPurchase.purchase_number}: penyesuaian stok ${delta >= 0 ? '+' : ''}${delta} ${this.state.stocks[sIdx].unit}`;
          stockMutations.push({ stockIndex: sIdx, stockId: sid, baseQtyDelta: delta, newCostPerBaseUnit: newCost, historyNote: note });
        }

        newProcessedItems = processedItems;
      } else {
        // Header-only edit: tidak ada perubahan stok
        newProcessedItems = oldPurchase.items;
      }

      // ── TIER 2: Mutasi RAM ─────────────────────────────────────────────────
      // Bangun objek Purchase baru
      const newTotalAmount = newProcessedItems.reduce((sum, it) => sum + it.total_cost, 0);
      const updatedPurchase: Purchase = {
        ...oldPurchase,
        ...purchaseData,
        id: oldPurchase.id,
        items: newProcessedItems,
        total_amount: hasNewItems ? newTotalAmount : (purchaseData.total_amount ?? oldPurchase.total_amount),
      };
      this.state.purchases[index] = updatedPurchase;

      // Terapkan delta stok + update cost_per_unit + catat histori
      const editTimestamp = updatedPurchase.date
        ? `${updatedPurchase.date}T08:01:00.000Z`
        : new Date().toISOString();

      for (const mut of stockMutations) {
        const targetStock = this.state.stocks[mut.stockIndex];
        targetStock.current_amount += mut.baseQtyDelta;

        // Kebijakan: gunakan harga terbaru yang valid dari nota yang baru diedit
        if (mut.newCostPerBaseUnit !== null && mut.newCostPerBaseUnit > 0) {
          // Scan seluruh pembelian remaining untuk stok ini, ambil yang terbaru
          const latestCost = this._findLatestCostPerUnit(String(mut.stockId));
          targetStock.cost_per_unit = latestCost ?? mut.newCostPerBaseUnit;
        }

        if (mut.baseQtyDelta !== 0) {
          this.state.stockHistories.unshift({
            id: `sth-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            stock_id: targetStock.id,
            stock_name: targetStock.name,
            change_amount: mut.baseQtyDelta,
            unit: targetStock.unit,
            type: 'penyesuaian',
            reference: `Edit Pembelian #${updatedPurchase.purchase_number}`,
            user_name: 'Owner',
            final_amount: targetStock.current_amount,
            notes: mut.historyNote,
            created_at: editTimestamp,
          });
        }
      }

      // ── TIER 3: Persist ───────────────────────────────────────────────────
      this.persist();
      return deepClone(updatedPurchase);
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  /**
   * Cari harga satuan dasar (cost_per_unit) terakhir yang valid untuk suatu stok
   * dari seluruh nota pembelian yang tersimpan (diurutkan berdasarkan tanggal terbaru).
   * Menggunakan urutan waktu konsisten dan aturan tie-break deterministik.
   * Memastikan nilai yang diambil adalah harga per satuan dasar, bukan harga kemasan.
   * Mengembalikan null jika tidak ada pembelian yang mengandung stok tersebut.
   */
  private _findLatestCostPerUnit(
    stockId: string,
    candidatePurchases?: Purchase[]
  ): number | null {
    const purchases = candidatePurchases || this.state.purchases;

    interface FoundCandidate {
      purchase: Purchase;
      baseCost: number;
    }

    const candidates: FoundCandidate[] = [];

    for (const purchase of purchases) {
      if (!Array.isArray(purchase.items)) continue;
      for (const item of purchase.items) {
        if (String(item.stock_id) === String(stockId)) {
          let baseCost = Number(item.unit_cost);

          // Jika ada package_price dan conversion_ratio valid, pastikan baseCost adalah per satuan dasar
          if (
            typeof item.package_price === 'number' &&
            item.package_price > 0 &&
            typeof item.conversion_ratio === 'number' &&
            item.conversion_ratio > 0
          ) {
            const calculatedBase = Math.round((item.package_price / item.conversion_ratio) * 1000) / 1000;
            // Jika unit_cost keliru diisi package_price padahal conversion_ratio > 1
            if (item.conversion_ratio > 1 && item.unit_cost === item.package_price) {
              baseCost = calculatedBase;
            } else if (baseCost <= 0) {
              baseCost = calculatedBase;
            }
          }

          if (baseCost > 0 && isFinite(baseCost)) {
            candidates.push({ purchase, baseCost });
          }
        }
      }
    }

    if (candidates.length === 0) return null;

    // Urutan deterministik:
    // 1. Tanggal (date) descending (format YYYY-MM-DD)
    // 2. Timestamp created_at descending
    // 3. purchase_number descending
    // 4. id descending
    candidates.sort((a, b) => {
      const dateA = a.purchase.date || '';
      const dateB = b.purchase.date || '';
      if (dateA !== dateB) {
        return dateB.localeCompare(dateA);
      }

      const timeA = a.purchase.created_at ? new Date(a.purchase.created_at).getTime() : 0;
      const timeB = b.purchase.created_at ? new Date(b.purchase.created_at).getTime() : 0;
      if (timeA !== timeB) {
        return timeB - timeA;
      }

      const numA = a.purchase.purchase_number || '';
      const numB = b.purchase.purchase_number || '';
      if (numA !== numB) {
        return numB.localeCompare(numA);
      }

      return String(b.purchase.id).localeCompare(String(a.purchase.id));
    });

    return candidates[0].baseCost;
  }

  public deletePurchase(id: string): boolean {
    this.ensureMigrationPersisted();
    const memorySnapshot = deepClone(this.state);
    try {
      const purchaseIndex = this.state.purchases.findIndex(p => String(p.id) === String(id));
      if (purchaseIndex === -1) return false;
      const purchase = this.state.purchases[purchaseIndex];

      const remainingPurchases = this.state.purchases.filter(p => String(p.id) !== String(id));

      // ── TIER 1: Validasi Pra-Mutasi (Anti-Negatif & Baseline Safety) ────────
      if (Array.isArray(purchase.items)) {
        // Agregasi pengurangan per stok untuk menangani multi-item dengan stock_id sama
        const deductionMap = new Map<string, number>();
        for (const item of purchase.items) {
          const sId = String(item.stock_id);
          deductionMap.set(sId, (deductionMap.get(sId) || 0) + Number(item.qty));
        }

        for (const [stockId, totalDeduction] of deductionMap.entries()) {
          const stockIndex = this.state.stocks.findIndex(s => String(s.id) === stockId);
          if (stockIndex === -1) continue;
          const targetStock = this.state.stocks[stockIndex];

          // 1. Validasi saldo stok tidak menjadi negatif (JANGAN gunakan Math.max(0, ...))
          const resultingAmount = targetStock.current_amount - totalDeduction;
          if (resultingAmount < 0) {
            throw new Error(
              `Penghapusan nota akan membuat stok "${targetStock.name}" menjadi negatif ` +
              `(saat ini: ${targetStock.current_amount}, akan dikurangi: ${totalDeduction}). ` +
              `Sesuaikan stok secara manual sebelum menghapus nota ini.`
            );
          }

          // 2. Validasi ketersediaan sumber biaya (Latest purchase tersisa ATAU Baseline sah)
          const nextCost = this._findLatestCostPerUnit(stockId, remainingPurchases);
          if (nextCost === null || nextCost <= 0) {
            // Tidak ada pembelian tersisa untuk stok ini.
            // Periksa apakah baseline yang sah tersimpan secara terpisah dan bukan unverified_legacy:
            const hasValidBaseline =
              typeof targetStock.baseline_cost_per_unit === 'number' &&
              isFinite(targetStock.baseline_cost_per_unit) &&
              targetStock.baseline_cost_per_unit > 0 &&
              targetStock.baseline_source !== 'unverified_legacy' &&
              Boolean(targetStock.baseline_source);

            if (!hasValidBaseline) {
              throw new Error(
                `Penghapusan nota ditolak: Bahan "${targetStock.name}" tidak memiliki riwayat pembelian lain ` +
                `dan baseline biaya sah tidak tersedia. Tetapkan baseline biaya terlebih dahulu sebelum menghapus nota ini.`
              );
            }
          }
        }
      }

      // ── TIER 2: Mutasi RAM ─────────────────────────────────────────────────
      this.state.purchases = remainingPurchases;

      const deleteTimestamp = purchase.date
        ? `${purchase.date}T08:02:00.000Z`
        : new Date().toISOString();

      if (Array.isArray(purchase.items)) {
        for (const item of purchase.items) {
          const stockIndex = this.state.stocks.findIndex(
            s => String(s.id) === String(item.stock_id)
          );
          if (stockIndex === -1) continue;
          const targetStock = this.state.stocks[stockIndex];

          // Revert quantity
          targetStock.current_amount -= Number(item.qty);

          // Update cost_per_unit sesuai aturan:
          // Jika ada pembelian lain tersisa -> pakai nextCost
          // Jika tidak ada -> pulihkan baseline_cost_per_unit (sudah divalidasi sah di Tier 1)
          const nextCost = this._findLatestCostPerUnit(String(item.stock_id), this.state.purchases);
          if (nextCost !== null && nextCost > 0) {
            targetStock.cost_per_unit = nextCost;
          } else if (
            typeof targetStock.baseline_cost_per_unit === 'number' &&
            targetStock.baseline_cost_per_unit > 0 &&
            targetStock.baseline_source !== 'unverified_legacy' &&
            Boolean(targetStock.baseline_source)
          ) {
            targetStock.cost_per_unit = targetStock.baseline_cost_per_unit;
          }

          // Catat audit trail
          this.state.stockHistories.unshift({
            id: `sth-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
            stock_id: targetStock.id,
            stock_name: targetStock.name,
            change_amount: -Number(item.qty),
            unit: targetStock.unit,
            type: 'penyesuaian',
            reference: `Hapus Pembelian #${purchase.purchase_number}`,
            user_name: 'Owner',
            final_amount: targetStock.current_amount,
            notes: `Nota ${purchase.purchase_number} dihapus; stok dikembalikan -${item.qty} ${targetStock.unit}`,
            created_at: deleteTimestamp,
          });
        }
      }

      // ── TIER 3: Persist ───────────────────────────────────────────────────
      this.persist();
      return true;
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
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
    this.assertActiveOwnerSession('mengelola promo diskon');
    this.ensureMigrationPersisted();
    const memorySnapshot = deepClone(this.state);
    try {
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
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  public updateDiscountRule(
    id: string | number,
    payload: Partial<DiscountRule>
  ): DiscountRule {
    this.assertActiveOwnerSession('mengelola promo diskon');
    this.ensureMigrationPersisted();
    const memorySnapshot = deepClone(this.state);
    try {
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
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  public toggleActiveDiscountRule(id: string | number): DiscountRule {
    this.assertActiveOwnerSession('mengelola promo diskon');
    this.ensureMigrationPersisted();
    const memorySnapshot = deepClone(this.state);
    try {
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
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  public deleteDiscountRule(id: string | number): boolean {
    this.assertActiveOwnerSession('mengelola promo diskon');
    this.ensureMigrationPersisted();
    const memorySnapshot = deepClone(this.state);
    try {
      const initialLen = this.state.discountRules.length;
      this.state.discountRules = this.state.discountRules.filter(
        r => String(r.id) !== String(id)
      );
      const deleted = this.state.discountRules.length < initialLen;
      if (deleted) this.persist();
      return deleted;
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }

  // ----------------------------------------------------
  // SETTINGS
  // ----------------------------------------------------
  public getSettings(): Settings {
    const s = this.state.settings;
    return deepClone({
      ...s,
      operational_day_cutoff_time: s?.operational_day_cutoff_time || '04:00',
      receipt_paper_size: s?.receipt_paper_size === '58mm' ? '58mm' : '80mm',
    });
  }

  public updateSettings(newSettings: Partial<Settings>): Settings {
    this.ensureMigrationPersisted();
    this.assertActiveOwnerSession('mengubah pengaturan toko');
    const memorySnapshot = deepClone(this.state);
    try {
      if (newSettings.operational_day_cutoff_time !== undefined) {
        const trimmedCutoff = String(newSettings.operational_day_cutoff_time).trim();
        const cutoffRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
        if (!cutoffRegex.test(trimmedCutoff)) {
          throw new Error('Format jam cutoff operasional tidak valid. Gunakan format 24 jam HH:mm (contoh: 04:00 atau 23:30).');
        }
      }

      if (newSettings.receipt_paper_size !== undefined) {
        if (newSettings.receipt_paper_size !== '58mm' && newSettings.receipt_paper_size !== '80mm') {
          throw new Error('Ukuran kertas struk tidak valid. Pilih antara 58mm atau 80mm.');
        }
      }

      let normalizedPhone = this.state.settings.phone;
      if (newSettings.phone !== undefined) {
        const rawPhone = String(newSettings.phone).trim();
        if (rawPhone) {
          if (!/^[+]?[\d\s\-().]+$/.test(rawPhone)) {
            throw new Error('Nomor telepon mengandung karakter tidak valid.');
          }
          const digitsOnly = rawPhone.replace(/\D/g, '');
          if (digitsOnly.length < 8 || digitsOnly.length > 16) {
            throw new Error('Nomor telepon harus memiliki 8 hingga 16 digit angka.');
          }
          normalizedPhone = (rawPhone.startsWith('+') ? '+' : '') + digitsOnly;
        } else {
          normalizedPhone = '';
        }
      }

      this.state.settings = {
        ...this.state.settings,
        ...newSettings,
        store_name:
          newSettings.store_name !== undefined
            ? String(newSettings.store_name).trim()
            : this.state.settings.store_name,
        tax_percentage:
          newSettings.tax_percentage !== undefined
            ? Number(newSettings.tax_percentage)
            : this.state.settings.tax_percentage,
        operational_day_cutoff_time:
          newSettings.operational_day_cutoff_time !== undefined
            ? String(newSettings.operational_day_cutoff_time).trim()
            : (this.state.settings.operational_day_cutoff_time || '04:00'),
        receipt_paper_size:
          newSettings.receipt_paper_size !== undefined
            ? newSettings.receipt_paper_size
            : (this.state.settings.receipt_paper_size || '80mm'),
        phone: normalizedPhone,
      };
      this.persist();
      return deepClone(this.state.settings);
    } catch (err) {
      this.state = memorySnapshot;
      throw err;
    }
  }
}

// Export singleton instance
export const mockStore = new MockStore();

if (typeof window !== 'undefined') {
  (window as any).mockStore = mockStore;
}
