-- Migration: 20260326_automate_ingredients.sql
-- Purpose: Remove the manual ingredients_list column from menu, and dynamically construct it in view_menu_details from real Recipe mappings.

BEGIN;

-- 1. Remove the old manual column
ALTER TABLE menu DROP COLUMN IF EXISTS ingredients_list CASCADE;

-- 2. Wait, dropping the column might break view_menu_details temporarily if it references it. 
-- We will just recreate the view directly replacing m.ingredients_list with a subquery.

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
  (
    SELECT array_agg(i.name)
    FROM recipes r
    JOIN recipe_ingredients ri ON r.id = ri.recipe_id
    JOIN ingredients i ON ri.ingredient_id = i.id
    WHERE r.menu_item_id = m.id
  ) as ingredients_list,
  m.spice_level,
  m.portion_size,
  m.organization_id,
  m.status as manual_status,
  b.id as branch_id,
  m.branch_id as scope_branch_id,
  c.recipe_id,
  COALESCE(c.calculated_cost, 0) as cost_per_plate,
  (COALESCE(m.status, 'available') = 'available') AND (COALESCE(a.is_available, true)) as is_available,
  (m.price - COALESCE(c.calculated_cost, 0)) as margin,
  CASE WHEN m.price > 0 THEN ((m.price - COALESCE(c.calculated_cost, 0)) / m.price) * 100 ELSE 0 END as margin_percent
FROM
  menu m
JOIN
  branches b ON m.organization_id = b.organization_id AND (m.branch_id IS NULL OR m.branch_id = b.id)
LEFT JOIN
  categories cat ON m.category_id = cat.id
LEFT JOIN
  view_recipe_costs c ON m.id = c.menu_item_id
LEFT JOIN
  view_menu_availability a ON m.id = a.menu_item_id AND b.id = a.branch_id;

COMMIT;

-- Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
