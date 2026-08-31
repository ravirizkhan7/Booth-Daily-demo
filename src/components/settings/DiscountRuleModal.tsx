import React, { useState, useEffect } from 'react';
import { DiscountRule } from '../../types';
import { Tag, X, Percent, DollarSign, CheckCircle2 } from 'lucide-react';
import { NumberInput } from '../common/NumberInput';

interface DiscountRuleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (payload: {
    name: string;
    minimum_purchase: number;
    discount_percentage: number;
    is_active?: boolean;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (initialData) {
        setName(initialData.name || '');
        setMinimumPurchase(Number(initialData.minimum_purchase) || 0);
        setDiscountPercentage(Number(initialData.discount_percentage) || 0);
        setIsActive(initialData.is_active ?? true);
      } else {
        setName('');
        setMinimumPurchase(0);
        setDiscountPercentage(10);
        setIsActive(true);
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

    setIsSubmitting(true);
    setError(null);
    try {
      await onSave({
        name: trimmedName,
        minimum_purchase: minPurchase,
        discount_percentage: discPercent,
        is_active: isActive,
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
      <div className="bg-white dark:bg-[#1E1C1A] w-full max-w-md rounded-3xl border border-stone-200 dark:border-stone-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 bg-stone-50/50 dark:bg-[#171514]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#C68B59]/10 text-[#C68B59]">
              <Tag className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-black text-stone-900 dark:text-stone-100">
                {initialData ? 'Edit Promo Diskon' : 'Tambah Promo Diskon'}
              </h2>
              <p className="text-[11px] text-stone-500 font-medium">
                Aturan potongan harga otomatis di kasir
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
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
              type="text"
              required
              placeholder="Contoh: Promo Weekend Siang / Diskon Kopi 10%"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-bold text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-[#C68B59]"
            />
          </div>

          {/* Minimum Belanja & Persentase Diskon */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-stone-700 dark:text-stone-300 mb-1 flex items-center gap-1">
                <DollarSign className="w-3.5 h-3.5 text-[#C68B59]" />
                Min. Belanja (Rp)
              </label>
              <NumberInput
                min={0}
                allowDecimals={false}
                required
                value={minimumPurchase}
                onChange={val => setMinimumPurchase(val)}
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
