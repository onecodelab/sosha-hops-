-- CLEANUP: The Banana Cleanse
-- Use this to wipe all 'Banana' mappings so you can set it up correctly in one menu.

DO $$ 
DECLARE
    v_banana_id UUID;
BEGIN
    -- 1. Get the Banana ID
    SELECT id INTO v_banana_id FROM public.ingredients WHERE name ILIKE '%banana%' LIMIT 1;

    IF v_banana_id IS NULL THEN
        RAISE NOTICE 'No Banana found to cleanse.';
        RETURN;
    END IF;

    -- 2. Clear all recipe_ingredients mapping for this ID
    DELETE FROM public.recipe_ingredients WHERE ingredient_id = v_banana_id;

    RAISE NOTICE 'SUCCESS: All Ghost Mappings for Banana have been cleared.';
    RAISE NOTICE 'You can now go to "Menu Management" and map it correctly to your one menu.';
END $$;
