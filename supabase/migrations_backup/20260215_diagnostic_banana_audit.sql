-- Diagnostic: Banana Audit & Recipe Integrity
-- Date: 2026-02-15

DO $$ 
DECLARE
    v_banana_id UUID;
    v_report RECORD;
BEGIN
    -- 1. Find the Banana Ingredient ID
    SELECT id INTO v_banana_id FROM public.ingredients WHERE name ILIKE '%banana%' LIMIT 1;
    
    IF v_banana_id IS NULL THEN
        RAISE NOTICE '--- AUDIT ERROR: No ingredient found matching "Banana" ---';
        RETURN;
    END IF;

    RAISE NOTICE '--- AUDIT REPORT: BANANA DEPENDENCIES ---';
    RAISE NOTICE 'Ingredient ID: %', v_banana_id;

    -- 2. Audit recipe_ingredients for Banana
    FOR v_report IN (
        SELECT 
            m.name as menu_name, 
            m.id as menu_id,
            r.id as recipe_id,
            ri.quantity_needed,
            ri.unit_id
        FROM public.recipe_ingredients ri
        JOIN public.recipes r ON ri.recipe_id = r.id
        JOIN public.menu m ON r.menu_item_id = m.id
        WHERE ri.ingredient_id = v_banana_id
    ) LOOP
        RAISE NOTICE 'Linked Menu: % (ID: %) | Recipe ID: % | Qty: %', 
            v_report.menu_name, v_report.menu_id, v_report.recipe_id, v_report.quantity_needed;
    END LOOP;

    -- 3. Check for Duplicate Recipe Headers (Inconsistency Check)
    RAISE NOTICE '--- AUDIT REPORT: DUPLICATE RECIPE HEADERS ---';
    FOR v_report IN (
        SELECT menu_item_id, COUNT(*) as recipe_count
        FROM public.recipes
        GROUP BY menu_item_id
        HAVING COUNT(*) > 1
    ) LOOP
        RAISE NOTICE 'Warning: Menu Item ID % has % recipe headers!', v_report.menu_item_id, v_report.recipe_count;
    END LOOP;

    RAISE NOTICE '-----------------------------------------';

END $$;
