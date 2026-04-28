-- Credit model update:
-- 1 chat message = 1 credit
-- 1 chatbot order placed = 20 credits
-- Order updates remain free and no longer trigger the 20-credit charge.

CREATE OR REPLACE FUNCTION public.fn_bill_chatbot_order()
RETURNS TRIGGER AS $$
BEGIN
    -- Legacy safety trigger kept as a no-op so status updates never re-bill orders.
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.fn_bill_chatbot_order() IS 'Legacy no-op trigger. Chatbot order credits are billed at placement time.';

CREATE OR REPLACE FUNCTION public.place_order_atomic(
    p_branch_id UUID,
    p_items JSONB,
    p_order_details JSONB
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
    v_recipe_id UUID;
    v_ing_rec RECORD;
    v_total_amount NUMERIC := 0;
    v_user_id UUID;
    v_session_id UUID;
    v_source TEXT := COALESCE(p_order_details->>'source', 'dine_in');
    v_bill_amount INTEGER := CASE WHEN COALESCE(p_order_details->>'source', 'dine_in') = 'chatbot' THEN 20 ELSE 0 END;
BEGIN
    -- 1. STRICT TENANT VALIDATION
    v_org_id := public.current_org_id_strict();

    -- Fallback for Edge Functions using Service Role: Extract from Branch
    IF v_org_id IS NULL THEN
        SELECT organization_id INTO v_org_id FROM public.branches WHERE id = p_branch_id;
    END IF;

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Identity Error: Action requires an authenticated organizational context.';
    END IF;

    v_user_id := auth.uid();

    -- 2. BRANCH VALIDATION
    IF NOT EXISTS (
        SELECT 1 FROM public.branches
        WHERE id = p_branch_id AND organization_id = v_org_id
    ) THEN
        RAISE EXCEPTION 'Isolation Error: Branch does not belong to your organization.';
    END IF;

    -- 3. CALCULATE TOTAL & VALIDATE ITEMS
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_total_amount := v_total_amount + ((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC);
    END LOOP;

    -- 4. MANAGE TABLE SESSION (If applicable)
    IF (p_order_details->>'table_id') IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM public.tables WHERE id = (p_order_details->>'table_id')::UUID AND branch_id = p_branch_id) THEN
            RAISE EXCEPTION 'Isolation Error: Table does not belong to the selected branch.';
        END IF;

        SELECT id INTO v_session_id FROM public.table_sessions
        WHERE table_id = (p_order_details->>'table_id')::UUID AND is_active = true LIMIT 1;

        IF v_session_id IS NULL THEN
            INSERT INTO public.table_sessions (table_id, is_active, seated_at, organization_id)
            VALUES ((p_order_details->>'table_id')::UUID, true, NOW(), v_org_id)
            RETURNING id INTO v_session_id;
        END IF;

        UPDATE public.tables SET
            status = 'occupied',
            last_updated = NOW()
        WHERE id = (p_order_details->>'table_id')::UUID;
    END IF;

    -- 5. INSERT ORDER
    INSERT INTO public.orders (
        organization_id,
        branch_id,
        table_id,
        waiter_id,
        telegram_id,
        source,
        status,
        payment_status,
        total_amount,
        billed_for_credits,
        created_at,
        last_updated
    ) VALUES (
        v_org_id,
        p_branch_id,
        (p_order_details->>'table_id')::UUID,
        COALESCE((p_order_details->>'waiter_id')::UUID, v_user_id),
        (p_order_details->>'telegram_id'),
        v_source,
        'pending',
        'pending',
        v_total_amount,
        CASE WHEN v_bill_amount > 0 THEN true ELSE false END,
        NOW(),
        NOW()
    ) RETURNING id INTO v_order_id;

    IF v_bill_amount > 0 THEN
        PERFORM public.increment_org_credits(v_org_id, v_bill_amount);

        INSERT INTO public.credit_usage_logs (
            organization_id,
            amount,
            action_type,
            metadata
        ) VALUES (
            v_org_id,
            v_bill_amount,
            'chatbot_order_placed',
            jsonb_build_object(
                'order_id', v_order_id,
                'table_id', (p_order_details->>'table_id')::UUID,
                'source', v_source,
                'note', 'Billed at order placement'
            )
        );
    END IF;

    -- 6. PROCESS ITEMS & INVENTORY
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_menu_item_id := (v_item->>'menu_item_id')::UUID;
        v_qty := (v_item->>'quantity')::NUMERIC;
        v_price := (v_item->>'unit_price')::NUMERIC;

        INSERT INTO public.order_items (
            organization_id,
            order_id,
            menu_item_id,
            quantity,
            price
        ) VALUES (
            v_org_id,
            v_order_id,
            v_menu_item_id,
            v_qty,
            v_price
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
        'total_amount', v_total_amount
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM,
            'detail', SQLSTATE
        );
END;
$$;

COMMENT ON FUNCTION public.place_order_atomic(UUID, JSONB, JSONB) IS 'Atomically creates an order, bills chatbot placement credits, and deducts inventory stock.';
