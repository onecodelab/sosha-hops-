-- Fix atomic order placement so orders.table_number is never left NULL.

CREATE OR REPLACE FUNCTION public.place_order_atomic(
    p_branch_id UUID,
    p_items JSONB,
    p_order_details JSONB,
    p_organization_id UUID DEFAULT NULL
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
    v_user_id UUID;
    v_session_id UUID;
    v_source TEXT;
    v_credit_result JSONB;
    v_table_id UUID;
    v_table_number TEXT;
BEGIN
    v_org_id := COALESCE(p_organization_id, public.current_org_id_strict());

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Identity Error: Action requires an authenticated organizational context.';
    END IF;

    v_user_id := auth.uid();
    v_source := COALESCE(p_order_details->>'source', 'dine_in');
    v_table_id := NULLIF(p_order_details->>'table_id', '')::UUID;
    v_table_number := NULLIF(trim(p_order_details->>'table_number'), '');

    IF v_table_id IS NOT NULL THEN
        SELECT table_number INTO v_table_number
        FROM public.tables
        WHERE id = v_table_id
        LIMIT 1;
    ELSIF v_table_number IS NOT NULL THEN
        SELECT id INTO v_table_id
        FROM public.tables
        WHERE branch_id = p_branch_id
          AND organization_id = v_org_id
          AND lower(regexp_replace(table_number, '[^a-zA-Z0-9]', '', 'g')) = lower(regexp_replace(v_table_number, '[^a-zA-Z0-9]', '', 'g'))
        LIMIT 1;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public.branches
        WHERE id = p_branch_id AND organization_id = v_org_id
    ) THEN
        RAISE EXCEPTION 'Isolation Error: Branch does not belong to the resolved organization.';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_total_amount := v_total_amount + ((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC);
    END LOOP;

    IF v_table_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.tables WHERE id = v_table_id AND branch_id = p_branch_id) THEN
            RAISE EXCEPTION 'Isolation Error: Table does not belong to the selected branch.';
        END IF;

        IF v_table_number IS NULL THEN
            SELECT table_number INTO v_table_number
            FROM public.tables
            WHERE id = v_table_id
            LIMIT 1;
        END IF;

        SELECT id INTO v_session_id FROM public.table_sessions
        WHERE table_id = v_table_id AND is_active = true LIMIT 1;

        IF v_session_id IS NULL THEN
            INSERT INTO public.table_sessions (table_id, is_active, seated_at, organization_id)
            VALUES (v_table_id, true, NOW(), v_org_id)
            RETURNING id INTO v_session_id;
        END IF;

        UPDATE public.tables SET
            status = 'occupied',
            last_updated = NOW()
        WHERE id = v_table_id;
    END IF;

    IF v_source = 'chatbot' THEN
        v_credit_result := public.consume_monthly_credits(v_org_id, 20, 'chatbot_order_placed');
        IF COALESCE((v_credit_result->>'success')::boolean, false) IS FALSE THEN
            RAISE EXCEPTION '%', COALESCE(v_credit_result->>'error', 'Monthly credit limit reached');
        END IF;
    END IF;

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
        created_at,
        last_updated
    ) VALUES (
        v_org_id,
        p_branch_id,
        v_table_id,
        COALESCE(v_table_number, 'Guest'),
        COALESCE((p_order_details->>'waiter_id')::UUID, v_user_id),
        (p_order_details->>'telegram_id'),
        (p_order_details->>'customer_phone'),
        v_source,
        'pending',
        'pending',
        v_total_amount,
        NOW(),
        NOW()
    ) RETURNING id INTO v_order_id;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_menu_item_id := (v_item->>'menu_item_id')::UUID;
        v_qty := (v_item->>'quantity')::NUMERIC;
        v_price := (v_item->>'unit_price')::NUMERIC;
        v_notes := v_item->>'notes';

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

        SELECT id INTO v_recipe_id FROM public.recipes
        WHERE menu_item_id = v_menu_item_id AND organization_id = v_org_id;

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
                UPDATE public.branch_inventory
                SET
                    current_stock = current_stock - (v_ing_rec.quantity_needed * v_qty * v_ing_rec.conversion_factor),
                    last_updated = NOW()
                WHERE
                    branch_id = p_branch_id
                    AND ingredient_id = v_ing_rec.ingredient_id
                    AND organization_id = v_org_id;

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
        'table_number', v_table_number
    );
END;
$$;
