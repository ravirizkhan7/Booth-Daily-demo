import React, { useState, useRef, useEffect } from 'react';
import { Product } from '../../types';
import { usePOS } from '../../hooks/usePOS';
import { formatRupiah } from '../../utils/formatters';
import { calculateOrderPreview } from '../../utils/orderCalculation';
import { ShoppingBag, Trash2, Plus, Minus, Edit3, ArrowRight, User, Utensils, ShoppingBag as BagIcon, Check, X, Lock, DoorOpen, Crown, RotateCcw } from 'lucide-react';
import { ConfirmDialog } from '../common/ConfirmDialog';

interface DeletedCartItem {
  product: Product;
  qty: number;
  notes: string;
}

interface CartSidebarProps {
  onClose?: () => void;
}

export const CartSidebar: React.FC<CartSidebarProps> = ({ onClose }) => {
  const {
    cart,
    addToCart,
    removeFromCart,
    orderType,
    setOrderType,
    orderArea,
    setOrderArea,
    customerName,
    setCustomerName,
    updateCartQty,
    updateCartNotes,
    clearCart,
    openPinModal,
    settings,
    discountRules,
    isShiftActive,
    openOpenShiftModal,
  } = usePOS();

  const [activeEditingNoteId, setActiveEditingNoteId] = useState<string | null>(null);
  const [deletedItemNotice, setDeletedItemNotice] = useState<DeletedCartItem | null>(null);
  const [isClearCartConfirmOpen, setIsClearCartConfirmOpen] = useState<boolean>(false);
  const undoTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Clear undo timer on unmount
  useEffect(() => {
    return () => {
      if (undoTimerRef.current) {
        clearTimeout(undoTimerRef.current);
      }
    };
  }, []);

  const handleDeleteItem = (item: { product: Product; qty: number; notes: string }) => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
    }
    setDeletedItemNotice({
      product: item.product,
      qty: item.qty,
      notes: item.notes,
    });
    removeFromCart(item.product.id);
    undoTimerRef.current = setTimeout(() => {
      setDeletedItemNotice(null);
      undoTimerRef.current = null;
    }, 4000);
  };

  const handleUndoDelete = () => {
    if (!deletedItemNotice) return;
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    const { product, qty, notes } = deletedItemNotice;
    addToCart(product, qty);
    if (notes) {
      updateCartNotes(product.id, notes);
    }
    setDeletedItemNotice(null);
  };

  const handleConfirmClearCart = () => {
    if (undoTimerRef.current) {
      clearTimeout(undoTimerRef.current);
      undoTimerRef.current = null;
    }
    setDeletedItemNotice(null);
    clearCart();
    setIsClearCartConfirmOpen(false);
  };

  const rawSubtotal = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0);
  const isVipOrder = orderType === 'dine_in' && orderArea === 'vip';
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
    orderType,
    isVip: isVipOrder,
    vipTaxPercentage: settings?.vip_tax_percentage,
    vipServiceChargePercentage: settings?.vip_room_service_charge_percentage,
  });

  const quickNoteOptions = ['Less Sugar', 'No Ice', 'Extra Shot', 'Extra Cheese', 'Less Ice', 'Warm'];

  const handleApplyNoteOption = (productId: string, currentNotes: string, option: string) => {
    if (currentNotes.includes(option)) {
      // Remove option if already selected
      const updated = currentNotes
        .split(', ')
        .filter(n => n !== option)
        .join(', ');
      updateCartNotes(productId, updated);
    } else {
      // Append option
      const updated = currentNotes ? `${currentNotes}, ${option}` : option;
      updateCartNotes(productId, updated);
    }
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-[#1C1A18] border-l border-stone-200 dark:border-stone-800 shadow-xl overflow-hidden select-none">
      {/* Cart Header */}
      <div className="p-4 bg-[#3B2A1F] text-[#F7F5F2] flex justify-between items-center shrink-0">
        <div className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5 text-[#D4A373]" />
          <div>
            <h2 className="font-extrabold text-base leading-tight">Keranjang Pesanan</h2>
            <p className="text-[11px] text-[#D4A373]">{cart.length} Jenis Item</p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {cart.length > 0 && (
            <button
              type="button"
              onClick={() => setIsClearCartConfirmOpen(true)}
              className="p-2 rounded-xl bg-white/10 hover:bg-rose-500/80 text-white transition-colors cursor-pointer"
              title="Kosongkan Keranjang"
              aria-label="Kosongkan Keranjang"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer lg:hidden"
              title="Tutup Keranjang"
              aria-label="Tutup Keranjang"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Order Type & Customer Name Bar */}
      <div className="p-3.5 bg-stone-50 dark:bg-[#22201D] border-b border-stone-200 dark:border-stone-800 space-y-2.5 shrink-0">
        {/* Dine In vs Take Away Switch */}
        <div className="grid grid-cols-2 p-1 bg-stone-200/80 dark:bg-stone-900 rounded-2xl">
          <button
            type="button"
            onClick={() => {
              setOrderType('dine_in');
              setOrderArea('regular');
            }}
            className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
              orderType === 'dine_in'
                ? 'bg-[#3B2A1F] text-[#F7F5F2] shadow-md'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-100'
            }`}
          >
            <Utensils className="w-3.5 h-3.5 text-[#D4A373]" />
            Dine In
          </button>

          <button
            type="button"
            onClick={() => {
              setOrderType('take_away');
              setOrderArea('regular');
            }}
            className={`flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all ${
              orderType === 'take_away'
                ? 'bg-[#3B2A1F] text-[#F7F5F2] shadow-md'
                : 'text-stone-600 dark:text-stone-400 hover:text-stone-100'
            }`}
          >
            <BagIcon className="w-3.5 h-3.5 text-[#D4A373]" />
            Take Away
          </button>
        </div>

        {/* Area Pesanan: Umum vs Ruang VIP Switch (Dine In only) */}
        {orderType === 'dine_in' && (
        <div className="flex items-center justify-between text-xs font-bold text-stone-600 dark:text-stone-400 px-1 pt-0.5">
          <span className="flex items-center gap-1">
            <Crown className="w-3.5 h-3.5 text-amber-500" />
            Area Pesanan:
          </span>
          <div className="flex items-center gap-1 bg-stone-200/80 dark:bg-stone-900 p-0.5 rounded-xl">
            <button
              type="button"
              id="order-area-regular-btn"
              onClick={() => setOrderArea('regular')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                orderArea === 'regular'
                  ? 'bg-[#3B2A1F] text-[#F7F5F2] shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100'
              }`}
            >
              Umum
            </button>
            <button
              type="button"
              id="order-area-vip-btn"
              onClick={() => setOrderArea('vip')}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${
                isVipOrder
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-stone-600 dark:text-stone-400 hover:text-amber-600'
              }`}
            >
              Ruang VIP
            </button>
          </div>
        </div>

        )}

        {/* Customer / Table Input */}
        <div className="relative">
          <User className="w-4 h-4 absolute left-3 top-2.5 text-stone-400" />
          <input
            type="text"
            value={customerName}
            onChange={e => setCustomerName(e.target.value)}
            placeholder={
              isVipOrder
                ? 'Nomor Meja VIP / Nama Tamu VIP'
                : orderType === 'dine_in'
                  ? 'Nomor Meja / Nama Pelanggan'
                  : 'Nama Pelanggan (Take Away)'
            }
            className="w-full pl-9 pr-3 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#171514] border border-stone-300 dark:border-stone-700 focus:outline-none focus:border-[#C68B59] text-stone-900 dark:text-stone-100"
          />
        </div>
      </div>

      {/* Cart Items List Container with Non-Blocking Undo Banner */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex-1 overflow-y-auto p-3.5 space-y-3">
        {cart.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-stone-400 py-12 text-center">
            <ShoppingBag className="w-12 h-12 mb-3 text-stone-300 dark:text-stone-700" />
            <p className="font-bold text-stone-600 dark:text-stone-400 text-sm">Keranjang Kosong</p>
            <p className="text-xs text-stone-400 dark:text-stone-500 max-w-[200px] mt-1">
              Pilih produk dari menu di sebelah kiri untuk ditambahkan.
            </p>
          </div>
        ) : (
          cart.map(item => {
            const isEditingNote = activeEditingNoteId === item.product.id;
            return (
              <div
                key={item.product.id}
                className="p-3 bg-stone-50 dark:bg-[#23201D] rounded-2xl border border-stone-200 dark:border-stone-800 space-y-2.5 shadow-sm"
              >
                {/* Top Row: Name & Price */}
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1">
                    <h4 className="font-bold text-stone-900 dark:text-stone-100 text-sm leading-tight">
                      {item.product.name}
                    </h4>
                    <span className="text-xs text-stone-500 font-semibold">
                      {formatRupiah(item.product.price)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-extrabold text-[#3B2A1F] dark:text-[#D4A373] text-sm">
                      {formatRupiah(item.product.price * item.qty)}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item)}
                      aria-label={`Hapus ${item.product.name} dari keranjang`}
                      title={`Hapus ${item.product.name}`}
                      className="min-w-[32px] min-h-[32px] p-2 text-stone-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-xl transition-colors cursor-pointer flex items-center justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-rose-500"
                    >
                      <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                </div>

                {/* Notes Display or Editor */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-stone-500 font-semibold flex items-center gap-1">
                      <Edit3 className="w-3 h-3 text-[#C68B59]" /> Catatan Pesanan
                    </span>
                    <button
                      type="button"
                      onClick={() => setActiveEditingNoteId(isEditingNote ? null : item.product.id)}
                      className="text-[#C68B59] hover:underline font-bold"
                    >
                      {isEditingNote ? 'Selesai' : item.notes ? 'Edit Catatan' : '+ Catatan'}
                    </button>
                  </div>

                  {item.notes && !isEditingNote && (
                    <div className="p-1.5 px-2.5 bg-amber-500/10 rounded-lg text-xs text-amber-800 dark:text-amber-300 font-medium italic">
                      "{item.notes}"
                    </div>
                  )}

                  {isEditingNote && (
                    <div className="space-y-2 pt-1 animate-fade-in">
                      {/* Preset Chips */}
                      <div className="flex flex-wrap gap-1">
                        {quickNoteOptions.map(opt => {
                          const isSel = item.notes.includes(opt);
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => handleApplyNoteOption(item.product.id, item.notes, opt)}
                              className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border transition-all ${
                                isSel
                                  ? 'bg-[#3B2A1F] text-[#F7F5F2] border-[#3B2A1F]'
                                  : 'bg-white dark:bg-[#191716] text-stone-700 dark:text-stone-300 border-stone-300 dark:border-stone-700'
                              }`}
                            >
                              {isSel ? <Check className="w-3 h-3 inline mr-1" /> : null} {opt}
                            </button>
                          );
                        })}
                      </div>

                      <input
                        type="text"
                        value={item.notes}
                        onChange={e => updateCartNotes(item.product.id, e.target.value)}
                        placeholder="Catatan kustom (misal: Less Sugar)..."
                        className="w-full px-2.5 py-1.5 rounded-lg text-xs bg-white dark:bg-[#171514] border border-stone-300 dark:border-stone-700 focus:outline-none focus:border-[#C68B59]"
                      />
                    </div>
                  )}
                </div>

                {/* Controls Row */}
                <div className="flex flex-wrap items-center justify-between gap-1.5 pt-1.5 border-t border-stone-200/60 dark:border-stone-800">
                  {/* Quick Quantity Shortcuts */}
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-stone-400 font-bold mr-1">Quick:</span>
                    {[1, 2, 3].map(q => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => updateCartQty(item.product.id, item.qty + q)}
                        className="px-2 py-0.5 rounded-lg bg-stone-200/80 dark:bg-stone-800 hover:bg-stone-300 text-stone-700 dark:text-stone-300 font-extrabold text-[10px] transition-colors"
                      >
                        +{q}
                      </button>
                    ))}
                  </div>

                  {/* Increment / Decrement */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={item.qty <= 1}
                      onClick={() => updateCartQty(item.product.id, item.qty - 1)}
                      aria-label={`Kurangi jumlah ${item.product.name}`}
                      className="min-w-[32px] min-h-[32px] p-1.5 rounded-xl bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-800 dark:text-stone-200 transition-colors flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#3B2A1F] dark:focus-visible:ring-[#D4A373] cursor-pointer"
                    >
                      <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>

                    <span className="font-extrabold text-sm min-w-[20px] text-center text-stone-900 dark:text-stone-100">
                      {item.qty}
                    </span>

                    <button
                      type="button"
                      onClick={() => updateCartQty(item.product.id, item.qty + 1)}
                      aria-label={`Tambah jumlah ${item.product.name}`}
                      className="min-w-[32px] min-h-[32px] p-1.5 rounded-xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] transition-colors flex items-center justify-center focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-[#D4A373] cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 text-[#D4A373]" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
        </div>

        {/* Non-blocking Undo Notification Banner */}
        {deletedItemNotice && (
          <div className="px-3.5 pb-2 animate-fade-in shrink-0">
            <div className="p-2.5 px-3 rounded-xl bg-[#2A1E16] text-[#F7F5F2] dark:bg-[#25221F] dark:text-stone-100 border border-stone-700/40 dark:border-stone-700 shadow-xl flex items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 min-w-0">
                <Trash2 className="w-3.5 h-3.5 text-rose-400 shrink-0" aria-hidden="true" />
                <span className="truncate">
                  <span className="font-bold">{deletedItemNotice.product.name}</span> dihapus
                </span>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleUndoDelete}
                  className="px-2.5 py-1 rounded-lg bg-[#D4A373] hover:bg-[#C68B59] text-[#1F1F1F] font-black text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-xs"
                >
                  <RotateCcw className="w-3 h-3" aria-hidden="true" />
                  <span>Urungkan</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (undoTimerRef.current) {
                      clearTimeout(undoTimerRef.current);
                      undoTimerRef.current = null;
                    }
                    setDeletedItemNotice(null);
                  }}
                  aria-label="Tutup notifikasi urungkan"
                  className="p-1 text-stone-400 hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Payment Section */}
      <div className="p-4 bg-white dark:bg-[#181614] border-t border-stone-200 dark:border-stone-800 space-y-3 shrink-0 shadow-lg">
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between text-stone-500">
            <span>Subtotal</span>
            <span className="font-bold text-stone-800 dark:text-stone-200">{formatRupiah(subtotal)}</span>
          </div>

          <div className="flex justify-between items-center text-stone-500">
            <span className="flex items-center gap-1.5">
              <span>Diskon</span>
              {discountName && (
                <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400">
                  {discountName}
                </span>
              )}
            </span>
            <span className={`font-bold ${discount > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-800 dark:text-stone-200'}`}>
              {discount > 0 ? `-${formatRupiah(discount)}` : 'Rp 0'}
            </span>
          </div>

          <div className="flex justify-between text-stone-500">
            <span>Pajak ({taxPercentage}%)</span>
            <span className="font-bold text-stone-800 dark:text-stone-200">{formatRupiah(tax)}</span>
          </div>

          {isVipOrder && serviceCharge > 0 && (
            <div className="flex justify-between text-stone-500">
              <span className="flex items-center gap-1">
                <Crown className="w-3 h-3 text-amber-500" />
                <span>Biaya Layanan VIP ({serviceChargePercentage}%)</span>
              </span>
              <span className="font-bold text-stone-800 dark:text-stone-200">{formatRupiah(serviceCharge)}</span>
            </div>
          )}

          <div className="flex justify-between text-base font-black text-stone-900 dark:text-stone-100 pt-2 border-t border-dashed border-stone-300 dark:border-stone-700">
            <span>TOTAL</span>
            <span className="text-[#3B2A1F] dark:text-[#D4A373]">{formatRupiah(totalAmount)}</span>
          </div>
        </div>

        {!isShiftActive && (
          <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-2xl space-y-1 text-center">
            <p className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center justify-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-amber-600" />
              Shift Kasir Belum Dibuka
            </p>
            <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
              Buka shift terlebih dahulu untuk memproses pesanan dan checkout transaksi.
            </p>
          </div>
        )}

        {!isShiftActive ? (
          <button
            type="button"
            onClick={openOpenShiftModal}
            className="w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm text-[#F7F5F2] bg-[#3B2A1F] hover:bg-[#2A1E16] active:scale-98 cursor-pointer flex items-center justify-center gap-2 shadow-xl transition-all"
          >
            <DoorOpen className="w-4 h-4 text-[#D4A373] shrink-0" />
            <span>BUKA SHIFT UNTUK TRANSAKSI</span>
          </button>
        ) : (
          <button
            type="button"
            disabled={cart.length === 0}
            onClick={openPinModal}
            className={`w-full py-3.5 px-4 rounded-2xl font-black text-xs sm:text-sm text-[#F7F5F2] flex items-center justify-center gap-2 shadow-xl transition-all ${
              cart.length > 0
                ? 'bg-[#3B2A1F] hover:bg-[#2A1E16] active:scale-98 cursor-pointer'
                : 'bg-stone-300 dark:bg-stone-800 text-stone-500 cursor-not-allowed shadow-none'
            }`}
          >
            <span className="truncate">BAYAR SEKARANG ({formatRupiah(totalAmount)})</span>
            <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4A373] shrink-0" />
          </button>
        )}
      </div>

      {/* Confirmation Dialog for Clearing Entire Cart */}
      <ConfirmDialog
        isOpen={isClearCartConfirmOpen}
        title="Kosongkan Keranjang?"
        message="Bersihkan semua item dari keranjang pesanan? Seluruh item yang telah dipilih akan dihapus."
        confirmText="Kosongkan Keranjang"
        cancelText="Batal"
        isDanger={true}
        onConfirm={handleConfirmClearCart}
        onCancel={() => setIsClearCartConfirmOpen(false)}
      />
    </div>
  );
};
