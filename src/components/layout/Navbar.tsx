import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, Edit3, Lock, LogIn, LogOut, Menu, X, ChevronDown, Sparkles, DoorOpen, Clock, ShieldAlert } from 'lucide-react';
import { usePOS } from '../../hooks/usePOS';
import { BrandLogo } from '../common/BrandLogo';

interface NavbarProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
}

export const Navbar: React.FC<NavbarProps> = ({ isMobileMenuOpen, setIsMobileMenuOpen }) => {
  const navigate = useNavigate();
  const {
    currentUser,
    openLoginModal,
    openEditAccountModal,
    openLogoutModal,
    showToast,
    isShiftActive,
    activeShift,
    openOpenShiftModal,
    openCloseShiftModal,
    shifts,
  } = usePOS();
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isGuest = !currentUser;

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsUserDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="shrink-0 bg-white dark:bg-[#1A1816] border-b border-stone-200/80 dark:border-stone-800/80 px-4 py-3 flex items-center justify-between z-40 relative shadow-sm">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label={isMobileMenuOpen ? 'Tutup menu navigasi' : 'Buka menu navigasi'}
          className="lg:hidden p-2 -ml-2 text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-xl cursor-pointer transition-colors"
        >
          {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
        <BrandLogo size="sm" />
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        {/* Shift Status Indicator & Action */}
        {isShiftActive && activeShift ? (
          <button
            type="button"
            onClick={openCloseShiftModal}
            title={`Shift #${activeShift.shift_number} aktif (${activeShift.opened_by_name}). Klik untuk tutup shift.`}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-800 dark:text-emerald-300 text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer"
          >
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="hidden sm:inline">Shift #{activeShift.shift_number} Aktif</span>
            <span className="sm:hidden">Shift Aktif</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={openOpenShiftModal}
            title="Shift belum dibuka. Klik untuk buka shift."
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer"
          >
            <DoorOpen className="w-3 h-3 text-amber-600 dark:text-amber-400" />
            <span>Buka Shift</span>
          </button>
        )}

        {/* Koreksi Shift Indicator */}
        {shifts.some(s => s.status === 'closed' && s.reconciliation_status === 'correction_requested') && (
          <button
            type="button"
            onClick={() => navigate('/shifts')}
            title="Terdapat shift yang perlu dikoreksi. Klik untuk buka halaman shift."
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-700 dark:text-rose-300 text-[10px] font-extrabold uppercase tracking-wider transition-all cursor-pointer animate-pulse"
          >
            <ShieldAlert className="w-3 h-3 text-rose-600 dark:text-rose-400" />
            <span className="hidden sm:inline">Perlu Koreksi</span>
          </button>
        )}

        {/* Demo Indicator Badge */}
        <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-300 text-[10px] font-extrabold uppercase tracking-wider">
          <Sparkles className="w-3 h-3 text-amber-600 dark:text-amber-400" />
          <span>Demo Showcase</span>
        </div>

        {/* User Dropdown Profile Menu */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
            aria-label="Menu profil pengguna"
            className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full border border-stone-200 dark:border-stone-800 hover:bg-stone-50 dark:hover:bg-[#25221F] transition-all cursor-pointer"
          >
            <div
              className={`w-8 h-8 rounded-full overflow-hidden flex items-center justify-center shrink-0 shadow-sm ${
                isGuest
                  ? 'bg-stone-200 dark:bg-stone-800 text-stone-500'
                  : currentUser?.role === 'owner'
                  ? 'bg-[#3B2A1F] text-[#D4A373]'
                  : 'bg-[#D4A373] text-[#3B2A1F]'
              }`}
            >
              {currentUser?.avatar ? (
                <img
                  src={currentUser.avatar}
                  alt={currentUser.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-4 h-4" />
              )}
            </div>
            <div className="text-left hidden sm:block max-w-[120px]">
              <p className="text-xs font-black text-stone-900 dark:text-[#F7F5F2] truncate">
                {isGuest ? 'Guest' : currentUser?.name}
              </p>
              <p className="text-[10px] font-bold text-stone-500 dark:text-stone-400 uppercase tracking-wider truncate">
                {isGuest
                  ? 'Akses Terbatas'
                  : currentUser?.role === 'owner'
                  ? 'Owner Booth'
                  : 'Karyawan'}
              </p>
            </div>
            <ChevronDown
              className={`w-4 h-4 text-stone-400 transition-transform ${
                isUserDropdownOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {isUserDropdownOpen && (
            <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-[#1A1816] rounded-2xl shadow-xl border border-stone-200 dark:border-stone-800/80 p-2 z-50 animate-in slide-in-from-top-2 fade-in duration-150">
              <div className="px-3 py-2 border-b border-stone-100 dark:border-stone-800/80 mb-1">
                <p className="text-xs font-black text-stone-900 dark:text-stone-100 truncate mt-0.5">
                  <User className="w-4 h-4 mr-2 inline" />{' '}
                  {currentUser ? currentUser.name : 'Guest'}
                </p>
                {currentUser && (
                  <p className="text-[10px] font-bold text-[#D4A373] uppercase tracking-wider">
                    {currentUser.role === 'owner' ? 'Owner Booth' : 'Karyawan'}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                {isGuest ? (
                  <button
                    type="button"
                    disabled
                    onClick={() => {
                      showToast('Login terlebih dahulu untuk mengedit akun', 'info');
                      setIsUserDropdownOpen(false);
                    }}
                    className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-semibold text-stone-400 dark:text-stone-600 cursor-not-allowed opacity-60 bg-stone-50 dark:bg-stone-900/40 select-none"
                  >
                    <div className="flex items-center gap-2.5">
                      <Edit3 className="w-4 h-4 text-stone-400 dark:text-stone-600" />
                      <span>Edit Akun</span>
                    </div>
                    <Lock className="w-3.5 h-3.5 text-stone-400 dark:text-stone-600" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserDropdownOpen(false);
                      openEditAccountModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-stone-800 dark:text-stone-200 hover:bg-stone-100 dark:hover:bg-[#2A2623] hover:text-[#3B2A1F] dark:hover:text-[#D4A373] transition-colors cursor-pointer text-left"
                  >
                    <Edit3 className="w-4 h-4 text-[#3B2A1F] dark:text-[#D4A373]" />
                    <span>Edit Akun</span>
                  </button>
                )}
                {isGuest ? (
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserDropdownOpen(false);
                      openLoginModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-[#3B2A1F] dark:text-[#D4A373] hover:bg-[#3B2A1F] hover:text-white dark:hover:bg-[#3B2A1F] dark:hover:text-[#F7F5F2] transition-colors cursor-pointer text-left"
                  >
                    <LogIn className="w-4 h-4 text-[#D4A373]" />
                    <span>Login</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setIsUserDropdownOpen(false);
                      openLogoutModal();
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer text-left"
                  >
                    <LogOut className="w-4 h-4 text-rose-500" />
                    <span>Logout</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
