import React from 'react';
import { usePOS } from '../../hooks/usePOS';
import { formatRupiah } from '../../utils/formatters';
import { getImageUrl } from '../../utils/axios';
import { X, Clock, Coffee, Sparkles, ChefHat, CheckCircle2 } from 'lucide-react';

export const RecipeModal: React.FC = () => {
  const { selectedRecipe, selectedRecipeProduct, closeRecipeModal, addToCart } = usePOS();

  if (!selectedRecipeProduct) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-2xl max-h-[90vh] bg-[#F7F5F2] dark:bg-[#1C1A18] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col">
        {/* Header with Image */}
        <div className="relative h-48 sm:h-56 w-full shrink-0 overflow-hidden bg-stone-900">
          <img
            src={getImageUrl(selectedRecipe?.image_url || selectedRecipeProduct.image_url)}
            alt={selectedRecipeProduct.name}
            className="w-full h-full object-cover opacity-85"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
          
          <button
            onClick={closeRecipeModal}
            className="absolute top-4 right-4 p-2.5 rounded-full bg-black/50 text-white hover:bg-black/80 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="absolute bottom-4 left-6 right-6 text-white flex justify-between items-end">
            <div>
              <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-[#D4A373] text-[#1F1F1F] mb-1">
                STANDAR RESEP BARISTA
              </span>
              <h2 className="text-2xl font-black text-white">{selectedRecipeProduct.name}</h2>
              <p className="text-sm text-stone-300 line-clamp-1">{selectedRecipeProduct.description}</p>
            </div>
            <div className="text-right shrink-0">
              <span className="text-xl font-bold text-[#D4A373]">{formatRupiah(selectedRecipeProduct.price)}</span>
              {selectedRecipe && (
                <div className="flex items-center justify-end gap-1 text-xs text-stone-300 mt-0.5">
                  <Clock className="w-3.5 h-3.5 text-[#D4A373]" />
                  <span>{selectedRecipe.prep_time_minutes} Menit</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1 text-stone-800 dark:text-stone-200">
          {selectedRecipe ? (
            <>
              {/* Recipe Description */}
              {selectedRecipe.description && (
                <p className="text-sm text-stone-600 dark:text-stone-300 italic border-l-4 border-[#C68B59] pl-3 py-1 bg-amber-500/5 rounded-r-lg">
                  "{selectedRecipe.description}"
                </p>
              )}

              {/* Ingredients Section */}
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-[#3B2A1F] dark:text-[#D4A373] mb-3">
                  <Coffee className="w-5 h-5 text-[#C68B59]" />
                  Bahan & Takaran (Per Porsi)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {selectedRecipe.ingredients.map(ing => (
                    <div
                      key={ing.id}
                      className="flex justify-between items-center px-3.5 py-2.5 bg-white dark:bg-[#25221F] rounded-xl border border-stone-200 dark:border-stone-800 text-sm"
                    >
                      <span className="font-medium text-stone-800 dark:text-stone-200">{ing.stock_name}</span>
                      <span className="font-bold text-[#C68B59] bg-[#C68B59]/10 px-2 py-0.5 rounded-lg text-xs">
                        {ing.amount} {ing.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Steps Section */}
              <div>
                <h3 className="flex items-center gap-2 text-base font-bold text-[#3B2A1F] dark:text-[#D4A373] mb-3">
                  <ChefHat className="w-5 h-5 text-[#C68B59]" />
                  Langkah-Langkah Pembuatan
                </h3>
                <div className="space-y-2.5">
                  {selectedRecipe.steps.map(step => (
                    <div
                      key={step.step_number}
                      className="flex items-start gap-3 p-3 bg-white dark:bg-[#25221F] rounded-2xl border border-stone-200 dark:border-stone-800"
                    >
                      <span className="flex items-center justify-center w-7 h-7 rounded-xl bg-[#3B2A1F] text-[#F7F5F2] font-bold text-xs shrink-0 mt-0.5">
                        {step.step_number}
                      </span>
                      <p className="text-sm leading-relaxed text-stone-700 dark:text-stone-300">
                        {step.instruction}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Barista Tips Section */}
              {selectedRecipe.barista_tips && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-[#C68B59] shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-[#C68B59] mb-1">
                      Tips Barista Booth Daily
                    </h4>
                    <p className="text-xs text-stone-700 dark:text-stone-300 leading-relaxed">
                      {selectedRecipe.barista_tips}
                    </p>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-12 text-center text-stone-500 dark:text-stone-400">
              <Coffee className="w-12 h-12 mx-auto mb-3 text-stone-400 opacity-50" />
              <p className="font-semibold text-base">Belum Ada Resep Terdaftar</p>
              <p className="text-xs mt-1">Resep untuk menu ini belum ditambahkan oleh Owner.</p>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-white dark:bg-[#181614] border-t border-stone-200 dark:border-stone-800 flex justify-between items-center gap-3">
          <button
            onClick={closeRecipeModal}
            className="px-5 py-2.5 rounded-2xl text-sm font-semibold border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          >
            Tutup
          </button>

          <button
            onClick={() => {
              addToCart(selectedRecipeProduct);
              closeRecipeModal();
            }}
            className="flex items-center gap-2 px-6 py-2.5 rounded-2xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] text-sm font-bold shadow-md transition-all active:scale-95"
          >
            <CheckCircle2 className="w-4 h-4 text-[#D4A373]" />
            Tambah ke Keranjang
          </button>
        </div>
      </div>
    </div>
  );
};
