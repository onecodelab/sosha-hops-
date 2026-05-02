
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
  organizationId: string | null;
  loading: boolean;
  isProfileStale: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  markDatabaseAsMissing: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  organizationId: null,
  loading: true,
  isProfileStale: false,
  signOut: async () => { },
  refreshProfile: async () => { },
  markDatabaseAsMissing: () => { },
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const navigate = useNavigate();

  const {
    data: profile,
    isLoading: isProfileLoading,
    isError,
    error,
    refetch
  } = useProfile(user?.id);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setAuthLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[AuthContext] State change: ${event}`, !!session);
      setUser(session?.user ?? null);
      setAuthLoading(false);
      
      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (!session) {
          console.warn("[AuthContext] Event received without session. Cleaning up...");
          await signOut();
          return;
        }
        refetch();
      } else if (event === 'SIGNED_OUT') {
        refetch();
        navigate('/');
      }
    });

    return () => subscription.unsubscribe();
  }, [refetch]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      
      // Selective cleanup to preserve user preferences like theme
      const theme = localStorage.getItem('baro-theme');
      const lang = localStorage.getItem('baro-language');
      localStorage.clear();
      if (theme) localStorage.setItem('baro-theme', theme);
      if (lang) localStorage.setItem('baro-language', lang);
      setUser(null);
      refetch();
      navigate('/');
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  const markDatabaseAsMissing = () => setNeedsSetup(true);
  const refreshProfile = async () => { await refetch(); };

  useEffect(() => {
    if (error) {
      const msg = (error as any).message || '';
      if (msg.includes('relation "public.profiles" does not exist')) {
        setNeedsSetup(true);
      }
    }
  }, [error]);

  if (needsSetup) return <SetupGuide />;

  const isAuthMissing = error instanceof Error && (
    error.message === 'Not authenticated' ||
    error.message.includes('Auth session missing')
  );

  // Performance Optimization: Don't block public marketing pages with a full-screen loader
  const publicPaths = ['/', '/book-demo', '/pricing', '/features', '/signup'];
  const currentPath = window.location.pathname;
  const isPublicPath = publicPaths.includes(currentPath) || currentPath.startsWith('/order-chat/');

  // We check BOTH auth session and profile data
  const isActuallyLoading = authLoading || (isProfileLoading && !profile && !isAuthMissing);

  // Only show the full-screen spinner for app routes or if we have an active user but no profile yet
  if (isActuallyLoading && !isPublicPath) {
    return (
      <LoadingSpinner
        timeout={12000}
        onTimeout={() => {
          const path = window.location.pathname;
          if (user && !path.includes('/login') && path !== '/') {
            navigate('/login?error=timeout');
          }
        }}
      />
    );
  }

  // If loading but on a public path, we still want to provide context 
  // but we allow children (Landing/Pricing) to render immediately.

  // Match the screenshot text and behavior
  if (isError && !isAuthMissing && !profile) {
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
      organizationId: profile?.organization_id || null,
      loading: isActuallyLoading,
      isProfileStale: isError,
      signOut,
      refreshProfile,
      markDatabaseAsMissing
    }}>
      {children}
    </AuthContext.Provider>
  );
};
