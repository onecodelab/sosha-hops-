-- Sosha OS - Emergency Branch Recovery
-- RUN THESE ONE BY ONE IF THE ENTIRE BLOCK FAILS

-- 1. CREATE THE TABLE FIRST (CRITICAL)
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. INSERT MAIN BRANCH
INSERT INTO public.branches (id, name, location)
VALUES ('00000000-0000-0000-0000-000000000000', 'Main Branch', 'HQ')
ON CONFLICT (id) DO NOTHING;

-- 3. ADD COLUMN TO PROFILES
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS home_branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';

-- 4. LINK ALL USERS TO MAIN BRANCH
UPDATE public.profiles
SET home_branch_id = '00000000-0000-0000-0000-000000000000'
WHERE home_branch_id IS NULL;

-- 5. ADD BRANCH_ID TO OPERATIONAL TABLES
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';

-- 6. CREATE BRANCH INVENTORY
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
