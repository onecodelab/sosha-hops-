-- ============================================================
-- MASTER FIX: PO Receive → Inventory Pipeline
-- ============================================================
-- PURPOSE: Fix the entire "Received" flow so clicking "Received"
--          on a PO actually adds goods to the branch inventory.
-- FIXES:
--   1. Missing `grn_status` enum
--   2. Missing `goods_received_notes` table
--   3. Missing `grn_items` table
--   4. Missing `increment_stock` function
--   5. Broken `receive_purchase_order` RPC (was missing branch_id in stock call)
-- DATE: 2026-02-15
-- RUN IN: Supabase SQL Editor

-- ============================================================
-- STEP 1: Create the `grn_status` enum
-- ============================================================
DO $$ BEGIN
    CREATE TYPE public.grn_status AS ENUM ('pending', 'partial', 'complete');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- STEP 2: Create Goods Received Notes table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.goods_received_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    po_id UUID NOT NULL REFERENCES public.purchase_orders(id) ON DELETE CASCADE,
    grn_number TEXT NOT NULL,
    received_date DATE NOT NULL,
    invoice_number TEXT,
    received_by UUID REFERENCES public.profiles(id),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    status public.grn_status DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grn_po_id ON public.goods_received_notes(po_id);

-- ============================================================
-- STEP 3: Create GRN Items table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.grn_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    grn_id UUID NOT NULL REFERENCES public.goods_received_notes(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES public.ingredients(id),
    ordered_quantity NUMERIC NOT NULL DEFAULT 0,
    received_quantity NUMERIC NOT NULL DEFAULT 0,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_grn_items_grn ON public.grn_items(grn_id);
CREATE INDEX IF NOT EXISTS idx_grn_items_ingredient ON public.grn_items(ingredient_id);

-- ============================================================
-- STEP 4: RLS for GRN tables
-- ============================================================
ALTER TABLE public.goods_received_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.grn_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Managers can manage GRNs" ON public.goods_received_notes;
CREATE POLICY "Managers can manage GRNs" ON public.goods_received_notes
    FOR ALL USING (public.get_user_role() IN ('owner', 'admin', 'manager'));

DROP POLICY IF EXISTS "Managers can manage GRN items" ON public.grn_items;
CREATE POLICY "Managers can manage GRN items" ON public.grn_items
    FOR ALL USING (public.get_user_role() IN ('owner', 'admin', 'manager'));

-- ============================================================
-- STEP 5: Create the missing `increment_stock` helper
-- ============================================================
-- The receive_purchase_order RPC calls this function, but it was
-- never created. Without it, the entire receive flow crashes.

CREATE OR REPLACE FUNCTION public.increment_stock(
    p_branch_id     UUID,
    p_ingredient_id UUID,
    p_quantity      NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Upsert: If branch_inventory row exists, increment.
    --         If not (new ingredient added mid-operation), create with received qty.
    INSERT INTO public.branch_inventory (branch_id, ingredient_id, current_stock, last_updated)
    VALUES (p_branch_id, p_ingredient_id, p_quantity, NOW())
    ON CONFLICT (branch_id, ingredient_id)
    DO UPDATE SET
        current_stock = public.branch_inventory.current_stock + EXCLUDED.current_stock,
        last_updated  = NOW();
END;
$$;

-- ============================================================
-- STEP 6: Ensure required columns exist on PO tables
-- ============================================================
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS received_date DATE;
ALTER TABLE public.po_activity_log ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Backfill organization_id on po_activity_log from the parent PO
UPDATE public.po_activity_log pal
SET organization_id = po.organization_id
FROM public.purchase_orders po
WHERE pal.po_id = po.id AND pal.organization_id IS NULL;

-- ============================================================
-- STEP 7: Recreate the `receive_purchase_order` RPC (FIXED)
-- ============================================================
-- The original call was:
--   PERFORM public.increment_stock(ingredient_id, quantity);
-- FIXED: Now passes branch_id so the correct branch gets the stock.

DROP FUNCTION IF EXISTS public.receive_purchase_order(UUID, TEXT, DATE, JSONB);

CREATE OR REPLACE FUNCTION public.receive_purchase_order(
    p_po_id UUID,
    p_invoice_number TEXT,
    p_received_date DATE,
    p_items JSONB -- Array of {ingredient_id, received_quantity}
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_grn_id UUID;
    v_grn_number TEXT;
    v_user_id UUID;
    v_org_id UUID;
    v_branch_id UUID;
    v_item JSONB;
    v_all_complete BOOLEAN := true;
    v_po_item RECORD;
BEGIN
    v_user_id := auth.uid();
    
    -- 1. Get Context
    SELECT organization_id, branch_id INTO v_org_id, v_branch_id
    FROM public.purchase_orders
    WHERE id = p_po_id;

    IF v_branch_id IS NULL THEN
        RAISE EXCEPTION 'Purchase Order not found.';
    END IF;

    -- 2. Create GRN Header
    v_grn_number := 'GRN-' || to_char(NOW(), 'YYYYMMDD') || '-' || LPAD(floor(random()*1000)::text, 3, '0');
    
    INSERT INTO public.goods_received_notes (
        po_id,
        grn_number,
        received_date,
        invoice_number,
        received_by,
        organization_id,
        status
    ) VALUES (
        p_po_id,
        v_grn_number,
        p_received_date,
        p_invoice_number,
        v_user_id,
        v_org_id,
        'pending'
    ) RETURNING id INTO v_grn_id;

    -- 3. Process Each Received Item
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        -- A. Record GRN Line Item
        INSERT INTO public.grn_items (
            grn_id,
            ingredient_id,
            ordered_quantity,
            received_quantity,
            organization_id
        ) 
        SELECT 
            v_grn_id,
            poi.ingredient_id,
            poi.ordered_quantity,
            (v_item->>'received_quantity')::NUMERIC,
            v_org_id
        FROM public.purchase_order_items poi
        WHERE poi.po_id = p_po_id AND poi.ingredient_id = (v_item->>'ingredient_id')::UUID;

        -- B. Record Inventory Transaction (Audit Trail)
        INSERT INTO public.inventory_transactions (
            branch_id,
            ingredient_id,
            transaction_type,
            quantity,
            reference_type,
            reference_id,
            performed_by,
            organization_id
        ) VALUES (
            v_branch_id,
            (v_item->>'ingredient_id')::UUID,
            'purchase',
            (v_item->>'received_quantity')::NUMERIC,
            'grn',
            v_grn_id,
            v_user_id,
            v_org_id
        );

        -- C. UPDATE BRANCH INVENTORY (The Critical Fix!)
        PERFORM public.increment_stock(
            v_branch_id,                              -- ← Was missing before!
            (v_item->>'ingredient_id')::UUID,
            (v_item->>'received_quantity')::NUMERIC
        );
    END LOOP;

    -- 4. Determine Completion Status
    -- Check if ALL items in original PO are fully received across all GRNs
    FOR v_po_item IN SELECT ingredient_id, ordered_quantity FROM public.purchase_order_items WHERE po_id = p_po_id LOOP
        IF (SELECT COALESCE(SUM(gi.received_quantity), 0) FROM public.grn_items gi 
            JOIN public.goods_received_notes g ON gi.grn_id = g.id
            WHERE g.po_id = p_po_id AND gi.ingredient_id = v_po_item.ingredient_id) < v_po_item.ordered_quantity 
        THEN
            v_all_complete := false;
        END IF;
    END LOOP;

    -- Update GRN Status
    UPDATE public.goods_received_notes 
    SET status = CASE 
        WHEN v_all_complete THEN 'complete'::public.grn_status 
        ELSE 'partial'::public.grn_status 
    END 
    WHERE id = v_grn_id;

    -- Update PO Status
    UPDATE public.purchase_orders 
    SET 
        status = CASE 
            WHEN v_all_complete THEN 'verified'::public.po_status 
            ELSE 'partial_received'::public.po_status 
        END,
        received_date = p_received_date,
        updated_at = NOW()
    WHERE id = p_po_id;

    -- 5. Log Activity
    INSERT INTO public.po_activity_log (
        po_id,
        action_type,
        performed_by,
        notes,
        organization_id
    ) VALUES (
        p_po_id,
        'received',
        v_user_id,
        'Recorded receipt of goods (GRN: ' || v_grn_number || ')',
        v_org_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'grn_id', v_grn_id,
        'grn_number', v_grn_number,
        'is_complete', v_all_complete
    );
END;
$$;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
