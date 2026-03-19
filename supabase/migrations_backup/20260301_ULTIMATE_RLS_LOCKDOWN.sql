-- ============================================================
-- Baro OS - ULTIMATE RLS LOCKDOWN (v4)
-- Standardized Tenant Isolation for Core Tables
-- ============================================================

-- 0. Define the tables that MUST be isolated
DO $$ 
DECLARE 
    t_name TEXT;
    policy_name TEXT;
    core_tables TEXT[] := ARRAY[
        'ingredients', 'orders', 'profiles', 'branches', 
        'menu', 'categories', 'recipes', 'recipe_ingredients', 
        'branch_inventory', 'tips_ledger', 'waste_logs', 
        'suppliers', 'purchase_orders', 'order_items', 'order_payments',
        'inventory_transactions', 'restock_requests', 'staff_shifts'
    ];
BEGIN
    FOREACH t_name IN ARRAY core_tables LOOP
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t_name) THEN
            
            -- Enable RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t_name);
            
            -- Drop ALL existing policies (Extreme Cleanup)
            FOR policy_name IN (SELECT polname FROM pg_policy WHERE polrelid = ('public.' || t_name)::regclass) LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, t_name);
            END LOOP;

            -- Detect Columns
            DECLARE
                has_org_id BOOLEAN;
                has_branch_id BOOLEAN;
            BEGIN
                SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t_name AND column_name = 'organization_id') INTO has_org_id;
                SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t_name AND column_name = 'branch_id') INTO has_branch_id;

                IF has_org_id THEN
                    -- Standard direct isolation
                    EXECUTE format('
                        CREATE POLICY "Standard Tenant Isolation %I" ON public.%I
                        FOR ALL USING (organization_id = public.current_org_id())
                        WITH CHECK (organization_id = public.current_org_id())
                    ', t_name, t_name);
                ELSIF has_branch_id THEN
                    -- Indirect isolation via branches table
                    EXECUTE format('
                        CREATE POLICY "Standard Tenant Isolation %I" ON public.%I
                        FOR ALL USING (
                            EXISTS (
                                SELECT 1 FROM public.branches 
                                WHERE id = branch_id 
                                AND organization_id = public.current_org_id()
                            )
                        )
                        WITH CHECK (
                            EXISTS (
                                SELECT 1 FROM public.branches 
                                WHERE id = branch_id 
                                AND organization_id = public.current_org_id()
                            )
                        )
                    ', t_name, t_name);
                ELSE
                    RAISE WARNING 'Table % has neither organization_id nor branch_id. Skipping policy.', t_name;
                END IF;
            END;

            RAISE NOTICE 'Locked down table: %', t_name;
        END IF;
    END LOOP;
END $$;

-- 1. Special case: Profiles (Allow self-selection even if org not yet loaded)
DROP POLICY IF EXISTS "Standard Tenant Isolation profiles" ON public.profiles;
CREATE POLICY "Strict Profile Isolation" ON public.profiles
FOR ALL USING (
    id = auth.uid() OR organization_id = public.current_org_id()
)
WITH CHECK (
    id = auth.uid() OR organization_id = public.current_org_id()
);

-- 2. Special case: Organizations (Allow users to see their own org)
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can see own organization" ON public.organizations;
CREATE POLICY "Users can see own organization" ON public.organizations
FOR SELECT USING (id = public.current_org_id());

-- 3. Cache Busting
NOTIFY pgrst, 'reload schema';

-- 4. Diagnostic Check (Optional but recommended to run after)
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
