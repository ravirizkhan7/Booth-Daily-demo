/**
 * SMART DEMO CONVERSION — PACKAGE SELECTION MODAL
 * Workspace: D:\project\Booth-Daily-demo
 */

import React, { useEffect, useRef, useState } from 'react';
import { useWatermark } from './WatermarkProvider';
import {
  CONVERSION_PACKAGES_LIST,
  PackageId,
  buildWhatsAppConversionUrl,
  PACKAGE_DISCLAIMER,
} from './watermark.packages';
import { WHATSAPP_CONFIG } from './watermark.config';
import { X, Check, MessageCircle, Star, Info } from 'lucide-react';

export const PackageSelectionModal: React.FC = () => {
  const {
    isPackageModalOpen,
    closePackageModal,
    selectedPackageId,
    selectPackage,
    recordWhatsAppClick,
  } = useWatermark();

  // Default ke 'business' jika belum ada yang terpilih
  const [activePackageId, setActivePackageId] = useState<PackageId>(
    selectedPackageId || 'business'
  );

  const modalRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (selectedPackageId) {
      setActivePackageId(selectedPackageId);
    }
  }, [selectedPackageId]);

  // Focus trap & Escape listener
  useEffect(() => {
    if (!isPackageModalOpen) return;

    const timer = setTimeout(() => {
      closeBtnRef.current?.focus();
    }, 50);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        closePackageModal();
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
  }, [isPackageModalOpen, closePackageModal]);

  if (!isPackageModalOpen) {
    return null;
  }

  const handleSelect = (id: PackageId) => {
    setActivePackageId(id);
    selectPackage(id);
  };

  const waUrl = buildWhatsAppConversionUrl(activePackageId);

  const handleWhatsAppClick = () => {
    recordWhatsAppClick();
  };

  return (
    <div
      data-smart-demo="package-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200 overflow-y-auto"
      onClick={closePackageModal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="package-modal-title"
    >
      <div
        ref={modalRef}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-3xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-3xl shadow-2xl overflow-hidden my-auto animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="relative p-5 sm:p-7 pb-4 bg-gradient-to-r from-amber-50 to-orange-50/50 dark:from-stone-800/90 dark:to-stone-900 border-b border-stone-200 dark:border-stone-800">
          <button
            ref={closeBtnRef}
            type="button"
            onClick={closePackageModal}
            aria-label="Tutup pemilihan paket"
            className="absolute top-4 right-4 w-11 h-11 flex items-center justify-center rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-white/80 dark:hover:bg-stone-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
          >
            <X className="w-5 h-5" />
          </button>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 mb-2">
            Paket Layanan
          </span>

          <h2
            id="package-modal-title"
            className="text-xl sm:text-2xl font-black text-stone-900 dark:text-stone-100"
          >
            Pilihan Paket Booth Daily
          </h2>

          <p className="mt-1 text-xs sm:text-sm text-stone-600 dark:text-stone-300">
            Pilih paket yang sesuai dengan kebutuhan booth usaha Anda.
          </p>
        </div>

        {/* Package Cards Grid */}
        <div className="p-4 sm:p-7 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 sm:gap-4">
            {CONVERSION_PACKAGES_LIST.map((pkg) => {
              const isSelected = activePackageId === pkg.id;
              return (
                <div
                  key={pkg.id}
                  onClick={() => handleSelect(pkg.id)}
                  className={`relative cursor-pointer rounded-2xl p-4 sm:p-5 border-2 transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'border-amber-500 dark:border-amber-400 bg-amber-50/40 dark:bg-amber-950/20 shadow-md shadow-amber-500/10'
                      : 'border-stone-200 dark:border-stone-800 bg-stone-50/50 dark:bg-stone-800/40 hover:border-stone-300 dark:hover:border-stone-700'
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === ' ' || e.key === 'Enter') {
                      e.preventDefault();
                      handleSelect(pkg.id);
                    }
                  }}
                  aria-pressed={isSelected}
                  aria-label={`Pilih paket ${pkg.name}`}
                >
                  {/* Badge */}
                  {pkg.badge && (
                    <div className="absolute -top-3 left-4">
                      <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-600 text-white shadow-xs">
                        {pkg.isPopular && <Star className="w-3 h-3 fill-current" />}
                        {pkg.badge}
                      </span>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between">
                      <h3 className="text-base font-bold text-stone-900 dark:text-stone-100">
                        {pkg.name}
                      </h3>
                      <div
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected
                            ? 'border-amber-600 bg-amber-600 text-white'
                            : 'border-stone-300 dark:border-stone-600'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                    </div>

                    <div className="mt-2 mb-3">
                      <span className="text-lg sm:text-xl font-black text-amber-700 dark:text-amber-400">
                        {pkg.priceLabel}
                      </span>
                    </div>

                    <p className="text-xs text-stone-600 dark:text-stone-400 mb-3 min-h-[32px]">
                      {pkg.description}
                    </p>

                    <div className="border-t border-stone-200/60 dark:border-stone-800/80 pt-3 space-y-2">
                      {pkg.features.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-stone-700 dark:text-stone-300">
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Disclaimer & Info */}
          <div className="flex items-start gap-2 p-3 rounded-xl bg-stone-100 dark:bg-stone-800/60 text-stone-600 dark:text-stone-400 text-xs">
            <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <p>{PACKAGE_DISCLAIMER}</p>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-7 pt-2 border-t border-stone-200 dark:border-stone-800 bg-stone-50 dark:bg-stone-900/60 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-stone-500 dark:text-stone-400 text-center sm:text-left">
            <span>Butuh info langsung? WhatsApp: </span>
            <span className="font-mono font-semibold text-stone-700 dark:text-stone-300">
              +{WHATSAPP_CONFIG.PHONE_NUMBER}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={closePackageModal}
              className="min-h-[44px] px-5 py-2.5 rounded-xl border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-300 font-semibold hover:bg-stone-200/60 dark:hover:bg-stone-800 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-stone-400 text-sm"
            >
              Tutup
            </button>

            {waUrl ? (
              <a
                href={waUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={handleWhatsAppClick}
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-all shadow-md shadow-emerald-600/20 flex items-center justify-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 text-sm"
              >
                <MessageCircle className="w-4 h-4" />
                Konsultasi via WhatsApp
              </a>
            ) : (
              <button
                type="button"
                disabled
                className="min-h-[44px] px-6 py-2.5 rounded-xl bg-stone-300 dark:bg-stone-800 text-stone-500 font-bold flex items-center justify-center gap-2 text-sm cursor-not-allowed"
              >
                Pilih Paket
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

