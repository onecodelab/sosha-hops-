-- INIT: Initialize Branch Inventory
-- Allows each branch to track its own stock level.
-- This script creates a row in 'branch_inventory' for every ingredient X every branch.

INSERT INTO public.branch_inventory (branch_id, ingredient_id, current_stock, par_min, par_max, last_updated)
SELECT 
    b.id,
    i.id,
    0, -- Start with 0 stock
    0, -- Start with 0 par min
    0, -- Start with 0 par max
    NOW()
FROM public.branches b
CROSS JOIN public.ingredients i
WHERE i.is_active = true
ON CONFLICT (branch_id, ingredient_id) DO NOTHING;

-- Cleanup: Remove legacy columns if they exist to prevent confusion
-- DO $$ BEGIN
--    ALTER TABLE ingredients DROP COLUMN IF EXISTS current_stock;
--    ALTER TABLE ingredients DROP COLUMN IF EXISTS par_min;
--    ALTER TABLE ingredients DROP COLUMN IF EXISTS par_max;
-- EXCEPTION WHEN OTHERS THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
