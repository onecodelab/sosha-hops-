-- Migration: 20260315_fix_mcp_views_and_menu_schema.sql
-- Purpose: Fix menu fetching in chatbot and ensure multi-tenancy columns are present

BEGIN;

-- 1. Ensure menu table has description
ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS description TEXT;

-- 2. Update view_menu_details
-- We include organization_id and description needed by mcp-server
DROP VIEW IF EXISTS view_menu_details CASCADE;
CREATE OR REPLACE VIEW view_menu_details 
WITH (security_invoker = true) AS
SELECT 
  m.id,
  m.name,
  m.price,
  m.category,
  m.image_url,
  m.description,
  m.organization_id,
  m.status as manual_status,
  COALESCE(m.branch_id, a.branch_id) as branch_id,
  m.branch_id as scope_branch_id,
  c.recipe_id,
  COALESCE(c.calculated_cost, 0) as cost_per_plate,
  (COALESCE(m.status, 'available') = 'available') AND (COALESCE(a.is_available, true)) as is_available,
  (m.price - COALESCE(c.calculated_cost, 0)) as margin,
  CASE WHEN m.price > 0 THEN ((m.price - COALESCE(c.calculated_cost, 0)) / m.price) * 100 ELSE 0 END as margin_percent
FROM 
  menu m
LEFT JOIN 
  view_recipe_costs c ON m.id = c.menu_item_id
LEFT JOIN 
  view_menu_availability a ON m.id = a.menu_item_id 
    AND (m.branch_id = a.branch_id OR m.branch_id IS NULL);

-- 3. Update view_inventory_risks
DROP VIEW IF EXISTS view_inventory_risks CASCADE;
CREATE OR REPLACE VIEW view_inventory_risks 
WITH (security_invoker = true) AS
SELECT 
  i.id as ingredient_id,
  i.name as ingredient_name,
  i.organization_id,
  COALESCE(SUM(oi.price * oi.quantity), 0) as revenue_at_risk_7d
FROM ingredients i
LEFT JOIN view_ingredient_dependencies d ON i.id = d.ingredient_id
LEFT JOIN orders o ON o.created_at > (now() - interval '7 days') AND o.status IN ('paid', 'closed', 'served')
LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.menu_item_id = d.menu_item_id
GROUP BY i.id, i.name, i.organization_id;

-- 4. Update view_inventory_intelligence
DROP VIEW IF EXISTS view_inventory_intelligence CASCADE;
CREATE OR REPLACE VIEW view_inventory_intelligence 
WITH (security_invoker = true) AS
SELECT 
  i.id,
  i.name,
  i.organization_id,
  i.current_stock,
  i.unit_type,
  i.cost_per_unit,
  i.updated_at,
  COALESCE(u.usage_last_7d, 0) as usage_7d,
  COALESCE(u.usage_prev_7d, 0) as usage_prev_7d,
  COALESCE(u.usage_last_14d, 0) / 14.0 as avg_daily_usage,
  CASE 
    WHEN i.current_stock <= 0 THEN 0 
    WHEN COALESCE(u.usage_last_14d, 0) = 0 THEN 999 
    ELSE i.current_stock / (COALESCE(u.usage_last_14d, 0) / 14.0)
  END as days_of_stock_left,
  CASE 
    WHEN COALESCE(u.usage_prev_7d, 0) = 0 THEN 1.0 
    ELSE COALESCE(u.usage_last_7d, 0) / NULLIF(u.usage_prev_7d, 0)
  END as velocity_ratio,
  COALESCE(risk.revenue_at_risk_7d, 0) as revenue_at_risk_7d,
  COALESCE(dep.total_menu_items, 0) as total_menu_items,
  COALESCE(dep.active_kill_dish_items, 0) as active_kill_dish_items
FROM ingredients i
LEFT JOIN view_ingredient_usage_stats u ON i.id = u.ingredient_id
LEFT JOIN view_inventory_risks risk ON i.id = risk.ingredient_id
LEFT JOIN view_ingredient_dependency_counts dep ON i.id = dep.ingredient_id
WHERE i.is_active = true;

COMMIT;

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
