-- FIX: Ensure Correct Roles for Testing Accounts
-- This guarantees the accounts have the roles you expect, so RLS works correctly.

-- 1. Set bocheratube@gmail.com to OWNER
UPDATE public.profiles
SET role = 'owner'
WHERE email = 'bocheratube@gmail.com';

-- 2. Set checkman1@gmail.com to MANAGER
UPDATE public.profiles
SET role = 'manager'
WHERE email = 'checkman1@gmail.com';

-- 3. Verify the changes
SELECT email, role, home_branch_id FROM public.profiles 
WHERE email IN ('bocheratube@gmail.com', 'checkman1@gmail.com');

NOTIFY pgrst, 'reload schema';
