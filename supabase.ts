import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://pgglpdnxrvndwxwbmajf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZ2xwZG54cnZuZHd4d2JtYWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTc4NzUsImV4cCI6MjA3OTk3Mzg3NX0.Sn2eJY8mvN-IeEJnOxnI7GPFNbIGqKqAp8F9vZrMEZM';

// Minimal StorageAdapter interface for Supabase v2
interface StorageAdapter {
  getItem(key: string): string | null | Promise<string | null>;
  setItem(key: string, value: string): void | Promise<void>;
  removeItem(key: string): void | Promise<void>;
}

/**
 * Detect whether we can safely use localStorage.
 */
function createSafeStorage(): StorageAdapter | undefined {
  if (typeof window === 'undefined') {
    return undefined;
  }

  try {
    const testKey = '__supabase_storage_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);

    return {
      getItem: (key: string) => window.localStorage.getItem(key),
      setItem: (key: string, value: string) => window.localStorage.setItem(key, value),
      removeItem: (key: string) => window.localStorage.removeItem(key),
    };
  } catch {
    // Fallback to memory storage if localStorage is blocked
    const memoryStore = new Map<string, string>();
    return {
      getItem: (key: string) => memoryStore.get(key) ?? null,
      setItem: (key: string, value: string) => memoryStore.set(key, value),
      removeItem: (key: string) => memoryStore.delete(key),
    };
  }
}

const storage = createSafeStorage();

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage,
    persistSession: !!storage,
    autoRefreshToken: true,
  },
});