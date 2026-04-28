-- Migration: 20260329_comprehensive_restoration.sql
-- Purpose: 
-- 1. Standardize menu detail views to support both underscored and non-underscored names.
-- 2. Fix the "column viewmenudetails.ingredientslist does not exist" error.
-- 3. Harden the billing trigger to ensure all terminal orders from chatbot are billed correctly.
-- 4. Improve unit conversion for common kitchen units like 'cup' (250g) and 'pcs'.

BEGIN;

-- 1. ROBUST CONVERSION FUNCTION (Update TEXT version with kitchen units)
CREATE OR REPLACE FUNCTION get_unit_conversion_factor(
  p_from text,
  p_to text,
  p_weight_per_unit numeric DEFAULT 1
) RETURNS numeric AS $$
DECLARE
  v_from text := lower(trim(p_from));
  v_to text := lower(trim(p_to));
  v_from_factor numeric;
  v_to_factor numeric;
BEGIN
  IF v_from = v_to OR v_from IS NULL OR v_to IS NULL THEN RETURN 1; END IF;

  -- Normalized Base Factors (Grams or Milliliters)
  v_from_factor := CASE 
    WHEN v_from IN ('kg', 'kilogram', 'kilo', 'kgs') THEN 1000
    WHEN v_from IN ('g', 'gram', 'grams', 'mg') THEN 1
    WHEN v_from IN ('l', 'liter', 'litre', 'liters') THEN 1000
    WHEN v_from IN ('ml', 'milliliter', 'millilitre') THEN 1
    WHEN v_from IN ('cup', 'cups') THEN 250 -- Assume 250g cup
    WHEN v_from IN ('tbsp', 'tablespoon') THEN 15 -- Assume 15g
    WHEN v_from IN ('tsp', 'teaspoon') THEN 5 -- Assume 5g
    ELSE 1
  END;

  v_to_factor := CASE 
    WHEN v_to IN ('kg', 'kilogram', 'kilo', 'kgs') THEN 1000
    WHEN v_to IN ('g', 'gram', 'grams', 'mg') THEN 1
    WHEN v_to IN ('l', 'liter', 'litre', 'liters') THEN 1000
    WHEN v_to IN ('ml', 'milliliter', 'millilitre') THEN 1
    WHEN v_to IN ('cup', 'cups') THEN 250
    WHEN v_to IN ('tbsp', 'tablespoon') THEN 15
    WHEN v_to IN ('tsp', 'teaspoon') THEN 5
    ELSE 1
  END;

  -- Logic: How many INVENTORY units (from) per 1 RECIPE unit (to)?
  -- If inventory=kg(1000) and recipe=cup(250), then 1 cup = 0.25kg.
  RETURN v_to_factor / v_from_factor;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Restore view_recipe_costs (Ensure it uses the robust conversion)
DROP VIEW IF EXISTS view_recipe_costs CASCADE;
CREATE OR REPLACE VIEW view_recipe_costs 
WITH (security_invoker = true) AS
SELECT 
  r.menu_item_id,
  r.id as recipe_id,
  r.organization_id,
  SUM(
    ri.quantity_needed * 
    COALESCE(
        get_unit_conversion_factor(i.unit_id, ri.unit_id, i.weight_per_unit),
        get_unit_conversion_factor(i.unit_type, ri.unit_type, i.weight_per_unit),
        1
    ) * 
    i.cost_per_unit
  ) as calculated_cost
FROM 
  recipes r
JOIN 
  recipe_ingredients ri ON r.id = ri.recipe_id
JOIN 
  ingredients i ON ri.ingredient_id = i.id
WHERE 
  i.is_active = true
GROUP BY 
  r.menu_item_id, r.id, r.organization_id;

-- 3. Standardize view_menu_details (Underscores)
DROP VIEW IF EXISTS public.view_menu_details CASCADE;
CREATE OR REPLACE VIEW public.view_menu_details 
WITH (security_invoker = true) AS
SELECT 
  m.id,
  m.name,
  m.price,
  COALESCE(cat.name, m.category) as category,
  m.image_url,
  m.description,
  COALESCE(m.dietary_tags, '{}') as dietary_tags,
  COALESCE(
    (
      SELECT array_agg(i.name)
      FROM recipes r
      JOIN recipe_ingredients ri ON r.id = ri.recipe_id
      JOIN ingredients i ON ri.ingredient_id = i.id
      WHERE r.menu_item_id = m.id
    ),
    m.ingredients_list,
    '{}'
  ) as ingredients_list,
  m.spice_level,
  m.portion_size,
  m.organization_id,
  m.status as manual_status,
  m.branch_id as scope_branch_id,
  c.recipe_id,
  COALESCE(c.calculated_cost, 0) as cost_per_plate,
  (COALESCE(m.status, 'available') = 'available') AND (COALESCE(a.is_available, true)) as is_available,
  (m.price - COALESCE(c.calculated_cost, 0)) as margin,
  CASE WHEN m.price > 0 THEN ((m.price - COALESCE(c.calculated_cost, 0)) / m.price) * 100 ELSE 0 END as margin_percent,
  COALESCE(a.branch_id, m.branch_id) as branch_id
FROM 
  menu m
LEFT JOIN 
  categories cat ON m.category_id = cat.id
LEFT JOIN 
  view_recipe_costs c ON m.id = c.menu_item_id
LEFT JOIN 
  view_menu_availability a ON m.id = a.menu_item_id 
    AND (m.branch_id = a.branch_id OR m.branch_id IS NULL OR a.branch_id IS NULL);

-- 4. Provide viewmenudetails alias
DROP VIEW IF EXISTS public.viewmenudetails CASCADE;
CREATE OR REPLACE VIEW public.viewmenudetails 
WITH (security_invoker = true) AS
SELECT 
  *, 
  ingredients_list as ingredientslist -- Alias for underscore-free queries
FROM 
  public.view_menu_details;

-- 5. Harden the Billing Trigger for Chatbot Success
CREATE OR REPLACE FUNCTION public.fn_bill_chatbot_order()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger when source is recorded as 'chatbot'
    -- AND status is accepted/served/paid/closed (waiter-approved states)
    -- AND we havent billed this order yet
    IF (NEW.source = 'chatbot' AND NEW.status IN ('accepted', 'served', 'paid', 'closed') AND NEW.billed_for_credits = false) THEN
        
        -- Deduct 20 credits from the organization
        PERFORM public.increment_org_credits(NEW.organization_id, 20);
        
        -- Log the usage
        INSERT INTO public.credit_usage_logs (
            organization_id,
            amount,
            action_type,
            metadata
        ) VALUES (
            NEW.organization_id,
            20,
            'chatbot_order_accepted',
            jsonb_build_object(
                'order_id', NEW.id,
                'table_id', NEW.table_id,
                'source', NEW.source,
                'note', 'Billed at approval/completion phase: ' || NEW.status
            )
        );
        
        -- Mark as billed to prevent double-charging
        NEW.billed_for_credits := true;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach Trigger
DROP TRIGGER IF EXISTS trig_bill_chatbot_order ON public.orders;
CREATE TRIGGER trig_bill_chatbot_order
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_bill_chatbot_order();

COMMIT;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
