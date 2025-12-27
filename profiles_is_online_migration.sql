-- Migration: Add is_online column to profiles and sync from users

-- 1. Ensure the column exists on profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_online BOOLEAN DEFAULT FALSE;

-- 2. Backfill is_online from users table where IDs match
DO $$
BEGIN
  IF to_regclass('public.users') IS NOT NULL THEN
    UPDATE public.profiles p
    SET is_online = COALESCE(u.is_online, FALSE)
    FROM public.users u
    WHERE p.id = u.id
      AND u.is_online IS NOT NULL;

    -- 3. Ensure every staff member in users has a corresponding profile
    INSERT INTO public.profiles (id, email, full_name, role, is_online)
    SELECT
      u.id,
      u.email,
      u.full_name,
      u.role,
      COALESCE(u.is_online, FALSE)
    FROM public.users u
    LEFT JOIN public.profiles p ON p.id = u.id
    WHERE p.id IS NULL
      AND u.role IN ('owner', 'admin', 'manager', 'waiter', 'kitchen', 'security');
  END IF;
END $$;