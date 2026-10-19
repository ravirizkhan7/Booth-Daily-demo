import React, { useState, useEffect } from 'react';
import { usePOS } from '../../hooks/usePOS';
import { X, Lock, User, Key, Check, ShieldAlert, KeyRound, ChevronRight } from 'lucide-react';
import { DemoAccountsModal } from './DemoAccountsModal';

export const LoginModal: React.FC = () => {
  const { isLoginModalOpen, closeLoginModal, loginUser, settings } = usePOS();
  const [identifier, setIdentifier] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [showDemoAccountsModal, setShowDemoAccountsModal] = useState<boolean>(false);

  useEffect(() => {
    if (isLoginModalOpen) {
      setIdentifier('');
      setSecret('');
      setError('');
      setShowDemoAccountsModal(false);
    }
  }, [isLoginModalOpen]);

  if (!isLoginModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      setError('Username / Email wajib diisi');
      return;
    }
    setIsSubmitting(true);
    setError('');

    const res = await loginUser(identifier, secret);
    setIsSubmitting(false);

    if (!res.success) {
      setError(res.message);
    }
  };

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
        <div
          className="relative w-full max-w-md bg-white dark:bg-[#1E1C1A] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden transform transition-all duration-200"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-5 bg-[#3B2A1F] text-[#F7F5F2] flex items-center justify-between border-b border-stone-800">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#D4A373]/20 flex items-center justify-center border border-[#D4A373]/30">
                <Lock className="w-5 h-5 text-[#D4A373]" />
              </div>
              <div>
                <h2 className="text-base font-black tracking-wide">Login Ke Sistem POS</h2>
                <p className="text-xs text-[#D4A373]/80 font-medium">
                  {settings?.store_name?.trim() || 'Booth Daily'} Management
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={closeLoginModal}
              aria-label="Tutup modal login"
              className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-4">
            {error && (
              <div className="flex items-center gap-2 p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-2xl text-rose-700 dark:text-rose-300 text-xs font-semibold animate-shake">
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Akun Demo Entry Point */}
            <button
              type="button"
              onClick={() => setShowDemoAccountsModal(true)}
              className="w-full p-3 rounded-2xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-left transition-all flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-xl bg-[#3B2A1F] text-[#D4A373] dark:bg-[#D4A373] dark:text-[#1E1C1A] flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                  <KeyRound className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-stone-900 dark:text-stone-100">
                      Akun Demo
                    </span>
                    <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-800 dark:text-amber-300">
                      INFO
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-500 dark:text-stone-400 font-medium truncate">
                    Gunakan credential berikut untuk mencoba sistem.
                  </p>
                </div>
              </div>
              <ChevronRight className="w-4 h-4 text-stone-400 group-hover:text-stone-700 dark:group-hover:text-stone-200 transition-colors shrink-0 ml-2" />
            </button>

            <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#3B2A1F] dark:text-[#D4A373]" />
                  Email / Username
                </label>
                <input
                  type="text"
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="Contoh: owner@boothdaily.com / hendro"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-[#151312] border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3B2A1F] dark:focus:ring-[#D4A373]"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-stone-700 dark:text-stone-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-[#3B2A1F] dark:text-[#D4A373]" />
                  Password
                </label>
                <input
                  type="password"
                  value={secret}
                  onChange={e => setSecret(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full px-3.5 py-2.5 rounded-2xl bg-stone-50 dark:bg-[#151312] border border-stone-200 dark:border-stone-800 text-stone-900 dark:text-stone-100 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3B2A1F] dark:focus:ring-[#D4A373]"
                />
              </div>

              <div className="pt-2 flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeLoginModal}
                  className="flex-1 py-3 rounded-2xl border border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold transition-all cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-3 rounded-2xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <span>Memproses...</span>
                  ) : (
                    <>
                      <Check className="w-4 h-4 text-[#D4A373]" />
                      <span>Masuk</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Demo Accounts Information Modal */}
      <DemoAccountsModal
        isOpen={showDemoAccountsModal}
        onClose={() => setShowDemoAccountsModal(false)}
      />
    </>
  );
};
