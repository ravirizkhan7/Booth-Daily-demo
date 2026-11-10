import { Order, OrderItem, OrderHPPSource, Purchase, Product, Recipe, Stock, Settings, Shift } from '../types';
import { calculateGrossAmount, convertUnitQuantity, roundToRupiah } from './hppCalculation';
import { getOperationalDate } from './shiftCalculation';

export { getOperationalDate };

export type DateFilterType = 'today' | 'week' | 'month' | 'custom';

export interface PaymentSummaryItem {
  count: number;
  total: number;
  percentage: number;
}

export interface OrderTypeSummaryItem {
  count: number;
  total: number;
  percentage: number;
}

export interface TopProductItem {
  productId: string;
  name: string;
  qty: number;
  totalSales: number;
  percentage: number;
  category: string;
}

export interface ReportData {
  periodLabel: string;
  startDateStr: string;
  endDateStr: string;
  startOperationalDate?: string;
  endOperationalDate?: string;
  cutoffTime?: string;
  filterType: DateFilterType;
  filterUserId?: string;
  filterUserName?: string;
  filterUserRole?: string;

  // Overview KPIs
  totalSales: number;
  totalOrdersCount: number;
  avgOrderValue: number;
  totalPurchases: number;
  totalPurchasesCount: number;
  totalEstimatedHPP: number;
  estimatedGrossProfit: number;
  grossProfitMarginPercent: number;

  // Provenance / Snapshot HPP Metrics
  hppSnapshotOrdersCount: number;
  hppPartialSnapshotOrdersCount: number;
  hppLegacyEstimateOrdersCount: number;
  hasLegacyEstimatedHPP: boolean;
  hasPartialSnapshotHPP: boolean;

  // Pengembalian Dana (Refunds) pada Periode Laporan
  totalRefunds: number;
  cashRefunds: number;
  qrisRefunds: number;
  unknownRefunds: number;
  refundCount: number;

  // Arus Kas Operasional
  cashIn: number;
  cashOut: number;
  netCashFlow: number;

  // Diskon, Pajak, dan Biaya Layanan VIP
  totalDiscounts: number;
  totalTax: number;
  totalServiceCharge: number;
  vipOrdersCount: number;
  vipSales: number;
  regularOrdersCount: number;
  regularSales: number;

  // Analisis Pembayaran
  paymentBreakdown: {
    cash: PaymentSummaryItem;
    qris: PaymentSummaryItem;
    other?: PaymentSummaryItem;
  };

  // Analisis Tipe Pesanan
  orderTypeBreakdown: {
    dineIn: OrderTypeSummaryItem;
    takeaway: OrderTypeSummaryItem;
  };

  // Menu Terlaris
  topProducts: TopProductItem[];

  // Data List
  filteredOrders: Order[];
  transactionDetailOrders: Order[];
  transactionDetails: ReportTransactionDetailItem[];
  filteredPurchases: Purchase[];
  periodRefundOrders: Order[];

  // Snapshot Kondisi Stok Saat Ini
  lowStocks: Stock[];
}

export interface ReportTransactionDetailItem {
  order: Order;
  omzet: number;
  hpp: number;
  grossProfit: number;
  marginPercent: number;
  hppCategory: HPPCategory;
  hppCategoryLabel: string;
  discount: number;
  tax: number;
  serviceCharge: number;
  isVip: boolean;
  orderArea: 'regular' | 'vip';
}

export type ShiftLookup =
  | Shift[]
  | Map<string, Shift>
  | ((shiftId: string) => Shift | undefined);

/**
 * Mengambil tanggal operasional (YYYY-MM-DD) untuk sebuah order:
 * Prioritas 1: Jika `order.operational_date` sudah ada dan valid (YYYY-MM-DD), gunakan langsung.
 * Prioritas 2: Jika tidak tersedia, tetapi `order.shift_id` cocok dengan shift yang memiliki `operational_date` valid, gunakan tanggal operasional shift tersebut.
 * Prioritas 3: Fallback ke perhitungan `order.created_at` menggunakan jam cutoff operasional toko.
 */
export function getOrderOperationalDate(
  order: { operational_date?: string; created_at: string; shift_id?: string },
  cutoffTime: string = '04:00',
  shifts?: ShiftLookup
): string {
  // Prioritas 1: operational_date milik order jika valid YYYY-MM-DD
  if (order.operational_date && /^\d{4}-\d{2}-\d{2}$/.test(order.operational_date)) {
    return order.operational_date;
  }

  // Prioritas 2: Tanggal operasional dari shift yang menaunginya jika valid YYYY-MM-DD
  if (order.shift_id && shifts) {
    let matchedShift: Shift | undefined;
    if (shifts instanceof Map) {
      matchedShift = shifts.get(order.shift_id);
    } else if (Array.isArray(shifts)) {
      matchedShift = shifts.find(s => s && s.id === order.shift_id);
    } else if (typeof shifts === 'function') {
      try {
        matchedShift = shifts(order.shift_id);
      } catch {
        matchedShift = undefined;
      }
    }

    if (
      matchedShift &&
      matchedShift.operational_date &&
      /^\d{4}-\d{2}-\d{2}$/.test(matchedShift.operational_date)
    ) {
      return matchedShift.operational_date;
    }
  }

  // Prioritas 3: Fallback jam cutoff operasional dari created_at
  const dateObj = new Date(order.created_at);
  if (!isNaN(dateObj.getTime())) {
    return getOperationalDate(dateObj, cutoffTime);
  }
  return String(order.created_at || '').slice(0, 10);
}

/**
 * Mengambil tanggal operasional (YYYY-MM-DD) untuk refund sebuah order:
 * 1. Prioritas: jika order memiliki `refund_operational_date`, gunakan langsung.
 * 2. Jika ada `refunded_at`, hitung tanggal operasionalnya berdasarkan jam cutoff.
 * 3. Fallback: gunakan tanggal operasional pesanan aslinya (dengan resolusi shift lookup).
 */
export function getRefundOperationalDate(
  order: Order,
  cutoffTime: string = '04:00',
  shifts?: ShiftLookup
): string {
  if ((order as any).refund_operational_date && /^\d{4}-\d{2}-\d{2}$/.test((order as any).refund_operational_date)) {
    return (order as any).refund_operational_date;
  }
  // Jika refund terkait ke shift refund tertentu
  if ((order as any).refund_shift_id && shifts) {
    let matchedShift: Shift | undefined;
    if (shifts instanceof Map) {
      matchedShift = shifts.get((order as any).refund_shift_id);
    } else if (Array.isArray(shifts)) {
      matchedShift = shifts.find(s => s && s.id === (order as any).refund_shift_id);
    } else if (typeof shifts === 'function') {
      try {
        matchedShift = shifts((order as any).refund_shift_id);
      } catch {
        matchedShift = undefined;
      }
    }

    if (
      matchedShift &&
      matchedShift.operational_date &&
      /^\d{4}-\d{2}-\d{2}$/.test(matchedShift.operational_date)
    ) {
      return matchedShift.operational_date;
    }
  }
  if (order.refunded_at) {
    const d = new Date(order.refunded_at);
    if (!isNaN(d.getTime())) {
      return getOperationalDate(d, cutoffTime);
    }
  }
  return getOrderOperationalDate(order, cutoffTime, shifts);
}

/**
 * Mengambil tanggal operasional (YYYY-MM-DD) untuk pembelian/purchase:
 * 1. Prioritas: `purchase.date` jika sudah berformat YYYY-MM-DD.
 * 2. Fallback: hitung dari `purchase.created_at` menggunakan jam cutoff.
 */
export function getPurchaseOperationalDate(
  purchase: { date?: string; created_at?: string },
  cutoffTime: string = '04:00'
): string {
  if (purchase.date && /^\d{4}-\d{2}-\d{2}$/.test(purchase.date)) {
    return purchase.date;
  }
  if (purchase.created_at) {
    const d = new Date(purchase.created_at);
    if (!isNaN(d.getTime())) {
      return getOperationalDate(d, cutoffTime);
    }
  }
  return String(purchase.date || purchase.created_at || '').slice(0, 10);
}

/**
 * Menghitung rentang tanggal operasional dan label human-readable berdasarkan filter.
 * Menggunakan tanggal operasional toko (operational_day_cutoff_time) sebagai standar periode.
 */
export function getPeriodRange(
  filterType: DateFilterType,
  customStartStr?: string,
  customEndStr?: string,
  cutoffTime: string = '04:00',
  referenceDate: Date = new Date()
): {
  start: Date;
  end: Date;
  label: string;
  startFormatted: string;
  endFormatted: string;
  startOperationalDate: string;
  endOperationalDate: string;
} {
  const effectiveCutoff = cutoffTime || '04:00';
  const [cutoffHours, cutoffMinutes] = effectiveCutoff.split(':').map(Number);
  const currentOpDate = getOperationalDate(referenceDate, effectiveCutoff);

  let startOperationalDate: string;
  let endOperationalDate: string;
  let start: Date;
  let end: Date;
  let label: string;
  let startFormatted: string;
  let endFormatted: string;

  if (filterType === 'today') {
    startOperationalDate = currentOpDate;
    endOperationalDate = currentOpDate;

    const [y, m, d] = currentOpDate.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dateFormatted = new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(dateObj);

    start = new Date(y, m - 1, d, cutoffHours, cutoffMinutes, 0, 0);
    end = new Date(y, m - 1, d + 1, cutoffHours, cutoffMinutes, 0, -1);
    label = `Hari Ini (${dateFormatted})`;
    startFormatted = dateFormatted;
    endFormatted = dateFormatted;

    return {
      start,
      end,
      label,
      startFormatted,
      endFormatted,
      startOperationalDate,
      endOperationalDate,
    };
  }

  if (filterType === 'week') {
    endOperationalDate = currentOpDate;

    const [y, m, d] = currentOpDate.split('-').map(Number);
    const startDateObj = new Date(y, m - 1, d - 6);
    const sy = startDateObj.getFullYear();
    const sm = String(startDateObj.getMonth() + 1).padStart(2, '0');
    const sd = String(startDateObj.getDate()).padStart(2, '0');
    startOperationalDate = `${sy}-${sm}-${sd}`;

    start = new Date(startDateObj.getFullYear(), startDateObj.getMonth(), startDateObj.getDate(), cutoffHours, cutoffMinutes, 0, 0);
    end = new Date(y, m - 1, d + 1, cutoffHours, cutoffMinutes, 0, -1);

    const startFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(startDateObj);
    const endFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, d));

    label = `7 Hari Terakhir (${startFmt} - ${endFmt})`;
    startFormatted = startFmt;
    endFormatted = endFmt;

    return {
      start,
      end,
      label,
      startFormatted,
      endFormatted,
      startOperationalDate,
      endOperationalDate,
    };
  }

  if (filterType === 'month') {
    const [y, m] = currentOpDate.split('-').map(Number);
    startOperationalDate = `${y}-${String(m).padStart(2, '0')}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    endOperationalDate = `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    start = new Date(y, m - 1, 1, cutoffHours, cutoffMinutes, 0, 0);
    end = new Date(y, m, 1, cutoffHours, cutoffMinutes, 0, -1);

    const monthFmt = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(new Date(y, m - 1, 1));
    const startFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, 1));
    const endFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(y, m - 1, lastDay));

    label = `Bulan Ini (${monthFmt})`;
    startFormatted = startFmt;
    endFormatted = endFmt;

    return {
      start,
      end,
      label,
      startFormatted,
      endFormatted,
      startOperationalDate,
      endOperationalDate,
    };
  }

  // Custom Range
  const [cy, cm] = currentOpDate.split('-').map(Number);
  let sStr = customStartStr && /^\d{4}-\d{2}-\d{2}$/.test(customStartStr)
    ? customStartStr
    : `${cy}-${String(cm).padStart(2, '0')}-01`;
  let eStr = customEndStr && /^\d{4}-\d{2}-\d{2}$/.test(customEndStr)
    ? customEndStr
    : currentOpDate;

  if (sStr > eStr) {
    const tmp = sStr;
    sStr = eStr;
    eStr = tmp;
  }

  startOperationalDate = sStr;
  endOperationalDate = eStr;

  const [sy, sm, sd] = startOperationalDate.split('-').map(Number);
  const [ey, em, ed] = endOperationalDate.split('-').map(Number);

  start = new Date(sy, sm - 1, sd, cutoffHours, cutoffMinutes, 0, 0);
  end = new Date(ey, em - 1, ed + 1, cutoffHours, cutoffMinutes, 0, -1);

  const startFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(sy, sm - 1, sd));
  const endFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(ey, em - 1, ed));

  label = `Periode Kustom (${startFmt} s/d ${endFmt})`;
  startFormatted = startFmt;
  endFormatted = endFmt;

  return {
    start,
    end,
    label,
    startFormatted,
    endFormatted,
    startOperationalDate,
    endOperationalDate,
  };
}

/**
 * Mengecek apakah tanggal string (ISO atau YYYY-MM-DD) berada dalam rentang start & end
 */
export function isDateInRange(dateStr: string | undefined | null, start: Date, end: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d >= start && d <= end;
}

/**
 * Menghitung estimasi HPP untuk satu produk
 */
export function calculateItemUnitHPP(
  productId: string,
  sellingPrice: number,
  products: Product[] = [],
  recipes: Recipe[] = [],
  stocks: Stock[] = []
): { unitCost: number; isEstimatedFallback: boolean } {
  const numericPrice = Math.max(0, Number(sellingPrice) || 0);

  // 1. Cek apakah ada resep dengan bahan yang terhubung ke stok
  const recipe = recipes.find(r => r.product_id != null && String(r.product_id) === String(productId));
  if (recipe && Array.isArray(recipe.ingredients) && recipe.ingredients.length > 0) {
    let recipeCost = 0;
    let hasValidStockCost = false;

    for (const ing of recipe.ingredients) {
      if (!ing.stock_id) continue;
      const stockItem = stocks.find(s => s.id != null && String(s.id) === String(ing.stock_id));
      if (stockItem && typeof stockItem.cost_per_unit === 'number' && stockItem.cost_per_unit >= 0) {
        // Hitung kuantitas bruto dengan persentase susut (waste)
        const grossAmount = calculateGrossAmount(Number(ing.amount) || 0, ing.waste_percentage);
        // Konversi ke satuan dasar stok jika satuan berbeda
        const convertedAmount = convertUnitQuantity(
          grossAmount,
          ing.unit || stockItem.unit,
          stockItem.unit,
          { stockName: stockItem.name }
        );
        recipeCost += convertedAmount * stockItem.cost_per_unit;
        hasValidStockCost = true;
      }
    }

    if (hasValidStockCost && recipeCost > 0) {
      return { unitCost: roundToRupiah(recipeCost), isEstimatedFallback: false };
    }
  }

  // 2. Cek apakah master product memiliki cost_price valid
  const prd = products.find(p => p.id != null && String(p.id) === String(productId));
  if (prd && typeof prd.cost_price === 'number' && prd.cost_price > 0) {
    return { unitCost: roundToRupiah(prd.cost_price), isEstimatedFallback: false };
  }

  // 3. Fallback estimasi 40% dari harga jual jika data modal tidak tersedia / tidak valid
  return { unitCost: roundToRupiah(numericPrice * 0.4), isEstimatedFallback: true };
}

/**
 * Mengambil atau menghitung HPP total untuk satu Order (Single Source of Truth).
 * Mengutamakan snapshot `order.total_hpp` jika tersedia untuk mencegah perubahan retroaktif.
 * Jika tidak tersedia, menghitung dari item snapshot atau fallback legacy.
 */
export function getOrderTotalHPP(
  order: Order,
  products: Product[] = [],
  recipes: Recipe[] = [],
  stocks: Stock[] = []
): number {
  // 1. Utamakan snapshot total_hpp pada tingkat Order jika valid
  if (typeof order.total_hpp === 'number' && order.total_hpp >= 0) {
    return order.total_hpp;
  }

  // 2. Hitung dari item (baik item snapshot maupun fallback item)
  if (Array.isArray(order.items) && order.items.length > 0) {
    let orderHPP = 0;
    for (const item of order.items) {
      if (typeof item.subtotal_cost === 'number' && item.subtotal_cost >= 0) {
        orderHPP += item.subtotal_cost;
      } else if (typeof item.unit_cost_price === 'number' && item.unit_cost_price >= 0) {
        orderHPP += item.unit_cost_price * (Number(item.qty) || 1);
      } else {
        const { unitCost } = calculateItemUnitHPP(
          item.product_id,
          Number(item.price) || 0,
          products,
          recipes,
          stocks
        );
        const roundedUnit = roundToRupiah(unitCost);
        orderHPP += roundedUnit * (Number(item.qty) || 1);
      }
    }
    return roundToRupiah(orderHPP);
  }

  return 0;
}

export type HPPCategory = 'snapshot_riil' | 'partial_snapshot' | 'legacy_estimate';

/**
 * Mengklasifikasikan status HPP satu Order ke dalam 3 kategori presisi:
 * 1. 'legacy_estimate': Total diestimasi dari resep/stok (legacy) atau order.hpp_source === 'legacy_estimate'
 * 2. 'partial_snapshot': Total tersimpan valid/riil, tetapi rincian item sebagian atau seluruhnya adalah estimasi
 * 3. 'snapshot_riil': Total dan seluruh rincian item merupakan snapshot riil transaksi
 */
export function getOrderHPPCategory(order: Order): HPPCategory {
  if (order.hpp_source === 'legacy_estimate') {
    return 'legacy_estimate';
  }
  if (order.hpp_source === 'partial_snapshot') {
    return 'partial_snapshot';
  }

  const hasValidTotal = typeof order.total_hpp === 'number' && order.total_hpp >= 0;
  if (!hasValidTotal) {
    return 'legacy_estimate';
  }

  const items = Array.isArray(order.items) ? order.items : [];
  const hasEstimatedItems = items.some(it => Boolean(it.is_estimated_cost));
  const hasMissingItems = items.some(it => typeof it.unit_cost_price !== 'number' || it.unit_cost_price < 0);

  if (hasEstimatedItems || hasMissingItems) {
    return 'partial_snapshot';
  }

  return 'snapshot_riil';
}

/**
 * Memeriksa apakah pesanan merupakan pesanan dengan HPP estimasi legacy (total diestimasi).
 */
export function isLegacyEstimatedOrder(order: Order): boolean {
  return getOrderHPPCategory(order) === 'legacy_estimate';
}

/**
 * Memeriksa apakah pesanan memiliki total snapshot valid tetapi rincian item estimasi (partial snapshot).
 */
export function isPartialSnapshotOrder(order: Order): boolean {
  return getOrderHPPCategory(order) === 'partial_snapshot';
}

/**
 * Memeriksa apakah pesanan memiliki total dan rincian item snapshot riil lengkap.
 */
export function isSnapshotRiilOrder(order: Order): boolean {
  return getOrderHPPCategory(order) === 'snapshot_riil';
}

/**
 * Mengambil metadata provenance HPP untuk satu Order secara terpusat.
 */
export function getOrderHPPMetadata(order: Order): {
  totalHPP: number;
  source: OrderHPPSource;
  category: HPPCategory;
  migratedAt?: string;
  isEstimated: boolean;
  isTotalEstimated: boolean;
  isItemEstimated: boolean;
  hasItemBreakdown: boolean;
  variance?: number;
  label: string;
} {
  const totalHPP = typeof order.total_hpp === 'number' && order.total_hpp >= 0 ? order.total_hpp : 0;
  const category = getOrderHPPCategory(order);
  const source: OrderHPPSource = order.hpp_source || (
    category === 'legacy_estimate'
      ? 'legacy_estimate'
      : category === 'partial_snapshot'
      ? 'partial_snapshot'
      : 'transaction_snapshot'
  );

  const isTotalEstimated = category === 'legacy_estimate';
  const isItemEstimated = category === 'legacy_estimate' || category === 'partial_snapshot';
  const isEstimated = isTotalEstimated || isItemEstimated;
  const hasItemBreakdown = Array.isArray(order.items) && order.items.length > 0 && order.items.every(it => typeof it.unit_cost_price === 'number');

  let label = 'Snapshot Riil';
  if (category === 'legacy_estimate') {
    label = 'Estimasi Legacy';
  } else if (category === 'partial_snapshot') {
    label = 'Snapshot Total · Rincian Item Estimasi';
  }

  return {
    totalHPP,
    source,
    category,
    migratedAt: order.hpp_migrated_at,
    isEstimated,
    isTotalEstimated,
    isItemEstimated,
    hasItemBreakdown,
    variance: order.hpp_variance,
    label,
  };
}

/**
 * Mengambil ringkasan finansial transaksi (omzet, HPP, laba kotor, margin, kategori)
 * secara konsisten dengan definisi laporan finansial.
 */
export function getOrderFinancials(
  order: Order,
  products: Product[] = [],
  recipes: Recipe[] = [],
  stocks: Stock[] = []
): ReportTransactionDetailItem {
  const isRefunded = order.payment?.status === 'refunded';
  const omzet = isRefunded ? 0 : (Number(order.total_amount) || 0);
  const hpp = getOrderTotalHPP(order, products, recipes, stocks);
  const grossProfit = omzet - hpp;
  const marginPercent = omzet > 0 ? Math.round((grossProfit / omzet) * 1000) / 10 : 0;
  const hppCategory = getOrderHPPCategory(order);
  const hppCategoryLabel =
    hppCategory === 'snapshot_riil'
      ? 'Snapshot Riil'
      : hppCategory === 'partial_snapshot'
      ? 'Partial Snapshot'
      : 'Estimasi Legacy';

  const discount = Number(order.discount) || 0;
  const tax = Number(order.tax) || 0;
  const serviceCharge = Number(order.service_charge) || 0;
  const isVip = order.order_type === 'dine_in' && Boolean(order.is_vip || order.order_area === 'vip');
  const orderArea: 'regular' | 'vip' = isVip ? 'vip' : 'regular';

  return {
    order,
    omzet,
    hpp,
    grossProfit,
    marginPercent,
    hppCategory,
    hppCategoryLabel,
    discount,
    tax,
    serviceCharge,
    isVip,
    orderArea,
  };
}

/**
 * Mengambil atau menghitung HPP untuk satu OrderItem.
 * Mengikuti kebijakan resmi Unit-First Integer Policy:
 * unitCost dibulatkan ke integer Rupiah terlebih dahulu, lalu dikalikan qty.
 */
export function getOrderItemHPP(
  item: OrderItem,
  products: Product[] = [],
  recipes: Recipe[] = [],
  stocks: Stock[] = []
): { unitCost: number; subtotalCost: number; isEstimated: boolean } {
  const qty = Number(item.qty) || 1;

  if (typeof item.unit_cost_price === 'number' && item.unit_cost_price >= 0) {
    const roundedUnit = Math.round(item.unit_cost_price);
    const subtotal = typeof item.subtotal_cost === 'number' && item.subtotal_cost >= 0
      ? item.subtotal_cost
      : roundedUnit * qty;
    return {
      unitCost: roundedUnit,
      subtotalCost: subtotal,
      isEstimated: Boolean(item.is_estimated_cost),
    };
  }

  const { unitCost, isEstimatedFallback } = calculateItemUnitHPP(
    item.product_id,
    Number(item.price) || 0,
    products,
    recipes,
    stocks
  );
  const roundedUnit = Math.round(unitCost);

  return {
    unitCost: roundedUnit,
    subtotalCost: roundedUnit * qty,
    isEstimated: isEstimatedFallback,
  };
}

/**
 * Single Source of Truth: Menghitung seluruh data laporan bisnis
 */
export function computeReportData({
  orders,
  purchases,
  products,
  recipes,
  stocks,
  dateFilter,
  startDate,
  endDate,
  userId = 'all',
  userName,
  userRole,
  settings,
  cutoffTime,
  referenceDate,
  shifts
}: {
  orders: Order[];
  purchases: Purchase[];
  products: Product[];
  recipes: Recipe[];
  stocks: Stock[];
  dateFilter: DateFilterType;
  startDate: string;
  endDate: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  settings?: Settings;
  cutoffTime?: string;
  referenceDate?: Date;
  shifts?: Shift[];
}): ReportData {
  const effectiveCutoff = cutoffTime || settings?.operational_day_cutoff_time || '04:00';
  const {
    start,
    end,
    label,
    startFormatted,
    endFormatted,
    startOperationalDate,
    endOperationalDate
  } = getPeriodRange(dateFilter, startDate, endDate, effectiveCutoff, referenceDate);

  // Buat lookup Map shift untuk resolusi tanggal operasional O(1)
  const shiftMap = new Map<string, Shift>();
  if (Array.isArray(shifts)) {
    shifts.forEach(s => {
      if (s && s.id) shiftMap.set(s.id, s);
    });
  }

  // Helper filter kasir / pengguna berdasarkan created_by_user_id
  const matchesUser = (order: Order): boolean => {
    if (!userId || userId === 'all') return true;
    if (userId === 'unassigned') {
      return !order.created_by_user_id || order.created_by_user_id.trim() === '';
    }
    return order.created_by_user_id === userId;
  };

  // 1. Filter Orders berdasarkan tanggal operasional DAN filter pengguna
  const periodAllOrders = orders.filter(o => {
    if (!matchesUser(o)) return false;
    const opDate = getOrderOperationalDate(o, effectiveCutoff, shiftMap);
    if (!opDate) return false;
    return opDate >= startOperationalDate && opDate <= endOperationalDate;
  });
  const filteredOrders = periodAllOrders.filter(o => o.payment?.status !== 'refunded');

  // 2. Filter Purchases berdasarkan tanggal operasional pembelian
  const filteredPurchases = purchases.filter(p => {
    const pDate = getPurchaseOperationalDate(p, effectiveCutoff);
    if (!pDate) return false;
    return pDate >= startOperationalDate && pDate <= endOperationalDate;
  });

  // 3. Filter Pengembalian Dana (Refund) yang dieksekusi dalam periode operasional ini DAN mencocokkan pengguna:
  const periodRefundOrders = orders.filter(o => {
    if (o.payment?.status !== 'refunded') return false;
    if (!matchesUser(o)) return false;
    const refundOpDate = getRefundOperationalDate(o, effectiveCutoff, shiftMap);
    if (!refundOpDate) return false;
    return refundOpDate >= startOperationalDate && refundOpDate <= endOperationalDate;
  });

  let totalRefunds = 0;
  let cashRefunds = 0;
  let qrisRefunds = 0;
  let unknownRefunds = 0;

  periodRefundOrders.forEach(o => {
    const amt = Number(o.total_amount) || 0;
    totalRefunds += amt;
    const method = String(o.refund_method || '').toLowerCase();
    if (method === 'cash') {
      cashRefunds += amt;
    } else if (method === 'qris') {
      qrisRefunds += amt;
    } else {
      // Transaksi lama tanpa refund_method eksplisit masuk ke unknownRefunds
      // Jangan mengasumsikan metode pembayaran awal sebagai metode refund terverifikasi
      unknownRefunds += amt;
    }
  });

  const refundCount = periodRefundOrders.length;

  // 4. Overview Penjualan (Hanya pesanan selesai / net sales)
  const totalSales = filteredOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const totalOrdersCount = filteredOrders.length;
  const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalSales / totalOrdersCount) : 0;

  // 4b. Diskon, Pajak, dan Biaya Layanan VIP
  let totalDiscounts = 0;
  let totalTax = 0;
  let totalServiceCharge = 0;
  let vipOrdersCount = 0;
  let vipSales = 0;
  let regularOrdersCount = 0;
  let regularSales = 0;

  filteredOrders.forEach(o => {
    const amt = Number(o.total_amount) || 0;
    totalDiscounts += Number(o.discount) || 0;
    totalTax += Number(o.tax) || 0;
    totalServiceCharge += Number(o.service_charge) || 0;
    const isVip = Boolean(o.is_vip || o.order_area === 'vip');
    if (isVip) {
      vipOrdersCount++;
      vipSales += amt;
    } else {
      regularOrdersCount++;
      regularSales += amt;
    }
  });

  // 5. Overview Pembelian Restok
  const totalPurchases = filteredPurchases.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);
  const totalPurchasesCount = filteredPurchases.length;

  // 6. Perhitungan Estimasi HPP (Termasuk pesanan yang direfund karena bahan baku telah dikonsumsi dan tidak kembali ke stok)
  let totalEstimatedHPP = 0;
  let hppSnapshotOrdersCount = 0;
  let hppPartialSnapshotOrdersCount = 0;
  let hppLegacyEstimateOrdersCount = 0;

  periodAllOrders.forEach(order => {
    totalEstimatedHPP += getOrderTotalHPP(order, products, recipes, stocks);
    const category = getOrderHPPCategory(order);
    if (category === 'legacy_estimate') {
      hppLegacyEstimateOrdersCount++;
    } else if (category === 'partial_snapshot') {
      hppPartialSnapshotOrdersCount++;
    } else {
      hppSnapshotOrdersCount++;
    }
  });
  totalEstimatedHPP = Math.round(totalEstimatedHPP);
  const hasLegacyEstimatedHPP = hppLegacyEstimateOrdersCount > 0;
  const hasPartialSnapshotHPP = hppPartialSnapshotOrdersCount > 0;

  // 7. Estimasi Laba Kotor
  const estimatedGrossProfit = totalSales - totalEstimatedHPP;
  const grossProfitMarginPercent = totalSales > 0 ? Math.round((estimatedGrossProfit / totalSales) * 1000) / 10 : 0;

  // 8. Arus Kas Operasional (Pemasukan penjualan dikurangi belanja bahan restok dan pengembalian dana pelanggan)
  const cashIn = totalSales;
  const cashOut = totalPurchases + totalRefunds;
  const netCashFlow = cashIn - cashOut;

  // 8. Breakdown Metode Pembayaran
  let cashCount = 0;
  let cashTotal = 0;
  let qrisCount = 0;
  let qrisTotal = 0;
  let otherCount = 0;
  let otherTotal = 0;

  filteredOrders.forEach(o => {
    const method = String(o.payment?.method || '').toLowerCase();
    const amt = Number(o.total_amount) || 0;

    if (method === 'cash' || method === 'tunai') {
      cashCount++;
      cashTotal += amt;
    } else if (method === 'qris' || method === 'ewallet' || method === 'e-wallet') {
      qrisCount++;
      qrisTotal += amt;
    } else {
      otherCount++;
      otherTotal += amt;
    }
  });

  const paymentBreakdown: ReportData['paymentBreakdown'] = {
    cash: {
      count: cashCount,
      total: cashTotal,
      percentage: totalSales > 0 ? Math.round((cashTotal / totalSales) * 1000) / 10 : 0
    },
    qris: {
      count: qrisCount,
      total: qrisTotal,
      percentage: totalSales > 0 ? Math.round((qrisTotal / totalSales) * 1000) / 10 : 0
    }
  };

  if (otherCount > 0) {
    paymentBreakdown.other = {
      count: otherCount,
      total: otherTotal,
      percentage: totalSales > 0 ? Math.round((otherTotal / totalSales) * 1000) / 10 : 0
    };
  }

  // 9. Breakdown Tipe Pesanan
  let dineInCount = 0;
  let dineInTotal = 0;
  let takeawayCount = 0;
  let takeawayTotal = 0;

  filteredOrders.forEach(o => {
    const amt = Number(o.total_amount) || 0;
    if (o.order_type === 'take_away' || (o.order_type as any) === 'takeaway') {
      takeawayCount++;
      takeawayTotal += amt;
    } else {
      dineInCount++;
      dineInTotal += amt;
    }
  });

  const orderTypeBreakdown: ReportData['orderTypeBreakdown'] = {
    dineIn: {
      count: dineInCount,
      total: dineInTotal,
      percentage: totalSales > 0 ? Math.round((dineInTotal / totalSales) * 1000) / 10 : 0
    },
    takeaway: {
      count: takeawayCount,
      total: takeawayTotal,
      percentage: totalSales > 0 ? Math.round((takeawayTotal / totalSales) * 1000) / 10 : 0
    }
  };

  // 10. Top Selling Products
  const productMap: { [id: string]: { name: string; qty: number; totalSales: number; category: string } } = {};

  filteredOrders.forEach(o => {
    if (Array.isArray(o.items)) {
      o.items.forEach(item => {
        const pId = String(item.product_id || item.product_name);
        const qty = Number(item.qty) || 0;
        const subtotal = Number(item.subtotal) || (Number(item.price) || 0) * qty;

        if (!productMap[pId]) {
          const prd = products.find(p => p.id != null && String(p.id) === pId);
          productMap[pId] = {
            name: item.product_name || prd?.name || 'Item Tanpa Nama',
            qty: 0,
            totalSales: 0,
            category: prd ? prd.category_id : 'Menu'
          };
        }

        productMap[pId].qty += qty;
        productMap[pId].totalSales += subtotal;
      });
    }
  });

  const topProducts: TopProductItem[] = Object.entries(productMap)
    .map(([productId, val]) => ({
      productId,
      name: val.name,
      qty: val.qty,
      totalSales: val.totalSales,
      percentage: totalSales > 0 ? Math.round((val.totalSales / totalSales) * 1000) / 10 : 0,
      category: val.category
    }))
    .sort((a, b) => b.qty - a.qty);

  // 11. Low Stocks (Snapshot stok saat ini)
  const lowStocks = stocks.filter(s => Number(s.current_amount) <= Number(s.min_amount));

  // 12. Transaction Details (Urutkan dari waktu terbaru ke terlama)
  const sortedTransactionOrders = [...periodAllOrders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const transactionDetails = sortedTransactionOrders.map(o => getOrderFinancials(o, products, recipes, stocks));

  return {
    periodLabel: label,
    startDateStr: startFormatted,
    endDateStr: endFormatted,
    startOperationalDate,
    endOperationalDate,
    cutoffTime: effectiveCutoff,
    filterType: dateFilter,
    filterUserId: userId !== 'all' ? userId : undefined,
    filterUserName: userId !== 'all' ? (userName || (userId === 'unassigned' ? 'Tidak Diketahui / Sistem' : userId)) : undefined,
    filterUserRole: userId !== 'all' ? userRole : undefined,
    totalSales,
    totalOrdersCount,
    avgOrderValue,
    totalPurchases,
    totalPurchasesCount,
    totalEstimatedHPP,
    estimatedGrossProfit,
    grossProfitMarginPercent,
    hppSnapshotOrdersCount,
    hppPartialSnapshotOrdersCount,
    hppLegacyEstimateOrdersCount,
    hasLegacyEstimatedHPP,
    hasPartialSnapshotHPP,
    totalRefunds,
    cashRefunds,
    qrisRefunds,
    unknownRefunds,
    refundCount,
    totalDiscounts,
    totalTax,
    totalServiceCharge,
    vipOrdersCount,
    vipSales,
    regularOrdersCount,
    regularSales,
    cashIn,
    cashOut,
    netCashFlow,
    paymentBreakdown,
    orderTypeBreakdown,
    topProducts,
    filteredOrders: [...filteredOrders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    transactionDetailOrders: sortedTransactionOrders,
    transactionDetails,
    filteredPurchases: [...filteredPurchases].sort((a, b) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime()),
    periodRefundOrders: [...periodRefundOrders].sort((a, b) => new Date(b.refunded_at || b.created_at).getTime() - new Date(a.refunded_at || a.created_at).getTime()),
    lowStocks
  };
}
