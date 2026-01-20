-- SOSHA Management Hardening: Profiles & Invites
-- 1. Add missing invitation columns
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS invitation_pending BOOLEAN DEFAULT false;

-- 2. Ensure RLS allows Admins to manage and DELETE profiles
-- Without 'FOR DELETE', admins get a "success" toast but 0 rows are actually removed.
DO $$ 
BEGIN
    -- Update Policy
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can update profiles') THEN
        CREATE POLICY "Admins can update profiles" ON public.profiles FOR UPDATE USING (public.get_user_role() IN ('owner', 'admin'));
    END IF;

    -- Delete Policy (THE FIX)
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Admins can delete profiles') THEN
        CREATE POLICY "Admins can delete profiles" ON public.profiles FOR DELETE USING (public.get_user_role() IN ('owner', 'admin'));
    END IF;
END $$;

-- 3. Optimization
CREATE INDEX IF NOT EXISTS idx_profiles_created_by ON public.profiles(created_by);
CREATE INDEX IF NOT EXISTS idx_profiles_invitation_pending ON public.profiles(invitation_pending);
