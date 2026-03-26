-- Migration: 20260326_add_menu_metadata.sql
-- Purpose: Add semantic metadata columns (ingredients, spice_level, portion_size, tags) to menu to allow AI to perform contextual filtering without hallucination.

BEGIN;

-- 1. Add new columns to menu table
ALTER TABLE menu
ADD COLUMN IF NOT EXISTS dietary_tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS ingredients_list TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS spice_level TEXT DEFAULT 'None',
ADD COLUMN IF NOT EXISTS portion_size TEXT DEFAULT 'Standard';

-- 2. Update view_menu_details to expose these items strictly
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
  view_recipe_costs c ON m.id = c.menu_item_id AND b.id = c.branch_id
LEFT JOIN
  view_menu_availability a ON m.id = a.menu_item_id AND b.id = a.branch_id;

COMMIT;

-- Reload schema cache for PostgREST
NOTIFY pgrst, 'reload schema';
