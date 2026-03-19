-- MASTER FIX: Staff Invitation Foreign Key Error
-- This removes the strict foreign key constraint that prevents creating pending invitations.
-- The constraint makes sense for normal users, but blocks the "invite first, signup later" flow.

-- STEP 1: Drop the existing foreign key constraint on profiles.id
-- (The constraint name may vary - this handles both common patterns)
DO $$ 
BEGIN
    -- Drop the constraint if it exists (handles different naming conventions)
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pkey CASCADE;
EXCEPTION WHEN OTHERS THEN
    NULL; -- Ignore if constraints don't exist
END $$;

-- STEP 2: Recreate the primary key WITHOUT the foreign key reference
ALTER TABLE public.profiles ADD PRIMARY KEY (id);

-- STEP 3: Add a soft reference column to track which auth user this profile belongs to
-- This replaces the hard FK with an application-managed link
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_user_id UUID;

-- STEP 4: Backfill auth_user_id for existing linked profiles
UPDATE public.profiles 
SET auth_user_id = id 
WHERE auth_user_id IS NULL AND invitation_pending = false;

-- STEP 5: Ensure all required columns exist for the invite flow
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS invitation_pending BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_by UUID;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS home_branch_id UUID;

-- STEP 6: Reload Schema Cache
NOTIFY pgrst, 'reload schema';
