
-- 1. Fix Inverted SQL Function
-- Previous logic was: from_factor / to_factor (wrong)
-- New logic: to_factor / from_factor (correct)
-- Example: from KG (1000) to G (1) -> 1/1000 = 0.001. Qty(G) * 0.001 = Qty(KG).
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
    
    -- 2. Null Checks
    IF from_unit_id IS NULL OR to_unit_id IS NULL THEN RETURN 1; END IF;

    -- 3. Get Unit Details
    SELECT type, base_factor INTO v_from_type, v_from_factor FROM public.units WHERE id = from_unit_id;
    SELECT type, base_factor INTO v_to_type, v_to_factor FROM public.units WHERE id = to_unit_id;

    -- 4. Same Type Conversion
    IF v_from_type = v_to_type THEN
        RETURN v_to_factor / v_from_factor;
    END IF;

    -- 5. Cross-Type: Count -> Metric (Mass/Vol)
    -- Target is Metric, Source is Pieces. 
    -- 1 Piece = weight_per_unit (Base Units).
    -- We want Qty(target_metric_units).
    -- Qty(Metric) = Qty(Pieces) * factor.
    -- factor = weight_per_unit / v_to_factor.
    IF v_from_type = 'count' AND (v_to_type = 'mass' || v_to_type = 'volume') THEN
        RETURN weight_per_unit / v_to_factor;
    END IF;

    -- 6. Cross-Type: Metric -> Count
    -- Target is pieces, Source is Metric.
    -- Qty(Pieces) = Qty(Metric) * factor.
    -- factor = v_from_factor / weight_per_unit.
    IF (v_from_type = 'mass' || v_from_type = 'volume') AND v_to_type = 'count' THEN
        RETURN v_from_factor / weight_per_unit;
    END IF;

    RETURN 1; 
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 2. Force Rebuild Views to pick up the fix
DROP VIEW IF EXISTS view_menu_details CASCADE;
DROP VIEW IF EXISTS view_recipe_costs CASCADE;

-- Re-run the view definitions from the latest migration to ensure they are fresh
-- (Handled by the system if we run the full migration, but let's be explicit here)
