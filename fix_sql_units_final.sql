
-- REFINED SQL FIX: get_unit_conversion_factor
-- Rule: Qty(from) = Qty(to) * factor
-- factor = (To Base units) / (From Base units)

CREATE OR REPLACE FUNCTION get_unit_conversion_factor(
  from_unit_id UUID,
  to_unit_id UUID,
  weight_per_unit NUMERIC DEFAULT 1
) RETURNS NUMERIC AS $$
DECLARE
    v_from_type TEXT;
    v_from_factor NUMERIC;
    v_to_type TEXT;
    v_to_factor NUMERIC;
BEGIN
    IF from_unit_id = to_unit_id THEN RETURN 1; END IF;
    IF from_unit_id IS NULL OR to_unit_id IS NULL THEN RETURN 1; END IF;

    SELECT type, base_factor INTO v_from_type, v_from_factor FROM public.units WHERE id = from_unit_id;
    SELECT type, base_factor INTO v_to_type, v_to_factor FROM public.units WHERE id = to_unit_id;

    -- 1. Same Type (Mass->Mass, Vol->Vol)
    -- Factor = Base(to) / Base(from)
    -- From KG (1000), To G (1) -> 1/1000 = 0.001
    IF v_from_type = v_to_type THEN
        RETURN v_to_factor / v_from_factor;
    END IF;

    -- 2. Count -> Metric (Mass/Vol)
    -- From PCS ($/pc), To G (need 100g). Piece weighs 500g.
    -- Qty(pcs) = Qty(Metric) * factor.
    -- 100g -> 0.2 pcs. 0.2 = 100 * (1/500).
    -- Factor = Base(to) / weight_per_unit
    IF v_from_type = 'count' AND (v_to_type = 'mass' OR v_to_type = 'volume') THEN
        RETURN v_to_factor / weight_per_unit;
    END IF;

    -- 3. Metric -> Count
    -- From KG ($/kg), To PCS (need 2 pcs). Piece weighs 500g.
    -- Qty(kg) = Qty(pcs) * factor.
    -- 2 pcs -> 1kg. 1 = 2 * (500/1000).
    -- Factor = weight_per_unit / Base(from)
    IF (v_from_type = 'mass' OR v_from_type = 'volume') AND v_to_type = 'count' THEN
        RETURN weight_per_unit / v_from_factor;
    END IF;

    RETURN 1; 
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Rebuild views to apply fix
DROP VIEW IF EXISTS view_menu_details CASCADE;
DROP VIEW IF EXISTS view_recipe_costs CASCADE;

CREATE OR REPLACE VIEW view_recipe_costs AS
SELECT 
  r.menu_item_id,
  r.id as recipe_id,
  bi.branch_id,
  SUM(
    ri.quantity_needed * 
    get_unit_conversion_factor(i.unit_id, ri.unit_id, i.weight_per_unit) * 
    i.cost_per_unit
  ) as calculated_cost
FROM 
  recipes r
JOIN 
  recipe_ingredients ri ON r.id = ri.recipe_id
JOIN 
  ingredients i ON ri.ingredient_id = i.id
JOIN
  branch_inventory bi ON i.id = bi.ingredient_id
WHERE 
  i.is_active = true
GROUP BY 
  r.menu_item_id, r.id, bi.branch_id;

CREATE OR REPLACE VIEW view_menu_details AS
SELECT 
  m.id, m.name, m.price, m.category, m.image_url,
  b.id as branch_id, c.recipe_id,
  COALESCE(c.calculated_cost, 0) as cost_per_plate,
  (COALESCE(m.status, 'available') = 'available') as is_available,
  (m.price - COALESCE(c.calculated_cost, 0)) as margin,
  CASE WHEN m.price > 0 THEN ((m.price - COALESCE(c.calculated_cost, 0)) / m.price) * 100 ELSE 0 END as margin_percent
FROM 
  menu m
CROSS JOIN
  branches b
LEFT JOIN 
  view_recipe_costs c ON m.id = c.menu_item_id AND b.id = c.branch_id
WHERE
  (m.branch_id IS NULL OR m.branch_id = b.id);
