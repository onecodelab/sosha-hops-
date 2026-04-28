-- Platform admin credit top-up RPC
-- Lets super_admins add monthly chatbot credits without relying on a browser edge-function call.

CREATE OR REPLACE FUNCTION public.admin_topup_monthly_credits(
    p_organization_id UUID,
    p_amount INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_role TEXT;
    v_org RECORD;
    v_new_max INTEGER;
BEGIN
    SELECT role INTO v_role
    FROM public.profiles
    WHERE id = auth.uid();

    IF v_role IS DISTINCT FROM 'super_admin' THEN
        RAISE EXCEPTION 'Forbidden';
    END IF;

    IF p_organization_id IS NULL THEN
        RAISE EXCEPTION 'organization_id is required';
    END IF;

    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'amount must be a positive integer';
    END IF;

    SELECT id, name, max_monthly_credits
    INTO v_org
    FROM public.organizations
    WHERE id = p_organization_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Organization not found';
    END IF;

    UPDATE public.organizations
    SET max_monthly_credits = COALESCE(max_monthly_credits, 0) + p_amount
    WHERE id = p_organization_id
    RETURNING max_monthly_credits INTO v_new_max;

    INSERT INTO public.credit_usage_logs (
        organization_id,
        amount,
        action_type,
        metadata
    ) VALUES (
        p_organization_id,
        p_amount,
        'admin_credit_topup',
        jsonb_build_object(
            'admin_user_id', auth.uid(),
            'organization_name', v_org.name,
            'old_max_monthly_credits', COALESCE(v_org.max_monthly_credits, 0),
            'new_max_monthly_credits', v_new_max,
            'note', 'Platform admin credit top-up'
        )
    );

    RETURN jsonb_build_object(
        'success', true,
        'organization_id', p_organization_id,
        'organization_name', v_org.name,
        'added_credits', p_amount,
        'new_max_monthly_credits', v_new_max
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_topup_monthly_credits(UUID, INTEGER) TO authenticated;
COMMENT ON FUNCTION public.admin_topup_monthly_credits(UUID, INTEGER) IS 'Super-admin RPC for topping up an organization monthly credit cap.';
