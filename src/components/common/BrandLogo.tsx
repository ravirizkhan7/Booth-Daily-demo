import React from 'react';
import { Coffee } from 'lucide-react';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 'md', showSubtitle = true, className = '' }) => {
  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-11 h-11'
  };

  const badgeSizes = {
    sm: 'w-8 h-8 p-1.5',
    md: 'w-10 h-10 p-2',
    lg: 'w-14 h-14 p-3'
  };

  const titleSizes = {
    sm: 'text-sm font-bold tracking-tight',
    md: 'text-lg font-extrabold tracking-tight',
    lg: 'text-2xl font-black tracking-tight'
  };

  const subtitleSizes = {
    sm: 'text-[9px] tracking-widest',
    md: 'text-[10px] tracking-widest',
    lg: 'text-xs tracking-widest'
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Official Logo Container / Badge */}
      <div className={`relative flex items-center justify-center rounded-2xl bg-[#3B2A1F] text-[#F7F5F2] shadow-md border border-[#D4A373]/30 shrink-0 ${badgeSizes[size]}`}>
        <Coffee className={`${iconSizes[size]} text-[#D4A373]`} />
        {/* Subtle decorative dot */}
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#10B981]" />
      </div>

      <div className="flex flex-col">
        <span className={`font-sans text-[#1F1F1F] dark:text-[#F7F5F2] uppercase ${titleSizes[size]}`}>
          BOOTH <span className="text-[#C68B59]">DAILY</span>
        </span>
        {showSubtitle && (
          <span className={`uppercase font-medium text-stone-500 dark:text-stone-400 ${subtitleSizes[size]}`}>
            Coffee Booth POS
          </span>
        )}
      </div>
    </div>
  );
};
