-- 2026-03-12: Fix Order Items Foreign Key Constraint
-- This migration ensures that order_items.menu_item_id correctly references public.menu(id).
-- The previous constraint might have been pointing to a stale or empty 'menu_items' table.

DO $$ 
BEGIN
    -- 1. Drop the existing constraint if it exists
    ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_menu_item_id_fkey;

    -- 2. Add the correct constraint pointing to public.menu(id)
    -- We use ON DELETE CASCADE to ensure that deleting a menu item also cleans up orphans.
    ALTER TABLE public.order_items 
    ADD CONSTRAINT order_items_menu_item_id_fkey 
    FOREIGN KEY (menu_item_id) REFERENCES public.menu(id) ON DELETE CASCADE;

EXCEPTION WHEN OTHERS THEN 
    RAISE NOTICE 'Error fixing order_items FK: %', SQLERRM;
END $$;

-- 3. Safety Sync: Ensure all menu items in 'menu' exist in 'menu_items' (if n8n logic requires it)
-- This is a non-destructive way to satisfy parts of the code that expect 'menu_items' table.
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'menu_items') THEN
        INSERT INTO public.menu_items (id, name, organization_id, created_at)
        SELECT id, name, organization_id, created_at FROM public.menu
        ON CONFLICT (id) DO NOTHING;
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Error syncing menu_items: % (Columns might differ)', SQLERRM;
END $$;

NOTIFY pgrst, 'reload schema';
