-- FIX: Grant Owner Role
-- The user 'naserlimin@gmail.com' was set as 'waiter', which blocked access to Manager views.

UPDATE public.profiles
SET role = 'owner'
WHERE email = 'naserlimin@gmail.com';

NOTIFY pgrst, 'reload schema';
