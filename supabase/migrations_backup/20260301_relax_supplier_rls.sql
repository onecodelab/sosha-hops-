-- RELAX SUPPLIER RLS FOR GLOBAL VISIBILITY
-- Allows all authenticated users (restaurant owners/managers) to view suppliers owned by the platform

-- 1. Add Policy for Platform Suppliers
DROP POLICY IF EXISTS "Anyone can view platform suppliers" ON public.suppliers;
CREATE POLICY "Anyone can view platform suppliers" ON public.suppliers
FOR SELECT USING (
    organization_id = '00000000-0000-0000-0000-000000000000'
);

-- 2. Ensure current tenant isolation still works for private suppliers
-- (This is already covered by the "Tenant Isolation Select suppliers" policy)

-- 3. Reload schema to reflect changes
NOTIFY pgrst, 'reload schema';
