-- FIX: Add branch_id column to tables
-- This resolves the "Could not find the 'branch_id' column" error

-- 1. Add the branch_id column if it doesn't exist
ALTER TABLE public.tables 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;

-- 2. Create index for performance
CREATE INDEX IF NOT EXISTS idx_tables_branch ON tables(branch_id);

-- 3. Backfill existing tables with the Main Branch ID
-- (Assumes Main Branch was the first one created)
UPDATE public.tables 
SET branch_id = (SELECT id FROM public.branches ORDER BY created_at ASC LIMIT 1)
WHERE branch_id IS NULL;

-- 4. Reload schema cache
NOTIFY pgrst, 'reload schema';
