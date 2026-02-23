-- Add missing foreign keys to tips_ledger for PostgREST relationship resolution

-- 1. Add FK from tips_ledger.order_id -> orders.id
DO $$ BEGIN
    ALTER TABLE public.tips_ledger
    ADD CONSTRAINT tips_ledger_order_id_fkey
    FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Add FK from tips_ledger.staff_id -> profiles.id
DO $$ BEGIN
    ALTER TABLE public.tips_ledger
    ADD CONSTRAINT tips_ledger_staff_id_fkey
    FOREIGN KEY (staff_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
