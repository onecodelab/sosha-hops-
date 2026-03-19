-- BARO OS: Add Branch Relationship to Menu & Categories
-- Enables "Hybrid Menu" system: Global items (null branch_id) + Branch-Specific items.

-- 1. Add branch_id to Categories
ALTER TABLE public.categories 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

-- 2. Add branch_id to Menu
ALTER TABLE public.menu 
ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id);

-- 3. Update Master View: view_menu_details
-- Logic Change:
-- OLD: Cross Join (Every item appears in every branch)
-- NEW: Intelligent Join (Global items appear in all branches, Branch-Specific items only appear in their branch)

DROP VIEW IF EXISTS view_menu_details;

CREATE OR REPLACE VIEW view_menu_details AS
SELECT 
  m.id,
  m.name,
  m.price,
  m.category,
  m.image_url,
  b.id as branch_id,
  c.recipe_id,
  COALESCE(c.calculated_cost, 0) as cost_per_plate,
  -- Availability Check:
  -- 1. Manual Status must be 'available'
  -- 2. IF it has ingredients (view_menu_availability entry exists), it must be in stock.
  -- 3. IF it has NO ingredients (service item), we assume it's available.
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
  view_menu_availability a ON m.id = a.menu_item_id AND b.id = a.branch_id
WHERE
  -- THE CORE LOGIC:
  -- 1. Item is Global (m.branch_id IS NULL) -> Show in all branches
  -- 2. Item is Specific (m.branch_id = b.id) -> Show only in that branch
  (m.branch_id IS NULL OR m.branch_id = b.id);

-- Reload schema cache
NOTIFY pgrst, 'reload schema';
