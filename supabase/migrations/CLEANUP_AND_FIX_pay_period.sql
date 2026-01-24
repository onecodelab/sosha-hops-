-- DATA CLEANUP & CONSTRAINT FIX: Repair profiles_pay_period_check
-- This script fixes existing "invalid" data so Postgres lets us add the rule.

-- 1. Drop the rule if it exists or is broken
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pay_period_check;

-- 2. Ensure the columns exist
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS base_salary NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pay_period TEXT DEFAULT 'monthly';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_salary_approved BOOLEAN DEFAULT false;

-- 3. DATA CLEANUP (The missing step)
-- If any user has a NULL or a different value (like 'Monthly' with a capital M), 
-- we force them to 'monthly' so the rule doesn't fail.
UPDATE public.profiles 
SET pay_period = 'monthly' 
WHERE pay_period IS NULL 
   OR LOWER(pay_period) NOT IN ('monthly', 'weekly', 'hourly');

-- Force all to lowercase just to be extra safe
UPDATE public.profiles SET pay_period = LOWER(pay_period);

-- 4. Now add the rule safely
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_pay_period_check 
CHECK (pay_period IN ('monthly', 'weekly', 'hourly'));

-- 5. Refresh everything
NOTIFY pgrst, 'reload schema';
