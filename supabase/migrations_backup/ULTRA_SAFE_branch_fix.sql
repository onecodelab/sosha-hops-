-- Baro OS - ULTRA-SAFE Branch Recovery
-- This script checks if tables exist before trying to update them.

DO $$
BEGIN
    -- 1. CREATE BRANCHES TABLE (IDEMPOTENT)
    CREATE TABLE IF NOT EXISTS public.branches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        location TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );

    -- 2. INSERT MAIN BRANCH
    IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = '00000000-0000-0000-0000-000000000000') THEN
        INSERT INTO public.branches (id, name, location)
        VALUES ('00000000-0000-0000-0000-000000000000', 'Main Branch', 'HQ');
    END IF;

    -- 3. PROFILES: Add home_branch_id
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'home_branch_id') THEN
            ALTER TABLE public.profiles ADD COLUMN home_branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';
        END IF;
        
        -- Backfill users
        UPDATE public.profiles SET home_branch_id = '00000000-0000-0000-0000-000000000000' WHERE home_branch_id IS NULL;
    END IF;

    -- 4. ORDERS: Add branch_id
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'orders') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'branch_id') THEN
            ALTER TABLE public.orders ADD COLUMN branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';
        END IF;
    END IF;

    -- 5. PURCHASE_ORDERS: Add branch_id
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'purchase_orders') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'branch_id') THEN
            ALTER TABLE public.purchase_orders ADD COLUMN branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';
        END IF;
    END IF;

    -- 6. INVENTORY_TRANSACTIONS: Add branch_id (SAFE CHECK)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'inventory_transactions') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_transactions' AND column_name = 'branch_id') THEN
            ALTER TABLE public.inventory_transactions ADD COLUMN branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';
        END IF;
    END IF;

    -- 7. WASTE_LOGS: Add branch_id (SAFE CHECK)
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'waste_logs') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'waste_logs' AND column_name = 'branch_id') THEN
            ALTER TABLE public.waste_logs ADD COLUMN branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';
        END IF;
    END IF;

    -- 8. CREATE BRANCH INVENTORY (IDEMPOTENT)
    CREATE TABLE IF NOT EXISTS public.branch_inventory (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
        ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE CASCADE,
        current_stock NUMERIC DEFAULT 0,
        par_min NUMERIC DEFAULT 0,
        par_max NUMERIC DEFAULT 100,
        last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
        UNIQUE(branch_id, ingredient_id)
    );

END $$;
