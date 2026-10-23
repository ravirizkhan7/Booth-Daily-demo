import React, { useState, useEffect, useMemo } from 'react';
import { usePOS } from '../../hooks/usePOS';
import { Shift } from '../../types';
import { formatRupiah, formatDateTime } from '../../utils/formatters';
import { calculateShiftFinancials, formatShiftDuration } from '../../utils/shiftCalculation';
import { NumberInput } from '../common/NumberInput';
import { PinKeypad } from '../common/PinKeypad';
import {
  X,
  Delete,
  ShieldAlert,
  Lock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Banknote,
  QrCode,
  RotateCcw,
  Clock,
  UserCheck,
  Check
} from 'lucide-react';

export const CloseShiftModal: React.FC = () => {
  const {
    isCloseShiftModalOpen,
    closeCloseShiftModal,
    activeShift,
    activeExpenses,
    closeShift,
    orders,
    products,
    recipes,
    stocks,
    currentUser,
  } = usePOS();

  // Modal Step: 'input' | 'pin' | 'success'
  const [step, setStep] = useState<'input' | 'pin' | 'success'>('input');

  // Input states
  const [actualCashInput, setActualCashInput] = useState<string>('');
  const [actualQrisInput, setActualQrisInput] = useState<string>('');
  const [actualRefundInput, setActualRefundInput] = useState<string>('');
  const [cashDiffReasonInput, setCashDiffReasonInput] = useState<string>('');
  const [qrisDiffReasonInput, setQrisDiffReasonInput] = useState<string>('');
  const [notesInput, setNotesInput] = useState<string>('');

  // PIN & Error state
  const [pin, setPin] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Completed Closed Shift (for final Z-Report view)
  const [closedShiftResult, setClosedShiftResult] = useState<Shift | null>(null);

  // Reset inputs when modal opens
  useEffect(() => {
    if (isCloseShiftModalOpen) {
      setStep('input');
      setActualCashInput('');
      setActualQrisInput('');
      setActualRefundInput('');
      setCashDiffReasonInput('');
      setQrisDiffReasonInput('');
      setNotesInput('');
      setPin('');
      setErrorMessage('');
      setIsSubmitting(false);
      setClosedShiftResult(null);
    }
  }, [isCloseShiftModalOpen]);

  // Live reconciliation calculation for active shift
  const livePreview = useMemo(() => {
    if (!activeShift) return null;

    const parsedCash = actualCashInput !== '' ? parseFloat(actualCashInput) : undefined;
    const parsedQris = actualQrisInput !== '' ? parseFloat(actualQrisInput) : null;
    const parsedRefund = actualRefundInput !== '' ? parseFloat(actualRefundInput) : null;

    return calculateShiftFinancials(
      activeShift,
      orders,
      products,
      recipes,
      stocks,
      {
        actual_cash_end: parsedCash,
        actual_qris_end: parsedQris,
        actual_refund_total: parsedRefund,
        cash_difference_reason: cashDiffReasonInput,
        qris_difference_reason: qrisDiffReasonInput,
        notes: notesInput,
      },
      activeExpenses
    );
  }, [activeShift, orders, products, recipes, stocks, actualCashInput, actualQrisInput, actualRefundInput, cashDiffReasonInput, qrisDiffReasonInput, notesInput, activeExpenses]);

  if (!isCloseShiftModalOpen || (!activeShift && !closedShiftResult)) return null;

  // Validation for Step 1
  const isCashInputValid = actualCashInput.trim() !== '' && !isNaN(parseFloat(actualCashInput)) && parseFloat(actualCashInput) >= 0;

  const handleProceedToPin = () => {
    if (!isCashInputValid) {
      setErrorMessage('Nominal cash fisik di laci wajib diisi dengan angka valid.');
      return;
    }

    if (livePreview) {
      const hasCashDiff = Math.abs(livePreview.cash_difference) >= 0.01;
      const hasQrisDiff = livePreview.qris_difference !== null && Math.abs(livePreview.qris_difference) >= 0.01;

      if (hasCashDiff && !cashDiffReasonInput.trim()) {
        setErrorMessage('Alasan selisih kas wajib diisi ketika terdapat selisih uang kas di laci.');
        return;
      }

      if (hasQrisDiff && !qrisDiffReasonInput.trim()) {
        setErrorMessage('Alasan selisih QRIS wajib diisi ketika terdapat selisih nominal QRIS.');
        return;
      }
    }

    setErrorMessage('');
    setStep('pin');
  };

  const handleBackToInput = () => {
    setErrorMessage('');
    setPin('');
    setStep('input');
  };

  const handleKeyClick = (num: string) => {
    if (pin.length < 4) {
      setPin(prev => prev + num);
      setErrorMessage('');
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
    setErrorMessage('');
  };

  const handleClear = () => {
    setPin('');
    setErrorMessage('');
  };

  const handleConfirmCloseShift = async () => {
    if (pin.length !== 4) {
      setErrorMessage('Masukkan 4 digit PIN petugas penutup.');
      return;
    }

    if (!isCashInputValid) {
      setErrorMessage('Nominal cash di laci tidak valid.');
      setStep('input');
      return;
    }

    if (livePreview) {
      const hasCashDiff = Math.abs(livePreview.cash_difference) >= 0.01;
      const hasQrisDiff = livePreview.qris_difference !== null && Math.abs(livePreview.qris_difference) >= 0.01;

      if (hasCashDiff && !cashDiffReasonInput.trim()) {
        setErrorMessage('Alasan selisih kas wajib diisi.');
        setStep('input');
        return;
      }

      if (hasQrisDiff && !qrisDiffReasonInput.trim()) {
        setErrorMessage('Alasan selisih QRIS wajib diisi.');
        setStep('input');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMessage('');

    const parsedCash = parseFloat(actualCashInput);
    const parsedQris = actualQrisInput.trim() !== '' ? parseFloat(actualQrisInput) : null;
    const parsedRefund = actualRefundInput.trim() !== '' ? parseFloat(actualRefundInput) : null;

    const res = await closeShift({
      actual_cash_end: parsedCash,
      actual_qris_end: parsedQris,
      actual_refund_total: parsedRefund,
      cash_difference_reason: cashDiffReasonInput.trim() || undefined,
      qris_difference_reason: qrisDiffReasonInput.trim() || undefined,
      notes: notesInput.trim() || undefined,
      pin,
    });

    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.message);
      setPin('');
    } else if (res.shift) {
      setClosedShiftResult(res.shift);
      setStep('success');
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in overflow-y-auto">
      <div
        className="relative w-full max-w-xl bg-[#F7F5F2] dark:bg-[#1A1816] rounded-3xl shadow-2xl border border-stone-300 dark:border-stone-800 overflow-hidden flex flex-col max-h-[92vh] my-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 bg-[#3B2A1F] text-[#F7F5F2] flex justify-between items-center shrink-0 border-b border-stone-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#D4A373]/20 flex items-center justify-center border border-[#D4A373]/30">
              <Lock className="w-5 h-5 text-[#D4A373]" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-wide">
                {step === 'success' ? 'Shift Resmi Ditutup' : `Tutup Shift #${activeShift?.shift_number || ''}`}
              </h2>
              <p className="text-xs text-[#D4A373]/90 font-medium">
                {step === 'input' && 'Tahap 1: Input Nominal & Ringkasan Rekonsiliasi'}
                {step === 'pin' && 'Tahap 2: Konfirmasi PIN Petugas Penutup'}
                {step === 'success' && 'Laporan Penutupan (Z-Report Snapshot)'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeCloseShiftModal}
            className="p-2 rounded-xl hover:bg-white/10 text-stone-300 transition-colors cursor-pointer"
            aria-label="Tutup Modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ======================================================== */}
        {/* STEP 1: INPUT NOMINAL & RINGKASAN REKONSILIASI           */}
        {/* ======================================================== */}
        {step === 'input' && livePreview && (
          <>
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              {/* Shift Context Info */}
              <div className="p-3 bg-stone-100 dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 text-xs flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
                  <Clock className="w-4 h-4 text-[#C68B59]" />
                  <span>Dibuka: <strong>{formatDateTime(activeShift!.opened_at)}</strong></span>
                </div>
                <div className="flex items-center gap-2 text-stone-600 dark:text-stone-300">
                  <UserCheck className="w-4 h-4 text-[#C68B59]" />
                  <span>Dibuka oleh: <strong>{activeShift!.opened_by_name}</strong></span>
                </div>
              </div>

              {/* Input Form Section */}
              <div className="space-y-4">
                {/* 1. Cash di Laci (Wajib) */}
                <div className="p-4 bg-white dark:bg-[#23201D] rounded-2xl border border-amber-300 dark:border-amber-700/60 shadow-sm space-y-2.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black uppercase text-amber-900 dark:text-amber-300 flex items-center gap-1.5">
                      <Banknote className="w-4 h-4 text-amber-600" />
                      1. CASH FISIK DI LACI <span className="text-rose-500">*</span>
                    </label>
                    <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400">
                      Wajib Diisi
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Total seluruh uang tunai fisik yang dihitung di laci (termasuk modal awal).
                  </p>
                  <NumberInput
                    value={actualCashInput !== '' ? Number(actualCashInput) : 0}
                    onChange={val => {
                      setActualCashInput(val === 0 ? '' : val.toString());
                      setErrorMessage('');
                    }}
                    isCurrency={true}
                    placeholder={`Contoh Kas Harapan: ${livePreview.expected_cash_end}`}
                    className="w-full px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-500/5 font-black text-lg text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setActualCashInput(livePreview.expected_cash_end.toString())}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-200/80 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 hover:bg-amber-300 cursor-pointer transition-all"
                    >
                      Isi Sesuai Kas Harapan ({formatRupiah(livePreview.expected_cash_end)})
                    </button>
                    {actualCashInput !== '' && (
                      <button
                        type="button"
                        onClick={() => setActualCashInput('')}
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold text-stone-400 hover:text-stone-600 cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>

                  {/* Input Alasan Selisih Kas (Wajib jika ada selisih) */}
                  {actualCashInput !== '' && livePreview.cash_difference !== 0 && (
                    <div className="p-3 bg-rose-50/80 dark:bg-rose-950/40 rounded-xl border border-rose-300 dark:border-rose-800 space-y-1.5 mt-2 animate-fade-in">
                      <label className="text-xs font-black uppercase text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        Alasan Selisih Kas ({livePreview.cash_difference > 0 ? 'Kelebihan Kas' : 'Kekurangan Kas'}) <span className="text-rose-600">*</span>
                      </label>
                      <p className="text-[11px] text-rose-700 dark:text-rose-400">
                        Wajib diisi untuk audit Owner (contoh: uang tip kasir, pembulatan kembalian, salah hitung fisik).
                      </p>
                      <input
                        type="text"
                        value={cashDiffReasonInput}
                        onChange={e => {
                          setCashDiffReasonInput(e.target.value);
                          setErrorMessage('');
                        }}
                        placeholder="Masukkan alasan selisih uang kas..."
                        className="w-full px-3 py-2 text-xs rounded-xl border border-rose-300 dark:border-rose-700 bg-white dark:bg-[#1C1A18] text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                      />
                    </div>
                  )}
                </div>

                {/* 2. QRIS Aktual (Wajib/Opsional rekonsiliasi) */}
                <div className="p-4 bg-white dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black uppercase text-stone-700 dark:text-stone-200 flex items-center gap-1.5">
                      <QrCode className="w-4 h-4 text-[#C68B59]" />
                      2. QRIS AKTUAL TERKONFIRMASI
                    </label>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500">
                      {livePreview.qris_status === 'no_transaction' ? 'Tidak Ada Transaksi QRIS' : 'Rekonsiliasi EDC'}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    {livePreview.qris_status === 'no_transaction'
                      ? 'Shift ini tidak mencatat transaksi QRIS (penjualan/refund QRIS Rp 0). Rekonsiliasi tidak diperlukan.'
                      : 'Total settlement QRIS dari EDC/rekap transaksi perbankan shift ini.'}
                  </p>
                  <NumberInput
                    value={actualQrisInput !== '' ? Number(actualQrisInput) : 0}
                    onChange={val => setActualQrisInput(val === 0 ? '' : val.toString())}
                    isCurrency={true}
                    placeholder="Contoh: Total perolehan QRIS shift ini"
                    className="w-full px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#1C1A18] font-bold text-base text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#3B2A1F] dark:focus:ring-[#D4A373]"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setActualQrisInput(livePreview.expected_qris_end.toString())}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 cursor-pointer transition-all"
                    >
                      Cocokkan Sistem ({formatRupiah(livePreview.expected_qris_end)})
                    </button>
                    {actualQrisInput !== '' && (
                      <button
                        type="button"
                        onClick={() => setActualQrisInput('')}
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold text-stone-400 hover:text-stone-600 cursor-pointer"
                      >
                        Kosongkan
                      </button>
                    )}
                  </div>

                  {/* Input Alasan Selisih QRIS (Wajib jika ada selisih) */}
                  {actualQrisInput !== '' && livePreview.qris_difference !== null && livePreview.qris_difference !== 0 && (
                    <div className="p-3 bg-rose-50/80 dark:bg-rose-950/40 rounded-xl border border-rose-300 dark:border-rose-800 space-y-1.5 mt-2 animate-fade-in">
                      <label className="text-xs font-black uppercase text-rose-800 dark:text-rose-300 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        Alasan Selisih QRIS ({livePreview.qris_difference > 0 ? 'Kelebihan QRIS' : 'Kekurangan QRIS'}) <span className="text-rose-600">*</span>
                      </label>
                      <p className="text-[11px] text-rose-700 dark:text-rose-400">
                        Wajib diisi untuk audit Owner (contoh: kendala sinyal EDC, transaksi QRIS pending settlement bank).
                      </p>
                      <input
                        type="text"
                        value={qrisDiffReasonInput}
                        onChange={e => {
                          setQrisDiffReasonInput(e.target.value);
                          setErrorMessage('');
                        }}
                        placeholder="Masukkan alasan selisih QRIS..."
                        className="w-full px-3 py-2 text-xs rounded-xl border border-rose-300 dark:border-rose-700 bg-white dark:bg-[#1C1A18] text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-rose-500 font-medium"
                      />
                    </div>
                  )}
                </div>

                {/* 3. Refund Aktual (Opsional) */}
                <div className="p-4 bg-white dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-2.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-black uppercase text-stone-700 dark:text-stone-200 flex items-center gap-1.5">
                      <RotateCcw className="w-4 h-4 text-rose-500" />
                      3. REFUND AKTUAL YANG DIKELUARKAN
                    </label>
                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800 text-stone-500">
                      Opsional
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400">
                    Total pengembalian dana riil yang diserahkan. Jika dikosongkan, status verifikasi adalah <em>Belum diverifikasi</em>.
                  </p>
                  <NumberInput
                    value={actualRefundInput !== '' ? Number(actualRefundInput) : 0}
                    onChange={val => setActualRefundInput(val === 0 ? '' : val.toString())}
                    isCurrency={true}
                    placeholder="Kosongkan jika belum diverifikasi fisik"
                    className="w-full px-4 py-2 rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#1C1A18] font-bold text-base text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-[#3B2A1F] dark:focus:ring-[#D4A373]"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    <button
                      type="button"
                      onClick={() => setActualRefundInput((livePreview.cash_refunds + livePreview.qris_refunds).toString())}
                      className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-700 dark:text-stone-300 cursor-pointer transition-all"
                    >
                      Cocokkan Catatan ({formatRupiah(livePreview.cash_refunds + livePreview.qris_refunds)})
                    </button>
                    {actualRefundInput !== '' && (
                      <button
                        type="button"
                        onClick={() => setActualRefundInput('')}
                        className="px-2 py-1 rounded-lg text-[11px] font-semibold text-stone-400 hover:text-stone-600 cursor-pointer"
                      >
                        Kosongkan
                      </button>
                    )}
                  </div>
                </div>

                {/* 4. Catatan Shift (Opsional) */}
                <div className="p-3.5 bg-white dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 shadow-sm space-y-1.5">
                  <label className="text-xs font-bold text-stone-600 dark:text-stone-400">
                    Catatan Shift Umum (Opsional)
                  </label>
                  <input
                    type="text"
                    value={notesInput}
                    onChange={e => setNotesInput(e.target.value)}
                    placeholder="Contoh: Shift berjalan lancar, stok paper cup menipis"
                    className="w-full px-3 py-2 text-xs rounded-xl border border-stone-300 dark:border-stone-700 bg-white dark:bg-[#1C1A18] text-stone-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-[#3B2A1F]"
                  />
                </div>
              </div>

              {/* ======================================================== */}
              {/* RINGKASAN REKONSILIASI LIVE                              */}
              {/* ======================================================== */}
              <div className="p-4 bg-white dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3 shadow-md">
                <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800 pb-2">
                  <span className="text-[11px] font-black uppercase text-stone-500 tracking-wider">
                    RINGKASAN REKONSILIASI KEUANGAN
                  </span>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${
                        livePreview.reconciliation_status === 'matched'
                          ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-800 dark:text-amber-300 border border-amber-500/30'
                      }`}
                    >
                      {livePreview.reconciliation_status === 'matched'
                        ? 'Status: Cocok'
                        : 'Status: Menunggu Review Owner'}
                    </span>
                  </div>
                </div>

                {/* Rekonsiliasi Kas */}
                <div className="space-y-1.5 text-xs">
                  <p className="font-extrabold text-[11px] uppercase text-[#3B2A1F] dark:text-[#D4A373] tracking-wide pt-1">
                    A. Rekonsiliasi Kas (Laci Fisik)
                  </p>
                  <div className="flex justify-between text-stone-600 dark:text-stone-300">
                    <span>Modal Awal Kas</span>
                    <span className="font-semibold">{formatRupiah(livePreview.cash_initial)}</span>
                  </div>
                  <div className="flex justify-between text-stone-600 dark:text-stone-300">
                    <span>Penjualan Tunai (+)</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      +{formatRupiah(livePreview.cash_sales)}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-600 dark:text-stone-300">
                    <span>Refund Tunai Terbayar (-)</span>
                    <span className="font-semibold text-rose-500">
                      -{formatRupiah(livePreview.cash_refunds)}
                    </span>
                  </div>
                  <div className="flex justify-between text-stone-600 dark:text-stone-300">
                    <span>Pengeluaran Kas Operasional (-)</span>
                    <span className="font-semibold text-rose-500">
                      -{formatRupiah(livePreview.cash_expenses || 0)}
                    </span>
                  </div>
                  {activeExpenses && activeExpenses.filter(e => e.status === 'active').length > 0 && (
                    <div className="p-2 bg-stone-50 dark:bg-stone-800/60 rounded-xl space-y-1 text-[11px]">
                      <div className="font-semibold text-stone-500 dark:text-stone-400">Rincian Kas Keluar:</div>
                      {activeExpenses.filter(e => e.status === 'active').map(e => (
                        <div key={e.id} className="flex justify-between text-stone-600 dark:text-stone-300">
                          <span className="truncate pr-2">• {e.description} ({e.category})</span>
                          <span className="font-medium text-rose-500 shrink-0">-{formatRupiah(e.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-between text-stone-800 dark:text-stone-200 font-bold border-t border-stone-100 dark:border-stone-800 pt-1">
                    <span>Kas yang Diharapkan</span>
                    <span>{formatRupiah(livePreview.expected_cash_end)}</span>
                  </div>
                  <div className="flex justify-between text-stone-800 dark:text-stone-200 font-bold">
                    <span>Cash Aktual di Laci</span>
                    <span className={actualCashInput !== '' ? 'text-amber-600 dark:text-amber-400 font-black' : 'text-stone-400 italic font-normal'}>
                      {actualCashInput !== '' ? formatRupiah(livePreview.actual_cash_end) : 'Belum diisi'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 font-bold">
                    <span>Selisih Kas</span>
                    {actualCashInput === '' ? (
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-400">
                        Menunggu Input Cash
                      </span>
                    ) : livePreview.cash_status === 'balanced' ? (
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Sesuai (Rp 0)
                      </span>
                    ) : livePreview.cash_status === 'surplus' ? (
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> +{formatRupiah(livePreview.cash_difference)} (Lebih)
                      </span>
                    ) : (
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center gap-1">
                        <AlertTriangle className="w-3.5 h-3.5" /> {formatRupiah(livePreview.cash_difference)} (Kurang)
                      </span>
                    )}
                  </div>
                  {cashDiffReasonInput.trim() !== '' && (
                    <div className="p-2 bg-stone-100 dark:bg-stone-800/60 rounded-xl text-[11px] text-stone-600 dark:text-stone-300">
                      <strong>Alasan Selisih Kas:</strong> {cashDiffReasonInput}
                    </div>
                  )}
                </div>

                {/* Rekonsiliasi QRIS */}
                <div className="space-y-1.5 text-xs pt-2 border-t border-stone-100 dark:border-stone-800">
                  <p className="font-extrabold text-[11px] uppercase text-[#3B2A1F] dark:text-[#D4A373] tracking-wide">
                    B. Rekonsiliasi QRIS
                  </p>
                  <div className="flex justify-between text-stone-600 dark:text-stone-300">
                    <span>Penjualan QRIS</span>
                    <span className="font-semibold">{formatRupiah(livePreview.qris_sales)}</span>
                  </div>
                  <div className="flex justify-between text-stone-600 dark:text-stone-300">
                    <span>Refund/Reversal QRIS (-)</span>
                    <span className="font-semibold text-rose-500">-{formatRupiah(livePreview.qris_refunds)}</span>
                  </div>
                  <div className="flex justify-between text-stone-800 dark:text-stone-200 font-bold border-t border-stone-100 dark:border-stone-800 pt-1">
                    <span>QRIS yang Diharapkan</span>
                    <span>{formatRupiah(livePreview.expected_qris_end)}</span>
                  </div>
                  <div className="flex justify-between text-stone-800 dark:text-stone-200 font-bold">
                    <span>QRIS Aktual</span>
                    <span className={livePreview.actual_qris_end !== null ? 'text-amber-600 dark:text-amber-400' : 'text-stone-400 italic font-normal'}>
                      {livePreview.qris_status === 'no_transaction' && livePreview.actual_qris_end === null
                        ? 'Tidak ada transaksi'
                        : livePreview.actual_qris_end !== null
                        ? formatRupiah(livePreview.actual_qris_end)
                        : 'Belum diisi'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center pt-1 font-bold">
                    <span>Status Rekonsiliasi QRIS</span>
                    {livePreview.qris_status === 'no_transaction' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/60">
                        Tidak ada transaksi · Tidak perlu rekonsiliasi
                      </span>
                    ) : livePreview.qris_status === 'unreconciled' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-500">
                        Belum direkonsiliasi
                      </span>
                    ) : livePreview.qris_status === 'balanced' ? (
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        Sesuai (Rp 0)
                      </span>
                    ) : (
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
                        Selisih: {formatRupiah(livePreview.qris_difference!)}
                      </span>
                    )}
                  </div>
                  {qrisDiffReasonInput.trim() !== '' && (
                    <div className="p-2 bg-stone-100 dark:bg-stone-800/60 rounded-xl text-[11px] text-stone-600 dark:text-stone-300">
                      <strong>Alasan Selisih QRIS:</strong> {qrisDiffReasonInput}
                    </div>
                  )}
                </div>

                {/* Status Refund */}
                <div className="space-y-1.5 text-xs pt-2 border-t border-stone-100 dark:border-stone-800">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-stone-700 dark:text-stone-300">Total Refund Tercatat Sistem:</span>
                    <span className="font-bold text-rose-500">
                      {formatRupiah(livePreview.cash_refunds + livePreview.qris_refunds)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-stone-700 dark:text-stone-300">Status Verifikasi Refund:</span>
                    {livePreview.refund_status === 'unverified' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-stone-100 dark:bg-stone-800 text-stone-500">
                        Belum diverifikasi
                      </span>
                    ) : livePreview.refund_status === 'verified' ? (
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        Terverifikasi Sesuai
                      </span>
                    ) : (
                      <span className="text-[11px] font-extrabold px-2.5 py-0.5 rounded-full bg-rose-500/15 text-rose-600 dark:text-rose-400">
                        Terdapat Selisih
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-rose-700 dark:text-rose-300 text-xs font-bold">
                  <ShieldAlert className="w-4 h-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}
            </div>

            {/* Footer Step 1 */}
            <div className="p-3.5 sm:p-4 bg-white dark:bg-[#161413] border-t border-stone-200 dark:border-stone-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={closeCloseShiftModal}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-stone-200 dark:border-stone-800 font-bold text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer text-center"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleProceedToPin}
                disabled={!isCashInputValid}
                className={`w-full sm:flex-1 py-3.5 px-4 rounded-2xl font-black text-xs text-[#F7F5F2] flex items-center justify-center gap-2 shadow-lg transition-all ${
                  isCashInputValid
                    ? 'bg-[#3B2A1F] hover:bg-[#2A1E16] active:scale-98 cursor-pointer'
                    : 'bg-stone-300 dark:bg-stone-800 text-stone-500 cursor-not-allowed shadow-none'
                }`}
              >
                <span>Lanjut ke Verifikasi PIN Petugas</span>
                <ArrowRight className="w-4 h-4 text-[#D4A373] shrink-0" />
              </button>
            </div>
          </>
        )}

        {/* ======================================================== */}
        {/* STEP 2: KONFIRMASI PIN PETUGAS PENUTUP                    */}
        {/* ======================================================== */}
        {step === 'pin' && (
          <>
            <div className="p-5 sm:p-6 overflow-y-auto space-y-4 flex-1">
              <div className="p-4 bg-white dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 text-xs space-y-2">
                <div className="flex justify-between text-stone-600 dark:text-stone-300">
                  <span>Cash Fisik Dihitung:</span>
                  <span className="font-extrabold text-stone-900 dark:text-white">
                    {formatRupiah(parseFloat(actualCashInput))}
                  </span>
                </div>
                {livePreview && livePreview.cash_difference !== 0 && (
                  <div className="flex justify-between items-center text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/30 p-2 rounded-xl">
                    <span>Selisih Kas ({livePreview.cash_difference > 0 ? 'Lebih' : 'Kurang'}):</span>
                    <span>{formatRupiah(livePreview.cash_difference)}</span>
                  </div>
                )}
                {cashDiffReasonInput.trim() !== '' && (
                  <div className="text-[11px] text-stone-500 italic pl-1">
                    Alasan Kas: "{cashDiffReasonInput}"
                  </div>
                )}

                <div className="flex justify-between text-stone-600 dark:text-stone-300 pt-1 border-t border-stone-100 dark:border-stone-800">
                  <span>QRIS Aktual:</span>
                  <span className="font-bold">
                    {actualQrisInput.trim() !== '' ? formatRupiah(parseFloat(actualQrisInput)) : 'Belum direkonsiliasi'}
                  </span>
                </div>
                {livePreview && livePreview.qris_difference !== null && livePreview.qris_difference !== 0 && (
                  <div className="flex justify-between items-center text-rose-600 dark:text-rose-400 font-bold bg-rose-50 dark:bg-rose-950/30 p-2 rounded-xl">
                    <span>Selisih QRIS ({livePreview.qris_difference > 0 ? 'Lebih' : 'Kurang'}):</span>
                    <span>{formatRupiah(livePreview.qris_difference)}</span>
                  </div>
                )}
                {qrisDiffReasonInput.trim() !== '' && (
                  <div className="text-[11px] text-stone-500 italic pl-1">
                    Alasan QRIS: "{qrisDiffReasonInput}"
                  </div>
                )}

                <div className="pt-2 border-t border-stone-100 dark:border-stone-800 flex justify-between items-center font-bold">
                  <span>Status Rekonsiliasi Shift:</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      livePreview?.reconciliation_status === 'matched'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {livePreview?.reconciliation_status === 'matched'
                      ? 'Cocok (Auto-Verifikasi)'
                      : 'Menunggu Review Owner'}
                  </span>
                </div>
              </div>

              {/* PIN Keypad Section using shared PinKeypad */}
              <div className="p-4 bg-white dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3 shadow-sm">
                <PinKeypad
                  pin={pin}
                  onChange={val => {
                    setPin(val);
                    setErrorMessage('');
                  }}
                  errorMessage={errorMessage}
                  label="OTORISASI PIN PETUGAS PENUTUP"
                  subtitle="Masukkan 4 digit PIN kasir/owner untuk mengesahkan penutupan shift dan mencatat snapshot keuangan"
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {/* Footer Step 2 */}
            <div className="p-3.5 sm:p-4 bg-white dark:bg-[#161413] border-t border-stone-200 dark:border-stone-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
              <button
                type="button"
                onClick={handleBackToInput}
                className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-stone-200 dark:border-stone-800 font-bold text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Kembali ke Ringkasan</span>
              </button>
              <button
                type="button"
                onClick={handleConfirmCloseShift}
                disabled={pin.length !== 4 || isSubmitting}
                className={`w-full sm:flex-1 py-3.5 px-4 rounded-2xl font-black text-xs text-[#F7F5F2] flex items-center justify-center gap-2 shadow-lg transition-all ${
                  pin.length === 4 && !isSubmitting
                    ? 'bg-[#3B2A1F] hover:bg-[#2A1E16] active:scale-98 cursor-pointer'
                    : 'bg-stone-300 dark:bg-stone-800 text-stone-500 cursor-not-allowed shadow-none'
                }`}
              >
                <Check className="w-4 h-4 text-[#D4A373] shrink-0" />
                <span className="truncate">
                  {isSubmitting ? 'Menyimpan Penutupan Shift...' : 'Konfirmasi Tutup Shift'}
                </span>
              </button>
            </div>
          </>
        )}

        {/* ======================================================== */}
        {/* STEP 3: RINGKASAN AKHIR PENUTUPAN SHIFT (Z-REPORT)       */}
        {/* ======================================================== */}
        {step === 'success' && closedShiftResult && (
          <>
            <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
              <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-3">
                <CheckCircle2 className="w-7 h-7 text-emerald-600 dark:text-emerald-400 shrink-0" />
                <div>
                  <h3 className="font-extrabold text-sm text-emerald-950 dark:text-emerald-200">
                    Shift #{closedShiftResult.shift_number} Berhasil Ditutup
                  </h3>
                  <p className="text-xs text-emerald-800 dark:text-emerald-300">
                    Snapshot rekonsiliasi keuangan telah dikunci permanen.
                  </p>
                </div>
              </div>

              {/* Meta Card */}
              <div className="p-4 bg-white dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2 text-xs">
                <div className="flex justify-between border-b border-stone-100 dark:border-stone-800 pb-1.5">
                  <span className="text-stone-500">Petugas Pembuka:</span>
                  <span className="font-bold">{closedShiftResult.opened_by_name}</span>
                </div>
                <div className="flex justify-between border-b border-stone-100 dark:border-stone-800 pb-1.5">
                  <span className="text-stone-500">Petugas Penutup:</span>
                  <span className="font-bold">{closedShiftResult.closed_by_name}</span>
                </div>
                <div className="flex justify-between border-b border-stone-100 dark:border-stone-800 pb-1.5">
                  <span className="text-stone-500">Waktu Buka:</span>
                  <span className="font-semibold">{formatDateTime(closedShiftResult.opened_at)}</span>
                </div>
                <div className="flex justify-between border-b border-stone-100 dark:border-stone-800 pb-1.5">
                  <span className="text-stone-500">Waktu Tutup:</span>
                  <span className="font-semibold">{formatDateTime(closedShiftResult.closed_at!)}</span>
                </div>
                <div className="flex justify-between border-b border-stone-100 dark:border-stone-800 pb-1.5">
                  <span className="text-stone-500">Durasi Shift:</span>
                  <span className="font-bold text-[#C68B59]">
                    {formatShiftDuration(closedShiftResult.opened_at, closedShiftResult.closed_at)}
                  </span>
                </div>
                <div className="flex justify-between items-center pt-0.5">
                  <span className="text-stone-500">Status Rekonsiliasi:</span>
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${
                      closedShiftResult.reconciliation_status === 'matched'
                        ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                        : 'bg-amber-500/15 text-amber-800 dark:text-amber-300'
                    }`}
                  >
                    {closedShiftResult.reconciliation_status === 'matched'
                      ? 'Cocok (Rp 0 Selisih)'
                      : 'Menunggu Review Owner'}
                  </span>
                </div>
              </div>

              {/* Snapshot Rekonsiliasi Card */}
              {closedShiftResult.snapshot && (
                <div className="p-4 bg-white dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2.5 text-xs">
                  <span className="text-[11px] font-black uppercase text-stone-500 tracking-wider block border-b border-stone-100 dark:border-stone-800 pb-1.5">
                    Snapshot Keuangan Terkunci
                  </span>

                  <div className="flex justify-between">
                    <span>Kas Diharapkan:</span>
                    <span className="font-bold">{formatRupiah(closedShiftResult.snapshot.expected_cash_end)}</span>
                  </div>
                  {closedShiftResult.snapshot.cash_expenses !== undefined && closedShiftResult.snapshot.cash_expenses > 0 && (
                    <div className="flex justify-between text-rose-600 dark:text-rose-400">
                      <span>Pengeluaran Kas (-):</span>
                      <span className="font-semibold">-{formatRupiah(closedShiftResult.snapshot.cash_expenses)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Cash Aktual di Laci:</span>
                    <span className="font-extrabold text-[#C68B59]">{formatRupiah(closedShiftResult.snapshot.actual_cash_end)}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Selisih Kas:</span>
                    <span className={`font-black ${closedShiftResult.snapshot.cash_difference === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {closedShiftResult.snapshot.cash_difference === 0
                        ? 'Sesuai (Rp 0)'
                        : `${formatRupiah(closedShiftResult.snapshot.cash_difference)} (${closedShiftResult.snapshot.cash_status})`}
                    </span>
                  </div>
                  {closedShiftResult.cash_difference_reason && (
                    <div className="p-2 bg-stone-50 dark:bg-stone-800/50 rounded-xl text-[11px] text-stone-600 dark:text-stone-300">
                      <strong>Alasan Selisih Kas:</strong> {closedShiftResult.cash_difference_reason}
                    </div>
                  )}

                  <div className="border-t border-stone-100 dark:border-stone-800 pt-2 flex justify-between">
                    <span>QRIS Diharapkan:</span>
                    <span className="font-bold">{formatRupiah(closedShiftResult.snapshot.expected_qris_end)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>QRIS Aktual:</span>
                    <span className="font-bold">
                      {closedShiftResult.snapshot.qris_status === 'no_transaction'
                        ? 'Tidak ada transaksi'
                        : closedShiftResult.snapshot.actual_qris_end !== null
                        ? formatRupiah(closedShiftResult.snapshot.actual_qris_end)
                        : 'Belum direkonsiliasi'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Status QRIS:</span>
                    <span className="font-bold">
                      {closedShiftResult.snapshot.qris_status === 'no_transaction'
                        ? 'Tidak ada transaksi · Tidak perlu rekonsiliasi'
                        : closedShiftResult.snapshot.qris_status === 'unreconciled'
                        ? 'Belum direkonsiliasi'
                        : closedShiftResult.snapshot.qris_status === 'balanced'
                        ? 'Sesuai (Rp 0)'
                        : `Selisih: ${formatRupiah(closedShiftResult.snapshot.qris_difference || 0)}`}
                    </span>
                  </div>
                  {closedShiftResult.qris_difference_reason && (
                    <div className="p-2 bg-stone-50 dark:bg-stone-800/50 rounded-xl text-[11px] text-stone-600 dark:text-stone-300">
                      <strong>Alasan Selisih QRIS:</strong> {closedShiftResult.qris_difference_reason}
                    </div>
                  )}

                  <div className="border-t border-stone-100 dark:border-stone-800 pt-2 flex justify-between">
                    <span>Status Refund:</span>
                    <span className="font-bold">
                      {closedShiftResult.snapshot.refund_status === 'unverified'
                        ? 'Belum diverifikasi'
                        : closedShiftResult.snapshot.refund_status === 'verified'
                        ? 'Terverifikasi Sesuai'
                        : 'Terdapat Selisih'}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Step 3 */}
            <div className="p-3.5 sm:p-4 bg-white dark:bg-[#161413] border-t border-stone-200 dark:border-stone-800 flex justify-end shrink-0">
              <button
                type="button"
                onClick={closeCloseShiftModal}
                className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-black text-xs shadow-md transition-colors cursor-pointer"
              >
                Selesai & Tutup Laporan
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
