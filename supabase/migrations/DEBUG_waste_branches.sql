-- DIAGNOSTIC: Check Branch IDs in Waste Logs
-- We need to see which branch IDs are actually stored in the data.

-- 1. Count logs per branch
SELECT branch_id, count(*) 
FROM public.waste_logs 
GROUP BY branch_id;

-- 2. See the latest few logs with branch names
SELECT 
    w.created_at, 
    b.name as branch_name, 
    w.branch_id, 
    i.name as ingredient_name, 
    w.quantity
FROM public.waste_logs w
JOIN public.branches b ON w.branch_id = b.id
JOIN public.ingredients i ON w.ingredient_id = i.id
ORDER BY w.created_at DESC
LIMIT 10;
