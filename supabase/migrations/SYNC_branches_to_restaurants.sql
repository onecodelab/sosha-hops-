-- SYNC FIX: Ensure Ambassador Mall appears in Database Selectors
-- Run this in your Supabase SQL Editor to sync the new Branches with the legacy Restaurant table.

-- 1. Copy any missing branches into the restaurants table
INSERT INTO public.restaurants (id, name)
SELECT id, name FROM public.branches
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;

-- 2. Verify: This will let you select "Ambassador Mall" even in the old restaurant_id column.
NOTIFY pgrst, 'reload schema';
