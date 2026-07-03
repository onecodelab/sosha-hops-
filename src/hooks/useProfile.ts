
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { UserProfile } from '@/types';

export function useProfile(userId?: string) {
  return useQuery({
    queryKey: ['profile', userId],
    enabled: !!userId, // Don't even try to fetch if we don't have a userId
    queryFn: async () => {
      if (!userId) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;
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
