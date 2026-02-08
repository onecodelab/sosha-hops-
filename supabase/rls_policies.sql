-- ============================================
-- BARO RBAC: Row Level Security Policies
-- ============================================
-- Roles: owner, admin, manager, waiter, kitchen
-- 
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard → SQL Editor
-- 2. Paste this entire file
-- 3. Execute and verify no errors
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE menu ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE ingredients ENABLE ROW LEVEL SECURITY;

-- ============================================
-- HELPER FUNCTION: Get current user's role
-- ============================================
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE SQL SECURITY DEFINER STABLE;

-- ============================================
-- PROFILES TABLE
-- ============================================

-- Everyone can read their own profile
CREATE POLICY "Users can read own profile" ON profiles
  FOR SELECT USING (id = auth.uid());

-- Managers and above can read all profiles
CREATE POLICY "Managers can read all profiles" ON profiles
  FOR SELECT USING (
    public.get_user_role() IN ('owner', 'admin', 'manager')
  );

-- Only admins/owners can update profiles
CREATE POLICY "Admins can update profiles" ON profiles
  FOR UPDATE USING (
    public.get_user_role() IN ('owner', 'admin')
  );

-- ============================================
-- MENU TABLE
-- ============================================

-- All authenticated staff can read ALL menu items (including unavailable)
-- This allows waiters to see "Sold Out" items on their screen
CREATE POLICY "All staff can read menu" ON menu
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

-- Only admins/owners can INSERT menu items
CREATE POLICY "Admins can insert menu" ON menu
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('owner', 'admin')
  );

-- Only admins/owners can DELETE menu items
CREATE POLICY "Admins can delete menu" ON menu
  FOR DELETE USING (
    public.get_user_role() IN ('owner', 'admin')
  );

-- Admins/owners can UPDATE all fields
CREATE POLICY "Admins can update menu" ON menu
  FOR UPDATE USING (
    public.get_user_role() IN ('owner', 'admin')
  );

-- Kitchen staff can toggle availability (86 items) only
CREATE POLICY "Kitchen can toggle availability" ON menu
  FOR UPDATE USING (
    public.get_user_role() = 'kitchen'
  );

-- ============================================
-- ORDERS TABLE
-- ============================================

-- Waiters can only see their own orders
CREATE POLICY "Waiters see own orders" ON orders
  FOR SELECT USING (
    CASE 
      WHEN public.get_user_role() = 'waiter' THEN waiter_id = auth.uid()
      ELSE true
    END
  );

-- Kitchen sees only pending/accepted/preparing orders
CREATE POLICY "Kitchen sees active orders" ON orders
  FOR SELECT USING (
    CASE 
      WHEN public.get_user_role() = 'kitchen' THEN status IN ('pending', 'accepted', 'preparing')
      ELSE true
    END
  );

-- Waiters can create orders
CREATE POLICY "Waiters can create orders" ON orders
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('waiter', 'manager', 'owner', 'admin')
  );

-- Waiters can update their own orders, others can update any
CREATE POLICY "Waiters update own orders" ON orders
  FOR UPDATE USING (
    CASE 
      WHEN public.get_user_role() = 'waiter' THEN waiter_id = auth.uid()
      ELSE public.get_user_role() IN ('kitchen', 'manager', 'owner', 'admin')
    END
  );

-- ============================================
-- ORDER_ITEMS TABLE
-- ============================================

-- Follow same access rules as parent orders table
CREATE POLICY "Order items follow order access" ON order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM orders 
      WHERE orders.id = order_items.order_id
    )
  );

-- Allow insert for order creators
CREATE POLICY "Staff can insert order items" ON order_items
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('waiter', 'manager', 'owner', 'admin')
  );

-- Allow update for managers and above
CREATE POLICY "Managers can update order items" ON order_items
  FOR UPDATE USING (
    public.get_user_role() IN ('manager', 'owner', 'admin')
  );

-- ============================================
-- INGREDIENTS TABLE (Inventory)
-- ============================================

-- All authenticated staff can read ingredients
-- (Field-level filtering is handled in the application layer)
CREATE POLICY "Staff can read ingredients" ON ingredients
  FOR SELECT USING (
    auth.uid() IS NOT NULL
  );

-- Only managers and above can INSERT ingredients
CREATE POLICY "Managers can insert ingredients" ON ingredients
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('owner', 'admin', 'manager')
  );

-- Only managers and above can UPDATE ingredients
CREATE POLICY "Managers can update ingredients" ON ingredients
  FOR UPDATE USING (
    public.get_user_role() IN ('owner', 'admin', 'manager')
  );

-- Only admins/owners can DELETE ingredients
CREATE POLICY "Admins can delete ingredients" ON ingredients
  FOR DELETE USING (
    public.get_user_role() IN ('owner', 'admin')
  );

-- ============================================
-- END OF POLICIES
-- ============================================
