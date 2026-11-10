/**
 * SMART DEMO CONVERSION — CONVERSION MODAL
 * Workspace: D:\project\Booth-Daily-demo
 */

import React, { useEffect, useRef } from 'react';
import { useWatermark } from './WatermarkProvider';
import { PACKAGE_DISCLAIMER } from './watermark.packages';
import { Sparkles, ArrowRight, X, CheckCircle2, Store } from 'lucide-react';

export const ConversionModal: React.FC = () => {
  const {
    tier,
    isConversionModalOpen,
    dismissConversionModal,
    openPackageModal,
  } = useWatermark();

  const modalRef = useRef<HTMLDivElement>(null);
  const primaryBtnRef = useRef<HTMLButtonElement>(null);

  // Focus trap & Escape listener
  useEffect(() => {
    if (!isConversionModalOpen) return;

    // Focus awal pada tombol utama
    const timer = setTimeout(() => {
      primaryBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dismissConversionModal('escape');
        return;
      }

      if (e.key === 'Tab' && modalRef.current) {
        const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusableElements.length === 0) return;

        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey) {
          if (document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
          }
        } else {
          if (document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isConversionModalOpen, dismissConversionModal]);

  if (!isConversionModalOpen) {
    return null;
  }

  const isIntensive = tier === 'INTENSIVE';

  return (
    <div
      data-smart-demo="modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={() => dismissConversionModal('backdrop')}
      role="dialog"
      aria-modal="true"
      aria-labelledby="conversion-modal-title"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
      >
        {/* Modal Header */}
        <div className="relative p-6 sm:p-7 bg-gradient-to-br from-amber-50 to-orange-50/40 dark:from-stone-800/80 dark:to-stone-900 border-b border-stone-200 dark:border-stone-800">
          {/* Close Button X (Touch Target >= 44x44px) */}
          <button
            type="button"
            onClick={() => dismissConversionModal('close_x')}
            aria-label="Tutup dialog penawaran"
            className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-white/80 dark:hover:bg-stone-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md shadow-amber-500/20 mb-4">
            {isIntensive ? <Store className="w-6 h-6" /> : <Sparkles className="w-6 h-6" />}
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 mb-2">
            {isIntensive ? 'Aktivitas Mendalam' : 'Eksplorasi Aktif'}
          </span>

          <h2
            id="conversion-modal-title"
            className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100"
          >
            {isIntensive
              ? 'Siap Mengembangkan Usaha Anda?'
              : 'Tingkatkan Operasional Usaha Anda'}
          </h2>

          <p className="mt-2 text-sm text-stone-600 dark:text-stone-300 leading-relaxed">
            {isIntensive
              ? 'Anda sangat aktif mencoba manajemen transaksi, stok, dan pembukuan di Booth Daily. Dapatkan sistem lengkap untuk bisnis nyata Anda!'
              : 'Anda telah mengeksplorasi berbagai fitur POS Booth Daily. Saatnya gunakan sistem kasir mandiri yang rapi untuk booth harian Anda.'}
          </p>
        </div>

        {/* Modal Body / Highlights */}
        <div className="p-6 sm:p-7 space-y-4">
          <p className="text-xs font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
            Keuntungan Sistem Booth Daily
          </p>

          <ul className="space-y-3">
            <li className="flex items-start gap-3 text-sm text-stone-700 dark:text-stone-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>Pencatatan kasir cepat, offline-ready, dan cetak struk Bluetooth.</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-stone-700 dark:text-stone-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>Kontrol stok bahan baku, opname, dan peringatan batas minimum stok.</span>
            </li>
            <li className="flex items-start gap-3 text-sm text-stone-700 dark:text-stone-200">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>Buka/tutup shift kasir transparan dengan rekonsiliasi kas laci & QRIS.</span>
            </li>
          </ul>

          <div className="pt-2 text-xs text-stone-500 dark:text-stone-400 italic">
            *{PACKAGE_DISCLAIMER}
          </div>
        </div>

        {/* Modal Footer Actions */}
        <div className="p-6 sm:p-7 pt-0 flex flex-col-reverse sm:flex-row gap-3 items-center justify-end">
          <button
            type="button"
            onClick={() => dismissConversionModal('later_button')}
            className="w-full sm:w-auto min-h-[44px] px-5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-semibold hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 text-sm"
          >
            Nanti Saja
          </button>

          <button
            ref={primaryBtnRef}
            type="button"
            onClick={openPackageModal}
            className="w-full sm:w-auto min-h-[44px] px-6 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600 text-white font-bold transition-all shadow-md shadow-amber-600/20 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 text-sm"
          >
            Lihat Pilihan Paket
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

