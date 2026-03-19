
-- Baro OS: Automated Branch Initialization
-- This trigger ensures that every new branch created is immediately populated
-- with inventory slots and default tables.

-- 1. Create the Initialization Function
CREATE OR REPLACE FUNCTION public.initialize_new_branch()
RETURNS TRIGGER AS $$
DECLARE
    ingredient_record RECORD;
BEGIN
    -- [SECURITY DEFINER context implicit in migration execution]
    -- [AFTER INSERT context ensures NEW.id is available]

    -- A. Populate Branch Inventory
    -- We insert zeroed stock records for all ingredients to enable branch-aware filtering
    INSERT INTO public.branch_inventory (branch_id, ingredient_id, current_stock, par_min, par_max)
    SELECT NEW.id, id, 0, 0, 100
    FROM public.ingredients
    ON CONFLICT (branch_id, ingredient_id) DO NOTHING;

    -- B. Provision Default Floor Plan
    -- We create a set of base tables so the branch is "Ready to Serve" immediately
    INSERT INTO public.tables (branch_id, organization_id, table_number, zone, status, capacity_min, capacity_max)
    VALUES 
        (NEW.id, NEW.organization_id, '1', 'Indoor', 'available', 2, 4),
        (NEW.id, NEW.organization_id, '2', 'Indoor', 'available', 2, 4),
        (NEW.id, NEW.organization_id, '3', 'Indoor', 'available', 2, 4),
        (NEW.id, NEW.organization_id, '4', 'Indoor', 'available', 4, 6),
        (NEW.id, NEW.organization_id, '5', 'Indoor', 'available', 4, 10)
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Bind the Trigger to the branches table
DROP TRIGGER IF EXISTS trigger_initialize_branch ON public.branches;
CREATE TRIGGER trigger_initialize_branch
AFTER INSERT ON public.branches
FOR EACH ROW EXECUTE FUNCTION public.initialize_new_branch();

-- COMMENT: This ensures linear scaling for ingredients during branch creation.
-- Multi-branch launches in a single transaction are supported but will execute serially per branch.
