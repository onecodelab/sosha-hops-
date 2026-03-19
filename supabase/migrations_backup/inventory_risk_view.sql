-- 1. View: Check which menu items are dependent on which ingredient (Kill Dish)
CREATE OR REPLACE VIEW view_ingredient_dependencies AS
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

-- 2. View: Revenue at Risk per Ingredient
-- Calculates sum of revenue from last 7 days for dependent dishes
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
