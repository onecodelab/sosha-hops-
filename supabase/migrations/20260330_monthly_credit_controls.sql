-- Monthly credit controls for customer chat and platform admin top-ups.

ALTER TABLE public.organizations
    ADD COLUMN IF NOT EXISTS used_monthly_credits INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS max_monthly_credits INTEGER NOT NULL DEFAULT 10000,
    ADD COLUMN IF NOT EXISTS credit_reset_at TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month');

UPDATE public.organizations
SET
    used_monthly_credits = COALESCE(used_monthly_credits, 0),
    max_monthly_credits = COALESCE(
        max_monthly_credits,
        CASE
            WHEN plan = 'free' THEN 1000
            WHEN plan = 'basic' THEN 10000
            WHEN plan = 'pro' THEN 50000
            WHEN plan = 'enterprise' THEN 100000
            ELSE 10000
        END
    ),
    credit_reset_at = COALESCE(credit_reset_at, (date_trunc('month', now()) + interval '1 month'));

CREATE OR REPLACE FUNCTION public.consume_monthly_credits(
    p_organization_id UUID,
    p_amount INTEGER,
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_org RECORD;
    v_now TIMESTAMPTZ := now();
    v_next_reset TIMESTAMPTZ := (date_trunc('month', now()) + interval '1 month');
    v_used INTEGER;
    v_max INTEGER;
BEGIN
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid credit amount');
    END IF;

    SELECT
        id,
        COALESCE(used_monthly_credits, 0) AS used_monthly_credits,
        COALESCE(max_monthly_credits, 0) AS max_monthly_credits,
        credit_reset_at
    INTO v_org
    FROM public.organizations
    WHERE id = p_organization_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
    END IF;

    v_used := v_org.used_monthly_credits;
    v_max := v_org.max_monthly_credits;

    IF v_org.credit_reset_at IS NULL OR v_org.credit_reset_at <= v_now THEN
        v_used := 0;
        UPDATE public.organizations
        SET used_monthly_credits = 0,
            credit_reset_at = v_next_reset
        WHERE id = p_organization_id;
    END IF;

    IF v_max > 0 AND (v_used + p_amount) > v_max THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Monthly credit limit reached',
            'used', v_used,
            'max', v_max,
            'remaining', GREATEST(v_max - v_used, 0)
        );
    END IF;

    UPDATE public.organizations
    SET used_monthly_credits = COALESCE(used_monthly_credits, 0) + p_amount
    WHERE id = p_organization_id;

    RETURN jsonb_build_object(
        'success', true,
        'used', v_used + p_amount,
        'max', v_max,
        'remaining', GREATEST(v_max - (v_used + p_amount), 0),
        'reason', p_reason
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_topup_monthly_credits(
    p_organization_id UUID,
    p_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role TEXT;
    v_org_name TEXT;
    v_new_max INTEGER;
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_role <> 'super_admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only super admins can add credits');
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid credit amount');
    END IF;

    UPDATE public.organizations
    SET max_monthly_credits = COALESCE(max_monthly_credits, 0) + p_amount
    WHERE id = p_organization_id
    RETURNING name, max_monthly_credits INTO v_org_name, v_new_max;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'organization_name', v_org_name,
        'new_max_monthly_credits', v_new_max,
        'added', p_amount
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_organization_plan(
    p_organization_id UUID,
    p_plan TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role TEXT;
    v_org_name TEXT;
    v_max INTEGER;
    v_plan TEXT := lower(trim(coalesce(p_plan, '')));
BEGIN
    IF auth.uid() IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
    END IF;

    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_role <> 'super_admin' THEN
        RETURN jsonb_build_object('success', false, 'error', 'Only super admins can change plans');
    END IF;

    IF v_plan NOT IN ('basic', 'pro', 'enterprise') THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid plan');
    END IF;

    v_max := CASE
        WHEN v_plan = 'basic' THEN 10000
        WHEN v_plan = 'pro' THEN 50000
        WHEN v_plan = 'enterprise' THEN 100000
        ELSE 10000
    END;

    UPDATE public.organizations
    SET
        plan = v_plan,
        max_monthly_credits = GREATEST(COALESCE(max_monthly_credits, 0), v_max)
    WHERE id = p_organization_id
    RETURNING name, max_monthly_credits INTO v_org_name, v_max;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Organization not found');
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'organization_name', v_org_name,
        'plan', v_plan,
        'max_monthly_credits', v_max
    );
END;
$$;

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
BEGIN
    v_org_id := COALESCE(p_organization_id, public.current_org_id_strict());

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Identity Error: Action requires an authenticated organizational context.';
    END IF;

    v_user_id := auth.uid();
    v_source := COALESCE(p_order_details->>'source', 'dine_in');

    IF NOT EXISTS (
        SELECT 1 FROM public.branches
        WHERE id = p_branch_id AND organization_id = v_org_id
    ) THEN
        RAISE EXCEPTION 'Isolation Error: Branch does not belong to the resolved organization.';
    END IF;

    FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_total_amount := v_total_amount + ((v_item->>'quantity')::NUMERIC * (v_item->>'unit_price')::NUMERIC);
    END LOOP;

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
        (p_order_details->>'table_id')::UUID,
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
