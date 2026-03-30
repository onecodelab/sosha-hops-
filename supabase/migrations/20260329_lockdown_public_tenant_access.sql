-- ============================================================
-- Baro OS - Lock Down Public Tenant Data Access
-- Purpose: remove overbroad anon visibility and force public
-- access through guarded edge functions / signed branch tokens.
-- ============================================================

CREATE OR REPLACE FUNCTION public.current_org_id_strict()
RETURNS UUID AS $$
DECLARE
    v_org_id TEXT;
BEGIN
    v_org_id := current_setting('request.jwt.claim.organization_id', true);
    IF v_org_id IS NULL OR v_org_id = '' THEN
        RETURN NULL;
    END IF;
    RETURN v_org_id::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Remove public/anon visibility that exposed cross-tenant data.
DROP POLICY IF EXISTS "Public anonymous order view" ON public.orders;
DROP POLICY IF EXISTS "Public anonymous order items view" ON public.order_items;
DROP POLICY IF EXISTS "Public anonymous bank settings view" ON public.bank_settings;
DROP POLICY IF EXISTS "Public anonymous organization view" ON public.organizations;
DROP POLICY IF EXISTS "Public anonymous menu view" ON public.menu;
DROP POLICY IF EXISTS "Public anonymous branch view" ON public.branches;

-- Re-assert strict authenticated reads.
DROP POLICY IF EXISTS "Strict isolated order view" ON public.orders;
CREATE POLICY "Strict isolated order view" ON public.orders
FOR SELECT TO authenticated
USING (organization_id = public.current_org_id_strict());

DROP POLICY IF EXISTS "Strict isolated order items view" ON public.order_items;
CREATE POLICY "Strict isolated order items view" ON public.order_items
FOR SELECT TO authenticated
USING (organization_id = public.current_org_id_strict());

DROP POLICY IF EXISTS "Strict isolated bank settings view" ON public.bank_settings;
CREATE POLICY "Strict isolated bank settings view" ON public.bank_settings
FOR SELECT TO authenticated
USING (organization_id = public.current_org_id_strict());

DROP POLICY IF EXISTS "Strict isolated organization view" ON public.organizations;
CREATE POLICY "Strict isolated organization view" ON public.organizations
FOR SELECT TO authenticated
USING (id = public.current_org_id_strict());

DROP POLICY IF EXISTS "Strict isolated menu view" ON public.menu;
CREATE POLICY "Strict isolated menu view" ON public.menu
FOR SELECT TO authenticated
USING (organization_id = public.current_org_id_strict());

DROP POLICY IF EXISTS "Strict isolated branch view" ON public.branches;
CREATE POLICY "Strict isolated branch view" ON public.branches
FOR SELECT TO authenticated
USING (organization_id = public.current_org_id_strict());

NOTIFY pgrst, 'reload schema';
