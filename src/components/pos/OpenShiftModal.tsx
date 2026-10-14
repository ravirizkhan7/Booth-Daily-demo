import React, { useState, useEffect } from 'react';
import { usePOS } from '../../hooks/usePOS';
import { formatRupiah } from '../../utils/formatters';
import { NumberInput } from '../common/NumberInput';
import { PinKeypad } from '../common/PinKeypad';
import { X, DoorOpen, Banknote, Sparkles } from 'lucide-react';

export const OpenShiftModal: React.FC = () => {
  const {
    isOpenShiftModalOpen,
    closeOpenShiftModal,
    openShift,
    currentUser,
  } = usePOS();

  const [cashInitialInput, setCashInitialInput] = useState<string>('0');
  const [pin, setPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isOpenShiftModalOpen) {
      setCashInitialInput('0');
      setPin('');
      setErrorMessage('');
      setIsSubmitting(false);
    }
  }, [isOpenShiftModalOpen]);

  if (!isOpenShiftModalOpen) return null;

  const parsedCashInitial = Math.max(0, parseFloat(cashInitialInput) || 0);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (isNaN(parsedCashInitial) || parsedCashInitial < 0) {
      setErrorMessage('Modal awal kas harus berupa nominal valid.');
      return;
    }

    if (pin.length !== 4) {
      setErrorMessage('Masukkan 4 digit PIN petugas pembuka.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    const res = await openShift(parsedCashInitial, pin);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.message);
      setPin('');
    } else {
      setPin('');
      closeOpenShiftModal();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div
        className="relative w-full max-w-lg bg-[#F7F5F2] dark:bg-[#1A1816] rounded-3xl shadow-2xl border border-stone-300 dark:border-stone-800 overflow-hidden flex flex-col max-h-[92vh] my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#3B2A1F] text-[#F7F5F2] flex justify-between items-center shrink-0 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#D4A373]/20 flex items-center justify-center border border-[#D4A373]/30">
              <DoorOpen className="w-5 h-5 text-[#D4A373]" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-wide">Buka Shift Kasir</h2>
              <p className="text-xs text-[#D4A373]/90 font-medium">Mulai Sesi Operasional Kasir Baru</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeOpenShiftModal}
            className="p-2 rounded-xl hover:bg-white/10 text-stone-300 transition-colors cursor-pointer"
            aria-label="Tutup"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Modal Awal (Cash Awal) Input */}
          <div className="p-4 bg-white dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3 shadow-sm">
            <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800/80 pb-2">
              <span className="text-[11px] font-extrabold uppercase text-stone-400 tracking-wider flex items-center gap-1.5">
                <Banknote className="w-3.5 h-3.5 text-[#C68B59]" />
                MODAL AWAL KAS DI LACI
              </span>
              <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                Wajib
              </span>
            </div>

            <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed">
              Masukkan seluruh uang fisik awal yang disediakan di laci kasir (uang modal kembalian). Modal awal tidak dihitung sebagai omzet penjualan.
            </p>

            <div className="space-y-2">
              <NumberInput
                value={Number(cashInitialInput) || 0}
                onChange={val => {
                  setCashInitialInput(val.toString());
                  setErrorMessage('');
                }}
                isCurrency={true}
                placeholder="Rp 0"
                className="w-full px-4 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 bg-[#F7F5F2] dark:bg-[#1A1816] font-black text-lg text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#3B2A1F] dark:focus:ring-[#D4A373]"
              />

              {/* Quick Nominal Chips */}
              <div className="flex flex-wrap gap-1.5 pt-1">
                {['0', '50000', '100000', '200000', '500000'].map(nominal => (
                  <button
                    key={nominal}
                    type="button"
                    onClick={() => {
                      setCashInitialInput(nominal);
                      setErrorMessage('');
                    }}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      cashInitialInput === nominal
                        ? 'bg-[#3B2A1F] text-[#F7F5F2] dark:bg-[#D4A373] dark:text-[#1A1816]'
                        : 'bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300'
                    }`}
                  >
                    {nominal === '0' ? 'Tanpa Modal (Rp 0)' : formatRupiah(Number(nominal))}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Verification PIN Section using shared PinKeypad */}
          <div className="p-4 bg-white dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3 shadow-sm">
            <PinKeypad
              pin={pin}
              onChange={val => {
                setPin(val);
                setErrorMessage('');
              }}
              errorMessage={errorMessage}
              label="VERIFIKASI PIN PETUGAS PEMBUKA"
              subtitle="Identitas petugas dicatat secara resmi dari verifikasi PIN"
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 sm:p-4 bg-white dark:bg-[#161413] border-t border-stone-200 dark:border-stone-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={closeOpenShiftModal}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-stone-200 dark:border-stone-800 font-bold text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer text-center"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={pin.length !== 4 || isSubmitting}
            className={`w-full sm:flex-1 py-3.5 px-4 rounded-2xl font-black text-xs text-[#F7F5F2] flex items-center justify-center gap-2 shadow-lg transition-all ${
              pin.length === 4 && !isSubmitting
                ? 'bg-[#3B2A1F] hover:bg-[#2A1E16] active:scale-98 cursor-pointer'
                : 'bg-stone-300 dark:bg-stone-800 text-stone-500 cursor-not-allowed shadow-none'
            }`}
          >
            <Sparkles className="w-4 h-4 text-[#D4A373] shrink-0" />
            <span className="truncate">
              {isSubmitting ? 'Membuka Shift...' : `Konfirmasi Buka Shift (${formatRupiah(parsedCashInitial)})`}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};
