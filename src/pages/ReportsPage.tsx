import React, { useState, useMemo, useEffect } from 'react';
import { usePOS } from '../hooks/usePOS';
import { formatRupiah, formatDate } from '../utils/formatters';
import {
  BarChart3, Download, Calendar, TrendingUp, DollarSign, ShoppingBag, Coffee,
  Printer, Layers, CreditCard, AlertTriangle, ArrowDownLeft,
  ArrowUpRight, ArrowRightLeft, FileText, RotateCcw, Banknote, QrCode, Info, User as UserIcon
} from 'lucide-react';
import { orderService } from '../services/orderService';
import { Order } from '../types';
import { computeReportData, DateFilterType } from '../utils/reportUtils';

export const ReportsPage: React.FC = () => {
  const { orders, products, stocks, purchases, recipes, settings, currentUser, usersList, showToast, openReceiptModal } = usePOS();

  const [dateFilter, setDateFilter] = useState<DateFilterType>('month');
  const [activeTab, setActiveTab] = useState<'all' | 'sales' | 'purchases' | 'transactions' | 'refunds'>('all');

  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  const [reportOrders, setReportOrders] = useState<Order[]>(orders);
  const [isLoadingReport, setIsLoadingReport] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<'pdf' | 'excel' | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const fetchReportOrders = async () => {
      // If filter is today or week, in-memory orders from POSContext already has the complete dataset
      if (dateFilter === 'today' || dateFilter === 'week') {
        setReportOrders(orders);
        return;
      }

      setIsLoadingReport(true);
      try {
        let startStr = startDate;
        let endStr = endDate;

        if (dateFilter === 'month') {
          const now = new Date();
          const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
          const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          startStr = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`;
          endStr = `${lastDay.getFullYear()}-${String(lastDay.getMonth() + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
        }

        const fetchedOrders = await orderService.getOrders({
          start_date: startStr,
          end_date: endStr,
          include_refunds_in_range: true,
        });

        if (!isCancelled) {
          setReportOrders(fetchedOrders);
        }
      } catch (err) {
        console.warn('[ReportsPage] Failed to fetch historical orders for report:', err);
        if (!isCancelled) {
          setReportOrders(orders);
        }
      } finally {
        if (!isCancelled) {
          setIsLoadingReport(false);
        }
      }
    };

    fetchReportOrders();

    return () => {
      isCancelled = true;
    };
  }, [dateFilter, startDate, endDate, orders]);

  const [selectedUserId, setSelectedUserId] = useState<string>('all');

  // User filter options for "Pengguna/Kasir"
  interface UserFilterOption {
    id: string; // 'all' | 'unassigned' | user.id
    label: string;
    name: string;
    role?: string;
  }

  const userOptions = useMemo<UserFilterOption[]>(() => {
    const options: UserFilterOption[] = [
      { id: 'all', label: 'Semua pengguna', name: 'Semua pengguna' }
    ];

    const userMap = new Map<string, { name: string; role?: string }>();

    // 1. Known users from usersList
    if (Array.isArray(usersList)) {
      usersList.forEach(u => {
        if (u && u.id) {
          const roleLabel = u.role === 'owner' ? 'Owner' : u.role === 'karyawan' ? 'Karyawan' : u.role;
          userMap.set(u.id, {
            name: u.name,
            role: roleLabel
          });
        }
      });
    }

    // 2. Add currentUser if not in list
    if (currentUser && currentUser.id && !userMap.has(currentUser.id)) {
      const roleLabel = currentUser.role === 'owner' ? 'Owner' : currentUser.role === 'karyawan' ? 'Karyawan' : currentUser.role;
      userMap.set(currentUser.id, {
        name: currentUser.name,
        role: roleLabel
      });
    }

    // 3. Scan historical orders for any users not in current usersList
    const allKnownOrders = [...(orders || []), ...(reportOrders || [])];
    allKnownOrders.forEach(o => {
      if (o.created_by_user_id && o.created_by_user_id.trim() !== '' && !userMap.has(o.created_by_user_id)) {
        const roleLabel = o.created_by_role === 'owner' ? 'Owner' : o.created_by_role === 'karyawan' ? 'Karyawan' : (o.created_by_role || 'Karyawan');
        userMap.set(o.created_by_user_id, {
          name: o.created_by_name || `Pengguna (${o.created_by_user_id.slice(0, 6)})`,
          role: roleLabel
        });
      }
    });

    // Sort known users: Owner first, then alphabetically by name
    const sortedEntries = Array.from(userMap.entries()).sort((a, b) => {
      const isAOwner = a[1].role === 'Owner';
      const isBOwner = b[1].role === 'Owner';
      if (isAOwner && !isBOwner) return -1;
      if (!isAOwner && isBOwner) return 1;
      return a[1].name.localeCompare(b[1].name);
    });

    sortedEntries.forEach(([id, info]) => {
      const roleBadge = info.role ? ` (${info.role})` : '';
      options.push({
        id,
        label: `${info.name}${roleBadge}`,
        name: info.name,
        role: info.role
      });
    });

    // 4. Option for legacy transactions whose creator cannot be reliably identified
    options.push({
      id: 'unassigned',
      label: 'Tidak Diketahui / Sistem',
      name: 'Tidak Diketahui / Sistem',
      role: 'Sistem / Legacy'
    });

    return options;
  }, [usersList, currentUser, orders, reportOrders]);

  const selectedUserOption = useMemo(() => {
    return userOptions.find(o => o.id === selectedUserId) || userOptions[0];
  }, [userOptions, selectedUserId]);

  // Single Source of Truth Report Data
  const reportData = useMemo(() => {
    return computeReportData({
      orders: reportOrders,
      purchases,
      products,
      recipes,
      stocks,
      dateFilter,
      startDate,
      endDate,
      userId: selectedUserId,
      userName: selectedUserOption.id !== 'all' ? selectedUserOption.name : undefined,
      userRole: selectedUserOption.id !== 'all' ? selectedUserOption.role : undefined,
      settings
    });
  }, [reportOrders, purchases, products, recipes, stocks, dateFilter, startDate, endDate, selectedUserId, selectedUserOption, settings]);

  // Export Excel (.xlsx) — On-Demand Dynamic Import
  const handleExportXLSX = async () => {
    if (isExporting) return;
    setIsExporting('excel');
    try {
      const { exportReportToExcel } = await import('../services/excelExport');
      const effectiveStoreName = settings?.store_name?.trim() || 'Booth Daily';
      exportReportToExcel({
        reportData,
        storeName: effectiveStoreName,
        reportSignerName: settings?.report_signer_name,
        reportCity: settings?.report_city,
        filename: `Laporan_Keuangan_${effectiveStoreName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`
      });
      showToast('Laporan Excel (.xlsx) berhasil diunduh', 'success');
    } catch (err) {
      console.error('Export Excel failed:', err);
      showToast('Gagal mengunduh laporan Excel.', 'error');
    } finally {
      setIsExporting(null);
    }
  };

  // Export / Print PDF — On-Demand Dynamic Import
  const handlePrintPDF = async () => {
    if (isExporting) return;
    setIsExporting('pdf');
    try {
      const { exportReportToPDF } = await import('../services/pdfExport');
      const effectiveStoreName = settings?.store_name?.trim() || 'Booth Daily';
      exportReportToPDF({
        reportData,
        storeName: effectiveStoreName,
        storeAddress: settings?.address || 'Coffee Booth POS',
        storePhone: settings?.phone || '-',
        printedBy: currentUser?.name || 'Owner',
        reportSignerName: settings?.report_signer_name,
        reportCity: settings?.report_city,
        filename: `Laporan_Keuangan_${effectiveStoreName.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}`
      });
      showToast('Laporan PDF berhasil dibuat.', 'success');
    } catch (err) {
      console.error('Export PDF failed:', err);
      showToast('Gagal membuat laporan PDF.', 'error');
    } finally {
      setIsExporting(null);
    }
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* HEADER & EXPORT ACTIONS */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-[#C68B59]" />
            Laporan Keuangan & Bisnis
          </h1>
          <p className="text-xs text-stone-500 font-medium">
            Analisis terpadu omzet penjualan, belanja restok, estimasi laba kotor, HPP, arus kas operasional, dan menu terlaris.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            type="button"
            onClick={handlePrintPDF}
            disabled={isExporting !== null}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-2xl bg-stone-100 dark:bg-[#25221F] hover:bg-stone-200 dark:hover:bg-[#2E2A27] text-stone-800 dark:text-stone-200 text-xs font-bold transition-all border border-stone-200 dark:border-stone-800 cursor-pointer shadow-sm disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            <Printer className="w-4 h-4 text-[#C68B59]" />
            {isExporting === 'pdf' ? 'Membuat PDF...' : 'Cetak Laporan PDF'}
          </button>
          <button
            type="button"
            onClick={handleExportXLSX}
            disabled={isExporting !== null}
            className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] text-xs font-extrabold shadow-md transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed w-full sm:w-auto"
          >
            <Download className="w-4 h-4 text-[#D4A373]" />
            {isExporting === 'excel' ? 'Mengunduh...' : 'Export Excel (.xlsx)'}
          </button>
        </div>
      </div>

      {/* FILTER & PERIOD BAR */}
      <div className="bg-white dark:bg-[#1E1C1A] p-4 sm:p-5 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3 w-full min-w-0">
          {/* Preset Buttons */}
          <div className="w-full lg:w-auto max-w-full overflow-x-auto min-w-0 scrollbar-none pb-1 lg:pb-0">
            <div className="inline-flex items-center gap-1.5 text-xs">
              {[
                { id: 'today', label: 'Hari Ini' },
                { id: 'week', label: '7 Hari Terakhir' },
                { id: 'month', label: 'Bulan Ini' },
                { id: 'custom', label: 'Kustom Rentang' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setDateFilter(f.id as DateFilterType)}
                  className={`px-3.5 py-2 rounded-xl text-xs font-extrabold transition-all border cursor-pointer whitespace-nowrap shrink-0 ${dateFilter === f.id
                    ? 'bg-[#3B2A1F] text-[#F7F5F2] border-[#3B2A1F] shadow-sm'
                    : 'bg-stone-50 dark:bg-[#171514] text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:border-stone-300'
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom Date Inputs */}
          {dateFilter === 'custom' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs font-bold w-full lg:w-auto bg-stone-50 dark:bg-[#171514] p-2 rounded-2xl border border-stone-200 dark:border-stone-800">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <span className="text-stone-400 text-[11px] shrink-0 pl-1">Dari:</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full sm:w-auto px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#25221F] border border-stone-300 dark:border-stone-700 font-bold min-w-0 text-xs"
                />
                <span className="text-stone-400 text-[11px] shrink-0">s/d:</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full sm:w-auto px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#25221F] border border-stone-300 dark:border-stone-700 font-bold min-w-0 text-xs"
                />
              </div>
            </div>
          )}

          {/* Active Period Badge */}
          <div className="flex items-center gap-2 text-xs font-bold text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-[#25221F] px-3.5 py-2 rounded-xl shrink-0">
            <Calendar className="w-3.5 h-3.5 text-[#C68B59]" />
            <span>{reportData.periodLabel}</span>
            {isLoadingReport && (
              <span className="text-[10px] text-[#C68B59] font-bold animate-pulse">
                • Memuat data...
              </span>
            )}
          </div>
        </div>

        {/* User / Cashier Filter Row */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2.5 border-t border-stone-100 dark:border-stone-800/80">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <UserIcon className="w-4 h-4 text-[#C68B59] shrink-0" />
            <label htmlFor="user-filter-select" className="text-xs font-bold text-stone-600 dark:text-stone-300 whitespace-nowrap">
              Pengguna/Kasir:
            </label>
            <select
              id="user-filter-select"
              value={selectedUserId}
              onChange={e => setSelectedUserId(e.target.value)}
              className="px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-800 text-xs font-bold text-stone-800 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-[#C68B59] cursor-pointer"
            >
              {userOptions.map(opt => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {selectedUserId !== 'all' && (
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-[#C68B59]/10 text-[#C68B59] border border-[#C68B59]/30 rounded-xl text-xs font-bold">
              <span>Filter Kasir Aktif: <strong>{selectedUserOption.label}</strong></span>
              <button
                type="button"
                onClick={() => setSelectedUserId('all')}
                className="hover:underline text-[11px] font-extrabold cursor-pointer ml-1 text-stone-500 hover:text-stone-800 dark:hover:text-stone-200"
                title="Kembalikan ke semua pengguna"
              >
                (Reset ke Semua)
              </button>
            </div>
          )}
        </div>

        {/* View Focus Tabs */}
        <div className="w-full max-w-full overflow-x-auto min-w-0 scrollbar-none pt-2 border-t border-stone-100 dark:border-stone-800/80">
          <div className="inline-flex items-center gap-2 text-xs">
            <span className="text-stone-400 font-bold text-[11px] mr-1 hidden sm:inline shrink-0">Tampilan:</span>
            {[
              { id: 'all', label: 'Semua (Ringkasan Lengkap)' },
              { id: 'sales', label: 'Analisis Penjualan & Menu' },
              { id: 'purchases', label: 'Pembelian & Restok' },
              { id: 'transactions', label: 'Detail Transaksi Penjualan' },
              { id: 'refunds', label: `Daftar Refund (${reportData.refundCount})` }
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg font-bold transition-colors cursor-pointer whitespace-nowrap text-xs ${activeTab === tab.id
                  ? 'bg-[#C68B59]/15 text-[#C68B59] font-black'
                  : 'text-stone-500 hover:text-stone-800 dark:hover:text-stone-200'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 1: OVERVIEW CARDS (4 KEY FINANCIAL KPIS)        */}
      {/* ======================================================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: TOTAL PENJUALAN */}
        <div className="p-5 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <span className="text-xs font-extrabold text-stone-400 uppercase tracking-wider">TOTAL PENJUALAN</span>
            <div className="p-2 rounded-2xl bg-emerald-500/10 text-emerald-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {formatRupiah(reportData.totalSales)}
          </p>
          <div className="flex items-center justify-between text-[11px] text-stone-500 font-semibold pt-1 border-t border-stone-100 dark:border-stone-800/60">
            <span>{reportData.totalOrdersCount} Transaksi Berhasil</span>
            <span>AOV: {formatRupiah(reportData.avgOrderValue)}</span>
          </div>
        </div>

        {/* Card 2: TOTAL PEMBELIAN RESTOK */}
        <div className="p-5 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <span className="text-xs font-extrabold text-stone-400 uppercase tracking-wider">TOTAL PEMBELIAN</span>
            <div className="p-2 rounded-2xl bg-rose-500/10 text-rose-600">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-rose-600 dark:text-rose-400">
            {formatRupiah(reportData.totalPurchases)}
          </p>
          <div className="flex items-center justify-between text-[11px] text-stone-500 font-semibold pt-1 border-t border-stone-100 dark:border-stone-800/60">
            <span>{reportData.totalPurchasesCount} Nota Belanja Restok</span>
            <span className="text-stone-400 font-medium">Bahan Baku</span>
          </div>
        </div>

        {/* Card 3: ESTIMASI HPP */}
        <div className="p-5 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <span className="text-xs font-extrabold text-stone-400 uppercase tracking-wider">ESTIMASI HPP</span>
            <div className="p-2 rounded-2xl bg-amber-500/10 text-amber-600">
              <Coffee className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-[#3B2A1F] dark:text-[#D4A373]">
            {formatRupiah(reportData.totalEstimatedHPP)}
          </p>
          <div className="pt-1 border-t border-stone-100 dark:border-stone-800/60 flex flex-wrap items-center justify-between gap-1 text-[11px] text-stone-500 font-semibold">
            <span>Estimasi biaya bahan menu terjual</span>
            <div className="flex flex-wrap items-center gap-1">
              {reportData.hppLegacyEstimateOrdersCount > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300">
                  Estimasi Legacy ({reportData.hppLegacyEstimateOrdersCount})
                </span>
              )}
              {reportData.hppPartialSnapshotOrdersCount > 0 && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300">
                  Snapshot Total · Item Estimasi ({reportData.hppPartialSnapshotOrdersCount})
                </span>
              )}
              {(reportData.hppSnapshotOrdersCount > 0 || (!reportData.hasLegacyEstimatedHPP && !reportData.hasPartialSnapshotHPP)) && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  Snapshot Riil ({reportData.hppSnapshotOrdersCount})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Card 4: ESTIMASI LABA KOTOR */}
        <div className="p-5 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2 relative overflow-hidden">
          <div className="flex justify-between items-center">
            <span className="text-xs font-extrabold text-stone-400 uppercase tracking-wider">ESTIMASI LABA KOTOR</span>
            <div className="p-2 rounded-2xl bg-[#C68B59]/10 text-[#C68B59]">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {formatRupiah(reportData.estimatedGrossProfit)}
          </p>
          <p className="text-[11px] text-stone-500 font-semibold pt-1 border-t border-stone-100 dark:border-stone-800/60">
            Margin {reportData.grossProfitMarginPercent}% • Penjualan - HPP
          </p>
        </div>
      </div>

      {/* ======================================================== */}
      {/* SECTION 2: ARUS KAS OPERASIONAL (CASH FLOW SUMMARY)     */}
      {/* ======================================================== */}
      {(activeTab === 'all' || activeTab === 'sales' || activeTab === 'purchases') && (
        <div className="p-5 sm:p-6 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <h3 className="font-extrabold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-[#C68B59]" />
              Arus Kas Operasional Periode Ini
            </h3>
            <span className="text-[11px] font-bold text-stone-400">
              Perbandingan Uang Masuk vs Uang Keluar
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
            <div className="p-4 bg-emerald-500/10 rounded-2xl border border-emerald-500/20 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                <ArrowDownLeft className="w-4 h-4" />
                <span>Uang Masuk (Penjualan)</span>
              </div>
              <p className="text-xl font-black text-emerald-800 dark:text-emerald-300">
                +{formatRupiah(reportData.cashIn)}
              </p>
              <p className="text-[10px] text-emerald-700/80 font-medium">Dari {reportData.totalOrdersCount} transaksi kasir</p>
            </div>

            <div className="p-4 bg-rose-500/10 rounded-2xl border border-rose-500/20 space-y-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-400">
                <ArrowUpRight className="w-4 h-4" />
                <span>Uang Keluar (Belanja & Refund)</span>
              </div>
              <p className="text-xl font-black text-rose-800 dark:text-rose-300">
                -{formatRupiah(reportData.cashOut)}
              </p>
              <div className="space-y-0.5 text-[10px] text-rose-700/90 font-semibold border-t border-rose-500/20 pt-1.5">
                <div className="flex justify-between">
                  <span>Belanja Bahan ({reportData.totalPurchasesCount} Nota):</span>
                  <span>{formatRupiah(reportData.totalPurchases)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Refund Tunai:</span>
                  <span>{formatRupiah(reportData.cashRefunds)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Refund QRIS / Non-Tunai:</span>
                  <span>{formatRupiah(reportData.qrisRefunds)}</span>
                </div>
                {reportData.unknownRefunds > 0 && (
                  <div className="flex justify-between text-stone-500 dark:text-stone-400">
                    <span>Refund Data Lama:</span>
                    <span>{formatRupiah(reportData.unknownRefunds)}</span>
                  </div>
                )}
                <div className="flex justify-between font-black border-t border-rose-500/20 pt-0.5 text-rose-900 dark:text-rose-200">
                  <span>Total Refund ({reportData.refundCount} Transaksi):</span>
                  <span>{formatRupiah(reportData.totalRefunds)}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-[#3B2A1F]/10 dark:bg-[#D4A373]/10 rounded-2xl border border-[#3B2A1F]/20 dark:border-[#D4A373]/20 space-y-1">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#3B2A1F] dark:text-[#D4A373]">
                <BarChart3 className="w-4 h-4" />
                <span>Selisih Arus Kas Periode</span>
              </div>
              <p className={`text-xl font-black ${reportData.netCashFlow >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>
                {reportData.netCashFlow >= 0 ? '+' : ''}{formatRupiah(reportData.netCashFlow)}
              </p>
              <p className="text-[10px] text-stone-500 font-medium">Uang masuk dikurangi belanja bahan & total refund</p>
            </div>
          </div>

          <div className="p-3 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-stone-200 dark:border-stone-800 text-[11px] text-stone-500 font-medium">
            <Info className="w-4 h-4 text-amber-600 shrink-0 inline-block mr-1 align-text-bottom" /> <span className="font-bold text-stone-700 dark:text-stone-300">Catatan Arus Kas:</span> Angka uang masuk, uang keluar, dan selisih arus kas merupakan gabungan operasional kas fisik dan rekening non-tunai (bank/QRIS), bukan saldo fisik laci kasir (rekonsiliasi uang fisik laci kasir dicatat pada modul Shift Kasir). Selisih arus kas belum mencakup beban operasional lain seperti sewa, listrik, atau gaji.
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 3: ANALISIS PENJUALAN & TIPE PESANAN             */}
      {/* ======================================================== */}
      {(activeTab === 'all' || activeTab === 'sales') && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {/* Payment Breakdown */}
          <div className="p-5 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-[#C68B59]" />
              Metode Pembayaran
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="p-3.5 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-stone-200 dark:border-stone-800 flex justify-between items-center">
                <div>
                  <p className="font-extrabold text-stone-800 dark:text-stone-200 text-sm flex items-center gap-2">
                    <Banknote className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Tunai (Cash)</span>
                  </p>
                  <p className="text-stone-400 text-[11px] font-semibold">{reportData.paymentBreakdown.cash.count} Transaksi</p>
                </div>
                <div className="text-right">
                  <span className="font-black text-emerald-600 dark:text-emerald-400 text-sm block">
                    {formatRupiah(reportData.paymentBreakdown.cash.total)}
                  </span>
                  <span className="text-[10px] text-stone-400 font-bold">
                    {reportData.paymentBreakdown.cash.percentage}% Kontribusi
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-stone-200 dark:border-stone-800 flex justify-between items-center">
                <div>
                  <p className="font-extrabold text-stone-800 dark:text-stone-200 text-sm flex items-center gap-2">
                    <QrCode className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>QRIS / E-Wallet</span>
                  </p>
                  <p className="text-stone-400 text-[11px] font-semibold">{reportData.paymentBreakdown.qris.count} Transaksi</p>
                </div>
                <div className="text-right">
                  <span className="font-black text-[#3B2A1F] dark:text-[#D4A373] text-sm block">
                    {formatRupiah(reportData.paymentBreakdown.qris.total)}
                  </span>
                  <span className="text-[10px] text-stone-400 font-bold">
                    {reportData.paymentBreakdown.qris.percentage}% Kontribusi
                  </span>
                </div>
              </div>

              {reportData.paymentBreakdown.other && reportData.paymentBreakdown.other.count > 0 && (
                <div className="p-3.5 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-stone-200 dark:border-stone-800 flex justify-between items-center">
                  <div>
                    <p className="font-extrabold text-stone-800 dark:text-stone-200 text-sm flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-stone-600 dark:text-stone-400 shrink-0" />
                      <span>Metode Lain</span>
                    </p>
                    <p className="text-stone-400 text-[11px] font-semibold">{reportData.paymentBreakdown.other.count} Transaksi</p>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-stone-700 dark:text-stone-300 text-sm block">
                      {formatRupiah(reportData.paymentBreakdown.other.total)}
                    </span>
                    <span className="text-[10px] text-stone-400 font-bold">
                      {reportData.paymentBreakdown.other.percentage}% Kontribusi
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Order Type Breakdown */}
          <div className="p-5 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Layers className="w-4 h-4 text-[#C68B59]" />
              Tipe Pesanan
            </h3>

            <div className="space-y-2.5 text-xs">
              <div className="p-3.5 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-stone-200 dark:border-stone-800 flex justify-between items-center">
                <div>
                  <p className="font-extrabold text-stone-800 dark:text-stone-200 text-sm flex items-center gap-2">
                    <Coffee className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Dine In (Minum di Tempat)</span>
                  </p>
                  <p className="text-stone-400 text-[11px] font-semibold">{reportData.orderTypeBreakdown.dineIn.count} Pesanan</p>
                </div>
                <div className="text-right">
                  <span className="font-black text-[#3B2A1F] dark:text-[#D4A373] text-sm block">
                    {formatRupiah(reportData.orderTypeBreakdown.dineIn.total)}
                  </span>
                  <span className="text-[10px] text-stone-400 font-bold">
                    {reportData.orderTypeBreakdown.dineIn.percentage}% Omzet
                  </span>
                </div>
              </div>

              <div className="p-3.5 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-stone-200 dark:border-stone-800 flex justify-between items-center">
                <div>
                  <p className="font-extrabold text-stone-800 dark:text-stone-200 text-sm flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-blue-600 shrink-0" />
                    <span>Takeaway (Bawa Pulang)</span>
                  </p>
                  <p className="text-stone-400 text-[11px] font-semibold">{reportData.orderTypeBreakdown.takeaway.count} Pesanan</p>
                </div>
                <div className="text-right">
                  <span className="font-black text-[#3B2A1F] dark:text-[#D4A373] text-sm block">
                    {formatRupiah(reportData.orderTypeBreakdown.takeaway.total)}
                  </span>
                  <span className="text-[10px] text-stone-400 font-bold">
                    {reportData.orderTypeBreakdown.takeaway.percentage}% Omzet
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Komponen & Area VIP Breakdown */}
          <div className="p-5 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
            <h3 className="font-extrabold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-amber-600" />
              Komponen & Area VIP
            </h3>

            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-stone-50 dark:bg-[#171514] rounded-xl border border-stone-200 dark:border-stone-800 flex justify-between items-center">
                <span className="text-stone-600 dark:text-stone-300 font-semibold">Total Diskon Terpotong:</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">
                  {formatRupiah(reportData.totalDiscounts)}
                </span>
              </div>
              <div className="p-2.5 bg-stone-50 dark:bg-[#171514] rounded-xl border border-stone-200 dark:border-stone-800 flex justify-between items-center">
                <span className="text-stone-600 dark:text-stone-300 font-semibold">Total Pajak (Snapshot):</span>
                <span className="font-black text-stone-800 dark:text-stone-200">
                  {formatRupiah(reportData.totalTax)}
                </span>
              </div>
              <div className="p-2.5 bg-stone-50 dark:bg-[#171514] rounded-xl border border-stone-200 dark:border-stone-800 flex justify-between items-center">
                <span className="text-stone-600 dark:text-stone-300 font-semibold">Biaya Layanan VIP:</span>
                <span className="font-black text-amber-700 dark:text-amber-400">
                  {formatRupiah(reportData.totalServiceCharge)}
                </span>
              </div>
              <div className="p-2.5 bg-amber-500/10 dark:bg-amber-950/20 rounded-xl border border-amber-300 dark:border-amber-800/60 flex justify-between items-center">
                <div>
                  <span className="font-bold text-amber-900 dark:text-amber-300 block">Ruang VIP ({reportData.vipOrdersCount} Trx)</span>
                  <span className="text-[10px] text-amber-700 dark:text-amber-400">Area VIP</span>
                </div>
                <span className="font-black text-amber-800 dark:text-amber-300">
                  {formatRupiah(reportData.vipSales)}
                </span>
              </div>
              <div className="p-2.5 bg-stone-50 dark:bg-[#171514] rounded-xl border border-stone-200 dark:border-stone-800 flex justify-between items-center">
                <div>
                  <span className="font-bold text-stone-800 dark:text-stone-200 block">Area Umum ({reportData.regularOrdersCount} Trx)</span>
                  <span className="text-[10px] text-stone-400">Reguler</span>
                </div>
                <span className="font-black text-stone-800 dark:text-stone-200">
                  {formatRupiah(reportData.regularSales)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 4: MENU TERLARIS (TOP SELLING PRODUCTS)         */}
      {/* ======================================================== */}
      {(activeTab === 'all' || activeTab === 'sales') && (
        <div className="p-5 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-extrabold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
              <Coffee className="w-4 h-4 text-[#C68B59]" />
              Menu Terlaris (Top Selling Products)
            </h3>
            <span className="text-[11px] font-bold text-stone-400">
              Berdasarkan kuantitas terjual pada periode ini
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[550px]">
              <thead className="bg-stone-50 dark:bg-[#23201D] border-b border-stone-200 dark:border-stone-800 text-stone-500 font-extrabold uppercase tracking-wider">
                <tr>
                  <th className="p-3">Peringkat</th>
                  <th className="p-3">Nama Menu</th>
                  <th className="p-3 text-center">Total Terjual</th>
                  <th className="p-3 text-right">Total Pendapatan Omzet</th>
                  <th className="p-3 text-right">Kontribusi Omzet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-medium">
                {reportData.topProducts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-6 text-center text-stone-400 font-semibold">
                      Belum ada transaksi menu pada periode ini.
                    </td>
                  </tr>
                ) : (
                  reportData.topProducts.slice(0, 10).map((item, idx) => (
                    <tr key={idx} className="hover:bg-stone-50 dark:hover:bg-[#25221F] transition-colors">
                      <td className="p-3 font-black text-stone-400 text-sm">#{idx + 1}</td>
                      <td className="p-3 font-extrabold text-stone-900 dark:text-stone-100 text-sm">{item.name}</td>
                      <td className="p-3 text-center font-black">
                        <span className="px-3 py-1 rounded-full bg-[#C68B59]/10 text-[#C68B59]">
                          {item.qty} Porsi
                        </span>
                      </td>
                      <td className="p-3 text-right font-black text-[#3B2A1F] dark:text-[#D4A373] text-sm">
                        {formatRupiah(item.totalSales)}
                      </td>
                      <td className="p-3 text-right font-bold text-stone-500 text-xs">
                        {item.percentage}%
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 5: PEMBELIAN & RESTOK BAHAN (PURCHASES)          */}
      {/* ======================================================== */}
      {(activeTab === 'all' || activeTab === 'purchases') && (
        <div className="p-5 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="font-extrabold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <ShoppingBag className="w-4 h-4 text-rose-500" />
                Pembelian & Belanja Restok Bahan
              </h3>
              <p className="text-[11px] text-stone-400 font-medium">
                Daftar nota belanja pengeluaran bahan baku selama periode ini
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-stone-500">Total Belanja Periode: </span>
              <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                {formatRupiah(reportData.totalPurchases)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs min-w-[620px]">
              <thead className="bg-stone-50 dark:bg-[#23201D] border-b border-stone-200 dark:border-stone-800 text-stone-500 font-extrabold uppercase tracking-wider">
                <tr>
                  <th className="p-3">No. Nota / PO</th>
                  <th className="p-3">Tanggal Nota</th>
                  <th className="p-3">Supplier / Vendor</th>
                  <th className="p-3">Jumlah Item</th>
                  <th className="p-3">Catatan</th>
                  <th className="p-3 text-right">Total Biaya</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-medium">
                {reportData.filteredPurchases.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-6 text-center text-stone-400 font-semibold">
                      Tidak ada catatan pembelian pada periode ini.
                    </td>
                  </tr>
                ) : (
                  reportData.filteredPurchases.map(p => (
                    <tr key={p.id} className="hover:bg-stone-50 dark:hover:bg-[#25221F] transition-colors">
                      <td className="p-3 font-extrabold text-stone-900 dark:text-stone-100 text-xs">
                        {p.purchase_number}
                      </td>
                      <td className="p-3 text-stone-600 dark:text-stone-300 font-medium">
                        {p.date || formatDate(p.created_at)}
                      </td>
                      <td className="p-3 text-stone-800 dark:text-stone-200 font-bold">
                        {p.supplier}
                      </td>
                      <td className="p-3 text-stone-500">
                        {p.items ? `${p.items.length} Barang` : '-'}
                      </td>
                      <td className="p-3 text-stone-400 text-[11px] truncate max-w-xs">
                        {p.notes || '-'}
                      </td>
                      <td className="p-3 text-right font-black text-rose-600 dark:text-rose-400 text-xs">
                        {formatRupiah(p.total_amount)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {reportData.filteredPurchases.length > 0 && (
                <tfoot className="bg-stone-50 dark:bg-[#23201D] border-t-2 border-stone-200 dark:border-stone-700 font-black text-xs">
                  <tr>
                    <td colSpan={3} className="p-3 text-stone-800 dark:text-stone-200">
                      TOTAL PEMBELIAN PERIODE ({reportData.totalPurchasesCount} NOTA)
                    </td>
                    <td colSpan={2}></td>
                    <td className="p-3 text-right text-rose-600 dark:text-rose-400 text-sm">
                      {formatRupiah(reportData.totalPurchases)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 6: DETAIL TRANSAKSI PENJUALAN                    */}
      {/* ======================================================== */}
      {(activeTab === 'all' || activeTab === 'transactions') && (
        <div className="p-5 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="font-extrabold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#C68B59]" />
                Detail Transaksi Penjualan
              </h3>
              <p className="text-[11px] text-stone-400 font-medium">
                Log lengkap seluruh transaksi pesanan kasir selama periode laporan
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-stone-500">Total Omzet: </span>
              <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                {formatRupiah(reportData.totalSales)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[480px]">
            <table className="w-full text-left text-xs min-w-[950px]">
              <thead className="bg-stone-50 dark:bg-[#23201D] border-b border-stone-200 dark:border-stone-800 text-stone-500 font-extrabold uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-3">No. Pesanan</th>
                  <th className="p-3">Waktu Transaksi</th>
                  <th className="p-3">Kasir</th>
                  <th className="p-3">Tipe</th>
                  <th className="p-3">Area</th>
                  <th className="p-3">Pembayaran</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Subtotal</th>
                  <th className="p-3 text-right">Total Akhir</th>
                  <th className="p-3 text-right">HPP (Rp)</th>
                  <th className="p-3 text-right">Laba Kotor (Rp)</th>
                  <th className="p-3 text-center">Kualitas HPP</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-medium">
                {reportData.transactionDetails.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="p-6 text-center text-stone-400 font-semibold">
                      Belum ada transaksi penjualan pada periode ini.
                    </td>
                  </tr>
                ) : (
                  reportData.transactionDetails.map(d => {
                    const o = d.order;
                    const isRefunded = o.payment?.status === 'refunded';
                    return (
                      <tr
                        key={o.id}
                        onClick={() => openReceiptModal(o)}
                        className={`hover:bg-stone-50 dark:hover:bg-[#25221F] transition-colors cursor-pointer ${
                          isRefunded ? 'bg-rose-50/40 dark:bg-rose-950/15' : ''
                        }`}
                        title="Klik untuk melihat detail struk"
                      >
                        <td className="p-3 font-extrabold text-stone-900 dark:text-stone-100 text-xs">
                          <div>{o.order_number}</div>
                          {isRefunded && o.refund_reason && (
                            <div className="text-[10px] text-rose-500 dark:text-rose-400 font-medium mt-0.5">
                              Alasan: {o.refund_reason}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-stone-600 dark:text-stone-300 font-medium">
                          {formatDate(o.created_at)}
                        </td>
                        <td className="p-3 text-stone-700 dark:text-stone-300 font-semibold">
                          {o.created_by_name || (o.created_by_user_id ? 'Kasir' : 'Tidak Diketahui / Sistem')}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${o.order_type === 'take_away'
                            ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                            : 'bg-blue-500/10 text-blue-700 dark:text-blue-400'
                            }`}>
                            {o.order_type === 'take_away' ? 'Takeaway' : 'Dine In'}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${
                            o.order_area === 'vip' || o.is_vip
                              ? 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-200 dark:border-purple-800'
                              : 'bg-stone-500/10 text-stone-700 dark:text-stone-400'
                          }`}>
                            {o.order_area === 'vip' || o.is_vip ? 'Ruang VIP' : 'Umum'}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-stone-800 dark:text-stone-200">
                          {String(o.payment?.method || 'Cash').toUpperCase()}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${
                            isRefunded
                              ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                              : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                          }`}>
                            {isRefunded ? 'Refunded' : 'Selesai'}
                          </span>
                        </td>
                        <td className="p-3 text-right text-stone-500">
                          {isRefunded ? (
                            <span className="line-through text-stone-400">{formatRupiah(o.subtotal || o.total_amount)}</span>
                          ) : (
                            formatRupiah(o.subtotal || o.total_amount)
                          )}
                        </td>
                        <td className="p-3 text-right font-black text-xs">
                          {isRefunded ? (
                            <div className="flex flex-col items-end">
                              <span className="text-rose-600 dark:text-rose-400 font-black">Rp 0</span>
                              <span className="text-[10px] text-stone-400 line-through">
                                {formatRupiah(o.total_amount)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-[#3B2A1F] dark:text-[#D4A373]">
                              {formatRupiah(o.total_amount)}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-right font-bold text-stone-800 dark:text-stone-200 text-xs">
                          {formatRupiah(d.hpp)}
                        </td>
                        <td className={`p-3 text-right font-black text-xs ${
                          d.grossProfit >= 0
                            ? 'text-emerald-600 dark:text-emerald-400'
                            : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {formatRupiah(d.grossProfit)}
                        </td>
                        <td className="p-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold whitespace-nowrap ${
                            d.hppCategory === 'snapshot_riil'
                              ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                              : d.hppCategory === 'partial_snapshot'
                              ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                              : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                          }`}>
                            {d.hppCategoryLabel}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {reportData.transactionDetails.length > 0 && (
                <tfoot className="bg-stone-50 dark:bg-[#23201D] border-t-2 border-stone-200 dark:border-stone-700 font-black text-xs sticky bottom-0 z-10">
                  <tr>
                    <td colSpan={4} className="p-3 text-stone-800 dark:text-stone-200">
                      TOTAL PERIODE{selectedUserId !== 'all' ? ` — ${selectedUserOption.name}` : ''} ({reportData.totalOrdersCount} TRANSAKSI SELESAI)
                    </td>
                    <td colSpan={3}></td>
                    <td className="p-3 text-right text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatRupiah(reportData.totalSales)}
                    </td>
                    <td className="p-3 text-right text-[#3B2A1F] dark:text-[#D4A373] text-sm">
                      {formatRupiah(reportData.totalEstimatedHPP)}
                    </td>
                    <td className="p-3 text-right text-emerald-600 dark:text-emerald-400 text-sm">
                      {formatRupiah(reportData.estimatedGrossProfit)}
                    </td>
                    <td className="p-3"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 6B: DAFTAR REFUND PERIODE INI                    */}
      {/* ======================================================== */}
      {(activeTab === 'all' || activeTab === 'refunds') && (
        <div className="p-5 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div>
              <h3 className="font-extrabold text-sm text-stone-900 dark:text-stone-100 flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-500" />
                Daftar Refund Periode Ini
              </h3>
              <p className="text-[11px] text-stone-400 font-medium">
                Daftar seluruh pengembalian dana yang dieksekusi selama periode laporan ({reportData.periodLabel})
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs font-bold text-stone-500">Total Pengembalian: </span>
              <span className="text-sm font-black text-rose-600 dark:text-rose-400">
                {formatRupiah(reportData.totalRefunds)}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto max-h-[480px]">
            <table className="w-full text-left text-xs min-w-[750px]">
              <thead className="bg-stone-50 dark:bg-[#23201D] border-b border-stone-200 dark:border-stone-800 text-stone-500 font-extrabold uppercase tracking-wider sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="p-3">No. Nota Asal</th>
                  <th className="p-3">Waktu Transaksi Asal</th>
                  <th className="p-3">Waktu Refund</th>
                  <th className="p-3">Petugas Refund</th>
                  <th className="p-3">Metode Refund</th>
                  <th className="p-3">Alasan Refund</th>
                  <th className="p-3 text-right">Nominal Refund</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-medium">
                {reportData.periodRefundOrders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="p-6 text-center text-stone-400 font-semibold">
                      Tidak ada transaksi refund yang diproses pada periode ini.
                    </td>
                  </tr>
                ) : (
                  reportData.periodRefundOrders.map(o => {
                    const method = o.refund_method;
                    const methodLabel = method === 'cash'
                      ? 'Tunai (Laci)'
                      : method === 'qris'
                      ? 'QRIS / Non-Tunai'
                      : 'Tidak diketahui (data lama)';
                    const methodBadgeClass = method === 'cash'
                      ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                      : method === 'qris'
                      ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300 border border-blue-200 dark:border-blue-800'
                      : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-700';

                    return (
                      <tr
                        key={o.id}
                        onClick={() => openReceiptModal(o)}
                        className="hover:bg-stone-50 dark:hover:bg-[#25221F] transition-colors cursor-pointer bg-rose-50/20 dark:bg-rose-950/10"
                        title="Klik untuk melihat detail struk"
                      >
                        <td className="p-3 font-extrabold text-stone-900 dark:text-stone-100 text-xs">
                          {o.order_number}
                        </td>
                        <td className="p-3 text-stone-600 dark:text-stone-300 font-medium">
                          {formatDate(o.created_at)}
                        </td>
                        <td className="p-3 text-stone-600 dark:text-stone-300 font-medium">
                          {o.refunded_at ? formatDate(o.refunded_at) : '-'}
                        </td>
                        <td className="p-3 text-stone-700 dark:text-stone-300 font-semibold">
                          {o.refunded_by_name || 'Owner'}
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${methodBadgeClass}`}>
                            {methodLabel}
                          </span>
                        </td>
                        <td className="p-3 text-stone-600 dark:text-stone-400">
                          {o.refund_reason || '-'}
                        </td>
                        <td className="p-3 text-right font-black text-rose-600 dark:text-rose-400 text-xs">
                          {formatRupiah(o.total_amount)}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {reportData.periodRefundOrders.length > 0 && (
                <tfoot className="bg-stone-50 dark:bg-[#23201D] border-t-2 border-stone-200 dark:border-stone-700 font-black text-xs sticky bottom-0 z-10">
                  <tr>
                    <td colSpan={3} className="p-3 text-stone-800 dark:text-stone-200">
                      <div>TOTAL REFUND PERIODE ({reportData.refundCount} TRANSAKSI)</div>
                      <div className="text-[10px] text-stone-400 font-medium normal-case mt-0.5">
                        Tunai: {formatRupiah(reportData.cashRefunds)} • Non-Tunai: {formatRupiah(reportData.qrisRefunds)}
                        {reportData.unknownRefunds > 0 ? ` • Data Lama: ${formatRupiah(reportData.unknownRefunds)}` : ''}
                      </div>
                    </td>
                    <td colSpan={3}></td>
                    <td className="p-3 text-right text-rose-600 dark:text-rose-400 text-sm">
                      {formatRupiah(reportData.totalRefunds)}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 7: PERINGATAN STOK MENIPIS (OPERATIONAL SNAPSHOT) */}
      {/* ======================================================== */}
      {reportData.lowStocks.length > 0 && (
        <div className="p-5 bg-rose-500/10 rounded-3xl border border-rose-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-black text-sm">
              <AlertTriangle className="w-5 h-5 shrink-0" />
              <span>Peringatan Stok Bahan Baku Menipis / Habis ({reportData.lowStocks.length} Bahan)</span>
            </div>
            <span className="text-[10px] text-stone-500 font-bold hidden sm:inline">
              * Kondisi stok saat ini, tidak mengikuti periode transaksi.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 text-xs">
            {reportData.lowStocks.map(s => (
              <div key={s.id} className="p-3 bg-white dark:bg-[#1E1C1A] rounded-2xl border border-rose-200 dark:border-rose-900/40 flex justify-between items-center shadow-xs">
                <span className="font-extrabold text-stone-900 dark:text-stone-100">{s.name}</span>
                <span className="font-black text-rose-600 dark:text-rose-400">
                  {s.current_amount} / {s.min_amount} {s.unit}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* SECTION 8: PENGESAHAN LAPORAN FORMAL                    */}
      {/* ======================================================== */}
      <div className="p-5 bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#C68B59]" />
            <h3 className="font-extrabold text-sm text-stone-900 dark:text-stone-100">
              Pengesahan Dokumen Laporan Formal
            </h3>
          </div>
          <p className="text-[11px] text-stone-500 font-medium">
            Nama penandatangan dan kota ini otomatis dicantumkan pada footer berkas ekspor PDF dan lembar ringkasan Excel resmi.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-xs bg-stone-50 dark:bg-[#25221F] p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 w-full md:w-auto">
          <div>
            <span className="text-stone-400 text-[10px] block font-bold uppercase tracking-wider">Kota Penerbitan</span>
            <span className="font-bold text-stone-800 dark:text-stone-200">
              {settings?.report_city?.trim() || <span className="text-stone-400 italic">Belum diatur (tanpa kota)</span>}
            </span>
          </div>
          <div className="w-px h-8 bg-stone-200 dark:bg-stone-700 hidden sm:block" />
          <div>
            <span className="text-stone-400 text-[10px] block font-bold uppercase tracking-wider">Penandatangan Laporan (Owner)</span>
            <span className="font-bold text-stone-800 dark:text-stone-200">
              {settings?.report_signer_name?.trim() || <span className="text-stone-500 font-medium">Owner / Manajemen (Default)</span>}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
