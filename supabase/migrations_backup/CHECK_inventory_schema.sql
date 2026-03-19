-- DIAGNOSTIC: Check Inventory Schema & Data
-- 1. Check columns in ingredients table (to see if legacy fields exist)
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'ingredients'
ORDER BY column_name;

-- 2. Check columns in branch_inventory
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'branch_inventory'
ORDER BY column_name;

-- 3. Check for specific item "Avocado" to see its global vs branch status
SELECT id, name, current_stock AS legacy_global_stock 
FROM ingredients 
WHERE name ILIKE '%Avocado%';

-- 4. Check branch_inventory for Avocado
SELECT 
    bi.branch_id,
    b.name AS branch_name,
    bi.current_stock,
    bi.par_min,
    bi.par_max
FROM branch_inventory bi
JOIN branches b ON b.id = bi.branch_id
JOIN ingredients i ON i.id = bi.ingredient_id
WHERE i.name ILIKE '%Avocado%';
