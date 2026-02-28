-- BARO ADMIN ROLES & PROVISIONING DEPLOYMENT
-- 1. Extend the profiles table to support Supplier links
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id);

-- 2. Update RLS for super_admin access
-- super_admin should be able to see and manage everything across all organizations

-- Organizations: super_admin can see all
DROP POLICY IF EXISTS "super_admin_all_orgs" ON public.organizations;
CREATE POLICY "super_admin_all_orgs" ON public.organizations
FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
);

-- Profiles: super_admin can see all
DROP POLICY IF EXISTS "super_admin_all_profiles" ON public.profiles;
CREATE POLICY "super_admin_all_profiles" ON public.profiles
FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
);

-- Purchase Orders: Suppliers can only see their own
DROP POLICY IF EXISTS "Suppliers view own POs" ON public.purchase_orders;
CREATE POLICY "Suppliers view own POs" ON public.purchase_orders
FOR SELECT USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'supplier'
    AND supplier_id = (SELECT supplier_id FROM public.profiles WHERE id = auth.uid())
);

-- Purchase Orders: super_admin can see all
DROP POLICY IF EXISTS "super_admin_all_pos" ON public.purchase_orders;
CREATE POLICY "super_admin_all_pos" ON public.purchase_orders
FOR ALL USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'super_admin'
);

-- Update existing profiles constraint if it exists
-- Note: role is typically a text field in this schema based on previous migrations
-- but if there was a constraint, we'd update it. Based on research, it's text.

-- 3. Provisioning Organization
-- Create the Baro Platform Organization if it doesn't exist
INSERT INTO public.organizations (id, name, plan)
VALUES ('00000000-0000-0000-0000-000000000000', 'Baro Platform', 'enterprise')
ON CONFLICT (id) DO UPDATE SET name = 'Baro Platform';

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
