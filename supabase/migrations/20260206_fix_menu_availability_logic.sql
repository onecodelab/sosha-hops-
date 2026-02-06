-- SOSHA OS: Fix Menu Availability Logic
-- Ensures 'menu' table handles availability status correctly and views respect manual overrides.

-- 1. Ensure 'menu' table has the 'status' column
ALTER TABLE public.menu ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available';

-- 2. Update the Master View to respect manual status
-- We modify 'view_menu_details' to combine manual status + inventory check
CREATE OR REPLACE VIEW view_menu_details AS
SELECT 
  m.id,
  m.name,
  m.price,
  m.category,
  m.image_url,
  m.status as manual_status,
  b.id as branch_id,
  c.recipe_id,
  COALESCE(c.calculated_cost, 0) as cost_per_plate,
  -- FINAL AVAILABILITY: Manual Toggle (status = 'available') AND Inventory Check (from view_menu_availability)
  (COALESCE(m.status, 'available') = 'available') AND (COALESCE(a.is_available, true)) as is_available,
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

-- Reload schema
NOTIFY pgrst, 'reload schema';
