import { NumberInput } from './NumberInput';
import { PinKeypad } from './PinKeypad';
import React, { useState, useEffect } from 'react';
import { usePOS } from '../../hooks/usePOS';
import { PaymentMethod } from '../../types';
import { formatRupiah } from '../../utils/formatters';
import { calculateOrderPreview } from '../../utils/orderCalculation';
import { X, Lock, QrCode, Banknote, Check } from 'lucide-react';

export const PINModal: React.FC = () => {
  const {
    isPinModalOpen,
    closePinModal,
    cart,
    orderType,
    orderArea,
    customerName,
    processPaymentWithPin,
    currentUser,
    settings,
    discountRules,
  } = usePOS();

  const [pin, setPin] = useState<string>('');
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod>('cash');
  const [amountPaidInput, setAmountPaidInput] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  useEffect(() => {
    if (isPinModalOpen) {
      setPin('');
      setSelectedMethod('cash');
      setAmountPaidInput('');
      setErrorMessage('');
    }
  }, [isPinModalOpen]);

  if (!isPinModalOpen) return null;

  const totalItemTypes = cart.length;
  const totalItemQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const rawSubtotal = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const isVip = orderArea === 'vip';
  const {
    subtotal,
    discount,
    discountName,
    tax,
    taxPercentage,
    serviceCharge,
    serviceChargePercentage,
    totalAmount,
  } = calculateOrderPreview(rawSubtotal, discountRules, settings?.tax_percentage ?? 0, {
    isVip,
    vipDiscountPercentage: settings?.vip_discount_percentage,
    vipTaxPercentage: settings?.vip_tax_percentage,
    vipServiceChargePercentage: settings?.vip_room_service_charge_percentage,
  });

  const parsedAmountPaid = selectedMethod === 'cash'
    ? (() => {
        if (!amountPaidInput || !amountPaidInput.trim()) return totalAmount;
        const clean = amountPaidInput.replace(/\D/g, '');
        if (!clean) return totalAmount;
        const num = parseInt(clean, 10);
        return isNaN(num) || num <= 0 ? totalAmount : num;
      })()
    : totalAmount;

  const changeAmount = Math.max(0, parsedAmountPaid - totalAmount);

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

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pin.length !== 4) {
      setErrorMessage('Masukkan 4 digit PIN');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');

    const res = await processPaymentWithPin(pin, selectedMethod, parsedAmountPaid);
    setIsSubmitting(false);

    if (!res.success) {
      setErrorMessage(res.message);
      setPin('');
    } else {
      setPin('');
      setAmountPaidInput('');
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
              <Lock className="w-5 h-5 text-[#D4A373]" />
            </div>
            <div>
              <h2 className="text-base font-black tracking-wide">Verifikasi Transaksi</h2>
              <p className="text-xs text-[#D4A373]/90 font-medium">Langkah Terakhir Pembayaran</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closePinModal}
            className="p-2 rounded-xl hover:bg-white/10 text-stone-300 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Ringkasan Transaksi */}
          <div className="p-4 bg-white dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2.5 shadow-sm">
            <div className="flex justify-between items-center border-b border-stone-100 dark:border-stone-800/80 pb-2">
              <span className="text-[11px] font-extrabold uppercase text-stone-400 tracking-wider">
                RINGKASAN TRANSAKSI
              </span>
              <div className="flex items-center gap-1.5">
                <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full uppercase ${
                  isVip
                    ? 'text-amber-800 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-700/50'
                    : 'text-stone-700 dark:text-stone-300 bg-stone-100 dark:bg-stone-800'
                }`}>
                  {isVip ? 'Ruang VIP' : 'Area Umum'}
                </span>
                <span className="text-[11px] font-extrabold text-[#3B2A1F] dark:text-[#D4A373] bg-[#3B2A1F]/10 dark:bg-[#D4A373]/10 px-2.5 py-0.5 rounded-full uppercase">
                  {orderType === 'dine_in' ? 'Dine In' : 'Take Away'}
                </span>
              </div>
            </div>

            <div className="space-y-1 text-xs">
              <div className="flex justify-between text-stone-600 dark:text-stone-300">
                <span>Jumlah Item</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">
                  {totalItemTypes} Jenis Menu ({totalItemQty} Porsi)
                </span>
              </div>

              <div className="flex justify-between text-stone-600 dark:text-stone-300">
                <span>Subtotal</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{formatRupiah(subtotal)}</span>
              </div>

              <div className="flex justify-between items-center text-stone-600 dark:text-stone-300">
                <span className="flex items-center gap-1.5">
                  <span>Diskon</span>
                  {discountName && (
                    <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                      {discountName}
                    </span>
                  )}
                </span>
                <span className={`font-bold ${discount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-900 dark:text-stone-100'}`}>
                  {discount > 0 ? `-${formatRupiah(discount)}` : 'Rp 0'}
                </span>
              </div>

              <div className="flex justify-between text-stone-600 dark:text-stone-300">
                <span>Pajak ({taxPercentage}%)</span>
                <span className="font-bold text-stone-900 dark:text-stone-100">{formatRupiah(tax)}</span>
              </div>

              {isVip && (
                <div className="flex justify-between text-stone-600 dark:text-stone-300">
                  <span>Biaya Layanan VIP ({serviceChargePercentage}%)</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">{formatRupiah(serviceCharge)}</span>
                </div>
              )}

              {customerName && (
                <div className="flex justify-between text-stone-600 dark:text-stone-300">
                  <span>Pelanggan / Meja</span>
                  <span className="font-bold text-stone-900 dark:text-stone-100">{customerName}</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-dashed border-stone-200 dark:border-stone-700 flex justify-between items-center">
              <span className="text-xs font-black uppercase text-stone-800 dark:text-stone-200">TOTAL PEMBAYARAN</span>
              <span className="text-xl font-black text-[#3B2A1F] dark:text-[#D4A373]">
                {formatRupiah(totalAmount)}
              </span>
            </div>
          </div>

          {/* Metode Pembayaran - ONLY CASH & QRIS */}
          <div className="space-y-2">
            <label className="block text-[11px] font-extrabold text-stone-500 dark:text-stone-400 uppercase tracking-wider">
              METODE PEMBAYARAN
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Cash Card */}
              <button
                type="button"
                onClick={() => setSelectedMethod('cash')}
                className={`p-3.5 rounded-2xl border-2 flex items-center justify-between transition-all cursor-pointer select-none text-left ${selectedMethod === 'cash'
                  ? 'bg-[#3B2A1F] text-[#F7F5F2] border-[#3B2A1F] shadow-md ring-2 ring-[#D4A373]/50'
                  : 'bg-white dark:bg-[#23201D] text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-800 hover:border-stone-400'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xl shrink-0 ${selectedMethod === 'cash'
                    ? 'bg-[#D4A373]/20 text-[#D4A373]'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                    }`}>
                    <Banknote className="w-5 h-5 text-[#D4A373]" />
                  </div>
                  <div>
                    <p className="font-black text-sm leading-tight"><Banknote className="w-4 h-4 mr-2 inline" /> CASH / TUNAI</p>
                    <p className={`text-[10px] font-semibold mt-0.5 ${selectedMethod === 'cash' ? 'text-[#D4A373]' : 'text-stone-400'
                      }`}>
                      Pembayaran Tunai Kasir
                    </p>
                  </div>
                </div>
                {selectedMethod === 'cash' && (
                  <div className="w-5 h-5 rounded-full bg-[#D4A373] text-[#1F1F1F] flex items-center justify-center font-bold text-xs shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>

              {/* QRIS Card */}
              <button
                type="button"
                onClick={() => setSelectedMethod('qris')}
                className={`p-3.5 rounded-2xl border-2 flex items-center justify-between transition-all cursor-pointer select-none text-left ${selectedMethod === 'qris'
                  ? 'bg-[#3B2A1F] text-[#F7F5F2] border-[#3B2A1F] shadow-md ring-2 ring-[#D4A373]/50'
                  : 'bg-white dark:bg-[#23201D] text-stone-800 dark:text-stone-200 border-stone-200 dark:border-stone-800 hover:border-stone-400'
                  }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xl shrink-0 ${selectedMethod === 'qris'
                    ? 'bg-[#D4A373]/20 text-[#D4A373]'
                    : 'bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300'
                    }`}>
                    <QrCode className="w-5 h-5 text-[#D4A373]" />
                  </div>
                  <div>
                    <p className="font-black text-sm leading-tight"><QrCode className="w-4 h-4 mr-2 inline" /> QRIS</p>
                    <p className={`text-[10px] font-semibold mt-0.5 ${selectedMethod === 'qris' ? 'text-[#D4A373]' : 'text-stone-400'
                      }`}>
                      Scan E-Wallet / Mobile Banking
                    </p>
                  </div>
                </div>
                {selectedMethod === 'qris' && (
                  <div className="w-5 h-5 rounded-full bg-[#D4A373] text-[#1F1F1F] flex items-center justify-center font-bold text-xs shrink-0">
                    <Check className="w-3.5 h-3.5" />
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Cash Amount Input if Cash Selected */}
          {selectedMethod === 'cash' && (
            <div className="space-y-2.5 p-3.5 bg-amber-500/10 rounded-2xl border border-amber-500/20">
              <label className="block text-xs font-bold text-amber-900 dark:text-amber-300 uppercase">
                UANG DITERIMA (CASH)
              </label>
              <NumberInput
                value={amountPaidInput ? (parseInt(amountPaidInput.replace(/\D/g, ''), 10) || 0) : 0}
                onChange={val => setAmountPaidInput(val === 0 ? '' : val.toString())}
                isCurrency={true}
                placeholder={`Uang Pas: ${totalAmount.toLocaleString('id-ID')}`}
                className="w-full px-4 py-2.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-white dark:bg-[#1F1D1B] font-bold text-base text-stone-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
              />
              <div className="flex flex-wrap gap-2 pt-0.5">
                <button
                  type="button"
                  onClick={() => setAmountPaidInput(String(totalAmount))}
                  className="px-3 py-1 bg-amber-200/80 dark:bg-amber-900/50 hover:bg-amber-300 text-amber-900 dark:text-amber-200 rounded-lg text-xs font-bold transition-all"
                >
                  Uang Pas
                </button>
                <button
                  type="button"
                  onClick={() => setAmountPaidInput('50000')}
                  className="px-3 py-1 bg-amber-200/80 dark:bg-amber-900/50 hover:bg-amber-300 text-amber-900 dark:text-amber-200 rounded-lg text-xs font-bold transition-all"
                >
                  50.000
                </button>
                <button
                  type="button"
                  onClick={() => setAmountPaidInput('100000')}
                  className="px-3 py-1 bg-amber-200/80 dark:bg-amber-900/50 hover:bg-amber-300 text-amber-900 dark:text-amber-200 rounded-lg text-xs font-bold transition-all"
                >
                  100.000
                </button>
              </div>
              {parsedAmountPaid > 0 && (
                <div className="flex justify-between items-center text-xs font-bold pt-1.5 border-t border-amber-300/40 text-amber-900 dark:text-amber-300">
                  <span>Kembalian:</span>
                  <span className={changeAmount >= 0 ? 'text-emerald-600 dark:text-emerald-400 font-extrabold text-sm' : 'text-rose-600 font-bold'}>
                    {formatRupiah(changeAmount)}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Verification PIN Section using shared PinKeypad */}
          <div className="p-4 bg-white dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-3 shadow-sm">
            <PinKeypad
              pin={pin}
              onChange={val => {
                setPin(val);
                setErrorMessage('');
              }}
              errorMessage={errorMessage}
              label="VERIFIKASI PIN KARYAWAN / OWNER"
              subtitle={currentUser ? `Kasir Aktif: ${currentUser.name}` : 'Masukkan 4 digit PIN'}
              disabled={isSubmitting}
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="p-3.5 sm:p-4 bg-white dark:bg-[#161413] border-t border-stone-200 dark:border-stone-800 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-2.5 sm:gap-3 shrink-0">
          <button
            type="button"
            onClick={closePinModal}
            className="w-full sm:w-auto px-5 py-3 rounded-2xl border border-stone-200 dark:border-stone-800 font-bold text-xs text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer text-center"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => handleSubmit()}
            disabled={pin.length !== 4 || isSubmitting}
            className={`w-full sm:flex-1 py-3.5 px-4 rounded-2xl font-black text-xs text-[#F7F5F2] flex items-center justify-center gap-2 shadow-lg transition-all ${pin.length === 4 && !isSubmitting
              ? 'bg-[#3B2A1F] hover:bg-[#2A1E16] active:scale-98 cursor-pointer'
              : 'bg-stone-300 dark:bg-stone-800 text-stone-500 cursor-not-allowed shadow-none'
              }`}
          >
            <Check className="w-4 h-4 text-[#D4A373] shrink-0" />
            <span className="truncate">{isSubmitting ? 'Memproses Transaksi...' : `Konfirmasi Pembayaran (${formatRupiah(totalAmount)})`}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
