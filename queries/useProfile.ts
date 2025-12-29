
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

      // Attempt to get the profile
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;
      
      // If we are logged in but have no profile record, we return null 
      // instead of throwing to let the UI handle the "missing profile" state
      return data as UserProfile | null;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    retry: (failureCount, error: any) => {
      if (error?.message === 'Not authenticated') return false;
      // Retry up to 3 times for database connection/sync issues
      return failureCount < 3;
    },
    retryDelay: (attempt) => Math.min(attempt * 1000, 3000),
  });
}
