-- Migration: Implementing the Deterministic Governance Gatekeeper (The Kernel)
-- Date: 2026-02-15

-- This function is the central, non-bypassable logic that decides if a 
-- "Probabilistic Proposal" is allowed to execute or requires manual oversight.

CREATE OR REPLACE FUNCTION public.evaluate_governance_policy(p_proposal_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_proposal RECORD;
    v_policy RECORD;
    v_org_id UUID;
    v_impact_usd NUMERIC;
    v_total_daily_exposure NUMERIC;
    v_is_auto_approvable BOOLEAN := TRUE;
    v_rejection_reason TEXT := NULL;
    v_result_status TEXT := 'MANUAL_REVIEW_REQUIRED';
BEGIN
    -- 1. Get the Proposal Data
    SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Proposal not found');
    END IF;

    -- 2. Get the Governance Policy
    SELECT * INTO v_policy 
    FROM public.governance_policies 
    WHERE organization_id = v_proposal.organization_id 
    AND action_type = v_proposal.proposal_type 
    AND is_active = TRUE;

    IF NOT FOUND THEN
        -- Default to manual review if no policy exists
        RETURN jsonb_build_object(
            'success', true, 
            'decision', 'MANUAL_REVIEW_REQUIRED', 
            'reason', 'No active governance policy found for this action type.'
        );
    END IF;

    -- 3. Check Deterministic Boundary: Circuit Breaker
    IF v_policy.circuit_breaker_triggered THEN
        RETURN jsonb_build_object(
            'success', true,
            'decision', 'REJECTED_BY_KERNEL',
            'reason', 'Circuit Breaker Active: ' || COALESCE(v_policy.circuit_breaker_reason, 'Policy suspended due to excessive variance.')
        );
    END IF;

    -- 4. Check Deterministic Boundary: Max Exposure Caps
    -- For now, we assume impact is calculated in the proposal data or impact ledger
    -- If no impact ledger entry yet, we look at impact_score as a proxy or use 0
    v_impact_usd := COALESCE((v_proposal.data->>'total_value_usd')::NUMERIC, 0);
    v_total_daily_exposure := v_policy.current_daily_usage_usd + v_impact_usd;

    IF v_total_daily_exposure > v_policy.max_daily_usd_exposure THEN
        v_is_auto_approvable := FALSE;
        v_rejection_reason := 'Daily exposure cap exceeded. ($' || v_total_daily_exposure || ' > $' || v_policy.max_daily_usd_exposure || ')';
    END IF;

    -- 5. Check Probabilistic Boundary: Risk Thresholds
    IF v_proposal.risk_financial > v_policy.max_risk_allowed OR
       v_proposal.risk_fraud > v_policy.max_risk_allowed THEN
        v_is_auto_approvable := FALSE;
        v_rejection_reason := COALESCE(v_rejection_reason || ' | ', '') || 'Risk threshold violation.';
    END IF;

    -- 6. Check Confidence Requirements
    IF v_proposal.confidence < v_policy.min_confidence_required THEN
        v_is_auto_approvable := FALSE;
        v_rejection_reason := COALESCE(v_rejection_reason || ' | ', '') || 'Insufficient agent confidence.';
    END IF;

    -- 7. Final Decision Mapping
    IF v_is_auto_approvable THEN
        v_result_status := 'AUTO_APPROVED';
    ELSE
        v_result_status := 'MANUAL_REVIEW_REQUIRED';
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'decision', v_result_status,
        'policy_version', v_policy.version_id,
        'reason', v_rejection_reason,
        'metrics', jsonb_build_object(
            'daily_usage_post_execution', v_total_daily_exposure,
            'risk_level', v_proposal.risk_financial
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
