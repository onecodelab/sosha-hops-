-- 1. View: Ingredient Usage Stats (14 Day Window)
-- Calculates raw usage quantities based on orders
CREATE OR REPLACE VIEW view_ingredient_usage_stats AS
SELECT 
  ri.ingredient_id,
  -- Usage Last 7 Days
  SUM(CASE WHEN o.created_at >= (now() - interval '7 days') THEN 
      (oi.quantity * ri.quantity_needed * get_unit_conversion_factor(i.unit_type, ri.unit_type, i.weight_per_unit)) 
      ELSE 0 END) as usage_last_7d,
  -- Usage Previous 7 Days (Day 8-14)
  SUM(CASE WHEN o.created_at < (now() - interval '7 days') AND o.created_at >= (now() - interval '14 days') THEN 
      (oi.quantity * ri.quantity_needed * get_unit_conversion_factor(i.unit_type, ri.unit_type, i.weight_per_unit)) 
      ELSE 0 END) as usage_prev_7d,
  -- Total 14 Day Usage
  SUM(oi.quantity * ri.quantity_needed * get_unit_conversion_factor(i.unit_type, ri.unit_type, i.weight_per_unit)) as usage_last_14d
FROM order_items oi
JOIN orders o ON oi.order_id = o.id
JOIN recipes r ON oi.menu_item_id = r.menu_item_id
JOIN recipe_ingredients ri ON r.id = ri.recipe_id
JOIN ingredients i ON ri.ingredient_id = i.id
WHERE o.status IN ('paid', 'closed', 'served') 
  AND o.created_at >= (now() - interval '14 days')
GROUP BY ri.ingredient_id;

-- 2. View: Menu Dependencies Count
CREATE OR REPLACE VIEW view_ingredient_dependency_counts AS
SELECT 
  ri.ingredient_id,
  COUNT(DISTINCT r.menu_item_id) as total_menu_items,
  COUNT(DISTINCT CASE WHEN ri.out_of_stock_impact = 'kills_dish' AND m.id IS NOT NULL THEN m.id END) as active_kill_dish_items
FROM recipe_ingredients ri
JOIN recipes r ON ri.recipe_id = r.id
LEFT JOIN menu m ON r.menu_item_id = m.id
GROUP BY ri.ingredient_id;

-- 3. Master View: Inventory Intelligence
-- Joins everything and computes final metrics
CREATE OR REPLACE VIEW view_inventory_intelligence AS
SELECT 
  i.id,
  i.name,
  i.current_stock,
  i.unit_type,
  i.cost_per_unit,
  i.updated_at,
  
  -- Computed Usage Metrics
  COALESCE(u.usage_last_7d, 0) as usage_7d,
  COALESCE(u.usage_prev_7d, 0) as usage_prev_7d,
  COALESCE(u.usage_last_14d, 0) / 14.0 as avg_daily_usage,
  
  -- Days of Stock Left
  CASE 
    WHEN i.current_stock <= 0 THEN 0 -- Correctly report 0 days if out of stock
    WHEN COALESCE(u.usage_last_14d, 0) = 0 THEN 999 -- Infinite if no usage but has stock
    ELSE i.current_stock / (COALESCE(u.usage_last_14d, 0) / 14.0)
  END as days_of_stock_left,

  -- Velocity Ratio
  CASE 
    WHEN COALESCE(u.usage_prev_7d, 0) = 0 THEN 1.0 -- Baseline if no previous history
    ELSE COALESCE(u.usage_last_7d, 0) / NULLIF(u.usage_prev_7d, 0)
  END as velocity_ratio,

  -- Revenue Risk (from existing view)
  COALESCE(risk.revenue_at_risk_7d, 0) as revenue_at_risk_7d,

  -- Dependency Counts
  COALESCE(dep.total_menu_items, 0) as total_menu_items,
  COALESCE(dep.active_kill_dish_items, 0) as active_kill_dish_items

FROM ingredients i
LEFT JOIN view_ingredient_usage_stats u ON i.id = u.ingredient_id
LEFT JOIN view_inventory_risks risk ON i.id = risk.ingredient_id
LEFT JOIN view_ingredient_dependency_counts dep ON i.id = dep.ingredient_id
WHERE i.is_active = true;
