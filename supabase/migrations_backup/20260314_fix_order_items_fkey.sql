-- Fix: order_items_menu_item_id_fkey mismatch
-- The current constraint likely points to 'menu_items' table, but the application uses 'menu' table.

DO $$
BEGIN
    -- 1. Drop the existing problematic constraint
    ALTER TABLE public.order_items DROP CONSTRAINT IF EXISTS order_items_menu_item_id_fkey;

    -- 2. Add the correct constraint pointing to public.menu(id)
    ALTER TABLE public.order_items
    ADD CONSTRAINT order_items_menu_item_id_fkey
    FOREIGN KEY (menu_item_id) REFERENCES public.menu(id) ON DELETE CASCADE;
END $$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
