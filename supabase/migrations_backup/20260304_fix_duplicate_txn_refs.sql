-- FIX: Clean up duplicate transaction_references before creating unique index
-- This nullifies duplicates, keeping only the LATEST order's reference.

-- Step 1: Find and nullify older duplicates
UPDATE public.orders
SET transaction_reference = NULL
WHERE id IN (
    SELECT id FROM (
        SELECT id,
               ROW_NUMBER() OVER (PARTITION BY transaction_reference ORDER BY created_at DESC) as rn
        FROM public.orders
        WHERE transaction_reference IS NOT NULL
          AND transaction_reference != ''
    ) dupes
    WHERE rn > 1
);

-- Step 2: Now create the unique index (should succeed)
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_txn_ref_unique
ON public.orders (transaction_reference)
WHERE transaction_reference IS NOT NULL AND transaction_reference != '';

NOTIFY pgrst, 'reload schema';
