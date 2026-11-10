import React, { useEffect, useRef } from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
  children?: React.ReactNode;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmText = 'Hapus Data',
  cancelText = 'Batal',
  isDanger = true,
  onConfirm,
  onCancel,
  isLoading = false,
  children
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelBtnRef = useRef<HTMLButtonElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Capture triggering activeElement on open and return focus on close
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
      // Focus safe cancel button by default
      const timer = setTimeout(() => {
        cancelBtnRef.current?.focus();
      }, 50);
      return () => {
        clearTimeout(timer);
        if (triggerRef.current && typeof triggerRef.current.focus === 'function') {
          triggerRef.current.focus();
        }
      };
    }
  }, [isOpen]);

  // Focus trap and Escape handling (SAFE_TO_CLOSE policy)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (!isLoading) {
          e.preventDefault();
          onCancel();
        }
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        );
        if (focusables.length === 0) return;

        const first = focusables[0];
        const last = focusables[focusables.length - 1];

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isLoading, onCancel]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-message"
        className="relative w-full max-w-sm bg-white dark:bg-[#1E1C1A] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-6 text-center space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          disabled={isLoading}
          onClick={() => !isLoading && onCancel()}
          aria-label="Tutup dialog"
          className="absolute top-3 right-3 min-w-[44px] min-h-[44px] p-2.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors flex items-center justify-center cursor-pointer focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-stone-400 dark:focus-visible:ring-stone-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>

        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mx-auto ${
          isDanger
            ? 'bg-rose-100 dark:bg-rose-950/50 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-800'
            : 'bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800'
        }`}>
          <AlertTriangle className="w-6 h-6" aria-hidden="true" />
        </div>

        <div>
          <h3 id="confirm-dialog-title" className="text-base font-black text-stone-900 dark:text-stone-100">{title}</h3>
          <p id="confirm-dialog-message" className="text-xs font-medium text-stone-500 dark:text-stone-400 mt-1 leading-relaxed">
            {message}
          </p>
        </div>

        {children}

        <div className="flex items-center gap-2.5 pt-2">
          <button
            ref={cancelBtnRef}
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="flex-1 py-2.5 min-h-[40px] rounded-2xl border border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold transition-all focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-stone-400 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`flex-1 py-2.5 min-h-[40px] rounded-2xl text-white text-xs font-bold shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 focus-visible:outline-hidden focus-visible:ring-2 ${
              isDanger
                ? 'bg-rose-600 hover:bg-rose-700 focus-visible:ring-rose-500'
                : 'bg-[#3B2A1F] hover:bg-[#2A1E16] focus-visible:ring-[#D4A373]'
            }`}
          >
            {isDanger && <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />}
            <span>{isLoading ? 'Memproses...' : confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
