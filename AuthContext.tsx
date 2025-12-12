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

    // Initial Auth Check
    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          if (mounted.current) setUser(session.user);
          await fetchProfile(session.user.id);
        }
      } catch (error) {
        console.warn("Auth init error:", error);
      } finally {
        if (mounted.current) setLoading(false);
      }
    };

    initializeAuth();

    // Subscription for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted.current) return;
      
      // Update User State immediately
      setUser(session?.user ?? null);

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        if (session?.user) {
           // Set loading to true while we fetch the profile to prevent premature redirects
           setLoading(true); 
           await fetchProfile(session.user.id);
           if (mounted.current) setLoading(false);
        }
      } else if (event === 'SIGNED_OUT') {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
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
        
        // CRITICAL: Detect missing tables
        if (errMsg.includes('does not exist') || errMsg.includes('relation "public.users" does not exist')) {
            console.error("Database setup required: ", errMsg);
            setNeedsSetup(true);
            return;
        }
      }

      if (data && mounted.current) {
        const displayProfile = {
          ...data,
          name: data.full_name || data.name || data.email?.split('@')[0] || 'Staff Member'
        };
        setProfile(displayProfile as UserProfile);
      } else if (mounted.current) {
        // Profile doesn't exist yet (will be created by Login page)
        setProfile(null);
      }
    } catch (err: any) {
      console.warn('Profile fetch exception:', err.message || err);
    }
  };

  const refreshProfile = async (userId?: string) => {
    const idToFetch = userId || user?.id;
    if (idToFetch) {
        // We do NOT set global loading here to avoid flickering UI on manual refreshes
        await fetchProfile(idToFetch);
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      localStorage.clear(); 
    } catch (error) {
      console.error('Sign out error:', error);
    }
    if (mounted.current) {
      setUser(null);
      setProfile(null);
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