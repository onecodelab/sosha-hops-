-- BACKFILL: Set branch_id on existing orders
-- Orders without branch_id are invisible to all branch-filtered views.

-- Step 1: Add branch_id column if missing
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS branch_id UUID;

-- Step 2: Backfill from table's branch
UPDATE public.orders o
SET branch_id = t.branch_id
FROM public.tables t
WHERE o.table_id = t.id AND o.branch_id IS NULL;

-- Step 3: For orders without tables, use main branch
UPDATE public.orders
SET branch_id = (SELECT id FROM public.branches ORDER BY created_at ASC LIMIT 1)
WHERE branch_id IS NULL;

-- Step 4: Create index for performance
CREATE INDEX IF NOT EXISTS idx_orders_branch ON orders(branch_id);

NOTIFY pgrst, 'reload schema';
