import React, { useState, useEffect } from 'react';
import { usePOS } from '../hooks/usePOS';
import { Order } from '../types';
import { formatRupiah, formatDate } from '../utils/formatters';
import { orderService } from '../services/orderService';
import { History, Search, Filter, Printer, RotateCcw, Calendar, RefreshCw } from 'lucide-react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export const TransactionsPage: React.FC = () => {
  const { orders, currentUser, openReceiptModal, refundOrder } = usePOS();
  const [search, setSearch] = useState('');
  const [filterMethod, setFilterMethod] = useState<string>('all');
  const [refundingOrder, setRefundingOrder] = useState<Order | null>(null);
  const [isRefunding, setIsRefunding] = useState<boolean>(false);

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

    // If karyawan, show my transactions or today's
    const matchesUser = isOwner ? true : o.created_by_user_id === currentUser?.id;
    const matchesSearch = o.order_number.toLowerCase().includes(search.toLowerCase()) ||
      o.created_by_name.toLowerCase().includes(search.toLowerCase()) ||
      (o.customer_name && o.customer_name.toLowerCase().includes(search.toLowerCase()));
    const matchesMethod = filterMethod === 'all' || o.payment?.method === filterMethod;

    return matchesUser && matchesSearch && matchesMethod;
  });

  const handleConfirmRefund = async () => {
    if (!refundingOrder || isRefunding) return;
    setIsRefunding(true);
    try {
      await refundOrder(refundingOrder.id);
    } finally {
      setIsRefunding(false);
      setRefundingOrder(null);
    }
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <History className="w-6 h-6 text-[#C68B59]" />
            Riwayat Transaksi POS
          </h1>
          <p className="text-xs text-stone-500">
            {isOwner ? 'Daftar semua transaksi yang tercatat di Booth Daily.' : 'Daftar transaksi yang Anda proses hari ini.'}
          </p>
        </div>
      </div>

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
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[720px]">
            <thead className="bg-stone-50 dark:bg-[#23201D] border-b border-stone-200 dark:border-stone-800 text-stone-500 font-bold uppercase">
              <tr>
                <th className="p-4">No. Transaksi</th>
                <th className="p-4">Waktu</th>
                <th className="p-4">Kasir</th>
                <th className="p-4">Pelanggan / Tipe</th>
                <th className="p-4">Metode Bayar</th>
                <th className="p-4">Status</th>
                <th className="p-4 text-right">Total</th>
                <th className="p-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium">
              {displayOrders.map(ord => {
                const isRefunded = ord.payment?.status === 'refunded';
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
                          : 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800'
                      }`}>
                        {isRefunded ? 'Refunded' : 'Selesai'}
                      </span>
                    </td>
                    <td className="p-4 text-right font-black text-[#3B2A1F] dark:text-[#D4A373] text-sm">
                      {formatRupiah(ord.total_amount)}
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5" onClick={e => e.stopPropagation()}>
                        <button
                          onClick={() => openReceiptModal(ord)}
                          className="p-2 rounded-xl bg-amber-500/10 text-[#C68B59] hover:bg-amber-500/20 transition-colors cursor-pointer"
                          title="Cetak Struk"
                        >
                          <Printer className="w-4 h-4" />
                        </button>
                        {isOwner && !isRefunded && (
                          <button
                            onClick={() => setRefundingOrder(ord)}
                            className="p-2 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition-colors cursor-pointer"
                            title="Refund Transaksi"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Confirmation Dialog for Refund */}
      <ConfirmDialog
        isOpen={!!refundingOrder}
        title="Konfirmasi Refund Transaksi"
        message={`Apakah Anda yakin ingin merefund transaksi ${refundingOrder?.order_number}? Pembayaran akan ditandai sebagai refunded dan stok bahan baku akan dikembalikan otomatis.`}
        confirmText="Ya, Refund Transaksi"
        cancelText="Batal"
        isDanger={true}
        isLoading={isRefunding}
        onConfirm={handleConfirmRefund}
        onCancel={() => {
          if (!isRefunding) setRefundingOrder(null);
        }}
      />
    </div>
  );
};
