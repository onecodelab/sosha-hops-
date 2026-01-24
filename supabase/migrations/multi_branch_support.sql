-- Sosha OS Multi-Branch Support Migration

-- 1. Create Branches Table
CREATE TABLE IF NOT EXISTS public.branches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    location TEXT,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Insert Default Branch (to migrate existing data)
INSERT INTO public.branches (id, name, location)
VALUES ('00000000-0000-0000-0000-000000000000', 'Main Branch', 'Default Location')
ON CONFLICT (id) DO NOTHING;

-- 3. Add branch_id to operational tables
-- Profiles (Staff assignments)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';

-- Orders & Tables
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';

-- Procurement
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';

-- Operational Logs
ALTER TABLE public.waste_log ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.restock_requests ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.inventory_transactions ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';

-- Staff Performance & Accountability
ALTER TABLE public.staff_shifts ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.staff_actions ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';
ALTER TABLE public.tips_ledger ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) DEFAULT '00000000-0000-0000-0000-000000000000';

-- 4. Branch-Specific Inventory
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

-- 5. Migrate Existing Stock to Branch Inventory
INSERT INTO public.branch_inventory (branch_id, ingredient_id, current_stock, par_min, par_max)
SELECT 
    '00000000-0000-0000-0000-000000000000', 
    id, 
    current_stock, 
    par_min, 
    par_max
FROM public.ingredients
ON CONFLICT (branch_id, ingredient_id) DO UPDATE SET
    current_stock = EXCLUDED.current_stock,
    par_min = EXCLUDED.par_min,
    par_max = EXCLUDED.par_max;

-- 6. Cleanup Global Ingredients Table (REMOVE STOCK FIELDS)
-- CAUTION: We do this only after verifying migration. 
-- For now, we leave them but they are "deprecated".
-- COMMENT ON COLUMN public.ingredients.current_stock IS 'DEPRECATED: Use branch_inventory instead';

-- 7. RLS Policies for Branches
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_inventory ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Allow all read to branches" ON public.branches FOR SELECT USING (true);
    CREATE POLICY "Allow HQ full access to branches" ON public.branches FOR ALL 
        USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin')));

    CREATE POLICY "Branch isolation for inventory" ON public.branch_inventory FOR ALL
        USING (
            branch_id = (SELECT home_branch_id FROM profiles WHERE id = auth.uid())
            OR
            EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
        );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
