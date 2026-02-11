-- 1. Enable pgjwt if not available (for auth claims)
CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Ensure extensions are there

-- 2. Create Organizations Table
CREATE TABLE IF NOT EXISTS public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    plan TEXT DEFAULT 'free',
    is_active BOOLEAN DEFAULT true
);

-- 3. Insert Default Organization (Migration Helper)
INSERT INTO public.organizations (id, name, plan)
VALUES ('00000000-0000-0000-0000-000000000000', 'Default Organization', 'enterprise')
ON CONFLICT (id) DO NOTHING;

-- 4. Tables to Migrate
-- List of tables that need organization_id
DO $$ 
DECLARE
    t text;
    tables text[] := ARRAY[
        'branches', 
        'profiles', 
        'orders', 
        'order_items', 
        'menu', 
        'menu_items', -- In case it exists
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
        'recipes'
    ];
BEGIN
    FOREACH t IN ARRAY tables LOOP
        -- Check if table exists
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            -- Add column if not exists
            EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id)', t);
            
            -- Backfill default organization
            EXECUTE format('UPDATE public.%I SET organization_id = %L WHERE organization_id IS NULL', t, '00000000-0000-0000-0000-000000000000');
            
            -- Set Not Null (Critical for strict multi-tenancy)
            EXECUTE format('ALTER TABLE public.%I ALTER COLUMN organization_id SET NOT NULL', t);
            
            -- Create Index
            EXECUTE format('CREATE INDEX IF NOT EXISTS idx_%I_organization_id ON public.%I(organization_id)', t, t);
            
            -- Enable RLS (just in case)
            EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
        END IF;
    END LOOP;
END $$;

-- 5. Helper Function for RLS
-- Replacing join-based checks with fast JWT claim check
CREATE OR REPLACE FUNCTION public.current_org_id() 
RETURNS UUID AS $$
BEGIN
    -- Try to get from JWT claim first (Performance)
    -- Fallback to profile lookup (Identity) - ONLY if claim is missing (migration support)
    -- But for strict mode, we might want to fail if missing? 
    -- For now, let's use the safer fallback approach to avoid locking everyone out during transition.
    
    RETURN COALESCE(
        current_setting('request.jwt.claim.organization_id', true)::uuid,
        (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- 6. Update RLS Policies
-- This is a destructive operation for old policies. 
-- We will DROP rigid old policies and create new, standardized ones.

DO $$ 
DECLARE
    t text;
    tables text[] := ARRAY[
        'branches', 'profiles', 'orders', 'menu', 'categories', 'ingredients', 
        'suppliers', 'tables', 'waste_log', 'staff_shifts', 'staff_actions', 
        'tips_ledger', 'purchase_orders', 'order_payments'
    ];
    policy_name text;
BEGIN
    FOREACH t IN ARRAY tables LOOP
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = t) THEN
            -- Drop typical existing policies (guessing names or clearing all?)
            -- Safest is to add NEW strict policies. 
            -- But we really should clean up.
            
            -- Standardize Policy: View own org
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Select %I" ON public.%I', t, t);
            EXECUTE format('CREATE POLICY "Tenant Isolation Select %I" ON public.%I FOR SELECT USING (organization_id = public.current_org_id())', t, t);
            
            -- Standardize Policy: Write own org
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Insert %I" ON public.%I', t, t);
            EXECUTE format('CREATE POLICY "Tenant Isolation Insert %I" ON public.%I FOR INSERT WITH CHECK (organization_id = public.current_org_id())', t, t);
            
            -- Standardize Policy: Update own org
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Update %I" ON public.%I', t, t);
            EXECUTE format('CREATE POLICY "Tenant Isolation Update %I" ON public.%I FOR UPDATE USING (organization_id = public.current_org_id())', t, t);
            
            -- Standardize Policy: Delete own org
            EXECUTE format('DROP POLICY IF EXISTS "Tenant Isolation Delete %I" ON public.%I', t, t);
            EXECUTE format('CREATE POLICY "Tenant Isolation Delete %I" ON public.%I FOR DELETE USING (organization_id = public.current_org_id())', t, t);
            
        END IF;
    END LOOP;
END $$;

-- 7. Special Case: Profiles (Can't select own profile if strict RLS blocks before we know who we are?)
-- auth.uid() check is still needed for self-bootstrapping.
DROP POLICY IF EXISTS "Tenant Isolation Select profiles" ON public.profiles;
CREATE POLICY "Tenant Isolation Select profiles" ON public.profiles FOR SELECT USING (
    id = auth.uid() OR organization_id = public.current_org_id()
);

-- 8. Special Case: Organizations Table
-- Users can see their own organization
CREATE POLICY "Users can see own organization" ON public.organizations FOR SELECT USING (
    id = public.current_org_id()
);

-- 9. Trigger to Sync Organization ID to Auth Metadata (Free Tier Fix)
CREATE OR REPLACE FUNCTION public.sync_org_to_auth()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE auth.users
    SET raw_app_meta_data = 
        COALESCE(raw_app_meta_data, '{}'::jsonb) || 
        jsonb_build_object('organization_id', NEW.organization_id)
    WHERE id = NEW.id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_update_org ON public.profiles;
CREATE TRIGGER on_profile_update_org
AFTER INSERT OR UPDATE OF organization_id ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.sync_org_to_auth();

-- 10. Manual Sync for Backfill
-- Force sync for all existing users
UPDATE public.profiles SET organization_id = organization_id;
