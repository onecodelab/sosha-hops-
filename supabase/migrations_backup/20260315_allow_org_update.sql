-- Migration: Allow Organization Update for Owners/Admins
-- Enables the system prompt and other org settings to be saved from the frontend

DO $$
BEGIN
    DROP POLICY IF EXISTS "Owners can update own organization" ON public.organizations;
    CREATE POLICY "Owners can update own organization"
    ON public.organizations
    FOR UPDATE
    USING (id = public.current_org_id())
    WITH CHECK (id = public.current_org_id());
END $$;

-- Verify RLS is enabled
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
