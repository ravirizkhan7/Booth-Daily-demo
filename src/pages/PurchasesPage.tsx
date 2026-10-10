import { NumberInput } from '../components/common/NumberInput';
import React, { useState } from 'react';
import { usePOS } from '../hooks/usePOS';
import { Purchase, PurchaseItem } from '../types';
import { formatRupiah } from '../utils/formatters';
import {
  ShoppingBag, Plus, Search, Edit2, Trash2, Eye, X,
  Truck
} from 'lucide-react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export const PurchasesPage: React.FC = () => {
  const {
    purchases,
    stocks,
    addPurchase,
    editPurchase,
    removePurchase
  } = usePOS();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);
  const [deletingPurchase, setDeletingPurchase] = useState<Purchase | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    purchase_number: '',
    supplier: '',
    date: new Date().toISOString().slice(0, 10),
    items: [] as Omit<PurchaseItem, 'id'>[],
    notes: ''
  });

  const [formError, setFormError] = useState('');

  // Normalisasi tanggal apapun formatnya (ISO string dengan waktu, Date object,
  // string dari database, dll) jadi "YYYY-MM-DD" biar cocok sama <input type="date">.
  // Tanpa ini, kalau format tanggal dari backend bukan persis YYYY-MM-DD,
  // input date akan menolaknya dan tampil kosong.
  const toDateInputValue = (value: any): string => {
    if (!value) return new Date().toISOString().slice(0, 10);
    if (typeof value === 'string') {
      // Sudah dalam format YYYY-MM-DD, langsung pakai
      if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
      const parsed = new Date(value);
      if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
      return new Date().toISOString().slice(0, 10);
    }
    const parsed = new Date(value);
    if (!isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return new Date().toISOString().slice(0, 10);
  };

  const filteredPurchases = purchases.filter(p =>
    p.purchase_number.toLowerCase().includes(search.toLowerCase()) ||
    p.supplier.toLowerCase().includes(search.toLowerCase())
  );

  const handleOpenAdd = () => {
    setEditingPurchase(null);
    setFormError('');
    const defaultStock = stocks[0];
    setFormData({
      purchase_number: `PUR-${Date.now().toString().slice(-6)}`,
      supplier: 'CV Jaya Abadi Supplier',
      date: new Date().toISOString().slice(0, 10),
      items: defaultStock ? [
        {
          stock_id: defaultStock.id,
          stock_name: defaultStock.name,
          qty: 1000,
          unit: defaultStock.unit,
          unit_cost: defaultStock.cost_per_unit,
          total_cost: 1000 * defaultStock.cost_per_unit
        }
      ] : [],
      notes: '' // notes dikosongkan, user isi manual
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (purchase: Purchase) => {
    setEditingPurchase(purchase);
    setFormError('');
    setFormData({
      purchase_number: purchase.purchase_number,
      supplier: purchase.supplier,
      date: toDateInputValue(purchase.date),
      items: purchase.items.map(i => ({
        stock_id: i.stock_id,
        stock_name: i.stock_name,
        qty: i.qty,
        unit: i.unit,
        unit_cost: i.unit_cost,
        total_cost: i.total_cost
      })),
      notes: purchase.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPurchase) return;
    await removePurchase(deletingPurchase.id);
    setDeletingPurchase(null);
  };

  // Item list handlers
  const handleAddItem = () => {
    if (stocks.length === 0) return;
    const defaultStock = stocks[0];
    setFormData(prev => ({
      ...prev,
      items: [
        ...prev.items,
        {
          stock_id: defaultStock.id,
          stock_name: defaultStock.name,
          qty: 1000,
          unit: defaultStock.unit,
          unit_cost: defaultStock.cost_per_unit,
          total_cost: 1000 * defaultStock.cost_per_unit
        }
      ]
    }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const updated = [...prev.items];
      const target = { ...updated[index] };

      if (field === 'stock_id') {
        const found = stocks.find(s => s.id != null && value != null && String(s.id) === String(value));
        if (found) {
          target.stock_id = found.id;
          target.stock_name = found.name;
          target.unit = found.unit;
          target.unit_cost = found.cost_per_unit;
          target.total_cost = target.qty * found.cost_per_unit;
        }
      } else if (field === 'qty') {
        target.qty = Number(value) || 0;
        target.total_cost = target.qty * target.unit_cost;
      } else if (field === 'unit_cost') {
        target.unit_cost = Number(value) || 0;
        target.total_cost = target.qty * target.unit_cost;
      }

      updated[index] = target;
      return { ...prev, items: updated };
    });
  };

  const handleRemoveItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index)
    }));
  };

  const calculateTotalAmount = () => {
    return formData.items.reduce((sum, item) => sum + item.total_cost, 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.supplier.trim()) {
      setFormError('Nama supplier wajib diisi');
      return;
    }
    if (formData.items.length === 0) {
      setFormError('Tambahkan minimal 1 barang belanjaan');
      return;
    }

    const totalAmount = calculateTotalAmount();

    const itemsWithIds: PurchaseItem[] = formData.items.map((item, idx) => ({
      id: `pitem-${Date.now()}-${idx}`,
      ...item
    }));

    if (editingPurchase) {
      await editPurchase(editingPurchase.id, {
        purchase_number: formData.purchase_number,
        supplier: formData.supplier,
        date: formData.date,
        total_amount: totalAmount,
        notes: formData.notes,
        items: itemsWithIds
      });
    } else {
      await addPurchase({
        purchase_number: formData.purchase_number,
        supplier: formData.supplier,
        date: formData.date,
        total_amount: totalAmount,
        created_at: new Date().toISOString(),
        notes: formData.notes,
        items: itemsWithIds
      });
    }

    setIsModalOpen(false);
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-[#C68B59]" />
            Pembelian & Restok Bahan
          </h1>
          <p className="text-xs text-stone-500 font-medium">
            Catat pengeluaran belanja bahan baku kopi, susu, cup, dan perlengkapan booth. Stok otomatis bertambah saat dicatat.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenAdd}
          className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-2xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] text-sm font-bold shadow-md transition-all cursor-pointer w-full sm:w-auto"
        >
          <Plus className="w-4 h-4 text-[#D4A373]" />
          Catat Pembelian Baru
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white dark:bg-[#1E1C1A] p-4 rounded-3xl border border-stone-200 dark:border-stone-800 shadow-sm flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-400" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cari nomor nota atau nama supplier..."
            className="w-full pl-10 pr-4 py-2.5 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#3B2A1F]"
          />
        </div>
      </div>

      {/* Purchase List Table */}
      <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead className="bg-stone-50 dark:bg-[#23201D] border-b border-stone-200 dark:border-stone-800 text-stone-500 font-extrabold uppercase tracking-wider">
              <tr>
                <th className="p-4">No. Pembelian / Nota</th>
                <th className="p-4">Supplier / Vendor</th>
                <th className="p-4">Tanggal Nota</th>
                <th className="p-4">Rincian Belanja</th>
                <th className="p-4 text-right">Total Biaya</th>
                <th className="p-4 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium">
              {filteredPurchases.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-stone-400 font-semibold">
                    Tidak ada catatan pembelian.
                  </td>
                </tr>
              ) : (
                filteredPurchases.map(pur => (
                  <tr key={pur.id} className="hover:bg-stone-50/50 dark:hover:bg-[#25221F] transition-colors">
                    <td className="p-4">
                      <div className="font-extrabold text-stone-900 dark:text-stone-100 text-sm">
                        {pur.purchase_number}
                      </div>
                      <p className="text-[10px] text-stone-400">{pur.notes || 'Tanpa catatan'}</p>
                    </td>

                    <td className="p-4 text-stone-700 dark:text-stone-300 font-extrabold text-sm">
                      <span className="flex items-center gap-1">
                        <Truck className="w-3.5 h-3.5 text-[#C68B59]" />
                        {pur.supplier}
                      </span>
                    </td>

                    <td className="p-4 text-stone-500 font-semibold">
                      {pur.date}
                    </td>

                    <td className="p-4">
                      <div className="flex flex-wrap gap-1">
                        {pur.items.map(item => (
                          <span
                            key={item.id}
                            className="px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-[#25221F] text-stone-800 dark:text-stone-200 font-bold text-[10px] border border-stone-200 dark:border-stone-800"
                          >
                            {item.stock_name}: {item.qty} {item.unit}
                          </span>
                        ))}
                      </div>
                    </td>

                    <td className="p-4 text-right font-black text-[#3B2A1F] dark:text-[#D4A373] text-sm">
                      {formatRupiah(pur.total_amount)}
                    </td>

                    <td className="p-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewingPurchase(pur)}
                          className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 transition-colors cursor-pointer"
                          title="Lihat Detail Nota"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(pur)}
                          className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 transition-colors cursor-pointer"
                          title="Edit Pembelian"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingPurchase(pur)}
                          className="p-2 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition-colors cursor-pointer"
                          title="Hapus Nota (Kembalikan Stok)"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Add / Edit Purchase */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl p-6 max-w-xl w-full space-y-4 shadow-2xl border border-stone-200 dark:border-stone-800 my-auto">
            <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-3">
              <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100">
                {editingPurchase ? 'Edit Catatan Pembelian' : 'Catat Belanja Bahan Baru'}
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    No. Nota / Invoice <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.purchase_number}
                    onChange={e => setFormData({ ...formData, purchase_number: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-extrabold focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Tanggal Pembelian <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={e => setFormData({ ...formData, date: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-semibold focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Supplier / Vendor Toko <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.supplier}
                  onChange={e => setFormData({ ...formData, supplier: e.target.value })}
                  placeholder="Contoh: Toko Kopi Nusantara / Supplier Cup"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-semibold focus:outline-none"
                />
              </div>

              {/* Dynamic Items list */}
              <div className="space-y-2.5 p-3.5 bg-stone-50 dark:bg-[#161413] rounded-2xl border border-stone-200 dark:border-stone-800">
                <div className="flex justify-between items-center">
                  <label className="block font-extrabold text-stone-800 dark:text-stone-200 uppercase text-[11px]">
                    DAFTAR BARANG DIBELI
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItem}
                    className="px-3 py-1 rounded-xl bg-[#3B2A1F] text-[#F7F5F2] font-bold text-[11px] flex items-center gap-1 hover:bg-[#2A1E16] cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#D4A373]" />
                    Tambah Barang
                  </button>
                </div>

                {formData.items.length === 0 ? (
                  <p className="text-stone-400 italic text-center py-2">Belum ada barang dibeli.</p>
                ) : (
                  formData.items.map((item, idx) => (
                    <div key={idx} className="space-y-2 bg-white dark:bg-[#1E1C1A] p-3 rounded-xl border border-stone-200 dark:border-stone-800">
                      <div className="grid grid-cols-12 gap-2 items-center">
                        <div className="col-span-11">
                          <label className="block font-bold text-stone-500 text-[10px] mb-0.5">Pilih Bahan Baku</label>
                          <select
                            value={item.stock_id}
                            onChange={e => handleItemChange(idx, 'stock_id', e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold text-[11px]"
                          >
                            {stocks.map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
                            ))}
                          </select>
                        </div>
                        <div className="col-span-1 text-center pt-3">
                          <button
                            type="button"
                            onClick={() => handleRemoveItem(idx)}
                            className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block font-bold text-stone-500 text-[10px]">Jumlah ({item.unit})</label>
                          <NumberInput
                            min={0.001}
                            allowDecimals={true}
                            value={item.qty}
                            onChange={val => handleItemChange(idx, 'qty', val)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold text-[11px]"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-stone-500 text-[10px]">Harga / {item.unit} (Rp)</label>
                          <NumberInput
                            min={0}
                            allowDecimals={false}
                            value={item.unit_cost}
                            onChange={val => handleItemChange(idx, 'unit_cost', val)}
                            className="w-full px-2.5 py-1.5 rounded-lg bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold text-[11px]"
                          />
                        </div>

                        <div>
                          <label className="block font-bold text-stone-500 text-[10px]">Subtotal (Rp)</label>
                          <div className="w-full px-2.5 py-1.5 rounded-lg bg-stone-100 dark:bg-stone-800 font-black text-[#3B2A1F] dark:text-[#D4A373] text-[11px] truncate">
                            {formatRupiah(item.total_cost)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Catatan / Notes - Manual Input */}
              <div>
                <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                  Catatan (Opsional)
                </label>
                <textarea
                  value={formData.notes}
                  onChange={e => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Contoh: Restok berkala bahan baku booth, beli tambahan cup ukuran M, dll..."
                  rows={2}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-semibold focus:outline-none resize-none"
                />
              </div>

              {/* Summary */}
              <div className="p-3.5 bg-[#3B2A1F]/10 dark:bg-[#D4A373]/10 rounded-2xl border border-[#3B2A1F]/20 flex justify-between items-center font-black text-sm text-[#3B2A1F] dark:text-[#D4A373]">
                <span>TOTAL BELANJA PEMBELIAN:</span>
                <span className="text-base">{formatRupiah(calculateTotalAmount())}</span>
              </div>

              {formError && (
                <p className="text-rose-600 font-bold text-xs">{formError}</p>
              )}

              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 pt-3 border-t border-stone-100 dark:border-stone-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-extrabold shadow-md transition-all cursor-pointer"
                >
                  {editingPurchase ? 'Simpan Perubahan' : 'Simpan & Tambah Stok'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail View */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl p-6 max-w-md w-full space-y-4 shadow-2xl border border-stone-200 dark:border-stone-800">
            <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-3">
              <div>
                <h3 className="font-extrabold text-base text-stone-900 dark:text-stone-100">
                  Detail Nota {viewingPurchase.purchase_number}
                </h3>
                <p className="text-[11px] text-stone-400 font-medium">Tanggal: {viewingPurchase.date}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingPurchase(null)}
                className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-1">
                <p className="text-stone-500 font-bold">Supplier / Vendor:</p>
                <p className="font-extrabold text-sm text-stone-900 dark:text-stone-100">{viewingPurchase.supplier}</p>
              </div>

              {viewingPurchase.notes && (
                <div className="p-3 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-1">
                  <p className="text-stone-500 font-bold">Catatan:</p>
                  <p className="font-semibold text-stone-800 dark:text-stone-200">{viewingPurchase.notes}</p>
                </div>
              )}

              <div className="space-y-2">
                <p className="font-extrabold text-stone-500 uppercase text-[10px]">Barang Yang Dibeli:</p>
                <div className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden">
                  {viewingPurchase.items.map(item => (
                    <div key={item.id} className="p-3 flex justify-between items-center bg-white dark:bg-[#1E1C1A]">
                      <div>
                        <p className="font-bold text-stone-900 dark:text-stone-100">{item.stock_name}</p>
                        <p className="text-[10px] text-stone-400">{item.qty} {item.unit} @ {formatRupiah(item.unit_cost)}</p>
                      </div>
                      <span className="font-extrabold text-[#3B2A1F] dark:text-[#D4A373]">
                        {formatRupiah(item.total_cost)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 bg-[#3B2A1F] text-[#F7F5F2] rounded-2xl flex justify-between items-center font-black text-sm">
                <span>Total Pembelian:</span>
                <span className="text-[#D4A373] text-base">{formatRupiah(viewingPurchase.total_amount)}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setViewingPurchase(null)}
                className="w-full py-2.5 rounded-xl bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-bold"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Dialog for Delete */}
      <ConfirmDialog
        isOpen={!!deletingPurchase}
        title="Hapus Nota Pembelian?"
        message={`Penghapusan nota "${deletingPurchase?.purchase_number}" akan otomatis MENGURANGI/MENGEMBALIKAN stok yang sebelumnya ditambahkan. Lanjutkan?`}
        confirmText="Ya, Hapus & Revert Stok"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingPurchase(null)}
      />
    </div>
  );
};