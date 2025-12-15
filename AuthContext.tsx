import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { UserProfile } from './types';
import { SetupGuide } from './components/SetupGuide';
import { useProfile } from './queries/useProfile';
import { LoadingSpinner } from './components/LoadingSpinner';
import { ErrorScreen } from './components/ErrorScreen';
import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  markDatabaseAsMissing: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
  markDatabaseAsMissing: () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const navigate = useNavigate();

  // Integrated React Query Profile Hook
  const { 
    data: profile, 
    isLoading, 
    isError, 
    error, 
    refetch 
  } = useProfile();

  useEffect(() => {
    // Initial visual state from session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        refetch();
      }
      if (event === 'SIGNED_OUT') {
        refetch();
      }
    });

    return () => subscription.unsubscribe();
  }, [refetch]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.clear();
      setUser(null);
      refetch();
      navigate('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const markDatabaseAsMissing = () => {
    setNeedsSetup(true);
  };

  const refreshProfile = async () => {
    await refetch();
  };

  // Check for specific DB errors to trigger setup guide
  useEffect(() => {
    if (error) {
        const msg = error.message || '';
        if (msg.includes('relation "public.users" does not exist') || msg.includes('does not exist')) {
            setNeedsSetup(true);
        }
    }
  }, [error]);

  if (needsSetup) {
    return <SetupGuide />;
  }

  if (isLoading) {
    return (
      <LoadingSpinner 
        timeout={8000} 
        onTimeout={() => {
          console.error('Profile load timeout');
          // If we appear to be logged in but profile is hanging, redirect to login
          if (user) navigate('/login?error=timeout');
        }} 
      />
    );
  }

  if (isError) {
    // Differentiate "Not Authenticated" (Guest) from actual errors
    const isGuest = error instanceof Error && (
        error.message === 'Not authenticated' || 
        error.message.includes('Auth session missing')
    );

    if (isGuest) {
        return (
            <AuthContext.Provider value={{ 
                user: null, 
                profile: null, 
                loading: false, 
                signOut, 
                refreshProfile, 
                markDatabaseAsMissing 
            }}>
              {children}
            </AuthContext.Provider>
        );
    }

    // Critical Error Screen
    return (
      <ErrorScreen 
        message="Failed to load your profile" 
        error={error as Error}
        onRetry={() => refetch()}
      />
    );
  }

  return (
    <AuthContext.Provider value={{ 
        user, 
        profile: profile || null, 
        loading: false, 
        signOut, 
        refreshProfile, 
        markDatabaseAsMissing 
    }}>
      {children}
    </AuthContext.Provider>
  );
};