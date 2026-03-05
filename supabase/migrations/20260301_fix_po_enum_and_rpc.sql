-- ULTIMATE PO STATUS & RPC REPAIR (FINAL HARDENED v5)
-- 1. Ensure all required enums exist

-- A. po_status
DO $$
BEGIN
    ALTER TYPE public.po_status ADD VALUE IF NOT EXISTS 'draft';
    ALTER TYPE public.po_status ADD VALUE IF NOT EXISTS 'pending_approval';
    ALTER TYPE public.po_status ADD VALUE IF NOT EXISTS 'pending';
    ALTER TYPE public.po_status ADD VALUE IF NOT EXISTS 'approved';
    ALTER TYPE public.po_status ADD VALUE IF NOT EXISTS 'sent';
    ALTER TYPE public.po_status ADD VALUE IF NOT EXISTS 'coming';
    ALTER TYPE public.po_status ADD VALUE IF NOT EXISTS 'received';
    ALTER TYPE public.po_status ADD VALUE IF NOT EXISTS 'verified';
    ALTER TYPE public.po_status ADD VALUE IF NOT EXISTS 'partial_received';
    ALTER TYPE public.po_status ADD VALUE IF NOT EXISTS 'needs_revision';
    ALTER TYPE public.po_status ADD VALUE IF NOT EXISTS 'cancelled';
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- B. po_action_type (Fixing the "type public.po_action_type does not exist" error)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'po_action_type') THEN
        CREATE TYPE public.po_action_type AS ENUM (
            'created',
            'draft_saved',
            'submitted',
            'approved',
            'rejected',
            'sent',
            'received',
            'verified',
            'revised',
            'cancelled',
            'revision_requested'
        );
    END IF;
END $$;

-- 2. Hardening the PO related tables
-- Adding missing columns that the RPC and app expect in current multi-tenancy model

-- A. Purchase Order Items
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id);
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- B. PO Activity Log
ALTER TABLE public.po_activity_log ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Backfill organization_id for orphaned logs if missing (using parent PO's org)
UPDATE public.po_activity_log pal
SET organization_id = po.organization_id
FROM public.purchase_orders po
WHERE pal.po_id = po.id AND pal.organization_id IS NULL;

-- 3. Fix the submit_purchase_order RPC (FINAL HARDENED VERSION)
CREATE OR REPLACE FUNCTION public.submit_purchase_order(
    p_supplier_id UUID,
    p_branch_id UUID,
    p_items JSONB, -- Array of {ingredient_id, quantity, unit_price}
    p_expected_delivery DATE,
    p_is_draft BOOLEAN DEFAULT false,
    p_po_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_po_id UUID;
    v_po_number TEXT;
    v_user_id UUID;
    v_item JSONB;
    v_total_amount NUMERIC := 0;
    v_status public.po_status;
    v_role TEXT;
    v_org_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- 1. Identity & Context Check
    SELECT role, organization_id INTO v_role, v_org_id FROM public.profiles WHERE id = v_user_id;
    
    IF v_user_id IS NULL OR v_org_id IS NULL THEN
        RAISE EXCEPTION 'Authentication or Organization context missing.';
    END IF;

    -- Determine Lifecycle Status
    IF p_is_draft THEN
        v_status := 'draft'::public.po_status;
    ELSIF v_role IN ('owner', 'admin', 'super_admin') THEN
        v_status := 'sent'::public.po_status;
    ELSE
        v_status := 'pending_approval'::public.po_status;
    END IF;

    -- 2. Calculate Transaction Total
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_total_amount := v_total_amount + ((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC);
    END LOOP;

    -- 3. Upsert PO Manifest Header
    IF p_po_id IS NOT NULL THEN
        UPDATE public.purchase_orders
        SET 
            supplier_id = p_supplier_id,
            expected_delivery = p_expected_delivery,
            total_amount = v_total_amount,
            status = v_status,
            updated_at = NOW()
        WHERE id = p_po_id AND organization_id = v_org_id
        RETURNING id INTO v_po_id;
        
        IF NOT FOUND THEN RAISE EXCEPTION 'Purchase Order not found or access denied.'; END IF;

        -- Purge old items for clean sync
        DELETE FROM public.purchase_order_items WHERE po_id = v_po_id;
    ELSE
        -- Generate Protocol-compliant PO Number
        v_po_number := 'PO-' || to_char(NOW(), 'YYYYMMDD') || '-' || LPAD(floor(random()*10000)::text, 4, '0');
        
        INSERT INTO public.purchase_orders (
            po_number,
            supplier_id,
            branch_id,
            expected_delivery,
            total_amount,
            status,
            created_by,
            organization_id
        ) VALUES (
            v_po_number,
            p_supplier_id,
            p_branch_id,
            p_expected_delivery,
            v_total_amount,
            v_status,
            v_user_id,
            v_org_id
        ) RETURNING id INTO v_po_id;
    END IF;

    -- 4. Sync Items
    INSERT INTO public.purchase_order_items (
        po_id,
        ingredient_id,
        ordered_quantity,
        unit_price,
        unit_id,
        organization_id
    )
    SELECT 
        v_po_id,
        (item->>'ingredient_id')::UUID,
        (item->>'quantity')::NUMERIC,
        (item->>'unit_price')::NUMERIC,
        (SELECT unit_id FROM public.ingredients WHERE id = (item->>'ingredient_id')::UUID),
        v_org_id
    FROM jsonb_array_elements(p_items) AS item;

    -- 5. Audit Trail
    INSERT INTO public.po_activity_log (
        po_id,
        action_type,
        performed_by,
        notes,
        organization_id
    ) VALUES (
        v_po_id,
        CASE WHEN p_is_draft THEN 'draft_saved'::public.po_action_type ELSE 'submitted'::public.po_action_type END,
        v_user_id,
        CASE WHEN p_po_id IS NOT NULL THEN 'Updated manifest content' ELSE 'Initialized protocol' END,
        v_org_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'po_id', v_po_id,
        'status', v_status
    );
END;
$$;

-- 4. Supplier List Hygiene
UPDATE public.suppliers 
SET is_active = false 
WHERE name IN ('Fresh Farms Ltd', 'Spice House');

NOTIFY pgrst, 'reload schema';
