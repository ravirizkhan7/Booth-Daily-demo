import { Order, Purchase, Product, Recipe, Stock, Settings } from '../types';

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
  products: Product[],
  recipes: Recipe[],
  stocks: Stock[]
): { unitCost: number; isEstimatedFallback: boolean } {
  // 1. Cek apakah ada resep dengan bahan yang terhubung ke stok
  const recipe = recipes.find(r => r.product_id != null && String(r.product_id) === String(productId));
  if (recipe && recipe.ingredients && recipe.ingredients.length > 0) {
    let recipeCost = 0;
    let hasValidStockCost = false;

    for (const ing of recipe.ingredients) {
      if (!ing.stock_id) continue;
      const stockItem = stocks.find(s => s.id != null && String(s.id) === String(ing.stock_id));
      if (stockItem && stockItem.cost_per_unit > 0) {
        recipeCost += ing.amount * stockItem.cost_per_unit;
        hasValidStockCost = true;
      }
    }

    if (hasValidStockCost && recipeCost > 0) {
      return { unitCost: recipeCost, isEstimatedFallback: false };
    }
  }

  // 2. Cek apakah master product memiliki cost_price
  const prd = products.find(p => p.id != null && String(p.id) === String(productId));
  if (prd && prd.cost_price > 0) {
    return { unitCost: prd.cost_price, isEstimatedFallback: false };
  }

  // 3. Fallback estimasi 40% dari harga jual
  return { unitCost: sellingPrice * 0.4, isEstimatedFallback: true };
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

  // 3. Overview Penjualan (Hanya pesanan selesai / net sales)
  const totalSales = filteredOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  const totalOrdersCount = filteredOrders.length;
  const avgOrderValue = totalOrdersCount > 0 ? Math.round(totalSales / totalOrdersCount) : 0;

  // 4. Overview Pembelian Restok
  const totalPurchases = filteredPurchases.reduce((sum, p) => sum + (Number(p.total_amount) || 0), 0);
  const totalPurchasesCount = filteredPurchases.length;

  // 5. Perhitungan Estimasi HPP (Termasuk pesanan yang direfund karena bahan baku telah dikonsumsi dan tidak kembali ke stok)
  let totalEstimatedHPP = 0;
  periodAllOrders.forEach(order => {
    if (Array.isArray(order.items)) {
      order.items.forEach(item => {
        const { unitCost } = calculateItemUnitHPP(
          item.product_id,
          Number(item.price) || 0,
          products,
          recipes,
          stocks
        );
        totalEstimatedHPP += unitCost * (Number(item.qty) || 0);
      });
    }
  });
  totalEstimatedHPP = Math.round(totalEstimatedHPP);

  // 6. Estimasi Laba Kotor
  const estimatedGrossProfit = totalSales - totalEstimatedHPP;
  const grossProfitMarginPercent = totalSales > 0 ? Math.round((estimatedGrossProfit / totalSales) * 1000) / 10 : 0;

  // 7. Arus Kas Operasional
  const cashIn = totalSales;
  const cashOut = totalPurchases;
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
    cashIn,
    cashOut,
    netCashFlow,
    paymentBreakdown,
    orderTypeBreakdown,
    topProducts,
    filteredOrders: [...filteredOrders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    transactionDetailOrders: [...periodAllOrders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
    filteredPurchases: [...filteredPurchases].sort((a, b) => new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime()),
    lowStocks
  };
}
