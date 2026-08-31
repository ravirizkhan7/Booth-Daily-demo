import React from 'react';
import { usePOS } from '../../hooks/usePOS';
import {
  ListFilter, Plus, Edit2, Trash2, Search, X, Check,
  Coffee, CupSoda, GlassWater, Cookie, IceCream, Flame, Utensils, Sparkles,
  ChevronLeft, ChevronRight, Heart, LayoutGrid, Tag, PackageX
} from 'lucide-react';

export const CategoryBar: React.FC = () => {
  const { categories, selectedCategory, setSelectedCategory } = usePOS();

  const getCategoryIcon = (iconName: string) => {
    switch (iconName.toLowerCase()) {
      case 'coffee':
        return <Coffee className="w-4 h-4" />;

      case 'listFilter':
        return <ListFilter className="w-4 h-4" />;

      case 'plus':
        return <Plus className="w-4 h-4" />;

      case 'edit2':
        return <Edit2 className="w-4 h-4" />;

      case 'trash2':
        return <Trash2 className="w-4 h-4" />;

      case 'search':
        return <Search className="w-4 h-4" />;

      case 'x':
        return <X className="w-4 h-4" />;

      case 'check':
        return <Check className="w-4 h-4" />;

      case 'flame':
        return <Flame className="w-4 h-4" />;

      case 'utensils':
        return <Utensils className="w-4 h-4" />;

      case 'sparkles':
        return <Sparkles className="w-4 h-4" />;

      case 'chevronleft':
        return <ChevronLeft className="w-4 h-4" />;

      case 'chevronright':
        return <ChevronRight className="w-4 h-4" />;

      case 'cupsoda':
        return <CupSoda className="w-4 h-4" />;

      case 'glasswater':
        return <GlassWater className="w-4 h-4" />;

      case 'cookie':
        return <Cookie className="w-4 h-4" />;

      case 'icecream':
        return <IceCream className="w-4 h-4" />;

      case 'heart':
        return <Heart className="w-4 h-4" />;

      case 'layoutgrid':
        return <LayoutGrid className="w-4 h-4" />;

      case 'tag':
      default:
        return <Tag className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none select-none">
      <button
        onClick={() => setSelectedCategory('cat-all')}
        className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 shrink-0 ${selectedCategory === 'cat-all'
          ? 'bg-[#3B2A1F] text-white shadow-sm'
          : 'bg-white dark:bg-[#1E1C1A] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
          }`}
      >
        <span
          className={
            selectedCategory === 'cat-all'
              ? 'text-[#D4A373]'
              : 'text-stone-500 dark:text-stone-400'
          }
        >
          <LayoutGrid className="w-4 h-4" />
        </span>

        <span>Semua</span>
      </button>

      {categories.map(cat => {
        const isSelected = selectedCategory === cat.id;

        return (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 shrink-0 ${isSelected
              ? 'bg-[#3B2A1F] text-white shadow-sm'
              : 'bg-white dark:bg-[#1E1C1A] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-stone-800'
              }`}
          >
            <span
              className={
                isSelected
                  ? 'text-[#D4A373]'
                  : 'text-stone-500 dark:text-stone-400'
              }
            >
              {getCategoryIcon(cat.icon_name)}
            </span>

            <span>{cat.name}</span>
          </button>
        );
      })}

      <button
        onClick={() =>
          setSelectedCategory(
            selectedCategory === 'cat-favorites'
              ? 'cat-all'
              : 'cat-favorites'
          )
        }
        className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 shrink-0 ${selectedCategory === 'cat-favorites'
          ? 'bg-rose-600 text-white shadow-sm'
          : 'bg-white dark:bg-[#1E1C1A] text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 hover:bg-rose-50 dark:hover:bg-rose-950/30'
          }`}
      >
        <Heart className="w-4 h-4 fill-current" />
        <span>Favorit</span>
      </button>

      <button
        onClick={() =>
          setSelectedCategory(
            selectedCategory === 'cat-out-of-stock'
              ? 'cat-all'
              : 'cat-out-of-stock'
          )
        }
        className={`flex items-center gap-2 px-5 py-2 rounded-full text-xs sm:text-sm font-medium whitespace-nowrap transition-all duration-150 shrink-0 ${selectedCategory === 'cat-out-of-stock'
          ? 'bg-amber-600 text-white shadow-sm'
          : 'bg-white dark:bg-[#1E1C1A] text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-900/50 hover:bg-amber-50 dark:hover:bg-amber-950/30'
          }`}
      >
        <PackageX className="w-4 h-4" />
        <span>Habis</span>
      </button>
    </div>
  );
};