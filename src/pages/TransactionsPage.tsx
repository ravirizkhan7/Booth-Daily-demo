import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { usePOS } from '../hooks/usePOS';
import { Order, PaymentMethod, RefundRequest } from '../types';
import { formatRupiah, formatDate } from '../utils/formatters';
import { orderService } from '../services/orderService';
import { History, Search, Printer, RotateCcw, RefreshCw, TrendingUp, DollarSign, X, ShieldCheck, Clock } from 'lucide-react';
import { refundService } from '../services/refundService';
import { RefundRequestModal } from '../components/transactions/RefundRequestModal';
import { RefundApprovalQueueModal } from '../components/transactions/RefundApprovalQueueModal';
import { RefundDisbursementModal } from '../components/transactions/RefundDisbursementModal';
import { getOrderFinancials, calculateItemUnitHPP } from '../utils/reportUtils';

export const TransactionsPage: React.FC = () => {
  const { orders, currentUser, openReceiptModal, refreshData, showToast, settings, products, recipes, stocks, isShiftActive, activeShift } = usePOS();
  const [search, setSearch] = useState('');
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [refundingOrder, setRefundingOrder] = useState<Order | null>(null);
  const [disbursingData, setDisbursingData] = useState<{ order: Order; request: RefundRequest } | null>(null);
  const [isQueueOpen, setIsQueueOpen] = useState<boolean>(false);
  const [pendingRefundCount, setPendingRefundCount] = useState<number>(0);
  const [refundRequestsMap, setRefundRequestsMap] = useState<Record<string, RefundRequest>>({});

  const updatePendingCount = async () => {
    try {
      const allRequests = await refundService.getRefundRequests();
      const pending = allRequests.filter(r => r.approval_status === 'pending');
      setPendingRefundCount(pending.length);

      const map: Record<string, RefundRequest> = {};
      allRequests.forEach(r => {
        map[String(r.order_id)] = r;
      });
      setRefundRequestsMap(map);
    } catch {
      setPendingRefundCount(0);
      setRefundRequestsMap({});
    }
  };

  useEffect(() => {
    updatePendingCount();
  }, [orders]);
  const [selectedAuditOrder, setSelectedAuditOrder] = useState<Order | null>(null);

  const [dateMode, setDateMode] = useState<'30days' | 'today' | 'custom'>('30days');
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [customEnd, setCustomEnd] = useState<string>(() => new Date().toISOString().slice(0, 10));
  const [customOrders, setCustomOrders] = useState<Order[] | null>(null);
  const [isLoadingHistorical, setIsLoadingHistorical] = useState<boolean>(false);

  const isOwner = currentUser?.role === 'owner';
  const location = useLocation();

  useEffect(() => {
    if (location.state?.openRefundQueue && isOwner) {
      setIsQueueOpen(true);
      window.history.replaceState({}, document.title);
    }
  }, [location.state, isOwner]);

  const handleFetchHistorical = async () => {
    if (!customStart || !customEnd) return;
    setIsLoadingHistorical(true);
    try {
      const res = await orderService.getOrders({
        start_date: customStart,
        end_date: customEnd,
      });
      setCustomOrders(res);
    } catch (err) {
      console.warn('[TransactionsPage] Failed to fetch custom range orders:', err);
    } finally {
      setIsLoadingHistorical(false);
    }
  };

  const activeDataset = dateMode === 'custom' && customOrders !== null ? customOrders : orders;

  // Filter orders
  const displayOrders = activeDataset.filter(o => {
    if (dateMode === 'today') {
      const todayStr = new Date().toISOString().slice(0, 10);
      if (!o.created_at.startsWith(todayStr)) {
        const orderDate = new Date(o.created_at);
        const now = new Date();
        if (
          orderDate.getFullYear() !== now.getFullYear() ||
          orderDate.getMonth() !== now.getMonth() ||
          orderDate.getDate() !== now.getDate()
        ) {
          return false;
        }
      }
    }

    // If karyawan, show my transactions or approved refunds needing disbursement
    const req = refundRequestsMap[String(o.id)];
    const isApprovedNotDisbursed = req?.approval_status === 'approved' && req?.disbursement_status === 'not_disbursed';
    const matchesUser = isOwner
      ? true
      : o.created_by_user_id === currentUser?.id || isApprovedNotDisbursed;
    const matchesSearch = o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      Boolean(o.created_by_name?.toLowerCase().includes(search.toLowerCase())) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(search.toLowerCase()));
    const matchesMethod = filterMethod === 'all' || o.payment?.method === filterMethod;

    return matchesUser && matchesSearch && matchesMethod;
  });

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <History className="w-6 h-6 text-[#C68B59]" />
            Riwayat Transaksi POS
          </h1>
          <p className="text-xs text-stone-500">
            {isOwner
              ? `Daftar semua transaksi yang tercatat di ${settings?.store_name?.trim() || 'Booth Daily'}.`
              : 'Daftar transaksi yang Anda proses hari ini.'}
          </p>
        </div>

        {isOwner && (
          <button
            onClick={() => setIsQueueOpen(true)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#C68B59] hover:bg-[#A97444] text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer relative"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Antrean Refund</span>
            {pendingRefundCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black animate-pulse">
                {pendingRefundCount}
              </span>
            )}
          </button>
        )}
      </div>

      {isOwner && pendingRefundCount > 0 && (
        <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-3xl p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-amber-500 text-white">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-amber-900 dark:text-amber-200">
                Terdapat {pendingRefundCount} Pengajuan Refund Menunggu Persetujuan
              </h4>
              <p className="text-[11px] text-amber-700 dark:text-amber-400">
                Periksa bukti foto keluhan dan alasan kasir untuk memberikan keputusan.
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsQueueOpen(true)}
            className="px-4 py-2 rounded-2xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] text-xs font-bold shrink-0 transition-colors cursor-pointer"
          >
            Buka Antrean
          </button>
        </div>
      )}

      {/* Filter controls */}
      <div className="bg-white dark:bg-[#1E1C1A] p-4 sm:p-5 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari no. transaksi, kasir, atau pelanggan..."
              className="w-full pl-10 pr-4 py-2 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-700 text-xs font-semibold focus:outline-none"
            />
          </div>

          <select
            value={filterMethod}
            onChange={e => setFilterMethod(e.target.value)}
            className="px-4 py-2 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-700 text-xs font-bold cursor-pointer"
          >
            <option value="all">Semua Metode Bayar</option>
            <option value="cash">Cash (Tunai)</option>
            <option value="qris">QRIS</option>
          </select>
        </div>

        {/* Date Filter Segment */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 pt-2 border-t border-stone-100 dark:border-stone-800/80 w-full min-w-0">
          <div className="w-full md:w-auto max-w-full overflow-x-auto min-w-0 scrollbar-none pb-1 md:pb-0">
            <div className="inline-flex items-center gap-1.5 text-xs">
              <span className="text-stone-400 font-bold text-[11px] mr-1 shrink-0">Periode:</span>
              {[
                { id: '30days', label: '30 Hari Terakhir (Default)' },
                { id: 'today', label: 'Hari Ini' },
                { id: 'custom', label: 'Kustom Rentang' },
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setDateMode(tab.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-bold transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                    dateMode === tab.id
                      ? 'bg-[#3B2A1F] text-[#F7F5F2] shadow-sm'
                      : 'bg-stone-50 dark:bg-[#171514] text-stone-600 dark:text-stone-400 border border-stone-200 dark:border-stone-800 hover:border-stone-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {dateMode === 'custom' && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 text-xs font-bold bg-stone-50 dark:bg-[#171514] p-2 rounded-2xl border border-stone-200 dark:border-stone-800 w-full md:w-auto">
              <div className="flex items-center gap-1.5 flex-1 min-w-0">
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="w-full sm:w-auto px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#25221F] border border-stone-300 dark:border-stone-700 font-bold min-w-0 text-xs"
                />
                <span className="text-stone-400 shrink-0 text-xs font-medium">s/d</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="w-full sm:w-auto px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#25221F] border border-stone-300 dark:border-stone-700 font-bold min-w-0 text-xs"
                />
              </div>
              <button
                type="button"
                onClick={handleFetchHistorical}
                disabled={isLoadingHistorical}
                className="px-3.5 py-1.5 bg-[#3B2A1F] text-[#F7F5F2] rounded-lg font-bold hover:bg-[#2A1E16] cursor-pointer flex items-center justify-center gap-1 shrink-0 disabled:opacity-50"
              >
                {isLoadingHistorical ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Terapkan'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Transactions List */}
      <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm">
        {/* Desktop Table: scrollable with sticky header */}
        <div className="hidden md:block overflow-x-auto max-h-[420px] overflow-y-auto">
          <table className="w-full text-left text-xs min-w-[720px]">
            <thead className="sticky top-0 z-10 bg-stone-50 dark:bg-[#23201D] border-b border-stone-200 dark:border-stone-800 text-stone-500 font-bold uppercase">
              <tr>
                <th className="p-4">No. Transaksi</th>
                <th className="p-4">Waktu</th>
                <th className="p-4">Kasir</th>
                <th className="p-4">Pelanggan / Tipe</th>
                <th className="p-4">Metode Bayar</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Total Jual</th>
                {isOwner && <th className="p-4 text-right">HPP & Margin</th>}
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium">
              {displayOrders.length === 0 ? (
                <tr>
                  <td colSpan={isOwner ? 9 : 8} className="p-8 text-center text-stone-400 font-semibold">
                    Tidak ada transaksi ditemukan.
                  </td>
                </tr>
              ) : (
                displayOrders.map(ord => {
                const isRefunded = ord.payment?.status === 'refunded';
                const refundReq = refundRequestsMap[String(ord.id)];
                const isApprovedNotDisbursed = refundReq?.approval_status === 'approved' && refundReq?.disbursement_status === 'not_disbursed';
                const isPendingApproval = refundReq?.approval_status === 'pending' || (!refundReq && ord.refund_pending);
                return (
                  <tr
                    key={ord.id}
                    onClick={() => openReceiptModal(ord)}
                    className="hover:bg-stone-50/50 dark:hover:bg-[#25221F] transition-colors cursor-pointer"
                  >
                    <td className="p-4 font-black text-stone-900 dark:text-stone-100 text-sm">
                      {ord.order_number}
                    </td>
                    <td className="p-4 text-stone-500">{formatDate(ord.created_at)}</td>
                    <td className="p-4 text-stone-800 dark:text-stone-200 font-semibold">{ord.created_by_name}</td>
                    <td className="p-4">
                      <span className="font-bold text-stone-900 dark:text-stone-100 block">
                        {ord.customer_name || '-'}
                      </span>
                      <span className="text-[10px] text-[#C68B59] uppercase font-bold">
                        {ord.order_type === 'dine_in' ? 'Dine In' : 'Take Away'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700">
                        {ord.payment?.method || '-'}
                      </span>
                    </td>
                    <td className="p-4">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                        isRefunded
                          ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                          : isApprovedNotDisbursed
                          ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                          : isPendingApproval
                          ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                          : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      }`}>
                        {isRefunded
                          ? 'Refunded'
                          : isApprovedNotDisbursed
                          ? 'Disetujui Owner'
                          : isPendingApproval
                          ? 'Menunggu Approval'
                          : 'Selesai'}
                      </span>
                    </td>
                    <td className="p-4 text-right font-black text-[#3B2A1F] dark:text-[#D4A373] text-sm">
                      {formatRupiah(ord.total_amount)}
                    </td>
                    {isOwner && (() => {
                      const fin = getOrderFinancials(ord, products, recipes, stocks);
                      return (
                        <td
                          className="p-4 text-right cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedAuditOrder(ord);
                          }}
                          title="Klik untuk melihat rincian audit HPP transaksi"
                        >
                          <div className="font-black text-stone-900 dark:text-stone-100">
                            {formatRupiah(fin.hpp)}
                          </div>
                          <div className={`text-[11px] font-bold ${
                            fin.grossProfit >= 0
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-rose-600 dark:text-rose-400'
                          }`}>
                            {fin.omzet > 0 ? `${fin.marginPercent}%` : (fin.grossProfit < 0 ? 'Rugi Bahan' : '0%')} ({formatRupiah(fin.grossProfit)})
                          </div>
                          <span className={`inline-block mt-0.5 px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase ${
                            fin.hppCategory === 'snapshot_riil'
                              ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                              : fin.hppCategory === 'partial_snapshot'
                              ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                              : 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                          }`}>
                            {fin.hppCategoryLabel}
                          </span>
                        </td>
                      );
                    })()}
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
                        {isOwner && (
                          <button
                            onClick={() => setSelectedAuditOrder(ord)}
                            className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 transition-colors cursor-pointer"
                            title="Audit HPP & Margin Transaksi"
                          >
                            <TrendingUp className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => openReceiptModal(ord)}
                          className="p-2 rounded-xl bg-amber-500/10 text-[#C68B59] hover:bg-amber-500/20 transition-colors cursor-pointer"
                          title="Cetak Struk"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {!isOwner && isApprovedNotDisbursed ? (
                          <button
                            onClick={() => {
                              if (!isShiftActive) {
                                showToast('Shift kasir aktif diperlukan untuk mencatat penyerahan uang refund.', 'error');
                                return;
                              }
                              setDisbursingData({ order: ord, request: refundReq });
                            }}
                            disabled={!isShiftActive}
                            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 min-h-[44px] cursor-pointer ${
                              isShiftActive
                                ? 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm hover:shadow active:scale-95'
                                : 'bg-stone-200 dark:bg-stone-800 text-stone-400 dark:text-stone-500 cursor-not-allowed opacity-70'
                            }`}
                            title={
                              !isShiftActive
                                ? 'Buka shift kasir terlebih dahulu untuk mencairkan refund'
                                : 'Serahkan uang refund ke pelanggan (Disetujui Owner)'
                            }
                          >
                            <DollarSign className="w-4 h-4 text-white" />
                            <span>Serahkan Uang</span>
                          </button>
                        ) : isPendingApproval ? (
                          <button
                            disabled
                            className="p-2 rounded-xl bg-amber-500/10 text-amber-600 cursor-not-allowed opacity-80 min-h-[44px] min-w-[44px] flex items-center justify-center"
                            title="Pengajuan refund sedang menunggu persetujuan Owner"
                          >
                            <Clock className="w-4 h-4" />
                          </button>
                        ) : !isRefunded ? (
                          <button
                            onClick={() => setRefundingOrder(ord)}
                            className="p-2 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition-colors cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                            title="Ajukan Refund Transaksi"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>

        {/* Mobile Touch Cards */}
        <div className="md:hidden divide-y divide-stone-100 dark:divide-stone-800/60">
          {displayOrders.length === 0 ? (
            <div className="p-8 text-center text-stone-400 font-semibold text-xs">
              Tidak ada transaksi ditemukan.
            </div>
          ) : (
            displayOrders.map(ord => {
              const isRefunded = ord.payment?.status === 'refunded';
              const refundReq = refundRequestsMap[String(ord.id)];
              const isApprovedNotDisbursed = refundReq?.approval_status === 'approved' && refundReq?.disbursement_status === 'not_disbursed';
              const isPendingApproval = refundReq?.approval_status === 'pending' || (!refundReq && ord.refund_pending);
              const fin = isOwner ? getOrderFinancials(ord, products, recipes, stocks) : null;

              return (
                <div
                  key={`mobile-order-${ord.id}`}
                  onClick={() => openReceiptModal(ord)}
                  className="p-4 space-y-3 hover:bg-stone-50/50 dark:hover:bg-[#25221F] transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-black text-stone-900 dark:text-stone-100 text-sm">
                        {ord.order_number}
                      </span>
                      <p className="text-[11px] text-stone-400 font-medium">
                        {formatDate(ord.created_at)} • Kasir: <span className="font-semibold text-stone-700 dark:text-stone-300">{ord.created_by_name}</span>
                      </p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase shrink-0 ${
                      isRefunded
                        ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                        : isApprovedNotDisbursed
                        ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                        : isPendingApproval
                        ? 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                        : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    }`}>
                      {isRefunded
                        ? 'Refunded'
                        : isApprovedNotDisbursed
                        ? 'Disetujui Owner'
                        : isPendingApproval
                        ? 'Menunggu Approval'
                        : 'Selesai'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-stone-800 dark:text-stone-200">
                        {ord.customer_name || 'Pelanggan Walk-in'}
                      </span>
                      <span className="px-2 py-0.5 rounded-lg text-[10px] bg-amber-50 dark:bg-amber-950/30 text-[#C68B59] font-bold border border-amber-200/50 dark:border-amber-800/50 uppercase">
                        {ord.order_type === 'dine_in' ? 'Dine In' : 'Take Away'}
                      </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase bg-stone-100 dark:bg-stone-800 text-stone-800 dark:text-stone-200 border border-stone-200 dark:border-stone-700">
                      {ord.payment?.method || '-'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between pt-1">
                    <div>
                      <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Total Transaksi</p>
                      <p className="font-black text-[#3B2A1F] dark:text-[#D4A373] text-sm">
                        {formatRupiah(ord.total_amount)}
                      </p>
                    </div>
                    {isOwner && fin && (
                      <div
                        className="text-right"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedAuditOrder(ord);
                        }}
                      >
                        <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">HPP / Margin</p>
                        <p className="text-xs font-black text-stone-800 dark:text-stone-200">
                          {formatRupiah(fin.hpp)}{' '}
                          <span className={`text-[11px] ${fin.grossProfit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                            ({fin.omzet > 0 ? `${fin.marginPercent}%` : '0%'})
                          </span>
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-stone-100 dark:border-stone-800/60 flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      onClick={() => openReceiptModal(ord)}
                      className="min-h-[44px] px-3 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                      title="Cetak Struk"
                      aria-label={`Cetak struk ${ord.order_number}`}
                    >
                      <Printer className="w-4 h-4 text-[#C68B59]" />
                      Struk
                    </button>
                    {isOwner && (
                      <button
                        type="button"
                        onClick={() => setSelectedAuditOrder(ord)}
                        className="min-h-[44px] px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-400 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Audit HPP & Margin"
                        aria-label={`Audit HPP order ${ord.order_number}`}
                      >
                        <TrendingUp className="w-4 h-4" />
                        Audit HPP
                      </button>
                    )}
                    {!isOwner && isApprovedNotDisbursed ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!isShiftActive) {
                            showToast('Shift kasir aktif diperlukan untuk mencatat penyerahan uang refund.', 'error');
                            return;
                          }
                          setDisbursingData({ order: ord, request: refundReq });
                        }}
                        disabled={!isShiftActive}
                        className={`min-h-[44px] px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                          isShiftActive
                            ? 'bg-blue-600 hover:bg-blue-700 text-white'
                            : 'bg-stone-200 dark:bg-stone-800 text-stone-400 cursor-not-allowed opacity-70'
                        }`}
                        title="Serahkan uang refund ke pelanggan"
                      >
                        <DollarSign className="w-4 h-4 text-white" />
                        Serahkan Uang
                      </button>
                    ) : isPendingApproval ? (
                      <button
                        type="button"
                        disabled
                        className="min-h-[44px] px-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 font-bold text-xs cursor-not-allowed opacity-80 flex items-center justify-center gap-1.5"
                        title="Menunggu approval"
                      >
                        <Clock className="w-4 h-4" />
                        Menunggu
                      </button>
                    ) : !isRefunded ? (
                      <button
                        type="button"
                        onClick={() => setRefundingOrder(ord)}
                        className="min-h-[44px] px-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 text-rose-600 dark:text-rose-400 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                        title="Ajukan Refund"
                        aria-label={`Ajukan refund ${ord.order_number}`}
                      >
                        <RotateCcw className="w-4 h-4" />
                        Refund
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Modal Pengajuan Refund (Kasir & Owner) */}
      <RefundRequestModal
        isOpen={!!refundingOrder}
        order={refundingOrder}
        currentUser={currentUser as any}
        onClose={() => setRefundingOrder(null)}
        onSuccess={() => {
          refreshData?.();
          updatePendingCount();
        }}
        showToast={showToast}
      />

      {/* Modal Antrean Persetujuan Refund (Khusus Owner) */}
      <RefundApprovalQueueModal
        isOpen={isQueueOpen}
        onClose={() => setIsQueueOpen(false)}
        onSuccess={() => {
          refreshData?.();
          updatePendingCount();
        }}
        showToast={showToast}
      />

      {/* Modal Penyerahan Uang Refund Kasir */}
      <RefundDisbursementModal
        isOpen={!!disbursingData}
        order={disbursingData?.order || null}
        refundRequest={disbursingData?.request || null}
        currentUser={currentUser as any}
        activeShift={activeShift}
        isShiftActive={isShiftActive}
        onClose={() => setDisbursingData(null)}
        onSuccess={() => {
          refreshData?.();
          updatePendingCount();
        }}
        showToast={showToast}
      />

      {/* Modal Audit HPP Transaksi Khusus Owner */}
      {isOwner && selectedAuditOrder && (() => {
        const fin = getOrderFinancials(selectedAuditOrder, products, recipes, stocks);
        const isRefunded = selectedAuditOrder.payment?.status === 'refunded';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="relative w-full max-w-2xl bg-white dark:bg-[#1E1C1A] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[90vh]">
              {/* Header */}
              <div className="px-6 py-4 bg-[#3B2A1F] text-white flex justify-between items-center shrink-0">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-amber-500/20 text-[#D4A373]">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-base leading-tight">
                      Audit Biaya & HPP Transaksi
                    </h3>
                    <p className="text-xs text-stone-300">
                      {selectedAuditOrder.order_number} • {formatDate(selectedAuditOrder.created_at)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedAuditOrder(null)}
                  className="p-1.5 rounded-full hover:bg-white/20 transition-colors cursor-pointer text-white"
                  title="Tutup"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Body */}
              <div className="p-6 overflow-y-auto space-y-5 flex-1">
                {/* Status & Category Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 rounded-2xl bg-stone-50 dark:bg-[#25221F] border border-stone-200 dark:border-stone-800 text-xs font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="text-stone-500">Kasir:</span>
                    <span className="font-bold text-stone-800 dark:text-stone-200">{selectedAuditOrder.created_by_name}</span>
                    <span className="text-stone-400">•</span>
                    <span className="text-stone-500">Metode:</span>
                    <span className="font-bold uppercase text-stone-800 dark:text-stone-200">{selectedAuditOrder.payment?.method || 'Cash'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase ${
                      isRefunded
                        ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
                        : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                    }`}>
                      {isRefunded ? 'Refunded' : 'Selesai'}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-extrabold ${
                      fin.hppCategory === 'snapshot_riil'
                        ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                        : fin.hppCategory === 'partial_snapshot'
                        ? 'bg-blue-100 dark:bg-blue-950/50 text-blue-700 dark:text-blue-400 border border-blue-200 dark:border-blue-800'
                        : 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
                    }`}>
                      {fin.hppCategoryLabel}
                    </span>
                  </div>
                </div>

                {/* 4 Summary Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#25221F] border border-stone-200 dark:border-stone-800 space-y-1">
                    <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">BASIS OMZET</span>
                    <p className="text-base font-black text-stone-900 dark:text-stone-100">
                      {formatRupiah(fin.omzet)}
                    </p>
                    <span className="text-[10px] text-stone-400 block truncate">
                      {isRefunded ? 'Rp 0 (Status Refunded)' : 'Omzet Penjualan'}
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#25221F] border border-stone-200 dark:border-stone-800 space-y-1">
                    <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">TOTAL HPP</span>
                    <p className="text-base font-black text-[#3B2A1F] dark:text-[#D4A373]">
                      {formatRupiah(fin.hpp)}
                    </p>
                    <span className="text-[10px] text-stone-400 block truncate">
                      Biaya Modal Bahan
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#25221F] border border-stone-200 dark:border-stone-800 space-y-1">
                    <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">LABA KOTOR</span>
                    <p className={`text-base font-black ${
                      fin.grossProfit >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {formatRupiah(fin.grossProfit)}
                    </p>
                    <span className="text-[10px] text-stone-400 block truncate">
                      Omzet - HPP
                    </span>
                  </div>

                  <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#25221F] border border-stone-200 dark:border-stone-800 space-y-1">
                    <span className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider block">MARGIN LABA</span>
                    <p className={`text-base font-black ${
                      fin.grossProfit >= 0
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'text-rose-600 dark:text-rose-400'
                    }`}>
                      {fin.omzet > 0 ? `${fin.marginPercent}%` : (fin.grossProfit < 0 ? 'Rugi Bahan' : '0%')}
                    </p>
                    <span className="text-[10px] text-stone-400 block truncate">
                      Laba / Omzet × 100
                    </span>
                  </div>
                </div>

                {/* Items Table */}
                <div className="space-y-2">
                  <h4 className="text-xs font-black uppercase text-stone-400 tracking-wider">
                    Rincian HPP Item Pesanan
                  </h4>
                  <div className="border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-stone-50 dark:bg-[#25221F] border-b border-stone-200 dark:border-stone-800 text-stone-500 font-bold uppercase text-[10px]">
                        <tr>
                          <th className="p-3">Menu / Item</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3 text-right">Harga Jual</th>
                          <th className="p-3 text-right">HPP Satuan</th>
                          <th className="p-3 text-right">Subtotal HPP</th>
                          <th className="p-3 text-center">Kualitas Data</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-stone-800 font-medium">
                        {(selectedAuditOrder.items || []).map((it, idx) => {
                          const unitCost = typeof it.unit_cost_price === 'number'
                            ? it.unit_cost_price
                            : calculateItemUnitHPP(it.product_id, it.price, products, recipes, stocks).unitCost;
                          const subtotalCost = typeof it.subtotal_cost === 'number'
                            ? it.subtotal_cost
                            : unitCost * (Number(it.qty) || 1);
                          const isSnapshot = typeof it.unit_cost_price === 'number' && !it.is_estimated_cost;

                          return (
                            <tr key={it.id || idx} className="hover:bg-stone-50/50 dark:hover:bg-[#25221F]/50">
                              <td className="p-3">
                                <span className="font-bold text-stone-900 dark:text-stone-100 block">{it.product_name}</span>
                                {it.notes && <span className="text-[10px] text-stone-400">Catatan: {it.notes}</span>}
                              </td>
                              <td className="p-3 text-center font-bold text-stone-700 dark:text-stone-300">
                                {it.qty}
                              </td>
                              <td className="p-3 text-right text-stone-600 dark:text-stone-300">
                                {formatRupiah(it.price)}
                              </td>
                              <td className="p-3 text-right font-semibold text-stone-800 dark:text-stone-200">
                                {formatRupiah(unitCost)}
                              </td>
                              <td className="p-3 text-right font-black text-[#3B2A1F] dark:text-[#D4A373]">
                                {formatRupiah(subtotalCost)}
                              </td>
                              <td className="p-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                  isSnapshot
                                    ? 'bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300'
                                    : it.is_estimated_cost
                                    ? 'bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300'
                                    : 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300'
                                }`}>
                                  {isSnapshot ? 'Snapshot Riil' : (it.is_estimated_cost ? 'Estimasi Menu' : 'Estimasi Legacy')}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Accounting Note Alert */}
                {isRefunded && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-xs text-rose-800 dark:text-rose-300 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <RotateCcw className="w-4 h-4 shrink-0 text-rose-600" />
                      Kebijakan Akuntansi Refund F&B:
                    </p>
                    <p className="text-[11px] text-rose-700 dark:text-rose-400 leading-relaxed">
                      Pesanan ini berstatus Refund. Omzet diakui Rp 0, namun biaya bahan baku yang telah diseduh/digunakan tetap tercatat sebagai HPP, menghasilkan laba kotor negatif sesuai modal bahan terpakai.
                    </p>
                  </div>
                )}
                {fin.hppCategory === 'legacy_estimate' && (
                  <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                    <p className="font-bold flex items-center gap-1.5">
                      <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600" />
                      Data Transaksi Legacy:
                    </p>
                    <p className="text-[11px] text-amber-700 dark:text-amber-400 leading-relaxed">
                      Transaksi dibuat sebelum implementasi HPP Phase 3. Nilai HPP dihitung menggunakan Single Source of Truth berdasarkan resep/modal master produk terkini.
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="p-4 bg-stone-50 dark:bg-[#25221F] border-t border-stone-200 dark:border-stone-800 flex justify-between items-center shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    openReceiptModal(selectedAuditOrder);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-500/10 text-[#C68B59] hover:bg-amber-500/20 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-4 h-4" />
                  Lihat Struk Kasir
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedAuditOrder(null)}
                  className="px-5 py-2 bg-[#3B2A1F] text-white hover:bg-[#2A1E16] font-bold text-xs rounded-xl cursor-pointer"
                >
                  Tutup Audit
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
