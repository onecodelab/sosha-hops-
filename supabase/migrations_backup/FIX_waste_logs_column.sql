-- FIX: Add Missing Column AND Foreign Key
-- The error 42703 confirms 'reported_by' column does not exist at all.

-- 1. Add the column first
ALTER TABLE public.waste_logs 
ADD COLUMN IF NOT EXISTS reported_by UUID;

-- 2. Add the Foreign Key Constraint
ALTER TABLE public.waste_logs
DROP CONSTRAINT IF EXISTS waste_logs_reported_by_fkey;

ALTER TABLE public.waste_logs
ADD CONSTRAINT waste_logs_reported_by_fkey
FOREIGN KEY (reported_by)
REFERENCES public.profiles(id)
ON DELETE SET NULL;

NOTIFY pgrst, 'reload schema';
