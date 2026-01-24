-- SAFETY FIX: Add missing branch_id column to staff_shifts
-- This resolves the "column ss.branch_id does not exist" error.

-- 1. Add branch_id column to staff_shifts
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff_shifts' AND column_name='branch_id') THEN
        ALTER TABLE public.staff_shifts ADD COLUMN branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL;
    END IF;
END $$;

-- 2. Add index for performance if it doesn't exist
CREATE INDEX IF NOT EXISTS idx_staff_shifts_branch ON staff_shifts(branch_id);

-- 3. Backfill existing active shifts with the 'Main Branch' ID if they are null
-- (Optional but helpful: Replace with your actual main branch ID if it's different)
UPDATE public.staff_shifts 
SET branch_id = (SELECT id FROM public.branches ORDER BY created_at ASC LIMIT 1)
WHERE branch_id IS NULL;

-- 4. Refresh Cache
NOTIFY pgrst, 'reload schema';
