-- FIX: Add missing phone column to profiles table
-- This column is sometimes referenced by legacy components or schema caches

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- Refresh PostgREST cache (this happens automatically in Supabase usually, 
-- but this script serves as a record of the fix)
NOTIFY pgrst, 'reload schema';
