-- CONSTRAINT FIX: Repair profiles_pay_period_check
-- This script ensures the pay_period check constraint matches the frontend values.

-- 1. Drop the existing constraint if it exists to clear the error
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pay_period_check;

-- 2. Ensure columns exist (Safeguard)
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS base_salary NUMERIC;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS pay_period TEXT DEFAULT 'monthly';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_salary_approved BOOLEAN DEFAULT false;

-- 3. Add the correct check constraint
ALTER TABLE public.profiles 
ADD CONSTRAINT profiles_pay_period_check 
CHECK (pay_period IN ('monthly', 'weekly', 'hourly'));

-- 4. Reload cache
NOTIFY pgrst, 'reload schema';
