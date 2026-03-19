-- ==========================================
-- TOTAL PURCHASE ORDER REPAIR (FINAL)
-- ==========================================
-- This script fixes:
-- 1. Missing Enums (po_status, po_action_type)
-- 2. Missing Columns (unit_id, organization_id)
-- 3. Type Mismatches in RPC
-- 4. Overly Restrictive RLS (Visibility for Managers/Suppliers)

BEGIN;

-- 1. Ensure all required enums exist
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
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'po_action_type') THEN
        CREATE TYPE public.po_action_type AS ENUM (
            'created', 'draft_saved', 'submitted', 'approved', 'rejected', 
            'sent', 'received', 'verified', 'revised', 'cancelled', 'revision_requested', 'updated'
        );
    ELSE
        ALTER TYPE public.po_action_type ADD VALUE IF NOT EXISTS 'updated';
    END IF;
END $$;

-- 2. Hardening the PO related tables
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id);
ALTER TABLE public.purchase_order_items ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

ALTER TABLE public.po_activity_log ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Backfill organization_id for orphaned records
UPDATE public.purchase_order_items poi
SET organization_id = po.organization_id
FROM public.purchase_orders po
WHERE poi.po_id = po.id AND poi.organization_id IS NULL;

UPDATE public.po_activity_log pal
SET organization_id = po.organization_id
FROM public.purchase_orders po
WHERE pal.po_id = po.id AND pal.organization_id IS NULL;

-- 3. RLS REPAIR: purchase_orders
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Owners and Admins can view all POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can create POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can update own POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Owners and Admins can update all POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can delete own POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Suppliers view own POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Suppliers update own PO status" ON public.purchase_orders;
DROP POLICY IF EXISTS "Tenant Isolation Select purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Org-wide PO Visibility" ON public.purchase_orders;
DROP POLICY IF EXISTS "Supplier PO Visibility" ON public.purchase_orders;
DROP POLICY IF EXISTS "Staff Create POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Staff Update POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Supplier Update PO Status" ON public.purchase_orders;

-- Anyone in the same organization can view the POs
CREATE POLICY "Org-wide PO Visibility" ON public.purchase_orders
FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- Suppliers can see POs specifically assigned to their supplier_id
CREATE POLICY "Supplier PO Visibility" ON public.purchase_orders
FOR SELECT USING (
    auth.uid() IN (
        SELECT id FROM public.profiles 
        WHERE supplier_id = purchase_orders.supplier_id
    )
);

-- Creation Access
CREATE POLICY "Staff Create POs" ON public.purchase_orders
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('owner', 'admin', 'manager', 'super_admin')
    )
);

-- Management/Update Access
CREATE POLICY "Staff Update POs" ON public.purchase_orders
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('owner', 'admin', 'manager', 'super_admin')
        AND organization_id = purchase_orders.organization_id
    )
);

-- Suppliers can update status
CREATE POLICY "Supplier Update PO Status" ON public.purchase_orders
FOR UPDATE USING (
    auth.uid() IN (
        SELECT id FROM public.profiles 
        WHERE role = 'supplier'
        AND supplier_id = purchase_orders.supplier_id
    )
)
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM public.profiles 
        WHERE role = 'supplier'
        AND supplier_id = purchase_orders.supplier_id
    )
);

-- 4. RLS REPAIR: purchase_order_items & logs
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Inherit PO Item Visibility" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Staff Manage PO Items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Activity Log Visibility" ON public.po_activity_log;
DROP POLICY IF EXISTS "Activity Log Insert" ON public.po_activity_log;

CREATE POLICY "Inherit PO Item Visibility" ON public.purchase_order_items
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = purchase_order_items.po_id)
);

CREATE POLICY "Staff Manage PO Items" ON public.purchase_order_items
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin', 'manager', 'super_admin')
        AND organization_id = purchase_order_items.organization_id
    )
);

CREATE POLICY "Activity Log Visibility" ON public.po_activity_log
FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.purchase_orders po WHERE po.id = po_activity_log.po_id)
);

CREATE POLICY "Activity Log Insert" ON public.po_activity_log
FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- 5. Fix the submit_purchase_order RPC
CREATE OR REPLACE FUNCTION public.submit_purchase_order(
    p_supplier_id UUID,
    p_branch_id UUID,
    p_items JSONB,
    p_expected_delivery DATE,
    p_is_draft BOOLEAN DEFAULT false,
    p_po_id UUID DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_po_id UUID; v_po_number TEXT; v_user_id UUID; v_item JSONB;
    v_total_amount NUMERIC := 0; v_status public.po_status; v_role TEXT; v_org_id UUID;
BEGIN
    v_user_id := auth.uid();
    SELECT role, organization_id INTO v_role, v_org_id FROM public.profiles WHERE id = v_user_id;
    IF v_user_id IS NULL OR v_org_id IS NULL THEN RAISE EXCEPTION 'Auth/Org missing.'; END IF;

    IF p_is_draft THEN v_status := 'draft'::public.po_status;
    ELSIF v_role IN ('owner', 'admin', 'super_admin') THEN v_status := 'sent'::public.po_status;
    ELSE v_status := 'pending_approval'::public.po_status; END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_total_amount := v_total_amount + ((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC);
    END LOOP;

    IF p_po_id IS NOT NULL THEN
        UPDATE public.purchase_orders SET supplier_id = p_supplier_id, expected_delivery = p_expected_delivery,
            total_amount = v_total_amount, status = v_status, updated_at = NOW()
        WHERE id = p_po_id AND organization_id = v_org_id RETURNING id INTO v_po_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'PO not found.'; END IF;
        DELETE FROM public.purchase_order_items WHERE po_id = v_po_id;
    ELSE
        v_po_number := 'PO-' || to_char(NOW(), 'YYYYMMDD') || '-' || LPAD(floor(random()*10000)::text, 4, '0');
        INSERT INTO public.purchase_orders (po_number, supplier_id, branch_id, expected_delivery, total_amount, status, created_by, organization_id)
        VALUES (v_po_number, p_supplier_id, p_branch_id, p_expected_delivery, v_total_amount, v_status, v_user_id, v_org_id)
        RETURNING id INTO v_po_id;
    END IF;

    INSERT INTO public.purchase_order_items (po_id, ingredient_id, ordered_quantity, unit_price, unit_id, organization_id)
    SELECT v_po_id, (item->>'ingredient_id')::UUID, (item->>'quantity')::NUMERIC, (item->>'unit_price')::NUMERIC,
           (SELECT unit_id FROM public.ingredients WHERE id = (item->>'ingredient_id')::UUID), v_org_id
    FROM jsonb_array_elements(p_items) AS item;

    INSERT INTO public.po_activity_log (po_id, action_type, performed_by, notes, organization_id)
    VALUES (v_po_id, CASE WHEN p_is_draft THEN 'draft_saved'::public.po_action_type ELSE 'submitted'::public.po_action_type END,
            v_user_id, CASE WHEN p_po_id IS NOT NULL THEN 'Updated manifest' ELSE 'Initialized protocol' END, v_org_id);

    RETURN jsonb_build_object('success', true, 'po_id', v_po_id, 'status', v_status);
END;
$$;

-- 6. Cleanup
UPDATE public.suppliers SET is_active = false WHERE name IN ('Fresh Farms Ltd', 'Spice House');

COMMIT;
NOTIFY pgrst, 'reload schema';
