-- Migration to fix the missing column error
BEGIN;

ALTER TABLE public.table_sessions 
ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

COMMIT;
