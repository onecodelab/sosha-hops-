-- ============================================================
-- Baro Restaurant OS — RLS & Tenant Isolation Fix (v2)
-- Run this in Supabase SQL Editor to secure all tables
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
        'recipes', 'recipe_ingredients', 'inventory_transactions'
    ];
BEGIN
    FOREACH t_name IN ARRAY unprotected_tables LOOP
        -- Check if table exists before proceeding to avoid errors
        IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t_name) THEN
            -- Enable RLS
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t_name);
            
            -- Drop old policies if they exist
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation %I" ON public.%I', t_name, t_name);
            EXECUTE format('DROP POLICY IF EXISTS "Allow all read to %I" ON public.%I', t_name, t_name);
            
            -- Apply Strict Tenant Isolation (standard)
            -- Special logic for branch_inventory and purchase_orders is handled outside this loop or explicitly
            IF t_name NOT IN ('purchase_orders', 'branch_inventory') THEN
                EXECUTE format('
                    CREATE POLICY "Tenant Isolation %I" ON public.%I
                    FOR ALL USING (organization_id = public.current_org_id())
                ', t_name, t_name);
            END IF;
        ELSE
            RAISE NOTICE 'Table % does not exist, skipping.', t_name;
        END IF;
    END LOOP;
END $$;

-- 3. SPECIAL CASE: purchase_orders
-- Keep supplier policy + add org isolation
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation purchase_orders" ON public.purchase_orders;
CREATE POLICY "Tenant Isolation purchase_orders" ON public.purchase_orders
    FOR ALL USING (organization_id = public.current_org_id());

-- 4. SPECIAL CASE: branch_inventory
-- Filter via branch -> organization join
ALTER TABLE public.branch_inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Tenant Isolation branch_inventory" ON public.branch_inventory;
DROP POLICY IF EXISTS "Branch isolation for inventory" ON public.branch_inventory;
CREATE POLICY "Tenant Isolation branch_inventory" ON public.branch_inventory
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.branches 
            WHERE id = branch_id 
            AND organization_id = public.current_org_id()
        )
    );

-- 5. RELOAD SCHEMA
NOTIFY pgrst, 'reload schema';

-- 6. POST-FIX STATUS CHECK
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
ORDER BY tablename;
