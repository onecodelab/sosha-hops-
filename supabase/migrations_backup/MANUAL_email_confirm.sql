-- FIX: Auto-confirm email for checkman1@gmail.com
-- Use this for any new users that get stuck in "Email not confirmed" state

UPDATE auth.users
SET 
  email_confirmed_at = now(),
  confirmed_at = now(),
  last_sign_in_at = now(),
  raw_app_meta_data = raw_app_meta_data || '{"provider": "email", "providers": ["email"]}'::jsonb
WHERE email = 'checkman1@gmail.com';

-- Optional: Ensure profile link is solid
UPDATE public.profiles
SET invitation_pending = false
WHERE email = 'checkman1@gmail.com';

NOTIFY pgrst, 'reload schema';
