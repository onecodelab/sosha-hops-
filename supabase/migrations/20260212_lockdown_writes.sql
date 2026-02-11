-- Lockdown Migration: Enforce BFF by removing direct write permissions for authenticated users
-- Critical Tables: orders, order_items, branch_inventory, menu

-- 1. ORDERS (Insert only locked, Updates needed for Payments/Status)
DROP POLICY IF EXISTS "Tenant Isolation Insert orders" ON public.orders;
-- 1b. Ensure Service Role still has access (BYPASS RLS is default for Service Role, so no policy needed usually, but good to check)

-- 2. ORDER_ITEMS (Insert only locked)
DROP POLICY IF EXISTS "Tenant Isolation Insert order_items" ON public.order_items;

-- 3. BRANCH_INVENTORY (Insert/Update locked)
DROP POLICY IF EXISTS "Tenant Isolation Insert branch_inventory" ON public.branch_inventory;
DROP POLICY IF EXISTS "Tenant Isolation Update branch_inventory" ON public.branch_inventory;

-- 4. MENU (All Writes Locked)
DROP POLICY IF EXISTS "Tenant Isolation Insert menu" ON public.menu;
DROP POLICY IF EXISTS "Tenant Isolation Update menu" ON public.menu;
DROP POLICY IF EXISTS "Tenant Isolation Delete menu" ON public.menu;

-- Note: We do NOT lock 'inventory_transactions' yet as Purchase Order feature uses it directly.
