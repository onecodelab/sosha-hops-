-- FIX: Correct Branch Mismatches for Waiter and Orders
-- 1. Ensure Waiter is joined to Ambassador Mall
UPDATE public.profiles
SET home_branch_id = (SELECT id FROM branches WHERE name ILIKE '%ambassador%')
WHERE email = 'checkwat1@gmail.com';

-- 2. Move the mis-assigned order to Ambassador Mall
-- (Since the waiter created it while seemingly in "Main Branch" context previously)
UPDATE public.orders
SET branch_id = (SELECT id FROM branches WHERE name ILIKE '%ambassador%')
WHERE waiter_id = (SELECT id FROM profiles WHERE email = 'checkwat1@gmail.com')
AND branch_id = '00000000-0000-0000-0000-000000000000';

NOTIFY pgrst, 'reload schema';
