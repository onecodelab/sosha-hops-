-- Simulation: The Urgency Engine (Phase 2)
-- Demonstrating "Time to Exhaustion" (TTE) and predictive gap detection.

DO $$ 
DECLARE
    v_branch_id UUID;
    v_banana_id UUID;
    v_org_id UUID;
BEGIN
    -- 1. Setup Context
    SELECT id INTO v_branch_id FROM public.branches LIMIT 1;
    SELECT id, organization_id INTO v_banana_id, v_org_id FROM public.ingredients WHERE name ILIKE '%banana%' LIMIT 1;

    RAISE NOTICE '--- PHASE 2 SIMULATION: URGENCY ENGINE ---';

    -- 2. Configure Urgency Metadata
    UPDATE public.ingredients 
    SET lead_time_hours = 12, storage_life_hours = 72 
    WHERE id = v_banana_id;

    -- 3. Simulate Sales History (To generate "Pace")
    -- We'll insert a few orders in the last hour to simulate high velocity
    WITH new_order AS (
        INSERT INTO public.orders (organization_id, branch_id, table_id, waiter_id, status, total_amount, source)
        VALUES (v_org_id, v_branch_id, (SELECT id FROM public.tables WHERE branch_id = v_branch_id LIMIT 1), 
                (SELECT id FROM public.profiles WHERE organization_id = v_org_id LIMIT 1), 'paid', 500, 'dine_in')
        RETURNING id
    )
    INSERT INTO public.order_items (order_id, menu_item_id, quantity, price)
    SELECT 
        new_order.id, 
        m.id, 
        5, -- Buying 5 units
        m.price
    FROM new_order, public.menu m
    JOIN public.recipes r ON m.id = r.menu_item_id
    JOIN public.recipe_ingredients ri ON r.id = ri.recipe_id
    WHERE ri.ingredient_id = v_banana_id
    LIMIT 1;

    -- 4. Trigger the Engine (Update current stock)
    -- We assume current stock is 5kg. With the pace we just created, TTE will be very low.
    UPDATE public.branch_inventory 
    SET current_stock = 5.0, par_min = 10, par_max = 30
    WHERE branch_id = v_branch_id AND ingredient_id = v_banana_id;

    RAISE NOTICE 'SUCCESS: Urgency Engine simulation triggered.';
    RAISE NOTICE 'Check the Owner Command Center for a "Procurement Proposal" with TTE analysis.';
END $$;
