-- PHASE 1: Security Hardening - Strict Identity Derivation
-- This migration introduces strict tenant and role derivation from JWT claims only.

CREATE OR REPLACE FUNCTION public.current_org_id_strict() 
RETURNS UUID AS $$
DECLARE
    v_org_id TEXT;
BEGIN
    -- Derive strictly from JWT claim. No profile-lookup fallback.
    -- This ensures that if the claim is missing or forged, the query fails or returns NULL.
    v_org_id := current_setting('request.jwt.claim.organization_id', true);
    
    IF v_org_id IS NULL OR v_org_id = '' THEN
        RETURN NULL;
    END IF;

    RETURN v_org_id::UUID;
EXCEPTION
    WHEN OTHERS THEN
        RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.current_org_role_strict() 
RETURNS TEXT AS $$
BEGIN
    -- Derive role strictly from raw_app_meta_data/JWT claims if available
    -- Note: raw_app_meta_data in Supabase JWT is accessible via request.jwt.claims
    RETURN current_setting('request.jwt.claim.role', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

COMMENT ON FUNCTION public.current_org_id_strict() IS 'Derives organization_id strictly from JWT claims for secure multi-tenancy.';
COMMENT ON FUNCTION public.current_org_role_strict() IS 'Derives user role strictly from JWT claims.';
