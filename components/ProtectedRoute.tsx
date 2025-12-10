import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Role } from '../types';
import { Loader2 } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-white">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-gray-400">Loading your profile...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/" replace />;
  }

  if (!profile) {
     // Profile is loading or doesn't exist (edge case)
     return (
       <div className="min-h-screen flex items-center justify-center bg-background text-white">
         <p>Profile not found. Please contact admin.</p>
       </div>
     );
  }

  if (allowedRoles && !allowedRoles.includes(profile.role)) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-white p-4 text-center">
         <h1 className="text-4xl font-bold mb-4">403</h1>
         <p className="text-xl mb-6">Unauthorized Access</p>
         <p className="text-gray-400 max-w-md">Your role ({profile.role}) does not have permission to access this page.</p>
         <button onClick={() => window.history.back()} className="mt-8 text-primary hover:underline">Go Back</button>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;