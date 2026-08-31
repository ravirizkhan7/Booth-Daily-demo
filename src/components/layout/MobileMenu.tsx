import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Printer, X } from 'lucide-react';
import { printTestReceipt } from '../../services/receiptPrint';
import { BrandLogo } from '../common/BrandLogo';

interface NavItem {
  label: string;
  path: string;
  icon: React.ElementType;
  roles: string[];
}

interface MobileMenuProps {
  isMobileMenuOpen: boolean;
  setIsMobileMenuOpen: (isOpen: boolean) => void;
  filteredNavItems: NavItem[];
  handleNavClick: (item: NavItem, e: React.MouseEvent) => void;
}

export const MobileMenu: React.FC<MobileMenuProps> = ({
  isMobileMenuOpen,
  setIsMobileMenuOpen,
  filteredNavItems,
  handleNavClick,
}) => {
  const location = useLocation();

  if (!isMobileMenuOpen) return null;

  const handleTestPrint = () => {
    printTestReceipt({ store_name: 'Booth Daily Test', address: 'Testing Address', phone: '0000' });
    setIsMobileMenuOpen(false);
  };

  return (
    <div className="fixed inset-0 z-50 lg:hidden flex">
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => setIsMobileMenuOpen(false)}
      />
      <div className="relative w-72 bg-white dark:bg-[#1A1816] h-full flex flex-col justify-between z-10 shadow-2xl">
        {/* Header */}
        <div className="p-5 flex justify-between items-center border-b border-stone-200 dark:border-stone-800 shrink-0">
          <BrandLogo size="sm" />
          <button onClick={() => setIsMobileMenuOpen(false)} className="p-2 text-stone-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        {/* Scrollable Navigation */}
        <div className="flex-1 overflow-y-auto p-5">
          <nav className="space-y-1">
            {filteredNavItems.map(item => {
              const isActive = location.pathname === item.path;
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={e => {
                    setIsMobileMenuOpen(false);
                    handleNavClick(item, e);
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all ${
                    isActive
                      ? 'bg-[#3B2A1F] text-[#F7F5F2]'
                      : 'text-stone-700 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800'
                  }`}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-[#D4A373]' : 'text-stone-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer */}
        <div className="p-5 border-t border-stone-200 dark:border-stone-800 space-y-4 shrink-0 bg-stone-50/50 dark:bg-[#1A1816]">
          <button
            onClick={handleTestPrint}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-stone-100 dark:bg-[#25221F] hover:bg-stone-200 dark:hover:bg-[#2F2B27] text-stone-700 dark:text-stone-300 rounded-xl text-sm font-bold transition-colors"
          >
            <Printer className="w-4 h-4" />
            <span>Test Printer</span>
          </button>
          
          <div className="pt-2 text-center">
            <p className="text-xs font-bold text-stone-400">BOOTH DAILY POS</p>
          </div>
        </div>
      </div>
    </div>
  );
};
