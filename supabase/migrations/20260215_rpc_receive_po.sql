-- MIGRATION: 20260215_rpc_receive_po.sql
-- PURPOSE: Atomic RPC for receiving POs and updating stock

BEGIN;

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
        'pending' -- Updated later
    ) RETURNING id INTO v_grn_id;

    -- 3. Process Items
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        -- A. Insert GRN Item
        INSERT INTO public.grn_items (
            grn_id,
            ingredient_id,
            ordered_quantity, -- We'll fetch this from the PO
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

        -- B. Record Inventory Transaction
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

        -- C. Update Branch Inventory (Stock Increment)
        PERFORM public.increment_stock(
            (v_item->>'ingredient_id')::UUID,
            (v_item->>'received_quantity')::NUMERIC
        );
    END LOOP;

    -- 4. Determine PO Status & GRN Status
    -- Check if all items in original PO are fully received across all GRNs
    FOR v_po_item IN SELECT ingredient_id, ordered_quantity FROM public.purchase_order_items WHERE po_id = p_po_id LOOP
        IF (SELECT COALESCE(SUM(received_quantity), 0) FROM public.grn_items gi 
            JOIN public.goods_received_notes g ON gi.grn_id = g.id
            WHERE g.po_id = p_po_id AND gi.ingredient_id = v_po_item.ingredient_id) < v_po_item.ordered_quantity 
        THEN
            v_all_complete := false;
        END IF;
    END LOOP;

    -- Update GRN Status
    UPDATE public.goods_received_notes SET status = CASE WHEN v_all_complete THEN 'complete'::public.grn_status ELSE 'partial'::public.grn_status END WHERE id = v_grn_id;

    -- Update PO Status
    UPDATE public.purchase_orders 
    SET 
        status = CASE WHEN v_all_complete THEN 'verified'::public.po_status ELSE 'partial_received'::public.po_status END,
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

COMMIT;
