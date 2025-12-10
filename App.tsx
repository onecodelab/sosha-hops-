import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { ToastContainer } from './components/ui';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import MenuAnalytics from './pages/MenuAnalytics';
import Inventory from './pages/Inventory';
import StaffPerformance from './pages/StaffPerformance';
import OrdersTables from './pages/OrdersTables';
import ManagerDashboard from './pages/ManagerDashboard';
import WaiterDashboard from './pages/WaiterDashboard';
import KitchenDashboard from './pages/KitchenDashboard';
import ProtectedRoute from './components/ProtectedRoute';

const App: React.FC = () => {
  return (
    <HashRouter>
      <AuthProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login/:role" element={<Login />} />
          
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
        </Routes>
        <ToastContainer />
      </AuthProvider>
    </HashRouter>
  );
};

export default App;