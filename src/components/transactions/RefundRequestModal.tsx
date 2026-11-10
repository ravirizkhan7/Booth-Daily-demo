import React, { useState, useEffect } from 'react';
import { Order, RefundType } from '../../types';
import { refundService } from '../../services/refundService';
import { fileToBase64 } from '../../mock/utils/imageHelper';
import { ImageUpload } from '../common/ImageUpload';
import { PinKeypad } from '../common/PinKeypad';
import { formatRupiah } from '../../utils/formatters';
import { X, AlertTriangle, ShieldCheck, Clock, Info } from 'lucide-react';

interface RefundRequestModalProps {
  isOpen: boolean;
  order: Order | null;
  currentUser: { id: string; name: string; role: string; pin?: string } | null;
  onClose: () => void;
  onSuccess: () => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const RefundRequestModal: React.FC<RefundRequestModalProps> = ({
  isOpen,
  order,
  currentUser,
  onClose,
  onSuccess,
  showToast,
}) => {
  const [refundType, setRefundType] = useState<RefundType>('normal');
  const [reason, setReason] = useState<string>('Batal Pelanggan');
  const [notes, setNotes] = useState<string>('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [pin, setPin] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [availableCash, setAvailableCash] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');

  const isQris = order?.payment?.method === 'qris';

  useEffect(() => {
    if (isOpen) {
      setRefundType('normal');
      setReason('Batal Pelanggan');
      setNotes('');
      setImageFile(null);
      setPin('');
      setErrorMessage('');

      // Cek ketersediaan kas laci saat modal dibuka
      refundService.getShiftAvailableCash().then(cash => {
        setAvailableCash(cash);
      }).catch(() => {
        setAvailableCash(0);
      });
    }
  }, [isOpen]);

  if (!isOpen || !order) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!pin || pin.trim().length !== 4) {
      setErrorMessage('PIN 4 digit wajib dimasukkan untuk verifikasi pengaju.');
      return;
    }

    if (!imageFile) {
      setErrorMessage('Foto bukti pengembalian / keluhan fisik wajib dilampirkan.');
      return;
    }

    setIsSubmitting(true);
    try {
      const base64Photo = await fileToBase64(imageFile);

      await refundService.submitRefundRequest(
        order.id,
        {
          refund_type: refundType,
          reason,
          notes: notes.trim() || undefined,
          evidence_image_url: base64Photo,
          refund_payment_method: refundType === 'emergency' ? 'cash' : order.payment?.method,
        },
        pin.trim()
      );

      showToast(
        refundType === 'emergency'
          ? `Emergency refund tunai Rp ${Number(order.total_amount).toLocaleString('id-ID')} dicairkan & pengajuan diteruskan ke Owner.`
          : `Pengajuan refund pesanan ${order.order_number} berhasil dikirim ke antrean Owner.`,
        'success'
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      const msg = err?.message || 'Gagal mengirimkan pengajuan refund.';
      setErrorMessage(msg);
      showToast(msg, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg bg-white dark:bg-[#1E1C1A] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-[#3B2A1F] text-white flex justify-between items-center shrink-0">
          <div>
            <h2 className="text-base sm:text-lg font-bold flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-[#D4A373]" />
              Formulir Pengajuan Refund
            </h2>
            <p className="text-xs text-stone-300">
              Transaksi #{order.order_number} • Total {formatRupiah(order.total_amount)}
            </p>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-full hover:bg-white/10 text-stone-300 hover:text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto">
          {errorMessage && (
            <div className="p-3 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Rincian Transaksi Singkat */}
          <div className="bg-stone-50 dark:bg-[#171514] p-3.5 rounded-2xl border border-stone-200 dark:border-stone-700/60 text-xs flex justify-between items-center">
            <div>
              <span className="text-stone-500 block">Metode Pembayaran Asal:</span>
              <span className="font-bold text-stone-900 dark:text-stone-100 uppercase">
                {order.payment?.method || 'Cash'}
              </span>
            </div>
            <div className="text-right">
              <span className="text-stone-500 block">Nominal Refund:</span>
              <span className="font-black text-[#3B2A1F] dark:text-[#D4A373] text-sm">
                {formatRupiah(order.total_amount)}
              </span>
            </div>
          </div>

          {/* Pilihan Tipe Refund: Normal vs Emergency */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1.5">
              Tipe Pengembalian Dana:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <label
                className={`p-3 rounded-2xl border text-xs cursor-pointer flex flex-col justify-between transition-all ${
                  refundType === 'normal'
                    ? 'border-[#C68B59] bg-[#C68B59]/10 text-stone-900 dark:text-stone-100 font-bold'
                    : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1E1C1A] text-stone-600 dark:text-stone-400'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <input
                    type="radio"
                    name="refundType"
                    value="normal"
                    checked={refundType === 'normal'}
                    onChange={() => setRefundType('normal')}
                    className="accent-[#C68B59]"
                  />
                  <span>Normal ({order.payment?.method === 'qris' ? 'QRIS / Non-Tunai' : 'Tunai Laci'})</span>
                </div>
                <span className="text-[10px] text-stone-500 font-normal">
                  Diajukan ke Owner. Uang kas/transfer baru dikeluarkan setelah disetujui.
                </span>
              </label>

              {isQris && (
                <label
                  className={`p-3 rounded-2xl border text-xs cursor-pointer flex flex-col justify-between transition-all ${
                    refundType === 'emergency'
                      ? 'border-amber-500 bg-amber-500/10 text-stone-900 dark:text-stone-100 font-bold'
                      : 'border-stone-200 dark:border-stone-700 bg-white dark:bg-[#1E1C1A] text-stone-600 dark:text-stone-400'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <input
                      type="radio"
                      name="refundType"
                      value="emergency"
                      checked={refundType === 'emergency'}
                      onChange={() => setRefundType('emergency')}
                      className="accent-amber-500"
                    />
                    <span className="text-amber-700 dark:text-amber-400">Emergency (QRIS → Tunai)</span>
                  </div>
                  <span className="text-[10px] text-stone-500 font-normal">
                    Uang kas laci diserahkan seketika ke pelanggan di lapangan saat darurat.
                  </span>
                </label>
              )}
            </div>

            {refundType === 'emergency' && (
              <div className="mt-2.5 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300 space-y-1">
                <div className="flex items-center gap-1.5 font-bold">
                  <Info className="w-3.5 h-3.5 shrink-0" />
                  <span>Perhatian Operasional Emergency Cash:</span>
                </div>
                <p>
                  Uang tunai Rp {Number(order.total_amount).toLocaleString('id-ID')} akan langsung memotong kas laci shift ini.
                  Saldo kas laci saat ini: <strong>{formatRupiah(availableCash)}</strong>.
                </p>
                {order.total_amount > availableCash && (
                  <p className="text-rose-600 dark:text-rose-400 font-bold">
                    ⚠️ Saldo kas laci tidak mencukupi untuk emergency cash payout!
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Alasan Refund */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
              Alasan Pengembalian:
            </label>
            <select
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="w-full px-3 py-2.5 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#C68B59]"
            >
              <option value="Batal Pelanggan">Batal Pelanggan</option>
              <option value="Salah Buat">Salah Buat Menu / Produk</option>
              <option value="Komplain Rasa">Komplain Rasa / Kualitas Minuman</option>
              <option value="Mesin Rusak">Kendala Mesin / Alat Operasional</option>
              <option value="Lainnya">Lainnya</option>
            </select>
          </div>

          {/* Catatan Tambahan */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
              Catatan Detail Kejadian (Opsional):
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Contoh: Pelanggan terburu-buru, mesin grinder macet..."
              rows={2}
              className="w-full px-3 py-2 rounded-2xl bg-stone-50 dark:bg-[#171514] border border-stone-200 dark:border-stone-700 text-xs focus:outline-none focus:ring-2 focus:ring-[#C68B59]"
            />
          </div>

          {/* Upload Foto Bukti */}
          <div>
            <label className="block text-xs font-bold text-stone-700 dark:text-stone-300 mb-1">
              Foto Bukti (Struk / Produk Rusak) <span className="text-rose-500">*</span>:
            </label>
            <ImageUpload
              onFileChange={file => setImageFile(file)}
              label="Lampirkan Foto Bukti"
              error={!imageFile && errorMessage ? 'Foto bukti wajib dilampirkan' : undefined}
            />
          </div>

          {/* PIN Karyawan Pengaju using shared PinKeypad */}
          <div className="pt-1">
            <PinKeypad
              pin={pin}
              onChange={newPin => {
                setPin(newPin);
                if (errorMessage) setErrorMessage('');
              }}
              maxLength={4}
              label={`PIN KASIR PENGAJU (${currentUser?.name || 'SESI AKTIF'})`}
              subtitle="Pengajuan mengikat identitas akun yang sedang bertugas"
              disabled={isSubmitting}
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-2xl border border-stone-200 dark:border-stone-700 text-xs font-bold text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting || (refundType === 'emergency' && order.total_amount > availableCash)}
              className="px-5 py-2.5 rounded-2xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] text-xs font-bold shadow-md hover:shadow-lg transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <Clock className="w-4 h-4 animate-spin text-[#D4A373]" />
                  <span>Memproses...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-4 h-4 text-[#D4A373]" />
                  <span>{refundType === 'emergency' ? 'Cairkan Kas & Ajukan' : 'Kirim Pengajuan ke Owner'}</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
