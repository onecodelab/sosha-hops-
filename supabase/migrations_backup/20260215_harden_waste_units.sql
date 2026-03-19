-- MIGRATION: 20260215_harden_waste_units.sql
-- PURPOSE: Refactor waste logging to use strict Unit IDs

BEGIN;

-- 1. Add unit_id to waste_logs
ALTER TABLE public.waste_logs 
ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id);

-- 2. Backfill unit_id from ingredients/units map
-- This ensures historical logs are normalized
UPDATE public.waste_logs wl
SET unit_id = i.unit_id
FROM public.ingredients i
WHERE wl.ingredient_id = i.id
AND wl.unit_id IS NULL;

-- 3. Update submit_waste_report RPC
CREATE OR REPLACE FUNCTION public.submit_waste_report(
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
    v_branch_id UUID;
    v_user_id UUID;
    v_current_stock NUMERIC;
    v_cost_per_unit NUMERIC;
    v_unit_id UUID;
    v_total_cost NUMERIC;
    v_new_log_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- A. Get User's Branch
    SELECT home_branch_id INTO v_branch_id
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_branch_id IS NULL THEN
        RAISE EXCEPTION 'User is not assigned to a branch.';
    END IF;

    -- B. Get Current Stock & Cost Details (Using Unit ID)
    SELECT 
        bi.current_stock,
        i.cost_per_unit,
        i.unit_id
    INTO 
        v_current_stock,
        v_cost_per_unit,
        v_unit_id
    FROM public.branch_inventory bi
    JOIN public.ingredients i ON i.id = bi.ingredient_id
    WHERE bi.ingredient_id = p_ingredient_id 
    AND bi.branch_id = v_branch_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ingredient not found in this branch inventory.';
    END IF;

    -- C. SAFEGUARD: Anti-Fat-Finger Rule
    IF p_quantity > v_current_stock THEN
        RAISE EXCEPTION 'Cannot waste more than current stock (Current: %, Requested: %)', v_current_stock, p_quantity;
    END IF;

    -- D. Calculate Cost Snapshot
    v_total_cost := (COALESCE(v_cost_per_unit, 0) * p_quantity);

    -- E. Insert Log (Updating unit_id and maintaining unit_type for snapshot)
    INSERT INTO public.waste_logs (
        branch_id,
        ingredient_id,
        reported_by,
        waste_reason,
        quantity,
        unit_id,
        unit_type, -- Keep for historical display string
        cost_snapshot,
        notes
    ) VALUES (
        v_branch_id,
        p_ingredient_id,
        v_user_id,
        p_reason,
        p_quantity,
        v_unit_id,
        (SELECT abbreviation FROM public.units WHERE id = v_unit_id),
        v_total_cost,
        p_notes
    ) RETURNING id INTO v_new_log_id;

    -- F. Deduct Inventory
    UPDATE public.branch_inventory
    SET 
        current_stock = current_stock - p_quantity,
        last_updated = NOW()
    WHERE ingredient_id = p_ingredient_id 
    AND branch_id = v_branch_id;

    RETURN jsonb_build_object(
        'success', true,
        'log_id', v_new_log_id,
        'new_stock', v_current_stock - p_quantity
    );
END;
$$;

COMMIT;
