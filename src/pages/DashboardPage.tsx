import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePOS } from '../hooks/usePOS';
import { formatRupiah, formatDate, formatDateTime } from '../utils/formatters';
import { orderService } from '../services/orderService';
import { Order } from '../types';
import { calculateShiftFinancials, formatShiftDuration } from '../utils/shiftCalculation';
import { getOrderTotalHPP, isLegacyEstimatedOrder, getOrderHPPCategory } from '../utils/reportUtils';
import {
  TrendingUp, DollarSign, ShoppingBag, AlertTriangle, AlertCircle, Award,
  Calendar, ArrowUpRight, Coffee, Clock, Tag, X,
  Receipt, PieChart, DoorOpen, Lock, CheckCircle2,
  ChevronLeft, ChevronRight, Package, Wallet, Info
} from 'lucide-react';

export type AnalyticsPeriod = 'today' | 'week' | 'month' | 'year';

const CATEGORY_COLORS = [
  '#3B2A1F', // Deep Espresso Brown
  '#C68B59', // Warm Caramel
  '#D4A373', // Golden Amber
  '#A98467', // Mocha Tan
  '#6F4E37', // Coffee Bean
  '#8B5E3C', // Roasted Hazelnut
  '#BC6C25', // Toffee Copper
  '#7F5539', // Cocoa
  '#9C6644', // Cinnamon Bark
  '#B08968', // Muted Latte
];

function getAnalyticsDateRange(period: AnalyticsPeriod, refDate: Date = new Date()) {
  const year = refDate.getFullYear();
  const month = refDate.getMonth();
  const date = refDate.getDate();

  let start: Date;
  let end: Date;
  let label: string;

  switch (period) {
    case 'today': {
      start = new Date(year, month, date, 0, 0, 0, 0);
      end = new Date(year, month, date, 23, 59, 59, 999);
      const fmt = refDate.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      label = `Hari Ini (${fmt})`;
      break;
    }
    case 'week': {
      const startDay = new Date(refDate.getTime() - 6 * 24 * 60 * 60 * 1000);
      startDay.setHours(0, 0, 0, 0);
      start = startDay;
      end = new Date(year, month, date, 23, 59, 59, 999);
      const startFmt = start.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
      const endFmt = end.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
      label = `Minggu Ini (${startFmt} - ${endFmt})`;
      break;
    }
    case 'month': {
      start = new Date(year, month, 1, 0, 0, 0, 0);
      end = new Date(year, month + 1, 0, 23, 59, 59, 999);
      const monthFmt = refDate.toLocaleDateString('id-ID', { month: 'long', year: 'numeric' });
      label = `Bulan Ini (${monthFmt})`;
      break;
    }
    case 'year': {
      start = new Date(year, 0, 1, 0, 0, 0, 0);
      end = new Date(year, 11, 31, 23, 59, 59, 999);
      label = `Tahun Ini (${year})`;
      break;
    }
  }

  return { start, end, label };
}

export const DashboardPage: React.FC = () => {
  const navigate = useNavigate();
  const {
    currentUser,
    orders,
    products,
    categories,
    stocks,
    recipes,
    discountRules,
    shifts,
    activeShift,
    openReceiptModal,
    settings,
  } = usePOS();

  const isOwner = currentUser?.role === 'owner';

  const [currentTime, setCurrentTime] = useState(new Date());
  const [analyticsPeriod, setAnalyticsPeriod] = useState<AnalyticsPeriod>('week');
  const [yearlyOrders, setYearlyOrders] = useState<Order[]>([]);
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState<boolean>(false);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Horizontal Metric Carousel state (0: Ringkasan Keuangan, 1: Rata-rata Transaksi)
  const [activeMetricSlide, setActiveMetricSlide] = useState<number>(0);
  const metricCarouselRef = useRef<HTMLDivElement | null>(null);
  const [isMouseDragging, setIsMouseDragging] = useState<boolean>(false);
  const isPointerDownRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartScrollLeftRef = useRef<number>(0);
  const isDraggingRef = useRef<boolean>(false);
  const justFinishedDragRef = useRef<boolean>(false);

  useEffect(() => {
    if (analyticsPeriod === 'year' && isOwner && yearlyOrders.length === 0) {
      const year = currentTime.getFullYear();
      orderService
        .getOrders({
          start_date: `${year}-01-01`,
          end_date: `${year}-12-31`,
        })
        .then(res => {
          setYearlyOrders(res);
        })
        .catch(err => {
          console.warn('[DashboardPage] Failed to fetch yearly orders:', err);
        });
    }
  }, [analyticsPeriod, isOwner, currentTime, yearlyOrders.length]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const getLocalDateKey = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
  };

  const parseOrderDate = (dateString: string) => {
    const date = new Date(dateString);

    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date;
  };

  const todayKey = getLocalDateKey(currentTime);

  const baseOrders = useMemo(() => {
    if (analyticsPeriod === 'year' && yearlyOrders.length > 0) {
      const orderMap = new Map<string, Order>();
      yearlyOrders.forEach(o => orderMap.set(o.id, o));
      orders.forEach(o => orderMap.set(o.id, o));
      return Array.from(orderMap.values());
    }
    return orders;
  }, [analyticsPeriod, yearlyOrders, orders]);

  // Valid orders that are not refunded
  const completedOrders = useMemo(() => {
    return baseOrders.filter(order => order.payment?.status !== 'refunded');
  }, [baseOrders]);

  // Orders for Today KPI Cards
  const todayAllOrders = useMemo(() => {
    return orders.filter(order => {
      const orderDate = parseOrderDate(order.created_at);
      return orderDate ? getLocalDateKey(orderDate) === todayKey : false;
    });
  }, [orders, todayKey]);

  const todayOrders = useMemo(() => {
    return completedOrders.filter(order => {
      const orderDate = parseOrderDate(order.created_at);
      return orderDate ? getLocalDateKey(orderDate) === todayKey : false;
    });
  }, [completedOrders, todayKey]);

  const todayRevenue = useMemo(() => {
    return todayOrders.reduce(
      (sum, order) => sum + Number(order.total_amount || 0),
      0
    );
  }, [todayOrders]);

  const todayCount = todayOrders.length;

  const todayGrossProfit = useMemo(() => {
    const todayTotalCost = todayAllOrders.reduce((sum, order) => {
      return sum + getOrderTotalHPP(order, products, recipes, stocks);
    }, 0);

    return todayRevenue - todayTotalCost;
  }, [todayAllOrders, todayRevenue, products, recipes, stocks]);

  const lowStockItems = useMemo(() => {
    return stocks
      .filter(stock => Number(stock.current_amount) <= Number(stock.min_amount))
      .sort((a, b) => {
        const aOut = Number(a.current_amount) <= 0 ? 0 : 1;
        const bOut = Number(b.current_amount) <= 0 ? 0 : 1;
        if (aOut !== bOut) return aOut - bOut;
        const aRatio = Number(a.min_amount) > 0 ? Number(a.current_amount) / Number(a.min_amount) : 0;
        const bRatio = Number(b.min_amount) > 0 ? Number(b.current_amount) / Number(b.min_amount) : 0;
        return aRatio - bRatio;
      });
  }, [stocks]);

  const activeDiscounts = useMemo(() => {
    return (discountRules || []).filter(rule => rule.is_active);
  }, [discountRules]);

  const bestDiscount = useMemo(() => {
    if (activeDiscounts.length === 0) return null;
    return [...activeDiscounts].sort((a, b) => {
      if (b.minimum_purchase !== a.minimum_purchase) {
        return b.minimum_purchase - a.minimum_purchase;
      }
      return b.discount_percentage - a.discount_percentage;
    })[0];
  }, [activeDiscounts]);

  // ========================================================
  // PERIOD-FILTERED ANALYTICS COMPUTATIONS
  // ========================================================
  const analyticsDateRange = useMemo(() => {
    return getAnalyticsDateRange(analyticsPeriod, currentTime);
  }, [analyticsPeriod, currentTime]);

  const periodValidOrders = useMemo(() => {
    const { start, end } = analyticsDateRange;
    return completedOrders.filter(order => {
      const orderDate = parseOrderDate(order.created_at);
      if (!orderDate) return false;
      return orderDate >= start && orderDate <= end;
    });
  }, [completedOrders, analyticsDateRange]);

  // 1. Unified Average Transactions Stats (Nilai & Unit)
  const periodAverageStats = useMemo(() => {
    const count = periodValidOrders.length;
    if (count === 0) {
      return {
        count: 0,
        totalNetSales: 0,
        totalUnits: 0,
        avgValue: null as number | null,
        avgUnits: null as number | null,
      };
    }

    const totalNetSales = periodValidOrders.reduce(
      (sum, o) => sum + Number(o.total_amount || 0),
      0
    );

    const totalUnits = periodValidOrders.reduce((sum, o) => {
      const units = (o.items || []).reduce(
        (itemSum, item) => itemSum + (Number(item.qty) || 0),
        0
      );
      return sum + units;
    }, 0);

    return {
      count,
      totalNetSales,
      totalUnits,
      avgValue: Math.round(totalNetSales / count),
      avgUnits: Math.round((totalUnits / count) * 10) / 10,
    };
  }, [periodValidOrders]);

  // Period Total HPP & Gross Profit for Multi-Metric Card
  const periodAllOrders = useMemo(() => {
    const { start, end } = analyticsDateRange;
    return baseOrders.filter(order => {
      const orderDate = parseOrderDate(order.created_at);
      if (!orderDate) return false;
      return orderDate >= start && orderDate <= end;
    });
  }, [baseOrders, analyticsDateRange]);

  const periodTotalHPP = useMemo(() => {
    return periodAllOrders.reduce((sum, order) => {
      return sum + getOrderTotalHPP(order, products, recipes, stocks);
    }, 0);
  }, [periodAllOrders, products, recipes, stocks]);

  const periodGrossProfit = useMemo(() => {
    return periodAverageStats.totalNetSales - periodTotalHPP;
  }, [periodAverageStats.totalNetSales, periodTotalHPP]);

  const periodGrossProfitMargin = useMemo(() => {
    if (periodAverageStats.totalNetSales <= 0) return 0;
    return Math.round((periodGrossProfit / periodAverageStats.totalNetSales) * 1000) / 10;
  }, [periodGrossProfit, periodAverageStats.totalNetSales]);

  // 2. Category Net Sales Breakdown for Pie/Donut Chart
  const categorySalesData = useMemo(() => {
    const catMap: {
      [key: string]: {
        id: string;
        name: string;
        sales: number;
        qty: number;
      };
    } = {};

    periodValidOrders.forEach(order => {
      const orderSubtotal =
        Number(order.subtotal) ||
        (order.items || []).reduce(
          (acc, it) => acc + (Number(it.subtotal) || Number(it.price || 0) * Number(it.qty || 0)),
          0
        ) ||
        1;
      const discountRatio = Math.max(0, Math.min(1, (Number(order.discount) || 0) / orderSubtotal));

      (order.items || []).forEach(item => {
        const prod = products.find(p => p.id === item.product_id);
        const catId = prod?.category_id;
        const catObj = categories.find(c => c.id === catId);

        const categoryName = catObj?.name || (catId ? 'Lainnya' : 'Tanpa Kategori');
        const categoryKey = catObj?.id || (catId ? `cat-${catId}` : 'cat-uncategorized');

        const rawSubtotal =
          Number(item.subtotal) || Number(item.price || 0) * Number(item.qty || 0);
        const itemNet = rawSubtotal * (1 - discountRatio);

        if (!catMap[categoryKey]) {
          catMap[categoryKey] = {
            id: categoryKey,
            name: categoryName,
            sales: 0,
            qty: 0,
          };
        }

        catMap[categoryKey].sales += itemNet;
        catMap[categoryKey].qty += Number(item.qty || 0);
      });
    });

    const list = Object.values(catMap);
    const totalCategorySales = list.reduce((sum, c) => sum + c.sales, 0);

    return list
      .map(c => ({
        ...c,
        sales: Math.round(c.sales),
        percentage:
          totalCategorySales > 0 ? Math.round((c.sales / totalCategorySales) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.sales - a.sales);
  }, [periodValidOrders, products, categories]);

  const totalCategoryRevenue = useMemo(() => {
    return categorySalesData.reduce((sum, c) => sum + c.sales, 0);
  }, [categorySalesData]);

  // 3. Top Products for the Selected Period
  const periodTopProducts = useMemo(() => {
    const map: {
      [key: string]: {
        id: string;
        name: string;
        category: string;
        qty: number;
        revenue: number;
      };
    } = {};

    periodValidOrders.forEach(order => {
      (order.items || []).forEach(item => {
        const pId = String(item.product_id || item.product_name);
        const prod = products.find(p => p.id === item.product_id);
        const cat = categories.find(c => c.id === prod?.category_id);

        if (!map[pId]) {
          map[pId] = {
            id: pId,
            name: item.product_name || prod?.name || 'Item Tanpa Nama',
            category: cat?.name || 'Menu',
            qty: 0,
            revenue: 0,
          };
        }

        map[pId].qty += Number(item.qty || 0);
        map[pId].revenue += Number(item.subtotal || 0);
      });
    });

    // Tie-breaking: 1) qty desc, 2) revenue desc, 3) name asc
    return Object.values(map).sort((a, b) => {
      if (b.qty !== a.qty) return b.qty - a.qty;
      if (b.revenue !== a.revenue) return b.revenue - a.revenue;
      return a.name.localeCompare(b.name);
    });
  }, [periodValidOrders, products, categories]);

  // 4. Dynamic Bar Chart Data synchronized with analyticsPeriod
  const chartData = useMemo(() => {
    const now = currentTime;

    if (analyticsPeriod === 'today') {
      const intervals = [
        { startH: 8, endH: 10, label: '08:00 - 10:00', shortLabel: '08:00' },
        { startH: 10, endH: 12, label: '10:00 - 12:00', shortLabel: '10:00' },
        { startH: 12, endH: 14, label: '12:00 - 14:00', shortLabel: '12:00' },
        { startH: 14, endH: 16, label: '14:00 - 16:00', shortLabel: '14:00' },
        { startH: 16, endH: 18, label: '16:00 - 18:00', shortLabel: '16:00' },
        { startH: 18, endH: 20, label: '18:00 - 20:00', shortLabel: '18:00' },
        { startH: 20, endH: 22, label: '20:00 - 22:00', shortLabel: '20:00' },
        { startH: 22, endH: 24, label: '22:00+', shortLabel: '22:00' },
      ];

      const todayDateKey = getLocalDateKey(now);
      return intervals.map(inter => {
        const revenue = completedOrders.reduce((sum, order) => {
          const orderDate = parseOrderDate(order.created_at);
          if (orderDate && getLocalDateKey(orderDate) === todayDateKey) {
            const h = orderDate.getHours();
            if (h >= inter.startH && h < inter.endH) {
              return sum + Number(order.total_amount || 0);
            }
          }
          return sum;
        }, 0);

        return {
          label: inter.label,
          shortLabel: inter.shortLabel,
          revenue,
        };
      });
    }

    if (analyticsPeriod === 'week') {
      const data = [];
      for (let i = 6; i >= 0; i--) {
        const date = new Date(now);
        date.setHours(0, 0, 0, 0);
        date.setDate(now.getDate() - i);
        const dateKey = getLocalDateKey(date);

        const revenue = completedOrders.reduce((sum, order) => {
          const orderDate = parseOrderDate(order.created_at);
          if (orderDate && getLocalDateKey(orderDate) === dateKey) {
            return sum + Number(order.total_amount || 0);
          }
          return sum;
        }, 0);

        const dayName = date.toLocaleDateString('id-ID', { weekday: 'short' });
        data.push({
          label: i === 0 ? 'Hari Ini' : dayName.charAt(0).toUpperCase() + dayName.slice(1),
          shortLabel: dayName.charAt(0).toUpperCase() + dayName.slice(1),
          revenue,
        });
      }
      return data;
    }

    if (analyticsPeriod === 'month') {
      const year = now.getFullYear();
      const month = now.getMonth();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const data = [];

      for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateKey = getLocalDateKey(date);

        const revenue = completedOrders.reduce((sum, order) => {
          const orderDate = parseOrderDate(order.created_at);
          if (orderDate && getLocalDateKey(orderDate) === dateKey) {
            return sum + Number(order.total_amount || 0);
          }
          return sum;
        }, 0);

        data.push({
          label: String(day),
          shortLabel: String(day),
          revenue,
        });
      }
      return data;
    }

    // analyticsPeriod === 'year'
    const year = now.getFullYear();
    const yearlyCompleted = baseOrders.filter(o => o.payment?.status !== 'refunded');
    const data = [];

    for (let month = 0; month < 12; month++) {
      const revenue = yearlyCompleted.reduce((sum, order) => {
        const orderDate = parseOrderDate(order.created_at);
        if (
          orderDate &&
          orderDate.getFullYear() === year &&
          orderDate.getMonth() === month
        ) {
          return sum + Number(order.total_amount || 0);
        }
        return sum;
      }, 0);

      const monthName = new Date(year, month, 1).toLocaleDateString('id-ID', { month: 'short' });
      data.push({
        label: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        shortLabel: monthName.charAt(0).toUpperCase() + monthName.slice(1),
        revenue,
      });
    }
    return data;
  }, [completedOrders, baseOrders, currentTime, analyticsPeriod]);

  const chartTotalRevenue = useMemo(() => {
    return chartData.reduce((sum, item) => sum + item.revenue, 0);
  }, [chartData]);

  const maxChartRevenue = useMemo(() => {
    return Math.max(...chartData.map(item => item.revenue), 1);
  }, [chartData]);

  const chartTitle = useMemo(() => {
    switch (analyticsPeriod) {
      case 'today':
        return 'Grafik Penjualan Hari Ini';
      case 'month':
        return 'Grafik Penjualan Bulanan';
      case 'year':
        return 'Grafik Penjualan Tahunan';
      default:
        return 'Grafik Penjualan Mingguan';
    }
  }, [analyticsPeriod]);

  const chartDescription = useMemo(() => {
    switch (analyticsPeriod) {
      case 'today':
        return 'Omzet per blok jam operasional hari ini';
      case 'month':
        return 'Omzet per hari pada bulan berjalan';
      case 'year':
        return `Omzet per bulan tahun ${currentTime.getFullYear()}`;
      default: {
        const storeName = settings?.store_name?.trim() || 'Booth Daily';
        return `Omzet 7 hari terakhir ${storeName}`;
      }
    }
  }, [analyticsPeriod, currentTime, settings?.store_name]);

  // 5. Active Shift Financials & Last Closed Shift for Owner
  const activeFinancials = useMemo(() => {
    if (!activeShift) return null;
    return calculateShiftFinancials(activeShift, orders, products, recipes, stocks);
  }, [activeShift, orders, products, recipes, stocks]);

  const lastClosedShift = useMemo(() => {
    return shifts.find(s => s.status === 'closed');
  }, [shifts]);

  // Hovered Category Item for Donut Chart
  const hoveredCategoryItem = useMemo(() => {
    if (!hoveredCategory) return null;
    return categorySalesData.find(c => c.id === hoveredCategory) || null;
  }, [hoveredCategory, categorySalesData]);

  // Donut SVG circumference math (Radius R=70 -> Circumference ~439.82)
  const donutRadius = 70;
  const donutCircumference = 2 * Math.PI * donutRadius;

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="p-4 sm:p-6 bg-[#3B2A1F] text-[#F7F5F2] rounded-3xl shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 relative overflow-hidden">
        <div className="relative z-10 space-y-1">
          <span className="px-3 py-1 rounded-full bg-[#D4A373] text-[#1F1F1F] text-xs font-black uppercase tracking-wider">
            {isOwner ? 'DASHBOARD OWNER' : 'DASHBOARD KASIR'}
          </span>

          <h1 className="text-xl sm:text-3xl font-black text-white">
            Selamat Datang, {currentUser?.name || 'Kasir Booth'}!
          </h1>

          <p className="text-xs text-stone-300">
            {isOwner
              ? `Laporan performa penjualan dan kesehatan operasional ${settings?.store_name?.trim() || 'Booth Daily'}.`
              : 'Ringkasan aktivitas dan pencapaian transaksi harian Anda.'}
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-3 bg-white/10 px-4 py-2.5 rounded-2xl backdrop-blur-md border border-white/10 w-full sm:w-auto">
          <Calendar className="w-4 h-4 text-[#D4A373]" />

          <div className="flex flex-col">
            <span className="text-xs font-bold text-white">
              {currentTime.toLocaleDateString('id-ID', {
                weekday: 'long',
                day: '2-digit',
                month: 'long',
                year: 'numeric',
              })}
            </span>

            <span className="text-sm text-stone-200 font-black tabular-nums tracking-wide">
              {currentTime.toLocaleTimeString('id-ID', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Metric Cards Grid (Primary Fast Operational KPIs) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Omzet Hari Ini */}
        <div className="p-5 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-stone-500 uppercase">
              Omzet Hari Ini
            </span>

            <div className="p-2 rounded-xl bg-amber-500/10 text-[#C68B59]">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>

          <p className="text-2xl font-black text-stone-900 dark:text-stone-100">
            {formatRupiah(todayRevenue)}
          </p>

          <p className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5" />
            Real dari transaksi hari ini
          </p>
        </div>

        {/* Total Transaksi */}
        <div className="p-5 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-stone-500 uppercase">
              Jumlah Transaksi
            </span>

            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>

          <p className="text-2xl font-black text-stone-900 dark:text-stone-100">
            {todayCount} Transaksi
          </p>

          <p className="text-[11px] text-stone-500 font-medium">
            Rata-rata:{' '}
            {todayCount > 0
              ? formatRupiah(todayRevenue / todayCount)
              : 'Rp 0'}{' '}
            / transaksi
          </p>
        </div>

        {/* Laba Kotor / Info Diskon */}
        {isOwner ? (
          <div className="p-5 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-stone-500 uppercase">
                Estimasi Laba Kotor
              </span>

              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>

            <p className="text-2xl font-black text-emerald-600">
              {formatRupiah(todayGrossProfit)}
            </p>

            <p className="text-[11px] text-stone-500 font-medium">
              Berdasarkan harga modal produk
            </p>
          </div>
        ) : (
          <div
            onClick={() => setIsDiscountModalOpen(true)}
            role="button"
            tabIndex={0}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') setIsDiscountModalOpen(true); }}
            className="p-5 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2 cursor-pointer hover:border-[#C68B59] dark:hover:border-[#C68B59] hover:shadow-md transition-all duration-200 group"
          >
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1.5">
                Informasi Diskon
                <span className="text-[10px] text-[#C68B59] font-black group-hover:scale-110 transition-transform">Lihat</span>
              </span>

              <div className="p-2 rounded-xl bg-[#C68B59]/10 text-[#C68B59] group-hover:scale-110 transition-transform">
                <Tag className="w-5 h-5" />
              </div>
            </div>

            <p className="text-2xl font-black text-stone-900 dark:text-stone-100">
              {activeDiscounts.length > 0
                ? `${activeDiscounts.length} Promo Aktif`
                : 'Belum Ada Promo'}
            </p>

            <p
              className="text-[11px] text-stone-500 font-medium truncate"
              title={
                bestDiscount
                  ? `Terbaik: Belanja ${formatRupiah(bestDiscount.minimum_purchase)} → Diskon ${bestDiscount.discount_percentage}%`
                  : 'Klik untuk melihat detail promo'
              }
            >
              {bestDiscount
                ? `Terbaik: Belanja ${formatRupiah(bestDiscount.minimum_purchase)} → Diskon ${bestDiscount.discount_percentage}%`
                : 'Klik untuk info promo booth'}
            </p>
          </div>
        )}

        {/* Low Stock Warning */}
        <div
          onClick={() => navigate('/inventory')}
          role="button"
          tabIndex={0}
          onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('/inventory'); }}
          className="p-5 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2 cursor-pointer hover:border-[#C68B59] dark:hover:border-[#C68B59] hover:shadow-md transition-all duration-200 group"
          title="Klik untuk membuka inventaris & stok bahan"
        >
          <div className="flex justify-between items-center">
            <span className="text-xs font-bold text-stone-500 uppercase flex items-center gap-1.5">
              Peringatan Stok
              <span className="text-[10px] text-[#C68B59] font-black group-hover:scale-110 transition-transform">Kelola</span>
            </span>

            <div
              className={`p-2 rounded-xl transition-transform group-hover:scale-110 ${lowStockItems.length > 0
                ? 'bg-rose-500/10 text-rose-600'
                : 'bg-emerald-500/10 text-emerald-600'
                }`}
            >
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>

          <p className="text-2xl font-black text-stone-900 dark:text-stone-100">
            {lowStockItems.length} Bahan Menipis
          </p>

          <p className="text-[11px] text-stone-500 font-medium">
            {lowStockItems.length > 0
              ? 'Perlu pembelian ulang segera'
              : 'Semua bahan aman'}
          </p>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION: PERINGATAN STOK BAHAN BAKU (OWNER & KARYAWAN)   */}
      {/* ======================================================== */}
      {lowStockItems.length > 0 && (
        <div className="p-5 bg-rose-500/10 dark:bg-rose-950/20 rounded-3xl border border-rose-500/20 dark:border-rose-900/40 shadow-xs space-y-3.5">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                <AlertTriangle className="w-5 h-5 shrink-0" />
              </div>
              <div>
                <h3 className="font-extrabold text-sm sm:text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <span>Peringatan Stok Bahan Baku</span>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-rose-600 text-white shadow-xs">
                    {lowStockItems.length} Bahan Perlu Perhatian
                  </span>
                </h3>
                <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium">
                  Bahan baku yang telah habis atau berada di bawah batas minimum operasional
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => navigate('/inventory')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white dark:bg-[#25221F] hover:bg-stone-100 dark:hover:bg-[#2E2A27] text-stone-800 dark:text-stone-200 text-xs font-bold transition-all border border-stone-200 dark:border-stone-800 cursor-pointer shadow-xs shrink-0"
            >
              <span>Kelola Stok Inventaris</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-[#C68B59]" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
            {lowStockItems.map(stock => {
              const currentAmt = Number(stock.current_amount) || 0;
              const minAmt = Number(stock.min_amount) || 0;
              const isOutOfStock = currentAmt <= 0;

              return (
                <div
                  key={stock.id}
                  onClick={() => navigate('/inventory')}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') navigate('/inventory'); }}
                  className="p-3.5 bg-white dark:bg-[#1E1C1A] rounded-2xl border border-stone-200/90 dark:border-stone-800/80 flex items-center justify-between gap-3 shadow-xs hover:border-[#C68B59] dark:hover:border-[#C68B59] transition-all cursor-pointer group"
                >
                  <div className="min-w-0 space-y-1">
                    <p className="font-extrabold text-xs text-stone-900 dark:text-stone-100 truncate group-hover:text-[#C68B59] transition-colors">
                      {stock.name}
                    </p>
                    <p className="text-[11px] text-stone-400 font-medium">
                      Batas Min: <strong className="text-stone-600 dark:text-stone-300 font-bold">{minAmt} {stock.unit}</strong>
                    </p>
                  </div>

                  <div className="text-right shrink-0 space-y-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        isOutOfStock
                          ? 'bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                          : 'bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      }`}
                    >
                      {isOutOfStock ? (
                        <>
                          <AlertCircle className="w-3 h-3 text-rose-600 dark:text-rose-400 shrink-0" />
                          Habis
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                          Menipis
                        </>
                      )}
                    </span>
                    <p
                      className={`text-xs font-black ${
                        isOutOfStock
                          ? 'text-rose-600 dark:text-rose-400'
                          : 'text-amber-700 dark:text-amber-400'
                      }`}
                    >
                      {currentAmt} {stock.unit}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* OWNER DASHBOARD ANALYTICS SECTION                        */}
      {/* ======================================================== */}
      {isOwner && (
        <div className="space-y-6">
          {/* Unified Analytics Header & Period Toolbar (Sticky with 12px offset from Navbar) */}
          <div className="sticky top-3 z-20 bg-white dark:bg-[#1A1816] px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl border border-stone-200/80 dark:border-stone-800/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#C68B59] shrink-0" />
                <h2 className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-stone-100 tracking-tight truncate">
                  Analitik Penjualan & Performa
                </h2>
              </div>
              <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 mt-0.5 flex items-center gap-1.5 truncate">
                <span className="font-medium">Periode aktif:</span>
                <span className="font-bold text-stone-700 dark:text-stone-300">
                  {analyticsDateRange.label}
                </span>
              </p>
            </div>

            {/* Period Selector Buttons */}
            <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800/80 rounded-xl w-full sm:w-auto shrink-0 overflow-x-auto scrollbar-none">
              {[
                { id: 'today', label: 'Hari Ini' },
                { id: 'week', label: 'Minggu Ini' },
                { id: 'month', label: 'Bulan Ini' },
                { id: 'year', label: 'Tahun Ini' },
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setAnalyticsPeriod(p.id as AnalyticsPeriod)}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${analyticsPeriod === p.id
                    ? 'bg-[#3B2A1F] text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-700/50'
                    }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Row 1: Rata-rata per Transaksi & Produk Terlaris */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* Card Metrik Geser 2 Layer: Layer 1 (Ringkasan Keuangan: Total Modal & Laba Kotor) | Layer 2 (Rata-rata Transaksi) */}
            <div
              className="relative flex flex-col justify-between select-none lg:h-[396px] focus:outline-none"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight') {
                  if (metricCarouselRef.current) {
                    const slide0 = metricCarouselRef.current.children[0] as HTMLElement | undefined;
                    const slide1 = metricCarouselRef.current.children[1] as HTMLElement | undefined;
                    const baseOffset = slide0 ? slide0.offsetLeft : 0;
                    const targetLeft = slide1 ? slide1.offsetLeft - baseOffset : metricCarouselRef.current.offsetWidth;
                    metricCarouselRef.current.scrollTo({ left: targetLeft, behavior: 'smooth' });
                    setActiveMetricSlide(1);
                  }
                } else if (e.key === 'ArrowLeft') {
                  if (metricCarouselRef.current) {
                    metricCarouselRef.current.scrollTo({ left: 0, behavior: 'smooth' });
                    setActiveMetricSlide(0);
                  }
                }
              }}
            >
              {/* Horizontal Scroll Snap Container menampung kedua kartu utuh dengan celah visual 2-4px */}
              <div
                ref={metricCarouselRef}
                className={`flex-1 min-h-0 overflow-x-auto flex gap-1 snap-x snap-mandatory scroll-smooth no-scrollbar w-full p-0.5 rounded-3xl touch-pan-x select-none ${
                  isMouseDragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
                style={{ gap: '4px', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                onScroll={() => {
                  if (isDraggingRef.current || !metricCarouselRef.current) return;
                  const { scrollLeft } = metricCarouselRef.current;
                  const slide0 = metricCarouselRef.current.children[0] as HTMLElement | undefined;
                  const slide1 = metricCarouselRef.current.children[1] as HTMLElement | undefined;
                  const baseOffset = slide0 ? slide0.offsetLeft : 0;
                  const slide1Offset = slide1 ? slide1.offsetLeft - baseOffset : metricCarouselRef.current.offsetWidth;
                  const threshold = slide1Offset / 2;
                  const currentSlide = scrollLeft >= threshold ? 1 : 0;
                  if (currentSlide !== activeMetricSlide) {
                    setActiveMetricSlide(currentSlide);
                  }
                }}
                onPointerDown={(e) => {
                  if (e.pointerType === 'touch') return;
                  if (e.button !== 0 || !metricCarouselRef.current) return;

                  const target = e.target as HTMLElement;
                  if (target.closest('button, a, input, select, textarea, [role="button"]')) {
                    return;
                  }

                  isPointerDownRef.current = true;
                  dragStartXRef.current = e.clientX;
                  dragStartScrollLeftRef.current = metricCarouselRef.current.scrollLeft;
                  isDraggingRef.current = false;
                }}
                onPointerMove={(e) => {
                  if (!isPointerDownRef.current || !metricCarouselRef.current) return;
                  const deltaX = e.clientX - dragStartXRef.current;

                  if (!isDraggingRef.current && Math.abs(deltaX) > 4) {
                    isDraggingRef.current = true;
                    setIsMouseDragging(true);
                    try {
                      metricCarouselRef.current.setPointerCapture(e.pointerId);
                    } catch {
                      // ignore
                    }
                  }

                  if (isDraggingRef.current) {
                    e.preventDefault();
                    metricCarouselRef.current.style.scrollBehavior = 'auto';
                    metricCarouselRef.current.style.scrollSnapType = 'none';
                    metricCarouselRef.current.scrollLeft = dragStartScrollLeftRef.current - deltaX;
                  }
                }}
                onPointerUp={(e) => {
                  if (e.pointerType === 'touch') return;
                  if (!isPointerDownRef.current) return;
                  isPointerDownRef.current = false;

                  if (metricCarouselRef.current) {
                    try {
                      if (metricCarouselRef.current.hasPointerCapture(e.pointerId)) {
                        metricCarouselRef.current.releasePointerCapture(e.pointerId);
                      }
                    } catch {
                      // ignore
                    }

                    metricCarouselRef.current.style.scrollBehavior = 'smooth';
                    metricCarouselRef.current.style.scrollSnapType = 'x mandatory';

                    if (isDraggingRef.current) {
                      justFinishedDragRef.current = true;
                      setTimeout(() => {
                        justFinishedDragRef.current = false;
                      }, 50);

                      const deltaX = e.clientX - dragStartXRef.current;
                      const scrollLeft = metricCarouselRef.current.scrollLeft;
                      const slide0 = metricCarouselRef.current.children[0] as HTMLElement | undefined;
                      const slide1 = metricCarouselRef.current.children[1] as HTMLElement | undefined;
                      const baseOffset = slide0 ? slide0.offsetLeft : 0;
                      const slide1Offset = slide1 ? slide1.offsetLeft - baseOffset : metricCarouselRef.current.offsetWidth;

                      let target = activeMetricSlide;
                      if (Math.abs(deltaX) > 35) {
                        target = deltaX < 0 ? 1 : 0;
                      } else {
                        target = scrollLeft >= slide1Offset / 2 ? 1 : 0;
                      }

                      const targetLeft = target === 0 ? 0 : slide1Offset;
                      metricCarouselRef.current.scrollTo({ left: targetLeft, behavior: 'smooth' });
                      setActiveMetricSlide(target);
                    }
                  }

                  isDraggingRef.current = false;
                  setIsMouseDragging(false);
                }}
                onPointerCancel={(e) => {
                  if (e.pointerType === 'touch') return;
                  isPointerDownRef.current = false;
                  if (metricCarouselRef.current) {
                    try {
                      if (metricCarouselRef.current.hasPointerCapture(e.pointerId)) {
                        metricCarouselRef.current.releasePointerCapture(e.pointerId);
                      }
                    } catch {
                      // ignore
                    }
                    metricCarouselRef.current.style.scrollBehavior = 'smooth';
                    metricCarouselRef.current.style.scrollSnapType = 'x mandatory';
                    const slide0 = metricCarouselRef.current.children[0] as HTMLElement | undefined;
                    const slide1 = metricCarouselRef.current.children[1] as HTMLElement | undefined;
                    const baseOffset = slide0 ? slide0.offsetLeft : 0;
                    const slide1Offset = slide1 ? slide1.offsetLeft - baseOffset : metricCarouselRef.current.offsetWidth;
                    const target = metricCarouselRef.current.scrollLeft >= slide1Offset / 2 ? 1 : 0;
                    metricCarouselRef.current.scrollTo({ left: target === 0 ? 0 : slide1Offset, behavior: 'smooth' });
                    setActiveMetricSlide(target);
                  }
                  isDraggingRef.current = false;
                  setIsMouseDragging(false);
                }}
                onClickCapture={(e) => {
                  if (justFinishedDragRef.current) {
                    e.stopPropagation();
                    e.preventDefault();
                  }
                }}
              >
                {/* Kartu 1 Utuh: Ringkasan Keuangan (Total Modal HPP & Laba Kotor) */}
                <div
                  className="w-full shrink-0 snap-start p-5 sm:p-6 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col justify-between h-full"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  {/* Header Kartu 1 */}
                  <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                        <TrendingUp className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                          Ringkasan Keuangan
                        </h3>
                        <p className="text-xs text-stone-500">
                          Modal HPP & Laba Kotor ({analyticsDateRange.label})
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Konten Kartu 1: Dua Kolom Total Modal (HPP) & Laba Kotor */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-3 flex-1 min-h-0">
                    {/* Kolom 1: Total Modal HPP Terjual */}
                    <div className="flex flex-col justify-between h-full py-1">
                      <span className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                        <Package className="w-4 h-4 text-amber-600" />
                        Total Modal (HPP)
                      </span>
                      <div className="my-auto py-2">
                        <p className="text-xl sm:text-2xl font-black text-[#C68B59] break-words">
                          {formatRupiah(periodTotalHPP)}
                        </p>
                      </div>
                      <div className="pt-1 flex flex-wrap items-center justify-between gap-1 text-[11px] text-stone-500 font-medium">
                        <span>
                          {periodAverageStats.totalNetSales > 0
                            ? `${Math.round((periodTotalHPP / periodAverageStats.totalNetSales) * 1000) / 10}% dari omzet penjualan`
                            : 'Modal bahan baku produk terjual'}
                        </span>
                        <div className="flex flex-wrap items-center gap-1">
                          {periodAllOrders.some(o => getOrderHPPCategory(o) === 'legacy_estimate') && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                              Estimasi Legacy
                            </span>
                          )}
                          {periodAllOrders.some(o => getOrderHPPCategory(o) === 'partial_snapshot') && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                              Snapshot Total · Rincian Item Estimasi
                            </span>
                          )}
                          {(periodAllOrders.length === 0 || periodAllOrders.every(o => getOrderHPPCategory(o) === 'snapshot_riil')) && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                              Snapshot Riil
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Kolom 2: Laba Kotor */}
                    <div className="flex flex-col justify-between h-full py-1">
                      <span className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        Laba Kotor
                      </span>
                      <div className="my-auto py-2">
                        <p className={`text-xl sm:text-2xl font-black break-words ${periodGrossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {formatRupiah(periodGrossProfit)}
                        </p>
                      </div>
                      <p className="text-[11px] text-stone-500 font-medium">
                        Margin laba kotor: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">{periodGrossProfitMargin}%</strong>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Kartu 2 Utuh: Rata-rata Transaksi (Nilai & Jumlah Produk) */}
                <div
                  className="w-full shrink-0 snap-start p-5 sm:p-6 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col justify-between h-full"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  {/* Header Kartu 2 */}
                  <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3 shrink-0">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                        <Receipt className="w-5 h-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                          Rata-rata Transaksi
                        </h3>
                        <p className="text-xs text-stone-500">
                          Metrik rata-rata per transaksi valid ({analyticsDateRange.label})
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Konten Kartu 2: Dua Kolom Nilai Transaksi & Jumlah Produk */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 pt-3 flex-1 min-h-0">
                    {/* Kolom 1: Rata-rata Nilai Transaksi */}
                    <div className="flex flex-col justify-between h-full py-1">
                      <span className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-[#C68B59]" />
                        Rata-rata Nilai Transaksi
                      </span>
                      <div className="my-auto py-2">
                        <p className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 break-words">
                          {periodAverageStats.avgValue !== null
                            ? formatRupiah(periodAverageStats.avgValue)
                            : '—'}
                        </p>
                      </div>
                      <p className="text-[11px] text-stone-500 font-medium">
                        {periodAverageStats.count > 0
                          ? `Total omzet bersih: ${formatRupiah(periodAverageStats.totalNetSales)}`
                          : 'Belum ada transaksi valid'}
                      </p>
                    </div>

                    {/* Kolom 2: Rata-rata Jumlah Produk */}
                    <div className="flex flex-col justify-between h-full py-1">
                      <span className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                        <ShoppingBag className="w-4 h-4 text-blue-600" />
                        Rata-rata Jumlah Produk
                      </span>
                      <div className="my-auto py-2">
                        <p className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 break-words">
                          {periodAverageStats.avgUnits !== null
                            ? `${periodAverageStats.avgUnits.toLocaleString('id-ID')} Unit`
                            : '—'}
                        </p>
                      </div>
                      <p className="text-[11px] text-stone-500 font-medium">
                        {periodAverageStats.count > 0
                          ? `Total ${periodAverageStats.totalUnits} unit produk terjual`
                          : 'Belum ada produk terjual'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Centered Page Indicator Dots */}
              <div className="flex items-center justify-center gap-1.5 pt-3 shrink-0">
                {[0, 1].map(idx => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      if (!metricCarouselRef.current) return;
                      const slide0 = metricCarouselRef.current.children[0] as HTMLElement | undefined;
                      const slide1 = metricCarouselRef.current.children[1] as HTMLElement | undefined;
                      const baseOffset = slide0 ? slide0.offsetLeft : 0;
                      const targetLeft = idx === 0 ? 0 : (slide1 ? slide1.offsetLeft - baseOffset : metricCarouselRef.current.offsetWidth);
                      metricCarouselRef.current.scrollTo({
                        left: targetLeft,
                        behavior: 'smooth',
                      });
                      setActiveMetricSlide(idx);
                    }}
                    aria-label={`Pindah ke layer ${idx === 0 ? 'Ringkasan Keuangan' : 'Rata-rata Transaksi'}`}
                    className={`h-1.5 rounded-full transition-all cursor-pointer ${
                      activeMetricSlide === idx
                        ? 'bg-[#3B2A1F] dark:bg-[#D4A373] w-5'
                        : 'bg-stone-300 dark:bg-stone-700 hover:bg-stone-400 w-1.5'
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Card Produk Terlaris */}
            <div className="p-6 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col lg:h-[396px]">
              <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-3 shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-[#C68B59]">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                      Produk Terlaris
                    </h3>
                    <p className="text-xs text-stone-500">
                      Berdasarkan unit valid terjual ({analyticsDateRange.label})
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/products')}
                  className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span>Kelola Produk</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#C68B59]" />
                </button>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar space-y-2.5 pt-3">
                {periodTopProducts.length > 0 ? (
                  periodTopProducts.map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-2.5 bg-stone-50 dark:bg-[#25221F] rounded-2xl border border-stone-100 dark:border-stone-800"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-6 h-6 rounded-xl font-black text-xs flex items-center justify-center shrink-0 ${idx === 0
                          ? 'bg-[#3B2A1F] text-[#D4A373]'
                          : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                          }`}>
                          {idx + 1}
                        </span>

                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate" title={p.name}>
                            {p.name}
                          </p>
                          <p className="text-[10px] text-stone-500 font-semibold">
                            {p.category} • {p.qty} unit terjual
                          </p>
                        </div>
                      </div>

                      <span className="text-xs font-extrabold text-[#C68B59] shrink-0 ml-2">
                        {formatRupiah(p.revenue)}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="h-full flex flex-col items-center justify-center py-8 text-center text-xs text-stone-400 space-y-1">
                    <Award className="w-8 h-8 mx-auto opacity-30 text-stone-400" />
                    <p className="font-bold text-stone-600 dark:text-stone-300">Belum Ada Transaksi</p>
                    <p>Belum ada produk terjual pada periode ini.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2: Charts (Sales Bar Chart & Category Donut Chart) */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Sales Bar Chart (3 Cols on Desktop) */}
            <div className="lg:col-span-3 p-6 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
                <div>
                  <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                    {chartTitle}
                  </h3>
                  <p className="text-xs text-stone-500">
                    {chartDescription}
                  </p>
                </div>

                <div className="text-left sm:text-right">
                  <p className="text-[10px] text-stone-500 font-semibold uppercase">
                    Total Omzet
                  </p>
                  <p className="text-sm font-black text-[#C68B59]">
                    {formatRupiah(chartTotalRevenue)}
                  </p>
                </div>
              </div>

              {/* Dynamic Bar Chart Visual */}
              <div className="pt-2 h-64 flex items-end justify-between gap-1 sm:gap-2 px-1 overflow-hidden">
                {chartData.map((item, idx) => {
                  const heightPct =
                    item.revenue > 0
                      ? Math.max(
                        5,
                        Math.round(
                          (item.revenue / maxChartRevenue) * 100
                        )
                      )
                      : 2;

                  const shouldShowLabel =
                    analyticsPeriod === 'today' ||
                    analyticsPeriod === 'week' ||
                    analyticsPeriod === 'year' ||
                    chartData.length <= 15 ||
                    idx % Math.ceil(chartData.length / 10) === 0;

                  return (
                    <div
                      key={`${item.label}-${idx}`}
                      className="flex-1 min-w-0 flex flex-col items-center gap-2 group h-full justify-end"
                    >
                      <div className="relative w-full h-40 flex items-end justify-center">
                        <span className="absolute -top-5 text-[9px] sm:text-[10px] font-bold text-[#C68B59] opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10 pointer-events-none">
                          {formatRupiah(item.revenue)}
                        </span>

                        <div className="w-full h-full bg-stone-100 dark:bg-stone-800 rounded-xl overflow-hidden flex items-end p-0.5 sm:p-1">
                          <div
                            style={{
                              height: `${heightPct}%`,
                            }}
                            className="w-full bg-[#3B2A1F] dark:bg-[#D4A373] rounded-lg transition-all duration-500 group-hover:bg-[#C68B59]"
                          />
                        </div>
                      </div>

                      <span
                        className={`text-[9px] sm:text-[10px] font-bold text-stone-500 dark:text-stone-400 truncate max-w-full ${shouldShowLabel ? 'opacity-100' : 'opacity-0'
                          }`}
                      >
                        {item.shortLabel}
                      </span>
                    </div>
                  );
                })}
              </div>

              {chartTotalRevenue === 0 && (
                <div className="text-center text-xs text-stone-400">
                  Belum ada transaksi pada periode ini.
                </div>
              )}
            </div>

            {/* Pie/Donut Chart: Penjualan per Kategori (2 Cols on Desktop) */}
            <div className="lg:col-span-2 p-6 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-xl bg-[#C68B59]/10 text-[#C68B59]">
                    <PieChart className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                      Penjualan per Kategori
                    </h3>
                    <p className="text-xs text-stone-500">
                      Kontribusi penjualan bersih berdasarkan kategori
                    </p>
                  </div>
                </div>
              </div>

              {categorySalesData.length > 0 ? (
                <div className="flex flex-col sm:flex-row items-center gap-6 py-2">
                  {/* Interactive SVG Donut */}
                  <div className="relative w-44 h-44 sm:w-48 sm:h-48 shrink-0 flex items-center justify-center">
                    <svg
                      viewBox="0 0 200 200"
                      className="w-full h-full -rotate-90 transform"
                    >
                      {/* Background track circle */}
                      <circle
                        cx="100"
                        cy="100"
                        r={donutRadius}
                        fill="transparent"
                        stroke="currentColor"
                        strokeWidth="20"
                        className="text-stone-100 dark:text-stone-800/80"
                      />

                      {/* Dynamic Slices */}
                      {(() => {
                        let accumulatedOffset = 0;
                        return categorySalesData.map((cat, idx) => {
                          const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                          const sliceRatio = cat.percentage / 100;
                          const dashLength = sliceRatio * donutCircumference;
                          const dashSpace = Math.max(0, donutCircumference - dashLength);
                          const currentOffset = accumulatedOffset;
                          accumulatedOffset += dashLength;

                          const isHovered = hoveredCategory === cat.id;

                          return (
                            <circle
                              key={cat.id}
                              cx="100"
                              cy="100"
                              r={donutRadius}
                              fill="transparent"
                              stroke={color}
                              strokeWidth={isHovered ? 26 : 20}
                              strokeDasharray={`${dashLength} ${dashSpace}`}
                              strokeDashoffset={-currentOffset}
                              onMouseEnter={() => setHoveredCategory(cat.id)}
                              onMouseLeave={() => setHoveredCategory(null)}
                              className="transition-all duration-200 cursor-pointer"
                              style={{
                                opacity: hoveredCategory && !isHovered ? 0.45 : 1,
                              }}
                            />
                          );
                        });
                      })()}
                    </svg>

                    {/* Center Info Overlay */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-3 pointer-events-none">
                      {hoveredCategoryItem ? (
                        <>
                          <p className="text-[10px] font-black text-stone-500 uppercase tracking-wider truncate max-w-[120px]">
                            {hoveredCategoryItem.name}
                          </p>
                          <p className="text-sm font-black text-[#C68B59] mt-0.5">
                            {formatRupiah(hoveredCategoryItem.sales)}
                          </p>
                          <span className="text-[10px] font-extrabold text-stone-700 dark:text-stone-300">
                            {hoveredCategoryItem.percentage}% Omzet
                          </span>
                        </>
                      ) : (
                        <>
                          <p className="text-[10px] font-bold text-stone-400 uppercase tracking-wider">
                            Total Bersih
                          </p>
                          <p className="text-sm font-black text-stone-900 dark:text-stone-100 mt-0.5">
                            {formatRupiah(totalCategoryRevenue)}
                          </p>
                          <span className="text-[10px] font-semibold text-stone-500">
                            {categorySalesData.length} Kategori
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex-1 w-full space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {categorySalesData.map((cat, idx) => {
                      const color = CATEGORY_COLORS[idx % CATEGORY_COLORS.length];
                      const isHovered = hoveredCategory === cat.id;
                      return (
                        <div
                          key={cat.id}
                          onMouseEnter={() => setHoveredCategory(cat.id)}
                          onMouseLeave={() => setHoveredCategory(null)}
                          className={`flex items-center justify-between p-2 rounded-xl text-xs transition-colors cursor-pointer ${isHovered
                            ? 'bg-stone-100 dark:bg-stone-800'
                            : 'hover:bg-stone-50 dark:hover:bg-[#25221F]'
                            }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <span
                              className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                              style={{ backgroundColor: color }}
                            />
                            <span className="font-bold text-stone-800 dark:text-stone-200 truncate" title={cat.name}>
                              {cat.name}
                            </span>
                          </div>
                          <div className="text-right shrink-0 ml-2">
                            <span className="font-black text-stone-900 dark:text-stone-100 block text-xs">
                              {formatRupiah(cat.sales)}
                            </span>
                            <span className="text-[10px] font-bold text-[#C68B59]">
                              {cat.percentage}%
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="py-12 text-center text-xs text-stone-400 space-y-2">
                  <PieChart className="w-8 h-8 mx-auto opacity-30 text-stone-400" />
                  <p className="font-bold text-stone-600 dark:text-stone-300">Belum Ada Data Penjualan</p>
                  <p>Tidak ada penjualan pada periode yang dipilih.</p>
                </div>
              )}

              <div className="text-[11px] text-stone-400 text-center pt-2 border-t border-stone-100 dark:border-stone-800">
                Arahkan kursor pada grafik untuk melihat rincian kategori.
              </div>
            </div>
          </div>

          {/* Row 3: Balanced 2-Column Section (Shift Monitoring & Recent Transactions) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Card Ringkasan Shift untuk Owner */}
            <div className="p-6 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4 flex flex-col justify-between">
              <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-[#3B2A1F] text-[#D4A373]">
                    <Clock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                      Pemantauan Shift Kasir
                    </h3>
                    <p className="text-xs text-stone-500">
                      Status sesi kasir dan rekonsiliasi kas terkini
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => navigate('/shifts')}
                  className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                >
                  <span>Lihat Detail Shift</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#C68B59]" />
                </button>
              </div>

              {activeShift && activeFinancials ? (
                <div className="space-y-3.5">
                  {/* Status Indicator */}
                  <div className="p-3 bg-emerald-500/10 dark:bg-emerald-950/20 border border-emerald-500/20 rounded-2xl flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                      </span>
                      <span className="text-xs font-black text-emerald-800 dark:text-emerald-300">
                        Shift #{activeShift.shift_number} Sedang Aktif
                      </span>
                    </div>

                    <span className="text-[11px] font-bold text-stone-600 dark:text-stone-300">
                      Durasi: {formatShiftDuration(activeShift.opened_at)}
                    </span>
                  </div>

                  {/* Metadata Info */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="p-3 bg-stone-50 dark:bg-[#25221F] rounded-2xl border border-stone-100 dark:border-stone-800 space-y-0.5">
                      <span className="text-[10px] text-stone-400 uppercase font-bold">Petugas Pembuka</span>
                      <p className="font-extrabold text-stone-900 dark:text-stone-100 truncate">
                        {activeShift.opened_by_name}
                      </p>
                      <p className="text-[10px] text-stone-500">Mulai: {formatDateTime(activeShift.opened_at)}</p>
                    </div>

                    <div className="p-3 bg-stone-50 dark:bg-[#25221F] rounded-2xl border border-stone-100 dark:border-stone-800 space-y-0.5">
                      <span className="text-[10px] text-stone-400 uppercase font-bold">Modal Awal</span>
                      <p className="font-extrabold text-[#C68B59]">
                        {formatRupiah(activeFinancials.cash_initial)}
                      </p>
                      <p className="text-[10px] text-stone-500">{activeFinancials.total_orders_count} transaksi shift</p>
                    </div>
                  </div>

                  {/* Net Sales & Payment Breakdown */}
                  <div className="p-3.5 bg-stone-50 dark:bg-[#25221F] rounded-2xl border border-stone-100 dark:border-stone-800 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-stone-500 font-semibold">Penjualan Bersih Sementara:</span>
                      <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm">
                        {formatRupiah(activeFinancials.net_sales)}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-stone-200/60 dark:border-stone-800 text-[11px]">
                      <div className="flex justify-between">
                        <span className="text-stone-400">💵 Tunai:</span>
                        <span className="font-bold text-stone-800 dark:text-stone-200">
                          {formatRupiah(activeFinancials.cash_sales)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-400">📱 QRIS:</span>
                        <span className="font-bold text-stone-800 dark:text-stone-200">
                          {formatRupiah(activeFinancials.qris_sales)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="py-6 text-center space-y-3">
                  <div className="inline-flex p-3 rounded-2xl bg-amber-500/10 text-amber-600">
                    <Lock className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-sm font-extrabold text-stone-800 dark:text-stone-200">
                      Kasir Belum Memiliki Shift Aktif
                    </p>
                    <p className="text-xs text-stone-400 mt-0.5">
                      Perangkat kasir saat ini terkunci atau sesi shift belum dibuka.
                    </p>
                  </div>

                  {lastClosedShift && (
                    <div className="p-3 bg-stone-50 dark:bg-[#25221F] rounded-2xl text-left border border-stone-100 dark:border-stone-800 text-[11px] text-stone-500 space-y-1">
                      <div className="flex justify-between">
                        <span className="font-bold text-stone-700 dark:text-stone-300">
                          Shift Terakhir #{lastClosedShift.shift_number}
                        </span>
                        <span className="text-stone-400">
                          {lastClosedShift.closed_at ? formatDate(lastClosedShift.closed_at) : '-'}
                        </span>
                      </div>
                      <p>
                        Ditutup oleh: <strong className="text-stone-700 dark:text-stone-300">{lastClosedShift.closed_by_name || '-'}</strong>
                      </p>
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => navigate('/shifts')}
                    className="px-4 py-2 bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-bold text-xs rounded-xl shadow-sm transition-all cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <DoorOpen className="w-3.5 h-3.5 text-[#D4A373]" />
                    <span>Buka Menu Shift</span>
                  </button>
                </div>
              )}
            </div>

            {/* Card Transaksi Terbaru (Owner - Proporsional berdampingan dengan Shift) */}
            <div className="p-6 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-3">
                <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#C68B59]" />
                  Transaksi Terbaru
                </h3>

                <button
                  type="button"
                  onClick={() => navigate('/transactions')}
                  className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span>Lihat Semua</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#C68B59]" />
                </button>
              </div>

              <div className="space-y-2.5">
                {orders.slice(0, 5).map(order => (
                  <div
                    key={order.id}
                    onClick={() => openReceiptModal(order)}
                    className="p-3.5 bg-stone-50 dark:bg-[#25221F] hover:bg-stone-100 dark:hover:bg-[#2E2A26] rounded-2xl border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-[#3B2A1F] text-[#F7F5F2] shrink-0">
                        <Coffee className="w-4 h-4 text-[#D4A373]" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-stone-900 dark:text-stone-100">
                            {order.order_number}
                          </span>

                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C68B59]/10 text-[#C68B59] uppercase">
                            {order.order_type === 'dine_in'
                              ? 'Dine In'
                              : 'Take Away'}
                          </span>
                        </div>

                        <p className="text-xs text-stone-500 truncate">
                          Kasir: {order.created_by_name} •{' '}
                          {order.items.length} Menu •{' '}
                          {formatDate(order.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-3 ml-auto">
                      <div>
                        <p className="font-black text-stone-900 dark:text-stone-100 text-sm">
                          {formatRupiah(order.total_amount)}
                        </p>

                        <p className={`text-[10px] font-bold uppercase ${order.payment?.status === 'refunded' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {order.payment?.method || '-'} • {order.payment?.status === 'refunded' ? 'Refunded' : 'Sukses'}
                        </p>
                      </div>

                      <ArrowUpRight className="w-4 h-4 text-stone-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* KARYAWAN DASHBOARD SECTION                               */}
      {/* ======================================================== */}
      {!isOwner && (
        <div className="space-y-6">
          {/* Header Kontrol Periode Ringkas Karyawan (Sticky with 12px offset from Navbar) */}
          <div className="sticky top-3 z-20 bg-white dark:bg-[#1A1816] px-4 py-3 sm:px-5 sm:py-3.5 rounded-2xl border border-stone-200/80 dark:border-stone-800/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-all">
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-[#C68B59] shrink-0" />
                <h2 className="text-sm sm:text-base font-extrabold text-stone-900 dark:text-stone-100 tracking-tight truncate">
                  Ringkasan Kinerja Kasir
                </h2>
              </div>
              <p className="text-[11px] sm:text-xs text-stone-500 dark:text-stone-400 mt-0.5 flex items-center gap-1.5 truncate">
                <span className="font-medium">Periode aktif:</span>
                <span className="font-bold text-stone-700 dark:text-stone-300">
                  {analyticsDateRange.label}
                </span>
              </p>
            </div>

            {/* Quick Period Selector */}
            <div className="flex items-center gap-1 p-1 bg-stone-100 dark:bg-stone-800/80 rounded-xl w-full sm:w-auto shrink-0 overflow-x-auto scrollbar-none">
              {[
                { id: 'today', label: 'Hari Ini' },
                { id: 'week', label: 'Minggu Ini' },
                { id: 'month', label: 'Bulan Ini' },
                { id: 'year', label: 'Tahun Ini' },
              ].map(p => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setAnalyticsPeriod(p.id as AnalyticsPeriod)}
                  className={`flex-1 sm:flex-initial px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${analyticsPeriod === p.id
                    ? 'bg-[#3B2A1F] text-white shadow-xs'
                    : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-200/50 dark:hover:bg-stone-700/50'
                    }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Unified Average Transaction Card for Karyawan */}
          <div className="p-6 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                    Rata-rata per Transaksi
                  </h3>
                  <p className="text-xs text-stone-500">
                    Rata-rata penjualan bersih dan unit produk per transaksi valid
                  </p>
                </div>
              </div>

              <span className="text-[11px] font-bold text-stone-500 bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-xl">
                {periodAverageStats.count} Transaksi Valid
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 py-2">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                  <DollarSign className="w-4 h-4 text-[#C68B59]" />
                  Rata-rata Nilai Transaksi
                </span>
                <p className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 break-words">
                  {periodAverageStats.avgValue !== null
                    ? formatRupiah(periodAverageStats.avgValue)
                    : '—'}
                </p>
                <p className="text-[11px] text-stone-500 font-medium">
                  {periodAverageStats.count > 0
                    ? `Total: ${formatRupiah(periodAverageStats.totalNetSales)}`
                    : 'Belum ada transaksi valid'}
                </p>
              </div>

              <div className="space-y-1.5">
                <span className="text-xs font-bold text-stone-500 uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                  Rata-rata Jumlah Produk
                </span>
                <p className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100 break-words">
                  {periodAverageStats.avgUnits !== null
                    ? `${periodAverageStats.avgUnits.toLocaleString('id-ID')} Unit`
                    : '—'}
                </p>
                <p className="text-[11px] text-stone-500 font-medium">
                  {periodAverageStats.count > 0
                    ? `Total: ${periodAverageStats.totalUnits} unit produk`
                    : 'Belum ada produk terjual'}
                </p>
              </div>
            </div>
          </div>

          {/* Susunan Dua Kolom Berdampingan Karyawan: Transaksi di Kiri & Produk Terlaris di Kanan */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Kolom Kiri: Card Transaksi */}
            <div className="p-6 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-3">
                <h3 className="font-bold text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#C68B59]" />
                  Transaksi Terbaru
                </h3>

                <button
                  type="button"
                  onClick={() => navigate('/transactions')}
                  className="px-3 py-1.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shrink-0"
                >
                  <span>Lihat Semua</span>
                  <ArrowUpRight className="w-3.5 h-3.5 text-[#C68B59]" />
                </button>
              </div>

              <div className="space-y-2.5">
                {orders.slice(0, 5).map(order => (
                  <div
                    key={order.id}
                    onClick={() => openReceiptModal(order)}
                    className="p-3.5 bg-stone-50 dark:bg-[#25221F] hover:bg-stone-100 dark:hover:bg-[#2E2A26] rounded-2xl border border-stone-200 dark:border-stone-800 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2.5 rounded-xl bg-[#3B2A1F] text-[#F7F5F2] shrink-0">
                        <Coffee className="w-4 h-4 text-[#D4A373]" />
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-sm text-stone-900 dark:text-stone-100">
                            {order.order_number}
                          </span>

                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#C68B59]/10 text-[#C68B59] uppercase">
                            {order.order_type === 'dine_in'
                              ? 'Dine In'
                              : 'Take Away'}
                          </span>
                        </div>

                        <p className="text-xs text-stone-500 truncate">
                          Kasir: {order.created_by_name} •{' '}
                          {order.items.length} Menu •{' '}
                          {formatDate(order.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="text-right shrink-0 flex items-center gap-3 ml-auto">
                      <div>
                        <p className="font-black text-stone-900 dark:text-stone-100 text-sm">
                          {formatRupiah(order.total_amount)}
                        </p>

                        <p className={`text-[10px] font-bold uppercase ${order.payment?.status === 'refunded' ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {order.payment?.method || '-'} • {order.payment?.status === 'refunded' ? 'Refunded' : 'Sukses'}
                        </p>
                      </div>

                      <ArrowUpRight className="w-4 h-4 text-stone-400" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Kolom Kanan: Card Produk Terlaris Karyawan */}
            <div className="p-6 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
              <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/10 text-[#C68B59]">
                    <Award className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-stone-900 dark:text-stone-100">
                      Produk Terlaris
                    </h3>
                    <p className="text-xs text-stone-500">
                      Menu terlaris periode {analyticsDateRange.label}
                    </p>
                  </div>
                </div>
              </div>

              {periodTopProducts.length > 0 ? (
                <div className="space-y-3">
                  {/* Highlight Juara Terlaris #1 */}
                  <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent rounded-2xl border border-amber-500/20 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-2xl bg-[#3B2A1F] text-[#D4A373] font-black text-sm flex items-center justify-center shrink-0 shadow-xs">
                        #1
                      </div>
                      <div className="min-w-0">
                        <span className="text-[10px] font-extrabold uppercase text-[#C68B59] tracking-wider block">
                          Menu Terlaris
                        </span>
                        <p className="text-sm font-black text-stone-900 dark:text-stone-100 truncate">
                          {periodTopProducts[0].name}
                        </p>
                        <p className="text-xs text-stone-500 font-semibold mt-0.5">
                          Kategori: {periodTopProducts[0].category}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-base font-black text-[#C68B59] block">
                        {periodTopProducts[0].qty} Unit
                      </span>
                      <span className="text-[11px] font-bold text-stone-500">
                        {formatRupiah(periodTopProducts[0].revenue)}
                      </span>
                    </div>
                  </div>

                  {/* Runner-ups (Peringkat 2 - 5) */}
                  {periodTopProducts.slice(1, 5).map((p, idx) => (
                    <div
                      key={p.id}
                      className="flex items-center justify-between p-3 bg-stone-50 dark:bg-[#25221F] rounded-2xl border border-stone-100 dark:border-stone-800"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="w-6 h-6 rounded-xl bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300 font-black text-xs flex items-center justify-center shrink-0">
                          #{idx + 2}
                        </span>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-stone-800 dark:text-stone-200 truncate">
                            {p.name}
                          </p>
                          <p className="text-[10px] text-stone-500">
                            {p.category}
                          </p>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-2">
                        <span className="text-xs font-black text-stone-900 dark:text-stone-100 block">
                          {p.qty} Unit
                        </span>
                        <span className="text-[10px] font-bold text-[#C68B59]">
                          {formatRupiah(p.revenue)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-xs text-stone-400 space-y-1">
                  <Award className="w-8 h-8 mx-auto opacity-30 text-stone-400" />
                  <p className="font-bold text-stone-600 dark:text-stone-300">Belum Ada Transaksi</p>
                  <p>Belum ada produk terjual pada periode ini.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Informasi Diskon Aktif */}
      {isDiscountModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
          onClick={() => setIsDiscountModalOpen(false)}
        >
          <div
            className="bg-white dark:bg-[#1E1C1A] w-full max-w-lg rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-[#171514]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-[#C68B59]/10 text-[#C68B59]">
                  <Tag className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-black text-stone-900 dark:text-stone-100">
                    Informasi Promo Diskon
                  </h2>
                  <p className="text-[11px] text-stone-500 font-medium">
                    Promo potongan harga otomatis yang aktif di POS
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsDiscountModalOpen(false)}
                className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* List Promo */}
            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-3">
              {activeDiscounts.length === 0 ? (
                <div className="text-center py-8 text-stone-400 space-y-2">
                  <Tag className="w-10 h-10 mx-auto opacity-30 text-[#C68B59]" />
                  <p className="text-sm font-bold text-stone-600 dark:text-stone-300">
                    Belum Ada Promo Aktif
                  </p>
                  <p className="text-xs text-stone-400">
                    Saat ini tidak ada promo diskon yang sedang berjalan di kasir.
                  </p>
                </div>
              ) : (
                activeDiscounts.map(rule => (
                  <div
                    key={rule.id}
                    className="p-4 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-800 flex items-center justify-between gap-4"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm text-stone-900 dark:text-stone-100">
                          {rule.name}
                        </span>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 uppercase">
                          Aktif
                        </span>
                      </div>

                      <p className="text-xs text-stone-500 font-medium">
                        {Number(rule.minimum_purchase) > 0
                          ? `Minimal Belanja: ${formatRupiah(Number(rule.minimum_purchase))}`
                          : 'Tanpa batas minimal belanja'}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-lg font-black text-[#C68B59]">
                        {rule.discount_percentage}%
                      </span>
                      <p className="text-[10px] text-stone-400 font-medium">Potongan Otomatis</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-[#171514] flex justify-end">
              <button
                type="button"
                onClick={() => setIsDiscountModalOpen(false)}
                className="px-5 py-2.5 rounded-xl font-bold bg-[#3B2A1F] text-white hover:bg-[#2A1E16] dark:bg-[#D4A373] dark:text-[#1F1F1F] dark:hover:bg-[#C68B59] transition-colors cursor-pointer text-xs"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};