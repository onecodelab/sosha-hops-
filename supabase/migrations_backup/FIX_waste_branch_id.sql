-- FIX: Submit Waste to Correct Branch
-- The previous version blindly used the user's "Home Branch", ignoring the active UI selection.
-- This version accepts 'p_branch_id' explicitly from the frontend.

CREATE OR REPLACE FUNCTION public.submit_waste_report(
    p_branch_id UUID, -- NEW: Explicit branch target
    p_ingredient_id UUID,
    p_quantity NUMERIC,
    p_reason TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_current_stock NUMERIC;
    v_cost_per_unit NUMERIC;
    v_unit_type TEXT;
    v_total_cost NUMERIC;
    v_new_log_id UUID;
BEGIN
    v_user_id := auth.uid();

    -- Use the passed branch_id, but verify it exists (optional safety)
    -- We trust the frontend context for "which branch am I in", 
    -- but you could add a check here if users must only waste in THEIR home branch.
    -- For now, we allow flexibility (multi-branch managers helping out).

    -- B. Get Current Stock & Cost Details FROM THE TARGET BRANCH
    SELECT 
        bi.current_stock,
        i.cost_per_unit,
        i.unit_type
    INTO 
        v_current_stock,
        v_cost_per_unit,
        v_unit_type
    FROM public.branch_inventory bi
    JOIN public.ingredients i ON i.id = bi.ingredient_id
    WHERE bi.ingredient_id = p_ingredient_id 
    AND bi.branch_id = p_branch_id; -- Use explicit branch

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ingredient not found in the selected branch inventory.';
    END IF;

    -- C. SAFEGUARD: Anti-Fat-Finger Rule
    IF p_quantity > v_current_stock THEN
        RAISE EXCEPTION 'Cannot waste more than current stock (Current: %, Requested: %)', v_current_stock, p_quantity;
    END IF;

    -- D. Calculate Cost Snapshot
    v_total_cost := (COALESCE(v_cost_per_unit, 0) * p_quantity);

    -- E. Insert Log
    INSERT INTO public.waste_logs (
        branch_id,
        ingredient_id,
        reported_by,
        waste_reason,
        quantity,
        unit_type,
        cost_snapshot,
        notes
    ) VALUES (
        p_branch_id, -- Use explicit branch
        p_ingredient_id,
        v_user_id,
        p_reason,
        p_quantity,
        COALESCE(v_unit_type, 'unit'),
        v_total_cost,
        p_notes
    ) RETURNING id INTO v_new_log_id;

    -- F. Deduct Inventory (Atomic update)
    UPDATE public.branch_inventory
    SET 
        current_stock = current_stock - p_quantity,
        last_updated = NOW()
    WHERE branch_id = p_branch_id
    AND ingredient_id = p_ingredient_id;

    RETURN jsonb_build_object('success', true, 'log_id', v_new_log_id, 'new_stock', v_current_stock - p_quantity);
END;
$$;

NOTIFY pgrst, 'reload schema';
