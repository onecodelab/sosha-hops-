-- MIGRATION: 20260215_harden_units_rls.sql
-- PURPOSE: Add multi-tenancy and RLS to the new units table

BEGIN;

-- 1. Add organization_id to Units
-- We allow organization_id to be NULL for "System Standard" units (kg, g, etc)
ALTER TABLE public.units 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- 2. Backfill System Units (Null means Global/System)
UPDATE public.units SET organization_id = NULL WHERE organization_id IS NULL;

-- 3. Enable RLS
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- 4. Create Policies
-- Any authenticated user can see System units OR their own organization's units
DROP POLICY IF EXISTS "Units are viewable by everyone" ON public.units;
CREATE POLICY "Units are viewable by everyone" 
ON public.units FOR SELECT 
USING (
    organization_id IS NULL 
    OR 
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- Only Owners/Admins can create custom units for their organization
DROP POLICY IF EXISTS "Admins can manage organization units" ON public.units;
CREATE POLICY "Admins can manage organization units" 
ON public.units FOR ALL
USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND 
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('owner', 'admin'))
);

COMMIT;
