import React, { useState} from 'react';
import { useLocation } from 'react-router-dom';
import { usePOS } from '../hooks/usePOS';
import { RecipeModal } from '../components/common/RecipeModal';
import { PINModal } from '../components/common/PINModal';
import { ReceiptModal } from '../components/common/ReceiptModal';
import { LoginModal } from '../components/common/LoginModal';
import { EditAccountModal } from '../components/common/EditAccountModal';
import { LogoutConfirmModal } from '../components/common/LogoutConfirmModal';
import { Toast } from '../components/common/Toast';
import {
  ShoppingCart,
  LayoutDashboard,
  Coffee,
  ListFilter,
  BookOpen,
  Boxes,
  ShoppingBag,
  History,
  Users,
  BarChart3,
  Settings
} from 'lucide-react';

import { Navbar } from '../components/layout/Navbar';
import { Sidebar } from '../components/layout/Sidebar';
import { MobileMenu } from '../components/layout/MobileMenu';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { currentUser } = usePOS();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);

  const currentRole = currentUser ? currentUser.role : 'guest';

  // Navigation Items
  const navItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard, roles: ['owner', 'karyawan'] },
    { label: 'Kasir', path: '/', icon: ShoppingCart, roles: ['owner', 'karyawan', 'guest'] },
    { label: 'Produk', path: '/products', icon: Coffee, roles: ['owner'] },
    { label: 'Kategori', path: '/categories', icon: ListFilter, roles: ['owner'] },
    { label: 'Resep', path: '/recipes', icon: BookOpen, roles: ['owner', 'karyawan', 'guest'] },
    { label: 'Stock', path: '/inventory', icon: Boxes, roles: ['owner', 'karyawan'] },
    { label: 'Pembelian', path: '/purchases', icon: ShoppingBag, roles: ['owner'] },
    { label: 'Riwayat Transaksi', path: '/transactions', icon: History, roles: ['owner', 'karyawan'] },
    { label: 'Laporan', path: '/reports', icon: BarChart3, roles: ['owner'] },
    { label: 'Karyawan', path: '/employees', icon: Users, roles: ['owner'] },
    { label: 'Pengaturan', path: '/settings', icon: Settings, roles: ['owner'] }
  ];

  const canAccessPath = (roles: string[]) => {
    return roles.includes(currentRole);
  };

  const filteredNavItems = navItems.filter(item => canAccessPath(item.roles));

  const handleNavClick = (item: any, e: React.MouseEvent) => {
    if (item.path === location.pathname) {
      e.preventDefault();
    }
  };

  return (
    <div className="flex flex-col h-screen h-[100dvh] bg-[#FAFAFA] dark:bg-[#121110] text-[#1F1F1F] dark:text-[#F7F5F2] font-sans selection:bg-[#C68B59] selection:text-white overflow-hidden">

      {/* 1. Fixed Navbar */}
      <Navbar
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
      />

      {/* 2. Main Container for Sidebar and Content */}
      <div className="flex-1 flex overflow-hidden">

        {/* Desktop Sidebar (Fixed on the left) */}
        <Sidebar
          filteredNavItems={filteredNavItems}
          handleNavClick={handleNavClick}
        />

        {/* Mobile Sidebar/Menu */}
        <MobileMenu
          isMobileMenuOpen={isMobileMenuOpen}
          setIsMobileMenuOpen={setIsMobileMenuOpen}
          filteredNavItems={filteredNavItems}
          handleNavClick={handleNavClick}
        />

        {/* 3. Main Content Viewport (The ONLY scrolling area) */}
        <main className="flex-1 overflow-y-auto min-w-0 relative">
          {children}
        </main>

      </div>

      {/* Modals and Overlays */}
      <LoginModal />
      <EditAccountModal />
      <LogoutConfirmModal />
      <RecipeModal />
      <PINModal />
      <ReceiptModal />
      <Toast />
    </div>
  );
};
