import React, { useState, useMemo, useRef, useEffect } from 'react';
import { usePOS } from '../hooks/usePOS';
import { 
  Info, Settings, Save, RefreshCw, Store, Receipt, CheckCircle2, 
  Printer, Percent, Tag, Plus, Edit2, Trash2, Clock,
  Upload, Image as ImageIcon, Coffee, ShieldCheck, Download,
  RotateCcw, AlertTriangle, Crown, Search, X, Calendar, AlertCircle
} from 'lucide-react';
import { formatRupiah } from '../utils/formatters';
import { DiscountRule, Settings as StoreSettings, ReceiptPaperSize, PromotionValidityType } from '../types';
import { getPromoComputedStatus, PromoComputedStatus } from '../utils/orderCalculation';
import { DiscountRuleModal } from '../components/settings/DiscountRuleModal';
import { BackupModal } from '../components/settings/BackupModal';
import { RestoreModal } from '../components/settings/RestoreModal';
import { FactoryResetModal } from '../components/settings/FactoryResetModal';
import { NumberInput } from '../components/common/NumberInput';
import { settingsService } from '../services/settingsService';


interface InfoPopoverProps {
  title: string;
  ariaLabel?: string;
  children: React.ReactNode;
  align?: 'left' | 'right' | 'center';
}

// Module-level coordinator to ensure strictly only one InfoPopover is open at any time
let activePopoverCloser: (() => void) | null = null;

export const InfoPopover: React.FC<InfoPopoverProps> = ({
  title,
  ariaLabel,
  children,
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const popoverRef = React.useRef<HTMLDivElement>(null);
  const triggerRef = React.useRef<HTMLButtonElement>(null);
  const [coords, setCoords] = React.useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const calculateCoords = React.useCallback((triggerEl: HTMLElement) => {
    const triggerRect = triggerEl.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    // Responsive width: min 280px, max 340px, capped at viewportWidth - 24px
    const popoverWidth = Math.min(340, Math.max(280, viewportWidth - 24));
    const margin = 8;

    // Vertical placement evaluation:
    const spaceBelow = viewportHeight - triggerRect.bottom - margin;
    const spaceAbove = triggerRect.top - margin;
    const placeAbove = spaceBelow < 200 && spaceAbove > spaceBelow;

    let top: number | undefined;
    let bottom: number | undefined;
    let maxHeight: number;

    if (placeAbove) {
      bottom = viewportHeight - triggerRect.top + margin;
      maxHeight = Math.min(380, Math.max(160, spaceAbove - 16));
    } else {
      top = triggerRect.bottom + margin;
      maxHeight = Math.min(380, Math.max(160, spaceBelow - 16));
    }

    // Horizontal placement evaluation:
    const triggerCenter = triggerRect.left + triggerRect.width / 2;
    let left: number;
    if (triggerCenter > viewportWidth / 2) {
      left = triggerRect.right - popoverWidth;
    } else {
      left = triggerRect.left;
    }

    // Strict viewport boundary clamping to guarantee zero horizontal overflow:
    left = Math.max(12, Math.min(left, viewportWidth - popoverWidth - 12));

    return {
      top,
      bottom,
      left,
      width: popoverWidth,
      maxHeight,
    };
  }, []);

  const updatePosition = React.useCallback(() => {
    if (!triggerRef.current) return;
    setCoords(calculateCoords(triggerRef.current));
  }, [calculateCoords]);

  const closeSelf = React.useCallback(() => {
    setIsOpen(false);
    if (activePopoverCloser === closeSelf) {
      activePopoverCloser = null;
    }
  }, []);

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (isOpen) {
      closeSelf();
    } else {
      // Synchronously close any currently open popover
      if (activePopoverCloser && activePopoverCloser !== closeSelf) {
        activePopoverCloser();
      }
      // Calculate coordinates BEFORE opening so first frame renders in place
      if (triggerRef.current) {
        setCoords(calculateCoords(triggerRef.current));
      }
      activePopoverCloser = closeSelf;
      setIsOpen(true);
    }
  };

  React.useEffect(() => {
    return () => {
      if (activePopoverCloser === closeSelf) {
        activePopoverCloser = null;
      }
    };
  }, [closeSelf]);

  React.useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        closeSelf();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closeSelf();
        triggerRef.current?.focus();
      }
    };

    // Outside scroll dismisses popover; internal scroll inside popover content is preserved
    const handleScroll = (e: Event) => {
      if (
        popoverRef.current &&
        (e.target === popoverRef.current || popoverRef.current.contains(e.target as Node))
      ) {
        return; // Internal scroll inside popover -> do not close
      }
      closeSelf();
    };

    const handleResize = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize, { passive: true });
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [isOpen, closeSelf, updatePosition]);

  return (
    <div className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        aria-expanded={isOpen}
        aria-label={ariaLabel || `Penjelasan: ${title}`}
        title={`Penjelasan: ${title}`}
        className="min-w-[44px] min-h-[44px] -m-2 p-2 inline-flex items-center justify-center text-stone-400 hover:text-[#C68B59] dark:hover:text-[#D4A373] transition-colors cursor-pointer rounded-full focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#C68B59]"
      >
        <span className="w-5 h-5 rounded-full border border-stone-300 dark:border-stone-700 flex items-center justify-center text-xs font-bold hover:border-[#C68B59] bg-stone-50 dark:bg-[#1E1C1A]">
          <Info className="w-3.5 h-3.5" />
        </span>
      </button>

      {isOpen && (
        <div
          ref={popoverRef}
          role="dialog"
          aria-modal="false"
          aria-label={title}
          style={{
            position: 'fixed',
            top: coords?.top !== undefined ? `${coords.top}px` : 'auto',
            bottom: coords?.bottom !== undefined ? `${coords.bottom}px` : 'auto',
            left: `${coords?.left ?? 12}px`,
            width: `${coords?.width ?? 320}px`,
            maxHeight: `${coords?.maxHeight ?? 360}px`,
            zIndex: 9999,
          }}
          className="p-4 bg-white dark:bg-[#1E1C1A] rounded-2xl border border-stone-200 dark:border-stone-700 shadow-2xl text-xs text-stone-600 dark:text-stone-300 flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-2 shrink-0">
            <span className="font-extrabold text-xs text-[#3B2A1F] dark:text-[#D4A373] flex items-center gap-1.5 uppercase tracking-wide">
              <Info className="w-3.5 h-3.5 text-[#C68B59]" />
              {title}
            </span>
            <button
              type="button"
              onClick={() => {
                closeSelf();
                triggerRef.current?.focus();
              }}
              aria-label="Tutup penjelasan"
              className="min-w-[36px] min-h-[36px] -m-1.5 p-1.5 inline-flex items-center justify-center text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="space-y-2 text-[11px] leading-relaxed overflow-y-auto mt-2 pr-1">
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

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
    report_signer_name: settings?.report_signer_name || '',
    report_city: settings?.report_city || '',
    vip_discount_percentage: settings?.vip_discount_percentage ?? 0,
    vip_tax_percentage: settings?.vip_tax_percentage ?? null,
    vip_room_service_charge_percentage: settings?.vip_room_service_charge_percentage ?? 0,
    operational_day_cutoff_time: settings?.operational_day_cutoff_time || '04:00',
    receipt_paper_size: settings?.receipt_paper_size === '58mm' ? '58mm' : '80mm',
  });
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isVipTaxEnabled, setIsVipTaxEnabled] = useState<boolean>(() => {
    return settings?.vip_tax_percentage !== null && settings?.vip_tax_percentage !== undefined;
  });

  const handleToggleVipTax = (enabled: boolean) => {
    setIsDirty(true);
    setIsVipTaxEnabled(enabled);
    setFormData(prev => ({
      ...prev,
      vip_tax_percentage: enabled ? (prev.vip_tax_percentage !== null && prev.vip_tax_percentage !== undefined ? prev.vip_tax_percentage : 0) : null,
    }));
  };

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
        report_signer_name: settings?.report_signer_name || '',
        report_city: settings?.report_city || '',
        vip_discount_percentage: settings?.vip_discount_percentage ?? 0,
        vip_tax_percentage: settings?.vip_tax_percentage ?? null,
        vip_room_service_charge_percentage: settings?.vip_room_service_charge_percentage ?? 0,
        operational_day_cutoff_time: settings?.operational_day_cutoff_time || '04:00',
        receipt_paper_size: settings?.receipt_paper_size === '58mm' ? '58mm' : '80mm',
      });
      setIsVipTaxEnabled(settings?.vip_tax_percentage !== null && settings?.vip_tax_percentage !== undefined);
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

    const vipDiscountNum = Number(formData.vip_discount_percentage ?? 0);
    if (isNaN(vipDiscountNum) || vipDiscountNum < 0 || vipDiscountNum > 100) {
      showToast('Persentase diskon VIP harus antara 0% sampai 100%', 'error');
      return;
    }

    let vipTaxNum: number | null = null;
    if (isVipTaxEnabled) {
      vipTaxNum = Number(formData.vip_tax_percentage ?? 0);
      if (isNaN(vipTaxNum) || vipTaxNum < 0 || vipTaxNum > 100) {
        showToast('Tarif pajak khusus VIP harus antara 0% sampai 100%', 'error');
        return;
      }
    }

    const vipServiceNum = Number(formData.vip_room_service_charge_percentage ?? 0);
    if (isNaN(vipServiceNum) || vipServiceNum < 0 || vipServiceNum > 100) {
      showToast('Biaya layanan VIP harus antara 0% sampai 100%', 'error');
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
      vip_discount_percentage: vipDiscountNum,
      vip_tax_percentage: isVipTaxEnabled ? vipTaxNum : null,
      vip_room_service_charge_percentage: vipServiceNum,
      report_signer_name: (formData.report_signer_name || '').trim(),
      report_city: (formData.report_city || '').trim(),
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

  // Search & Filter State for Discount Rules
  const [promoSearchQuery, setPromoSearchQuery] = useState('');

  const getStatusSearchKeywords = (status: PromoComputedStatus): string[] => {
    switch (status) {
      case 'active':
        return ['aktif', 'active'];
      case 'scheduled':
        return ['terjadwal', 'scheduled'];
      case 'expired':
        return ['kedaluwarsa', 'kadaluarsa', 'expired'];
      case 'disabled':
        return ['nonaktif', 'tidak aktif', 'disabled', 'inactive'];
      default:
        return [];
    }
  };

  
  // Summary counts for promo status: Aktif, Nonaktif, VIP
  const activePromosCount = useMemo(() => {
    return discountRules.filter(r => getPromoComputedStatus(r) === 'active').length;
  }, [discountRules]);

  const inactivePromosCount = useMemo(() => {
    return discountRules.filter(r => getPromoComputedStatus(r) === 'disabled').length;
  }, [discountRules]);

  const vipPromosCount = useMemo(() => {
    return discountRules.filter(r => r.scope === 'vip').length;
  }, [discountRules]);

  // Ref & dynamic height measurement for mobile promo list (max ~5 visible cards + internal scroll)
  const mobilePromoListRef = useRef<HTMLDivElement>(null);
  const [mobilePromoMaxHeight, setMobilePromoMaxHeight] = useState<number | undefined>(undefined);

  const filteredDiscountRules = useMemo(() => {
    const query = promoSearchQuery.trim().toLowerCase();
    if (!query) return discountRules;

    return discountRules.filter(rule => {
      // 1. Match name
      if (rule.name.toLowerCase().includes(query)) return true;

      // 2. Match scope (type)
      const scope = rule.scope || 'general';
      if (scope === 'vip') {
        if ('vip'.includes(query) || 'khusus vip'.includes(query)) return true;
      } else {
        if ('umum'.includes(query) || 'general'.includes(query) || 'reguler'.includes(query)) return true;
      }

      // 3. Match computed status
      const status = getPromoComputedStatus(rule);
      const keywords = getStatusSearchKeywords(status);
      const matchesStatus = keywords.some(k => {
        if (query === 'aktif' || query === 'active') {
          return k === query;
        }
        return k.includes(query);
      });
      if (matchesStatus) return true;

      return false;
    });
  }, [discountRules, promoSearchQuery]);

  // Dynamic height measurement for mobile promo list (max ~5 visible cards + internal scroll)
  useEffect(() => {
    const container = mobilePromoListRef.current;
    if (!container) return;

    const measureCards = () => {
      const cards = Array.from(container.children) as HTMLElement[];
      if (cards.length > 5) {
        const topOffset = container.getBoundingClientRect().top;
        const fifthCard = cards[4];
        const fifthCardBottom = fifthCard.getBoundingClientRect().bottom;
        const calculatedHeight = Math.ceil(fifthCardBottom - topOffset);
        if (calculatedHeight > 0) {
          setMobilePromoMaxHeight(calculatedHeight);
          return;
        }
      }
      setMobilePromoMaxHeight(undefined);
    };

    const rafId = requestAnimationFrame(measureCards);
    window.addEventListener('resize', measureCards, { passive: true });

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', measureCards);
    };
  }, [filteredDiscountRules]);

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
    scope?: 'general' | 'vip';
    validity_type?: PromotionValidityType;
    start_date?: string | null;
    end_date?: string | null;
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
    <div className="p-3.5 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
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
      <form onSubmit={handleSave} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Kolom Kiri: Identitas Booth & Format Struk */}
          <div className="flex flex-col gap-6 lg:h-full">
            {/* Sub-card 1A: Identitas Coffee Booth & Penandatangan Laporan */}
            <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 p-4 sm:p-6 space-y-5 shadow-sm text-xs">
              <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
                <h3 className="font-extrabold text-sm text-[#3B2A1F] dark:text-[#D4A373] uppercase tracking-wider flex items-center gap-2">
                  <Store className="w-4 h-4 text-[#C68B59]" /> Identitas Coffee Booth
                </h3>
                <InfoPopover title="Panduan Identitas Booth & Laporan">
                  <p>
                    <strong>Identitas Booth:</strong> Nama, slogan, alamat, dan nomor telepon dicantumkan pada navbar, struk belanja kasir, dan identifikasi outlet.
                  </p>
                  <p>
                    <strong>Penandatangan Laporan:</strong> Nama Owner atau Manajemen yang dicantumkan secara resmi pada blok tanda tangan laporan keuangan harian dan bulanan.
                  </p>
                  <p>
                    <strong>Kota Laporan:</strong> Digunakan untuk menentukan titimangsa lokasi dan tanggal pada dokumen formal serta ekspor PDF laporan.
                  </p>
                </InfoPopover>
              </div>

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

              <div className="grid grid-cols-1 gap-4">
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

              {/* NAMA OWNER / PENANDATANGAN LAPORAN & KOTA LAPORAN */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-stone-100 dark:border-stone-800">
                <div>
                  <label htmlFor="report_signer_name" className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Nama Owner / Penandatangan Laporan
                  </label>
                  <input
                    id="report_signer_name"
                    type="text"
                    value={formData.report_signer_name || ''}
                    onChange={e => {
                      setIsDirty(true);
                      setFormData({ ...formData, report_signer_name: e.target.value });
                    }}
                    placeholder="Contoh: Budi Santoso (Owner)"
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-semibold text-stone-900 dark:text-stone-100"
                  />
                </div>

                <div>
                  <label htmlFor="report_city" className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Kota Laporan
                  </label>
                  <input
                    id="report_city"
                    type="text"
                    value={formData.report_city || ''}
                    onChange={e => {
                      setIsDirty(true);
                      setFormData({ ...formData, report_city: e.target.value });
                    }}
                    placeholder="Contoh: Jakarta Selatan"
                    className="w-full px-3.5 py-2 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-medium text-stone-900 dark:text-stone-100"
                  />
                </div>
              </div>
            </div>

            {/* Sub-card 1D: Pengaturan & Pesan Cetak Struk */}
            <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 p-4 sm:p-6 space-y-4 shadow-sm text-xs lg:flex-1 lg:flex lg:flex-col lg:justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
                  <h3 className="font-extrabold text-sm text-[#3B2A1F] dark:text-[#D4A373] uppercase tracking-wider flex items-center gap-2">
                    <Receipt className="w-4 h-4 text-[#C68B59]" /> Pengaturan & Pesan Cetak Struk
                  </h3>
                  <InfoPopover title="Panduan Format Cetak Struk">
                    <p>
                      <strong>Format 80mm (Standar Kasir):</strong> Lebar cetak 78mm. Format kompatibilitas default untuk printer thermal desktop dan printer kasir berukuran besar.
                    </p>
                    <p>
                      <strong>Format 58mm (Kompak/Mobile):</strong> Lebar cetak 48mm. Format hemat kertas untuk printer thermal Bluetooth portabel mini tanpa pemotongan teks.
                    </p>
                    <p>
                      <strong>Pesan Header & Footer:</strong> Teks kustom yang tercetak pada bagian atas struk (ucapan selamat datang) dan bagian bawah struk (ucapan terima kasih/info WiFi/sosmed).
                    </p>
                  </InfoPopover>
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
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        (formData.receipt_paper_size || '80mm') === '80mm'
                          ? 'border-[#C68B59] bg-[#C68B59]/10 text-stone-900 dark:text-stone-100 ring-1 ring-[#C68B59]'
                          : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1E1C1A] text-stone-600 dark:text-stone-400 hover:border-stone-300'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      <span className="font-bold text-xs">80mm (Standar Kasir)</span>
                      {(formData.receipt_paper_size || '80mm') === '80mm' && (
                        <CheckCircle2 className="w-4 h-4 text-[#C68B59] shrink-0" />
                      )}
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
                      className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        formData.receipt_paper_size === '58mm'
                          ? 'border-[#C68B59] bg-[#C68B59]/10 text-stone-900 dark:text-stone-100 ring-1 ring-[#C68B59]'
                          : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1E1C1A] text-stone-600 dark:text-stone-400 hover:border-stone-300'
                      } disabled:opacity-60 disabled:cursor-not-allowed`}
                    >
                      <span className="font-bold text-xs">58mm (Kompak / Mobile)</span>
                      {formData.receipt_paper_size === '58mm' && (
                        <CheckCircle2 className="w-4 h-4 text-[#C68B59] shrink-0" />
                      )}
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
              </div>
            </div>
          </div>

          {/* Kolom Kanan: Pajak/VIP Finansial & Jam Cutoff */}
          <div className="flex flex-col gap-6 lg:h-full">
            {/* Sub-card 1C: Pajak Penjualan & Ketentuan Finansial VIP */}
            <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 p-4 sm:p-6 space-y-5 shadow-sm text-xs">
              <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
                <h3 className="font-extrabold text-sm text-[#3B2A1F] dark:text-[#D4A373] uppercase tracking-wider flex items-center gap-2">
                  <Percent className="w-4 h-4 text-[#C68B59]" /> Pajak & Ketentuan Finansial VIP
                </h3>
                <InfoPopover title="Panduan Pajak & Finansial VIP">
                  <p>
                    <strong>Tarif Pajak Penjualan (PPN):</strong> Diterapkan otomatis pada kasir setelah potongan promo diskon (discounted base). Masukkan 0 jika tanpa pajak.
                  </p>
                  <p>
                    <strong>Pajak Khusus VIP (Opsional):</strong> Gunakan tarif berbeda khusus transaksi area Ruang VIP. Jika dinonaktifkan, transaksi VIP otomatis mengikuti tarif Pajak Umum.
                  </p>
                  <p>
                    <strong>Biaya Layanan Ruang VIP:</strong> Biaya layanan tambahan khusus area VIP. Dihitung sekali atas dasar setelah diskon (zero double counting / tidak kena pajak berganda).
                  </p>
                </InfoPopover>
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
                </div>
              </div>

              {/* PENGATURAN TRANSAKSI RUANG VIP */}
              <div className="p-4 sm:p-5 bg-amber-500/5 dark:bg-amber-950/20 rounded-2xl border border-amber-300 dark:border-amber-800/60 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-200 dark:border-amber-900/40 pb-3">
                  <div>
                    <label className="font-extrabold text-[#3B2A1F] dark:text-[#D4A373] flex items-center gap-1.5 text-xs uppercase tracking-wider">
                      <Crown className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                      Ketentuan Finansial Transaksi Ruang VIP
                    </label>
                  </div>
                  <span className="text-[11px] font-bold text-amber-800 dark:text-amber-300 bg-amber-200/60 dark:bg-amber-900/60 px-2.5 py-1 rounded-lg border border-amber-300 dark:border-amber-700/50">
                    Area Ruang VIP
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Pajak Khusus VIP (Opsional) */}
                  <div className="p-3.5 bg-white dark:bg-[#1E1C1A] rounded-xl border border-stone-200 dark:border-stone-800 space-y-2.5 shadow-2xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="block font-bold text-stone-800 dark:text-stone-200 text-xs">
                        Pajak Khusus VIP (Opsional)
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input
                          id="vip_tax_toggle_switch"
                          type="checkbox"
                          checked={isVipTaxEnabled}
                          onChange={e => handleToggleVipTax(e.target.checked)}
                          className="sr-only peer"
                        />
                        <div className="w-10 h-5.5 bg-stone-300 dark:bg-stone-700 peer-focus:outline-hidden rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-stone-300 after:border after:rounded-full after:h-4.5 after:w-4.5 after:transition-all peer-checked:bg-[#C68B59]" />
                      </label>
                    </div>

                    {isVipTaxEnabled ? (
                      <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between gap-2 animate-in fade-in duration-150">
                        <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                          Tarif Pajak VIP:
                        </span>
                        <div className="flex items-center gap-1.5">
                          <NumberInput
                            id="vip_tax_percentage"
                            min={0}
                            max={100}
                            allowDecimals={true}
                            value={formData.vip_tax_percentage ?? 0}
                            onChange={val => {
                              setIsDirty(true);
                              setFormData(prev => ({
                                ...prev,
                                vip_tax_percentage: val,
                              }));
                            }}
                            className="w-24 px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-[#C68B59] text-right"
                          />
                          <span className="font-bold text-stone-600 dark:text-stone-400 text-xs">%</span>
                        </div>
                      </div>
                    ) : (
                      <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80 text-[11px] text-stone-500 font-medium">
                        Mengikuti tarif Pajak Umum ({formData.tax_percentage ?? 0}%)
                      </div>
                    )}
                  </div>

                  {/* Biaya Layanan Ruang VIP */}
                  <div className="p-3.5 bg-white dark:bg-[#1E1C1A] rounded-xl border border-stone-200 dark:border-stone-800 space-y-2.5 shadow-2xs">
                    <div>
                      <span className="block font-bold text-stone-800 dark:text-stone-200 text-xs">
                        Biaya Layanan Ruang VIP (%)
                      </span>
                    </div>

                    <div className="pt-2 border-t border-stone-100 dark:border-stone-800/80 flex items-center justify-between gap-2">
                      <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                        Tarif Layanan:
                      </span>
                      <div className="flex items-center gap-1.5">
                        <NumberInput
                          id="vip_room_service_charge_percentage"
                          min={0}
                          max={100}
                          allowDecimals={true}
                          value={formData.vip_room_service_charge_percentage ?? 0}
                          onChange={val => {
                            setIsDirty(true);
                            setFormData(prev => ({
                              ...prev,
                              vip_room_service_charge_percentage: val,
                            }));
                          }}
                          className="w-24 px-3 py-1.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-[#C68B59] text-right"
                        />
                        <span className="font-bold text-stone-600 dark:text-stone-400 text-xs">%</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-card 1B: Jam Cutoff Operasional Harian (Redesigned Hero) */}
            <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 p-4 sm:p-6 space-y-4 shadow-sm text-xs">
              <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
                <h3 className="font-extrabold text-sm text-[#3B2A1F] dark:text-[#D4A373] uppercase tracking-wider flex items-center gap-2">
                  <Clock className="w-4 h-4 text-[#C68B59]" /> Jam Cutoff Operasional Harian
                </h3>
                <InfoPopover title="Panduan Jam Cutoff Operasional">
                  <p>
                    <strong>Definisi Cutoff:</strong> Menentukan batas pergantian tanggal operasional harian kasir & pembukuan (format 24 jam HH:mm, default 04:00 WIB).
                  </p>
                  <p>
                    <strong>Penerapan Shift Baru:</strong> Pengaturan ini hanya diterapkan pada pembukaan shift baru berikutnya tanpa mengubah tanggal shift berjalan atau riwayat shift terdahulu.
                  </p>
                  <p>
                    <strong>Pengelompokan Omset:</strong> Transaksi kasir yang dibuat lewat tengah malam sebelum jam cutoff (misal 00:01 - 03:59 WIB) tetap dicatat masuk ke tanggal hari operasional kemarin.
                  </p>
                  <p>
                    <strong>Otorisasi:</strong> Hanya akun Owner aktif yang berhak mengubah jam cutoff operasional. Staff kasir hanya dapat melihat nilai konfigurasi aktif.
                  </p>
                </InfoPopover>
              </div>

              {/* Hero Display & Input Container */}
              <div className="p-4 sm:p-5 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-4">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-stone-700 dark:text-stone-300 text-xs">
                    Batas Pergantian Hari (Format 24 Jam)
                  </span>
                  <span className="text-[11px] font-bold text-[#C68B59] bg-[#C68B59]/10 px-2.5 py-0.5 rounded-lg border border-[#C68B59]/20">
                    Aktif: {formData.operational_day_cutoff_time || '04:00'} WIB
                  </span>
                </div>

                {/* Main Visual Element: Prominent Input & WIB Badge */}
                <div className="flex items-center gap-3">
                  <div className="relative">
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
                      aria-label="Jam cutoff operasional harian format 24 jam"
                      className="w-32 py-2 px-3 text-xl font-black text-stone-900 dark:text-stone-100 bg-white dark:bg-[#1E1C1A] border-2 border-stone-300 dark:border-stone-700 rounded-2xl focus:outline-hidden focus:border-[#C68B59] text-center tracking-wider disabled:opacity-60 disabled:cursor-not-allowed shadow-2xs"
                    />
                  </div>
                  <span className="text-xs font-black text-[#C68B59] bg-[#C68B59]/10 px-3 py-2 rounded-xl border border-[#C68B59]/20">
                    WIB
                  </span>
                </div>

                {!isOwner && (
                  <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold text-[11px]">
                    Khusus Owner: Staff kasir hanya dapat melihat jam cutoff operasional.
                  </div>
                )}
              </div>
            </div>

            {/* Action Bar (Segarkan Data & Simpan Pengaturan) - Relocated to Right Column */}
            <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 p-4 sm:p-5 shadow-sm flex flex-col-reverse sm:flex-row sm:justify-between items-stretch sm:items-center gap-3 lg:mt-auto">
              <button
                type="button"
                onClick={handleRefreshData}
                disabled={isRefreshing}
                className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-2xl bg-stone-100 hover:bg-stone-200 dark:bg-stone-800 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 font-bold text-xs transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed border border-stone-200 dark:border-stone-700 min-h-[44px]"
              >
                <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Menyegarkan Data...' : 'Segarkan Data'}
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-2xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-bold text-sm shadow-md disabled:opacity-60 cursor-pointer min-h-[44px]"
              >
                <Save className="w-4 h-4 text-[#D4A373]" /> {isSaving ? 'Menyimpan...' : 'Simpan Pengaturan'}
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* 2. MANAJEMEN PROMO DISKON (OWNER ONLY) */}
      {isOwner && (
        <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 p-4 sm:p-6 space-y-5 shadow-sm text-xs">
          {/* Header Bar */}
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
            <div className="flex items-center gap-2">
              <h3 className="font-extrabold text-sm text-[#3B2A1F] dark:text-[#D4A373] uppercase tracking-wider flex items-center gap-2">
                <Tag className="w-4 h-4 text-[#C68B59]" /> Manajemen Promo Diskon
              </h3>
              <InfoPopover title="Aturan & Mekanisme Promo Diskon">
                <p>
                  <strong>Mekanisme Non-Stacking:</strong> Kasir otomatis mengevaluasi seluruh promo yang memenuhi syarat dan memilih 1 promo terbaik yang menghasilkan potongan tertinggi.
                </p>
                <p>
                  <strong>Prioritas Diskon VIP:</strong> Apabila nilai diskon promo umum dan promo VIP bernilai sama persis, diskon VIP otomatis diutamakan.
                </p>
                <p>
                  <strong>Validitas Waktu Lokal:</strong> Promo berbatas waktu hanya berlaku pada rentang tanggal kalender lokal yang ditentukan (YYYY-MM-DD). Promo terjadwal atau kedaluwarsa otomatis dinonaktifkan di kasir.
                </p>
                <p>
                  <strong>Promo Tanpa Batas:</strong> Promo tanpa batas waktu terus berlaku hingga dinonaktifkan manual oleh Owner.
                </p>
              </InfoPopover>
            </div>
            <span className="text-[11px] font-bold text-stone-500 bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-xl">
              {discountRules.length} Aturan Terdaftar
            </span>
          </div>

          {/* Responsive Two-Column Layout (Desktop/Landscape) / Stacked (Mobile/Portrait) */}
          <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 items-start">
            {/* Area Pengelolaan Promo: Mobile di atas (order-1), Desktop di kanan (lg:col-span-4, order-2) */}
            <div className="order-1 lg:order-2 lg:col-span-4 w-full space-y-4">
              {/* Tombol Tambah Promo Utama (Hero CTA) */}
              <button
                type="button"
                onClick={handleOpenCreateDiscount}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-2xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <Plus className="w-4 h-4 text-[#D4A373]" />
                Tambah Promo Baru
              </button>

              {/* Ringkasan Cepat Status Promo */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-800 space-y-3">
                <span className="font-extrabold text-[11px] text-stone-700 dark:text-stone-300 uppercase tracking-wider block">
                  Ringkasan Status Promo
                </span>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                    <span className="block text-base font-black text-emerald-600">
                      {activePromosCount}
                    </span>
                    <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Aktif</span>
                  </div>
                  <div className="p-2 rounded-xl bg-stone-100 dark:bg-stone-800/80 border border-stone-200 dark:border-stone-700">
                    <span className="block text-base font-black text-stone-600 dark:text-stone-300">
                      {inactivePromosCount}
                    </span>
                    <span className="text-[10px] font-bold text-stone-500 dark:text-stone-400">Nonaktif</span>
                  </div>
                  <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <span className="block text-base font-black text-amber-600">
                      {vipPromosCount}
                    </span>
                    <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400">VIP</span>
                  </div>
                </div>
              </div>

              {/* Petunjuk Singkat Aturan Kasir */}
              <div className="p-3.5 rounded-2xl bg-amber-500/5 dark:bg-amber-950/20 border border-amber-300/50 dark:border-amber-800/40 text-[11px] text-stone-600 dark:text-stone-300 space-y-1.5">
                <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-400 text-xs">
                  <ShieldCheck className="w-4 h-4 text-amber-600" />
                  Aturan Otomasi Kasir
                </div>
                <p className="text-[10px] leading-relaxed text-stone-500 dark:text-stone-400">
                  Kasir menerapkan 1 potongan tertinggi secara otomatis. Promo nonaktif, belum mulai, atau kedaluwarsa tidak akan dihitung.
                </p>
              </div>
            </div>

            {/* Area Daftar Promo: Mobile di bawah Action (order-2), Desktop di kiri (lg:col-span-8, order-1) */}
            <div className="order-2 lg:order-1 lg:col-span-8 w-full space-y-4">
              {/* Search Bar */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-stone-400">
                  <Search className="w-4 h-4" />
                </div>
                <input
                  id="promo-search-input"
                  type="text"
                  value={promoSearchQuery}
                  onChange={e => setPromoSearchQuery(e.target.value)}
                  placeholder="Cari nama promo, jenis (umum / VIP), atau status (aktif / terjadwal / kedaluwarsa / nonaktif)..."
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-800 font-medium text-stone-900 dark:text-stone-100 placeholder:text-stone-400 focus:outline-hidden focus:border-[#C68B59] text-xs transition-colors"
                />
                {promoSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setPromoSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 cursor-pointer min-h-[44px] min-w-[44px] justify-center"
                    aria-label="Bersihkan pencarian"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* List Discount Rules */}
              {discountRules.length === 0 ? (
                <div className="text-center py-8 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-dashed border-stone-200 dark:border-stone-800">
                  <Tag className="w-8 h-8 text-stone-300 dark:text-stone-700 mx-auto mb-2" />
                  <p className="font-bold text-stone-600 dark:text-stone-400">Belum ada promo diskon aktif</p>
                  <p className="text-[11px] text-stone-400 mt-0.5">Klik 'Tambah Promo Baru' untuk membuat potongan harga otomatis.</p>
                </div>
              ) : filteredDiscountRules.length === 0 ? (
                <div className="text-center py-8 bg-stone-50 dark:bg-[#171514] rounded-2xl border border-dashed border-stone-200 dark:border-stone-800 space-y-2">
                  <Search className="w-8 h-8 text-stone-300 dark:text-stone-700 mx-auto" />
                  <p className="font-bold text-stone-600 dark:text-stone-400">
                    Tidak ada promo diskon yang sesuai dengan pencarian
                  </p>
                  <p className="text-[11px] text-stone-400">
                    Kata kunci: "{promoSearchQuery}". Coba periksa ejaan atau reset filter pencarian.
                  </p>
                  <button
                    type="button"
                    onClick={() => setPromoSearchQuery('')}
                    className="px-3.5 py-1.5 rounded-xl bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 text-stone-700 dark:text-stone-300 font-bold text-xs transition-colors cursor-pointer"
                  >
                    Reset Pencarian
                  </button>
                </div>
              ) : (
                <>
                  {/* Desktop Table View (>= lg: 1024px) */}
                  <div
                    id="promo-table-container"
                    className="hidden lg:block max-h-[305px] overflow-y-auto overflow-x-auto rounded-2xl border border-stone-200 dark:border-stone-800"
                  >
                    <table className="w-full text-left border-collapse min-w-[550px]">
                      <thead className="sticky top-0 z-10 bg-stone-50 dark:bg-[#171514] text-stone-600 dark:text-stone-400 font-bold border-b border-stone-200 dark:border-stone-800 shadow-2xs">
                        <tr>
                          <th className="p-3.5">Nama & Masa Berlaku</th>
                          <th className="p-3.5">Potongan</th>
                          <th className="p-3.5">Min. Belanja</th>
                          <th className="p-3.5">Jenis Promo</th>
                          <th className="p-3.5 text-center">Status</th>
                          <th className="p-3.5 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100 dark:divide-stone-800/60 font-medium">
                        {filteredDiscountRules.map(rule => {
                          const status = getPromoComputedStatus(rule);
                          return (
                            <tr key={rule.id} className="hover:bg-stone-50/50 dark:hover:bg-[#171514]/50 transition-colors">
                              <td className="p-3.5">
                                <span className="font-extrabold text-stone-900 dark:text-stone-100 text-xs block">
                                  {rule.name}
                                </span>
                                {rule.validity_type === 'time_limited' && rule.start_date && rule.end_date ? (
                                  <span className="text-[10px] text-stone-500 dark:text-stone-400 flex items-center gap-1 mt-0.5 font-medium">
                                    <Calendar className="w-3 h-3 text-[#C68B59]" />
                                    {rule.start_date} s/d {rule.end_date}
                                  </span>
                                ) : (
                                  <span className="text-[10px] text-stone-400 block mt-0.5 font-medium">
                                    Tanpa batas waktu
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5">
                                <span className="inline-flex items-center font-black text-emerald-600 bg-emerald-500/10 px-2.5 py-0.5 rounded-lg text-xs">
                                  {rule.discount_percentage}%
                                </span>
                              </td>
                              <td className="p-3.5 font-bold text-stone-700 dark:text-stone-300">
                                {rule.minimum_purchase > 0 ? formatRupiah(rule.minimum_purchase) : 'Tanpa Minimum'}
                              </td>
                              <td className="p-3.5">
                                {rule.scope === 'vip' ? (
                                  <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-2.5 py-0.5 rounded-lg text-[11px] border border-amber-300 dark:border-amber-700/50">
                                    <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                    Khusus VIP
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-bold text-stone-600 dark:text-stone-300 bg-stone-100 dark:bg-stone-800 px-2.5 py-0.5 rounded-lg text-[11px]">
                                    Umum
                                  </span>
                                )}
                              </td>
                              <td className="p-3.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleToggleDiscount(rule)}
                                  disabled={actionLoadingId === rule.id}
                                  className="inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                  title={`Status: ${status}. Klik untuk ${rule.is_active ? 'menonaktifkan' : 'mengaktifkan'}`}
                                >
                                  {status === 'active' && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full hover:bg-emerald-500/20 transition-colors">
                                      <CheckCircle2 className="w-3.5 h-3.5" />
                                      Aktif
                                    </span>
                                  )}
                                  {status === 'scheduled' && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-blue-600 bg-blue-500/10 px-2.5 py-1 rounded-full hover:bg-blue-500/20 transition-colors">
                                      <Clock className="w-3.5 h-3.5" />
                                      Terjadwal
                                    </span>
                                  )}
                                  {status === 'expired' && (
                                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-rose-600 bg-rose-500/10 px-2.5 py-1 rounded-full hover:bg-rose-500/20 transition-colors">
                                      <AlertCircle className="w-3.5 h-3.5" />
                                      Kedaluwarsa
                                    </span>
                                  )}
                                  {status === 'disabled' && (
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
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile & Tablet Portrait Cards View (< lg: 1024px) - Stock Material Pattern with Dynamic Height & Internal Scroll */}
                  <div
                    ref={mobilePromoListRef}
                    style={{
                      maxHeight: mobilePromoMaxHeight ? `${mobilePromoMaxHeight}px` : undefined,
                    }}
                    className="lg:hidden divide-y divide-stone-100 dark:divide-stone-800/80 rounded-2xl border border-stone-200 dark:border-stone-800 bg-white dark:bg-[#1E1C1A] overflow-y-auto"
                  >
                    {filteredDiscountRules.map(rule => {
                      const status = getPromoComputedStatus(rule);
                      return (
                        <div key={`mobile-promo-${rule.id}`} className="p-4 space-y-3 hover:bg-stone-50/50 dark:hover:bg-[#25221F] transition-colors">
                          {/* Header: Nama Promo + Status Badge */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <span className="font-extrabold text-stone-900 dark:text-stone-100 text-sm block break-words">
                                {rule.name}
                              </span>
                              {rule.validity_type === 'time_limited' && rule.start_date && rule.end_date ? (
                                <span className="text-[11px] text-stone-500 dark:text-stone-400 flex items-center gap-1 mt-0.5 font-medium">
                                  <Calendar className="w-3.5 h-3.5 text-[#C68B59]" />
                                  {rule.start_date} s/d {rule.end_date}
                                </span>
                              ) : (
                                <span className="text-[11px] text-stone-400 block mt-0.5 font-medium">
                                  Tanpa batas waktu
                                </span>
                              )}
                            </div>

                            {/* Status badge with toggle button */}
                            <button
                              type="button"
                              onClick={() => handleToggleDiscount(rule)}
                              disabled={actionLoadingId === rule.id}
                              aria-label={`Status: ${status}. Klik untuk ${rule.is_active ? 'menonaktifkan' : 'mengaktifkan'} promo ${rule.name}`}
                              className="shrink-0 inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50 min-h-[36px]"
                            >
                              {status === 'active' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                  Aktif
                                </span>
                              )}
                              {status === 'scheduled' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-blue-600 bg-blue-500/10 px-2.5 py-1 rounded-full border border-blue-500/20">
                                  <Clock className="w-3.5 h-3.5" />
                                  Terjadwal
                                </span>
                              )}
                              {status === 'expired' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-600 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                                  <AlertCircle className="w-3.5 h-3.5" />
                                  Kedaluwarsa
                                </span>
                              )}
                              {status === 'disabled' && (
                                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-stone-400 bg-stone-100 dark:bg-stone-800 px-2.5 py-1 rounded-full border border-stone-200 dark:border-stone-700">
                                  Nonaktif
                                </span>
                              )}
                            </button>
                          </div>

                          {/* Body: Potongan & Minimum vs Tipe / Area */}
                          <div className="grid grid-cols-2 gap-2 p-2.5 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-100 dark:border-stone-800/80 text-xs">
                            <div>
                              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                                Potongan Diskon
                              </span>
                              <div className="mt-0.5 flex items-baseline gap-1.5">
                                <span className="font-black text-emerald-600 text-base">
                                  {rule.discount_percentage}%
                                </span>
                                <span className="text-[10px] text-stone-500">
                                  {rule.minimum_purchase > 0 ? `Min. ${formatRupiah(rule.minimum_purchase)}` : 'Tanpa Min.'}
                                </span>
                              </div>
                            </div>

                            <div>
                              <span className="text-[10px] font-bold text-stone-400 uppercase tracking-wider block">
                                Tipe / Area
                              </span>
                              <div className="mt-0.5">
                                {rule.scope === 'vip' ? (
                                  <span className="inline-flex items-center gap-1 font-bold text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-lg text-[10px] border border-amber-300 dark:border-amber-700/50">
                                    <Crown className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                                    Khusus VIP
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 font-bold text-stone-600 dark:text-stone-300 bg-stone-200/60 dark:bg-stone-800 px-2 py-0.5 rounded-lg text-[10px]">
                                    Umum / Reguler
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Footer: Action Buttons */}
                          <div className="pt-1 flex items-center justify-end gap-2 border-t border-stone-100 dark:border-stone-800/60">
                            <button
                              type="button"
                              onClick={() => handleOpenEditDiscount(rule)}
                              disabled={actionLoadingId === rule.id}
                              aria-label={`Edit promo ${rule.name}`}
                              className="flex-1 py-2 px-3 rounded-xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 text-stone-700 dark:text-stone-200 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 min-h-[38px] cursor-pointer"
                            >
                              <Edit2 className="w-3.5 h-3.5 text-[#C68B59]" />
                              Edit Promo
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteDiscount(rule)}
                              disabled={actionLoadingId === rule.id}
                              aria-label={`Hapus promo ${rule.name}`}
                              className="py-2 px-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 hover:bg-rose-100 text-rose-600 dark:text-rose-400 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 min-h-[38px] cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Hapus
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3, 4 & 5. BRANDING, CADANGAN & RESET DATA (2-KOLOM SEIMBANG DESKTOP) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Kolom Kiri: 3. PENGELOLAAN LOGO & BRANDING TOKO */}
        <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 p-4 sm:p-6 space-y-5 shadow-sm text-xs flex flex-col justify-between lg:h-full">
          <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
            <h3 className="font-extrabold text-sm text-[#3B2A1F] dark:text-[#D4A373] uppercase tracking-wider flex items-center gap-2">
              <ImageIcon className="w-4 h-4 text-[#C68B59]" /> Pengelolaan Logo & Branding Toko
            </h3>
            <InfoPopover title="Panduan Logo & Branding Toko">
              <p>
                <strong>Pemisahan Logo Mandiri:</strong> Logo merek aplikasi dan logo printer struk disimpan pada slot IndexedDB terpisah sehingga pergantian salah satu logo tidak mempengaruhi yang lain.
              </p>
              <p>
                <strong>Format & Batasan File:</strong> Mendukung format PNG, JPEG, dan WebP dengan ukuran file maksimal 5MB. Gambar otomatis dikompresi proporsional secara instan di peramban.
              </p>
              <p>
                <strong>Logo Merek Aplikasi:</strong> Tampil pada navbar desktop, mobile header, dan favicon tab peramban kasir.
              </p>
              <p>
                <strong>Logo Printer Struk Thermal:</strong> Khusus dicetak pada header struk fisik kasir dan fungsi Test Printer. Teroptimasi monokrom dan proporsional untuk format 58mm maupun 80mm tanpa overflow.
              </p>
            </InfoPopover>
          </div>

          <div className="grid grid-cols-1 gap-4">
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

        {/* Kolom Kanan: 4. CADANGAN & PEMULIHAN TERENKRIPSI + 5. RESET DATA DEMO */}
        <div className="flex flex-col gap-6 lg:h-full">
          {/* 4. CADANGAN & PEMULIHAN TERENKRIPSI */}
          <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl border border-stone-200 dark:border-stone-800 p-4 sm:p-6 space-y-5 shadow-sm text-xs">
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-stone-800 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-sm text-[#3B2A1F] dark:text-[#D4A373] uppercase tracking-wider flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#C68B59]" /> Cadangan & Pemulihan Terenkripsi
                </h3>
                <InfoPopover title="Panduan Cadangan & Pemulihan Terenkripsi">
                  <p>
                    <strong>Standar Enkripsi:</strong> Menggunakan enkripsi kuat AES-GCM 256-bit dengan derivasi kunci PBKDF2 (600.000 iterasi). File cadangan aman disimpan secara offline tanpa risiko kebocoran plaintext.
                  </p>
                  <p>
                    <strong>Cakupan Cadangan:</strong> Mengemas seluruh pengguna, katalog produk, stok bahan baku, resep, transaksi kasir, riwayat shift, konfigurasi toko, serta kedua aset logo kustom.
                  </p>
                  <p>
                    <strong>Pemulihan Atomik (2PC):</strong> File cadangan diverifikasi terlebih dahulu di memori staging sebelum diterapkan secara atomik ke database lokal. Jika verifikasi gagal, data saat ini tetap utuh.
                  </p>
                  <p>
                    <strong>Otorisasi:</strong> Memerlukan otorisasi PIN Owner aktif baik untuk membuat cadangan baru maupun memulihkan database.
                  </p>
                  <p>
                    <strong>Dampak Pemulihan:</strong> Proses restore menggantikan seluruh data toko saat ini dengan isi file cadangan. Pastikan data terbaru sudah dicadangkan sebelum melakukan pemulihan.
                  </p>
                </InfoPopover>
              </div>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-[10px] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Standar Keamanan
              </span>
            </div>

            <div className="grid grid-cols-1 gap-4">
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
                <button
                  type="button"
                  disabled={!isOwner}
                  onClick={() => setIsBackupModalOpen(true)}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-[#C68B59] hover:bg-[#B57A48] text-white font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
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
                <button
                  type="button"
                  disabled={!isOwner}
                  onClick={() => setIsRestoreModalOpen(true)}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-stone-900 dark:bg-stone-800 hover:bg-stone-800 dark:hover:bg-stone-700 text-white font-bold shadow-sm transition-all disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
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

          {/* 5. RESET DATA DEMO (DANGER ZONE - S4 - OWNER ONLY) */}
          {isOwner && (
            <div className="bg-white dark:bg-[#1E1C1A] rounded-3xl border-2 border-rose-300 dark:border-rose-900/60 p-4 sm:p-5 space-y-3.5 shadow-sm text-xs lg:mt-auto">
              <div className="flex items-center justify-between border-b border-rose-100 dark:border-rose-950/30 pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-rose-600" />
                  <h3 className="font-extrabold text-sm text-rose-700 dark:text-rose-400 uppercase tracking-wider">
                    Reset Demo
                  </h3>
                  <InfoPopover title="Panduan & Dampak Reset Data Demo">
                    <p>
                      <strong>Dampak Penghapusan:</strong> Menghapus seluruh transaksi kasir, mutasi stok bahan, riwayat opname, resep baru, riwayat shift & rekonsiliasi kasir, aturan promo diskon kustom, dan kedua logo kustom di IndexedDB.
                    </p>
                    <p>
                      <strong>Pemulihan Bawaan Pabrik:</strong> Database dikembalikan ke 15 katalog produk awal, kategori standar, dan stok bawaan pabrik Booth Daily.
                    </p>
                    <p>
                      <strong>Sesi Login:</strong> Sesi login saat ini akan langsung diakhiri secara otomatis untuk keamanan sistem.
                    </p>
                    <p>
                      <strong>Otorisasi & Keamanan:</strong> Memerlukan konfirmasi dan otorisasi PIN Owner 4 digit aktif. Tindakan bersifat permanen dan tidak dapat dibatalkan kecuali Anda memiliki file cadangan (.enc.json).
                    </p>
                  </InfoPopover>
                </div>
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 font-bold text-[10px]">
                  Tindakan Permanen
                </span>
              </div>

              <p className="text-[11px] text-stone-500 leading-relaxed">
                Mengembalikan seluruh database lokal aplikasi ke kondisi awal instalasi pabrik. Memerlukan otorisasi PIN Owner aktif.
              </p>

              <button
                type="button"
                onClick={() => setIsResetModalOpen(true)}
                className="min-h-[44px] w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-all cursor-pointer"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Reset Data Demo</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MODAL CREATE / EDIT DISCOUNT */}
      <DiscountRuleModal
        isOpen={isDiscountModalOpen}
        onClose={() => setIsDiscountModalOpen(false)}
        onSave={handleSaveDiscount}
        initialData={editingDiscountRule}
      />

      {/* MODAL BACKUP TERENKRIPSI */}
      <BackupModal
        isOpen={isBackupModalOpen}
        onClose={() => setIsBackupModalOpen(false)}
        showToast={showToast}
      />

      {/* MODAL RESTORE TERENKRIPSI */}
      <RestoreModal
        isOpen={isRestoreModalOpen}
        onClose={() => setIsRestoreModalOpen(false)}
        showToast={showToast}
        onSuccess={handleRestoreSuccess}
      />

      {/* MODAL FACTORY RESET */}
      <FactoryResetModal
        isOpen={isResetModalOpen}
        onClose={() => setIsResetModalOpen(false)}
        showToast={showToast}
        onSuccess={handleFactoryResetSuccess}
      />
    </div>
  );
};

