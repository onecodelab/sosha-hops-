-- RESTORE FOREIGN KEYS to Profiles
-- This fixes the "Could not find relationship" errors in Kitchen, Staff, and PO pages.
-- The previous profiles PK change cascaded and removed these constraints.

-- 1. Orders -> Profiles (waiter_id)
DO $$ BEGIN
    ALTER TABLE public.orders 
    ADD CONSTRAINT orders_waiter_id_fkey 
    FOREIGN KEY (waiter_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 2. Table Sessions -> Profiles (waiter_id)
DO $$ BEGIN
    ALTER TABLE public.table_sessions 
    ADD CONSTRAINT table_sessions_waiter_id_fkey 
    FOREIGN KEY (waiter_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 3. Staff Shifts -> Profiles (staff_id)
DO $$ BEGIN
    ALTER TABLE public.staff_shifts 
    ADD CONSTRAINT staff_shifts_staff_id_fkey 
    FOREIGN KEY (staff_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 4. Staff Actions -> Profiles (staff_id)
DO $$ BEGIN
    ALTER TABLE public.staff_actions 
    ADD CONSTRAINT staff_actions_staff_id_fkey 
    FOREIGN KEY (staff_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 5. Tips Ledger -> Profiles (staff_id)
DO $$ BEGIN
    ALTER TABLE public.tips_ledger 
    ADD CONSTRAINT tips_ledger_staff_id_fkey 
    FOREIGN KEY (staff_id) REFERENCES public.profiles(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 6. PO Activity Log -> Profiles (performed_by)
DO $$ BEGIN
    ALTER TABLE public.po_activity_log 
    ADD CONSTRAINT po_activity_log_performed_by_fkey 
    FOREIGN KEY (performed_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

-- 7. Audit Logs -> Profiles (staff_id) - Check if table exists first
DO $$ BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'audit_logs') THEN
        ALTER TABLE public.audit_logs 
        ADD CONSTRAINT audit_logs_staff_id_fkey 
        FOREIGN KEY (staff_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
    END IF;
EXCEPTION WHEN OTHERS THEN NULL; END $$;

NOTIFY pgrst, 'reload schema';
