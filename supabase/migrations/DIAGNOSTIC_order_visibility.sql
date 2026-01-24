-- DIAGNOSTIC: Check why orders aren't visible to waiter
-- Run this and share the results

-- 1. Show all active orders (not closed)
SELECT 
    id,
    order_number,
    table_number,
    status,
    branch_id,
    waiter_id,
    created_at
FROM orders 
WHERE closed_at IS NULL
ORDER BY created_at DESC
LIMIT 10;

-- 2. Show branch IDs
SELECT id, name FROM branches;

-- 3. Show waiter profile (replace email with actual waiter email)
SELECT id, email, full_name, role, home_branch_id 
FROM profiles 
WHERE email = 'checkwat1@gmail.com';

-- 4. Check if order's waiter_id matches profile ID
SELECT 
    o.order_number,
    o.waiter_id AS order_waiter_id,
    p.id AS profile_id,
    o.waiter_id = p.id AS waiter_match,
    o.branch_id AS order_branch,
    b.name AS branch_name
FROM orders o
LEFT JOIN profiles p ON p.email = 'checkwat1@gmail.com'
LEFT JOIN branches b ON b.id = o.branch_id
WHERE o.closed_at IS NULL
ORDER BY o.created_at DESC
LIMIT 5;
