-- Migration to fix missing foreign keys on tips_ledger
ALTER TABLE public.tips_ledger
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;

ALTER TABLE public.tips_ledger
ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- Add indexes for better query performance since we join on these
CREATE INDEX IF NOT EXISTS idx_tips_ledger_order_id ON public.tips_ledger(order_id);
CREATE INDEX IF NOT EXISTS idx_tips_ledger_staff_id ON public.tips_ledger(staff_id);
