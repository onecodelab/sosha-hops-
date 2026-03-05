import React, { useEffect, Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { BranchProvider } from './contexts/BranchContext';
import { ToastContainer } from './components/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';

// Marketing Pages
const Landing = lazy(() => import('./pages/Landing'));
const BookDemo = lazy(() => import('./pages/Pricing'));
const PricingPage = lazy(() => import('./pages/PricingPage'));
const Features = lazy(() => import('./pages/Features'));

// Auth Pages
const Login = lazy(() => import('./pages/Login'));
const SignUp = lazy(() => import('./pages/SignUp'));
const Onboarding = lazy(() => import('./pages/Onboarding'));

// App Dispatcher
const AppDispatcher = lazy(() => import('./pages/AppDispatcher'));

// Protected App Pages
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const MenuAnalytics = lazy(() => import('./pages/MenuAnalytics'));
const MenuManagement = lazy(() => import('./pages/MenuManagement'));
const Inventory = lazy(() => import('./pages/Inventory'));
const StaffPerformance = lazy(() => import('./pages/StaffPerformance'));
const AdminStaffPerformance = lazy(() => import('./pages/AdminStaffPerformance'));
const AdminTableMap = lazy(() => import('./pages/AdminTableMap'));
const AdminFloorAnalytics = lazy(() => import('./pages/AdminFloorAnalytics'));
const TableStatus = lazy(() => import('./pages/TableStatus'));
const OrdersTables = lazy(() => import('./pages/OrdersTables'));
const ManagerDashboard = lazy(() => import('./pages/ManagerDashboard'));
const WaiterDashboard = lazy(() => import('./pages/WaiterDashboard'));
const WaiterOrders = lazy(() => import('./pages/WaiterOrders'));
const KitchenDashboard = lazy(() => import('./pages/KitchenDashboard'));
const KitchenLogWaste = lazy(() => import('./pages/KitchenLogWaste'));
const ManagerWasteHistory = lazy(() => import('./pages/ManagerWasteHistory'));
const KitchenStockView = lazy(() => import('./pages/KitchenStockView'));
const KitchenRestockRequests = lazy(() => import('./pages/KitchenRestockRequests'));
const ManagerPendingRequests = lazy(() => import('./pages/ManagerPendingRequests'));
const ManagerPurchaseOrders = lazy(() => import('./pages/ManagerPurchaseOrders'));
const Settings = lazy(() => import('./pages/Settings'));
const OwnerCommandCenter = lazy(() => import('./pages/OwnerCommandCenter'));
const WaiterTips = lazy(() => import('./pages/WaiterTips'));
const AdminTipsAudit = lazy(() => import('./pages/AdminTipsAudit'));
const BaroAdminDashboard = lazy(() => import('./pages/BaroAdminDashboard'));
const SupplierDashboard = lazy(() => import('./pages/SupplierDashboard'));
const DriverDashboard = lazy(() => import('./pages/DriverDashboard'));

import { ChatWidget } from './components/ChatWidget';
import ProtectedRoute from './components/ProtectedRoute';
import { BrandLoader } from './components/BrandLoader';
import ScrollToTop from './components/ScrollToTop';
import { DashboardLayout } from './components/DashboardLayout';

// Loading Placeholder
const PageLoader = () => <BrandLoader />;

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
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public Marketing Layer */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/book-demo" element={<BookDemo />} />
                  <Route path="/pricing" element={<PricingPage />} />
                  <Route path="/features" element={<Features />} />

                  {/* Auth Layer */}
                  <Route path="/login" element={<Login />} />
                  <Route path="/login/:role" element={<Login />} />
                  <Route path="/signup" element={<SignUp />} />
                  <Route path="/onboarding" element={<Onboarding />} />

                  {/* Protected App Layer */}
                  <Route path="/app" element={<ProtectedRoute><AppDispatcher /></ProtectedRoute>} />

                  <Route path="/app/admin" element={
                    <ProtectedRoute allowedRoles={['owner', 'admin' as any, 'manager']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/admin/menu" element={
                    <ProtectedRoute allowedRoles={['owner', 'admin' as any, 'manager']}>
                      <MenuManagement />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/tables" element={
                    <ProtectedRoute allowedRoles={['owner', 'admin' as any, 'manager', 'waiter']}>
                      <TableStatus />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/menu-analytics" element={
                    <ProtectedRoute allowedRoles={['owner', 'admin' as any]}>
                      <MenuAnalytics />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/inventory" element={
                    <ProtectedRoute allowedRoles={['owner', 'manager', 'admin' as any]}>
                      <Inventory />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/admin/staff-performance" element={<ProtectedRoute allowedRoles={['owner', 'admin']}><AdminStaffPerformance /></ProtectedRoute>} />
                  <Route path="/app/admin/waste" element={<ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}><ManagerWasteHistory /></ProtectedRoute>} />
                  <Route path="/app/admin/table-map" element={
                    <ProtectedRoute allowedRoles={['owner', 'admin' as any]}>
                      <AdminTableMap />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/staff-performance" element={
                    <ProtectedRoute allowedRoles={['owner', 'manager', 'admin' as any]}>
                      <StaffPerformance />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/orders-tables" element={
                    <ProtectedRoute allowedRoles={['owner', 'manager', 'admin' as any]}>
                      <OrdersTables />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/manager" element={
                    <ProtectedRoute allowedRoles={['manager', 'owner']}>
                      <ManagerDashboard />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/manager/pending-requests" element={
                    <ProtectedRoute allowedRoles={['manager', 'owner']}>
                      <ManagerPendingRequests />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/po/list" element={
                    <ProtectedRoute allowedRoles={['manager', 'owner']}>
                      <ManagerPurchaseOrders />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/waiter" element={
                    <ProtectedRoute allowedRoles={['waiter']}>
                      <WaiterDashboard />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/waiter/orders" element={
                    <ProtectedRoute allowedRoles={['waiter']}>
                      <WaiterOrders />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/waiter/tips" element={
                    <ProtectedRoute allowedRoles={['waiter']}>
                      <WaiterTips />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/kitchen" element={
                    <ProtectedRoute allowedRoles={['kitchen', 'manager', 'owner']}>
                      <KitchenDashboard />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/kitchen/stock" element={
                    <ProtectedRoute allowedRoles={['kitchen', 'manager', 'owner']}>
                      <KitchenStockView />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/kitchen/waste" element={
                    <ProtectedRoute allowedRoles={['kitchen', 'manager', 'owner']}>
                      <KitchenLogWaste />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/kitchen/restock" element={
                    <ProtectedRoute allowedRoles={['kitchen', 'manager', 'owner']}>
                      <KitchenRestockRequests />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/admin/analytics" element={
                    <ProtectedRoute allowedRoles={['owner', 'admin' as any]}>
                      <AdminFloorAnalytics />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/admin/tips" element={
                    <ProtectedRoute allowedRoles={['owner', 'admin' as any]}>
                      <AdminTipsAudit />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/settings" element={
                    <ProtectedRoute allowedRoles={['owner', 'admin' as any]}>
                      <Settings />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/owner" element={
                    <ProtectedRoute allowedRoles={['owner']}>
                      <DashboardLayout className="p-0 overflow-hidden" title="Owner Command Center" subtitle="Intelligent Oversight">
                        <OwnerCommandCenter />
                      </DashboardLayout>
                    </ProtectedRoute>
                  } />

                  <Route path="/app/baro-admin" element={
                    <ProtectedRoute allowedRoles={['super_admin']}>
                      <BaroAdminDashboard />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/supplier/dashboard" element={
                    <ProtectedRoute allowedRoles={['supplier']}>
                      <SupplierDashboard />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/driver/dashboard" element={
                    <ProtectedRoute allowedRoles={['driver']}>
                      <DriverDashboard />
                    </ProtectedRoute>
                  } />

                  {/* Fallback */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
              <ToastContainer />
            </BranchProvider>
          </AuthProvider>
        </BrowserRouter>
      </LanguageProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
};

export default App;
