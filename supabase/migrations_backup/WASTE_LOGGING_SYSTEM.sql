-- FEATURE: Supply Chain Waste Management
-- Implements "Write-Only" waste logging with automatic inventory deduction.

-- 1. Create Waste Logs Table
CREATE TABLE IF NOT EXISTS public.waste_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id) ON DELETE CASCADE,
    reported_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    
    waste_reason TEXT NOT NULL CHECK (waste_reason IN ('spoiled', 'burnt', 'dropped', 'expired', 'overproduction', 'other')),
    quantity NUMERIC NOT NULL CHECK (quantity > 0),
    unit_type TEXT NOT NULL, -- Snapshot of unit at time of waste
    
    cost_snapshot NUMERIC NOT NULL DEFAULT 0, -- Snapshot of cost_per_unit * qty
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Secure RPC for Waste Submission
-- Handles validation, stock check, cost snapshot, and inventory update atomically.
CREATE OR REPLACE FUNCTION public.submit_waste_report(
    p_ingredient_id UUID,
    p_quantity NUMERIC,
    p_reason TEXT,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Run as superuser to bypass RLS on ingredients/inventory if needed
AS $$
DECLARE
    v_branch_id UUID;
    v_user_id UUID;
    v_current_stock NUMERIC;
    v_cost_per_unit NUMERIC;
    v_unit_type TEXT;
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

    -- B. Get Current Stock & Cost Details
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
        v_branch_id,
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
    WHERE branch_id = v_branch_id
    AND ingredient_id = p_ingredient_id;

    RETURN jsonb_build_object('success', true, 'log_id', v_new_log_id, 'new_stock', v_current_stock - p_quantity);
END;
$$;

-- 3. RLS Security Policies
ALTER TABLE public.waste_logs ENABLE ROW LEVEL SECURITY;

-- KITCHEN: DENY SELECT (Implicit, no Select policy created means Deny)
-- KITCHEN: INSERT blocked directly (must use RPC)

-- MANAGER/ADMIN: View logs for their branch
CREATE POLICY "Managers view branch waste logs"
ON public.waste_logs
FOR SELECT
TO authenticated
USING (
    branch_id IN (
        SELECT home_branch_id FROM public.profiles WHERE id = auth.uid()
    )
    AND
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('manager', 'admin', 'owner')
    )
);

NOTIFY pgrst, 'reload schema';
