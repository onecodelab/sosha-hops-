
-- Update view_menu_details to harden margin calculation
DROP VIEW IF EXISTS view_menu_details CASCADE;

CREATE VIEW view_menu_details
WITH (security_invoker = true) AS
SELECT
  m.id,
  m.name,
  m.price,
  m.category,
  m.image_url,
  COALESCE(m.branch_id, a.branch_id) as branch_id,
  m.branch_id as scope_branch_id,
  c.recipe_id,
  COALESCE(c.calculated_cost, 0) as cost_per_plate,
  COALESCE(a.is_available, true) as is_available,
  (m.price - COALESCE(c.calculated_cost, 0)) as margin,
  CASE
    WHEN m.price > 0 THEN
      LEAST(GREATEST(((m.price - COALESCE(c.calculated_cost, 0)) / m.price) * 100, -100), 100)
    ELSE 0
  END as margin_percent
FROM
  menu m
LEFT JOIN
  view_recipe_costs c ON m.id = c.menu_item_id
LEFT JOIN
  view_menu_availability a ON m.id = a.menu_item_id
    AND (m.branch_id = a.branch_id OR m.branch_id IS NULL);
