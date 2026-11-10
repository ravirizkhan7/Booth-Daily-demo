import React, { useState, useEffect } from 'react';
import { Order, RefundRequest, User, Shift } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { refundService } from '../../services/refundService';
import { ToastType } from '../../context/pos/usePOSToast';
import { CheckCircle2, DollarSign, AlertCircle, X, ShieldCheck, ArrowLeft, AlertTriangle } from 'lucide-react';
import { PinKeypad } from '../common/PinKeypad';

export interface RefundDisbursementModalProps {
  isOpen: boolean;
  order: Order | null;
  refundRequest: RefundRequest | null;
  currentUser: User | null;
  activeShift: Shift | null;
  isShiftActive: boolean;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (message: string, type?: ToastType) => void;
}

export const RefundDisbursementModal: React.FC<RefundDisbursementModalProps> = ({
  isOpen,
  order,
  refundRequest,
  currentUser,
  activeShift,
  isShiftActive,
  onClose,
  onSuccess,
  showToast,
}) => {
  // Alur 4 Tahap Penyerahan Uang Aman:
  // 'auth' = Step 1 (PIN Authentication)
  // 'handover' = Step 2 (Review Confirmation) & Step 3 (Physical Handover Instruction) -> Commit Step 4
  const [step, setStep] = useState<'auth' | 'handover'>('auth');
  const [pin, setPin] = useState<string>('');
  const [validatedPin, setValidatedPin] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');

  useEffect(() => {
    if (isOpen) {
      setStep('auth');
      setPin('');
      setValidatedPin('');
      setErrorMessage('');
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen || !order || !refundRequest) return null;

  const handleClose = () => {
    if (isSubmitting) return;
    setStep('auth');
    setPin('');
    setValidatedPin('');
    setErrorMessage('');
    onClose();
  };

  // STEP 1: Verifikasi PIN Kasir (Belum ada mutasi keuangan/status)
  const handleVerifyPin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!isShiftActive || !activeShift) {
      setErrorMessage('Shift kasir aktif diperlukan untuk mencatat pengeluaran uang refund.');
      return;
    }

    if (currentUser?.role === 'owner') {
      setErrorMessage('Aksi ditolak: Pemilik (Owner) tidak memiliki wewenang untuk mencairkan kas fisik refund normal.');
      return;
    }

    const cleanPin = pin.trim();
    if (!cleanPin || cleanPin.length !== 4) {
      setErrorMessage('PIN kasir 4 digit wajib dimasukkan.');
      return;
    }

    if (!currentUser?.pin || currentUser.pin.trim() !== cleanPin) {
      setErrorMessage('Autentikasi gagal: PIN kasir tidak valid.');
      return;
    }

    // PIN valid terhadap akun kasir yang sedang bertugas
    // Lanjut ke Step 2 (Review Confirmation) & Step 3 (Physical Handover)
    // PERHATIAN: Kas BELUM berkurang, order BELUM berstatus refunded
    setValidatedPin(cleanPin);
    setStep('handover');
  };

  // STEP 4: Commit Disbursement setelah uang fisik diserahkan ke pelanggan
  const handleCommitDisbursement = async () => {
    if (isSubmitting) return;
    setErrorMessage('');

    if (!isShiftActive || !activeShift) {
      setErrorMessage('Shift kasir aktif diperlukan untuk mencatat pengeluaran uang refund.');
      return;
    }

    if (!validatedPin || validatedPin.length !== 4) {
      setErrorMessage('Sesi autentikasi PIN tidak ditemukan. Silakan masukkan ulang PIN.');
      setStep('auth');
      return;
    }

    setIsSubmitting(true);
    try {
      await refundService.disburseRefund(refundRequest.id, validatedPin);
      showToast(
        `Dana refund ${order.order_number} sebesar ${formatRupiah(refundRequest.amount)} berhasil diserahkan ke pelanggan.`,
        'success'
      );
      handleClose();
      onSuccess();
    } catch (err: any) {
      const msg = err?.message || 'Gagal memproses penyerahan uang refund.';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const initialMethod = (order.payment?.method || 'cash').toUpperCase();
  const refundMethod = (refundRequest.refund_payment_method || order.payment?.method || 'cash').toUpperCase();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#1E1C1A] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header — Booth Daily Blue Accent */}
        <div className="px-6 py-4 bg-blue-700 text-white flex justify-between items-center shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-2xl bg-white/10 text-white">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                Penyerahan Uang Refund Kasir
              </h2>
              <p className="text-xs text-blue-100 flex items-center gap-1.5 mt-0.5">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-200" />
                <span>
                  {step === 'auth' ? 'Tahap 1: Autentikasi PIN Kasir' : 'Tahap 2: Konfirmasi & Serah Terima Fisik'}
                </span>
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer min-w-[44px] min-h-[44px] flex items-center justify-center"
            title="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {/* STEP 1: Autentikasi PIN */}
          {step === 'auth' && (
            <form onSubmit={handleVerifyPin} className="space-y-4">
              {/* Info singkat pesanan & instruksi keamanan */}
              <div className="p-3.5 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                <div className="text-xs text-blue-950 dark:text-blue-200 space-y-0.5">
                  <div className="font-bold">
                    Otorisasi Pengeluaran Kas — #{order.order_number} ({formatRupiah(refundRequest.amount)})
                  </div>
                  <p className="text-[11px] text-blue-800 dark:text-blue-300">
                    Saldo kas belum berkurang. Masukkan 4 digit PIN kasir Anda untuk memvalidasi identitas petugas yang bertanggung jawab atas penyerahan uang fisik.
                  </p>
                </div>
              </div>

              {/* Status Shift Kasir */}
              {isShiftActive && activeShift ? (
                <div className="p-3 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-800 text-xs text-stone-700 dark:text-stone-300 flex items-center justify-between">
                  <div>
                    <span className="text-stone-500">Kasir Bertugas:</span>{' '}
                    <span className="font-bold">{currentUser?.name || 'Kasir'}</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">
                    Shift Aktif #{activeShift.id.slice(0, 8)}
                  </span>
                </div>
              ) : (
                <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 text-xs text-rose-800 dark:text-rose-200 flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold">Shift Kasir Belum Dibuka:</span>
                    <p className="mt-0.5 text-[11px]">
                      Anda harus membuka shift kasir terlebih dahulu untuk dapat mencairkan refund dan mencatat pengeluaran uang laci.
                    </p>
                  </div>
                </div>
              )}

              {/* Input PIN Kasir menggunakan PinKeypad bersama */}
              <div className="pt-1">
                <PinKeypad
                  pin={pin}
                  onChange={newPin => {
                    setPin(newPin);
                    if (errorMessage) setErrorMessage('');
                  }}
                  maxLength={4}
                  label={`PIN KASIR BERTUGAS (${currentUser?.name || 'KASIR'})`}
                  subtitle="Masukkan 4 digit PIN akun kasir Anda untuk verifikasi"
                  disabled={!isShiftActive || isSubmitting}
                />
              </div>

              {/* Error Alert Box */}
              {errorMessage && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Action Buttons Step 1 */}
              <div className="pt-2 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={handleClose}
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-2xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer min-h-[44px]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={!isShiftActive || pin.trim().length !== 4 || isSubmitting}
                  className="px-6 py-2.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2"
                >
                  <span>Lanjut ke Konfirmasi</span>
                </button>
              </div>
            </form>
          )}

          {/* STEP 2 & 3: Review Confirmation & Physical Handover */}
          {step === 'handover' && (
            <div className="space-y-4 animate-fade-in">
              {/* Banner Persetujuan Owner */}
              <div className="p-3.5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div className="text-xs text-emerald-900 dark:text-emerald-200">
                  <div className="font-bold">
                    Pengajuan Telah Disetujui Owner ({refundRequest.approved_by_name || 'Owner'})
                  </div>
                  {refundRequest.notes && (
                    <div className="mt-0.5 text-emerald-800 dark:text-emerald-300 italic">
                      &ldquo;{refundRequest.notes}&rdquo;
                    </div>
                  )}
                </div>
              </div>

              {/* STEP 2: Review Confirmation Table */}
              <div className="p-4 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-800 space-y-2.5">
                <div className="text-xs font-bold text-stone-900 dark:text-stone-100 border-b border-stone-200 dark:border-stone-800 pb-2">
                  Rincian Penyerahan Dana Refund
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-stone-500 block text-[11px]">Nomor Transaksi:</span>
                    <span className="font-mono font-bold text-stone-800 dark:text-stone-200">
                      {order.order_number}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[11px]">Nama Pelanggan:</span>
                    <span className="font-semibold text-stone-800 dark:text-stone-200">
                      {order.customer_name || 'Pelanggan Walk-in'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-stone-500 block text-[11px]">Metode Pembayaran Awal:</span>
                    <span className="font-semibold uppercase text-stone-700 dark:text-stone-300">
                      {initialMethod}
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[11px]">Metode Pengembalian:</span>
                    <span className="font-semibold uppercase text-blue-700 dark:text-blue-400">
                      {refundMethod}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs pt-1">
                  <div>
                    <span className="text-stone-500 block text-[11px]">Shift Pencairan:</span>
                    <span className="font-semibold text-stone-800 dark:text-stone-200">
                      Shift #{activeShift?.id?.slice(0, 8)} ({activeShift?.opened_by_name || currentUser?.name})
                    </span>
                  </div>
                  <div>
                    <span className="text-stone-500 block text-[11px]">Kasir Pengaju Awal:</span>
                    <span className="font-semibold text-stone-800 dark:text-stone-200">
                      {refundRequest.requested_by_name || '-'}
                    </span>
                  </div>
                </div>

                <div className="pt-2 border-t border-stone-200 dark:border-stone-800 flex justify-between items-center">
                  <span className="text-xs font-bold text-stone-700 dark:text-stone-300">
                    Nominal Yang Harus Diserahkan:
                  </span>
                  <span className="text-lg font-black text-blue-700 dark:text-blue-400">
                    {formatRupiah(refundRequest.amount)}
                  </span>
                </div>
              </div>

              {/* STEP 3: Clear Physical Handover Instruction */}
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border-2 border-amber-300 dark:border-amber-800/80 space-y-1.5">
                <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200 font-bold text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                  <span>Instruksi Serah Terima Uang Fisik</span>
                </div>
                <p className="text-xs font-semibold text-amber-950 dark:text-amber-100 leading-relaxed">
                  &ldquo;Pastikan nominal uang sesuai. Serahkan uang kepada pelanggan setelah PIN berhasil divalidasi.&rdquo;
                </p>
                <p className="text-[11px] text-amber-800 dark:text-amber-300">
                  Uang fisik sebesar <strong>{formatRupiah(refundRequest.amount)}</strong> diambil dari laci kasir saat ini. Tekan tombol di bawah hanya setelah uang benar-benar diterima oleh pelanggan.
                </p>
              </div>

              {/* Error Alert Box */}
              {errorMessage && (
                <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-400 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {/* Action Buttons Step 3 & 4 */}
              <div className="pt-2 flex flex-col sm:flex-row justify-between items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setStep('auth');
                    setPin('');
                    setValidatedPin('');
                    setErrorMessage('');
                  }}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-4 py-2.5 rounded-2xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer min-h-[44px] flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Kembali / Ganti PIN</span>
                </button>

                {/* Tombol Konfirmasi Final (Step 4 Commit) */}
                <button
                  type="button"
                  onClick={handleCommitDisbursement}
                  disabled={isSubmitting}
                  className="w-full sm:w-auto px-6 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      <span>Mencatat Pengeluaran Kas...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Uang Sudah Diserahkan</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
