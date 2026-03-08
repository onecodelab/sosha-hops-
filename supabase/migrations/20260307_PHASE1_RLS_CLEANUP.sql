-- PHASE 1: Security Hardening - RLS Policy Normalization
-- Goal: Remove all permissive "USING (true)" policies and enforce strict organizational boundaries.

DO $$ 
DECLARE
    t text;
    tables text[] := ARRAY[
        'organizations',
        'branches', 
        'profiles', 
        'orders', 
        'order_items', 
        'menu', 
        'categories', 
        'ingredients', 
        'suppliers', 
        'tables', 
        'waste_log', 
        'staff_shifts', 
        'staff_actions', 
        'tips_ledger', 
        'purchase_orders', 
        'order_payments',
        'inventory_transactions',
        'restock_requests',
        'recipe_ingredients',
        'recipes',
        'bot_settings',
        'bot_memory',
        'customer_history'
    ];
    policy_rec RECORD;
BEGIN
    FOR t IN SELECT unnest(tables) LOOP
        -- Check if table exists
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            
            -- 1. DROP ALL EXISTING POLICIES for this table to ensure a clean slate
            FOR policy_rec IN 
                SELECT policyname 
                FROM pg_policies 
                WHERE schemaname = 'public' AND tablename = t
            LOOP
                EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_rec.policyname, t);
            END LOOP;

            -- 2. ENABLE RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

            -- 3. APPLY STRICT ORGANIZATIONAL ISOLATION (Authenticated Users)
            -- For standard tables, organization_id must match the JWT claim
            IF t != 'organizations' AND t != 'profiles' THEN
                EXECUTE format('
                    CREATE POLICY "Tenant Isolation %I" ON public.%I 
                    FOR ALL 
                    TO authenticated
                    USING (organization_id = public.current_org_id_strict())
                    WITH CHECK (organization_id = public.current_org_id_strict())
                ', t, t);
            END IF;

            -- 4. SPECIAL CASE: Organizations
            IF t = 'organizations' THEN
                EXECUTE format('
                    CREATE POLICY "Tenant Isolation Organizations" ON public.organizations 
                    FOR SELECT 
                    TO authenticated
                    USING (id = public.current_org_id_strict())
                ');
            END IF;

            -- 5. SPECIAL CASE: Profiles
            IF t = 'profiles' THEN
                EXECUTE format('
                    CREATE POLICY "Tenant Isolation Profiles" ON public.profiles 
                    FOR ALL 
                    TO authenticated
                    USING (id = auth.uid() OR organization_id = public.current_org_id_strict())
                    WITH CHECK (id = auth.uid() OR organization_id = public.current_org_id_strict())
                ');
            END IF;

            -- 6. ANON ACCESS (STRICTLY MINIMAL)
            -- Only allow anon SELECT on menu and branches if the organization_id matches
            -- Note: This still requires the client to somehow pass the claim, 
            -- or we use a different mechanism. For now, we enforce the check.
            IF t IN ('menu', 'branches', 'categories') THEN
                EXECUTE format('
                    CREATE POLICY "Anon Tenant Isolation %I" ON public.%I 
                    FOR SELECT 
                    TO anon
                    USING (organization_id = public.current_org_id_strict())
                ', t, t);
            END IF;

        END IF;
    END LOOP;
END $$;

-- 7. SERVICE ROLE BYPASS (Implicit)
-- Service role always bypasses RLS, but we should be aware of it.
-- We do not add explicit "service_role" policies unless we want to RESTRICT it,
-- but standard practice in Supabase is that service_role bypasses RLS entirely.

NOTIFY pgrst, 'reload schema';
