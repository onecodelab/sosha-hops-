import React, { useEffect, Suspense, lazy } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { BranchProvider } from './contexts/BranchContext';
import { ToastContainer } from './components/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';

// Lazy Loaded Pages
const Landing = lazy(() => import('./pages/Landing'));
const Login = lazy(() => import('./pages/Login'));
const SignUp = lazy(() => import('./pages/SignUp'));
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
const KitchenWaste = lazy(() => import('./pages/KitchenWaste'));
const ManagerWasteHistory = lazy(() => import('./pages/ManagerWasteHistory'));
const KitchenStockView = lazy(() => import('./pages/KitchenStockView'));
const KitchenLogWaste = lazy(() => import('./pages/KitchenLogWaste'));
const KitchenRestockRequests = lazy(() => import('./pages/KitchenRestockRequests'));
const ManagerPendingRequests = lazy(() => import('./pages/ManagerPendingRequests'));
const ManagerPurchaseOrders = lazy(() => import('./pages/ManagerPurchaseOrders'));
const Settings = lazy(() => import('./pages/Settings'));

import { ChatWidget } from './components/ChatWidget';
import ProtectedRoute from './components/ProtectedRoute';

// Loading Placeholder
const PageLoader = () => (
  <div className="h-screen w-full flex items-center justify-center bg-background">
    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
  </div>
);

const App: React.FC = () => {
  // Initialize Theme Globally
  useEffect(() => {
    const savedTheme = localStorage.getItem('sosha-theme');
    if (savedTheme === 'fresh') {
      document.body.setAttribute('data-theme', 'fresh');
    } else {
      document.body.removeAttribute('data-theme');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <HashRouter>
          <AuthProvider>
            <BranchProvider>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/" element={<Landing />} />
                  <Route path="/login/:role" element={<Login />} />
                  <Route path="/signup" element={<SignUp />} />

                  <Route path="/admin" element={
                    <ProtectedRoute allowedRoles={['owner', 'admin' as any, 'manager']}>
                      <AdminDashboard />
                    </ProtectedRoute>
                  } />

                  <Route path="/admin/menu" element={
                    <ProtectedRoute allowedRoles={['owner', 'admin' as any, 'manager']}>
                      <MenuManagement />
                    </ProtectedRoute>
                  } />

                  <Route path="/tables" element={
                    <ProtectedRoute allowedRoles={['owner', 'admin' as any, 'manager', 'waiter']}>
                      <TableStatus />
                    </ProtectedRoute>
                  } />

                  <Route path="/menu-analytics" element={
                    <ProtectedRoute allowedRoles={['owner', 'admin' as any]}>
                      <MenuAnalytics />
                    </ProtectedRoute>
                  } />

                  <Route path="/inventory" element={
                    <ProtectedRoute allowedRoles={['owner', 'manager', 'admin' as any]}>
                      <Inventory />
                    </ProtectedRoute>
                  } />

                  <Route path="/admin/staff-performance" element={<ProtectedRoute allowedRoles={['owner', 'admin']}><AdminStaffPerformance /></ProtectedRoute>} />
                  <Route path="/admin/waste" element={<ProtectedRoute allowedRoles={['owner', 'admin', 'manager']}><ManagerWasteHistory /></ProtectedRoute>} />
                  <Route path="/admin/table-map" element={
                    <ProtectedRoute allowedRoles={['owner', 'admin' as any]}>
                      <AdminTableMap />
                    </ProtectedRoute>
                  } />

                  <Route path="/staff-performance" element={
                    <ProtectedRoute allowedRoles={['owner', 'manager', 'admin' as any]}>
                      <StaffPerformance />
                    </ProtectedRoute>
                  } />

                  <Route path="/orders-tables" element={
                    <ProtectedRoute allowedRoles={['owner', 'manager', 'admin' as any]}>
                      <OrdersTables />
                    </ProtectedRoute>
                  } />

                  <Route path="/manager" element={
                    <ProtectedRoute allowedRoles={['manager', 'owner']}>
                      <ManagerDashboard />
                    </ProtectedRoute>
                  } />

                  <Route path="/manager/pending-requests" element={
                    <ProtectedRoute allowedRoles={['manager', 'owner']}>
                      <ManagerPendingRequests />
                    </ProtectedRoute>
                  } />

                  <Route path="/po/list" element={
                    <ProtectedRoute allowedRoles={['manager', 'owner']}>
                      <ManagerPurchaseOrders />
                    </ProtectedRoute>
                  } />


                  <Route path="/waiter" element={
                    <ProtectedRoute allowedRoles={['waiter']}>
                      <WaiterDashboard />
                    </ProtectedRoute>
                  } />

                  <Route path="/waiter/orders" element={
                    <ProtectedRoute allowedRoles={['waiter']}>
                      <WaiterOrders />
                    </ProtectedRoute>
                  } />

                  <Route path="/kitchen" element={
                    <ProtectedRoute allowedRoles={['kitchen', 'manager', 'owner']}>
                      <KitchenDashboard />
                    </ProtectedRoute>
                  } />

                  <Route path="/kitchen/stock" element={
                    <ProtectedRoute allowedRoles={['kitchen', 'manager', 'owner']}>
                      <KitchenStockView />
                    </ProtectedRoute>
                  } />

                  <Route path="/kitchen/waste" element={
                    <ProtectedRoute allowedRoles={['kitchen', 'manager', 'owner']}>
                      <KitchenLogWaste />
                    </ProtectedRoute>
                  } />

                  <Route path="/kitchen/restock" element={
                    <ProtectedRoute allowedRoles={['kitchen', 'manager', 'owner']}>
                      <KitchenRestockRequests />
                    </ProtectedRoute>
                  } />

                  <Route path="/admin/analytics" element={
                    <ProtectedRoute allowedRoles={['owner', 'admin' as any]}>
                      <AdminFloorAnalytics />
                    </ProtectedRoute>
                  } />

                  <Route path="/settings" element={
                    <ProtectedRoute allowedRoles={['owner', 'admin' as any]}>
                      <Settings />
                    </ProtectedRoute>
                  } />
                </Routes>
              </Suspense>
              <ToastContainer />
            </BranchProvider>
          </AuthProvider>
        </HashRouter>
      </LanguageProvider>
      <ChatWidget />
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
};

export default App;