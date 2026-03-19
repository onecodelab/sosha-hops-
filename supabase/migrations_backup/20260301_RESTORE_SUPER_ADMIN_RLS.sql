-- ============================================================
-- Baro OS - RESTORE SUPER ADMIN RLS ACCESS
-- restores global visibility for users with 'super_admin' role
-- ============================================================

-- 1. Helper function to check for super_admin role (Cached for performance)
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN AS $$
BEGIN
    -- Check for super_admin role in profiles table
    -- Security Definers bypasses RLS to check the role
    RETURN EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'super_admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 2. Update Profiles Policy (The most important one for the directory)
DROP POLICY IF EXISTS "Strict Profile Isolation" ON public.profiles;
CREATE POLICY "Strict Profile Isolation" ON public.profiles
FOR ALL USING (
    id = auth.uid() 
    OR organization_id = public.current_org_id()
    OR public.is_super_admin()
)
WITH CHECK (
    id = auth.uid() 
    OR organization_id = public.current_org_id()
    OR public.is_super_admin()
);

-- 3. Update all other core tables to respect super_admin bypass
DO $$ 
DECLARE 
    t_name TEXT;
    policy_name TEXT;
    core_tables TEXT[] := ARRAY[
        'ingredients', 'orders', 'branches', 
        'menu', 'categories', 'recipes', 'recipe_ingredients', 
        'branch_inventory', 'tips_ledger', 'waste_logs', 
        'suppliers', 'purchase_orders', 'order_items', 'order_payments',
        'inventory_transactions', 'restock_requests', 'staff_shifts'
    ];
BEGIN
    FOREACH t_name IN ARRAY core_tables LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t_name) THEN
            
            -- Find the "Standard Tenant Isolation" policy name for this table
            -- We assume it matches the pattern from the lockdown script
            policy_name := 'Standard Tenant Isolation ' || t_name;
            
            -- Recreate the policy with the Super Admin bypass
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, t_name);
            
            -- Detect if it used organization_id or branch_id approach
            DECLARE
                has_org_id BOOLEAN;
            BEGIN
                SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t_name AND column_name = 'organization_id') INTO has_org_id;

                IF has_org_id THEN
                    EXECUTE format('
                        CREATE POLICY %I ON public.%I
                        FOR ALL USING (organization_id = public.current_org_id() OR public.is_super_admin())
                        WITH CHECK (organization_id = public.current_org_id() OR public.is_super_admin())
                    ', policy_name, t_name);
                ELSE
                    -- Branch based isolation
                    EXECUTE format('
                        CREATE POLICY %I ON public.%I
                        FOR ALL USING (
                            EXISTS (
                                SELECT 1 FROM public.branches 
                                WHERE id = branch_id 
                                AND organization_id = public.current_org_id()
                            ) OR public.is_super_admin()
                        )
                        WITH CHECK (
                            EXISTS (
                                SELECT 1 FROM public.branches 
                                WHERE id = branch_id 
                                AND organization_id = public.current_org_id()
                            ) OR public.is_super_admin()
                        )
                    ', policy_name, t_name);
                END IF;
            END;
        END IF;
    END LOOP;
END $$;

-- 4. Restore Organization access
DROP POLICY IF EXISTS "Users can see own organization" ON public.organizations;
CREATE POLICY "Users can see own organization" ON public.organizations
FOR SELECT USING (id = public.current_org_id() OR public.is_super_admin());

-- 5. Cache Busting
NOTIFY pgrst, 'reload schema';
