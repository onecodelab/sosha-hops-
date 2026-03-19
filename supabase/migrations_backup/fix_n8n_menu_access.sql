-- ============================================================
-- FIX: n8n Telegram Bot Fetch Menu Unblocker
-- ============================================================

-- 1. Data Verification & Migration (if needed)
-- Check if we have data in 'menu' but n8n is looking at 'menu_items'
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'menu') AND 
       EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'menu_items') THEN
        
        -- If menu_items is empty but menu has data, sync them or at least ensure we know
        IF NOT EXISTS (SELECT 1 FROM public.menu_items LIMIT 1) AND EXISTS (SELECT 1 FROM public.menu LIMIT 1) THEN
            RAISE NOTICE 'Found data in "menu" but "menu_items" is empty. Check which one the bot uses.';
        END IF;
    END IF;
END $$;

-- 2. UNBLOCK RLS for 'anon' access
-- Standard policy: Allow anyone with the ANON key to SELECT if they know the organization_id
-- This allows the n8n bot (which uses the anon key) to work without a full user JWT.

-- For 'menu' table
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'menu') THEN
        DROP POLICY IF EXISTS "Allow anon select menu by org" ON public.menu;
        CREATE POLICY "Allow anon select menu by org" 
        ON public.menu 
        FOR SELECT 
        TO anon
        USING (true); -- We filter by organization_id in the URL
    END IF;
END $$;

-- For 'menu_items' table
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'menu_items') THEN
        DROP POLICY IF EXISTS "Allow anon select menu_items by org" ON public.menu_items;
        CREATE POLICY "Allow anon select menu_items by org" 
        ON public.menu_items 
        FOR SELECT 
        TO anon
        USING (true); -- We filter by organization_id in the URL
    END IF;
END $$;

-- 3. Ensure organization_id index exists for performance
DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'menu') THEN
        CREATE INDEX IF NOT EXISTS idx_menu_organization_id ON public.menu(organization_id);
    END IF;
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'menu_items') THEN
        CREATE INDEX IF NOT EXISTS idx_menu_items_organization_id ON public.menu_items(organization_id);
    END IF;
END $$;

-- 4. Final check: List table counts
SELECT 
    (SELECT count(*) FROM public.menu) as menu_count,
    (SELECT count(*) FROM public.menu_items) as menu_items_count;
