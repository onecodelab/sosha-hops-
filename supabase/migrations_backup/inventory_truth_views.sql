-- 1. Unit Conversion Function
-- Returns conversion factor to normalize everything to grams (g) or milliliters (ml)
CREATE OR REPLACE FUNCTION get_unit_conversion_factor(
  from_unit text,
  to_unit text,
  weight_per_unit numeric DEFAULT 1
) RETURNS numeric AS $$
BEGIN
  -- Normalize inputs
  from_unit := lower(trim(from_unit));
  to_unit := lower(trim(to_unit));

  -- Identity
  IF from_unit = to_unit THEN RETURN 1; END IF;

  -- Mass: kg <-> g
  IF from_unit = 'kg' AND to_unit = 'g' THEN RETURN 0.001; END IF; -- 1g is 0.001kg (Wait, no. Inventory price is per kg. So we need price per g?) 
  -- LOGIC CHECK: We want to convert QTY needed (in recipe unit) to QTY inventory (in inventory unit)
  -- Actually, let's keep it simple. We return the MULTIPLIER to apply to quantity.
  
  -- Case: Recipe in G, Inventory in KG (Need 100g, Price is for 1KG)
  -- 100g = 0.1kg. Factor = 0.001
  
  IF from_unit = 'kg' AND to_unit = 'g' THEN RETURN 0.001; END IF;
  IF from_unit = 'g' AND to_unit = 'kg' THEN RETURN 1000; END IF;

  -- Volume: l <-> ml
  IF from_unit = 'l' AND to_unit = 'ml' THEN RETURN 0.001; END IF;
  IF from_unit = 'ml' AND to_unit = 'l' THEN RETURN 1000; END IF;

  -- Pieces to Mass/Volume (Recipe uses Pieces, Inventory uses Mass)
  -- e.g. Recipe: 1 Onion (pcs), Inventory: Onions (kg)
  -- weight_per_unit is "Grams per Piece" (e.g. 150g per onion)
  -- We need to consume 150g from inventory. 150g = 0.15kg.
  -- 1 pc * (150g/pc) * (1kg/1000g) = 0.15 kgs
  
  IF (to_unit = 'pcs' OR to_unit = 'unit' OR to_unit = 'slice') AND (from_unit = 'kg' OR from_unit = 'l') THEN
    RETURN (weight_per_unit / 1000.0);
  END IF;

  IF (to_unit = 'pcs' OR to_unit = 'unit' OR to_unit = 'slice') AND (from_unit = 'g' OR from_unit = 'ml') THEN
    RETURN weight_per_unit;
  END IF;

  RETURN 1; -- Fallback
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. View: Recipe Costs
-- Calculates the total cost of a recipe dynamically
CREATE OR REPLACE VIEW view_recipe_costs AS
SELECT 
  r.menu_item_id,
  r.id as recipe_id,
  SUM(
    ri.quantity_needed * 
    get_unit_conversion_factor(i.unit_type, ri.unit_type, i.weight_per_unit) * 
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
  r.menu_item_id, r.id;

-- 3. View: Menu Availability
-- Determines availability based on "Kill Dish" ingredients
CREATE OR REPLACE VIEW view_menu_availability AS
SELECT 
  r.menu_item_id,
  bool_and(
    CASE 
      WHEN ri.out_of_stock_impact = 'kills_dish' THEN i.current_stock > 0
      ELSE true 
    END
  ) as is_available
FROM 
  recipes r
JOIN 
  recipe_ingredients ri ON r.id = ri.recipe_id
JOIN 
  ingredients i ON ri.ingredient_id = i.id
GROUP BY 
  r.menu_item_id;

-- 4. Master View: Menu Details
-- Joins everything for the frontend
CREATE OR REPLACE VIEW view_menu_details AS
SELECT 
  m.id,
  m.name,
  m.price,
  m.category,
  m.image_url,
  m.branch_id,
  c.recipe_id,
  COALESCE(c.calculated_cost, 0) as cost_per_plate,
  COALESCE(a.is_available, true) as is_available,
  (m.price - COALESCE(c.calculated_cost, 0)) as margin,
  CASE WHEN m.price > 0 THEN ((m.price - COALESCE(c.calculated_cost, 0)) / m.price) * 100 ELSE 0 END as margin_percent
FROM 
  menu m
LEFT JOIN 
  view_recipe_costs c ON m.id = c.menu_item_id
LEFT JOIN 
  view_menu_availability a ON m.id = a.menu_item_id;
