import React from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './AuthContext';
import { ToastContainer } from './components/ui';

// Pages
import Landing from './pages/Landing';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
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
            <ProtectedRoute allowedRoles={['owner', 'admin' as any]}>
              <AdminDashboard />
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