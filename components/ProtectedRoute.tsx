import React from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Role } from '../types';
import { Loader2, ShieldAlert, ArrowLeft, Home } from 'lucide-react';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

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

  // If user exists but profile is missing/null (e.g. deleted or network error), show error
  if (!profile) {
     return (
       <div className="min-h-screen flex flex-col items-center justify-center bg-background text-white gap-4">
         <p className="text-red-400">Profile not found. Please contact admin.</p>
         <button onClick={() => navigate('/')} className="text-sm text-gray-500 hover:text-white underline">Back to Home</button>
       </div>
     );
  }

  // Normalize roles for comparison
  const userRole = profile.role.trim().toLowerCase();
  const isAllowed = allowedRoles?.some(r => r.trim().toLowerCase() === userRole);

  if (allowedRoles && !isAllowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background text-white p-4 text-center">
         <ShieldAlert className="w-16 h-16 text-red-500 mb-4 opacity-80" />
         <h1 className="text-4xl font-bold mb-2">403</h1>
         <p className="text-xl mb-6 font-medium">Unauthorized Access</p>
         
         <div className="bg-[#1A1A1A] border border-gray-800 rounded-lg p-4 max-w-md w-full mb-8 text-left space-y-2">
            <div>
                <span className="text-xs text-gray-500 uppercase font-bold">Your Role</span>
                <p className="text-primary font-mono capitalize">{profile.role}</p>
            </div>
            <div>
                <span className="text-xs text-gray-500 uppercase font-bold">Required Role(s)</span>
                <p className="text-gray-300 font-mono text-sm">{allowedRoles.join(', ')}</p>
            </div>
            <div>
                <span className="text-xs text-gray-500 uppercase font-bold">Current Path</span>
                <p className="text-red-400 font-mono text-sm break-all">{location.pathname}</p>
            </div>
         </div>

         <div className="flex gap-4">
             <button 
                onClick={() => window.history.back()} 
                className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
             >
                <ArrowLeft className="w-4 h-4" /> Go Back
             </button>
             
             <button 
                onClick={() => {
                    if (profile.role === 'owner') navigate('/admin');
                    else if (profile.role === 'manager') navigate('/manager');
                    else if (profile.role === 'waiter') navigate('/waiter');
                    else if (profile.role === 'kitchen') navigate('/kitchen');
                    else navigate('/');
                }} 
                className="flex items-center gap-2 px-4 py-2 bg-primary text-black font-bold hover:bg-primary/90 rounded-lg transition-colors"
             >
                <Home className="w-4 h-4" /> Go to My Dashboard
             </button>
         </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default ProtectedRoute;