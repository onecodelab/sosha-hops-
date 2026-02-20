-- Consolidated Master Agent Views (Truth Backbone)
-- Created to ensure all views are present and properly timestamped for deployment

-- 1. VIEW: menu_details (Truth for Margins)
DROP VIEW IF EXISTS view_menu_details CASCADE;
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

-- 2. VIEW: inventory_risks (Truth for Stock)
DROP VIEW IF EXISTS view_inventory_risks CASCADE;
CREATE OR REPLACE VIEW view_inventory_risks AS
SELECT 
  i.id as ingredient_id,
  i.name as ingredient_name,
  COALESCE(SUM(oi.price * oi.quantity), 0) as revenue_at_risk_7d
FROM ingredients i
LEFT JOIN view_ingredient_dependencies d ON i.id = d.ingredient_id
LEFT JOIN orders o ON o.created_at > (now() - interval '7 days') AND o.status IN ('paid', 'closed', 'served')
LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.menu_item_id = d.menu_item_id
GROUP BY i.id, i.name;

-- 3. VIEW: staff_performance_live (Truth for Labor - Simple Placeholder)
DROP VIEW IF EXISTS view_staff_performance_live CASCADE;
CREATE OR REPLACE VIEW view_staff_performance_live AS
SELECT 
    u.id as staff_id,
    p.full_name,
    COUNT(o.id) as tables_served_today,
    SUM(o.total_amount) as sales_today
FROM auth.users u
JOIN profiles p ON u.id = p.id
LEFT JOIN orders o ON o.waiter_id = u.id AND o.created_at >= date_trunc('day', now())
GROUP BY u.id, p.full_name;
