import React from 'react';
import { Product } from '../../types';
import { usePOS } from '../../hooks/usePOS';
import { formatRupiah } from '../../utils/formatters';
import { getProductStockInfo } from '../../utils/stockUtils';
import { getImageUrl } from '../../utils/axios';
import { Heart, BookOpen, Sparkles, Coffee, Lock } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  priority?: boolean;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product, priority = false }) => {
  const {
    addToCart,
    toggleFavorite,
    openRecipeModal,
    cart,
    recipes,
    stocks,
    isShiftActive,
    openOpenShiftModal,
  } = usePOS();

  const cartItem = cart.find(item => item.product.id === product.id);
  const currentQty = cartItem ? cartItem.qty : 0;

  const stockInfo = getProductStockInfo(product, recipes, stocks);

  return (
    <div
      onClick={() => {
        if (!isShiftActive) {
          openOpenShiftModal();
          return;
        }
        if (!stockInfo.isOut) {
          addToCart(product);
        }
      }}
      title={
        !isShiftActive
          ? 'Shift kasir belum dibuka. Klik untuk buka shift.'
          : stockInfo.isOut
          ? stockInfo.isOngoing
            ? 'Produk masih dalam proses konfigurasi resep.'
            : 'Stok habis, silakan lakukan pembelian atau update stok.'
          : ''
      }
      className={`group relative bg-white dark:bg-[#1E1C1A] rounded-[16px] p-3 border shadow-sm transition-all duration-200 flex flex-col justify-between select-none ${stockInfo.isOut
        ? 'opacity-60 cursor-not-allowed border-stone-200 dark:border-stone-800'
        : 'border-transparent hover:border-[#3B2A1F] dark:hover:border-[#D4A373] hover:shadow-md cursor-pointer'
        }`}
    >
      {/* Image container */}
      <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-[#F7F5F2] dark:bg-[#151312] mb-3 flex items-center justify-center">
        {product.image_url ? (
          <img
            src={getImageUrl(product.image_url)}
            alt={product.name}
            className={`w-full h-full object-cover transition-transform duration-300 ${stockInfo.isOut ? 'grayscale-[30%]' : 'group-hover:scale-105'
              }`}
            loading={priority ? 'eager' : 'lazy'}
            fetchPriority={priority ? 'high' : 'auto'}
            decoding="async"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-stone-300 dark:text-stone-700">
            <Coffee className="w-10 h-10" />
          </div>
        )}

        {/* Top Badges (Stock Badge + Favorite) */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-center z-10 gap-1">
          <div className="flex flex-wrap items-center gap-1 max-w-[75%]">
            {product.is_favorite && (
              <span className="flex items-center gap-0.5 bg-[#3B2A1F] text-[#F7F5F2] font-extrabold text-[9px] px-1.5 py-0.5 rounded-full shadow-sm">
                <Sparkles className="w-2.5 h-2.5 text-[#D4A373]" /> Favorit
              </span>
            )}

            {/* Stock Badge */}
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold tracking-tight border backdrop-blur-sm shadow-xs ${stockInfo.badgeColorClass}`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                  stockInfo.status === 'HABIS'
                    ? 'bg-rose-500'
                    : stockInfo.status === 'SISA_SEDIKIT' || stockInfo.status === 'MENIPIS'
                    ? 'bg-amber-500'
                    : stockInfo.status === 'AMAN'
                    ? 'bg-emerald-500'
                    : 'bg-stone-400'
                }`}
                aria-hidden="true"
              />
              <span className="leading-tight">{stockInfo.label}</span>
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(product.id);
            }}
            className={`p-1.5 rounded-lg bg-white/80 dark:bg-black/60 backdrop-blur-sm transition-transform active:scale-90 shadow-sm shrink-0 ${product.is_favorite
              ? 'text-rose-500'
              : 'text-stone-400 hover:text-rose-500'
              }`}
          >
            <Heart className={`w-3.5 h-3.5 ${product.is_favorite ? 'fill-rose-500 text-rose-500' : ''}`} />
          </button>
        </div>

        {/* Recipe Quick Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            openRecipeModal(product);
          }}
          className="absolute bottom-2 left-2 z-10 p-1.5 rounded-lg bg-white/80 dark:bg-black/60 backdrop-blur-sm text-[#3B2A1F] dark:text-[#D4A373] hover:bg-white transition-colors shadow-sm"
          title="Lihat Resep"
        >
          <BookOpen className="w-3.5 h-3.5" />
        </button>

        {/* Selected Quantity Indicator Badge */}
        {currentQty > 0 && (
          <div className="absolute bottom-2 right-2 z-10 bg-[#3B2A1F] text-[#F7F5F2] font-black text-xs px-2.5 py-0.5 rounded-full shadow-md border border-[#D4A373]">
            {currentQty}x
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col justify-between">
        <div>
          <h3 className="font-bold text-stone-900 dark:text-stone-100 text-sm leading-snug line-clamp-1 group-hover:text-[#3B2A1F] dark:group-hover:text-[#D4A373] transition-colors">
            {product.name}
          </h3>
          <p className="text-[11px] text-stone-500 dark:text-stone-400 line-clamp-1 mt-0.5">
            {product.description || 'Cold / Hot'}
          </p>
        </div>

        {/* Price & Add Button */}
        <div className="flex items-center justify-between mt-3 pt-2 border-t border-stone-100 dark:border-stone-800/60">
          <span className="font-bold text-[#3B2A1F] dark:text-[#D4A373] text-sm sm:text-base">
            {formatRupiah(product.price)}
          </span>

          <button
            type="button"
            disabled={stockInfo.isOut && isShiftActive}
            onClick={(e) => {
              e.stopPropagation();
              if (!isShiftActive) {
                openOpenShiftModal();
                return;
              }
              if (!stockInfo.isOut) {
                addToCart(product);
              }
            }}
            className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-base shadow-sm transition-all ${
              !isShiftActive
                ? 'bg-amber-500/20 text-amber-800 dark:text-amber-300 hover:bg-amber-500/30 cursor-pointer'
                : stockInfo.isOut
                ? 'bg-stone-200 dark:bg-stone-800 text-stone-400 cursor-not-allowed shadow-none'
                : 'bg-[#3B2A1F] hover:bg-[#2A1E16] active:scale-95 text-[#F7F5F2] cursor-pointer'
            }`}
            title={
              !isShiftActive
                ? 'Buka shift untuk menambah pesanan'
                : stockInfo.isOut
                ? stockInfo.isOngoing
                  ? 'Produk masih dalam proses konfigurasi resep.'
                  : 'Stok habis, silakan lakukan pembelian atau update stok.'
                : 'Tambah ke Keranjang'
            }
          >
            {!isShiftActive ? <Lock className="w-3.5 h-3.5" /> : '+'}
          </button>
        </div>
      </div>
    </div>
  );
};
