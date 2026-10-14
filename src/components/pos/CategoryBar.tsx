import React, { useRef, useState, useEffect, useCallback } from 'react';
import { usePOS } from '../../hooks/usePOS';
import {
  ListFilter, Plus, Edit2, Trash2, Search, X, Check,
  Coffee, CupSoda, GlassWater, Cookie, IceCream, Flame, Utensils, Sparkles,
  ChevronLeft, ChevronRight, Heart, LayoutGrid, Tag, PackageX
} from 'lucide-react';

export const CategoryBar: React.FC = () => {
  const { categories, selectedCategory, setSelectedCategory } = usePOS();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const [isOverflowing, setIsOverflowing] = useState(false);

  const updateScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const maxScroll = el.scrollWidth - el.clientWidth;
    const overflowing = maxScroll > 2;
    setIsOverflowing(overflowing);

    if (!overflowing) {
      setCanScrollLeft(false);
      setCanScrollRight(false);
    } else {
      setCanScrollLeft(el.scrollLeft > 2);
      setCanScrollRight(el.scrollLeft < maxScroll - 2);
    }
  }, []);

  const handleScrollStep = (direction: 'left' | 'right') => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const step = Math.max(180, Math.round(el.clientWidth * 0.6));
    el.scrollBy({
      left: direction === 'left' ? -step : step,
      behavior: 'smooth'
    });
  };

  useEffect(() => {
    updateScrollState();
    const el = scrollContainerRef.current;
    if (!el) return;

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => {
        updateScrollState();
      });
      ro.observe(el);
    }

    const handleResize = () => updateScrollState();
    window.addEventListener('resize', handleResize);

    return () => {
      if (ro) ro.disconnect();
      window.removeEventListener('resize', handleResize);
    };
  }, [categories, updateScrollState]);

  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      const maxScroll = el.scrollWidth - el.clientWidth;
      if (maxScroll <= 2) return;

      const isHorizontalWheel = Math.abs(e.deltaX) > Math.abs(e.deltaY);
      const delta = isHorizontalWheel ? e.deltaX : e.deltaY;
      if (delta === 0) return;

      const isAtStart = el.scrollLeft <= 0 && delta < 0;
      const isAtEnd = el.scrollLeft >= maxScroll - 1 && delta > 0;

      if (isAtStart || isAtEnd) {
        e.preventDefault();
        return;
      }

      e.preventDefault();
      el.scrollLeft += delta;
      updateScrollState();
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      el.removeEventListener('wheel', handleWheel);
    };
  }, [updateScrollState]);

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
    <div className="flex items-center gap-1.5 w-full">
      {/* Desktop Scroll Left Button */}
      {isOverflowing && (
        <button
          type="button"
          onClick={() => handleScrollStep('left')}
          disabled={!canScrollLeft}
          aria-label="Geser kategori ke kiri"
          title="Geser kategori ke kiri"
          className="hidden lg:flex w-7 h-7 shrink-0 items-center justify-center rounded-full bg-white dark:bg-[#1E1C1A] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 shadow-xs hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-20 disabled:pointer-events-none cursor-pointer mb-2 transition-opacity"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Horizontal Scrollable Categories Container */}
      <div
        ref={scrollContainerRef}
        onScroll={updateScrollState}
        className="flex-1 min-w-0 flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none select-none"
      >
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

      {/* Desktop Scroll Right Button */}
      {isOverflowing && (
        <button
          type="button"
          onClick={() => handleScrollStep('right')}
          disabled={!canScrollRight}
          aria-label="Geser kategori ke kanan"
          title="Geser kategori ke kanan"
          className="hidden lg:flex w-7 h-7 shrink-0 items-center justify-center rounded-full bg-white dark:bg-[#1E1C1A] text-stone-700 dark:text-stone-300 border border-stone-200 dark:border-stone-800 shadow-xs hover:bg-stone-50 dark:hover:bg-stone-800 disabled:opacity-20 disabled:pointer-events-none cursor-pointer mb-2 transition-opacity"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};