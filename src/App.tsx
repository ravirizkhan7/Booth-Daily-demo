import React, { ReactNode, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { POSProvider } from './context/POSContext';
import { usePOS } from './hooks/usePOS';
import { MainLayout } from './layouts/MainLayout';
import { POSPage } from './pages/POSPage';
import { UserRole } from './types';

// Lazy-loaded pages for code splitting (reduces initial bundle from ~1.44 MB)
const DashboardPage = React.lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const ProductsPage = React.lazy(() => import('./pages/ProductsPage').then(m => ({ default: m.ProductsPage })));
const CategoriesPage = React.lazy(() => import('./pages/CategoriesPage').then(m => ({ default: m.CategoriesPage })));
const RecipesPage = React.lazy(() => import('./pages/RecipesPage').then(m => ({ default: m.RecipesPage })));
const InventoryPage = React.lazy(() => import('./pages/InventoryPage').then(m => ({ default: m.InventoryPage })));
const PurchasesPage = React.lazy(() => import('./pages/PurchasesPage').then(m => ({ default: m.PurchasesPage })));
const TransactionsPage = React.lazy(() => import('./pages/TransactionsPage').then(m => ({ default: m.TransactionsPage })));
const EmployeesPage = React.lazy(() => import('./pages/EmployeesPage').then(m => ({ default: m.EmployeesPage })));
const ReportsPage = React.lazy(() => import('./pages/ReportsPage').then(m => ({ default: m.ReportsPage })));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));

// Minimal loading fallback for lazy pages
const PageLoader = () => (
  <div className="flex items-center justify-center h-screen">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-3 border-[#C68B59] border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-stone-500 font-medium">Memuat halaman...</p>
    </div>
  </div>
);

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles: UserRole[];
}

function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { currentUser, authReady } = usePOS();

  if (!authReady) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-gray-500">Memuat...</p>
      </div>
    );
  }

  if (!currentUser) return <Navigate to="/" replace />;
  if (!allowedRoles.includes(currentUser.role)) return <Navigate to="/" replace />;

  return <MainLayout>{children}</MainLayout>;
}

function PublicRoute({ children }: { children: ReactNode }) {
  return <MainLayout>{children}</MainLayout>;
}

export default function App() {
  return (
    <POSProvider>
      <Router>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Guest / Public */}
            <Route path="/" element={<PublicRoute><POSPage /></PublicRoute>} />
            <Route path="/recipes" element={<PublicRoute><RecipesPage /></PublicRoute>} />

            {/* Owner + Karyawan */}
            <Route path="/dashboard" element={<ProtectedRoute allowedRoles={['owner', 'karyawan']}><DashboardPage /></ProtectedRoute>} />
            <Route path="/inventory" element={<ProtectedRoute allowedRoles={['owner', 'karyawan']}><InventoryPage /></ProtectedRoute>} />
            <Route path="/transactions" element={<ProtectedRoute allowedRoles={['owner', 'karyawan']}><TransactionsPage /></ProtectedRoute>} />

            {/* Owner Only */}
            <Route path="/products" element={<ProtectedRoute allowedRoles={['owner']}><ProductsPage /></ProtectedRoute>} />
            <Route path="/categories" element={<ProtectedRoute allowedRoles={['owner']}><CategoriesPage /></ProtectedRoute>} />
            <Route path="/purchases" element={<ProtectedRoute allowedRoles={['owner']}><PurchasesPage /></ProtectedRoute>} />
            <Route path="/employees" element={<ProtectedRoute allowedRoles={['owner']}><EmployeesPage /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute allowedRoles={['owner']}><ReportsPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute allowedRoles={['owner']}><SettingsPage /></ProtectedRoute>} />

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </Router>
    </POSProvider>
  );
}
