-- ============================================================
-- Baro Restaurant OS — RLS & Tenant Isolation Fix (v3)
-- Robust version with Column Detection
-- ============================================================

-- 1. PRE-FIX STATUS CHECK
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;

-- 2. ENABLE RLS & APPLY POLICIES
DO $$ 
DECLARE 
    t_name TEXT;
    unprotected_tables TEXT[] := ARRAY[
        'ingredients', 'menu', 'categories', 'orders', 'staff_shifts', 
        'tips_ledger', 'waste_logs', 'suppliers', 'purchase_orders', 
        'recipes', 'recipe_ingredients', 'inventory_transactions',
        'branch_inventory'
    ];
    has_org_id BOOLEAN;
    has_branch_id BOOLEAN;
BEGIN
    FOREACH t_name IN ARRAY unprotected_tables LOOP
        -- Check if table exists
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t_name) THEN
            
            -- Check for columns
            SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t_name AND column_name = 'organization_id') INTO has_org_id;
            SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t_name AND column_name = 'branch_id') INTO has_branch_id;

            -- Enable RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t_name);
            
            -- Drop old policies
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation %I" ON public.%I', t_name, t_name);
            EXECUTE format('DROP POLICY IF EXISTS "Allow all read to %I" ON public.%I', t_name, t_name);
            EXECUTE format('DROP POLICY IF EXISTS "Branch isolation for inventory" ON public.%I', t_name, t_name);

            -- Apply Policy based on available columns
            IF has_org_id THEN
                -- Standard direct isolation
                EXECUTE format('
                    CREATE POLICY "Tenant Isolation %I" ON public.%I
                    FOR ALL USING (organization_id = public.current_org_id())
                ', t_name, t_name);
                RAISE NOTICE 'Applied direct org isolation to %', t_name;
            ELSIF has_branch_id THEN
                -- Indirect isolation via branches table
                EXECUTE format('
                    CREATE POLICY "Tenant Isolation %I" ON public.%I
                    FOR ALL USING (
                        EXISTS (
                            SELECT 1 FROM public.branches 
                            WHERE id = branch_id 
                            AND organization_id = public.current_org_id()
                        )
                    )
                ', t_name, t_name);
                RAISE NOTICE 'Applied branch-join isolation to %', t_name;
            ELSE
                RAISE WARNING 'Table % has neither organization_id nor branch_id. Skipping RLS policy.', t_name;
            END IF;

        ELSE
            RAISE NOTICE 'Table % does not exist, skipping.', t_name;
        END IF;
    END LOOP;
END $$;

-- 3. RELOAD SCHEMA
NOTIFY pgrst, 'reload schema';

-- 4. POST-FIX STATUS CHECK
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
