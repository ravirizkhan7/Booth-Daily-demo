import React, { useState } from 'react';
import { usePOS } from '../hooks/usePOS';
import { 
  Settings, Save, RefreshCw, Store, Phone, MapPin, Receipt, CheckCircle2, 
  Printer, Percent, Tag, Plus, Edit2, Trash2, ToggleLeft, ToggleRight, Info 
} from 'lucide-react';
import { printTestReceipt } from '../services/receiptPrint';
import { formatRupiah } from '../utils/formatters';
import { DiscountRule } from '../types';
import { DiscountRuleModal } from '../components/settings/DiscountRuleModal';
import { NumberInput } from '../components/common/NumberInput';
import { settingsService } from '../services/settingsService';

export const SettingsPage: React.FC = () => {
  const { 
    settings, 
    setSettings, 
    refreshData, 
    showToast, 
    currentUser,
    discountRules,
    addDiscountRule,
    editDiscountRule,
    toggleDiscountRuleStatus,
    removeDiscountRule,
  } = usePOS();

  const isOwner = currentUser?.role === 'owner';

  const [formData, setFormData] = useState({ ...settings });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Discount Modal State
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [editingDiscountRule, setEditingDiscountRule] = useState<DiscountRule | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | string | null>(null);

  // Sync formData when settings change from backend ONLY if user hasn't edited the draft
  React.useEffect(() => {
    if (!isDirty) {
      setFormData({ ...settings });
    }
  }, [settings, isDirty]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) {
      showToast('Hanya Owner yang dapat mengubah pengaturan', 'error');
      return;
    }

    const taxNum = Number(formData.tax_percentage ?? 0);

    if (isNaN(taxNum) || taxNum < 0 || taxNum > 100) {
      showToast('Tarif pajak harus antara 0% sampai 100%', 'error');
      return;
    }

    if (formData.phone && !/^\+?[0-9]+$/.test(formData.phone.trim())) {
      showToast('Nomor telepon hanya boleh berisi angka (dan tanda + di awal).', 'error');
      return;
    }

    const payload = {
      ...formData,
      tax_percentage: taxNum,
    };

    setIsSaving(true);
    try {
      const saved = await settingsService.updateSettings(payload);
      if (saved && saved.store_name) {
        setSettings(saved);
        setFormData(saved);
      } else {
        setSettings(payload as any);
        setFormData(payload as any);
      }
      setIsDirty(false);
      showToast('Pengaturan toko & tarif pajak berhasil disimpan!', 'success');
    } catch (err: any) {
      console.error('Failed to save settings:', err);
      showToast(err?.message || 'Gagal menyimpan pengaturan', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetData = async () => {
    if (isRefreshing) return;

    if (!window.confirm('Muat ulang seluruh data toko?')) {
      return;
    }

    setIsRefreshing(true);
    try {
      const isSuccess = await refreshData();
      setIsDirty(false);
      if (isSuccess) {
        showToast('Data toko berhasil dimuat ulang', 'success');
      } else {
        showToast('Beberapa data toko gagal dimuat ulang', 'info');
      }
    } catch (err: any) {
      console.error('Failed to reload data:', err);
      showToast('Gagal memuat ulang data toko', 'error');
    } finally {
      setIsRefreshing(false);
    }
  };

  // Discount Rule Handlers
  const handleOpenCreateDiscount = () => {
    setEditingDiscountRule(null);
    setIsDiscountModalOpen(true);
  };

  const handleOpenEditDiscount = (rule: DiscountRule) => {
    setEditingDiscountRule(rule);
    setIsDiscountModalOpen(true);
  };

  const handleSaveDiscount = async (payload: {
    name: string;
    minimum_purchase: number;
    discount_percentage: number;
    is_active?: boolean;
  }) => {
    if (editingDiscountRule) {
      await editDiscountRule(editingDiscountRule.id, payload);
      showToast('Promo diskon berhasil diperbarui', 'success');
    } else {
      await addDiscountRule(payload);
      showToast('Promo diskon baru berhasil ditambahkan', 'success');
    }
  };

  const handleToggleDiscount = async (rule: DiscountRule) => {
    setActionLoadingId(rule.id);
    try {
      await toggleDiscountRuleStatus(rule.id);
      showToast(
        `Promo "${rule.name}" ${rule.is_active ? 'dinonaktifkan' : 'diaktifkan'}`,
        'success'
      );
    } catch (err: any) {
      console.error('Failed to toggle discount rule:', err);
      showToast(err?.response?.data?.message || 'Gagal mengubah status promo', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleDeleteDiscount = async (rule: DiscountRule) => {
    if (!window.confirm(`Hapus aturan promo diskon "${rule.name}"?`)) {
      return;
    }

    setActionLoadingId(rule.id);
    try {
      await removeDiscountRule(rule.id);
      showToast('Promo diskon berhasil dihapus', 'success');
    } catch (err: any) {
      console.error('Failed to delete discount rule:', err);
      showToast(err?.response?.data?.message || 'Gagal menghapus promo diskon', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-black text-stone-900 dark:text-stone-100 flex items-center gap-2">
            <Settings className="w-6 h-6 text-[#C68B59]" />
            Pengaturan Aplikasi POS
          </h1>
          <p className="text-xs text-stone-500 font-medium">
            Atur identitas booth, tarif pajak penjualan, aturan promo diskon, dan format cetak struk.
          </p>
        </div>
      </div>

      {/* 1. FORM PENGATURAN TOKO & PAJAK */}
      <form onSubmit={handleSave} className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 p-4 sm:p-6 space-y-5 shadow-sm text-xs">
        <h3 className="font-extrabold text-sm text-[#3B2A1F] dark:text-[#D4A373] uppercase tracking-wider flex items-center gap-2">
          <Store className="w-4 h-4" /> Identitas Coffee Booth
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Nama Booth / Outlet</label>
            <input
              type="text"
              required
              value={formData.store_name}
              onChange={e => {
                setIsDirty(true);
                setFormData({ ...formData, store_name: e.target.value });
              }}
              className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold text-stone-900 dark:text-stone-100"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Slogan / Tagline</label>
            <input
              type="text"
              value={formData.tagline}
              onChange={e => {
                setIsDirty(true);
                setFormData({ ...formData, tagline: e.target.value });
              }}
              className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-semibold text-stone-900 dark:text-stone-100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Alamat Booth</label>
            <input
              type="text"
              value={formData.address}
              onChange={e => {
                setIsDirty(true);
                setFormData({ ...formData, address: e.target.value });
              }}
              className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-medium text-stone-900 dark:text-stone-100"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">No. WhatsApp / Telepon</label>
            <input
              type="tel"
              inputMode="tel"
              value={formData.phone}
              onChange={e => {
                setIsDirty(true);
                const cleaned = e.target.value.replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
                setFormData({ ...formData, phone: cleaned });
              }}
              placeholder="Contoh: 08123456789 atau +628123456789"
              className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-medium text-stone-900 dark:text-stone-100"
            />
          </div>
        </div>

        {/* TARIF PAJAK PENJUALAN (PPN) */}
        <div className="p-4 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 text-xs">
              <Percent className="w-4 h-4 text-[#C68B59]" />
              Tarif Pajak Penjualan (PPN %)
            </label>
            <span className="text-[11px] font-bold text-[#C68B59] bg-[#C68B59]/10 px-2 py-0.5 rounded-lg">
              Saat ini: {formData.tax_percentage ?? 0}%
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <NumberInput
                min={0}
                max={100}
                allowDecimals={true}
                required
                value={Number(formData.tax_percentage) || 0}
                onChange={val => {
                  setIsDirty(true);
                  setFormData(prev => ({
                    ...prev,
                    tax_percentage: val,
                  }));
                }}
                className="w-28 px-3.5 py-2 rounded-xl bg-white dark:bg-[#1E1C1A] border border-stone-300 dark:border-stone-700 font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-[#C68B59]"
              />
              <span className="font-bold text-stone-600 dark:text-stone-400">%</span>
            </div>
            <span className="text-[11px] text-stone-500 font-medium">
              Pajak diterapkan otomatis pada checkout kasir setelah potongan promo diskon. Isi 0 jika tanpa pajak.
            </span>
          </div>
        </div>

        <hr className="border-stone-100 dark:border-stone-800" />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="font-extrabold text-sm text-[#3B2A1F] dark:text-[#D4A373] uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-4 h-4" /> Pesan Cetak Struk
          </h3>
          <button
            type="button"
            onClick={() => {
              printTestReceipt(formData);
              showToast('Test print sedang diproses...', 'info');
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#C68B59] hover:bg-[#B37845] text-white font-bold text-xs shadow-sm transition-colors cursor-pointer w-full sm:w-auto"
          >
            <Printer className="w-4 h-4" /> Test Print Thermal
          </button>
        </div>

        <div>
          <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Pesan Atas (Receipt Header)</label>
          <input
            type="text"
            value={formData.receipt_header}
            onChange={e => {
              setIsDirty(true);
              setFormData({ ...formData, receipt_header: e.target.value });
            }}
            className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-medium text-stone-900 dark:text-stone-100"
          />
        </div>

        <div>
          <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">Pesan Bawah (Receipt Footer)</label>
          <textarea
            value={formData.receipt_footer}
            onChange={e => {
              setIsDirty(true);
              setFormData({ ...formData, receipt_footer: e.target.value });
            }}
            className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-medium text-stone-900 dark:text-stone-100"
          />
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-3 pt-4 border-t border-stone-100 dark:border-stone-800">
          <button
            type="button"
            onClick={handleResetData}
            disabled={isRefreshing}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 font-bold text-xs transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Memuat Data...' : 'Muat Ulang Data'}
          </button>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-bold text-sm shadow-md disabled:opacity-60 cursor-pointer"
          >
            <Save className="w-4 h-4 text-[#D4A373]" /> {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
          </button>
        </div>
      </form>

      {/* 2. MANAJEMEN PROMO DISKON (OWNER ONLY) */}
      {isOwner && (
        <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 p-4 sm:p-6 space-y-5 shadow-sm text-xs">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <h3 className="font-extrabold text-sm text-[#3B2A1F] dark:text-[#D4A373] uppercase tracking-wider flex items-center gap-2">
                <Tag className="w-4 h-4" /> Manajemen Promo Diskon
              </h3>
              <p className="text-[11px] text-stone-500 font-medium">
                Aturan potongan diskon otomatis di kasir berbasis minimum belanja (non-stacking).
              </p>
            </div>

            <button
              type="button"
              onClick={handleOpenCreateDiscount}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-bold text-xs shadow-sm transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4 text-[#D4A373]" />
              Tambah Promo
            </button>
          </div>

          {/* List Discount Rules */}
          {discountRules.length === 0 ? (
            <div className="text-center py-8 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-dashed border-stone-200 dark:border-stone-800">
              <Tag className="w-8 h-8 text-stone-300 dark:text-stone-700 mx-auto mb-2" />
              <p className="font-bold text-stone-600 dark:text-stone-400">Belum ada promo diskon aktif</p>
              <p className="text-[11px] text-stone-400 mt-0.5">Klik 'Tambah Promo' untuk membuat potongan harga otomatis.</p>
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-800">
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-stone-50 dark:bg-[#171514] text-stone-600 dark:text-stone-400 font-bold border-b border-stone-200 dark:border-stone-800">
                    <th className="p-3.5">Nama Promo</th>
                    <th className="p-3.5">Min. Belanja</th>
                    <th className="p-3.5">Potongan</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium">
                  {discountRules.map(rule => (
                    <tr key={rule.id} className="hover:bg-stone-50/50 dark:hover:bg-[#171514]/50 transition-colors">
                      <td className="p-3.5">
                        <span className="font-extrabold text-stone-900 dark:text-stone-100 text-xs">
                          {rule.name}
                        </span>
                      </td>
                      <td className="p-3.5 font-bold text-stone-700 dark:text-stone-300">
                        {rule.minimum_purchase > 0 ? formatRupiah(rule.minimum_purchase) : 'Tanpa Minimum'}
                      </td>
                      <td className="p-3.5">
                        <span className="inline-flex items-center font-black text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg text-xs">
                          {rule.discount_percentage}%
                        </span>
                      </td>
                      <td className="p-3.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleToggleDiscount(rule)}
                          disabled={actionLoadingId === rule.id}
                          className="inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          title={rule.is_active ? 'Klik untuk nonaktifkan' : 'Klik untuk aktifkan'}
                        >
                          {rule.is_active ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full hover:bg-emerald-500/20 transition-colors">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-400 bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-full hover:bg-stone-200 transition-colors">
                              Nonaktif
                            </span>
                          )}
                        </button>
                      </td>
                      <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEditDiscount(rule)}
                            disabled={actionLoadingId === rule.id}
                            className="p-1.5 rounded-lg text-stone-500 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer disabled:opacity-50"
                            title="Edit Promo"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteDiscount(rule)}
                            disabled={actionLoadingId === rule.id}
                            className="p-1.5 rounded-lg text-rose-500 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors cursor-pointer disabled:opacity-50"
                            title="Hapus Promo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL CREATE / EDIT DISCOUNT */}
      <DiscountRuleModal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        onSave={handleSaveDiscount}
        initialData={editingDiscountRule}
      />
    </div>
  );
};

