-- Migration: Table Ordering Session Token Generation
-- Date: 2026-05-23
-- Description: Generates a short-lived branch token (2 hours 30 minutes) for a table after validating its static qr_token.

-- 1. Backfill any tables that have NULL qr_token
UPDATE public.tables 
SET qr_token = encode(gen_random_bytes(8), 'hex') 
WHERE qr_token IS NULL;

-- 2. Create the function to validate the table and return a short-lived token
CREATE OR REPLACE FUNCTION public.get_table_session_token(
    p_table_id UUID,
    p_qr_token TEXT
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_table RECORD;
    v_secret TEXT;
    v_payload JSON;
    v_token TEXT;
BEGIN
    -- 1. Find table
    SELECT * INTO v_table 
    FROM public.tables 
    WHERE id = p_table_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Table not found.';
    END IF;
    
    -- 2. Verify qr_token matches
    IF v_table.qr_token IS NULL OR v_table.qr_token != p_qr_token THEN
        RAISE EXCEPTION 'Invalid table verification token.';
    END IF;
    
    -- 3. Fetch Secret from system_config
    SELECT config_value INTO v_secret 
    FROM public.system_config 
    WHERE config_key = 'SYSTEM_JWT_SECRET';
    
    IF v_secret IS NULL THEN
        v_secret := 'baro-os-branch-secure-2026'; -- fallback if system_config entry missing
    END IF;

    -- 4. Create Payload with 2 hours 30 minutes expiration
    v_payload := json_build_object(
        'branch_id', v_table.branch_id,
        'organization_id', v_table.organization_id,
        'exp', extract(epoch from (now() + interval '2 hours 30 minutes'))::int
    );
    
    -- 5. Sign payload with HMAC SHA-256
    v_token := replace(replace(encode(v_payload::text::bytea, 'base64'), E'\n', ''), E'\r', '') || '.' || 
               replace(replace(encode(hmac(v_payload::text::bytea, v_secret::bytea, 'sha256'), 'base64'), E'\n', ''), E'\r', '');
               
    RETURN v_token;
END;
$$;

-- 3. Grant execute permissions to public roles (anonymous guest users must be able to call it)
GRANT EXECUTE ON FUNCTION public.get_table_session_token(UUID, TEXT) TO anon, authenticated;
