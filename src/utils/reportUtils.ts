import { Order, OrderItem, OrderHPPSource, Purchase, Product, Recipe, Stock, Settings } from '../types';

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
  filterType: DateFilterType;

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
  filteredPurchases: Purchase[];
  periodRefundOrders: Order[];

  // Snapshot Kondisi Stok Saat Ini
  lowStocks: Stock[];
}

/**
 * Menghitung rentang tanggal dan label human-readable berdasarkan filter
 */
export function getPeriodRange(
  filterType: DateFilterType,
  customStartStr?: string,
  customEndStr?: string
): { start: Date; end: Date; label: string; startFormatted: string; endFormatted: string } {
  const now = new Date();

  if (filterType === 'today') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const dateFormatted = new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).format(now);

    return {
      start,
      end,
      label: `Hari Ini (${dateFormatted})`,
      startFormatted: dateFormatted,
      endFormatted: dateFormatted
    };
  }

  if (filterType === 'week') {
    const start = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const startFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(start);
    const endFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(end);

    return {
      start,
      end,
      label: `7 Hari Terakhir (${startFmt} - ${endFmt})`,
      startFormatted: startFmt,
      endFormatted: endFmt
    };
  }

  if (filterType === 'month') {
    const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const monthFmt = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(now);
    const startFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(start);
    const endFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(end);

    return {
      start,
      end,
      label: `Bulan Ini (${monthFmt})`,
      startFormatted: startFmt,
      endFormatted: endFmt
    };
  }

  // Custom Range
  const startD = customStartStr ? new Date(`${customStartStr}T00:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const endD = customEndStr ? new Date(`${customEndStr}T23:59:59.999`) : new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const startFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(startD);
  const endFmt = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }).format(endD);

  return {
    start: startD,
    end: endD,
    label: `Periode Kustom (${startFmt} s/d ${endFmt})`,
    startFormatted: startFmt,
    endFormatted: endFmt
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
      if (stockItem && typeof stockItem.cost_per_unit === 'number' && stockItem.cost_per_unit > 0) {
        recipeCost += (Number(ing.amount) || 0) * stockItem.cost_per_unit;
        hasValidStockCost = true;
      }
    }

    if (hasValidStockCost && recipeCost > 0) {
      return { unitCost: Math.round(recipeCost), isEstimatedFallback: false };
    }
  }

  // 2. Cek apakah master product memiliki cost_price valid
  const prd = products.find(p => p.id != null && String(p.id) === String(productId));
  if (prd && typeof prd.cost_price === 'number' && prd.cost_price > 0) {
    return { unitCost: Math.round(prd.cost_price), isEstimatedFallback: false };
  }

  // 3. Fallback estimasi 40% dari harga jual jika data modal tidak tersedia / tidak valid
  return { unitCost: Math.round(numericPrice * 0.4), isEstimatedFallback: true };
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
        const roundedUnit = Math.round(unitCost);
        orderHPP += roundedUnit * (Number(item.qty) || 1);
      }
    }
    return Math.round(orderHPP);
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
  endDate
}: {
  orders: Order[];
  purchases: Purchase[];
  products: Product[];
  recipes: Recipe[];
  stocks: Stock[];
  dateFilter: DateFilterType;
  startDate: string;
  endDate: string;
  settings?: Settings;
}): ReportData {
  const { start, end, label, startFormatted, endFormatted } = getPeriodRange(dateFilter, startDate, endDate);

  // 1. Filter Orders berdasarkan created_at
  const periodAllOrders = orders.filter(o => isDateInRange(o.created_at, start, end));
  const filteredOrders = periodAllOrders.filter(o => o.payment?.status !== 'refunded');

  // 2. Filter Purchases berdasarkan date atau created_at
  const filteredPurchases = purchases.filter(p => isDateInRange(p.date || p.created_at, start, end));

  // 3. Filter Pengembalian Dana (Refund) yang dieksekusi dalam periode ini:
  // - Transaksi dengan refunded_at valid dievaluasi berdasarkan tanggal refund dieksekusi (refund lintas hari).
  // - Data lama berstatus refunded tanpa refunded_at valid dievaluasi berdasarkan created_at
  //   agar tercatat pada periode transaksi asalnya tanpa mengarang tanggal refund (tetap '-' pada UI/ekspor).
  const periodRefundOrders = orders.filter(o => {
    if (o.payment?.status !== 'refunded') return false;
    const hasValidRefundDate = Boolean(o.refunded_at && !isNaN(new Date(o.refunded_at).getTime()));
    if (hasValidRefundDate) {
      return isDateInRange(o.refunded_at, start, end);
    }
    return isDateInRange(o.created_at, start, end);
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

  return {
    periodLabel: label,
    startDateStr: startFormatted,
    endDateStr: endFormatted,
    filterType: dateFilter,
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
    cashIn,
    cashOut,
    netCashFlow,
    paymentBreakdown,
    orderTypeBreakdown,
    topProducts,
    filteredOrders: [...filteredOrders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    transactionDetailOrders: [...periodAllOrders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    filteredPurchases: [...filteredPurchases].sort((a, b) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime()),
    periodRefundOrders: [...periodRefundOrders].sort((a, b) => new Date(b.refunded_at || b.created_at).getTime() - new Date(a.refunded_at || a.created_at).getTime()),
    lowStocks
  };
}
