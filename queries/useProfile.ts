import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { UserProfile } from '../types';

export function useProfile() {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      
      if (authError) throw authError;
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Profile not found');

      return data as UserProfile;
    },
    staleTime: Infinity,
    retry: (failureCount, error) => {
      // Don't retry if user is not authenticated to avoid slow guest loading
      if (error.message === 'Not authenticated') return false;
      return failureCount < 2;
    },
    retryDelay: 1000,
  });
}