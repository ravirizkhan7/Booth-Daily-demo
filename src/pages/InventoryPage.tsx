import React, { useState } from 'react';
import { NumberInput } from '../components/common/NumberInput';
import { usePOS } from '../hooks/usePOS';
import { Stock, StockHistory } from '../types';
import { formatRupiah } from '../utils/formatters';
import {
  Boxes, History, Plus, Search, Edit2, Trash2,
  RotateCcw, SlidersHorizontal, AlertTriangle, CheckCircle2, XCircle, X,
  PackageCheck, Eye, ShoppingCart, Pencil, User
} from 'lucide-react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

const UNIT_OPTIONS = ['Gram', 'Kg', 'ml', 'Liter', 'Botol', 'Kaleng', 'Bungkus', 'Pcs', 'Cup', 'Sachet'];

// Safe date formatter to prevent blank page crashing if date string is invalid or missing
function formatSafeDate(dateString?: string): string {
  if (!dateString) return '-';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '-';
    return new Intl.DateTimeFormat('id-ID', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch (err) {
    return dateString;
  }
}

export const InventoryPage: React.FC = () => {
  const {
    stocks,
    stockHistories,
    currentUser,
    addStockItem,
    editStockItem,
    removeStockItem,
    adjustStockQuantity
  } = usePOS();

  const isOwner = currentUser?.role === 'owner';

  const [activeSubmenu, setActiveSubmenu] = useState<'materials' | 'history'>('materials');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'AMAN' | 'MENIPIS' | 'HABIS'>('ALL');

  // Modals state
  const [isStockModalOpen, setIsStockModalOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<Stock | null>(null);
  const [deletingStock, setDeletingStock] = useState<Stock | null>(null);

  // Update Stok Modal State
  const [isUpdateStokOpen, setIsUpdateStokOpen] = useState(false);
  const [selectedStockForUpdate, setSelectedStockForUpdate] = useState<Stock | null>(null);
  const [updateType, setUpdateType] = useState<'add' | 'subtract'>('add');
  const [updateAmount, setUpdateAmount] = useState<number>(100);
  const [updateReason, setUpdateReason] = useState<string>('Hasil Stock Opname Fisik');
  const [updateNotes, setUpdateNotes] = useState<string>('');

  // Detail History Modal
  const [selectedHistory, setSelectedHistory] = useState<StockHistory | null>(null);

  // History Filter
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('ALL');

  // Form State for Master Stock Create/Edit
  const [stockFormData, setStockFormData] = useState({
    name: '',
    unit: 'Gram',
    current_amount: 1000,
    min_amount: 200,
    cost_per_unit: 150
  });
  const [editStockNotes, setEditStockNotes] = useState<string>('');

  const [formError, setFormError] = useState('');
  const [updateError, setUpdateError] = useState('');

  // Calculate Summary Cards metrics
  const totalBahan = stocks.length;
  const stokAmanCount = stocks.filter(s => s.current_amount > s.min_amount).length;
  const stokMenipisCount = stocks.filter(s => s.current_amount > 0 && s.current_amount <= s.min_amount).length;
  const stokHabisCount = stocks.filter(s => s.current_amount <= 0).length;

  // Filtered materials
  const filteredStocks = stocks.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());

    let matchesStatus = true;
    if (statusFilter === 'AMAN') {
      matchesStatus = s.current_amount > s.min_amount;
    } else if (statusFilter === 'MENIPIS') {
      matchesStatus = s.current_amount > 0 && s.current_amount <= s.min_amount;
    } else if (statusFilter === 'HABIS') {
      matchesStatus = s.current_amount <= 0;
    }

    return matchesSearch && matchesStatus;
  });

  // Safe Filtered history with error boundary safety
  const filteredHistory = (stockHistories || []).filter(h => {
    if (!h) return false;
    const stockName = h.stock_name || '';
    const matchesSearch = stockName.toLowerCase().includes(search.toLowerCase()) ||
      (h.reference || '').toLowerCase().includes(search.toLowerCase());

    let matchesType = true;
    if (historyTypeFilter !== 'ALL') {
      const type = (h.type || '').toLowerCase();
      if (historyTypeFilter === 'pembelian') {
        matchesType = type === 'pembelian' || type === 'in';
      } else if (historyTypeFilter === 'penjualan') {
        matchesType = type === 'penjualan' || type === 'sale_deduction';
      } else if (historyTypeFilter === 'refund') {
        matchesType = type === 'refund';
      } else if (historyTypeFilter === 'penyesuaian') {
        matchesType = type === 'penyesuaian' || type === 'out' || type === 'adjustment';
      } else if (historyTypeFilter === 'edit_manual') {
        matchesType = type === 'edit_manual' || type === 'manual_edit';
      }
    }

    return matchesSearch && matchesType;
  });

  // Open Master Stock Create Modal
  const handleOpenAddStock = () => {
    setEditingStock(null);
    setEditStockNotes('');
    setFormError('');
    setStockFormData({
      name: '',
      unit: 'Gram',
      current_amount: 1000,
      min_amount: 200,
      cost_per_unit: 150
    });
    setIsStockModalOpen(true);
  };

  // Open Master Stock Edit Modal
  const handleOpenEditStock = (s: Stock) => {
    setEditingStock(s);
    setEditStockNotes('');
    setFormError('');
    setStockFormData({
      name: s.name,
      unit: s.unit,
      current_amount: s.current_amount,
      min_amount: s.min_amount,
      cost_per_unit: s.cost_per_unit
    });
    setIsStockModalOpen(true);
  };

  // Handle Save Master Stock
  const handleSaveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockFormData.name.trim()) {
      setFormError('Nama bahan baku wajib diisi');
      return;
    }

    const currentAmt = Number(stockFormData.current_amount);
    if (isNaN(currentAmt) || currentAmt < 0) {
      setFormError('Jumlah stok tidak boleh bernilai negatif');
      return;
    }

    const isQtyChanged = editingStock !== null && currentAmt !== editingStock.current_amount;
    if (isQtyChanged && !editStockNotes.trim()) {
      setFormError('Keterangan perubahan stok wajib diisi ketika mengubah kuantitas stok bahan.');
      return;
    }

    try {
      const payload = {
        name: stockFormData.name.trim(),
        unit: stockFormData.unit,
        current_amount: currentAmt,
        min_amount: Number(stockFormData.min_amount || 0),
        cost_per_unit: Number(stockFormData.cost_per_unit || 0),
      };

      if (editingStock) {
        if (isQtyChanged) {
          await editStockItem(editingStock.id, payload, { notes: editStockNotes.trim() });
        } else {
          await editStockItem(editingStock.id, payload);
        }
      } else {
        await addStockItem(payload);
      }

      setIsStockModalOpen(false);
      setEditingStock(null);
      setEditStockNotes('');
      setFormError('');
    } catch (err: any) {
      console.error('Save stock error:', err);
      setFormError(err?.response?.data?.message || err?.message || 'Gagal menyimpan data bahan baku');
    }
  };

  // Delete Confirm
  const handleDeleteStockConfirm = async () => {
    if (!deletingStock) return;
    await removeStockItem(deletingStock.id);
    setDeletingStock(null);
  };

  // Open Update Stok Modal
  const handleOpenUpdateStok = (s: Stock) => {
    setSelectedStockForUpdate(s);
    setUpdateType('add');
    setUpdateAmount(100);
    setUpdateReason('Hasil Stock Opname Fisik');
    setUpdateNotes('');
    setUpdateError('');
    setIsUpdateStokOpen(true);
  };

  // Save Update Stok
  const handleSaveUpdateStok = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStockForUpdate) return;

    if (updateAmount <= 0) {
      setUpdateError('Jumlah perubahan harus lebih besar dari 0');
      return;
    }

    if (!updateReason.trim()) {
      setUpdateError('Silakan pilih alasan penyesuaian stok');
      return;
    }

    if (!updateNotes.trim()) {
      setUpdateError('Keterangan penyesuaian stok wajib diisi dan tidak boleh hanya berisi spasi.');
      return;
    }

    const change = updateType === 'add' ? updateAmount : -updateAmount;
    if (change < 0 && selectedStockForUpdate.current_amount + change < 0) {
      setUpdateError(
        `Penyesuaian gagal: stok tidak boleh menjadi negatif (sisa saat ini: ${selectedStockForUpdate.current_amount.toLocaleString('id-ID')} ${selectedStockForUpdate.unit})`
      );
      return;
    }

    try {
      await adjustStockQuantity(selectedStockForUpdate.id, change, updateReason, updateNotes.trim());
      setIsUpdateStokOpen(false);
      setSelectedStockForUpdate(null);
      setUpdateAmount(100);
      setUpdateReason('Hasil Stock Opname Fisik');
      setUpdateNotes('');
      setUpdateError('');
    } catch (err: any) {
      console.error('Update stock error:', err);
      setUpdateError(err?.response?.data?.message || err?.message || 'Gagal memperbarui stok.');
    }
  };

  // Helper for Activity Badge in History
  const renderActivityBadge = (typeString: string) => {
    const t = (typeString || '').toLowerCase();
    if (t === 'pembelian' || t === 'in') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
          <PackageCheck className="w-3.5 h-3.5" />
          Pembelian
        </span>
      );
    } else if (t === 'penjualan' || t === 'sale_deduction') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-600 border border-rose-500/20">
          <ShoppingCart className="w-3.5 h-3.5" />
          Penjualan
        </span>
      );
    } else if (t === 'refund') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-rose-500/10 text-rose-600 border border-rose-500/20">
          <RotateCcw className="w-3.5 h-3.5" />
          Refund
        </span>
      );
    } else if (t === 'penyesuaian' || t === 'out' || t === 'adjustment') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-amber-500/10 text-amber-600 border border-amber-500/20">
          <SlidersHorizontal className="w-3.5 h-3.5" />
          Penyesuaian
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase bg-sky-500/10 text-sky-600 border border-sky-500/20">
          <Pencil className="w-3.5 h-3.5" />
          Edit Manual
        </span>
      );
    }
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header & Submenu Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Boxes className="w-6 h-6 text-[#C68B59]" />
            Manajemen Stok Bahan Baku
          </h1>
          <p className="text-xs text-stone-500 font-medium">
            Kelola stok kopi, susu, sirup, cup, dan pantau mutasi histori penggunaan bahan baku secara akurat.
          </p>
        </div>

        {/* Tab Navigation / Segmented Button */}
        <div className="flex w-full sm:w-auto bg-stone-200 dark:bg-stone-800/80 p-1 rounded-2xl shrink-0 border border-stone-300 dark:border-stone-700/50">
          <button
            type="button"
            onClick={() => setActiveSubmenu('materials')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${activeSubmenu === 'materials'
              ? 'bg-[#3B2A1F] text-[#F7F5F2] shadow-md'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
          >
            <Boxes className="w-4 h-4 text-[#D4A373]" />
            Bahan Baku ({stocks.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveSubmenu('history')}
            className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${activeSubmenu === 'history'
              ? 'bg-[#3B2A1F] text-[#F7F5F2] shadow-md'
              : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
          >
            <History className="w-4 h-4 text-[#D4A373]" />
            Riwayat Stok ({stockHistories.length})
          </button>
        </div>
      </div>

      {/* SUBMENU 1: BAHAN BAKU */}
      {activeSubmenu === 'materials' && (
        <div className="space-y-6">
          {/* Summary Cards Above Table */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
            {/* Card 1: Total Bahan */}
            <div className="bg-white dark:bg-[#1E1C1A] p-4 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-extrabold text-stone-400 uppercase tracking-wider">Total Bahan</p>
                <p className="text-2xl font-black text-stone-900 dark:text-stone-100 mt-0.5">{totalBahan}</p>
                <p className="text-[10px] text-stone-500 font-semibold mt-0.5">Master Item</p>
              </div>
              <div className="p-2.5 rounded-2xl bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300">
                <Boxes className="w-5 h-5 text-[#C68B59]" />
              </div>
            </div>

            {/* Card 2: Stok Aman */}
            <div className="bg-white dark:bg-[#1E1C1A] p-4 rounded-2xl border border-emerald-500/20 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-extrabold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">Stok Aman</p>
                <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{stokAmanCount}</p>
                <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 font-semibold mt-0.5">Tersedia Cukup</p>
              </div>
              <div className="p-2.5 rounded-2xl bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            {/* Card 3: Stok Menipis */}
            <div className="bg-white dark:bg-[#1E1C1A] p-4 rounded-2xl border border-amber-500/20 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-extrabold text-amber-600 dark:text-amber-400 uppercase tracking-wider">Stok Menipis</p>
                <p className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{stokMenipisCount}</p>
                <p className="text-[10px] text-amber-600/70 dark:text-amber-400/70 font-semibold mt-0.5">Perlu Restok</p>
              </div>
              <div className="p-2.5 rounded-2xl bg-amber-500/10 text-amber-600">
                <AlertTriangle className="w-5 h-5" />
              </div>
            </div>

            {/* Card 4: Stok Habis */}
            <div className="bg-white dark:bg-[#1E1C1A] p-4 rounded-2xl border border-rose-500/20 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-[10px] font-extrabold text-rose-600 dark:text-rose-400 uppercase tracking-wider">Stok Habis</p>
                <p className="text-2xl font-black text-rose-600 dark:text-rose-400 mt-0.5">{stokHabisCount}</p>
                <p className="text-[10px] text-rose-600/70 dark:text-rose-400/70 font-semibold mt-0.5">Segera Isi Ulang</p>
              </div>
              <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600">
                <XCircle className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search Bar & Status Filters */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white dark:bg-[#1E1C1A] p-4 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama bahan baku (contoh: Fresh Milk, Espresso, Gula)..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B2A1F]"
              />
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto shrink-0 pb-1 md:pb-0">
              {[
                { id: 'ALL', label: 'Semua' },
                { id: 'AMAN', label: '🟢 Aman' },
                { id: 'MENIPIS', label: '🟡 Menipis' },
                { id: 'HABIS', label: '🔴 Habis' }
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStatusFilter(f.id as any)}
                  className={`px-3.5 py-2 rounded-2xl text-xs font-bold transition-all border cursor-pointer whitespace-nowrap ${statusFilter === f.id
                    ? 'bg-[#3B2A1F] text-[#F7F5F2] border-[#3B2A1F] shadow-sm'
                    : 'bg-stone-50 dark:bg-[#171514] text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:border-stone-300'
                    }`}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {isOwner && (
              <button
                type="button"
                onClick={handleOpenAddStock}
                className="w-full md:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] text-xs font-extrabold shadow-md transition-all cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4 text-[#D4A373]" />
                Tambah Bahan Baru
              </button>
            )}
          </div>

          {/* Table Master Bahan Baku */}
          <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[650px]">
                <thead className="bg-stone-50 dark:bg-[#23201D] border-b border-stone-200 dark:border-stone-800 text-stone-500 font-extrabold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Nama Bahan</th>
                    <th className="p-4">Stok Saat Ini</th>
                    <th className="p-4">Batas Minimum</th>
                    <th className="p-4 w-48">Level Stok</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium">
                  {filteredStocks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-stone-400 font-semibold">
                        <Boxes className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-700 mb-2" />
                        <p className="text-sm font-bold text-stone-600 dark:text-stone-400">Tidak ada bahan baku ditemukan</p>
                        <p className="text-xs text-stone-400 mt-1">Coba sesuaikan kata kunci pencarian atau filter status stok Anda.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredStocks.map(stk => {
                      // Status calculation
                      let statusBadge = {
                        emoji: '🟢',
                        label: 'Aman',
                        bg: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                      };

                      if (stk.current_amount <= 0) {
                        statusBadge = {
                          emoji: '🔴',
                          label: 'Habis',
                          bg: 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                        };
                      } else if (stk.current_amount <= stk.min_amount) {
                        statusBadge = {
                          emoji: '🟡',
                          label: 'Menipis',
                          bg: 'bg-amber-500/10 text-amber-600 border-amber-500/30'
                        };
                      }

                      // Capacity for progress bar
                      const maxCapacity = Math.max(stk.min_amount * 3, stk.current_amount, 1);
                      const percent = Math.min(100, Math.round((stk.current_amount / maxCapacity) * 100));

                      return (
                        <tr key={stk.id} className="hover:bg-stone-50/50 dark:hover:bg-[#25221F] transition-colors">
                          {/* Nama Bahan */}
                          <td className="p-4">
                            <div className="font-black text-stone-900 dark:text-stone-100 text-sm">
                              {stk.name}
                            </div>
                            <p className="text-[10px] text-stone-400 font-semibold mt-0.5">
                              Modal: {formatRupiah(stk.cost_per_unit)} / {stk.unit}
                            </p>
                          </td>

                          {/* Stok Saat Ini */}
                          <td className="p-4">
                            <span className="font-black text-[#3B2A1F] dark:text-[#D4A373] text-base">
                              {stk.current_amount.toLocaleString('id-ID')}
                            </span>{' '}
                            <span className="text-xs font-bold text-stone-500">{stk.unit}</span>
                          </td>

                          {/* Batas Minimum */}
                          <td className="p-4">
                            <span className="text-xs font-bold text-stone-600 dark:text-stone-400">
                              Restock jika ≤ <strong className="text-stone-900 dark:text-stone-200">{stk.min_amount.toLocaleString('id-ID')} {stk.unit}</strong>
                            </span>
                          </td>

                          {/* Level Stok / Progress Bar */}
                          <td className="p-4">
                            <div className="space-y-1">
                              <div className="flex justify-between text-[10px] font-bold text-stone-400">
                                <span>{stk.current_amount.toLocaleString('id-ID')} {stk.unit}</span>
                                <span>Maks: {maxCapacity.toLocaleString('id-ID')} {stk.unit}</span>
                              </div>
                              <div className="w-full h-2 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
                                <div
                                  className={`h-full rounded-full transition-all ${stk.current_amount <= 0
                                    ? 'bg-rose-500'
                                    : stk.current_amount <= stk.min_amount
                                      ? 'bg-amber-500'
                                      : 'bg-emerald-500'
                                    }`}
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          </td>

                          {/* Status */}
                          <td className="p-4">
                            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold uppercase border ${statusBadge.bg}`}>
                              <span className="text-xs leading-none">{statusBadge.emoji}</span>
                              <span>{statusBadge.label}</span>
                            </span>
                          </td>

                          {/* Aksi */}
                          <td className="p-4 text-right">
                            {isOwner ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleOpenUpdateStok(stk)}
                                  className="px-3 py-1.5 rounded-xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-black text-xs transition-colors shadow-sm cursor-pointer flex items-center gap-1.5"
                                  title="Update / Sesuaikan Stok"
                                >
                                  <SlidersHorizontal className="w-3.5 h-3.5 text-[#D4A373]" />
                                  Update Stok
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditStock(stk)}
                                  className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                                  title="Edit Master Bahan"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setDeletingStock(stk)}
                                  className="p-2 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition-colors cursor-pointer"
                                  title="Hapus Bahan Baku"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] font-bold text-stone-400 italic">Read Only</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* SUBMENU 2: RIWAYAT STOK */}
      {activeSubmenu === 'history' && (
        <div className="space-y-4">
          {/* Filters Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white dark:bg-[#1E1C1A] p-4 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-400" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Cari nama bahan atau referensi dalam riwayat..."
                className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B2A1F]"
              />
            </div>

            <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
              {[
                { id: 'ALL', label: 'Semua Jenis', icon: null },
                { id: 'pembelian', label: 'Pembelian', icon: PackageCheck },
                { id: 'penjualan', label: 'Penjualan', icon: ShoppingCart },
                { id: 'refund', label: 'Refund', icon: RotateCcw },
                { id: 'penyesuaian', label: 'Penyesuaian', icon: SlidersHorizontal },
                { id: 'edit_manual', label: 'Edit Manual', icon: Pencil }
              ].map(type => {
                const IconComponent = type.icon;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setHistoryTypeFilter(type.id)}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-bold transition-all border cursor-pointer whitespace-nowrap ${historyTypeFilter === type.id
                      ? 'bg-[#3B2A1F] text-[#F7F5F2] border-[#3B2A1F]'
                      : 'bg-stone-50 dark:bg-[#171514] text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-800 hover:border-stone-300'
                      }`}
                  >
                    {IconComponent && <IconComponent className="w-3.5 h-3.5" />}
                    {type.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* History Log Table */}
          <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs min-w-[700px]">
                <thead className="bg-stone-50 dark:bg-[#23201D] border-b border-stone-200 dark:border-stone-800 text-stone-500 font-extrabold uppercase tracking-wider">
                  <tr>
                    <th className="p-4">Tanggal & Waktu</th>
                    <th className="p-4">Nama Bahan</th>
                    <th className="p-4">Jenis Aktivitas</th>
                    <th className="p-4">Jumlah Perubahan</th>
                    <th className="p-4">Keterangan / Ref</th>
                    <th className="p-4">User</th>
                    <th className="p-4 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-stone-400 font-semibold">
                        <History className="w-10 h-10 mx-auto text-stone-300 dark:text-stone-700 mb-2" />
                        <p className="text-sm font-bold text-stone-600 dark:text-stone-400">Belum ada data riwayat stok</p>
                        <p className="text-xs text-stone-400 mt-1">Setiap pembelian, penjualan, dan update stok akan tercatat di sini.</p>
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map(h => {
                      const isPositive = h.change_amount > 0;
                      return (
                        <tr key={h.id} className="hover:bg-stone-50/50 dark:hover:bg-[#25221F] transition-colors">
                          {/* Tanggal & Waktu */}
                          <td className="p-4 text-stone-500 font-semibold whitespace-nowrap">
                            {formatSafeDate(h.created_at)}
                          </td>

                          {/* Nama Bahan */}
                          <td className="p-4 font-black text-stone-900 dark:text-stone-100 text-sm">
                            {h.stock_name}
                          </td>

                          {/* Jenis Aktivitas */}
                          <td className="p-4 whitespace-nowrap">
                            {renderActivityBadge(h.type)}
                          </td>

                          {/* Jumlah Perubahan */}
                          <td className="p-4 font-black text-sm whitespace-nowrap">
                            <span className={`inline-flex items-center gap-0.5 ${isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isPositive ? '+' : ''}{h.change_amount.toLocaleString('id-ID')} {h.unit}
                            </span>
                          </td>

                          {/* Keterangan */}
                          <td className="p-4 text-stone-600 dark:text-stone-300 max-w-xs truncate">
                            {h.reference || '-'}
                          </td>

                          {/* User */}
                          <td className="p-4 font-extrabold text-stone-700 dark:text-stone-300 whitespace-nowrap">
                            <User className="w-4 h-4 mr-1 inline" /> {h.user_name || 'Owner'}
                          </td>

                          {/* Action Detail */}
                          <td className="p-4 text-right">
                            <button
                              type="button"
                              onClick={() => setSelectedHistory(h)}
                              className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700 transition-colors cursor-pointer"
                              title="Lihat Detail Riwayat"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal Update Stok Dialog */}
      {isUpdateStokOpen && selectedStockForUpdate && (() => {
        const estimatedFinal = Math.round((
          updateType === 'add'
            ? selectedStockForUpdate.current_amount + (Number(updateAmount) || 0)
            : selectedStockForUpdate.current_amount - (Number(updateAmount) || 0)
        ) * 1000) / 1000;
        const isNegative = estimatedFinal < 0;
        const isInvalidAmount = !updateAmount || updateAmount <= 0;
        const isInvalidReason = !updateReason.trim();
        const isInvalidNotes = !updateNotes.trim();
        const isSubmitDisabled = isInvalidAmount || isNegative || isInvalidReason || isInvalidNotes;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-stone-200 dark:border-stone-800">
              <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-3">
                <div>
                  <h3 className="font-black text-base text-stone-900 dark:text-stone-100 flex items-center gap-2">
                    <SlidersHorizontal className="w-4 h-4 text-[#D4A373]" />
                    Penyesuaian Stok Manual
                  </h3>
                  <p className="text-xs text-[#C68B59] font-extrabold mt-0.5">
                    {selectedStockForUpdate.name} (Sisa saat ini: {selectedStockForUpdate.current_amount.toLocaleString('id-ID')} {selectedStockForUpdate.unit})
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUpdateStokOpen(false)}
                  className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Informational Banner */}
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] text-amber-800 dark:text-amber-300 font-semibold leading-relaxed">
                Penyesuaian ini langsung mengubah sisa kuantitas fisik bahan baku dan dicatat pada riwayat sebagai <strong>Penyesuaian</strong>. Untuk pembelian dari supplier, silakan gunakan menu <strong>Pembelian</strong>.
              </div>

              <form onSubmit={handleSaveUpdateStok} className="space-y-4 text-xs">
                {updateError && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/60 rounded-2xl text-rose-600 dark:text-rose-400 font-bold text-xs">
                    {updateError}
                  </div>
                )}
                <div>
                  <label className="block font-extrabold text-stone-700 dark:text-stone-300 mb-1.5">
                    Arah Penyesuaian Stok
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setUpdateType('add')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${updateType === 'add'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-stone-50 dark:bg-[#171514] text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                        }`}
                    >
                      <Plus className="w-4 h-4" />
                      Tambah Stok (+)
                    </button>
                    <button
                      type="button"
                      onClick={() => setUpdateType('subtract')}
                      className={`py-2.5 px-3 rounded-xl text-xs font-black border transition-all cursor-pointer flex items-center justify-center gap-1.5 ${updateType === 'subtract'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-stone-50 dark:bg-[#171514] text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700'
                        }`}
                    >
                      <X className="w-4 h-4" />
                      Kurangi Stok (-)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-extrabold text-stone-700 dark:text-stone-300 mb-1">
                    Jumlah Perubahan ({selectedStockForUpdate.unit}) <span className="text-rose-500">*</span>
                  </label>
                  <NumberInput
                    type="number"
                    min={0.001}
                    step="any"
                    allowDecimals={true}
                    required
                    value={updateAmount}
                    onChange={val => {
                      setUpdateAmount(val);
                      setUpdateError('');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-black text-base focus:outline-none focus:ring-2 focus:ring-[#3B2A1F]"
                  />
                  {updateAmount <= 0 && (
                    <p className="text-rose-500 text-[10px] font-bold mt-1">
                      Jumlah perubahan harus lebih besar dari 0
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-extrabold text-stone-700 dark:text-stone-300 mb-1">
                    Alasan Penyesuaian <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={updateReason}
                    onChange={e => {
                      setUpdateReason(e.target.value);
                      setUpdateError('');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-semibold focus:outline-none"
                    required
                  >
                    <option value="Hasil Stock Opname Fisik">Hasil Stock Opname Fisik</option>
                    <option value="Barang Rusak / Tumpah">Barang Rusak / Tumpah</option>
                    <option value="Barang Hilang / Selisih Fisik">Barang Hilang / Selisih Fisik</option>
                    <option value="Koreksi Salah Input">Koreksi Salah Input</option>
                    <option value="Kadaluarsa (Expired)">Kadaluarsa (Expired)</option>
                    <option value="Penyesuaian Manual Lainnya">Penyesuaian Manual Lainnya</option>
                  </select>
                </div>

                <div>
                  <label className="block font-extrabold text-stone-700 dark:text-stone-300 mb-1">
                    Keterangan <span className="text-rose-500">*</span>
                  </label>
                  <textarea
                    rows={2}
                    required
                    value={updateNotes}
                    onChange={e => {
                      setUpdateNotes(e.target.value);
                      setUpdateError('');
                    }}
                    placeholder="Contoh: Susu tumpah sekitar 250 ml saat membersihkan mesin steamer."
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-[#3B2A1F]"
                  />
                  {!updateNotes.trim() && (
                    <p className="text-rose-500 text-[10px] font-bold mt-1">
                      Keterangan wajib diisi dan tidak boleh hanya berisi spasi
                    </p>
                  )}
                </div>

                {/* Estimate Calculation Preview */}
                <div className={`p-3.5 rounded-2xl border flex justify-between items-center text-xs font-bold transition-colors ${
                  isNegative
                    ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800'
                    : 'bg-stone-100 dark:bg-[#171514] border-stone-200 dark:border-stone-800'
                }`}>
                  <span className={isNegative ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-stone-500'}>
                    {isNegative ? 'Stok Tidak Boleh Negatif:' : 'Estimasi Stok Akhir:'}
                  </span>
                  <span className={`font-black text-sm ${isNegative ? 'text-rose-600 dark:text-rose-400' : 'text-stone-900 dark:text-stone-100'}`}>
                    {estimatedFinal.toLocaleString('id-ID')} {selectedStockForUpdate.unit}
                  </span>
                </div>
                {isNegative && (
                  <p className="text-rose-500 text-[11px] font-bold">
                    Perubahan ini akan membuat stok menjadi negatif. Sisa stok saat ini hanya {selectedStockForUpdate.current_amount.toLocaleString('id-ID')} {selectedStockForUpdate.unit}.
                  </p>
                )}

                <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100 dark:border-stone-800">
                  <button
                    type="button"
                    onClick={() => setIsUpdateStokOpen(false)}
                    className="px-4 py-2.5 rounded-xl font-bold border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitDisabled}
                    className={`px-5 py-2.5 rounded-xl font-extrabold shadow-md transition-all ${
                      isSubmitDisabled
                        ? 'bg-stone-300 dark:bg-stone-800 text-stone-400 dark:text-stone-600 cursor-not-allowed shadow-none'
                        : 'bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] cursor-pointer'
                    }`}
                  >
                    Simpan Penyesuaian
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modal Create/Edit Master Stock Item */}
      {isStockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-stone-200 dark:border-stone-800">
            <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-3">
              <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100">
                {editingStock ? 'Edit Master Bahan Baku' : 'Tambah Bahan Baku Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsStockModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveStock} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Nama Bahan Baku <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={stockFormData.name}
                  onChange={e => {
                    setStockFormData({ ...stockFormData, name: e.target.value });
                    setFormError('');
                  }}
                  placeholder="Contoh: Fresh Milk Pasteurized / Espresso Beans"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B2A1F]"
                />
                {formError && (
                  <p className="text-rose-500 text-[11px] font-bold mt-1">{formError}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Satuan Ukur <span className="text-rose-500">*</span>
                  </label>
                  <select
                    value={stockFormData.unit}
                    onChange={e => setStockFormData({ ...stockFormData, unit: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-semibold focus:outline-none"
                  >
                    {UNIT_OPTIONS.map(u => (
                      <option key={u} value={u}>{u}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Harga Modal / {stockFormData.unit} (Rp)
                  </label>
                  <NumberInput
                    min={0}
                    allowDecimals={true}
                    value={stockFormData.cost_per_unit}
                    onChange={val => setStockFormData({ ...stockFormData, cost_per_unit: val })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    {editingStock ? `Jumlah Stok (${stockFormData.unit})` : `Stok Awal (${stockFormData.unit})`}
                  </label>
                  <NumberInput
                    min={0}
                    allowDecimals={true}
                    value={stockFormData.current_amount}
                    onChange={val => {
                      setStockFormData({ ...stockFormData, current_amount: val });
                      setFormError('');
                    }}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Batas Minimum Peringatan <span className="text-rose-500">*</span>
                  </label>
                  <NumberInput
                    min={0}
                    allowDecimals={true}
                    required
                    value={stockFormData.min_amount}
                    onChange={val => setStockFormData({ ...stockFormData, min_amount: val })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold focus:outline-none"
                  />
                </div>
              </div>

              {/* Notice & Keterangan when editing stock quantity directly */}
              {editingStock && Number(stockFormData.current_amount) !== editingStock.current_amount && (
                <div className="space-y-2 pt-1">
                  <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-[11px] text-amber-800 dark:text-amber-300 font-semibold space-y-1">
                    <p>
                      Kuantitas stok diubah dari <strong>{editingStock.current_amount.toLocaleString('id-ID')} {editingStock.unit}</strong> menjadi <strong>{Number(stockFormData.current_amount).toLocaleString('id-ID')} {editingStock.unit}</strong> ({Number(stockFormData.current_amount) - editingStock.current_amount > 0 ? '+' : ''}{(Number(stockFormData.current_amount) - editingStock.current_amount).toLocaleString('id-ID')} {editingStock.unit}).
                    </p>
                    <p className="text-[10px] text-amber-700 dark:text-amber-400">
                      Perubahan ini akan dicatat sebagai <strong>Edit Manual</strong> pada Riwayat Stok.
                    </p>
                  </div>

                  <div>
                    <label className="block font-extrabold text-stone-700 dark:text-stone-300 mb-1">
                      Keterangan Edit Kuantitas <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      rows={2}
                      required
                      value={editStockNotes}
                      onChange={e => {
                        setEditStockNotes(e.target.value);
                        setFormError('');
                      }}
                      placeholder="Contoh: Koreksi selisih hitung fisik saat audit stok"
                      className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-medium text-xs focus:outline-none focus:ring-2 focus:ring-[#3B2A1F]"
                    />
                    {!editStockNotes.trim() && (
                      <p className="text-rose-500 text-[10px] font-bold mt-1">
                        Keterangan edit kuantitas wajib diisi dan tidak boleh hanya berisi spasi
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2.5 pt-3 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsStockModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl font-bold border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editingStock !== null && Number(stockFormData.current_amount) !== editingStock.current_amount && !editStockNotes.trim()}
                  className={`px-5 py-2.5 rounded-xl font-extrabold shadow-md transition-all ${
                    editingStock !== null && Number(stockFormData.current_amount) !== editingStock.current_amount && !editStockNotes.trim()
                      ? 'bg-stone-300 dark:bg-stone-800 text-stone-400 dark:text-stone-600 cursor-not-allowed shadow-none'
                      : 'bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] cursor-pointer'
                  }`}
                >
                  {editingStock ? 'Simpan Perubahan' : 'Tambah Bahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail Riwayat */}
      {selectedHistory && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl p-6 max-w-md w-full max-h-[90vh] flex flex-col space-y-4 shadow-2xl border border-stone-200 dark:border-stone-800 min-w-0">
            <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-3 shrink-0">
              <div className="min-w-0 pr-2">
                <h3 className="font-black text-base text-stone-900 dark:text-stone-100 truncate">
                  Detail Mutasi Stok
                </h3>
                <p className="text-[11px] text-stone-400 font-medium">Ref ID: #{selectedHistory.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedHistory(null)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs overflow-y-auto min-w-0 pr-0.5 custom-scrollbar">
              <div className="p-3.5 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2 min-w-0">
                <div className="flex justify-between items-center gap-2">
                  <span className="text-stone-400 font-bold uppercase text-[10px] shrink-0">Aktivitas:</span>
                  <div className="shrink-0">{renderActivityBadge(selectedHistory.type)}</div>
                </div>
                <p className="font-black text-base text-stone-900 dark:text-stone-100 break-words [overflow-wrap:anywhere] min-w-0">{selectedHistory.stock_name}</p>
              </div>

              <div className="p-3 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2 min-w-0">
                {selectedHistory.initial_amount !== undefined && (
                  <div className="flex justify-between gap-2">
                    <span className="text-stone-500 font-semibold shrink-0">Stok Sebelum Mutasi:</span>
                    <span className="font-extrabold text-stone-900 dark:text-stone-100 text-right break-words min-w-0">
                      {selectedHistory.initial_amount.toLocaleString('id-ID')} {selectedHistory.unit}
                    </span>
                  </div>
                )}
                <div className={`flex justify-between gap-2 ${selectedHistory.initial_amount !== undefined ? 'border-t border-stone-200 dark:border-stone-800 pt-2' : ''}`}>
                  <span className="text-stone-500 font-semibold shrink-0">Jumlah Perubahan:</span>
                  <span className={`font-black text-right break-words min-w-0 ${selectedHistory.change_amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {selectedHistory.change_amount > 0 ? '+' : ''}{selectedHistory.change_amount.toLocaleString('id-ID')} {selectedHistory.unit}
                  </span>
                </div>
                {selectedHistory.final_amount !== undefined && (
                  <div className="flex justify-between gap-2 border-t border-stone-200 dark:border-stone-800 pt-2">
                    <span className="text-stone-500 font-semibold shrink-0">Stok Akhir Tercatat:</span>
                    <span className="font-extrabold text-stone-900 dark:text-stone-100 text-right break-words min-w-0">
                      {selectedHistory.final_amount.toLocaleString('id-ID')} {selectedHistory.unit}
                    </span>
                  </div>
                )}
                <div className="flex justify-between gap-2 border-t border-stone-200 dark:border-stone-800 pt-2">
                  <span className="text-stone-500 font-semibold shrink-0">Waktu Mutasi:</span>
                  <span className="font-bold text-stone-700 dark:text-stone-300 text-right">
                    {formatSafeDate(selectedHistory.created_at)}
                  </span>
                </div>
                <div className="flex justify-between gap-2 border-t border-stone-200 dark:border-stone-800 pt-2">
                  <span className="text-stone-500 font-semibold shrink-0">Dicatat Oleh:</span>
                  <span className="font-extrabold text-[#C68B59] text-right truncate">
                    <User className="w-4 h-4 mr-1 inline" /> {selectedHistory.user_name || 'Owner'}
                  </span>
                </div>
              </div>

              {/* Alasan Operasional & Keterangan */}
              {selectedHistory.reason && (
                <div className="p-3 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-1 min-w-0">
                  <p className="text-stone-400 font-bold text-[10px] uppercase">Alasan Operasional / Perubahan:</p>
                  <p className="font-black text-stone-800 dark:text-stone-200 break-words [overflow-wrap:anywhere] min-w-0">{selectedHistory.reason}</p>
                </div>
              )}

              {selectedHistory.notes ? (
                <div className="p-3 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-1 min-w-0">
                  <p className="text-stone-400 font-bold text-[10px] uppercase">Keterangan Detail:</p>
                  <div className="max-h-32 sm:max-h-36 overflow-y-auto overscroll-contain custom-scrollbar pr-1">
                    <p className="font-medium text-stone-800 dark:text-stone-200 leading-relaxed whitespace-pre-wrap break-words [overflow-wrap:anywhere] min-w-0">
                      {selectedHistory.notes}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-1 min-w-0">
                  <p className="text-stone-400 font-bold text-[10px] uppercase">Keterangan / Referensi:</p>
                  <div className="max-h-32 sm:max-h-36 overflow-y-auto overscroll-contain custom-scrollbar pr-1">
                    <p className="font-bold text-stone-800 dark:text-stone-200 break-words [overflow-wrap:anywhere] min-w-0">
                      {selectedHistory.reference || '-'}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end pt-2 shrink-0 border-t border-stone-100 dark:border-stone-800">
              <button
                type="button"
                onClick={() => setSelectedHistory(null)}
                className="w-full py-2.5 rounded-xl bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-extrabold text-xs hover:bg-stone-300 transition-colors"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deletingStock}
        title="Hapus Bahan Baku?"
        message={`Apakah Anda yakin ingin menghapus bahan baku "${deletingStock?.name}" dari master data?`}
        confirmText="Ya, Hapus Bahan"
        onConfirm={handleDeleteStockConfirm}
        onCancel={() => setDeletingStock(null)}
      />
    </div>
  );
};
