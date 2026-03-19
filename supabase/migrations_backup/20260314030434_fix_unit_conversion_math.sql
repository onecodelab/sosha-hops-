-- MIGRATION: 20260314030434_fix_unit_conversion_math.sql
-- PURPOSE: Data Cleanup + Logic Fix + Robust Views
-- GOAL: Ensure 100% accuracy in cost calculations by handling NULL unit_ids and inverted math.

BEGIN;

-- 1. DATA REPAIR: Link missing unit_ids to existing ingredients based on unit_type
-- This handles legacy data where unit_id might be NULL but unit_type has a value like 'kg' or 'Kilogram'
UPDATE public.ingredients i
SET unit_id = u.id
FROM public.units u
WHERE i.unit_id IS NULL 
  AND (
    LOWER(TRIM(i.unit_type)) = u.abbreviation 
    OR LOWER(TRIM(i.unit_type)) = LOWER(u.name)
    OR (LOWER(TRIM(i.unit_type)) = 'unit' AND u.abbreviation = 'pcs')
    OR (LOWER(TRIM(i.unit_type)) = 'kilo' AND u.abbreviation = 'kg')
  );

UPDATE public.recipe_ingredients ri
SET unit_id = u.id
FROM public.units u
WHERE ri.unit_id IS NULL
  AND (
    LOWER(TRIM(ri.unit_type)) = u.abbreviation 
    OR LOWER(TRIM(ri.unit_type)) = LOWER(u.name)
    OR (LOWER(TRIM(ri.unit_type)) = 'unit' AND u.abbreviation = 'pcs')
    OR (LOWER(TRIM(ri.unit_type)) = 'kilo' AND u.abbreviation = 'kg')
  );

-- 2. ROBUST CONVERSION FUNCTION (TEXT Version)
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
    ELSE 1
  END;

  v_to_factor := CASE 
    WHEN v_to IN ('kg', 'kilogram', 'kilo', 'kgs') THEN 1000
    WHEN v_to IN ('g', 'gram', 'grams', 'mg') THEN 1
    WHEN v_to IN ('l', 'liter', 'litre', 'liters') THEN 1000
    WHEN v_to IN ('ml', 'milliliter', 'millilitre') THEN 1
    ELSE 1
  END;

  -- Logic: How many INVENTORY units (from) per 1 RECIPE unit (to)?
  -- If inventory=kg(1000) and recipe=g(1), then 1g = 0.001kg.
  RETURN v_to_factor / v_from_factor;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 3. ROBUST CONVERSION FUNCTION (UUID Version)
CREATE OR REPLACE FUNCTION get_unit_conversion_factor(
  p_from_id UUID,
  p_to_id UUID,
  p_weight_per_unit NUMERIC DEFAULT 1
) RETURNS NUMERIC AS $$
DECLARE
    v_from_type TEXT;
    v_from_factor NUMERIC;
    v_to_type TEXT;
    v_to_factor NUMERIC;
BEGIN
    IF p_from_id = p_to_id OR p_from_id IS NULL OR p_to_id IS NULL THEN RETURN 1; END IF;

    SELECT type, base_factor INTO v_from_type, v_from_factor FROM public.units WHERE id = p_from_id;
    SELECT type, base_factor INTO v_to_type, v_to_factor FROM public.units WHERE id = p_to_id;

    IF v_from_type = v_to_type THEN
        RETURN v_to_factor / v_from_factor;
    END IF;

    -- Cross-Type (Count <-> Mass/Volume)
    IF v_from_type = 'count' AND (v_to_type = 'mass' OR v_to_type = 'volume') THEN
        RETURN v_to_factor / p_weight_per_unit;
    END IF;

    IF (v_from_type = 'mass' OR v_from_type = 'volume') AND v_to_type = 'count' THEN
        RETURN p_weight_per_unit / v_from_factor;
    END IF;

    RETURN 1; 
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 4. REBUILD VIEWS WITH NULL-SAFETY
DROP VIEW IF EXISTS view_menu_details CASCADE;
DROP VIEW IF EXISTS view_recipe_costs CASCADE;

CREATE OR REPLACE VIEW view_recipe_costs AS
SELECT 
  r.menu_item_id,
  r.id as recipe_id,
  bi.branch_id,
  SUM(
    ri.quantity_needed * 
    COALESCE(
        get_unit_conversion_factor(i.unit_id, ri.unit_id, i.weight_per_unit),
        get_unit_conversion_factor(i.unit_type, ri.unit_type, i.weight_per_unit),
        1
    ) * 
    i.cost_per_unit
  ) as calculated_cost
FROM recipes r
JOIN recipe_ingredients ri ON r.id = ri.recipe_id
JOIN ingredients i ON ri.ingredient_id = i.id
JOIN branch_inventory bi ON i.id = bi.ingredient_id
WHERE i.is_active = true
GROUP BY r.menu_item_id, r.id, bi.branch_id;

CREATE OR REPLACE VIEW view_menu_details AS
SELECT 
  m.id,
  m.name,
  m.price,
  m.category,
  m.image_url,
  b.id as branch_id,
  c.recipe_id,
  COALESCE(c.calculated_cost, 0) as cost_per_plate,
  (COALESCE(m.status, 'available') = 'available') AND (COALESCE(a.is_available, true)) as is_available,
  (m.price - COALESCE(c.calculated_cost, 0)) as margin,
  CASE WHEN m.price > 0 THEN ((m.price - COALESCE(c.calculated_cost, 0)) / m.price) * 100 ELSE 0 END as margin_percent
FROM menu m
CROSS JOIN branches b
LEFT JOIN view_recipe_costs c ON m.id = c.menu_item_id AND b.id = c.branch_id
LEFT JOIN view_menu_availability a ON m.id = a.menu_item_id AND b.id = a.branch_id
WHERE (m.branch_id IS NULL OR m.branch_id = b.id);

COMMIT;
