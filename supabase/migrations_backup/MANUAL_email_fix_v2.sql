-- FIX: Updated Manual Email Confirmation
-- Corrects the error "confirmed_at is a generated column"

UPDATE auth.users
SET 
  email_confirmed_at = now(),
  updated_at = now(),
  last_sign_in_at = now(),
  raw_app_meta_data = raw_app_meta_data || '{"provider": "email", "providers": ["email"]}'::jsonb
WHERE email = 'checkman1@gmail.com';

-- Ensure profile is active
UPDATE public.profiles
SET invitation_pending = false
WHERE email = 'checkman1@gmail.com';

NOTIFY pgrst, 'reload schema';
