-- DIAGNOSTIC PHASE 2: Deep Dive into Missing Order
-- Run this and share the output

-- 1. Check if the table "T1" (or similar) is occupied
SELECT * FROM tables WHERE status = 'occupied';

-- 2. If occupied, check associated order
SELECT 
    o.id, 
    o.order_number, 
    o.status, 
    o.branch_id, 
    o.waiter_id, 
    p.email as waiter_email,
    b.name as branch_name
FROM orders o
LEFT JOIN profiles p ON p.id = o.waiter_id
LEFT JOIN branches b ON b.id = o.branch_id
WHERE o.status NOT IN ('closed', 'cancelled');
