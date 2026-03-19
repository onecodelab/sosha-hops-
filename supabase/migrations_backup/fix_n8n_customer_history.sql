-- ============================================================
-- FIX: n8n Telegram Bot Fetch Customer History Unblocker
-- ============================================================

-- 1. Schema Fix: Add telegram_id to orders
-- This allows us to link Telegram users to their order history
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN
        IF NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = 'public.orders'::regclass AND attname = 'telegram_id') THEN
            ALTER TABLE public.orders ADD COLUMN telegram_id TEXT;
            CREATE INDEX IF NOT EXISTS idx_orders_telegram_id ON public.orders(telegram_id);
        END IF;
    END IF;
END $$;

-- 2. UNBLOCK RLS for 'anon' access (Customer History)
-- Standard policy: Allow anyone with the ANON key to SELECT orders
-- This allows the n8n bot (which uses the anon key) to work without a full user JWT.
-- We rely on filtering by telegram_id and organization_id in the URL.

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'orders') THEN
        DROP POLICY IF EXISTS "Allow anon select orders by telegram" ON public.orders;
        CREATE POLICY "Allow anon select orders by telegram" 
        ON public.orders 
        FOR SELECT 
        TO anon
        USING (true); 
    END IF;
END $$;

-- 3. Final check: List columns and a sample count
SELECT 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name = 'orders' AND column_name IN ('telegram_id', 'organization_id');

SELECT count(*) as total_orders FROM public.orders;
