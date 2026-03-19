-- BARO SUPPLIER PORTAL: DATABASE HARDENING
-- This script ensures the database is ready for the Supplier Portal feature

-- 1. Ensure 'supplier' role is allowed in profiles
-- In many schemas, this is a CHECK constraint. Let's make it robust.
DO $$ 
BEGIN
    -- Try to drop existing constraint if it exists to refresh it
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    
    -- Add the expanded role check including 'supplier' and 'driver'
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
    CHECK (role IN ('owner', 'admin', 'manager', 'waiter', 'kitchen', 'supplier', 'driver', 'super_admin'));
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Could not update role check: %', SQLERRM;
END $$;

-- 2. Ensure supplier_id column exists
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS supplier_id UUID REFERENCES public.suppliers(id);

-- 3. RLS: Purchase Orders (Suppliers can view their own)
-- Note: 'Suppliers view own POs' might already exist from a previous step, but let's be thorough.
DROP POLICY IF EXISTS "Suppliers view own POs" ON public.purchase_orders;
CREATE POLICY "Suppliers view own POs" ON public.purchase_orders
FOR SELECT USING (
    auth.uid() IN (
        SELECT id FROM public.profiles 
        WHERE role = 'supplier' 
        AND supplier_id = purchase_orders.supplier_id
    )
);

-- 4. RLS: Purchase Orders (Suppliers update their own status)
DROP POLICY IF EXISTS "Suppliers update own PO status" ON public.purchase_orders;
CREATE POLICY "Suppliers update own PO status" ON public.purchase_orders
FOR UPDATE USING (
    auth.uid() IN (
        SELECT id FROM public.profiles 
        WHERE role = 'supplier' 
        AND supplier_id = purchase_orders.supplier_id
    )
)
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM public.profiles 
        WHERE role = 'supplier' 
        AND supplier_id = purchase_orders.supplier_id
    )
);

-- 5. RLS: Purchase Order Items (Suppliers view items for their POs)
DROP POLICY IF EXISTS "Suppliers view PO items" ON public.purchase_order_items;
CREATE POLICY "Suppliers view PO items" ON public.purchase_order_items
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.purchase_orders po
        JOIN public.profiles p ON p.supplier_id = po.supplier_id
        WHERE po.id = purchase_order_items.po_id
        AND p.id = auth.uid()
        AND p.role = 'supplier'
    )
);

-- 6. Reload schema
NOTIFY pgrst, 'reload schema';
