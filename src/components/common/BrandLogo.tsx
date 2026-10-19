import React, { useState } from 'react';
import { Coffee } from 'lucide-react';
import { usePOS } from '../../hooks/usePOS';

interface BrandLogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({ size = 'md', showSubtitle = true, className = '' }) => {
  const { appLogo, settings } = usePOS();
  const [imageError, setImageError] = useState(false);

  // Reset error state if a new appLogo is uploaded
  React.useEffect(() => {
    setImageError(false);
  }, [appLogo]);

  const iconSizes = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-11 h-11'
  };

  const badgeSizes = {
    sm: 'w-8 h-8 p-1',
    md: 'w-10 h-10 p-1.5',
    lg: 'w-14 h-14 p-2'
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

  const storeName = settings?.store_name?.trim() ? settings.store_name.trim() : 'BOOTH DAILY';
  const isDefaultBoothDaily = storeName.toUpperCase() === 'BOOTH DAILY';

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Official Logo Container / Badge */}
      <div className={`relative flex items-center justify-center rounded-2xl bg-[#3B2A1F] text-[#F7F5F2] shadow-md border border-[#D4A373]/30 shrink-0 overflow-hidden ${badgeSizes[size]}`}>
        {appLogo && !imageError ? (
          <img
            src={appLogo}
            alt={storeName}
            onError={() => setImageError(true)}
            className="w-full h-full object-contain rounded-xl"
          />
        ) : (
          <Coffee className={`${iconSizes[size]} text-[#D4A373]`} />
        )}
        {/* Subtle decorative dot */}
        <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-[#10B981] pointer-events-none" />
      </div>

      <div className="flex flex-col">
        {isDefaultBoothDaily ? (
          <span className={`font-sans text-[#1F1F1F] dark:text-[#F7F5F2] uppercase ${titleSizes[size]}`}>
            BOOTH <span className="text-[#C68B59]">DAILY</span>
          </span>
        ) : (
          <span className={`font-sans text-[#1F1F1F] dark:text-[#F7F5F2] uppercase truncate max-w-[180px] sm:max-w-[240px] ${titleSizes[size]}`}>
            {storeName}
          </span>
        )}
        {showSubtitle && (
          <span className={`uppercase font-medium text-stone-500 dark:text-stone-400 ${subtitleSizes[size]}`}>
            {settings?.tagline || 'Coffee Booth POS'}
          </span>
        )}
      </div>
    </div>
  );
};
