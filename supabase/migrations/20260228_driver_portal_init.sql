-- BARO DRIVER PORTAL: DATABASE SETUP
-- This script ensures the orders table can handle delivery assignments

-- 1. Add delivery status type if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'delivery_status') THEN
        CREATE TYPE public.delivery_status AS ENUM ('searching', 'assigned', 'picked_up', 'delivered', 'cancelled');
    END IF;
END $$;

-- 2. Extend orders table
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS assigned_driver_id UUID REFERENCES public.profiles(id),
ADD COLUMN IF NOT EXISTS delivery_status public.delivery_status DEFAULT NULL,
ADD COLUMN IF NOT EXISTS delivery_address TEXT,
ADD COLUMN IF NOT EXISTS delivery_lat NUMERIC,
ADD COLUMN IF NOT EXISTS delivery_lng NUMERIC;

-- 3. RLS: Orders (Drivers can view searching or their own assigned orders)
DROP POLICY IF EXISTS "Drivers view relevant orders" ON public.orders;
CREATE POLICY "Drivers view relevant orders" ON public.orders
FOR SELECT USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'driver')
    AND (
        delivery_status = 'searching' 
        OR assigned_driver_id = auth.uid()
    )
);

-- 4. RLS: Orders (Drivers update their assigned orders)
DROP POLICY IF EXISTS "Drivers update assigned orders" ON public.orders;
CREATE POLICY "Drivers update assigned orders" ON public.orders
FOR UPDATE USING (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'driver')
    AND assigned_driver_id = auth.uid()
)
WITH CHECK (
    auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'driver')
    AND assigned_driver_id = auth.uid()
);

-- 5. RLS: Order Items (Drivers view items for their assigned orders)
DROP POLICY IF EXISTS "Drivers view order items" ON public.order_items;
CREATE POLICY "Drivers view order items" ON public.order_items
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.orders o
        WHERE o.id = order_items.order_id
        AND (o.assigned_driver_id = auth.uid() OR o.delivery_status = 'searching')
        AND auth.uid() IN (SELECT id FROM public.profiles WHERE role = 'driver')
    )
);

-- 6. Reload schema
NOTIFY pgrst, 'reload schema';
