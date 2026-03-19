-- FIX: Update handle_new_user trigger to include organization_id
-- This fixes the "Database error saving new user" issue

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
        -- We now include the default organization_id to satisfy RLS/NOT NULL constraints
        INSERT INTO public.profiles (
            id, 
            email, 
            full_name, 
            name, 
            role, 
            is_online, 
            avatar_url, 
            organization_id
        )
        VALUES (
            NEW.id,
            NEW.email,
            COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
            COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
            COALESCE(NEW.raw_user_meta_data->>'role', 'waiter'),
            false,
            NEW.raw_user_meta_data->>'avatar_url',
            '00000000-0000-0000-0000-000000000000' -- Default/Platform Organization
        )
        ON CONFLICT (id) DO UPDATE SET
            email = EXCLUDED.email,
            full_name = COALESCE(EXCLUDED.full_name, profiles.full_name),
            invitation_pending = false;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Provide a direct fix for the current user who is stuck
-- Replace the email with yours in the SQL Editor if this doesn't run automatically
DO $$
DECLARE
    v_user_id UUID;
BEGIN
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'ramiyonclab@gmail.com';
    
    IF v_user_id IS NOT NULL THEN
        INSERT INTO public.profiles (id, email, full_name, name, role, organization_id)
        VALUES (
            v_user_id, 
            'ramiyonclab@gmail.com', 
            'Platform Admin', 
            'Platform Admin', 
            'super_admin', 
            '00000000-0000-0000-0000-000000000000'
        )
        ON CONFLICT (id) DO UPDATE SET
            role = 'super_admin',
            organization_id = '00000000-0000-0000-0000-000000000000';
    END IF;
END $$;

NOTIFY pgrst, 'reload schema';
