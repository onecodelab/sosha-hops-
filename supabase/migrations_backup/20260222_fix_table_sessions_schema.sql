
-- 2026-02-22: Fix table_sessions schema and organization isolation
-- Purpose: Add missing organization_id to table_sessions to satisfy Edge Function requirements.

-- 1. Add organization_id column if it doesn't exist
ALTER TABLE public.table_sessions 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- 2. Backfill existing sessions (failsafe for migration)
-- We use the default organization ID used in init_organization_layer.sql
UPDATE public.table_sessions 
SET organization_id = '00000000-0000-0000-0000-000000000000' 
WHERE organization_id IS NULL;

-- 3. Set NOT NULL constraint after backfill (Critical for security)
-- Uncomment this if you are sure all existing rows are backfilled
-- ALTER TABLE public.table_sessions ALTER COLUMN organization_id SET NOT NULL;

-- 4. Enable RLS and add isolation policy
ALTER TABLE public.table_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation for table_sessions" ON public.table_sessions;
CREATE POLICY "Tenant Isolation for table_sessions" 
ON public.table_sessions 
FOR ALL 
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

-- 5. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
