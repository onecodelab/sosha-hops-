
import React, { useEffect } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
import { BranchProvider } from './contexts/BranchContext';
import { ToastContainer } from './components/ui';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from './lib/queryClient';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import SignUp from './pages/SignUp';
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
import KitchenDashboard from './pages/KitchenDashboard';
import KitchenStockView from './pages/KitchenStockView';
import KitchenLogWaste from './pages/KitchenLogWaste';
import KitchenRestockRequests from './pages/KitchenRestockRequests';
import ManagerPendingRequests from './pages/ManagerPendingRequests';
import ManagerPurchaseOrders from './pages/ManagerPurchaseOrders';
import ProtectedRoute from './components/ProtectedRoute';
import Settings from './pages/Settings';

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

                <Route path="/admin/staff-performance" element={
                  <ProtectedRoute allowedRoles={['owner', 'admin' as any]}>
                    <AdminStaffPerformance />
                  </ProtectedRoute>
                } />

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
              <ToastContainer />
            </BranchProvider>
          </AuthProvider>
        </HashRouter>
      </LanguageProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
};

export default App;
