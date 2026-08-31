import React, { useState } from 'react';
import { initialUsers } from '../../mock/data/users';
import { usePOS } from '../../hooks/usePOS';
import { X, Copy, Check, KeyRound, ShieldCheck, User as UserIcon, Sparkles } from 'lucide-react';

interface DemoAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DemoAccountsModal: React.FC<DemoAccountsModalProps> = ({ isOpen, onClose }) => {
  const { showToast } = usePOS();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleCopy = (text: string, label: string, keyId: string) => {
    if (!text) return;
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(text);
      setCopiedKey(keyId);
      showToast(`${label} disalin ke clipboard`, 'info');
      setTimeout(() => {
        setCopiedKey(null);
      }, 2000);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-2 sm:p-4 bg-black/70 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-labelledby="demo-accounts-modal-title"
    >
      <div
        className="relative w-full max-w-lg max-h-[92vh] sm:max-h-[85vh] bg-white dark:bg-[#1C1A18] rounded-2xl sm:rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 overflow-hidden flex flex-col transform transition-all duration-200"
        onClick={e => e.stopPropagation()}
      >
        {/* Compact, Fixed Header */}
        <div className="px-4 py-3 sm:px-6 sm:py-4 bg-[#3B2A1F] text-[#F7F5F2] flex items-center justify-between border-b border-stone-800 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0 pr-2">
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-[#D4A373]/20 flex items-center justify-center border border-[#D4A373]/30 shrink-0">
              <KeyRound className="w-4 h-4 text-[#D4A373]" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h2 id="demo-accounts-modal-title" className="text-sm sm:text-base font-black tracking-wide">
                  Akun Demo
                </h2>
                <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded-full bg-[#D4A373] text-[#1E1C1A] tracking-wider inline-flex items-center gap-0.5">
                  <Sparkles className="w-2.5 h-2.5" />
                  Portfolio Demo
                </span>
              </div>
              <p className="text-[11px] sm:text-xs text-[#D4A373]/80 font-medium truncate">
                Gunakan salah satu credential berikut untuk mencoba sistem.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup modal akun demo"
            className="p-1.5 sm:p-2 rounded-lg sm:rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>

        {/* Scrollable Content (Optimized for mobile & desktop) */}
        <div className="p-3 sm:p-5 overflow-y-auto space-y-2.5 sm:space-y-3 flex-1 overscroll-contain">
          <div className="grid grid-cols-1 gap-2.5 sm:gap-3">
            {initialUsers.map(user => {
              const isOwner = user.role === 'owner';
              return (
                <div
                  key={user.id}
                  className={`p-3 sm:p-3.5 rounded-xl sm:rounded-2xl border transition-all ${
                    isOwner
                      ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30'
                      : 'bg-stone-50 dark:bg-[#151312] border-stone-200 dark:border-stone-800'
                  }`}
                >
                  {/* User Top Row */}
                  <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-stone-200 dark:border-stone-800/80">
                    <div className="flex items-center gap-2.5 min-w-0">
                      {user.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          className="w-8 h-8 sm:w-9 sm:h-9 rounded-full object-cover border border-stone-200 dark:border-stone-700 shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full bg-stone-200 dark:bg-stone-800 flex items-center justify-center text-stone-600 dark:text-stone-300 font-bold shrink-0">
                          <UserIcon className="w-4 h-4" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="text-xs sm:text-sm font-black text-stone-900 dark:text-stone-100 truncate">
                          {user.name}
                        </h3>
                        {user.username && (
                          <div className="flex items-center gap-1 text-[11px] text-stone-500 dark:text-stone-400">
                            <span className="truncate">@{user.username}</span>
                            <button
                              type="button"
                              onClick={() => handleCopy(user.username || '', 'Username', `${user.id}-username`)}
                              className="p-0.5 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors"
                              title="Salin username"
                              aria-label={`Salin username ${user.username}`}
                            >
                              {copiedKey === `${user.id}-username` ? (
                                <Check className="w-3 h-3 text-emerald-500" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full tracking-wider shrink-0 ${
                        isOwner
                          ? 'bg-[#3B2A1F] text-[#D4A373] dark:bg-[#D4A373] dark:text-[#1E1C1A]'
                          : 'bg-stone-200 dark:bg-stone-800 text-stone-700 dark:text-stone-300'
                      }`}
                    >
                      {isOwner ? '👑 Owner' : '☕ Karyawan'}
                    </span>
                  </div>

                  {/* Credentials Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2.5 text-xs">
                    {/* Email */}
                    <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-white dark:bg-[#1E1C1A] border border-stone-200 dark:border-stone-800 flex items-center justify-between">
                      <div className="min-w-0 pr-1.5">
                        <span className="block text-[9px] sm:text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                          Email
                        </span>
                        <span className="font-semibold text-stone-800 dark:text-stone-200 text-xs truncate block">
                          {user.email}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(user.email, 'Email', `${user.id}-email`)}
                        className="p-1 sm:p-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors shrink-0 cursor-pointer"
                        title="Salin email"
                        aria-label={`Salin email ${user.email}`}
                      >
                        {copiedKey === `${user.id}-email` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* Password */}
                    <div className="p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-white dark:bg-[#1E1C1A] border border-stone-200 dark:border-stone-800 flex items-center justify-between">
                      <div className="min-w-0 pr-1.5">
                        <span className="block text-[9px] sm:text-[10px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider">
                          Password
                        </span>
                        <span className="font-mono font-bold text-stone-800 dark:text-stone-200 text-xs">
                          {user.password || 'demo123'}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(user.password || 'demo123', 'Password', `${user.id}-password`)}
                        className="p-1 sm:p-1.5 rounded-md hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition-colors shrink-0 cursor-pointer"
                        title="Salin password"
                        aria-label={`Salin password ${user.name}`}
                      >
                        {copiedKey === `${user.id}-password` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-500" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>

                    {/* PIN Transaksi (Span full) */}
                    <div className="sm:col-span-2 p-2 sm:p-2.5 rounded-lg sm:rounded-xl bg-amber-500/10 dark:bg-amber-500/15 border border-amber-500/25 flex items-center justify-between">
                      <div className="min-w-0 pr-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="text-[9px] sm:text-[10px] font-extrabold text-amber-800 dark:text-amber-300 uppercase tracking-wider">
                            PIN Transaksi
                          </span>
                          <span className="text-[10px] font-mono font-black text-amber-900 dark:text-amber-200 bg-amber-500/20 px-1.5 py-0.5 rounded">
                            {user.pin}
                          </span>
                        </div>
                        <p className="text-[10px] text-stone-500 dark:text-stone-400 font-medium mt-0.5">
                          Digunakan saat melakukan checkout di POS.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopy(user.pin, 'PIN Transaksi', `${user.id}-pin`)}
                        className="p-1 sm:p-1.5 rounded-md hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 transition-colors shrink-0 cursor-pointer"
                        title="Salin PIN Transaksi"
                        aria-label={`Salin PIN ${user.name}`}
                      >
                        {copiedKey === `${user.id}-pin` ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Compact, Fixed Footer */}
        <div className="px-4 py-2.5 sm:px-6 sm:py-3 bg-stone-50 dark:bg-[#151312] border-t border-stone-200 dark:border-stone-800 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 text-[10px] sm:text-[11px] text-stone-500 dark:text-stone-400 min-w-0">
            <ShieldCheck className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400 shrink-0" />
            <span className="truncate">Credential hanya untuk demonstrasi.</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 sm:px-5 sm:py-2 rounded-xl sm:rounded-2xl bg-[#3B2A1F] hover:bg-[#2A1E16] text-[#F7F5F2] text-xs font-bold shadow-sm transition-all cursor-pointer shrink-0"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  );
};
