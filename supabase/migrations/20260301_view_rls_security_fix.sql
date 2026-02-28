-- ============================================================
-- Baro OS - View Isolation Migration (RLS Bypass Fix)
-- Recreates intelligence/truth views with SECURITY INVOKER
-- ============================================================

-- 0. CASCADE DROP core views that depend on each other
DROP VIEW IF EXISTS view_inventory_intelligence CASCADE;
DROP VIEW IF EXISTS view_menu_details CASCADE;
DROP VIEW IF EXISTS view_inventory_risks CASCADE;
DROP VIEW IF EXISTS view_ingredient_usage_stats CASCADE;
DROP VIEW IF EXISTS view_menu_availability CASCADE;
DROP VIEW IF EXISTS view_recipe_costs CASCADE;
DROP VIEW IF EXISTS view_ingredient_dependency_counts CASCADE;
DROP VIEW IF EXISTS view_ingredient_dependencies CASCADE;

-- 1. view_ingredient_dependencies
CREATE VIEW view_ingredient_dependencies 
WITH (security_invoker = true) AS
SELECT 
  ri.ingredient_id,
  ri.quantity_needed,
  ri.unit_type,
  ri.out_of_stock_impact,
  m.id as menu_item_id,
  m.name as menu_item_name,
  m.price as menu_item_price
FROM recipe_ingredients ri
JOIN recipes r ON ri.recipe_id = r.id
JOIN menu m ON r.menu_item_id = m.id
WHERE ri.out_of_stock_impact = 'kills_dish';

-- 2. view_inventory_risks
CREATE VIEW view_inventory_risks 
WITH (security_invoker = true) AS
SELECT 
  i.id as ingredient_id,
  i.name as ingredient_name,
  COALESCE(SUM(oi.price * oi.quantity), 0) as revenue_at_risk_7d
FROM ingredients i
LEFT JOIN view_ingredient_dependencies d ON i.id = d.ingredient_id
LEFT JOIN orders o ON o.created_at > (now() - interval '7 days') AND o.status IN ('paid', 'closed', 'served')
LEFT JOIN order_items oi ON oi.order_id = o.id AND oi.menu_item_id = d.menu_item_id
GROUP BY i.id, i.name;

-- 3. view_recipe_costs
CREATE VIEW view_recipe_costs 
WITH (security_invoker = true) AS
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

-- 4. view_menu_availability
CREATE VIEW view_menu_availability 
WITH (security_invoker = true) AS
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

-- 5. view_menu_details
CREATE VIEW view_menu_details 
WITH (security_invoker = true) AS
SELECT 
  m.id,
  m.name,
  m.price,
  m.category,
  m.image_url,
  COALESCE(m.branch_id, a.branch_id) as branch_id, -- Effective branch ID for stock check
  m.branch_id as scope_branch_id, -- Original dish scope
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
  view_menu_availability a ON m.id = a.menu_item_id 
    AND (m.branch_id = a.branch_id OR m.branch_id IS NULL);

-- 6. view_ingredient_usage_stats
CREATE VIEW view_ingredient_usage_stats 
WITH (security_invoker = true) AS
SELECT 
  ri.ingredient_id,
  SUM(CASE WHEN o.created_at >= (now() - interval '7 days') THEN 
      (oi.quantity * ri.quantity_needed * get_unit_conversion_factor(i.unit_type, ri.unit_type, i.weight_per_unit)) 
      ELSE 0 END) as usage_last_7d,
  SUM(CASE WHEN o.created_at < (now() - interval '7 days') AND o.created_at >= (now() - interval '14 days') THEN 
      (oi.quantity * ri.quantity_needed * get_unit_conversion_factor(i.unit_type, ri.unit_type, i.weight_per_unit)) 
      ELSE 0 END) as usage_prev_7d,
  SUM(oi.quantity * ri.quantity_needed * get_unit_conversion_factor(i.unit_type, ri.unit_type, i.weight_per_unit)) as usage_last_14d
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
JOIN recipes r ON oi.menu_item_id = r.menu_item_id
JOIN recipe_ingredients ri ON r.id = ri.recipe_id
JOIN ingredients i ON ri.ingredient_id = i.id
WHERE o.status IN ('paid', 'closed', 'served') 
  AND o.created_at >= (now() - interval '14 days')
GROUP BY ri.ingredient_id;

-- 7. view_ingredient_dependency_counts
CREATE VIEW view_ingredient_dependency_counts 
WITH (security_invoker = true) AS
SELECT 
  ri.ingredient_id,
  COUNT(DISTINCT r.menu_item_id) as total_menu_items,
  COUNT(DISTINCT CASE WHEN ri.out_of_stock_impact = 'kills_dish' AND m.id IS NOT NULL THEN m.id END) as active_kill_dish_items
FROM recipe_ingredients ri
JOIN recipes r ON ri.recipe_id = r.id
LEFT JOIN menu m ON r.menu_item_id = m.id
GROUP BY ri.ingredient_id;

-- 8. view_inventory_intelligence
CREATE VIEW view_inventory_intelligence 
WITH (security_invoker = true) AS
SELECT 
  i.id,
  i.name,
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

-- Final Step: Cache busting / Reload Schema
NOTIFY pgrst, 'reload schema';
