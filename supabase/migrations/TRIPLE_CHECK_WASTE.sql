-- DIAGNOSTIC 1: Check actual logs and their assigned branches
SELECT 
    w.id,
    b.name as stored_branch_name,
    i.name as ingredient_name,
    w.quantity,
    w.created_at
FROM public.waste_logs w
JOIN public.branches b ON w.branch_id = b.id
JOIN public.ingredients i ON w.ingredient_id = i.id
ORDER BY w.created_at DESC
LIMIT 10;

-- DIAGNOSTIC 2: Check active user branch and role
SELECT 
    email, 
    role, 
    home_branch_id,
    (SELECT name FROM branches WHERE id = home_branch_id) as home_branch_name
FROM public.profiles 
WHERE id = auth.uid();

-- DIAGNOSTIC 3: Check all branches in the system
SELECT id, name, location FROM public.branches;
