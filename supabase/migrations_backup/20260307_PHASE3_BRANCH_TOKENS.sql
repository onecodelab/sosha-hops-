-- PHASE 3 FIX: Chatbot Security - Signed Branch Tokens
-- Goal: Provide a way for anonymous customers to access branch-specific data securely.

-- 1. Create a dedicated Config table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.system_config (
    config_key TEXT PRIMARY KEY,
    config_value TEXT NOT NULL,
    organization_id UUID REFERENCES public.organizations(id), -- Optional for global settings
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Setup System Secret
INSERT INTO public.system_config (config_key, config_value)
VALUES ('SYSTEM_JWT_SECRET', 'baro-os-branch-secure-2026')
ON CONFLICT (config_key) DO NOTHING;

-- 3. Ensure pgcrypto is available for HMAC
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 4. Function to Generate Signed Token
CREATE OR REPLACE FUNCTION public.generate_branch_token(
    p_branch_id UUID,
    p_org_override UUID DEFAULT NULL -- Optional: For Admin/Console usage
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_org_id UUID;
    v_secret TEXT;
    v_payload JSON;
BEGIN
    -- 1. Identity Resolution
    -- If an override is provided, we trust it (Privileged function)
    -- Otherwise, we try to get it from the authenticated user
    v_org_id := COALESCE(p_org_override, public.current_org_id());
    
    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'Identity Error: Action requires an authenticated organizational context or an explicit organization_id.';
    END IF;

    -- 2. Validate Branch belongs to Organization
    IF NOT EXISTS (SELECT 1 FROM public.branches WHERE id = p_branch_id AND organization_id = v_org_id) THEN
        RAISE EXCEPTION 'Isolation Error: Branch not found or access denied for org %.', v_org_id;
    END IF;

    -- 3. Fetch Secret
    SELECT config_value INTO v_secret 
    FROM public.system_config 
    WHERE config_key = 'SYSTEM_JWT_SECRET';

    -- 4. Create Payload
    v_payload := json_build_object(
        'branch_id', p_branch_id,
        'organization_id', v_org_id,
        'exp', extract(epoch from (now() + interval '1 year'))::int
    );
    
    -- 5. Sign with HMAC
    RETURN encode(v_payload::text::bytea, 'base64') || '.' || 
           encode(hmac(v_payload::text::bytea, v_secret::bytea, 'sha256'), 'base64');
END;
$$;

COMMENT ON FUNCTION public.generate_branch_token(UUID, UUID) IS 'Generates a signed, verifiable token for a branch to be used by anonymous chatbots.';
