-- FIX: RLS Policies for Orders visibility
-- Ensure staff can see orders in their branch

-- 1. Drop existing restrictive policies
DROP POLICY IF EXISTS "Orders are visible to their creators" ON orders;
DROP POLICY IF EXISTS "Orders are visible to kitchen staff" ON orders;
DROP POLICY IF EXISTS "Staff view orders in their branch" ON orders;

-- 2. Create simplified, permissive policies for Staff
-- VIEW: Allow staff to view ALL orders in their assigned branch
CREATE POLICY "Staff view orders in their branch"
ON orders FOR SELECT
TO authenticated
USING (
  branch_id IN (
    SELECT home_branch_id FROM profiles 
    WHERE id = auth.uid()
  )
  OR
  -- Allow viewing orders created by self (failsafe)
  waiter_id = auth.uid()
);

-- INSERT: Allow staff to create orders
CREATE POLICY "Staff create orders"
ON orders FOR INSERT
TO authenticated
WITH CHECK (true);

-- UPDATE: Allow staff to update orders (status changes, payments)
CREATE POLICY "Staff update orders"
ON orders FOR UPDATE
TO authenticated
USING (true);

NOTIFY pgrst, 'reload schema';
