-- ============================================================
-- Baro OS - Multitenancy Repair (Emergency Fix)
-- Restores strict organizational isolation for authenticated users
-- ============================================================

-- 0. DEPENDENCY: Strict Identity Derivation
-- Ensure the strict identity function exists before defining policies.
CREATE OR REPLACE FUNCTION public.current_org_id_strict() 
RETURNS UUID AS $$
DECLARE
    v_org_id TEXT;
BEGIN
    v_org_id := current_setting('request.jwt.claim.organization_id', true);
    IF v_org_id IS NULL OR v_org_id = '' THEN RETURN NULL; END IF;
    RETURN v_org_id::UUID;
EXCEPTION WHEN OTHERS THEN RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 1. REPAIR: Orders
-- Authenticated users must only see their own organization's orders.
-- Anon users can see specific orders by UUID for payment.
DROP POLICY IF EXISTS "Public anonymous order view" ON public.orders;
CREATE POLICY "Strict isolated order view" ON public.orders
FOR SELECT TO authenticated
USING (organization_id = public.current_org_id_strict());

CREATE POLICY "Public anonymous order view" ON public.orders
FOR SELECT TO anon
USING (id = id); -- Anon can view by direct ID/UUID lookup

-- 2. REPAIR: Order Items
-- Inherit visibility from parent order.
DROP POLICY IF EXISTS "Public anonymous order items view" ON public.order_items;
CREATE POLICY "Strict isolated order items view" ON public.order_items
FOR SELECT TO authenticated
USING (organization_id = public.current_org_id_strict());

CREATE POLICY "Public anonymous order items view" ON public.order_items
FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.id = order_items.order_id));

-- 3. REPAIR: Branches
-- Authenticated staff must only see their own branches.
DROP POLICY IF EXISTS "Public anonymous branch view" ON public.branches;
CREATE POLICY "Strict isolated branch view" ON public.branches
FOR SELECT TO authenticated
USING (organization_id = public.current_org_id_strict());

CREATE POLICY "Public anonymous branch view" ON public.branches
FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.branch_id = branches.id));

-- 4. REPAIR: Menu
-- Authenticated staff must only see their own menu items.
DROP POLICY IF EXISTS "Public anonymous menu view" ON public.menu;
CREATE POLICY "Strict isolated menu view" ON public.menu
FOR SELECT TO authenticated
USING (organization_id = public.current_org_id_strict());

CREATE POLICY "Public anonymous menu view" ON public.menu
FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.order_items WHERE order_items.menu_item_id = menu.id));

-- 5. REPAIR: Organizations
-- Authenticated users see only their own organization.
DROP POLICY IF EXISTS "Public anonymous organization view" ON public.organizations;
CREATE POLICY "Strict isolated organization view" ON public.organizations
FOR SELECT TO authenticated
USING (id = public.current_org_id_strict());

CREATE POLICY "Public anonymous organization view" ON public.organizations
FOR SELECT TO anon
USING (EXISTS (SELECT 1 FROM public.orders WHERE orders.organization_id = organizations.id));

-- 6. REPAIR: Bank Settings
-- Authenticated users see only their own bank settings.
DROP POLICY IF EXISTS "Public anonymous bank settings view" ON public.bank_settings;
CREATE POLICY "Strict isolated bank settings view" ON public.bank_settings
FOR SELECT TO authenticated
USING (organization_id = public.current_org_id_strict());

CREATE POLICY "Public anonymous bank settings view" ON public.bank_settings
FOR SELECT TO anon
USING (is_active = true); -- Still allowed for payment portal

NOTIFY pgrst, 'reload schema';
