-- MASTER MIGRATION: Self-Regulating Operational Kernel Initialization
-- Date: 2026-02-15
-- Note: Run this script to initialize the entire Phase 3/4 OSM architecture.

-- 1. ENUMS & CATEGORIZATION (Data Hardening)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'waste_category_enum') THEN
        CREATE TYPE public.waste_category_enum AS ENUM (
            'SPOILED', 'BURNT', 'DROPPED', 'EXPIRED', 'OVER_PROD', 'THEFT_SUSP', 'OTHER'
        );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'void_reason_enum') THEN
        CREATE TYPE public.void_reason_enum AS ENUM (
            'CUSTOMER_ERR', 'STAFF_ERR', 'OUT_OF_STOCK', 'TEST_ORDER', 'COMPLIMENTARY', 'FRAUD_SUSP'
        );
    END IF;
END $$;

-- 2. ENHANCE PROPOSALS (Risk & Optimization Dimensions)
ALTER TABLE public.proposals
    -- Basic Hardening (if not exists)
    ADD COLUMN IF NOT EXISTS simulation_data JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS policy_context TEXT,
    ADD COLUMN IF NOT EXISTS risk_score NUMERIC(4,3) DEFAULT 0.000,
    
    -- Risk Decomposition (The Guardian Dimensions)
    ADD COLUMN IF NOT EXISTS risk_financial NUMERIC(4,3) DEFAULT 0.000,
    ADD COLUMN IF NOT EXISTS risk_fraud NUMERIC(4,3) DEFAULT 0.000,
    ADD COLUMN IF NOT EXISTS risk_operational NUMERIC(4,3) DEFAULT 0.000,
    ADD COLUMN IF NOT EXISTS risk_reputational NUMERIC(4,3) DEFAULT 0.000,
    ADD COLUMN IF NOT EXISTS risk_explanation JSONB DEFAULT '[]',
    
    -- Multi-Objective Optimization (The Strategist Dimensions)
    ADD COLUMN IF NOT EXISTS opt_profit NUMERIC(4,3) DEFAULT 0.000,
    ADD COLUMN IF NOT EXISTS opt_staff_fatigue NUMERIC(4,3) DEFAULT 0.000,
    ADD COLUMN IF NOT EXISTS opt_customer_satisfaction NUMERIC(4,3) DEFAULT 0.000,
    ADD COLUMN IF NOT EXISTS opt_resilience NUMERIC(4,3) DEFAULT 0.000,
    
    -- Simulation & Stress Test
    ADD COLUMN IF NOT EXISTS stress_test_results JSONB DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS backtest_period_days INTEGER DEFAULT 30;

-- 3. GOVERNANCE POLICIES TABLE (The Deterministic Boundary)
CREATE TABLE IF NOT EXISTS public.governance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    
    action_type TEXT NOT NULL, -- e.g., 'procurement', 'void', 'discount'
    auto_approve_threshold_usd NUMERIC(10,2) DEFAULT 0.0,
    max_risk_allowed NUMERIC(4,3) DEFAULT 0.05,
    min_confidence_required NUMERIC(4,3) DEFAULT 0.95,
    
    -- Exposure Caps
    max_daily_usd_exposure NUMERIC(12,2) DEFAULT 0.00,
    max_weekly_usd_exposure NUMERIC(12,2) DEFAULT 0.00,
    current_daily_usage_usd NUMERIC(12,2) DEFAULT 0.00,
    
    -- Failure Containment (Circuit Breakers)
    consecutive_negative_variance_limit INTEGER DEFAULT 3,
    current_consecutive_negative_variance INTEGER DEFAULT 0,
    circuit_breaker_triggered BOOLEAN DEFAULT FALSE,
    circuit_breaker_reason TEXT,
    
    is_active BOOLEAN DEFAULT TRUE,
    version_id TEXT NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ECONOMIC IMPACT LEDGER (The Truth Layer)
CREATE TABLE IF NOT EXISTS public.economic_impact_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id),
    
    expected_impact_usd NUMERIC(12,2) NOT NULL,
    actual_impact_usd NUMERIC(12,2),
    variance_usd NUMERIC(12,2) GENERATED ALWAYS AS (actual_impact_usd - expected_impact_usd) STORED,
    
    agent_confidence_at_execution NUMERIC(4,3),
    confidence_error NUMERIC(4,3),
    
    measured_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. KERNEL GATEKEEPER RPC
CREATE OR REPLACE FUNCTION public.evaluate_governance_policy(p_proposal_id UUID)
RETURNS JSONB AS $$
DECLARE
    v_proposal RECORD;
    v_policy RECORD;
    v_impact_usd NUMERIC;
    v_total_daily_exposure NUMERIC;
    v_is_auto_approvable BOOLEAN := TRUE;
    v_rejection_reason TEXT := NULL;
    v_result_status TEXT := 'MANUAL_REVIEW_REQUIRED';
BEGIN
    SELECT * INTO v_proposal FROM public.proposals WHERE id = p_proposal_id;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Proposal not found'); END IF;

    SELECT * INTO v_policy FROM public.governance_policies 
    WHERE organization_id = v_proposal.organization_id AND action_type = v_proposal.proposal_type AND is_active = TRUE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', true, 'decision', 'MANUAL_REVIEW_REQUIRED', 'reason', 'No active governance policy found.');
    END IF;

    IF v_policy.circuit_breaker_triggered THEN
        RETURN jsonb_build_object('success', true, 'decision', 'REJECTED_BY_KERNEL', 'reason', 'Circuit Breaker Active: ' || COALESCE(v_policy.circuit_breaker_reason, 'Policy suspended.'));
    END IF;

    v_impact_usd := COALESCE((v_proposal.data->>'total_value_usd')::NUMERIC, 0);
    v_total_daily_exposure := v_policy.current_daily_usage_usd + v_impact_usd;

    IF v_total_daily_exposure > v_policy.max_daily_usd_exposure THEN
        v_is_auto_approvable := FALSE;
        v_rejection_reason := 'Daily exposure cap exceeded.';
    END IF;

    IF v_proposal.risk_financial > v_policy.max_risk_allowed THEN
        v_is_auto_approvable := FALSE;
        v_rejection_reason := COALESCE(v_rejection_reason || ' | ', '') || 'Risk threshold violation.';
    END IF;

    IF v_is_auto_approvable THEN v_result_status := 'AUTO_APPROVED'; ELSE v_result_status := 'MANUAL_REVIEW_REQUIRED'; END IF;

    RETURN jsonb_build_object('success', true, 'decision', v_result_status, 'policy_version', v_policy.version_id, 'reason', v_rejection_reason);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. SECURITY & POLICIES
ALTER TABLE public.governance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.economic_impact_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Owners can manage governance" ON public.governance_policies;
CREATE POLICY "Owners can manage governance" ON public.governance_policies FOR ALL
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'owner');

DROP POLICY IF EXISTS "Owners can view impact ledger" ON public.economic_impact_ledger;
CREATE POLICY "Owners can view impact ledger" ON public.economic_impact_ledger FOR SELECT
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'owner');
