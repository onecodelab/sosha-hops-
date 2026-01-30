-- FINAL SQL FIX: Standardize Column Names
-- This fixes the "column waste_reason does not exist" error once and for all.

BEGIN;

-- 1. If the column exists as 'waste_category', rename it to 'waste_reason'
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='waste_logs' AND column_name='waste_category') THEN
        ALTER TABLE public.waste_logs RENAME COLUMN waste_category TO waste_reason;
    END IF;
END $$;

-- 2. If 'reason' exists, rename it to 'notes' (since we use it for notes in the logic)
-- BUT ONLY if 'notes' doesn't exist yet
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='waste_logs' AND column_name='reason') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='waste_logs' AND column_name='notes') THEN
        ALTER TABLE public.waste_logs RENAME COLUMN reason TO notes;
    END IF;
END $$;

-- 3. Ensure all columns needed by the RPC exist
ALTER TABLE public.waste_logs 
ADD COLUMN IF NOT EXISTS waste_reason TEXT,
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS cost_snapshot NUMERIC DEFAULT 0;

COMMIT;

NOTIFY pgrst, 'reload schema';
