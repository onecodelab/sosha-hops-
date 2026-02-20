-- MIGRATION: 20260215_harden_units.sql
-- PURPOSE: Replace loose text 'unit_type' with strict Foreign Key 'unit_id'
-- GOAL: Enable precise Agent math (No "kgs" vs "kilo" errors)

BEGIN;

-- 0. Nuke Dependent Views (We will rebuild them better, stronger, faster)
DROP VIEW IF EXISTS view_menu_details CASCADE;
DROP VIEW IF EXISTS view_menu_availability CASCADE;
DROP VIEW IF EXISTS view_recipe_costs CASCADE;

-- 1. Create Strict Units Table
CREATE TABLE IF NOT EXISTS public.units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,          -- 'Kilogram', 'Gram'
    abbreviation TEXT NOT NULL UNIQUE,  -- 'kg', 'g'
    type TEXT CHECK (type IN ('mass', 'volume', 'count')), -- 'mass', 'volume'
    base_factor NUMERIC NOT NULL DEFAULT 1, -- Conversion to base (g or ml)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Seed Standard Units (The "Truth" List)
INSERT INTO public.units (name, abbreviation, type, base_factor) VALUES
('Kilogram', 'kg', 'mass', 1000),       -- 1 kg = 1000 g
('Gram', 'g', 'mass', 1),               -- Base Mass
('Milligram', 'mg', 'mass', 0.001),     -- 1 mg = 0.001 g
('Liter', 'l', 'volume', 1000),         -- 1 l = 1000 ml
('Milliliter', 'ml', 'volume', 1),      -- Base Volume
('Piece', 'pcs', 'count', 1),           -- Base Count
('Portion', 'portion', 'count', 1),     -- Logical Count
('Bottle', 'bottle', 'count', 1),       -- Logical Count
('Can', 'can', 'count', 1)              -- Logical Count
ON CONFLICT (name) DO NOTHING;

-- 3. Add unit_id to Ingredients
ALTER TABLE public.ingredients 
ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id);

-- 4. Migrate Data: Ingredients (Best Effort Matching)
UPDATE public.ingredients i
SET unit_id = u.id
FROM public.units u
WHERE LOWER(TRIM(i.unit_type)) = u.abbreviation;

UPDATE public.ingredients i
SET unit_id = u.id
FROM public.units u
WHERE LOWER(TRIM(i.unit_type)) = 'unit' AND u.abbreviation = 'pcs';

-- 5. Add unit_id to Recipe Ingredients
ALTER TABLE public.recipe_ingredients 
ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES public.units(id);

-- 6. Migrate Data: Recipe Ingredients
UPDATE public.recipe_ingredients ri
SET unit_id = u.id
FROM public.units u
WHERE LOWER(TRIM(ri.unit_type)) = u.abbreviation;

UPDATE public.recipe_ingredients ri
SET unit_id = u.id
FROM public.units u
WHERE LOWER(TRIM(ri.unit_type)) = 'unit' AND u.abbreviation = 'pcs';

-- 7. REWRITE: get_unit_conversion_factor (The "Brain" Fix)
CREATE OR REPLACE FUNCTION get_unit_conversion_factor(
  from_unit_id UUID,
  to_unit_id UUID,
  weight_per_unit NUMERIC DEFAULT 1
) RETURNS NUMERIC AS $$
DECLARE
    v_from_type TEXT;
    v_from_factor NUMERIC;
    v_to_type TEXT;
    v_to_factor NUMERIC;
BEGIN
    -- 1. Identity Check
    IF from_unit_id = to_unit_id THEN RETURN 1; END IF;
    
    -- 2. Null Checks (If migration failed for some rows, return 1 to avoid crash)
    IF from_unit_id IS NULL OR to_unit_id IS NULL THEN RETURN 1; END IF;

    -- 3. Get Unit Details
    SELECT type, base_factor INTO v_from_type, v_from_factor FROM public.units WHERE id = from_unit_id;
    SELECT type, base_factor INTO v_to_type, v_to_factor FROM public.units WHERE id = to_unit_id;

    -- 4. Same Type Conversion
    IF v_from_type = v_to_type THEN
        RETURN v_from_factor / v_to_factor;
    END IF;

    -- 5. Cross-Type: Count -> Mass/Vol
    IF v_from_type = 'count' AND (v_to_type = 'mass' OR v_to_type = 'volume') THEN
        RETURN weight_per_unit / v_to_factor;
    END IF;

    -- 6. Cross-Type: Mass/Vol -> Count
    IF (v_from_type = 'mass' OR v_from_type = 'volume') AND v_to_type = 'count' THEN
        RETURN v_from_factor / weight_per_unit;
    END IF;

    RETURN 1; 
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 8. REBUILD VIEWS (Branch-Aware + ID Math)

-- 8a. View: Recipe Costs (Updated to use IDs)
CREATE OR REPLACE VIEW view_recipe_costs AS
SELECT 
  r.menu_item_id,
  r.id as recipe_id,
  bi.branch_id,
  SUM(
    ri.quantity_needed * 
    get_unit_conversion_factor(i.unit_id, ri.unit_id, i.weight_per_unit) * 
    i.cost_per_unit
  ) as calculated_cost
FROM 
  recipes r
JOIN 
  recipe_ingredients ri ON r.id = ri.recipe_id
JOIN 
  ingredients i ON ri.ingredient_id = i.id
JOIN
  branch_inventory bi ON i.id = bi.ingredient_id -- Branch Aware Join
WHERE 
  i.is_active = true
GROUP BY 
  r.menu_item_id, r.id, bi.branch_id;

-- 8b. View: Menu Availability (Restored from branch_aware_views.sql)
CREATE OR REPLACE VIEW view_menu_availability AS
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

-- 8c. View: Menu Details (Restored from branch_aware_views.sql)
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
  (m.branch_id IS NULL OR m.branch_id = b.id);

COMMIT;
