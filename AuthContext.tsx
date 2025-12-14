import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { UserProfile } from './types';
import { SetupGuide } from './components/SetupGuide';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: (userId?: string) => Promise<void>;
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
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    
    // Safety timeout to prevent infinite loading on mount
    const safetyTimeout = setTimeout(() => {
      if (mounted.current && loading) {
        console.warn("Auth loading safety timeout triggered - Forcing app load");
        setLoading(false);
      }
    }, 5000);

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.warn("Session check error:", error);
        }

        if (session?.user) {
          if (mounted.current) setUser(session.user);
          await fetchProfile(session.user.id);
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
      } finally {
        if (mounted.current) {
          setLoading(false);
          clearTimeout(safetyTimeout);
        }
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted.current) return;
      
      setUser(session?.user ?? null);

      if (event === 'SIGNED_IN') {
         // Block UI temporarily to fetch profile on sign in
         setLoading(true);
         // Safety timeout specific to sign-in action
         const signinTimeout = setTimeout(() => {
             if (mounted.current && loading) setLoading(false);
         }, 5000);

         try {
           if (session?.user) {
              await fetchProfile(session.user.id);
           }
         } finally {
           clearTimeout(signinTimeout);
           if (mounted.current) setLoading(false);
         }
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setLoading(false);
      } else if (event === 'TOKEN_REFRESHED') {
        // Do not block UI on token refresh, just update background
        if (session?.user && !profile) {
            fetchProfile(session.user.id);
        }
      }
    });

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const markDatabaseAsMissing = () => {
    setNeedsSetup(true);
  };

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        const errMsg = error.message || JSON.stringify(error);
        if (errMsg.includes('does not exist') || errMsg.includes('relation "public.users" does not exist')) {
            console.error("Database setup required:", errMsg);
            setNeedsSetup(true);
            return;
        }
        console.warn('Profile fetch error:', errMsg);
      }

      if (data && mounted.current) {
        const displayProfile = {
          ...data,
          name: data.full_name || data.name || data.email?.split('@')[0] || 'Staff Member'
        };
        setProfile(displayProfile as UserProfile);
      } else if (mounted.current) {
        // If profile is missing but user is auth'd, we might set profile to null
        // The ProtectedRoute handles the case where user exists but profile is null
        setProfile(null);
      }
    } catch (err: any) {
      console.warn('Profile fetch exception:', err);
    }
  };

  const refreshProfile = async (userId?: string) => {
    const idToFetch = userId || user?.id;
    if (idToFetch) {
        await fetchProfile(idToFetch);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      localStorage.clear(); 
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      if (mounted.current) {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    }
  };

  if (needsSetup) {
    return <SetupGuide />;
  }

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut, refreshProfile, markDatabaseAsMissing }}>
      {children}
    </AuthContext.Provider>
  );
};