import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { UserProfile, Role } from './types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;

    const initAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error("Auth init error:", error);
          if (mounted.current) setLoading(false);
          return;
        }

        if (session?.user) {
          if (mounted.current) setUser(session.user);
          await fetchProfile(session.user.id);
        } else {
          if (mounted.current) {
            setUser(null);
            setProfile(null);
          }
        }
      } catch (err) {
        console.error("Unexpected auth error:", err);
      } finally {
        if (mounted.current) setLoading(false);
      }
    };

    initAuth();

    // Auth Subscription
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted.current) return;
      
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Only fetch if we don't have a profile or if the user changed
        if (!profile || profile.id !== session.user.id) {
            await fetchProfile(session.user.id);
        }
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        // Ignore "Row not found" error (code PGRST116) which happens for new users
        if (error.code !== 'PGRST116') {
          console.error('Error fetching profile:', error.message || JSON.stringify(error));
        }
      } else {
        if (mounted.current) setProfile(data as UserProfile);
      }
    } catch (err) {
      console.error('Unexpected error fetching profile:', err);
    }
    // We do NOT set loading to false here, it is handled in initAuth finally block or onAuthStateChange
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Sign out error:', error);
    }
    if (mounted.current) {
      setUser(null);
      setProfile(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};