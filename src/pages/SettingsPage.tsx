import React, { useState } from 'react';
import { usePOS } from '../hooks/usePOS';
import { 
  Settings, Save, RefreshCw, Store, Receipt, CheckCircle2, 
  Printer, Percent, Tag, Plus, Edit2, Trash2, Clock,
  Upload, Image as ImageIcon, Coffee, ShieldCheck, Download,
  RotateCcw, AlertTriangle
} from 'lucide-react';
import { formatRupiah } from '../utils/formatters';
import { DiscountRule, Settings as StoreSettings, ReceiptPaperSize } from '../types';
import { DiscountRuleModal } from '../components/settings/DiscountRuleModal';
import { BackupModal } from '../components/settings/BackupModal';
import { RestoreModal } from '../components/settings/RestoreModal';
import { FactoryResetModal } from '../components/settings/FactoryResetModal';
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
    appLogo,
    printerLogo,
    uploadAppLogo,
    deleteAppLogo,
    uploadPrinterLogo,
    deletePrinterLogo,
  } = usePOS();

  const isOwner = currentUser?.role === 'owner';

  const [formData, setFormData] = useState<StoreSettings>({
    ...settings,
    operational_day_cutoff_time: settings?.operational_day_cutoff_time || '04:00',
    receipt_paper_size: settings?.receipt_paper_size === '58mm' ? '58mm' : '80mm',
  });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Discount Modal State
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false);
  const [editingDiscountRule, setEditingDiscountRule] = useState<DiscountRule | null>(null);
  const [actionLoadingId, setActionLoadingId] = useState<number | string | null>(null);

  // Logo Upload & Delete State
  const [isUploadingAppLogo, setIsUploadingAppLogo] = useState(false);
  const [isDeletingAppLogo, setIsDeletingAppLogo] = useState(false);
  const [isUploadingPrinterLogo, setIsUploadingPrinterLogo] = useState(false);
  const [isDeletingPrinterLogo, setIsDeletingPrinterLogo] = useState(false);

  const appLogoInputRef = React.useRef<HTMLInputElement | null>(null);
  const printerLogoInputRef = React.useRef<HTMLInputElement | null>(null);

  // Backup & Restore State (S3)
  const [isBackupModalOpen, setIsBackupModalOpen] = useState(false);
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);

  // Factory Reset State (S4)
  const [isResetModalOpen, setIsResetModalOpen] = useState(false);

  const handleRestoreSuccess = async (requireRelogin: boolean) => {
    if (requireRelogin) {
      showToast('Data berhasil dipulihkan. Mengalihkan ke login...', 'info');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } else {
      await refreshData();
      window.location.reload();
    }
  };

  const handleFactoryResetSuccess = () => {
    showToast('Data demo berhasil direset ke kondisi awal. Mengalihkan ke halaman utama...', 'info');
    setTimeout(() => {
      window.location.href = '/';
    }, 1000);
  };

  // Sync formData when settings change from backend ONLY if user hasn't edited the draft
  React.useEffect(() => {
    if (!isDirty) {
      setFormData({
        ...settings,
        operational_day_cutoff_time: settings?.operational_day_cutoff_time || '04:00',
        receipt_paper_size: settings?.receipt_paper_size === '58mm' ? '58mm' : '80mm',
      });
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

    // Validasi jam cutoff operasional (HH:mm format 24 jam)
    const rawCutoff = (formData.operational_day_cutoff_time || '04:00').trim();
    const cutoffRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!cutoffRegex.test(rawCutoff)) {
      showToast('Format jam cutoff operasional tidak valid. Gunakan format 24 jam HH:mm (contoh: 04:00 atau 23:30).', 'error');
      return;
    }

    // Validasi & normalisasi nomor telepon
    const rawPhone = (formData.phone || '').trim();
    let normalizedPhone = '';
    if (rawPhone) {
      if (!/^[+]?[\d\s\-().]+$/.test(rawPhone)) {
        showToast('Nomor telepon mengandung karakter tidak valid.', 'error');
        return;
      }
      const digitsOnly = rawPhone.replace(/\D/g, '');
      if (digitsOnly.length < 8 || digitsOnly.length > 16) {
        showToast('Nomor telepon harus memiliki 8 hingga 16 digit angka.', 'error');
        return;
      }
      normalizedPhone = (rawPhone.startsWith('+') ? '+' : '') + digitsOnly;
    }

    const rawPaperSize: ReceiptPaperSize = formData.receipt_paper_size === '58mm' ? '58mm' : '80mm';

    const payload: Partial<StoreSettings> = {
      ...formData,
      tax_percentage: taxNum,
      operational_day_cutoff_time: rawCutoff,
      phone: normalizedPhone,
      receipt_paper_size: rawPaperSize,
    };

    setIsSaving(true);
    try {
      const saved = await settingsService.updateSettings(payload);
      if (saved) {
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

  const handleRefreshData = async () => {
    if (isRefreshing) return;

    setIsRefreshing(true);
    try {
      const isSuccess = await refreshData();
      setIsDirty(false);
      if (isSuccess) {
        showToast('Data toko berhasil disegarkan', 'success');
      } else {
        showToast('Beberapa data toko gagal disegarkan', 'info');
      }
    } catch (err: any) {
      console.error('Failed to refresh data:', err);
      showToast('Gagal menyegarkan data toko', 'error');
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

  const handleAppLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isOwner) {
      showToast('Hanya Owner yang dapat mengubah logo aplikasi.', 'error');
      if (appLogoInputRef.current) appLogoInputRef.current.value = '';
      return;
    }

    setIsUploadingAppLogo(true);
    try {
      await uploadAppLogo(file);
    } catch {
      // Toast notification is handled in hook
    } finally {
      setIsUploadingAppLogo(false);
      if (appLogoInputRef.current) appLogoInputRef.current.value = '';
    }
  };

  const handleDeleteAppLogo = async () => {
    if (!isOwner) {
      showToast('Hanya Owner yang dapat menghapus logo aplikasi.', 'error');
      return;
    }
    if (!window.confirm('Hapus logo aplikasi kustom dan kembali ke logo bawaan Booth Daily?')) {
      return;
    }
    setIsDeletingAppLogo(true);
    try {
      await deleteAppLogo();
    } catch {
      // Handled
    } finally {
      setIsDeletingAppLogo(false);
    }
  };

  const handlePrinterLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isOwner) {
      showToast('Hanya Owner yang dapat mengubah logo printer struk.', 'error');
      if (printerLogoInputRef.current) printerLogoInputRef.current.value = '';
      return;
    }

    setIsUploadingPrinterLogo(true);
    try {
      await uploadPrinterLogo(file);
    } catch {
      // Handled
    } finally {
      setIsUploadingPrinterLogo(false);
      if (printerLogoInputRef.current) printerLogoInputRef.current.value = '';
    }
  };

  const handleDeletePrinterLogo = async () => {
    if (!isOwner) {
      showToast('Hanya Owner yang dapat menghapus logo printer struk.', 'error');
      return;
    }
    if (!window.confirm('Hapus logo printer struk? Struk thermal akan tampil bersih hanya dengan nama toko.')) {
      return;
    }
    setIsDeletingPrinterLogo(true);
    try {
      await deletePrinterLogo();
    } catch {
      // Handled
    } finally {
      setIsDeletingPrinterLogo(false);
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
              value={formData.phone || ''}
              onChange={e => {
                setIsDirty(true);
                setFormData({ ...formData, phone: e.target.value });
              }}
              placeholder="Contoh: 081234567890 atau +62 812-3456-7890"
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

        {/* JAM CUTOFF OPERASIONAL */}
        <div className="p-4 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 text-xs">
              <Clock className="w-4 h-4 text-[#C68B59]" />
              Jam Cutoff Pergantian Hari Operasional (24 Jam)
            </label>
            <span className="text-[11px] font-bold text-[#C68B59] bg-[#C68B59]/10 px-2 py-0.5 rounded-lg">
              Saat ini: {formData.operational_day_cutoff_time || '04:00'} WIB
            </span>
          </div>
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
            <div className="flex items-center gap-1.5 w-full sm:w-auto">
              <input
                type="text"
                value={formData.operational_day_cutoff_time || ''}
                onChange={e => {
                  setIsDirty(true);
                  setFormData({ ...formData, operational_day_cutoff_time: e.target.value });
                }}
                disabled={!isOwner}
                placeholder="04:00"
                maxLength={5}
                className="w-28 px-3.5 py-2 rounded-xl bg-white dark:bg-[#1E1C1A] border border-stone-300 dark:border-stone-700 font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-[#C68B59] disabled:opacity-60 disabled:cursor-not-allowed"
              />
              <span className="font-bold text-stone-600 dark:text-stone-400">WIB</span>
            </div>
            <div className="flex flex-col text-[11px] text-stone-500 font-medium">
              <span>
                Menentukan batas pergantian tanggal operasional harian (format 24 jam HH:mm, default 04:00).
              </span>
              <span>
                Pengaturan ini hanya diterapkan pada pembukaan shift baru berikutnya tanpa mengubah tanggal shift berjalan atau shift terdahulu.
              </span>
              {!isOwner && (
                <span className="text-amber-600 dark:text-amber-400 font-bold mt-0.5">
                  Khusus Owner: Staff kasir hanya dapat melihat jam cutoff operasional.
                </span>
              )}
            </div>
          </div>
        </div>

        <hr className="border-stone-100 dark:border-stone-800" />

        <div className="flex items-center justify-between gap-3">
          <h3 className="font-extrabold text-sm text-[#3B2A1F] dark:text-[#D4A373] uppercase tracking-wider flex items-center gap-2">
            <Receipt className="w-4 h-4" /> Pengaturan & Pesan Cetak Struk
          </h3>
        </div>

        {/* UKURAN KERTAS STRUK THERMAL */}
        <div className="p-4 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5 text-xs">
              <Printer className="w-4 h-4 text-[#C68B59]" />
              Format Ukuran Kertas Thermal Struk
            </label>
            <span className="text-[11px] font-bold text-[#C68B59] bg-[#C68B59]/10 px-2 py-0.5 rounded-lg">
              Mode Aktif: {formData.receipt_paper_size === '58mm' ? '58mm (Kompak)' : '80mm (Standar)'}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Opsi 80mm */}
            <button
              type="button"
              disabled={!isOwner}
              onClick={() => {
                if (formData.receipt_paper_size !== '80mm') {
                  setIsDirty(true);
                  setFormData({ ...formData, receipt_paper_size: '80mm' });
                }
              }}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                (formData.receipt_paper_size || '80mm') === '80mm'
                  ? 'border-[#C68B59] bg-[#C68B59]/10 text-stone-900 dark:text-stone-100 ring-1 ring-[#C68B59]'
                  : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1E1C1A] text-stone-600 dark:text-stone-400 hover:border-stone-300'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-xs">80mm (Standar Kasir)</span>
                {(formData.receipt_paper_size || '80mm') === '80mm' && (
                  <CheckCircle2 className="w-4 h-4 text-[#C68B59]" />
                )}
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Lebar cetak standar 78mm. Format kompatibilitas default untuk printer kasir thermal desktop dan printer berukuran besar.
              </p>
            </button>

            {/* Opsi 58mm */}
            <button
              type="button"
              disabled={!isOwner}
              onClick={() => {
                if (formData.receipt_paper_size !== '58mm') {
                  setIsDirty(true);
                  setFormData({ ...formData, receipt_paper_size: '58mm' });
                }
              }}
              className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                formData.receipt_paper_size === '58mm'
                  ? 'border-[#C68B59] bg-[#C68B59]/10 text-stone-900 dark:text-stone-100 ring-1 ring-[#C68B59]'
                  : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1E1C1A] text-stone-600 dark:text-stone-400 hover:border-stone-300'
              } disabled:opacity-60 disabled:cursor-not-allowed`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <span className="font-bold text-xs">58mm (Kompak / Mobile)</span>
                {formData.receipt_paper_size === '58mm' && (
                  <CheckCircle2 className="w-4 h-4 text-[#C68B59]" />
                )}
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Lebar cetak kompak 48mm. Format hemat kertas untuk printer thermal Bluetooth / portabel mini tanpa pemotongan teks.
              </p>
            </button>
          </div>
          {!isOwner && (
            <p className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold">
              Khusus Owner: Pengaturan format ukuran kertas hanya dapat diubah oleh Owner.
            </p>
          )}
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
            onClick={handleRefreshData}
            disabled={isRefreshing}
            className="w-full sm:w-auto flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-bold text-xs transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed border border-stone-200 dark:border-stone-700"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Menyegarkan Data...' : 'Segarkan Data'}
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

      {/* 3. PENGELOLAAN LOGO & BRANDING (OWNER ONLY MANAGEMENT) */}
      <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 p-4 sm:p-6 space-y-6 shadow-sm text-xs">
        <div>
          <h3 className="font-extrabold text-sm text-[#3B2A1F] dark:text-[#D4A373] uppercase tracking-wider flex items-center gap-2">
            <ImageIcon className="w-4 h-4" /> Pengelolaan Logo & Branding Toko
          </h3>
          <p className="text-[11px] text-stone-500 font-medium">
            Atur logo merek aplikasi dan logo cetak struk printer thermal secara terpisah dengan penyimpanan mandiri.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Card A: Logo Aplikasi */}
          <div className="p-4 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-stone-200 dark:border-stone-800 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-800 dark:text-stone-200 text-xs flex items-center gap-1.5">
                  <Coffee className="w-4 h-4 text-[#C68B59]" />
                  Logo Merek Aplikasi
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  appLogo ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                }`}>
                  {appLogo ? 'Logo Kustom' : 'Logo Bawaan'}
                </span>
              </div>

              {/* Preview Badge */}
              <div className="flex items-center gap-4 p-3 bg-white dark:bg-[#1E1C1A] rounded-xl border border-stone-200 dark:border-stone-700">
                <div className="relative w-16 h-16 rounded-2xl bg-[#3B2A1F] text-[#F7F5F2] flex items-center justify-center border border-[#D4A373]/30 shadow-md shrink-0 overflow-hidden p-1">
                  {appLogo ? (
                    <img
                      src={appLogo}
                      alt="Logo Aplikasi"
                      className="w-full h-full object-contain rounded-xl"
                    />
                  ) : (
                    <Coffee className="w-8 h-8 text-[#D4A373]" />
                  )}
                  <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#10B981] pointer-events-none" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold text-xs uppercase text-stone-900 dark:text-stone-100">
                    {formData.store_name?.trim() || 'BOOTH DAILY'}
                  </span>
                  <span className="text-[10px] text-stone-500 dark:text-stone-400">
                    {formData.tagline || 'Coffee Booth POS'}
                  </span>
                  <span className="text-[9px] text-stone-400 mt-1">
                    Aktif pada Navbar, Mobile Header, & Favicon Tab.
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-stone-500 leading-relaxed">
                Mendukung file PNG, JPEG, dan WebP (maks. 5MB). Otomatis dikompresi proporsional dan tersimpan di memori khusus.
              </p>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-stone-200 dark:border-stone-800 space-y-2">
              <input
                ref={appLogoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAppLogoFileChange}
                className="hidden"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => appLogoInputRef.current?.click()}
                  disabled={!isOwner || isUploadingAppLogo}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-bold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Upload className={`w-3.5 h-3.5 text-[#D4A373] ${isUploadingAppLogo ? 'animate-bounce' : ''}`} />
                  {isUploadingAppLogo ? 'Memproses...' : appLogo ? 'Ganti Logo' : 'Upload Logo'}
                </button>

                {appLogo && (
                  <button
                    type="button"
                    onClick={handleDeleteAppLogo}
                    disabled={!isOwner || isDeletingAppLogo}
                    className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 font-bold text-xs border border-rose-200 dark:border-rose-900/40 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isDeletingAppLogo ? 'Menghapus...' : 'Hapus'}
                  </button>
                )}
              </div>

              {!isOwner && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                  Khusus Owner: Pengelolaan logo hanya dapat diubah oleh Owner.
                </p>
              )}
            </div>
          </div>

          {/* Card B: Logo Printer / Struk Thermal */}
          <div className="p-4 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-stone-200 dark:border-stone-800 flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-stone-800 dark:text-stone-200 text-xs flex items-center gap-1.5">
                  <Printer className="w-4 h-4 text-[#C68B59]" />
                  Logo Printer Struk Thermal
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                  printerLogo ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-stone-200 dark:bg-stone-800 text-stone-600 dark:text-stone-400'
                }`}>
                  {printerLogo ? 'Logo Aktif' : 'Tanpa Logo (Teks Saja)'}
                </span>
              </div>

              {/* Receipt Preview Paper */}
              <div className="p-3 bg-white text-stone-900 rounded-xl border border-stone-300 shadow-inner flex flex-col items-center justify-center font-mono text-[10px] min-h-[90px]">
                {printerLogo ? (
                  <img
                    src={printerLogo}
                    alt="Logo Printer"
                    className="max-h-12 max-w-[120px] object-contain mb-1 drop-shadow-xs"
                  />
                ) : (
                  <span className="text-stone-400 italic mb-1">[Tanpa Logo Gambar]</span>
                )}
                <span className="font-bold text-xs uppercase text-center text-[#3B2A1F]">
                  {formData.store_name?.trim() || 'BOOTH DAILY'}
                </span>
                <span className="text-[9px] text-stone-500 uppercase">
                  Format Kertas: {formData.receipt_paper_size || '80mm'}
                </span>
              </div>

              <p className="text-[11px] text-stone-500 leading-relaxed">
                Hanya dicetak pada struk kasir & Test Printer. Terpisah dari logo aplikasi. Aman untuk ukuran 58mm & 80mm tanpa overflow.
              </p>
            </div>

            {/* Actions */}
            <div className="pt-2 border-t border-stone-200 dark:border-stone-800 space-y-2">
              <input
                ref={printerLogoInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handlePrinterLogoFileChange}
                className="hidden"
              />

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => printerLogoInputRef.current?.click()}
                  disabled={!isOwner || isUploadingPrinterLogo}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-bold text-xs shadow-sm transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  <Upload className={`w-3.5 h-3.5 text-[#D4A373] ${isUploadingPrinterLogo ? 'animate-bounce' : ''}`} />
                  {isUploadingPrinterLogo ? 'Memproses...' : printerLogo ? 'Ganti Logo Struk' : 'Upload Logo Struk'}
                </button>

                {printerLogo && (
                  <button
                    type="button"
                    onClick={handleDeletePrinterLogo}
                    disabled={!isOwner || isDeletingPrinterLogo}
                    className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/30 dark:hover:bg-rose-900/40 text-rose-600 dark:text-rose-400 font-bold text-xs border border-rose-200 dark:border-rose-900/40 transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    {isDeletingPrinterLogo ? 'Menghapus...' : 'Hapus'}
                  </button>
                )}
              </div>

              {!isOwner && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
                  Khusus Owner: Pengaturan logo printer hanya dapat diakses oleh Owner.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 5. CADANGAN & PEMULIHAN DATA TERENKRIPSI (S3) */}
      <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 p-4 sm:p-6 space-y-5 shadow-sm text-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-stone-100 dark:border-stone-800 pb-3">
          <div>
            <h3 className="font-extrabold text-sm text-[#3B2A1F] dark:text-[#D4A373] uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#C68B59]" /> Cadangan & Pemulihan Terenkripsi (S3)
            </h3>
            <p className="text-[11px] text-stone-500 font-medium mt-0.5">
              Enkripsi AES-GCM 256-bit dengan derivasi kunci PBKDF2 600.000 iterasi. Menyimpan seluruh data toko & logo tanpa kebocoran plaintext.
            </p>
          </div>
          <div className="flex items-center gap-1.5 self-start sm:self-auto px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px]">
            <CheckCircle2 className="w-3 h-3" /> Standar Keamanan Tinggi
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Card Ekspor Backup */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Download className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-stone-900 dark:text-stone-100 text-xs">
                  Cadangkan Data Toko
                </h4>
                <p className="text-[10px] text-stone-400">
                  Ekspor file terenkripsi (.enc.json)
                </p>
              </div>
            </div>
            <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed">
              Kemas seluruh pengguna, katalog produk, stok bahan, resep, transaksi, shift, pengaturan, serta kedua logo menjadi satu file terenkripsi aman.
            </p>
            <button
              type="button"
              disabled={!isOwner}
              onClick={() => setIsBackupModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#C68B59] hover:bg-[#B57A48] text-white font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Buat Cadangan Baru</span>
            </button>
          </div>

          {/* Card Impor Restore */}
          <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-800 space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
                <Upload className="w-4 h-4" />
              </div>
              <div>
                <h4 className="font-bold text-stone-900 dark:text-stone-100 text-xs">
                  Pulihkan Data dari Cadangan
                </h4>
                <p className="text-[10px] text-stone-400">
                  Pemulihan atomik (2PC) dengan verifikasi PIN Owner
                </p>
              </div>
            </div>
            <p className="text-[11px] text-stone-600 dark:text-stone-300 leading-relaxed">
              Pulihkan database toko dan logo dari file cadangan sah. Proses diawali validasi menyeluruh di memori staging sebelum commit ke LocalStorage & IndexedDB.
            </p>
            <button
              type="button"
              disabled={!isOwner}
              onClick={() => setIsRestoreModalOpen(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-800 hover:bg-stone-800 dark:hover:bg-stone-700 text-white font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Pulihkan Data Toko</span>
            </button>
          </div>
        </div>

        {!isOwner && (
          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-semibold">
            Khusus Owner: Fitur cadangan dan pemulihan data hanya dapat diakses oleh akun Owner aktif.
          </p>
        )}
      </div>

      {/* 6. RESET DATA DEMO (FACTORY RESET) (S4 - OWNER ONLY) */}
      {isOwner && (
        <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-rose-200 dark:border-rose-950/40 p-4 sm:p-6 space-y-4 shadow-sm text-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-rose-100 dark:border-rose-950/30 pb-3">
            <div>
              <h3 className="font-extrabold text-sm text-rose-700 dark:text-rose-400 uppercase tracking-wider flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-rose-600" /> Reset Data Demo ke Kondisi Awal (S4)
              </h3>
              <p className="text-[11px] text-stone-500 font-medium mt-0.5">
                Mengembalikan seluruh data toko, katalog produk, stok bahan, transaksi kasir, riwayat shift, dan logo kustom ke seed awal pabrik.
              </p>
            </div>
            <div className="flex items-center gap-1.5 self-start sm:self-auto px-2.5 py-1 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-[10px]">
              <AlertTriangle className="w-3 h-3" /> Tindakan Permanen
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-rose-50/40 dark:bg-rose-950/20 border border-rose-200/60 dark:border-rose-900/30">
            <div className="space-y-1">
              <span className="font-bold text-stone-900 dark:text-stone-100 text-xs">
                Kembalikan Sistem ke Setelan Pabrik
              </span>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Membutuhkan otorisasi PIN Owner aktif. Seluruh mutasi operasional akan dibersihkan dan sesi login saat ini akan langsung diakhiri.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setIsResetModalOpen(true)}
              className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Reset Data Demo</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL CREATE / EDIT DISCOUNT */}
      <DiscountRuleModal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        onSave={handleSaveDiscount}
        initialData={editingDiscountRule}
      />

      {/* MODAL BACKUP (S3) */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        showToast={showToast}
      />

      {/* MODAL RESTORE (S3) */}
      <RestoreModal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        showToast={showToast}
        onSuccess={handleRestoreSuccess}
      />

      {/* MODAL FACTORY RESET (S4) */}
      <FactoryResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        showToast={showToast}
        onSuccess={handleFactoryResetSuccess}
      />
    </div>
  );
};

