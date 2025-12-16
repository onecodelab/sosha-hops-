
import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { LanguageProvider } from './contexts/LanguageContext';
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
import Inventory from './pages/Inventory';
import StaffPerformance from './pages/StaffPerformance';
import OrdersTables from './pages/OrdersTables';
import ManagerDashboard from './pages/ManagerDashboard';
import WaiterDashboard from './pages/WaiterDashboard';
import KitchenDashboard from './pages/KitchenDashboard';
import ProtectedRoute from './components/ProtectedRoute';
import Settings from './pages/Settings';

const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <HashRouter>
          <AuthProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login/:role" element={<Login />} />
              <Route path="/signup" element={<SignUp />} />
              
              <Route path="/admin" element={
                <ProtectedRoute allowedRoles={['owner', 'admin' as any, 'manager']}>
                  <AdminDashboard />
                </ProtectedRoute>
              } />

              <Route path="/menu-analytics" element={
                <ProtectedRoute allowedRoles={['owner', 'admin' as any]}>
                  <MenuAnalytics />
                </ProtectedRoute>
              } />

              <Route path="/inventory" element={
                <ProtectedRoute allowedRoles={['owner', 'manager', 'admin' as any, 'kitchen']}>
                  <Inventory />
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

              <Route path="/settings" element={
                <ProtectedRoute allowedRoles={['owner', 'admin' as any]}>
                  <Settings />
                </ProtectedRoute>
              } />
            </Routes>
            <ToastContainer />
          </AuthProvider>
        </HashRouter>
      </LanguageProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
};

export default App;
