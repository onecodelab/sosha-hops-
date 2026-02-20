-- MASTER REPAIR: Purchase Order Infrastructure
-- Date: 2026-02-15

-- 1. Drop old variations to prevent overloading conflicts
DROP FUNCTION IF EXISTS public.submit_purchase_order(UUID, UUID, JSONB, DATE, BOOLEAN, UUID);
DROP FUNCTION IF EXISTS public.submit_purchase_order(UUID, UUID, JSON, DATE, BOOLEAN, UUID);
DROP FUNCTION IF EXISTS public.submit_purchase_order(UUID, UUID, JSONB, TEXT, BOOLEAN, UUID);

-- 2. Create the DEFINITIVE Hardened RPC
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
    v_status TEXT;
    v_role TEXT;
    v_org_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Identity Check
    SELECT role, organization_id INTO v_role, v_org_id FROM public.profiles WHERE id = v_user_id;

    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Authentication required');
    END IF;
    
    -- Determine Status
    IF p_is_draft THEN
        v_status := 'draft';
    ELSIF v_role IN ('owner', 'admin') THEN
        v_status := 'sent';
    ELSE
        v_status := 'pending_approval';
    END IF;

    -- Calculate Total
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_total_amount := v_total_amount + ((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC);
    END LOOP;

    -- Upsert PO Header
    IF p_po_id IS NOT NULL THEN
        UPDATE public.purchase_orders
        SET 
            supplier_id = p_supplier_id,
            expected_delivery = p_expected_delivery,
            total_amount = v_total_amount,
            status = v_status::public.po_status, -- Explicit cast
            updated_at = NOW()
        WHERE id = p_po_id
        RETURNING id INTO v_po_id;
        
        DELETE FROM public.purchase_order_items WHERE po_id = v_po_id;
    ELSE
        v_po_number := 'PO-' || to_char(NOW(), 'YYYYMMDD') || '-' || LPAD(floor(random()*1000)::text, 3, '0');
        
        INSERT INTO public.purchase_orders (
            po_number, supplier_id, branch_id, expected_delivery, 
            total_amount, status, created_by, organization_id
        ) VALUES (
            v_po_number, p_supplier_id, p_branch_id, p_expected_delivery, 
            v_total_amount, v_status::public.po_status, v_user_id, v_org_id -- Explicit cast
        ) RETURNING id INTO v_po_id;
    END IF;

    -- Batch Insert Items
    INSERT INTO public.purchase_order_items (
        po_id, ingredient_id, ordered_quantity, unit_price, unit_id, organization_id
    )
    SELECT 
        v_po_id,
        (item->>'ingredient_id')::UUID,
        (item->>'quantity')::NUMERIC,
        (item->>'unit_price')::NUMERIC,
        (SELECT unit_id FROM public.ingredients WHERE id = (item->>'ingredient_id')::UUID),
        v_org_id
    FROM jsonb_array_elements(p_items) AS item;

    -- Log Activity
    INSERT INTO public.po_activity_log (
        po_id, action_type, performed_by, notes, organization_id
    ) VALUES (
        v_po_id, 
        (CASE WHEN p_is_draft THEN 'created' ELSE 'submitted' END)::public.po_action_type, -- Explicit cast
        v_user_id,
        CASE WHEN p_po_id IS NOT NULL THEN 'Updated existing PO' ELSE 'Created new PO' END,
        v_org_id
    );

    RETURN jsonb_build_object(
        'success', true,
        'po_id', v_po_id,
        'status', v_status
    );
END;
$$;

-- Force Schema Refresh
NOTIFY pgrst, 'reload schema';
