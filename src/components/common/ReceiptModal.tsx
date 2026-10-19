import React from 'react';
import { usePOS } from '../../hooks/usePOS';
import { formatRupiah, formatDate } from '../../utils/formatters';
import { X, Printer, Share2, CheckCircle2, RotateCcw } from 'lucide-react';
import { printReceipt } from '../../services/receiptPrint';

export const ReceiptModal: React.FC = () => {
  const { isReceiptModalOpen, closeReceiptModal, currentReceiptOrder, settings, showToast, printerLogo } = usePOS();

  if (!isReceiptModalOpen || !currentReceiptOrder) return null;

  const isRefunded = currentReceiptOrder.payment?.status === 'refunded';

  // Snapshot fields — NEVER recalculate, always read from backend order
  const subtotal       = currentReceiptOrder.subtotal       ?? 0;
  const discount       = currentReceiptOrder.discount       ?? 0;
  const discountName   = currentReceiptOrder.discount_name  ?? null;
  const tax            = currentReceiptOrder.tax            ?? 0;
  const totalAmount    = currentReceiptOrder.total_amount   ?? 0;

  const storeName = settings?.store_name?.trim() ? settings.store_name.trim() : 'BOOTH DAILY';

  const handlePrint = () => {
    printReceipt(currentReceiptOrder, settings, printerLogo);
    showToast('Struk sedang dicetak...', 'success');
  };

  const handleCopyText = () => {
    const promoLine = discountName ? `Promo     : ${discountName}\n` : '';
    const discountLine = discount > 0
      ? `-${formatRupiah(discount)}`
      : formatRupiah(0);

    const text = `
*${storeName}*
${settings.address}
--------------------------------
No. Pesanan: ${currentReceiptOrder.order_number}
Tanggal    : ${formatDate(currentReceiptOrder.created_at)}
Kasir      : ${currentReceiptOrder.created_by_name}
Tipe       : ${currentReceiptOrder.order_type === 'dine_in' ? 'DINE IN' : 'TAKE AWAY'}
Status     : ${isRefunded ? 'DIREFUND' : 'LUNAS'}
--------------------------------
${(currentReceiptOrder.items || [])
  .map(item => `${item.qty}x ${item.product_name} @ ${formatRupiah(item.price)}\n   Subtotal: ${formatRupiah(item.subtotal)}${item.notes ? `\n   Catatan: ${item.notes}` : ''}`)
  .join('\n')}
--------------------------------
Subtotal  : ${formatRupiah(subtotal)}
Diskon    : ${discountLine}
${promoLine}Pajak     : ${formatRupiah(tax)}
TOTAL     : ${formatRupiah(totalAmount)}
Pembayaran: ${(currentReceiptOrder.payment?.method || 'CASH').toUpperCase()}
Diterima  : ${formatRupiah(currentReceiptOrder.payment?.amount_paid || totalAmount)}
Kembali   : ${formatRupiah(currentReceiptOrder.payment?.change || 0)}
--------------------------------
${settings.receipt_footer}
    `.trim();

    navigator.clipboard.writeText(text);
    showToast('Struk berhasil disalin ke clipboard!', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md bg-[#F7F5F2] dark:bg-[#1A1816] rounded-3xl shadow-2xl border border-stone-300 dark:border-stone-800 overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className={`px-6 py-4 text-white flex justify-between items-center shrink-0 ${
          isRefunded ? 'bg-rose-600' : 'bg-[#10B981]'
        }`}>
          <div className="flex items-center gap-2">
            {isRefunded ? (
              <RotateCcw className="w-6 h-6 text-white" />
            ) : (
              <CheckCircle2 className="w-6 h-6 text-white" />
            )}
            <div>
              <h3 className="font-bold text-base leading-tight">
                {isRefunded ? 'Transaksi Telah Direfund' : 'Transaksi Sukses!'}
              </h3>
              <p className="text-xs text-white/80">{currentReceiptOrder.order_number}</p>
            </div>
          </div>
          <button
            onClick={closeReceiptModal}
            className="p-1.5 rounded-full hover:bg-white/20 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-white" />
          </button>
        </div>

        {/* Printable Receipt Paper Container */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          <div
            id="printable-receipt"
            className="bg-white text-stone-900 p-6 rounded-2xl border border-stone-200 shadow-inner font-mono text-xs space-y-3"
          >
            {/* Store Header */}
            <div className="text-center space-y-1 pb-3 border-b border-dashed border-stone-300">
              {printerLogo && (
                <div className="flex justify-center mb-1">
                  <img
                    src={printerLogo}
                    alt={storeName}
                    className="max-h-12 max-w-[140px] object-contain drop-shadow-sm"
                  />
                </div>
              )}
              <div className="font-bold text-sm tracking-wider text-[#3B2A1F]">
                {storeName}
              </div>
              <p className="text-[10px] text-stone-500 uppercase tracking-wider">{settings.tagline}</p>
              <p className="text-[10px] text-stone-600">{settings.address}</p>
              <p className="text-[10px] text-stone-600">Telp: {settings.phone}</p>
            </div>

            {/* Order Info */}
            <div className="text-[11px] space-y-1 border-b border-dashed border-stone-300 pb-3">
              <div className="flex justify-between">
                <span className="text-stone-500">No:</span>
                <span className="font-bold">{currentReceiptOrder.order_number}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Waktu:</span>
                <span>{formatDate(currentReceiptOrder.created_at)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Kasir:</span>
                <span>{currentReceiptOrder.created_by_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-stone-500">Tipe Pesanan:</span>
                <span className="font-bold uppercase text-[#C68B59]">
                  {currentReceiptOrder.order_type === 'dine_in' ? 'DINE IN' : 'TAKE AWAY'}
                  {currentReceiptOrder.customer_name ? ` (${currentReceiptOrder.customer_name})` : ''}
                </span>
              </div>
              {isRefunded && (
                <div className="space-y-1 pt-1.5 border-t border-dashed border-rose-200">
                  <div className="flex justify-between text-rose-600 font-bold">
                    <span>Status:</span>
                    <span className="uppercase">DIREFUND</span>
                  </div>
                  {currentReceiptOrder.refunded_by_name && (
                    <div className="flex justify-between text-rose-600 text-xs">
                      <span className="text-stone-500">Refund Oleh:</span>
                      <span className="font-semibold">{currentReceiptOrder.refunded_by_name}</span>
                    </div>
                  )}
                  {currentReceiptOrder.refund_reason && (
                    <div className="flex justify-between text-rose-600 text-xs">
                      <span className="text-stone-500">Alasan:</span>
                      <span className="font-semibold">{currentReceiptOrder.refund_reason}</span>
                    </div>
                  )}
                  {currentReceiptOrder.refunded_at && (
                    <div className="flex justify-between text-rose-600 text-xs">
                      <span className="text-stone-500">Tanggal:</span>
                      <span>{formatDate(currentReceiptOrder.refunded_at)}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Items */}
            <div className="space-y-2 border-b border-dashed border-stone-300 pb-3">
              {(currentReceiptOrder.items || []).map((item, idx) => (
                <div key={idx} className="space-y-0.5">
                  <div className="flex justify-between font-bold">
                    <span>
                      {item.qty}x {item.product_name}
                    </span>
                    <span>{formatRupiah(item.subtotal)}</span>
                  </div>
                  {item.notes && (
                    <div className="text-[10px] text-stone-500 italic pl-3">
                      Catatan: {item.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Financial Breakdown — Backend Snapshot Only */}
            <div className="space-y-1 border-b border-dashed border-stone-300 pb-3">
              {/* Subtotal */}
              <div className="flex justify-between text-stone-600">
                <span>Subtotal:</span>
                <span>{formatRupiah(subtotal)}</span>
              </div>

              {/* Diskon */}
              <div className="flex justify-between text-stone-600">
                <span>Diskon:</span>
                <span className={discount > 0 ? 'text-emerald-600 font-semibold' : ''}>
                  {discount > 0 ? `-${formatRupiah(discount)}` : formatRupiah(0)}
                </span>
              </div>

              {/* Promo Name (only if discount_name exists and is non-empty) */}
              {discountName && (
                <div className="text-[10px] text-emerald-600 italic pl-2">
                  {discountName}
                </div>
              )}

              {/* Pajak */}
              <div className="flex justify-between text-stone-600">
                <span>Pajak:</span>
                <span>{formatRupiah(tax)}</span>
              </div>
            </div>

            {/* Total & Payment */}
            <div className="space-y-1.5 pt-1">
              <div className="flex justify-between text-sm font-black text-stone-900 pt-1">
                <span>TOTAL:</span>
                <span>{formatRupiah(totalAmount)}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Metode Bayar:</span>
                <span className="font-bold uppercase">{currentReceiptOrder.payment?.method || '-'}</span>
              </div>
              <div className="flex justify-between text-stone-600">
                <span>Diterima:</span>
                <span>{formatRupiah(currentReceiptOrder.payment?.amount_paid || totalAmount)}</span>
              </div>
              <div className="flex justify-between text-stone-600 font-bold">
                <span>Kembalian:</span>
                <span>{formatRupiah(currentReceiptOrder.payment?.change || 0)}</span>
              </div>
            </div>

            {/* Receipt Footer */}
            <div className="text-center pt-3 border-t border-dashed border-stone-300 text-[10px] text-stone-500 space-y-1">
              <p className="whitespace-pre-line">{settings.receipt_header}</p>
              <p className="font-semibold text-stone-700 whitespace-pre-line">{settings.receipt_footer}</p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white dark:bg-[#161413] border-t border-stone-200 dark:border-stone-800 flex flex-wrap gap-2.5 shrink-0">
          <button
            onClick={handleCopyText}
            className="flex-1 px-4 py-3 rounded-2xl bg-stone-100 dark:bg-stone-800 hover:bg-stone-200 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 font-bold text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <Share2 className="w-4 h-4 text-[#C68B59]" />
            Salin Struk
          </button>

          <button
            onClick={handlePrint}
            className="flex-1 px-4 py-3 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md transition-colors cursor-pointer"
          >
            <Printer className="w-4 h-4 text-white" />
            Cetak Struk
          </button>

          <button
            onClick={closeReceiptModal}
            className="w-full py-3 rounded-2xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-extrabold text-sm transition-all cursor-pointer"
          >
            Selesai & Kembali ke Kasir
          </button>
        </div>
      </div>
    </div>
  );
};
