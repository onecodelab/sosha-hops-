-- BARO OS: Deep Delete & Wipe Protocol
-- Date: 2026-02-15
-- Purpose: Permanently purge a menu item and all its associated data from the project.

-- 0. Drop old version to allow return type change (void -> jsonb)
DROP FUNCTION IF EXISTS public.permanently_delete_menu_item(UUID);

CREATE OR REPLACE FUNCTION public.permanently_delete_menu_item(target_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_dish_name TEXT;
    v_org_id UUID;
BEGIN
    -- 1. Get meta for logging
    SELECT name, organization_id INTO v_dish_name, v_org_id 
    FROM public.menu WHERE id = target_id;

    IF v_dish_name IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Menu item not found');
    END IF;

    -- 2. Deep Wipe Protocol
    -- a. Clean Order Items (History Wipe)
    DELETE FROM public.order_items WHERE menu_item_id = target_id;

    -- b. Clean Recipe Ingredients (Ensuring no orphans if cascade is missing)
    DELETE FROM public.recipe_ingredients 
    WHERE recipe_id IN (SELECT id FROM public.recipes WHERE menu_item_id = target_id);

    -- c. Clean Recipes
    DELETE FROM public.recipes WHERE menu_item_id = target_id;

    -- d. Clean branch_menu (If usage exists)
    -- DELETE FROM public.branch_menu WHERE menu_item_id = target_id; 

    -- e. Final: Delete the Menu Stem
    DELETE FROM public.menu WHERE id = target_id;

    -- 3. Log the WIPE in Business Audit
    INSERT INTO public.business_audit_logs (
        organization_id,
        event_type,
        entity_type,
        entity_id,
        metadata
    ) VALUES (
        v_org_id,
        'PERMANENT_WIPE',
        'menu',
        target_id,
        jsonb_build_object('name', v_dish_name, 'reason', 'Owner Deep Deletion Request')
    );

    RETURN jsonb_build_object(
        'success', true, 
        'message', 'Permanent wipe complete for ' || v_dish_name
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Force Schema Refresh
NOTIFY pgrst, 'reload schema';
