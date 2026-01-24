-- FIXED DATABASE MIGRATION
-- Run this ENTIRE script in Supabase SQL Editor.
-- It fixes: Staff Invitations, Purchase Orders, and Signup Flow.

-- ============================================================
-- PART 1: Remove Strict Constraints & Fix Profiles
-- ============================================================

-- 1.1 Remove strict foreign key if it exists
DO $$ 
BEGIN
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 1.2 Ensure Primary Key exists
DO $$ 
BEGIN
    ALTER TABLE public.profiles ADD PRIMARY KEY (id);
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 1.3 Add necessary columns for invitation flow
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invitation_pending BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_branch_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS base_salary NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pay_period TEXT DEFAULT 'monthly';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_salary_approved BOOLEAN DEFAULT false;

-- Backfill auth_user_id for existing users
UPDATE public.profiles SET auth_user_id = id WHERE auth_user_id IS NULL AND invitation_pending = false;

-- ============================================================
-- PART 2: Fix Purchase Orders Relationship
-- ============================================================

-- 2.1 Add created_by column
ALTER TABLE public.purchase_orders ADD COLUMN IF NOT EXISTS created_by UUID;

-- 2.2 Add Foreign Key to Profiles (Soft Link)
DO $$
BEGIN
    ALTER TABLE public.purchase_orders
    ADD CONSTRAINT purchase_orders_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================
-- PART 3: Fix Signup Trigger (The "Database Error" Fix)
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    pending_profile_id UUID;
BEGIN
    -- Check if there's a pending invitation for this email
    SELECT id INTO pending_profile_id
    FROM public.profiles 
    WHERE email = NEW.email AND invitation_pending = true
    LIMIT 1;
    
    IF pending_profile_id IS NOT NULL THEN
        -- Link the new auth user to the existing pending profile
        -- We UPDATE the ID to match the Auth ID (critical step)
        UPDATE public.profiles 
        SET 
            id = NEW.id,
            auth_user_id = NEW.id,
            invitation_pending = false
        WHERE id = pending_profile_id;
    ELSE
        -- Standard Signup: Create new profile
        INSERT INTO public.profiles (id, email, full_name, role, is_online, avatar_url)
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
            COALESCE(NEW.raw_user_meta_data->>'role', 'waiter'),
            false,
            NEW.raw_user_meta_data->>'avatar_url'
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = COALESCE(EXCLUDED.full_name, profiles.full_name);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rebind Trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- PART 4: Fix Tables Branch ID
-- ============================================================

ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS branch_id UUID;
CREATE INDEX IF NOT EXISTS idx_tables_branch ON tables(branch_id);

-- Backfill
UPDATE public.tables 
SET branch_id = (SELECT id FROM public.branches ORDER BY created_at ASC LIMIT 1)
WHERE branch_id IS NULL;

-- 5. RELOAD
NOTIFY pgrst, 'reload schema';
