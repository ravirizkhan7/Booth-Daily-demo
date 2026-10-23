import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePOS } from '../hooks/usePOS';
import { CategoryBar } from '../components/pos/CategoryBar';
import { ProductCard } from '../components/pos/ProductCard';
import { CartSidebar } from '../components/pos/CartSidebar';
import { Search, ShoppingBag, Sparkles, AlertCircle, Lock, DoorOpen, ShieldAlert } from 'lucide-react';
import { formatRupiah } from '../utils/formatters';
import { getProductStockInfo } from '../utils/stockUtils';

export const POSPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");
  const {
    products,
    recipes,
    stocks,
    selectedCategory,
    cart,
    isShiftActive,
    openOpenShiftModal,
    shifts,
  } = usePOS();
  const [isMobileCartOpen, setIsMobileCartOpen] = useState<boolean>(false);

  const correctionNeededShifts = shifts.filter(
    s => s.status === 'closed' && s.reconciliation_status === 'correction_requested'
  );

  // Filter products based on category and search query
  const filteredProducts = products.filter(p => {
    if (!p.is_active) return false;
    let matchesCategory = true;

    if (selectedCategory === 'cat-favorites') {
      matchesCategory = p.is_favorite;
    } else if (selectedCategory === 'cat-out-of-stock') {
      const stockInfo = getProductStockInfo(p, recipes, stocks);
      matchesCategory = stockInfo.isOut;
    } else if (selectedCategory !== 'cat-all') {
      matchesCategory = p.category_id === selectedCategory;
    }

    const matchesSearch = searchQuery === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.description || '').toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCategory && matchesSearch;
  });

  const cartTotalQty = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartTotalPrice = cart.reduce((sum, item) => sum + item.product.price * item.qty, 0);

  return (
    <div className="h-[calc(100vh-61px)] flex flex-col lg:flex-row overflow-hidden bg-[#F7F5F2] dark:bg-[#121110]">
      {/* Left & Middle Area: POS Workspace (Category Bar, Search, Product Grid) */}
      <div className="flex-1 flex flex-col h-full overflow-hidden p-4 sm:p-5 space-y-4">
        {/* Alert Banner: Koreksi Shift Diminta oleh Owner */}
        {correctionNeededShifts.length > 0 && (
          <div className="p-3 bg-rose-500/10 dark:bg-rose-950/20 border border-rose-500/30 rounded-2xl flex items-center justify-between gap-3 text-xs text-rose-900 dark:text-rose-200 shrink-0 shadow-xs animate-fade-in">
            <div className="flex items-center gap-2.5 min-w-0">
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
              <span className="truncate">
                <strong>Perhatian Kasir:</strong> Ada {correctionNeededShifts.length} shift yang dikembalikan Owner untuk koreksi rekonsiliasi.
              </span>
            </div>
            <button
              type="button"
              onClick={() => navigate('/shifts')}
              className="px-3 py-1 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl text-[11px] whitespace-nowrap cursor-pointer shrink-0 shadow-xs transition-colors"
            >
              Koreksi Shift Sekarang
            </button>
          </div>
        )}

        {/* Search & Header Bar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 absolute left-3.5 top-3.5 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari menu minuman / makanan..."
              className="w-full pl-10 pr-12 py-2.5 rounded-2xl bg-white dark:bg-[#1E1C1A] border border-stone-200 dark:border-stone-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3B2A1F] dark:focus:ring-[#D4A373] text-[#1F1F1F] dark:text-stone-100 shadow-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-2.5 px-1.5 py-0.5 rounded-md text-[11px] font-bold text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 text-xs font-semibold text-stone-500">
            <Sparkles className="w-4 h-4 text-[#D4A373]" />
            <span>{filteredProducts.length} Menu Tersedia</span>
          </div>
        </div>

        {/* Locked Shift Banner */}
        {!isShiftActive && (
          <div className="shrink-0 p-3.5 bg-amber-500/10 dark:bg-amber-950/30 border border-amber-500/30 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-xl bg-amber-500/20 text-amber-800 dark:text-amber-200 shrink-0">
                <Lock className="w-4 h-4" />
              </div>
              <div>
                <p className="font-extrabold text-xs text-amber-950 dark:text-amber-100">
                  Kasir Terkunci — Shift Belum Dibuka
                </p>
                <p className="text-[11px] text-amber-800/80 dark:text-amber-300/80">
                  Produk dapat dilihat, namun tidak dapat ditambahkan ke keranjang atau ditransaksikan sampai shift dibuka.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={openOpenShiftModal}
              className="px-4 py-2 bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-black text-xs rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 shrink-0 self-end sm:self-center"
            >
              <DoorOpen className="w-3.5 h-3.5 text-[#D4A373]" />
              <span>Buka Shift</span>
            </button>
          </div>
        )}

        {/* Category Horizontal Filter Bar */}
        <div className="shrink-0">
          <CategoryBar />
        </div>

        {/* Product Grid Area */}
        <div className="flex-1 overflow-y-auto pr-1">
          {filteredProducts.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-center p-6 bg-white/50 dark:bg-[#1C1A18]/50 rounded-3xl border border-dashed border-stone-300 dark:border-stone-800">
              <AlertCircle className="w-10 h-10 text-stone-400 mb-2" />
              <p className="font-bold text-stone-700 dark:text-stone-300 text-base">Menu Tidak Ditemukan</p>
              <p className="text-xs text-stone-500 mt-1 max-w-sm">
                Coba ubah kata kunci pencarian atau ganti kategori menu yang dipilih.
              </p>
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="mt-3 px-4 py-2 rounded-xl bg-[#3B2A1F] text-[#F7F5F2] font-bold text-xs"
                >
                  Reset Pencarian
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3.5 pb-20 lg:pb-6">
              {filteredProducts.map((product, index) => (
                <ProductCard key={product.id} product={product} priority={index < 4} />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Area: Cart Sidebar (Desktop view) */}
      <div className="hidden lg:block w-96 h-full shrink-0">
        <CartSidebar />
      </div>

      {/* Floating Bottom Cart Bar (Mobile/Tablet Portrait View) */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 p-2.5 sm:p-3 bg-white/95 dark:bg-[#1A1816]/95 backdrop-blur-md border-t border-stone-200 dark:border-stone-800 z-30 shadow-2xl flex items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="relative shrink-0">
            <div className="p-2 sm:p-2.5 rounded-2xl bg-[#3B2A1F] text-[#F7F5F2]">
              <ShoppingBag className="w-4 h-4 sm:w-5 sm:h-5 text-[#D4A373]" />
            </div>
            {cartTotalQty > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-extrabold text-[10px] w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center">
                {cartTotalQty}
              </span>
            )}
          </div>
          <div className="min-w-0">
            <p className="text-[10px] sm:text-xs text-stone-500 font-bold uppercase truncate">TOTAL</p>
            <p className="text-sm sm:text-lg font-black text-[#3B2A1F] dark:text-[#D4A373] truncate">
              {formatRupiah(cartTotalPrice)}
            </p>
          </div>
        </div>

        <button
          onClick={() => setIsMobileCartOpen(true)}
          className="px-3.5 sm:px-5 py-2.5 sm:py-3 rounded-2xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] font-extrabold text-xs shadow-lg flex items-center gap-1.5 sm:gap-2 shrink-0 cursor-pointer"
        >
          <span>Lihat Pesanan ({cartTotalQty})</span>
        </button>
      </div>

      {/* Mobile Cart Drawer Modal */}
      {isMobileCartOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsMobileCartOpen(false)}
          />
          <div className="relative bg-white dark:bg-[#1C1A18] h-[85vh] rounded-t-3xl overflow-hidden shadow-2xl flex flex-col z-10 animate-slide-up">
            <CartSidebar onClose={() => setIsMobileCartOpen(false)} />
          </div>
        </div>
      )}
    </div>
  );
};
