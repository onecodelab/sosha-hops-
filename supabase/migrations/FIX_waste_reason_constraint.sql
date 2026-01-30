-- FIX: Legacy "reason" column constraint
-- The error "null value in column reason violates not-null constraint" means
-- there is a legacy column 'reason' that we are not using, but it's blocking the insert.

BEGIN;

-- 1. Make the legacy 'reason' column nullable so it doesn't block us
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='waste_logs' AND column_name='reason') THEN
        ALTER TABLE public.waste_logs ALTER COLUMN reason DROP NOT NULL;
    END IF;
END $$;

-- 2. If 'reason' has data and 'notes' is empty, migrate it (optional but nice)
UPDATE public.waste_logs 
SET notes = reason 
WHERE notes IS NULL AND reason IS NOT NULL;

-- 3. Ensure 'notes' column itself is nullable (it should be)
ALTER TABLE public.waste_logs ALTER COLUMN notes DROP NOT NULL;

COMMIT;

NOTIFY pgrst, 'reload schema';
