-- Comprehensive Multi-Branch Recovery Script
-- Run this ENTIRE script in the Supabase SQL Editor

BEGIN;

-- 1. Create the Branches table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Ensure Main Branch exists
INSERT INTO public.branches (id, name, location)
VALUES ('00000000-0000-0000-0000-000000000000', 'Main Branch', 'HQ')
ON CONFLICT (id) DO NOTHING;

-- 3. Add home_branch_id column to profiles if missing
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'home_branch_id') THEN
        ALTER TABLE public.profiles ADD COLUMN home_branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';
    END IF;
END $$;

-- 4. Backfill specific legacy users to link them to the Main Branch
UPDATE public.profiles
SET home_branch_id = '00000000-0000-0000-0000-000000000000'
WHERE home_branch_id IS NULL;

-- 5. Add branch_id to operational tables (Safe checks)
DO $$
BEGIN
    -- Orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orders' AND column_name = 'branch_id') THEN
        ALTER TABLE public.orders ADD COLUMN branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';
    END IF;
    
    -- Purchase Orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'purchase_orders' AND column_name = 'branch_id') THEN
        ALTER TABLE public.purchase_orders ADD COLUMN branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';
    END IF;

    -- Inventory Transactions
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'inventory_transactions' AND column_name = 'branch_id') THEN
        ALTER TABLE public.inventory_transactions ADD COLUMN branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';
    END IF;
END $$;

-- 6. Create Branch Inventory table
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

-- 7. Enable RLS
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_inventory ENABLE ROW LEVEL SECURITY;

-- 8. Add Policies (Safe)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow all read to branches" ON public.branches;
    CREATE POLICY "Allow all read to branches" ON public.branches FOR SELECT USING (true);
    
    DROP POLICY IF EXISTS "Branch isolation for inventory" ON public.branch_inventory;
    CREATE POLICY "Branch isolation for inventory" ON public.branch_inventory FOR ALL
        USING (
            branch_id = (SELECT home_branch_id FROM profiles WHERE id = auth.uid()) OR
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
        );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

COMMIT;
