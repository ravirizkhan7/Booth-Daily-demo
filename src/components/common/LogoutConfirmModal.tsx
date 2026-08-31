import React from 'react';
import { usePOS } from '../../hooks/usePOS';
import { LogOut, AlertTriangle, X } from 'lucide-react';

export const LogoutConfirmModal: React.FC = () => {
  const { isLogoutModalOpen, closeLogoutModal, logoutUser, currentUser } = usePOS();

  if (!isLogoutModalOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div 
        className="relative w-full max-w-sm bg-white dark:bg-[#1E1C1A] rounded-3xl shadow-2xl border border-stone-200 dark:border-stone-800 p-6 text-center space-y-5 transform transition-all duration-200"
        onClick={e => e.stopPropagation()}
      >
        <button 
          type="button"
          onClick={closeLogoutModal}
          className="absolute top-4 right-4 p-1.5 rounded-xl text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-14 h-14 rounded-2xl bg-amber-100 dark:bg-amber-950/50 text-amber-600 dark:text-amber-400 flex items-center justify-center mx-auto border border-amber-200 dark:border-amber-800">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <div>
          <h3 className="text-lg font-black text-stone-900 dark:text-stone-100">Konfirmasi Logout</h3>
          <p className="text-sm font-medium text-stone-500 dark:text-stone-400 mt-1">
            Apakah Anda yakin ingin logout dari akun <span className="font-bold text-stone-800 dark:text-stone-200">{currentUser?.name}</span>?
          </p>
          <p className="text-xs text-stone-400 mt-2">
            Anda akan kembali menggunakan mode Guest di Halaman Kasir.
          </p>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={closeLogoutModal}
            className="flex-1 py-3 rounded-2xl border border-stone-200 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 text-stone-700 dark:text-stone-300 text-xs font-bold transition-all"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={logoutUser}
            className="flex-1 py-3 rounded-2xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Ya, Logout</span>
          </button>
        </div>
      </div>
    </div>
  );
};
