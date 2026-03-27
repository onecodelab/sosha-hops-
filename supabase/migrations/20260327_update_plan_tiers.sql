-- 20260327_update_plan_tiers.sql
-- Add Plan Tiering and Branch Limits to Organizations

-- 1. Create the plan_tier type if it doesnt exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_tier') THEN
        CREATE TYPE plan_tier AS ENUM ('basic', 'standard', 'enterprise');
    END IF;
END$$;

-- 2. Add columns to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS plan_tier plan_tier DEFAULT 'basic',
ADD COLUMN IF NOT EXISTS max_branches INTEGER DEFAULT 1;

-- 3. Update existing organizations to have realistic initial values
-- We align with the users pricing model: 
-- Basic: 10,000 credits (500 orders)
-- Standard: 20,000 credits (1,000 orders)
UPDATE public.organizations 
SET 
    max_monthly_credits = 10000,
    plan_tier = 'basic',
    max_branches = 1
WHERE plan_tier IS NULL OR plan_tier = 'basic';

-- 4. Set Standard Plan values for anyone who might be upgraded
-- (This is just a template, usually handled via UI/API)
-- UPDATE public.organizations SET plan_tier = 'standard', max_monthly_credits = 20000, max_branches = 3 WHERE id = '...';
