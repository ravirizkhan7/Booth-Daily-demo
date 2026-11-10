/**
 * SMART DEMO CONVERSION — CONVERSION NOTIFICATION (FLOATING PILL)
 * Workspace: D:\project\Booth-Daily-demo
 */

import React, { useEffect } from 'react';
import { useWatermark } from './WatermarkProvider';
import { COOLDOWN_DURATIONS } from './watermark.config';
import { Sparkles, X, ChevronRight } from 'lucide-react';

export const ConversionNotification: React.FC = () => {
  const {
    isNotificationVisible,
    dismissNotification,
    openConversionModalFromNotification,
  } = useWatermark();

  // Auto-hide setelah 8 detik
  useEffect(() => {
    if (!isNotificationVisible) return;

    const timer = setTimeout(() => {
      dismissNotification('auto_hide');
    }, COOLDOWN_DURATIONS.NOTIFICATION_AUTO_HIDE_MS);

    return () => clearTimeout(timer);
  }, [isNotificationVisible, dismissNotification]);

  if (!isNotificationVisible) {
    return null;
  }

  return (
    <div
      data-smart-demo="notification"
      className="fixed bottom-5 right-5 z-40 max-w-sm sm:max-w-md animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto"
      role="status"
      aria-live="polite"
    >
      <div className="bg-white dark:bg-stone-900 border border-amber-200 dark:border-stone-700 shadow-xl rounded-2xl p-3.5 flex items-center gap-3 backdrop-blur-md">
        {/* Icon Badge */}
        <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center shrink-0 text-amber-700 dark:text-amber-400">
          <Sparkles className="w-5 h-5" />
        </div>

        {/* Content Clickable Area */}
        <button
          type="button"
          onClick={openConversionModalFromNotification}
          className="flex-1 text-left group focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 rounded-lg p-1"
        >
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider">
              Smart Demo
            </span>
            <span className="inline-block w-1 h-1 rounded-full bg-amber-400" />
            <span className="text-xs text-stone-500 dark:text-stone-400 font-medium">
              Eksplorasi Aktif
            </span>
          </div>
          <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors flex items-center gap-1">
            Menyukai Booth Daily? Lihat pilihan paket
            <ChevronRight className="w-4 h-4 inline shrink-0 opacity-70 group-hover:translate-x-0.5 transition-transform" />
          </p>
        </button>

        {/* Close Button X (Touch Target >= 44x44px) */}
        <button
          type="button"
          onClick={() => dismissNotification('close_x')}
          aria-label="Tutup notifikasi penawaran"
          className="w-11 h-11 flex items-center justify-center shrink-0 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

