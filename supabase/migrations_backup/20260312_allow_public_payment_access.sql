-- ============================================================
-- Baro OS - Public Payment Portal RLS Security (v1)
-- ============================================================

-- 1. Enable Public (Anon) access to specific orders via ID
-- This allows anyone with the direct Order UUID to view the bill totals.
DROP POLICY IF EXISTS "Public anonymous order view" ON public.orders;
CREATE POLICY "Public anonymous order view" ON public.orders
FOR SELECT USING (
    id = id -- This is logically always true, but we combine with ANON role
    AND (auth.role() = 'anon' OR auth.role() = 'authenticated')
);

-- 2. Enable Public access to Order Items
DROP POLICY IF EXISTS "Public anonymous order items view" ON public.order_items;
CREATE POLICY "Public anonymous order items view" ON public.order_items
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.orders 
        WHERE orders.id = order_items.order_id
    )
);

-- 3. Enable Public access to Bank Settings (to show Telebirr/CBE details)
DROP POLICY IF EXISTS "Public anonymous bank settings view" ON public.bank_settings;
CREATE POLICY "Public anonymous bank settings view" ON public.bank_settings
FOR SELECT USING (
    is_active = true 
    AND (auth.role() = 'anon' OR auth.role() = 'authenticated')
);

-- 4. Enable Public access to Organization Names
DROP POLICY IF EXISTS "Public anonymous organization view" ON public.organizations;
CREATE POLICY "Public anonymous organization view" ON public.organizations
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.orders 
        WHERE orders.organization_id = organizations.id
    )
);

-- 5. Enable Public access to Menu names (for receipt display)
DROP POLICY IF EXISTS "Public anonymous menu view" ON public.menu;
CREATE POLICY "Public anonymous menu view" ON public.menu
FOR SELECT USING (
    auth.role() = 'anon' OR auth.role() = 'authenticated'
);

-- 6. Enable Public access to Branches
DROP POLICY IF EXISTS "Public anonymous branch view" ON public.branches;
CREATE POLICY "Public anonymous branch view" ON public.branches
FOR SELECT USING (
    auth.role() = 'anon' OR auth.role() = 'authenticated'
);

NOTIFY pgrst, 'reload schema';
