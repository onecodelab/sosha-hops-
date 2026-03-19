-- FIX: Add Missing Foreign Key for Waste Reporter
-- The previous diagnostic showed that 'waste_logs' exists but is missing the link to 'profiles'.
-- This prevents the UI from showing WHO reported the waste.

BEGIN;

-- 1. Ensure the column exists (just in case)
ALTER TABLE public.waste_logs 
ADD COLUMN IF NOT EXISTS reported_by UUID;

-- 2. Add the Foreign Key Constraint explicitly
-- We use a specific name 'waste_logs_reported_by_fkey' so PostgREST can find it
ALTER TABLE public.waste_logs
DROP CONSTRAINT IF EXISTS waste_logs_reported_by_fkey;

ALTER TABLE public.waste_logs
ADD CONSTRAINT waste_logs_reported_by_fkey
FOREIGN KEY (reported_by)
REFERENCES public.profiles(id)
ON DELETE SET NULL;

COMMIT;

-- 3. Reload API Schema cache
NOTIFY pgrst, 'reload schema';
