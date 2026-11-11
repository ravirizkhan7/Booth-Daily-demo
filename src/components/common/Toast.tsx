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
        role="status"
        aria-live="polite"
        className="pointer-events-auto w-full sm:w-auto p-1.5 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 shadow-xl transition-all duration-200 animate-slide-down"
      >
        <div className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl text-sm font-medium shadow-sm ${bgColors[toast.type]}`}>
          <div className="shrink-0">
            {icons[toast.type]}
          </div>
          <span className="break-words min-w-0">{toast.message}</span>
        </div>
      </div>

    </div>
  );
};
