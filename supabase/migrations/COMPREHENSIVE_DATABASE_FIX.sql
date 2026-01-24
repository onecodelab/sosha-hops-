-- COMPREHENSIVE DATABASE FIX
-- Fixes: Staff invitations, Purchase Orders relationship, Signup flow
-- Run this ENTIRE script in Supabase SQL Editor

-- ============================================================
-- PART 1: Fix profiles table structure for invitations
-- ============================================================

-- 1.1 Ensure profiles table has all needed columns
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invitation_pending BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_branch_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS base_salary NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pay_period TEXT DEFAULT 'monthly';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_salary_approved BOOLEAN DEFAULT false;

-- ============================================================
-- PART 2: Fix the foreign key constraint issue
-- ============================================================

-- 2.1 Check if profiles has the strict FK and remove it
DO $$ 
BEGIN
    -- Try to drop the constraint in different naming patterns
    BEGIN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_id_fkey;
    EXCEPTION WHEN undefined_object THEN
        NULL; -- Doesn't exist, continue
    END;
    
    -- Also try alternate naming
    BEGIN
        ALTER TABLE public.profiles DROP CONSTRAINT profiles_pkey;
        ALTER TABLE public.profiles ADD PRIMARY KEY (id);
    EXCEPTION WHEN undefined_object THEN
        NULL;
    EXCEPTION WHEN duplicate_table THEN
        NULL;
    END;
END $$;

-- 2.2 Ensure profiles has a primary key (might already exist)
DO $$
BEGIN
    ALTER TABLE public.profiles ADD PRIMARY KEY (id);
EXCEPTION WHEN duplicate_table THEN
    NULL; -- Already has PK
EXCEPTION WHEN duplicate_object THEN
    NULL;
END $$;

-- ============================================================
-- PART 3: Fix purchase_orders relationship
-- ============================================================

-- 3.1 Add proper FK from purchase_orders to profiles
ALTER TABLE public.purchase_orders 
ADD COLUMN IF NOT EXISTS created_by UUID;

-- 3.2 Create explicit FK (this allows Supabase to find the relationship)
DO $$
BEGIN
    ALTER TABLE public.purchase_orders
    ADD CONSTRAINT purchase_orders_created_by_fkey 
    FOREIGN KEY (created_by) REFERENCES public.profiles(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN
    NULL; -- Already exists
END $$;

-- ============================================================
-- PART 4: Fix the signup trigger for new users
-- ============================================================

-- 4.1 Create or replace the trigger function for profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    pending_profile RECORD;
BEGIN
    -- Check if there's a pending invitation for this email
    SELECT * INTO pending_profile 
    FROM public.profiles 
    WHERE email = NEW.email AND invitation_pending = true
    LIMIT 1;
    
    IF FOUND THEN
        -- Update existing pending profile with the new auth user ID
        UPDATE public.profiles 
        SET 
            id = NEW.id,
            auth_user_id = NEW.id,
            invitation_pending = false
        WHERE id = pending_profile.id;
    ELSE
        -- Create new profile for non-invited user (standard signup)
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
            full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
            invitation_pending = false;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4.2 Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- PART 5: Ensure tables have branch_id
-- ============================================================

ALTER TABLE public.tables ADD COLUMN IF NOT EXISTS branch_id UUID;
CREATE INDEX IF NOT EXISTS idx_tables_branch ON tables(branch_id);

-- Backfill tables without branch to main branch
UPDATE public.tables 
SET branch_id = (SELECT id FROM public.branches ORDER BY created_at ASC LIMIT 1)
WHERE branch_id IS NULL;

-- ============================================================
-- PART 6: Reload schema cache
-- ============================================================
NOTIFY pgrst, 'reload schema';

-- Done! Refresh your browser after running this.
