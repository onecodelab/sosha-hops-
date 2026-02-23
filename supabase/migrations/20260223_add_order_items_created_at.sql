-- Add created_at to order_items so kitchen can distinguish new vs old items
ALTER TABLE public.order_items
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Backfill existing items with the parent order's created_at
UPDATE public.order_items oi
SET created_at = o.created_at
FROM public.orders o
WHERE oi.order_id = o.id
AND oi.created_at IS NULL;
