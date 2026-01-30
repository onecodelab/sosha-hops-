-- DEEP DIAGNOSTIC: Structure & Relations
-- Please run this and share the Output.

-- 1. Check waste_logs columns and FKs
SELECT 
    tc.constraint_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'waste_logs';

-- 2. Check ingredients columns (Verify 'sku' exists)
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'ingredients' 
AND column_name IN ('id', 'name', 'sku');

-- 3. Check User's Home Branch (Crucial for RLS)
SELECT email, role, home_branch_id 
FROM profiles 
WHERE email IN ('bocheratube@gmail.com', 'checkman1@gmail.com');

-- 4. Test Query (Simulate what the plugin does)
SELECT 
    w.id, 
    w.quantity, 
    i.name 
FROM waste_logs w
JOIN ingredients i ON w.ingredient_id = i.id
LIMIT 5;
