-- BARO OS: Consolidated Waste Logging Core (Fixed for Enum Types)
-- This script creates the waste_logs table if missing and updates the report function with enum casting.

BEGIN;

-- 1. Create the enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waste_category') THEN
        CREATE TYPE waste_category AS ENUM ('spoiled', 'burnt', 'dropped', 'expired', 'overproduction', 'other');
    END IF;
END $$;

-- 2. Create Waste Logs Table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.waste_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
    reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    waste_reason waste_category NOT NULL, -- Use the enum type
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_id UUID REFERENCES public.units(id), 
    unit_type TEXT NOT NULL, 
    
    inventory_impact NUMERIC, 
    cost_snapshot NUMERIC NOT NULL DEFAULT 0,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Ensure columns exist and handle type casting if table existed
DO $$ 
BEGIN 
    -- unit_id
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='waste_logs' AND column_name='unit_id') THEN
        ALTER TABLE public.waste_logs ADD COLUMN unit_id UUID REFERENCES public.units(id);
    END IF;
    
    -- inventory_impact
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='waste_logs' AND column_name='inventory_impact') THEN
        ALTER TABLE public.waste_logs ADD COLUMN inventory_impact NUMERIC;
    END IF;

    -- Ensure waste_reason is the correct type (case where it might be TEXT)
    -- This is complex for an ALTER, so we'll rely on the RPC casting if the column is already there.
END $$;

-- 4. Update the RPC to handle units and store inventory impact
CREATE OR REPLACE FUNCTION public.submit_waste_report(
    p_ingredient_id UUID,
    p_quantity NUMERIC,
    p_reason TEXT,
    p_notes TEXT DEFAULT NULL,
    p_unit_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_branch_id UUID;
    v_user_id UUID;
    v_current_stock NUMERIC;
    v_ingredient_unit_id UUID;
    v_weight_per_unit NUMERIC;
    v_cost_per_unit NUMERIC;
    v_unit_type TEXT;
    v_conversion_factor NUMERIC;
    v_normalized_quantity NUMERIC;
    v_total_cost NUMERIC;
    v_new_log_id UUID;
    v_reason_enum waste_category;
BEGIN
    v_user_id := auth.uid();
    
    -- Cast reason to enum safely
    BEGIN
        v_reason_enum := p_reason::waste_category;
    EXCEPTION WHEN OTHERS THEN
        v_reason_enum := 'other'::waste_category; -- Fallback
    END;

    -- A. Get User's Branch
    SELECT home_branch_id INTO v_branch_id
    FROM public.profiles
    WHERE id = v_user_id;

    IF v_branch_id IS NULL THEN
        RAISE EXCEPTION 'User is not assigned to a branch.';
    END IF;

    -- B. Get Ingredient/Inventory Details
    SELECT 
        bi.current_stock,
        i.unit_id,
        i.weight_per_unit,
        i.cost_per_unit,
        COALESCE(u.abbreviation, i.unit_type)
    INTO 
        v_current_stock,
        v_ingredient_unit_id,
        v_weight_per_unit,
        v_cost_per_unit,
        v_unit_type
    FROM public.branch_inventory bi
    JOIN public.ingredients i ON i.id = bi.ingredient_id
    LEFT JOIN public.units u ON u.id = i.unit_id
    WHERE bi.ingredient_id = p_ingredient_id 
    AND bi.branch_id = v_branch_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ingredient not found in this branch inventory.';
    END IF;

    -- C. Calculate Conversion Factor
    IF p_unit_id IS NOT NULL AND p_unit_id != v_ingredient_unit_id THEN
        v_conversion_factor := get_unit_conversion_factor(p_unit_id, v_ingredient_unit_id, v_weight_per_unit);
        v_normalized_quantity := p_quantity * v_conversion_factor;
    ELSE
        v_normalized_quantity := p_quantity;
    END IF;

    -- D. SAFEGUARD: Stock Check
    IF v_normalized_quantity > v_current_stock THEN
        RAISE EXCEPTION 'Cannot waste % % as it exceeds current stock (% %)', 
            p_quantity, (SELECT abbreviation FROM public.units WHERE id = COALESCE(p_unit_id, v_ingredient_unit_id)),
            v_current_stock, v_unit_type;
    END IF;

    -- E. Calculate Cost Snapshot
    v_total_cost := (COALESCE(v_cost_per_unit, 0) * v_normalized_quantity);

    -- F. Insert Log
    INSERT INTO public.waste_logs (
        branch_id,
        ingredient_id,
        reported_by,
        waste_reason,
        quantity,
        unit_id,
        unit_type,
        inventory_impact,
        cost_snapshot,
        notes
    ) VALUES (
        v_branch_id,
        p_ingredient_id,
        v_user_id,
        v_reason_enum, -- Pass the casted enum
        p_quantity,
        COALESCE(p_unit_id, v_ingredient_unit_id),
        (SELECT abbreviation FROM public.units WHERE id = COALESCE(p_unit_id, v_ingredient_unit_id)),
        v_normalized_quantity,
        v_total_cost,
        p_notes
    ) RETURNING id INTO v_new_log_id;

    -- G. Deduct Inventory
    UPDATE public.branch_inventory
    SET 
        current_stock = current_stock - v_normalized_quantity,
        last_updated = NOW()
    WHERE branch_id = v_branch_id
    AND ingredient_id = p_ingredient_id;

    RETURN jsonb_build_object(
        'success', true, 
        'log_id', v_new_log_id, 
        'new_stock', v_current_stock - v_normalized_quantity,
        'inventory_impact', v_normalized_quantity
    );
END;
$$;

COMMIT;
