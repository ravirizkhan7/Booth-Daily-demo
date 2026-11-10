import { NumberInput } from '../components/common/NumberInput';
import React, { useState, useRef, useEffect } from 'react';
import { usePOS } from '../hooks/usePOS';
import { Purchase, PurchaseItem, Stock } from '../types';
import { formatRupiah } from '../utils/formatters';
import {
  ShoppingBag, Plus, Search, Edit2, Trash2, Eye, X,
  Truck, ArrowRight, PackageCheck, AlertCircle, Info
} from 'lucide-react';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { validatePackagingConversion } from '../utils/stockUtils';

export const PurchasesPage: React.FC = () => {
  const {
    purchases,
    stocks,
    addPurchase,
    editPurchase,
    removePurchase,
    showToast,
  } = usePOS();

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<Purchase | null>(null);
  const [viewingPurchase, setViewingPurchase] = useState<Purchase | null>(null);
  const [deletingPurchase, setDeletingPurchase] = useState<Purchase | null>(null);

  // F-07 Double-Submit Prevention Locks
  const submitLock = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const deleteLock = useRef(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // F-08 Accessibility & Focus Refs
  const purchaseModalRef = useRef<HTMLDivElement>(null);
  const purchaseTriggerRef = useRef<HTMLElement | null>(null);
  const viewModalRef = useRef<HTMLDivElement>(null);
  const viewTriggerRef = useRef<HTMLElement | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    purchase_number: '',
    supplier: '',
    date: new Date().toISOString().slice(0, 10),
    items: [] as Omit<PurchaseItem, 'id'>[],
    notes: ''
  });

  const [formError, setFormError] = useState('');

  // F-08 Add/Edit Purchase Modal: Focus Trap & Escape (GUARDED_CONFIRM_REQUIRED)
  useEffect(() => {
    if (!isModalOpen) return;
    purchaseTriggerRef.current = document.activeElement as HTMLElement | null;

    const timer = setTimeout(() => {
      const input = purchaseModalRef.current?.querySelector<HTMLInputElement>('input[type="text"], input[type="date"]');
      input?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSubmitting) return;
        e.preventDefault();
        const isDirty = formData.items.length > 0 || formData.supplier.trim() !== '' || formData.notes.trim() !== '';
        if (isDirty) {
          if (window.confirm('Batalkan pengisian nota pembelian? Data item yang telah dimasukkan akan hilang.')) {
            setIsModalOpen(false);
          }
        } else {
          setIsModalOpen(false);
        }
        return;
      }

      if (e.key === 'Tab' && purchaseModalRef.current) {
        const focusables = purchaseModalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      if (purchaseTriggerRef.current && typeof purchaseTriggerRef.current.focus === 'function') {
        purchaseTriggerRef.current.focus();
      }
    };
  }, [isModalOpen, isSubmitting, formData.items.length, formData.supplier, formData.notes]);

  // F-08 View Detail Nota Modal: Focus Trap & Escape (SAFE_TO_CLOSE)
  useEffect(() => {
    if (!viewingPurchase) return;
    viewTriggerRef.current = document.activeElement as HTMLElement | null;

    const timer = setTimeout(() => {
      const closeBtn = viewModalRef.current?.querySelector<HTMLButtonElement>('button');
      closeBtn?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setViewingPurchase(null);
        return;
      }

      if (e.key === 'Tab' && viewModalRef.current) {
        const focusables = viewModalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
      if (viewTriggerRef.current && typeof viewTriggerRef.current.focus === 'function') {
        viewTriggerRef.current.focus();
      }
    };
  }, [viewingPurchase]);

  // Normalisasi tanggal apapun formatnya (ISO string dengan waktu, Date object,
  // string dari database, dll) jadi "YYYY-MM-DD" biar cocok sama <input type="date">.
  const toDateInputValue = (value: any): string => {
    if (!value) return new Date().toISOString().slice(0, 10);
    if (typeof value === 'string') {
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

  const createDefaultItem = (stock: Stock): Omit<PurchaseItem, 'id'> => {
    const defaultPkgUnit = stock.default_package_unit || (stock.unit === 'Gram' ? 'Kg' : stock.unit === 'ml' ? 'Botol' : 'Pak');
    const defaultConversionRatio = stock.default_package_size !== undefined && stock.default_package_size > 0
      ? stock.default_package_size
      : (stock.unit === 'Gram' ? 1000 : stock.unit === 'ml' ? 1000 : 1);
    const defaultPkgPrice = stock.default_package_price !== undefined && stock.default_package_price > 0
      ? stock.default_package_price
      : (stock.cost_per_unit * defaultConversionRatio);
    const packageQty = 1;
    const totalBaseQty = packageQty * defaultConversionRatio;
    const totalCost = packageQty * defaultPkgPrice;
    const costPerBaseUnit = totalBaseQty > 0 ? totalCost / totalBaseQty : stock.cost_per_unit;

    return {
      stock_id: stock.id,
      stock_name: stock.name,
      package_qty: packageQty,
      package_unit: defaultPkgUnit,
      conversion_ratio: defaultConversionRatio,
      package_price: defaultPkgPrice,
      qty: totalBaseQty,
      unit: stock.unit,
      unit_cost: costPerBaseUnit,
      total_cost: totalCost,
      conversion_status: 'verified'
    };
  };

  const handleOpenAdd = () => {
    setEditingPurchase(null);
    setFormError('');
    const defaultStock = stocks[0];
    setFormData({
      purchase_number: `PUR-${Date.now().toString().slice(-6)}`,
      supplier: 'CV Jaya Abadi Supplier',
      date: new Date().toISOString().slice(0, 10),
      items: defaultStock ? [createDefaultItem(defaultStock)] : [],
      notes: ''
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
      items: purchase.items.map(i => {
        const stock = stocks.find(s => String(s.id) === String(i.stock_id));
        const baseUnit = i.unit || (stock ? stock.unit : 'Gram');
        const hasPkg = i.package_qty !== undefined && i.conversion_ratio !== undefined;
        return {
          stock_id: i.stock_id,
          stock_name: i.stock_name,
          package_qty: hasPkg ? i.package_qty! : (i.qty || 1),
          package_unit: hasPkg ? (i.package_unit || 'Kemasan') : baseUnit,
          conversion_ratio: hasPkg ? i.conversion_ratio! : 1,
          package_price: hasPkg ? (i.package_price || i.unit_cost) : (i.unit_cost || 0),
          qty: i.qty,
          unit: baseUnit,
          unit_cost: i.unit_cost,
          total_cost: i.total_cost,
          conversion_status: i.conversion_status || 'verified'
        };
      }),
      notes: purchase.notes || ''
    });
    setIsModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingPurchase || deleteLock.current) return;
    deleteLock.current = true;
    setIsDeleting(true);
    try {
      await removePurchase(deletingPurchase.id);
      showToast('Nota pembelian berhasil dihapus', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Gagal menghapus nota pembelian', 'error');
    } finally {
      deleteLock.current = false;
      setIsDeleting(false);
      setDeletingPurchase(null);
    }
  };

  // Item list handlers
  const handleAddItem = () => {
    if (stocks.length === 0) return;
    const defaultStock = stocks[0];
    setFormData(prev => ({
      ...prev,
      items: [...prev.items, createDefaultItem(defaultStock)]
    }));
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    setFormData(prev => {
      const updated = [...prev.items];
      const target = { ...updated[index] };

      if (field === 'stock_id') {
        const found = stocks.find(s => s.id != null && value != null && String(s.id) === String(value));
        if (found) {
          const freshItem = createDefaultItem(found);
          updated[index] = freshItem;
          return { ...prev, items: updated };
        }
      } else if (field === 'package_qty') {
        target.package_qty = Number(value) || 0;
      } else if (field === 'package_unit') {
        target.package_unit = String(value);
      } else if (field === 'conversion_ratio') {
        target.conversion_ratio = Number(value) || 0;
      } else if (field === 'package_price') {
        target.package_price = Number(value) || 0;
      }

      // Hitung ulang konversi stok dan biaya
      const pkgQty = target.package_qty !== undefined ? target.package_qty : 1;
      const ratio = target.conversion_ratio !== undefined ? target.conversion_ratio : 1;
      const pkgPrice = target.package_price !== undefined ? target.package_price : 0;

      const totalBaseQty = pkgQty * ratio;
      const totalCost = Math.round(pkgQty * pkgPrice);
      const costPerBaseUnit = totalBaseQty > 0 ? totalCost / totalBaseQty : 0;

      target.qty = totalBaseQty;
      target.total_cost = totalCost;
      target.unit_cost = costPerBaseUnit;

      updated[index] = target;
      return { ...prev, items: updated };
    });
  };

  const handleSetDirectBaseUnit = (index: number) => {
    setFormData(prev => {
      const updated = [...prev.items];
      const target = { ...updated[index] };
      const stock = stocks.find(s => String(s.id) === String(target.stock_id));
      const baseUnit = target.unit || (stock ? stock.unit : 'Gram');
      const baseCost = stock ? stock.cost_per_unit : target.unit_cost;

      target.package_unit = baseUnit;
      target.conversion_ratio = 1;
      target.package_price = baseCost;
      const pkgQty = target.package_qty || 1;
      target.qty = pkgQty * 1;
      target.total_cost = Math.round(pkgQty * baseCost);
      target.unit_cost = baseCost;

      updated[index] = target;
      return { ...prev, items: updated };
    });
  };

  const handleSetDefaultPackage = (index: number) => {
    setFormData(prev => {
      const updated = [...prev.items];
      const target = { ...updated[index] };
      const stock = stocks.find(s => String(s.id) === String(target.stock_id));
      if (stock) {
        const fresh = createDefaultItem(stock);
        fresh.package_qty = target.package_qty || 1;
        fresh.qty = fresh.package_qty * (fresh.conversion_ratio || 1);
        fresh.total_cost = Math.round(fresh.package_qty * (fresh.package_price || 0));
        fresh.unit_cost = fresh.qty > 0 ? fresh.total_cost / fresh.qty : fresh.unit_cost;
        updated[index] = fresh;
      }
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
    return formData.items.reduce((sum, item) => sum + (item.total_cost || 0), 0);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLock.current) return;

    if (!formData.supplier.trim()) {
      setFormError('Nama supplier wajib diisi');
      return;
    }
    if (formData.items.length === 0) {
      setFormError('Tambahkan minimal 1 barang belanjaan');
      return;
    }

    // Validasi ketat setiap item menggunakan validatePackagingConversion
    for (let idx = 0; idx < formData.items.length; idx++) {
      const item = formData.items[idx];
      const stock = stocks.find(s => String(s.id) === String(item.stock_id));
      if (!stock) {
        setFormError(`Item #${idx + 1}: Bahan baku tidak valid`);
        return;
      }

      const pkgQty = Number(item.package_qty);
      const ratio = Number(item.conversion_ratio);
      const pkgPrice = Number(item.package_price);

      const validation = validatePackagingConversion({
        stockName: stock.name,
        baseUnit: stock.unit,
        packageQty: pkgQty,
        conversionRatio: ratio,
        packagePrice: pkgPrice,
        packageUnit: item.package_unit
      });

      if (!validation.isValid) {
        setFormError(`Item #${idx + 1} (${stock.name}): ${validation.error}`);
        return;
      }
    }

    const totalAmount = calculateTotalAmount();

    const itemsWithIds: PurchaseItem[] = formData.items.map((item, idx) => ({
      id: `pitem-${Date.now()}-${idx}`,
      ...item
    }));

    submitLock.current = true;
    setIsSubmitting(true);
    try {
      if (editingPurchase) {
        await editPurchase(editingPurchase.id, {
          purchase_number: formData.purchase_number,
          supplier: formData.supplier,
          date: formData.date,
          total_amount: totalAmount,
          notes: formData.notes,
          items: itemsWithIds
        });
        showToast('Nota pembelian berhasil diperbarui', 'success');
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
        showToast('Pembelian baru berhasil dicatat', 'success');
      }

      setIsModalOpen(false);
    } catch (err: any) {
      setFormError(err.message || 'Gagal menyimpan transaksi pembelian');
    } finally {
      submitLock.current = false;
      setIsSubmitting(false);
    }
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
            Catat pembelian kemasan supplier. Stok otomatis dikonversi ke satuan dasar (Gram, ml, Pcs) dan HPP diperbarui secara akurat.
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
        {/* Desktop Table: scrollable with sticky header */}
        <div className="hidden md:block overflow-x-auto max-h-[460px] overflow-y-auto">
          <table className="w-full text-left text-xs min-w-[650px]">
            <thead className="sticky top-0 z-10 bg-stone-50 dark:bg-[#23201D] border-b border-stone-200 dark:border-stone-800 text-stone-500 font-extrabold uppercase tracking-wider">
              <tr>
                <th className="p-4">No. Pembelian / Nota</th>
                <th className="p-4">Supplier / Vendor</th>
                <th className="p-4">Tanggal Nota</th>
                <th className="p-4">Rincian Belanja & Konversi</th>
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
                        {pur.items.map(item => {
                          const hasPkg = item.package_qty !== undefined && item.conversion_ratio !== undefined && item.conversion_ratio !== 1;
                          return (
                            <span
                              key={item.id}
                              className="px-2.5 py-1 rounded-xl bg-stone-100 dark:bg-[#25221F] text-stone-800 dark:text-stone-200 font-bold text-[10px] border border-stone-200 dark:border-stone-800"
                            >
                              {item.stock_name}: {hasPkg ? `${item.package_qty} ${item.package_unit || 'Kemasan'} (${item.qty} ${item.unit})` : `${item.qty} ${item.unit}`}
                            </span>
                          );
                        })}
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
                          className="min-w-[32px] min-h-[32px] p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 transition-colors cursor-pointer flex items-center justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#3B2A1F] dark:focus-visible:ring-[#D4A373]"
                          title="Lihat Detail Nota"
                          aria-label={`Lihat detail nota ${pur.purchase_number}`}
                        >
                          <Eye className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(pur)}
                          className="min-w-[32px] min-h-[32px] p-2 rounded-xl bg-stone-100 dark:bg-stone-800 text-stone-700 dark:text-stone-300 hover:bg-stone-200 transition-colors cursor-pointer flex items-center justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#3B2A1F] dark:focus-visible:ring-[#D4A373]"
                          title="Edit Pembelian"
                          aria-label={`Edit pembelian ${pur.purchase_number}`}
                        >
                          <Edit2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingPurchase(pur)}
                          className="min-w-[32px] min-h-[32px] p-2 rounded-xl bg-rose-500/10 text-rose-600 hover:bg-rose-500/20 transition-colors cursor-pointer flex items-center justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#3B2A1F] dark:focus-visible:ring-[#D4A373]"
                          title="Batalkan Nota Pembelian (Dibatasi)"
                          aria-label={`Batalkan nota ${pur.purchase_number}`}
                        >
                          <Trash2 className="w-4 h-4" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Touch Cards */}
        <div className="md:hidden divide-y divide-stone-100 dark:divide-stone-800/60">
          {filteredPurchases.length === 0 ? (
            <div className="p-8 text-center text-stone-400 font-semibold text-xs">
              Tidak ada catatan pembelian.
            </div>
          ) : (
            filteredPurchases.map(pur => (
              <div key={`mobile-purchase-${pur.id}`} className="p-4 space-y-3 hover:bg-stone-50/50 dark:hover:bg-[#25221F] transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-stone-900 dark:text-stone-100 text-sm">
                      {pur.purchase_number}
                    </p>
                    <p className="text-[11px] text-stone-400">
                      {pur.notes || 'Tanpa catatan'}
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-stone-500 dark:text-stone-400 shrink-0">
                    {pur.date}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs font-bold text-stone-700 dark:text-stone-300">
                  <Truck className="w-3.5 h-3.5 text-[#C68B59] shrink-0" />
                  <span className="truncate">{pur.supplier}</span>
                </div>

                <div className="flex flex-wrap gap-1">
                  {pur.items.map(item => {
                    const hasPkg = item.package_qty !== undefined && item.conversion_ratio !== undefined && item.conversion_ratio !== 1;
                    return (
                      <span
                        key={`m-item-${item.id}`}
                        className="px-2 py-0.5 rounded-lg bg-stone-100 dark:bg-[#25221F] text-stone-800 dark:text-stone-200 font-bold text-[10px] border border-stone-200 dark:border-stone-800"
                      >
                        {item.stock_name}: {hasPkg ? `${item.package_qty} ${item.package_unit || 'Kemasan'} (${item.qty} ${item.unit})` : `${item.qty} ${item.unit}`}
                      </span>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-stone-100 dark:border-stone-800/60 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[10px] text-stone-400 font-bold uppercase tracking-wider">Total Biaya</p>
                    <p className="font-black text-[#3B2A1F] dark:text-[#D4A373] text-sm">
                      {formatRupiah(pur.total_amount)}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setViewingPurchase(pur)}
                      className="min-h-[44px] px-3 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      title="Lihat Detail Nota"
                      aria-label={`Lihat detail nota ${pur.purchase_number}`}
                    >
                      <Eye className="w-4 h-4" />
                      Detail
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(pur)}
                      className="min-h-[44px] px-3 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-300 font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      title="Edit Pembelian"
                      aria-label={`Edit pembelian ${pur.purchase_number}`}
                    >
                      <Edit2 className="w-4 h-4 text-[#C68B59]" />
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeletingPurchase(pur)}
                      className="min-h-[44px] px-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 text-rose-600 dark:text-rose-400 font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                      title="Batalkan Nota Pembelian"
                      aria-label={`Batalkan nota ${pur.purchase_number}`}
                    >
                      <Trash2 className="w-4 h-4" />
                      Hapus
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal Add / Edit Purchase */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div 
            ref={purchaseModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="purchase-modal-title"
            className="relative w-full max-w-2xl bg-white dark:bg-[#1E1C1A] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col max-h-[90dvh] my-auto overflow-hidden"
          >
            {/* Pinned Header */}
            <div className="flex justify-between items-center px-5 sm:px-6 py-4 border-b border-stone-100 dark:border-stone-800 shrink-0 bg-white dark:bg-[#1E1C1A]">
              <h3 id="purchase-modal-title" className="font-extrabold text-base text-stone-900 dark:text-stone-100">
                {editingPurchase ? 'Edit Catatan Pembelian' : 'Catat Belanja Bahan Baru'}
              </h3>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => !isSubmitting && setIsModalOpen(false)}
                className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer flex items-center justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#3B2A1F] dark:focus-visible:ring-[#D4A373] disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Tutup modal pembelian"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              {/* Scrollable Form Body */}
              <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-4 text-xs">
                {editingPurchase && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl text-[11px] text-amber-900 dark:text-amber-200 font-semibold space-y-1">
                    <p className="font-extrabold flex items-center gap-1.5 text-amber-800 dark:text-amber-300">
                      <Info className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>Mode Edit Nota Pembelian (Hanya Header)</span>
                    </p>
                    <p className="leading-relaxed">
                      Demi menjaga integritas nilai buku persediaan (WAC) dan riwayat mutasi stok, rincian barang belanjaan, nomor nota, tanggal, dan total nilai bersifat tetap (read-only). Hanya nama supplier dan catatan yang dapat diperbarui.
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      No. Nota / Invoice <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      disabled={Boolean(editingPurchase)}
                      value={formData.purchase_number}
                      onChange={e => setFormData({ ...formData, purchase_number: e.target.value })}
                      className={`w-full px-3.5 py-2.5 rounded-xl border font-extrabold focus:outline-none ${
                        editingPurchase
                          ? 'bg-stone-100 dark:bg-stone-800/60 border-stone-200 dark:border-stone-800 text-stone-500 cursor-not-allowed'
                          : 'bg-stone-50 dark:bg-[#171514] border-stone-300 dark:border-stone-700'
                      }`}
                    />
                  </div>

                  <div>
                    <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                      Tanggal Pembelian <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      required
                      disabled={Boolean(editingPurchase)}
                      value={formData.date}
                      onChange={e => setFormData({ ...formData, date: e.target.value })}
                      className={`w-full px-3.5 py-2.5 rounded-xl border font-semibold focus:outline-none ${
                        editingPurchase
                          ? 'bg-stone-100 dark:bg-stone-800/60 border-stone-200 dark:border-stone-800 text-stone-500 cursor-not-allowed'
                          : 'bg-stone-50 dark:bg-[#171514] border-stone-300 dark:border-stone-700'
                      }`}
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
                <div className="space-y-3 p-3.5 bg-stone-50 dark:bg-[#161413] rounded-2xl border border-stone-200 dark:border-stone-800">
                  <div className="flex justify-between items-center">
                    <label className="block font-extrabold text-stone-800 dark:text-stone-200 uppercase text-[11px]">
                      DAFTAR BARANG DIBELI & KONVERSI KEMASAN
                    </label>
                    {!editingPurchase && (
                      <button
                        type="button"
                        onClick={handleAddItem}
                        className="px-3 py-1 rounded-xl bg-[#3B2A1F] text-[#F7F5F2] font-bold text-[11px] flex items-center gap-1 hover:bg-[#2A1E16] cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 text-[#D4A373]" />
                        Tambah Barang
                      </button>
                    )}
                  </div>

                  {formData.items.length === 0 ? (
                    <p className="text-stone-400 italic text-center py-2">Belum ada barang dibeli.</p>
                  ) : (
                    formData.items.map((item, idx) => {
                      const currentStock = stocks.find(s => String(s.id) === String(item.stock_id));
                      const baseUnit = currentStock ? currentStock.unit : (item.unit || 'Gram');
                      const isDirectBase = (item.conversion_ratio === 1) && (item.package_unit === baseUnit);

                      return (
                        <div key={idx} className="space-y-2.5 bg-white dark:bg-[#1E1C1A] p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 shadow-xs">
                          {/* Header Item: Select Stock and Action */}
                          <div className="flex items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800/80 pb-2">
                            <div className="flex-1">
                              <label className="block font-bold text-stone-500 text-[10px] mb-0.5">
                                Bahan Baku (Satuan Dasar: <strong className="text-[#3B2A1F] dark:text-[#D4A373]">{baseUnit}</strong>)
                              </label>
                              <select
                                disabled={Boolean(editingPurchase)}
                                value={item.stock_id}
                                onChange={e => handleItemChange(idx, 'stock_id', e.target.value)}
                                className={`w-full px-2.5 py-1.5 rounded-xl border font-bold text-[11px] ${
                                  editingPurchase
                                    ? 'bg-stone-100 dark:bg-stone-800/60 border-stone-200 dark:border-stone-800 text-stone-500 cursor-not-allowed'
                                    : 'bg-stone-50 dark:bg-[#171514] border-stone-300 dark:border-stone-700'
                                }`}
                              >
                                {stocks.map(s => (
                                  <option key={s.id} value={s.id}>{s.name} ({s.unit})</option>
                                ))}
                              </select>
                            </div>

                            {!editingPurchase && (
                              <div className="flex items-center gap-1 pt-3">
                                <button
                                  type="button"
                                  onClick={() => handleSetDirectBaseUnit(idx)}
                                  title={`Beli langsung dalam satuan dasar (${baseUnit})`}
                                  className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-colors cursor-pointer ${
                                    isDirectBase
                                      ? 'bg-stone-200 dark:bg-stone-700 border-stone-400 dark:border-stone-600 text-stone-900 dark:text-stone-100'
                                      : 'bg-stone-100 dark:bg-stone-800 border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-400 hover:bg-stone-200'
                                  }`}
                                >
                                  Beli {baseUnit} Langsung
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSetDefaultPackage(idx)}
                                  title="Gunakan kemasan default supplier"
                                  className="px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/60 text-amber-800 dark:text-amber-300 hover:bg-amber-100 transition-colors cursor-pointer"
                                >
                                  Kemasan Supplier
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveItem(idx)}
                                  className="min-w-[32px] min-h-[32px] p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer ml-1 flex items-center justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500"
                                  title="Hapus baris barang ini"
                                  aria-label={`Hapus baris barang ${item.stock_name || (idx + 1)}`}
                                >
                                  <X className="w-4 h-4" aria-hidden="true" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Package & Conversion Details Input Grid */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            <div>
                              <label className="block font-bold text-stone-500 text-[10px] mb-0.5">
                                Jumlah Kemasan
                              </label>
                              <NumberInput
                                disabled={Boolean(editingPurchase)}
                                min={0.001}
                                allowDecimals={baseUnit !== 'Pcs'}
                                value={item.package_qty ?? 1}
                                onChange={val => handleItemChange(idx, 'package_qty', val)}
                                className={`w-full px-2.5 py-1.5 rounded-xl border font-bold text-[11px] ${
                                  editingPurchase
                                    ? 'bg-stone-100 dark:bg-stone-800/60 border-stone-200 dark:border-stone-800 text-stone-500 cursor-not-allowed'
                                    : 'bg-stone-50 dark:bg-[#171514] border-stone-300 dark:border-stone-700'
                                }`}
                              />
                            </div>

                            <div>
                              <label className="block font-bold text-stone-500 text-[10px] mb-0.5">
                                Label / Satuan Kemasan
                              </label>
                              <input
                                type="text"
                                disabled={Boolean(editingPurchase)}
                                value={item.package_unit || ''}
                                onChange={e => handleItemChange(idx, 'package_unit', e.target.value)}
                                placeholder="Misal: Kg, Botol, Pak"
                                className={`w-full px-2.5 py-1.5 rounded-xl border font-bold text-[11px] ${
                                  editingPurchase
                                    ? 'bg-stone-100 dark:bg-stone-800/60 border-stone-200 dark:border-stone-800 text-stone-500 cursor-not-allowed'
                                    : 'bg-stone-50 dark:bg-[#171514] border-stone-300 dark:border-stone-700'
                                }`}
                              />
                            </div>

                            <div>
                              <label className="block font-bold text-stone-500 text-[10px] mb-0.5">
                                Isi per Kemasan ({baseUnit})
                              </label>
                              <NumberInput
                                disabled={Boolean(editingPurchase)}
                                min={0.001}
                                allowDecimals={baseUnit !== 'Pcs'}
                                value={item.conversion_ratio ?? 1}
                                onChange={val => handleItemChange(idx, 'conversion_ratio', val)}
                                className={`w-full px-2.5 py-1.5 rounded-xl border font-bold text-[11px] ${
                                  editingPurchase
                                    ? 'bg-stone-100 dark:bg-stone-800/60 border-stone-200 dark:border-stone-800 text-stone-500 cursor-not-allowed'
                                    : 'bg-stone-50 dark:bg-[#171514] border-stone-300 dark:border-stone-700'
                                }`}
                              />
                            </div>

                            <div>
                              <label className="block font-bold text-stone-500 text-[10px] mb-0.5">
                                Harga / Kemasan (Rp)
                              </label>
                              <NumberInput
                                disabled={Boolean(editingPurchase)}
                                isCurrency={true}
                                min={0}
                                value={item.package_price ?? 0}
                                onChange={val => handleItemChange(idx, 'package_price', val)}
                                placeholder="Rp 0"
                                className={`w-full px-2.5 py-1.5 rounded-xl border font-bold text-[11px] ${
                                  editingPurchase
                                    ? 'bg-stone-100 dark:bg-stone-800/60 border-stone-200 dark:border-stone-800 text-stone-500 cursor-not-allowed'
                                    : 'bg-stone-50 dark:bg-[#171514] border-stone-300 dark:border-stone-700'
                                }`}
                              />
                            </div>
                          </div>

                          {/* Live Conversion Preview Banner */}
                          <div className="p-2.5 rounded-xl bg-[#3B2A1F]/5 dark:bg-[#D4A373]/5 border border-[#3B2A1F]/15 dark:border-[#D4A373]/20 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <div className="flex items-center gap-1.5 font-bold text-[#3B2A1F] dark:text-[#D4A373]">
                              <PackageCheck className="w-4 h-4 text-[#C68B59]" />
                              <span>Hasil Konversi:</span>
                              <span className="font-semibold text-stone-700 dark:text-stone-300">
                                {item.package_qty ?? 0} {item.package_unit || 'Kemasan'} × {item.conversion_ratio ?? 0} {baseUnit}
                              </span>
                              <ArrowRight className="w-3.5 h-3.5 text-stone-400" />
                              <span className="px-2 py-0.5 rounded-lg bg-[#3B2A1F] text-[#F7F5F2] font-black text-xs">
                                +{item.qty ?? 0} {baseUnit}
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              <span className="text-stone-500 font-medium">
                                Modal: <strong className="text-stone-800 dark:text-stone-200">{formatRupiah(item.unit_cost ?? 0)}/{baseUnit}</strong>
                              </span>
                              <span className="text-stone-300 dark:text-stone-700">|</span>
                              <span className="text-stone-500 font-medium">
                                Subtotal: <strong className="text-[#3B2A1F] dark:text-[#D4A373] font-black">{formatRupiah(item.total_cost ?? 0)}</strong>
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
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
                  <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{formError}</span>
                  </div>
                )}
              </div>

              {/* Pinned Action Footer */}
              <div className="flex flex-col-reverse sm:flex-row justify-end gap-2.5 px-5 sm:px-6 py-4 border-t border-stone-100 dark:border-stone-800 shrink-0 bg-stone-50/50 dark:bg-[#1A1816]/50">
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => !isSubmitting && setIsModalOpen(false)}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-xl font-bold border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer text-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`w-full sm:w-auto px-5 py-2.5 rounded-xl font-extrabold shadow-md transition-all text-center ${
                    isSubmitting
                      ? 'bg-stone-400 dark:bg-stone-700 text-stone-200 cursor-not-allowed shadow-none'
                      : 'bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] cursor-pointer'
                  }`}
                >
                  {isSubmitting ? 'Menyimpan...' : (editingPurchase ? 'Simpan Catatan & Supplier' : 'Simpan & Tambah Stok')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Detail View */}
      {viewingPurchase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
          <div 
            ref={viewModalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="view-purchase-title"
            className="relative w-full max-w-lg bg-white dark:bg-[#1E1C1A] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 flex flex-col max-h-[90dvh] my-auto overflow-hidden"
          >
            {/* Pinned Header */}
            <div className="flex justify-between items-center px-5 sm:px-6 py-4 border-b border-stone-100 dark:border-stone-800 shrink-0 bg-white dark:bg-[#1E1C1A]">
              <div>
                <h3 id="view-purchase-title" className="font-extrabold text-base text-stone-900 dark:text-stone-100">
                  Detail Nota {viewingPurchase.purchase_number}
                </h3>
                <p className="text-[11px] text-stone-400 font-medium">Tanggal: {viewingPurchase.date}</p>
              </div>
              <button
                type="button"
                onClick={() => setViewingPurchase(null)}
                className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer flex items-center justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#3B2A1F] dark:focus-visible:ring-[#D4A373]"
                aria-label="Tutup detail nota pembelian"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            {/* Scrollable Detail Body */}
            <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 space-y-3 text-xs">
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
                <p className="font-extrabold text-stone-500 uppercase text-[10px]">Barang Yang Dibeli & Konversi Stok:</p>
                <div className="divide-y divide-stone-100 dark:divide-stone-800 border border-stone-200 dark:border-stone-800 rounded-2xl overflow-hidden">
                  {viewingPurchase.items.map(item => {
                    const hasPkg = item.package_qty !== undefined && item.conversion_ratio !== undefined && item.conversion_ratio !== 1;
                    return (
                      <div key={item.id} className="p-3 flex justify-between items-center bg-white dark:bg-[#1E1C1A]">
                        <div>
                          <p className="font-bold text-stone-900 dark:text-stone-100">{item.stock_name}</p>
                          {hasPkg ? (
                            <p className="text-[10px] text-stone-500">
                              {item.package_qty} {item.package_unit || 'Kemasan'} × {item.conversion_ratio} {item.unit} = <span className="font-bold text-stone-700 dark:text-stone-300">+{item.qty} {item.unit}</span> @ {formatRupiah(item.package_price || 0)} (Modal: {formatRupiah(item.unit_cost)}/{item.unit})
                            </p>
                          ) : (
                            <p className="text-[10px] text-stone-400">
                              +{item.qty} {item.unit} @ {formatRupiah(item.unit_cost)}/{item.unit}
                            </p>
                          )}
                        </div>
                        <span className="font-extrabold text-[#3B2A1F] dark:text-[#D4A373]">
                          {formatRupiah(item.total_cost)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="p-3 bg-[#3B2A1F] text-[#F7F5F2] rounded-2xl flex justify-between items-center font-black text-sm">
                <span>Total Pembelian:</span>
                <span className="text-[#D4A373] text-base">{formatRupiah(viewingPurchase.total_amount)}</span>
              </div>
            </div>

            {/* Pinned Action Footer */}
            <div className="px-5 sm:px-6 py-4 border-t border-stone-100 dark:border-stone-800 shrink-0 bg-stone-50/50 dark:bg-[#1A1816]/50">
              <button
                type="button"
                onClick={() => setViewingPurchase(null)}
                className="w-full py-2.5 rounded-xl bg-stone-200 dark:bg-stone-800 text-stone-800 dark:text-stone-200 font-bold hover:bg-stone-300 dark:hover:bg-stone-700 transition-colors cursor-pointer text-center"
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
        isLoading={isDeleting}
        title="Pembatalan Nota Dibatasi"
        message={`Demi menjaga integritas nilai buku persediaan (Weighted Average Cost), nota pembelian #${deletingPurchase?.purchase_number} yang telah dibukukan tidak dapat dihapus atau dibatalkan. Jika terdapat selisih fisik barang di booth, lakukan Penyesuaian Stok di menu Inventaris.`}
        confirmText="Coba Batalkan"
        cancelText="Tutup"
        isDanger={true}
        onConfirm={handleDeleteConfirm}
        onCancel={() => !isDeleting && setDeletingPurchase(null)}
      />
    </div>
  );
};