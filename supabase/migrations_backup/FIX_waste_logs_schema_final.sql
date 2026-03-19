-- FIX: Add Missing created_at Column
-- The debug UI confirmed that 'created_at' is missing. 
-- This script ensures ALL required columns exist to stop the "whack-a-mole" errors.

ALTER TABLE public.waste_logs 
ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS cost_snapshot NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS unit_type TEXT DEFAULT 'unit';

NOTIFY pgrst, 'reload schema';
