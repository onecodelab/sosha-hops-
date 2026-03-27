-- Migration: 20260327170000_fix_inventory_conversion.sql
-- Purpose: Fixes place_order_atomic and inventory views to use the UUID-based get_unit_conversion_factor overload.
-- The TEXT-based overload returns 1.0 when unit_type is NULL (which is true in the updated schema), 
-- causing ingredients like 'Rice (1 Cup)' to incorrectly deduct '1.0 KG' instead of '0.25 KG'.

BEGIN;

-- 1. Redefine place_order_atomic to use the robust UUID-based COALESCE conversion logic
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
            status = 'pending'
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
                    COALESCE(
                        public.get_unit_conversion_factor(i.unit_id, ri.unit_id, i.weight_per_unit),
                        public.get_unit_conversion_factor(i.unit_type, ri.unit_type, i.weight_per_unit),
                        1
                    ) as conversion_factor
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
        'appended', (v_order_id IS NOT NULL) 
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


-- 2. Update view_ingredient_usage_stats (inventory_intelligence.sql)
DROP VIEW IF EXISTS view_inventory_intelligence CASCADE;
DROP VIEW IF EXISTS view_ingredient_usage_stats CASCADE;

CREATE OR REPLACE VIEW view_ingredient_usage_stats AS
SELECT 
  ri.ingredient_id,
  SUM(CASE WHEN o.created_at >= (now() - interval '7 days') THEN 
      (oi.quantity * ri.quantity_needed * COALESCE(get_unit_conversion_factor(i.unit_id, ri.unit_id, i.weight_per_unit), get_unit_conversion_factor(i.unit_type, ri.unit_type, i.weight_per_unit), 1)) 
      ELSE 0 END) as usage_last_7d,
  SUM(CASE WHEN o.created_at < (now() - interval '7 days') AND o.created_at >= (now() - interval '14 days') THEN 
      (oi.quantity * ri.quantity_needed * COALESCE(get_unit_conversion_factor(i.unit_id, ri.unit_id, i.weight_per_unit), get_unit_conversion_factor(i.unit_type, ri.unit_type, i.weight_per_unit), 1)) 
      ELSE 0 END) as usage_prev_7d,
  SUM(oi.quantity * ri.quantity_needed * COALESCE(get_unit_conversion_factor(i.unit_id, ri.unit_id, i.weight_per_unit), get_unit_conversion_factor(i.unit_type, ri.unit_type, i.weight_per_unit), 1)) as usage_last_14d
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
JOIN recipes r ON oi.menu_item_id = r.menu_item_id
JOIN recipe_ingredients ri ON r.id = ri.recipe_id
JOIN ingredients i ON ri.ingredient_id = i.id
WHERE o.status IN ('paid', 'closed', 'served') 
  AND o.created_at >= (now() - interval '14 days')
GROUP BY ri.ingredient_id;

-- Reprovision view_inventory_intelligence
CREATE OR REPLACE VIEW view_inventory_intelligence AS
SELECT 
  i.id,
  i.name,
  i.current_stock,
  i.unit_type,
  i.cost_per_unit,
  i.updated_at,
  
  -- Computed Usage Metrics
  COALESCE(u.usage_last_7d, 0) as usage_7d,
  COALESCE(u.usage_prev_7d, 0) as usage_prev_7d,
  COALESCE(u.usage_last_14d, 0) / 14.0 as avg_daily_usage,
  
  -- Days of Stock Left
  CASE 
    WHEN i.current_stock <= 0 THEN 0
    WHEN COALESCE(u.usage_last_14d, 0) = 0 THEN 999 
    ELSE i.current_stock / (COALESCE(u.usage_last_14d, 0) / 14.0)
  END as days_of_stock_left,

  -- Velocity Ratio
  CASE 
    WHEN COALESCE(u.usage_prev_7d, 0) = 0 THEN 1.0 
    ELSE COALESCE(u.usage_last_7d, 0) / NULLIF(u.usage_prev_7d, 0)
  END as velocity_ratio,

  -- Revenue Risk 
  COALESCE(risk.revenue_at_risk_7d, 0) as revenue_at_risk_7d,

  -- Dependency Counts
  COALESCE(dep.total_menu_items, 0) as total_menu_items,
  COALESCE(dep.active_kill_dish_items, 0) as active_kill_dish_items

FROM ingredients i
LEFT JOIN view_ingredient_usage_stats u ON i.id = u.ingredient_id
LEFT JOIN view_inventory_risks risk ON i.id = risk.ingredient_id
LEFT JOIN view_ingredient_dependency_counts dep ON i.id = dep.ingredient_id
WHERE i.is_active = true;

COMMIT;

-- Inform postgrest of schema changes
NOTIFY pgrst, 'reload schema';
