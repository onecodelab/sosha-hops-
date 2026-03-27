-- Fix default credits for Basic Plan
-- Align with 10,000 credits (500 orders @ 20 credits each)

ALTER TABLE public.organizations 
ALTER COLUMN max_monthly_credits SET DEFAULT 10000;

-- Update existing Basic organizations that are currently stuck at 100
UPDATE public.organizations 
SET max_monthly_credits = 10000
WHERE (plan_tier = 'basic' OR plan_tier IS NULL) 
AND max_monthly_credits = 100;
