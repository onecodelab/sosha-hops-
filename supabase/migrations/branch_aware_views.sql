
-- Sosha OS: Multi-Branch Aware Inventory Truth Views
-- These updates ensure that Menu availability and costs are calculated 
-- per-branch using the branch_inventory table instead of global stock.

-- IMPORTANT: We must drop existing views because column structures are changing
DROP VIEW IF EXISTS view_menu_details;
DROP VIEW IF EXISTS view_menu_availability;
DROP VIEW IF EXISTS view_recipe_costs;

-- 1. Updated View: Recipe Costs (Branch-Specific)
CREATE OR REPLACE VIEW view_recipe_costs AS
SELECT 
  r.menu_item_id,
  r.id as recipe_id,
  bi.branch_id,
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
JOIN
  branch_inventory bi ON i.id = bi.ingredient_id
WHERE 
  i.is_active = true
GROUP BY 
  r.menu_item_id, r.id, bi.branch_id;

-- 2. Updated View: Menu Availability (Branch-Specific)
CREATE OR REPLACE VIEW view_menu_availability AS
SELECT 
  r.menu_item_id,
  bi.branch_id,
  bool_and(
    CASE 
      WHEN ri.out_of_stock_impact = 'kills_dish' THEN bi.current_stock > 0
      ELSE true 
    END
  ) as is_available
FROM 
  recipes r
JOIN 
  recipe_ingredients ri ON r.id = ri.recipe_id
JOIN 
  branch_inventory bi ON ri.ingredient_id = bi.ingredient_id
GROUP BY 
  r.menu_item_id, bi.branch_id;

-- 3. Updated Master View: Menu Details (Branch-Specific)
-- This view now returns one row per menu item PER branch.
CREATE OR REPLACE VIEW view_menu_details AS
SELECT 
  m.id,
  m.name,
  m.price,
  m.category,
  m.image_url,
  b.id as branch_id,
  COALESCE(c.calculated_cost, 0) as cost_price,
  COALESCE(a.is_available, true) as is_available,
  (m.price - COALESCE(c.calculated_cost, 0)) as margin,
  CASE WHEN m.price > 0 THEN ((m.price - COALESCE(c.calculated_cost, 0)) / m.price) * 100 ELSE 0 END as margin_percent
FROM 
  menu m
CROSS JOIN
  branches b
LEFT JOIN 
  view_recipe_costs c ON m.id = c.menu_item_id AND b.id = c.branch_id
LEFT JOIN 
  view_menu_availability a ON m.id = a.menu_item_id AND b.id = a.branch_id;
