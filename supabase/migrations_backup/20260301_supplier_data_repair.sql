-- DATA REPAIR: Create missing supplier entities for orphaned supplier profiles
-- This script finds all users with the 'supplier' role who do not yet have a linked record in the 'suppliers' table

DO $$
DECLARE
    p_record RECORD;
    new_sup_id UUID;
    created_count INTEGER := 0;
BEGIN
    FOR p_record IN 
        SELECT id, full_name, email 
        FROM public.profiles 
        WHERE role = 'supplier' AND supplier_id IS NULL
    LOOP
        -- 1. Create a new supplier entity record
        -- We assign it to the 'Platform' organization (0000...)
        INSERT INTO public.suppliers (name, organization_id, is_active)
        VALUES (p_record.full_name, '00000000-0000-0000-0000-000000000000', true)
        RETURNING id INTO new_sup_id;

        -- 2. Link the profile to the new entity
        UPDATE public.profiles 
        SET supplier_id = new_sup_id 
        WHERE id = p_record.id;
        
        created_count := created_count + 1;
        RAISE NOTICE 'Created supplier entity for % (%)', p_record.full_name, p_record.email;
    END LOOP;
    
    RAISE NOTICE 'Total supplier entities repaired: %', created_count;
END $$;

-- Also ensure the RLS policies are applied just in case
DROP POLICY IF EXISTS "Anyone can view platform suppliers" ON public.suppliers;
CREATE POLICY "Anyone can view platform suppliers" ON public.suppliers
FOR SELECT USING (
    organization_id = '00000000-0000-0000-0000-000000000000'
);

NOTIFY pgrst, 'reload schema';
