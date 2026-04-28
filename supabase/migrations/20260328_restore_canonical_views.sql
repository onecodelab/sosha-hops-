-- Migration: 20260328_restore_canonical_views.sql
-- Purpose: Restore view_menu_details and related views with full multi-tenancy and metadata support.
-- Fixes the "column organization_id does not exist" error in orders.

BEGIN;

-- 1. Restore view_recipe_costs with organization_id support
DROP VIEW IF EXISTS view_recipe_costs CASCADE;
CREATE OR REPLACE VIEW view_recipe_costs 
WITH (security_invoker = true) AS
SELECT 
  r.menu_item_id,
  r.id as recipe_id,
  r.organization_id, -- Added org_id
  SUM(
    ri.quantity_needed * 
    public.get_unit_conversion_factor(i.unit_type, ri.unit_type, i.weight_per_unit) * 
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

-- 2. Restore view_menu_availability with branch_id support
DROP VIEW IF EXISTS view_menu_availability CASCADE;
CREATE OR REPLACE VIEW view_menu_availability 
WITH (security_invoker = true) AS
SELECT 
  r.menu_item_id,
  r.organization_id,
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
  ingredients i ON ri.ingredient_id = i.id
JOIN
  branch_inventory bi ON i.id = bi.ingredient_id
GROUP BY 
  r.menu_item_id, r.organization_id, bi.branch_id;

-- 3. Restore Canonical view_menu_details
-- This version contains ALL metadata needed by the AI and Frontend
DROP VIEW IF EXISTS view_menu_details CASCADE;
CREATE OR REPLACE VIEW view_menu_details
WITH (security_invoker = true) AS
SELECT
  m.id,
  m.name,
  m.price,
  COALESCE(cat.name, m.category) as category,
  m.image_url,
  m.description,
  m.dietary_tags,
  m.ingredients_list,
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
  COALESCE(a.branch_id, m.branch_id) as branch_id -- Crucial for filtering
FROM
  menu m
LEFT JOIN
  categories cat ON m.category_id = cat.id
LEFT JOIN
  view_recipe_costs c ON m.id = c.menu_item_id
LEFT JOIN
  view_menu_availability a ON m.id = a.menu_item_id 
    AND (m.branch_id = a.branch_id OR m.branch_id IS NULL OR a.branch_id IS NULL);

COMMIT;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
