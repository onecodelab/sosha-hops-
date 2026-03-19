-- FIX: Type Mismatch for waste_reason Enum
-- The error confirms 'waste_reason' is an ENUM (waste_category), but the RPC uses TEXT.
-- This script updates the RPC to cast the text to the enum type.

CREATE OR REPLACE FUNCTION public.submit_waste_report(
    p_branch_id UUID,
    p_ingredient_id UUID,
    p_quantity NUMERIC,
    p_reason TEXT, -- We keep this as text for easy calling
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
    v_reason_enum waste_category; -- Variable of the ENUM type
BEGIN
    v_user_id := auth.uid();

    -- Convert text to enum safely
    BEGIN
        v_reason_enum := p_reason::waste_category;
    EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Invalid waste category provided: %', p_reason;
    END;

    -- Get Stock & Cost from the TARGET branch
    SELECT bi.current_stock, i.cost_per_unit, i.unit_type
    INTO v_current_stock, v_cost_per_unit, v_unit_type
    FROM public.branch_inventory bi
    JOIN public.ingredients i ON i.id = bi.ingredient_id
    WHERE bi.ingredient_id = p_ingredient_id AND bi.branch_id = p_branch_id;

    IF NOT FOUND THEN RAISE EXCEPTION 'Ingredient not found in the selected branch.'; END IF;

    IF p_quantity > v_current_stock THEN
        RAISE EXCEPTION 'Cannot waste more than current stock (Current: %, Requested: %)', v_current_stock, p_quantity;
    END IF;

    v_total_cost := (COALESCE(v_cost_per_unit, 0) * p_quantity);

    -- Insert using the casted enum
    INSERT INTO public.waste_logs (
        branch_id, 
        ingredient_id, 
        reported_by, 
        waste_reason, -- This is the enum column
        quantity, 
        unit_type, 
        cost_snapshot, 
        notes
    ) VALUES (
        p_branch_id, 
        p_ingredient_id, 
        v_user_id, 
        v_reason_enum, -- Pass the enum variable
        p_quantity, 
        COALESCE(v_unit_type, 'unit'), 
        v_total_cost, 
        p_notes
    ) RETURNING id INTO v_new_log_id;

    UPDATE public.branch_inventory SET current_stock = current_stock - p_quantity, last_updated = NOW()
    WHERE branch_id = p_branch_id AND ingredient_id = p_ingredient_id;

    RETURN jsonb_build_object('success', true, 'log_id', v_new_log_id);
END;
$$;

NOTIFY pgrst, 'reload schema';
