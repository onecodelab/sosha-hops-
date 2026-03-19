-- ============================================================
-- FIX: Drop Duplicate Foreign Keys from order_items to menu
-- ============================================================
-- CONTEXT: PostgREST fails with "Could not embed because more than one
-- relationship was found for 'order_items' and 'menu'"
-- This means order_items has multiple FKs pointing to the menu table.
-- We keep ONLY the correct one: order_items_menu_item_id_fkey.
--
-- RUN THIS IN: Supabase Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

BEGIN;

-- 1. List all foreign keys from order_items to menu (diagnostic)
DO $$
DECLARE
    r RECORD;
    kept_one BOOLEAN := FALSE;
BEGIN
    FOR r IN
        SELECT c.conname AS constraint_name,
               a.attname AS column_name
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_class ref ON c.confrelid = ref.oid
        JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
        WHERE t.relname = 'order_items'
        AND ref.relname = 'menu'
        AND c.contype = 'f'
    LOOP
        RAISE NOTICE 'Found FK: % on column %', r.constraint_name, r.column_name;
        
        -- Keep the canonical one, drop all others
        IF r.constraint_name = 'order_items_menu_item_id_fkey' THEN
            kept_one := TRUE;
            RAISE NOTICE '  → KEEPING (canonical)';
        ELSE
            RAISE NOTICE '  → DROPPING (duplicate)';
            EXECUTE format('ALTER TABLE public.order_items DROP CONSTRAINT %I', r.constraint_name);
        END IF;
    END LOOP;
    
    -- If the canonical one doesn't exist, create it
    IF NOT kept_one THEN
        RAISE NOTICE 'Canonical FK missing, creating order_items_menu_item_id_fkey...';
        BEGIN
            ALTER TABLE public.order_items
            ADD CONSTRAINT order_items_menu_item_id_fkey
            FOREIGN KEY (menu_item_id) REFERENCES public.menu(id) ON DELETE CASCADE;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Could not create canonical FK: %', SQLERRM;
        END;
    END IF;
END $$;

-- 2. Also check for any FK from order_items to menu_items (legacy table)
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN
        SELECT c.conname AS constraint_name
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_class ref ON c.confrelid = ref.oid
        WHERE t.relname = 'order_items'
        AND ref.relname = 'menu_items'
        AND c.contype = 'f'
    LOOP
        RAISE NOTICE 'Dropping legacy FK to menu_items: %', r.constraint_name;
        EXECUTE format('ALTER TABLE public.order_items DROP CONSTRAINT %I', r.constraint_name);
    END LOOP;
END $$;

COMMIT;

-- Reload schema cache so PostgREST picks up the change
NOTIFY pgrst, 'reload schema';
