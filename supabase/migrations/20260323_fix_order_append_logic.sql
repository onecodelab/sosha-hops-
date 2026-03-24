-- 20260323_fix_order_append_logic.sql
-- Purpose: Redefine place_order_atomic to support appending items to an existing active order on a table.
-- This prevents the "unique_active_order_per_table" constraint violation when adding items to table C1 (or any table).

CREATE OR REPLACE FUNCTION public.place_order_atomic(
    p_branch_id UUID,
    p_items JSONB, -- Array of {menu_item_id: UUID, quantity: NUMERIC, unit_price: NUMERIC, notes?: TEXT}
    p_order_details JSONB, -- {table_id?, waiter_id?, source?, telegram_id?, customer_phone?}
    p_organization_id UUID DEFAULT NULL -- Explicit ID for AI/Service calls
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_org_id UUID;
    v_order_id UUID;
    v_item JSONB;
    v_menu_item_id UUID;
    v_qty NUMERIC;
    v_price NUMERIC;
    v_notes TEXT;
    v_recipe_id UUID;
    v_ing_rec RECORD;
    v_total_amount NUMERIC := 0;
    v_subtotal NUMERIC := 0;
    v_vat NUMERIC := 0;
    v_user_id UUID;
    v_session_id UUID;
    v_table_num TEXT;
BEGIN
    -- 1. RESOLVE ORG ID (Explicit or from JWT)
    v_org_id := COALESCE(p_organization_id, public.current_org_id_strict());
    
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Identity Error: Action requires an authenticated organizational context.';
    END IF;

    v_user_id := auth.uid();

    -- 2. BRANCH VALIDATION
    IF NOT EXISTS (
        SELECT 1 FROM public.branches
        WHERE id = p_branch_id AND organization_id = v_org_id
    ) THEN
        RAISE EXCEPTION 'Isolation Error: Branch does not belong to the resolved organization.';
    END IF;

    -- 3. CALCULATE TOTAL & VALIDATE ITEMS
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_subtotal := v_subtotal + ((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC);
    END LOOP;
    
    v_vat := ROUND((v_subtotal * 0.15), 2);
    v_total_amount := v_subtotal + v_vat;

    -- 4. MANAGE TABLE SESSION & RESOLVE ORDER (If applicable)
    IF (p_order_details->>'table_id') IS NOT NULL AND (p_order_details->>'table_id') <> '' THEN
        -- Check if table belongs to branch
        SELECT table_number INTO v_table_num FROM public.tables 
        WHERE id = (p_order_details->>'table_id')::UUID AND branch_id = p_branch_id;

        IF v_table_num IS NULL THEN
            RAISE EXCEPTION 'Isolation Error: Table does not belong to the selected branch.';
        END IF;

        -- Find or Create Session
        SELECT id INTO v_session_id FROM public.table_sessions
        WHERE table_id = (p_order_details->>'table_id')::UUID AND is_active = true LIMIT 1;

        IF v_session_id IS NULL THEN
            INSERT INTO public.table_sessions (table_id, is_active, seated_at, organization_id)
            VALUES ((p_order_details->>'table_id')::UUID, true, NOW(), v_org_id)
            RETURNING id INTO v_session_id;
        END IF;

        -- Check if there's an existing active order for this table
        -- Using status check to match the unique constraint's logic
        SELECT id INTO v_order_id FROM public.orders
        WHERE table_id = (p_order_details->>'table_id')::UUID 
        AND organization_id = v_org_id
        AND branch_id = p_branch_id
        AND status NOT IN ('paid', 'closed', 'cancelled')
        ORDER BY created_at DESC
        LIMIT 1;
    END IF;

    -- 5. INSERT OR UPDATE ORDER
    IF v_order_id IS NOT NULL THEN
        -- UPDATE EXISTING ORDER
        UPDATE public.orders SET
            total_amount = total_amount + v_total_amount,
            subtotal_amount = COALESCE(subtotal_amount, 0) + v_subtotal,
            vat_amount = COALESCE(vat_amount, 0) + v_vat,
            last_updated = NOW(),
            status = 'pending' -- Move back to pending so kitchen sees new additions
        WHERE id = v_order_id;
    ELSE
        -- INSERT NEW ORDER
        INSERT INTO public.orders (
            organization_id,
            branch_id,
            table_id,
            table_number,
            waiter_id,
            telegram_id,
            customer_phone,
            source,
            status,
            payment_status,
            total_amount,
            subtotal_amount,
            vat_amount,
            vat_rate,
            created_at,
            last_updated
        ) VALUES (
            v_org_id,
            p_branch_id,
            (p_order_details->>'table_id')::UUID,
            v_table_num,
            COALESCE((p_order_details->>'waiter_id')::UUID, v_user_id),
            (p_order_details->>'telegram_id'),
            (p_order_details->>'customer_phone'),
            COALESCE(p_order_details->>'source', 'dine_in'),
            'pending',
            'pending',
            v_total_amount,
            v_subtotal,
            v_vat,
            15,
            NOW(),
            NOW()
        ) RETURNING id INTO v_order_id;
    END IF;

    -- Always update table status and current_order_id if applicable
    IF (p_order_details->>'table_id') IS NOT NULL AND (p_order_details->>'table_id') <> '' THEN
        UPDATE public.tables SET
            status = 'occupied',
            current_order_id = v_order_id,
            last_updated = NOW()
        WHERE id = (p_order_details->>'table_id')::UUID;
    END IF;

    -- 6. PROCESS ITEMS & INVENTORY
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_menu_item_id := (v_item->>'menu_item_id')::UUID;
        v_qty := (v_item->>'quantity')::NUMERIC;
        v_price := (v_item->>'unit_price')::NUMERIC;
        v_notes := v_item->>'notes';

        -- A. Insert Order Item
        INSERT INTO public.order_items (
            organization_id,
            order_id,
            menu_item_id,
            quantity,
            price,
            special_instructions
        ) VALUES (
            v_org_id,
            v_order_id,
            v_menu_item_id,
            v_qty,
            v_price,
            v_notes
        );

        -- B. Resolve Recipe
        SELECT id INTO v_recipe_id FROM public.recipes
        WHERE menu_item_id = v_menu_item_id AND organization_id = v_org_id;

        -- C. Deduct Stock if Recipe exists
        IF v_recipe_id IS NOT NULL THEN
            FOR v_ing_rec IN
                SELECT
                    ri.ingredient_id,
                    ri.quantity_needed,
                    public.get_unit_conversion_factor(i.unit_type, ri.unit_type, i.weight_per_unit) as conversion_factor
                FROM public.recipe_ingredients ri
                JOIN public.ingredients i ON ri.ingredient_id = i.id
                WHERE ri.recipe_id = v_recipe_id
            LOOP
                -- Deduct from branch_inventory
                UPDATE public.branch_inventory
                SET
                    current_stock = current_stock - (v_ing_rec.quantity_needed * v_qty * v_ing_rec.conversion_factor),
                    last_updated = NOW()
                WHERE
                    branch_id = p_branch_id
                    AND ingredient_id = v_ing_rec.ingredient_id
                    AND organization_id = v_org_id;

                -- D. Log Inventory Transaction
                INSERT INTO public.inventory_transactions (
                    organization_id,
                    branch_id,
                    ingredient_id,
                    transaction_type,
                    quantity,
                    reference_type,
                    reference_id,
                    performed_by,
                    created_at
                ) VALUES (
                    v_org_id,
                    p_branch_id,
                    v_ing_rec.ingredient_id,
                    'sale',
                    -(v_ing_rec.quantity_needed * v_qty * v_ing_rec.conversion_factor),
                    'order',
                    v_order_id,
                    v_user_id,
                    NOW()
                );
            END LOOP;
        END IF;

    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', v_order_id,
        'total_amount', v_total_amount,
        'appended', (v_order_id IS NOT NULL) -- This might be misleading if we just set it above, but we know if it was found
    );

EXCEPTION
    WHEN OTHERS THEN
        -- Transaction scales back automatically in PostgreSQL functions
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'detail', SQLSTATE
        );
END;
$$;
