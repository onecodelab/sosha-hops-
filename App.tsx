import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { BranchProvider } from './contexts/BranchContext';
import { ToastContainer } from './components/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';

// Marketing Pages
import Landing from './pages/Landing';
import BookDemo from './pages/Pricing';
import PricingPage from './pages/PricingPage';
import Features from './pages/Features';
import CustomerChatPage from './pages/CustomerChatPage';

// Auth Pages
import Login from './pages/Login';
import SignUp from './pages/SignUp';
import Onboarding from './pages/Onboarding';

// App Dispatcher
import AppDispatcher from './pages/AppDispatcher';

// Protected App Pages
import AdminDashboard from './pages/AdminDashboard';
import MenuAnalytics from './pages/MenuAnalytics';
import MenuManagement from './pages/MenuManagement';
import Inventory from './pages/Inventory';
import StaffPerformance from './pages/StaffPerformance';
import AdminStaffPerformance from './pages/AdminStaffPerformance';
import AdminTableMap from './pages/AdminTableMap';
import AdminFloorAnalytics from './pages/AdminFloorAnalytics';
import TableStatus from './pages/TableStatus';
import OrdersTables from './pages/OrdersTables';
import ManagerDashboard from './pages/ManagerDashboard';
import WaiterDashboard from './pages/WaiterDashboard';
import WaiterOrders from './pages/WaiterOrders';
import KitchenDashboard from './pages/KitchenDashboard';
import KitchenLogWaste from './pages/KitchenLogWaste';
import ManagerWasteHistory from './pages/ManagerWasteHistory';
import KitchenStockView from './pages/KitchenStockView';
import KitchenRestockRequests from './pages/KitchenRestockRequests';
import ManagerPendingRequests from './pages/ManagerPendingRequests';
import ManagerPurchaseOrders from './pages/ManagerPurchaseOrders';
import Settings from './pages/Settings';
import OwnerCommandCenter from './pages/OwnerCommandCenter';
import WaiterTips from './pages/WaiterTips';
import AdminTipsAudit from './pages/AdminTipsAudit';
import BaroAdminDashboard from './pages/BaroAdminDashboard';
import SupplierDashboard from './pages/SupplierDashboard';
import DriverDashboard from './pages/DriverDashboard';

import { ChatWidget } from './components/ChatWidget';
import ProtectedRoute from './components/ProtectedRoute';
import { BrandLoader } from './components/BrandLoader';
import ScrollToTop from './components/ScrollToTop';
import { DashboardLayout } from './components/DashboardLayout';
import { LayoutProvider, useLayoutConfig } from './contexts/LayoutContext';

interface AppWrapperProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string | React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  fullScreen?: boolean;
}

const DashboardLayoutWrapper: React.FC = () => {
  return (
    <DashboardLayout>
      <Outlet />
    </DashboardLayout>
  );
};

// Custom wrapper for pages that need special layout props like OwnerCommandCenter
const CustomAppWrapper: React.FC<AppWrapperProps> = ({ children, ...props }) => {
  useLayoutConfig(props);
  return <>{children}</>;
};

const App: React.FC = () => {
  useEffect(() => {
    const savedTheme = localStorage.getItem('baro-theme');
    if (savedTheme === 'fresh') {
      document.body.setAttribute('data-theme', 'fresh');
    } else {
      document.body.removeAttribute('data-theme');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <BrowserRouter>
          <ScrollToTop />
          <AuthProvider>
            <BranchProvider>
              <LayoutProvider>
                <Routes>
                  {/* Public Marketing Layer */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/book-demo" element={<BookDemo />} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/features" element={<Features />} />
                  <Route path="/order-chat/:tableId" element={<CustomerChatPage />} />

                  {/* Auth Layer */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/login/:role" element={<Login />} />
                  <Route path="/signup" element={<SignUp />} />
                  <Route path="/onboarding" element={<Onboarding />} />

                  {/* Protected App Layer */}
                  <Route path="/app" element={<DashboardLayoutWrapper />}>
                    <Route index element={<ProtectedRoute><AppDispatcher /></ProtectedRoute>} />

                    <Route path="admin" element={
                      <ProtectedRoute allowedRoles={['owner', 'admin' as any, 'manager']}>
                        <AdminDashboard />
                      </ProtectedRoute>
                    } />

                    <Route path="admin/menu" element={
                      <ProtectedRoute allowedRoles={['owner', 'admin' as any, 'manager']}>
                        <MenuManagement />
                      </ProtectedRoute>
                    } />

                    <Route path="tables" element={
                      <ProtectedRoute allowedRoles={['owner', 'admin' as any, 'manager', 'waiter']}>
                        <TableStatus />
                      </ProtectedRoute>
                    } />

                    <Route path="menu-analytics" element={
                      <ProtectedRoute allowedRoles={['owner', 'admin' as any]}>
                        <MenuAnalytics />
                      </ProtectedRoute>
                    } />

                    <Route path="inventory" element={
                      <ProtectedRoute allowedRoles={['owner', 'manager', 'admin' as any]}>
                        <Inventory />
                      </ProtectedRoute>
                    } />

                    <Route path="admin/staff-performance" element={<ProtectedRoute allowedRoles={['owner', 'admin']}><AdminStaffPerformance /></ProtectedRoute>} />
                    <Route path="admin/waste" element={<ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}><ManagerWasteHistory /></ProtectedRoute>} />
                    <Route path="admin/table-map" element={
                      <ProtectedRoute allowedRoles={['owner', 'admin' as any]}>
                        <AdminTableMap />
                      </ProtectedRoute>
                    } />

                    <Route path="staff-performance" element={
                      <ProtectedRoute allowedRoles={['owner', 'manager', 'admin' as any]}>
                        <StaffPerformance />
                      </ProtectedRoute>
                    } />

                    <Route path="orders-tables" element={
                      <ProtectedRoute allowedRoles={['owner', 'manager', 'admin' as any]}>
                        <OrdersTables />
                      </ProtectedRoute>
                    } />

                    <Route path="manager" element={
                      <ProtectedRoute allowedRoles={['manager', 'owner']}>
                        <ManagerDashboard />
                      </ProtectedRoute>
                    } />

                    <Route path="manager/pending-requests" element={
                      <ProtectedRoute allowedRoles={['manager', 'owner']}>
                        <ManagerPendingRequests />
                      </ProtectedRoute>
                    } />

                    <Route path="po/list" element={
                      <ProtectedRoute allowedRoles={['manager', 'owner']}>
                        <ManagerPurchaseOrders />
                      </ProtectedRoute>
                    } />

                    <Route path="waiter" element={
                      <ProtectedRoute allowedRoles={['waiter']}>
                        <WaiterDashboard />
                      </ProtectedRoute>
                    } />

                    <Route path="waiter/orders" element={
                      <ProtectedRoute allowedRoles={['waiter']}>
                        <WaiterOrders />
                      </ProtectedRoute>
                    } />

                    <Route path="waiter/tips" element={
                      <ProtectedRoute allowedRoles={['waiter']}>
                        <WaiterTips />
                      </ProtectedRoute>
                    } />

                    <Route path="kitchen" element={
                      <ProtectedRoute allowedRoles={['kitchen', 'manager', 'owner']}>
                        <KitchenDashboard />
                      </ProtectedRoute>
                    } />

                    <Route path="kitchen/stock" element={
                      <ProtectedRoute allowedRoles={['kitchen', 'manager', 'owner']}>
                        <KitchenStockView />
                      </ProtectedRoute>
                    } />

                    <Route path="kitchen/waste" element={
                      <ProtectedRoute allowedRoles={['kitchen', 'manager', 'owner']}>
                        <KitchenLogWaste />
                      </ProtectedRoute>
                    } />

                    <Route path="kitchen/restock" element={
                      <ProtectedRoute allowedRoles={['kitchen', 'manager', 'owner']}>
                        <KitchenRestockRequests />
                      </ProtectedRoute>
                    } />

                    <Route path="admin/analytics" element={
                      <ProtectedRoute allowedRoles={['owner', 'admin' as any]}>
                        <AdminFloorAnalytics />
                      </ProtectedRoute>
                    } />

                    <Route path="admin/tips" element={
                      <ProtectedRoute allowedRoles={['owner', 'admin' as any]}>
                        <AdminTipsAudit />
                      </ProtectedRoute>
                    } />

                    <Route path="settings" element={
                      <ProtectedRoute allowedRoles={['owner', 'admin' as any]}>
                        <Settings />
                      </ProtectedRoute>
                    } />

                    <Route path="owner" element={
                      <ProtectedRoute allowedRoles={['owner']}>
                        <CustomAppWrapper className="p-0 overflow-hidden" title="Owner Command Center" subtitle="Intelligent Oversight" fullScreen={true}>
                          <OwnerCommandCenter />
                        </CustomAppWrapper>
                      </ProtectedRoute>
                    } />

                    <Route path="baro-admin" element={
                      <ProtectedRoute allowedRoles={['super_admin']}>
                        <BaroAdminDashboard />
                      </ProtectedRoute>
                    } />

                    <Route path="supplier/dashboard" element={
                      <ProtectedRoute allowedRoles={['supplier']}>
                        <SupplierDashboard />
                      </ProtectedRoute>
                    } />

                    <Route path="driver/dashboard" element={
                      <ProtectedRoute allowedRoles={['driver']}>
                        <DriverDashboard />
                      </ProtectedRoute>
                    } />
                  </Route>

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                <ToastContainer />
              </LayoutProvider>
            </BranchProvider>
          </AuthProvider>
        </BrowserRouter>
      </LanguageProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
};

export default App;
