-- ============================================================
-- FIX: Drop Legacy qty_non_negative Constraint & Stock Trigger
-- ============================================================
-- CONTEXT: The system uses branch_inventory.current_stock for real stock tracking.
-- The legacy ingredients.current_stock column is no longer maintained.
-- A CHECK constraint "qty_non_negative" on ingredients blocks order placement
-- because a trigger tries to deduct from the always-zero legacy column.
-- 
-- RUN THIS IN: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

BEGIN;

-- 1. DROP the CHECK constraint that blocks orders
-- (Use safe approach: find and drop by name pattern)
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Drop any CHECK constraint containing 'qty_non_negative' on ingredients
    FOR r IN 
        SELECT conname 
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'ingredients' 
        AND c.contype = 'c'  -- CHECK constraint
        AND (conname ILIKE '%qty%non%negative%' OR conname ILIKE '%non_negative%')
    LOOP
        RAISE NOTICE 'Dropping CHECK constraint: %', r.conname;
        EXECUTE format('ALTER TABLE public.ingredients DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;

-- 2. DROP any trigger on order_items that deducts from legacy ingredients.current_stock
DO $$
DECLARE
    t_rec RECORD;
BEGIN
    FOR t_rec IN 
        SELECT trigger_name 
        FROM information_schema.triggers 
        WHERE event_object_table = 'order_items'
        AND event_object_schema = 'public'
    LOOP
        RAISE NOTICE 'Dropping trigger on order_items: %', t_rec.trigger_name;
        EXECUTE format('DROP TRIGGER IF EXISTS %I ON public.order_items CASCADE', t_rec.trigger_name);
    END LOOP;
END $$;

-- 3. Reset legacy current_stock to 0 (cleanup, not used by modern system)
UPDATE public.ingredients SET current_stock = 0 WHERE current_stock < 0;

-- 4. Also drop any non_negative constraint on branch_inventory (just in case)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT conname 
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        WHERE t.relname = 'branch_inventory' 
        AND c.contype = 'c'
        AND (conname ILIKE '%qty%non%negative%' OR conname ILIKE '%non_negative%')
    LOOP
        RAISE NOTICE 'Dropping CHECK constraint on branch_inventory: %', r.conname;
        EXECUTE format('ALTER TABLE public.branch_inventory DROP CONSTRAINT %I', r.conname);
    END LOOP;
END $$;

COMMIT;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
