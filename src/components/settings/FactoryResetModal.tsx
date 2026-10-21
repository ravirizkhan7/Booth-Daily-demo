import React, { useState } from 'react';
import { X, AlertTriangle, Lock, Eye, EyeOff, Loader2, RotateCcw, CheckCircle2 } from 'lucide-react';
import { factoryResetService } from '../../services/factoryResetService';
import { usePOS } from '../../hooks/usePOS';

interface FactoryResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  showToast: (msg: string, type: 'success' | 'error' | 'info') => void;
  onSuccess: () => void;
}

export const FactoryResetModal: React.FC<FactoryResetModalProps> = ({
  isOpen,
  onClose,
  showToast,
  onSuccess,
}) => {
  const { setRecoveryState, setRecoveryError } = usePOS();
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmedLoss, setConfirmedLoss] = useState(false);
  const [ownerPin, setOwnerPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    if (isProcessing) return;
    setStep(1);
    setConfirmedLoss(false);
    setOwnerPin('');
    setShowPin(false);
    setErrorMsg(null);
    onClose();
  };

  const handleStep1Next = (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmedLoss) {
      setErrorMsg('Harap centang konfirmasi pemahaman sebelum melanjutkan.');
      return;
    }
    setErrorMsg(null);
    setStep(2);
  };

  const handleStep2Reset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const cleanPin = ownerPin.trim();
    if (!cleanPin) {
      setErrorMsg('PIN Owner diperlukan untuk otorisasi reset pabrik.');
      return;
    }

    if (cleanPin.length !== 4 || !/^\d{4}$/.test(cleanPin)) {
      setErrorMsg('PIN Owner harus berupa 4 digit angka.');
      return;
    }

    setIsProcessing(true);
    try {
      const result = await factoryResetService.executeFactoryReset(cleanPin, {
        onResetStarted: () => {
          setRecoveryState('pending');
        },
        onResetFailed: (err: string) => {
          setRecoveryError(err);
          setRecoveryState('failed');
        },
      });
      showToast(result.message, 'success');
      onSuccess();
      handleClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Gagal mereset data demo ke kondisi awal.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-[#1E1C1A] w-full max-w-lg rounded-3xl border border-rose-200 dark:border-rose-950/40 shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-stone-100 dark:border-stone-800 bg-rose-50/50 dark:bg-rose-950/20">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-stone-900 dark:text-stone-100 text-sm">
                Reset Data Demo (Pabrik)
              </h3>
              <p className="text-[11px] text-stone-500 dark:text-stone-400">
                Tahap {step} dari 2: {step === 1 ? 'Konfirmasi Dampak Data' : 'Otorisasi PIN Owner'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isProcessing}
            className="p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mx-5 mt-4 p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 flex items-start gap-2.5 text-rose-700 dark:text-rose-300">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="text-[11px] leading-relaxed font-semibold">{errorMsg}</span>
          </div>
        )}

        {/* Step 1: Warning & Checklist */}
        {step === 1 && (
          <form onSubmit={handleStep1Next} className="p-5 space-y-4">
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 space-y-2">
              <div className="flex items-center gap-2 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>Peringatan: Tindakan ini permanen dan tidak dapat dibatalkan!</span>
              </div>
              <p className="text-[11px] leading-relaxed opacity-90">
                Operasi ini akan mengembalikan seluruh database lokal aplikasi ke kondisi awal saat instalasi pertama:
              </p>
            </div>

            <div className="space-y-2 bg-stone-50 dark:bg-[#171514] p-3.5 rounded-2xl border border-stone-200 dark:border-stone-800 text-[11px]">
              <div className="font-bold text-stone-700 dark:text-stone-300">Data yang akan dihapus:</div>
              <ul className="space-y-1 text-stone-600 dark:text-stone-400 pl-4 list-disc">
                <li>Seluruh transaksi pesanan kasir & arus kas.</li>
                <li>Penyesuaian stok bahan, riwayat opname, & resep baru.</li>
                <li>Riwayat pembukaan, penutupan, & rekonsiliasi shift kasir.</li>
                <li>Aturan promo diskon kustom.</li>
                <li>Kedua logo kustom (aplikasi & printer) pada IndexedDB.</li>
                <li>Sesi login saat ini akan langsung diakhiri.</li>
              </ul>
              <div className="pt-2 border-t border-stone-200 dark:border-stone-800 font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>Dipulihkan ke 15 katalog produk bawaan & stok standar Booth Daily.</span>
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-3 rounded-xl bg-rose-50/50 dark:bg-rose-950/10 border border-rose-200/60 dark:border-rose-900/30 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={confirmedLoss}
                onChange={(e) => setConfirmedLoss(e.target.checked)}
                className="mt-0.5 rounded border-stone-300 text-rose-600 focus:ring-rose-500"
              />
              <span className="text-[11px] text-stone-700 dark:text-stone-300 font-semibold leading-relaxed">
                Saya memahami sepenuhnya dan menyetujui penghapusan seluruh data demo toko.
              </span>
            </label>

            <div className="flex justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 font-bold hover:bg-stone-50 dark:hover:bg-stone-800"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={!confirmedLoss}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed shadow-md"
              >
                <span>Lanjut ke Verifikasi PIN</span>
              </button>
            </div>
          </form>
        )}

        {/* Step 2: Owner PIN Verification */}
        {step === 2 && (
          <form onSubmit={handleStep2Reset} className="p-5 space-y-4">
            <div className="p-3.5 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-800 space-y-1.5">
              <div className="font-bold text-stone-800 dark:text-stone-200 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-rose-600" />
                <span>Otorisasi Terakhir: PIN Owner</span>
              </div>
              <p className="text-[11px] text-stone-500 leading-relaxed">
                Masukkan 4 digit PIN Owner yang sah untuk mengonfirmasi reset pabrik.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-stone-700 dark:text-stone-300">
                PIN Owner Aktif (4 Digit)
              </label>
              <div className="relative">
                <input
                  type={showPin ? 'text' : 'password'}
                  maxLength={4}
                  inputMode="numeric"
                  value={ownerPin}
                  onChange={(e) => setOwnerPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="••••"
                  autoFocus
                  disabled={isProcessing}
                  className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-stone-50 dark:bg-[#171514] border border-stone-300 dark:border-stone-700 font-mono tracking-widest text-center text-lg font-black text-stone-900 dark:text-stone-100 focus:outline-hidden focus:border-rose-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 dark:hover:text-stone-200"
                >
                  {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                disabled={isProcessing}
                className="px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 text-stone-600 dark:text-stone-300 font-bold hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-50"
              >
                Kembali
              </button>
              <button
                type="submit"
                disabled={isProcessing || ownerPin.length !== 4}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold disabled:opacity-50 transition-all cursor-pointer disabled:cursor-not-allowed shadow-md"
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Mereset Data...</span>
                  </>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Konfirmasi & Reset Pabrik</span>
                  </>
                )}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
