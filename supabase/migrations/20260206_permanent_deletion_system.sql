-- SOSHA OS: Permanent Menu Item Deletion System
-- Handles cascading deletion across menu, recipes, and order history.

CREATE OR REPLACE FUNCTION public.permanently_delete_menu_item(target_id UUID)
RETURNS void AS $$
BEGIN
    -- 1. Delete associated order items (History)
    -- This preventing FK errors and clears the history as requested.
    DELETE FROM public.order_items WHERE menu_item_id = target_id;
    
    -- 2. Delete the menu item
    -- This will automatically cascade to 'recipes' and 'recipe_ingredients' 
    -- due to the existing ON DELETE CASCADE constraints.
    DELETE FROM public.menu WHERE id = target_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Reload schema
NOTIFY pgrst, 'reload schema';
