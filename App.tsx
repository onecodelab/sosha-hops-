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
const Pricing = lazy(() => import('./pages/Pricing'));
const Features = lazy(() => import('./pages/Features'));

// Auth Pages
const Login = lazy(() => import('./pages/Login'));
const SignUp = lazy(() => import('./pages/SignUp'));

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

import { ChatWidget } from './components/ChatWidget';
import ProtectedRoute from './components/ProtectedRoute';

// Loading Placeholder
const PageLoader = () => (
  <div className="h-screen w-full flex items-center justify-center bg-background">
    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

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
          <AuthProvider>
            <BranchProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* Public Marketing Layer */}
                  <Route path="/" element={<Landing />} />
                  <Route path="/pricing" element={<Pricing />} />
                  <Route path="/features" element={<Features />} />

                  {/* Auth Layer */}
                  <Route path="/login/:role" element={<Login />} />
                  <Route path="/signup" element={<SignUp />} />

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

                  <Route path="/app/settings" element={
                    <ProtectedRoute allowedRoles={['owner', 'admin' as any]}>
                      <Settings />
                    </ProtectedRoute>
                  } />

                  <Route path="/app/owner" element={
                    <ProtectedRoute allowedRoles={['owner']}>
                      <OwnerCommandCenter />
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
