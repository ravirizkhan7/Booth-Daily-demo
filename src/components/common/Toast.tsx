import React from 'react';
import { usePOS } from '../../hooks/usePOS';
import { CheckCircle2, AlertCircle, Info } from 'lucide-react';

export const Toast: React.FC = () => {
  const { toast } = usePOS();

  if (!toast) return null;

  const bgColors = {
    success: 'bg-[#10B981] text-white shadow-emerald-900/20',
    error: 'bg-[#EF4444] text-white shadow-rose-900/20',
    info: 'bg-[#3B2A1F] text-[#F7F5F2] shadow-stone-900/30 border border-[#D4A373]/30',
  };

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-white shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-white shrink-0" />,
    info: <Info className="w-5 h-5 text-[#D4A373] shrink-0" />,
  };

  return (
    <div className="fixed top-4 left-4 right-4 sm:left-auto sm:top-5 sm:right-5 sm:max-w-md z-[110] flex items-center justify-end pointer-events-none">
      <div
        className={`flex items-center gap-2.5 px-4 py-3 rounded-2xl shadow-2xl text-xs sm:text-sm font-semibold backdrop-blur-md animate-slide-down pointer-events-auto border border-white/10 ${bgColors[toast.type]}`}
        role="status"
        aria-live="polite"
      >
        {icons[toast.type]}
        <span className="break-words min-w-0">{toast.message}</span>
      </div>
    </div>
  );
};
