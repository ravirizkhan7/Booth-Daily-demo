import React, { useState, useEffect, useRef } from 'react';
import { DiscountRule, PromotionValidityType } from '../../types';
import { Tag, X, Percent, DollarSign, CheckCircle2, Crown, Calendar } from 'lucide-react';
import { NumberInput } from '../common/NumberInput';

interface DiscountRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    minimum_purchase: number;
    discount_percentage: number;
    is_active?: boolean;
    scope?: 'general' | 'vip';
    validity_type?: PromotionValidityType;
    start_date?: string | null;
    end_date?: string | null;
  }) => Promise<void>;
  initialData?: DiscountRule | null;
}

export const DiscountRuleModal: React.FC<DiscountRuleModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialData,
}) => {
  const [name, setName] = useState('');
  const [minimumPurchase, setMinimumPurchase] = useState<number>(0);
  const [discountPercentage, setDiscountPercentage] = useState<number>(10);
  const [isActive, setIsActive] = useState(true);
  const [scope, setScope] = useState<'general' | 'vip'>('general');
  const [validityType, setValidityType] = useState<PromotionValidityType>('unlimited');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // F-08 Focus Management & Escape Refs
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // F-08 Focus Trap & SAFE_TO_CLOSE Escape Handling
  useEffect(() => {
    if (!isOpen) return;
    triggerRef.current = document.activeElement as HTMLElement | null;

    const timer = setTimeout(() => {
      const nameInput = modalRef.current?.querySelector<HTMLInputElement>('input[type="text"]');
      nameInput?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isSubmitting) {
          e.preventDefault();
          onClose();
        }
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusables = modalRef.current.querySelectorAll<HTMLElement>(
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
      if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
        triggerRef.current.focus();
      }
    };
  }, [isOpen, isSubmitting, onClose]);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name || '');
        setMinimumPurchase(Number(initialData.minimum_purchase) || 0);
        setDiscountPercentage(Number(initialData.discount_percentage) || 0);
        setIsActive(initialData.is_active ?? true);
        setScope(initialData.scope === 'vip' ? 'vip' : 'general');
        setValidityType(initialData.validity_type === 'time_limited' ? 'time_limited' : 'unlimited');
        setStartDate(initialData.start_date ? initialData.start_date.slice(0, 10) : '');
        setEndDate(initialData.end_date ? initialData.end_date.slice(0, 10) : '');
      } else {
        setName('');
        setMinimumPurchase(0);
        setDiscountPercentage(10);
        setIsActive(true);
        setScope('general');
        setValidityType('unlimited');
        setStartDate('');
        setEndDate('');
      }
      setError(null);
      setIsSubmitting(false);
    }
  }, [isOpen, initialData]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Nama promo tidak boleh kosong.');
      return;
    }

    const minPurchase = Number(minimumPurchase) || 0;
    if (minPurchase < 0) {
      setError('Minimum belanja tidak boleh bernilai negatif.');
      return;
    }

    const discPercent = Number(discountPercentage) || 0;
    if (discPercent <= 0 || discPercent > 100) {
      setError('Persentase diskon harus antara 0.1% sampai 100%.');
      return;
    }

    // Validation for time-limited promotion
    if (validityType === 'time_limited') {
      if (!startDate) {
        setError('Tanggal mulai wajib diisi untuk promo berbatas waktu.');
        return;
      }
      if (!endDate) {
        setError('Tanggal selesai wajib diisi untuk promo berbatas waktu.');
        return;
      }
      if (endDate < startDate) {
        setError('Tanggal selesai tidak boleh lebih awal dari tanggal mulai.');
        return;
      }
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await onSave({
        name: trimmedName,
        minimum_purchase: minPurchase,
        discount_percentage: discPercent,
        is_active: isActive,
        scope,
        validity_type: validityType,
        start_date: validityType === 'time_limited' ? startDate : null,
        end_date: validityType === 'time_limited' ? endDate : null,
      });
      onClose();
    } catch (err: any) {
      console.error('Failed to save discount rule:', err);
      setError(err?.response?.data?.message || 'Gagal menyimpan aturan diskon.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div 
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="discount-modal-title"
        className="bg-white dark:bg-[#1E1C1A] w-full max-w-md rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-[#171514]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#C68B59]/10 text-[#C68B59]">
              <Tag className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 id="discount-modal-title" className="text-base font-black text-stone-900 dark:text-stone-100">
                {initialData ? 'Edit Promo Diskon' : 'Tambah Promo Diskon'}
              </h2>
              <p className="text-[11px] text-stone-500 font-medium">
                Aturan potongan harga otomatis di kasir
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isSubmitting}
            onClick={() => !isSubmitting && onClose()}
            className="min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer flex items-center justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#3B2A1F] dark:focus-visible:ring-[#D4A373] disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Tutup modal aturan diskon"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 font-bold text-xs">
              {error}
            </div>
          )}

          {/* Nama Promo */}
          <div>
            <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
              Nama Promo <span className="text-rose-500">*</span>
            </label>
            <input
              id="discount-rule-name"
              type="text"
              required
              placeholder="Contoh: Promo Weekend Siang / Diskon Kopi 10%"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-[#C68B59]"
            />
          </div>

          {/* Jenis Promo (Scope) */}
          <div className="space-y-1.5 pt-0.5">
            <label className="block font-bold text-stone-700 dark:text-stone-300">
              Promo berlaku untuk: <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                  scope === 'general'
                    ? 'bg-[#C68B59]/10 border-[#C68B59] text-stone-900 dark:text-stone-100 shadow-2xs'
                    : 'bg-stone-50 dark:bg-[#171514] border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100/50'
                }`}
              >
                <input
                  type="radio"
                  name="discount_scope"
                  value="general"
                  checked={scope === 'general'}
                  onChange={() => setScope('general')}
                  className="mt-0.5 text-[#C68B59] focus:ring-[#C68B59] cursor-pointer"
                />
                <div>
                  <span className="font-bold text-xs block text-stone-900 dark:text-stone-100">Umum</span>
                  <span className="text-[10px] text-stone-500 block leading-tight mt-0.5">
                    Berlaku untuk transaksi reguler & VIP
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                  scope === 'vip'
                    ? 'bg-amber-500/10 border-amber-500 text-amber-900 dark:text-amber-200 shadow-2xs'
                    : 'bg-stone-50 dark:bg-[#171514] border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100/50'
                }`}
              >
                <input
                  type="radio"
                  name="discount_scope"
                  value="vip"
                  checked={scope === 'vip'}
                  onChange={() => setScope('vip')}
                  className="mt-0.5 text-amber-600 focus:ring-amber-500 cursor-pointer"
                />
                <div>
                  <span className="font-bold text-xs block flex items-center gap-1 text-amber-800 dark:text-amber-300">
                    <Crown className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" /> Khusus Ruang VIP
                  </span>
                  <span className="text-[10px] text-stone-500 block leading-tight mt-0.5">
                    Hanya aktif pada pesanan area VIP
                  </span>
                </div>
              </label>
            </div>
          </div>

          {/* Minimum Belanja & Persentase Diskon */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-[#C68B59]" />
                Min. Belanja (Rp)
              </label>
              <NumberInput
                id="discount-rule-min-purchase"
                isCurrency={true}
                min={0}
                required
                value={minimumPurchase}
                onChange={val => setMinimumPurchase(val)}
                placeholder="Rp 0"
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-[#C68B59]"
              />
              <p className="text-[10px] text-stone-400 mt-0.5">Isi 0 untuk tanpa batas min.</p>
            </div>

            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1 flex items-center gap-1">
                <Percent className="w-3.5 h-3.5 text-[#C68B59]" />
                Diskon (%)
              </label>
              <NumberInput
                id="discount-rule-percentage"
                min={0}
                max={100}
                allowDecimals={true}
                required
                value={discountPercentage}
                onChange={val => setDiscountPercentage(val)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-[#C68B59]"
              />
              <p className="text-[10px] text-stone-400 mt-0.5">Rentang 0.1% – 100% (bebas bulat/desimal)</p>
            </div>
          </div>

          {/* Masa Berlaku Promo (Unlimited vs Time-Limited) */}
          <div className="space-y-2 pt-0.5">
            <label className="block font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-[#C68B59]" />
              Masa Berlaku Promo: <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label
                className={`flex items-start gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                  validityType === 'unlimited'
                    ? 'bg-[#C68B59]/10 border-[#C68B59] text-stone-900 dark:text-stone-100 shadow-2xs'
                    : 'bg-stone-50 dark:bg-[#171514] border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100/50'
                }`}
              >
                <input
                  type="radio"
                  name="validity_type"
                  value="unlimited"
                  checked={validityType === 'unlimited'}
                  onChange={() => setValidityType('unlimited')}
                  className="mt-0.5 text-[#C68B59] focus:ring-[#C68B59] cursor-pointer"
                />
                <div>
                  <span className="font-bold text-xs block text-stone-900 dark:text-stone-100">Tanpa Batas</span>
                  <span className="text-[10px] text-stone-500 block leading-tight mt-0.5">
                    Aktif tanpa tanggal kedaluwarsa
                  </span>
                </div>
              </label>

              <label
                className={`flex items-start gap-2.5 p-3 rounded-2xl border cursor-pointer transition-all ${
                  validityType === 'time_limited'
                    ? 'bg-[#C68B59]/10 border-[#C68B59] text-stone-900 dark:text-stone-100 shadow-2xs'
                    : 'bg-stone-50 dark:bg-[#171514] border-stone-200 dark:border-stone-800 text-stone-600 dark:text-stone-400 hover:bg-stone-100/50'
                }`}
              >
                <input
                  type="radio"
                  name="validity_type"
                  value="time_limited"
                  checked={validityType === 'time_limited'}
                  onChange={() => setValidityType('time_limited')}
                  className="mt-0.5 text-[#C68B59] focus:ring-[#C68B59] cursor-pointer"
                />
                <div>
                  <span className="font-bold text-xs block text-stone-900 dark:text-stone-100">Batas Waktu</span>
                  <span className="text-[10px] text-stone-500 block leading-tight mt-0.5">
                    Aktif pada rentang tanggal tertentu
                  </span>
                </div>
              </label>
            </div>

            {/* Input Tanggal Mulai & Tanggal Selesai */}
            {validityType === 'time_limited' && (
              <div className="grid grid-cols-2 gap-3 pt-1 animate-in fade-in duration-150">
                <div>
                  <label htmlFor="promo-start-date" className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Tanggal Mulai <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="promo-start-date"
                    type="date"
                    required={validityType === 'time_limited'}
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-[#C68B59]"
                  />
                </div>

                <div>
                  <label htmlFor="promo-end-date" className="block font-bold text-stone-700 dark:text-stone-300 mb-1">
                    Tanggal Selesai <span className="text-rose-500">*</span>
                  </label>
                  <input
                    id="promo-end-date"
                    type="date"
                    required={validityType === 'time_limited'}
                    value={endDate}
                    min={startDate || undefined}
                    onChange={e => setEndDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-[#C68B59]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Status Aktif */}
          <div className="pt-2">
            <label className="flex items-center gap-3 p-3 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-800 cursor-pointer">
              <input
                type="checkbox"
                checked={isActive}
                onChange={e => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded text-[#C68B59] focus:ring-[#C68B59] cursor-pointer"
              />
              <div>
                <p className="font-bold text-stone-900 dark:text-stone-100 text-xs">
                  Status Promo Aktif
                </p>
                <p className="text-[10px] text-stone-500">
                  Promo aktif akan otomatis dievaluasi dan diterapkan pada keranjang kasir
                </p>
              </div>
            </label>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-stone-100 dark:border-stone-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 font-bold text-xs transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-bold text-xs shadow-md transition-all cursor-pointer disabled:opacity-60"
            >
              <CheckCircle2 className="w-4 h-4 text-[#D4A373]" />
              {isSubmitting ? 'Menyimpan...' : initialData ? 'Perbarui Promo' : 'Simpan Promo'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
