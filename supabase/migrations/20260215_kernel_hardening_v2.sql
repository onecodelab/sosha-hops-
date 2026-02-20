-- Migration: Kernel Substrate Hardening (Phase 1)
-- Date: 2026-02-15

-- 1. Enhance Proposals with Explainable Decomposed Risk & Multi-Objective Opt
ALTER TABLE public.proposals
    -- Risk Decomposition (The Guardian Dimensions)
    ADD COLUMN risk_financial NUMERIC(4,3) DEFAULT 0.000,
    ADD COLUMN risk_fraud NUMERIC(4,3) DEFAULT 0.000,
    ADD COLUMN risk_operational NUMERIC(4,3) DEFAULT 0.000,
    ADD COLUMN risk_reputational NUMERIC(4,3) DEFAULT 0.000,
    ADD COLUMN risk_explanation JSONB DEFAULT '[]', -- Feature importance logs for explainability
    
    -- Multi-Objective Optimization (The Strategist Dimensions)
    ADD COLUMN opt_profit NUMERIC(4,3) DEFAULT 0.000,
    ADD COLUMN opt_staff_fatigue NUMERIC(4,3) DEFAULT 0.000,
    ADD COLUMN opt_customer_satisfaction NUMERIC(4,3) DEFAULT 0.000,
    ADD COLUMN opt_resilience NUMERIC(4,3) DEFAULT 0.000,
    
    -- Simulation & Stress Test
    ADD COLUMN stress_test_results JSONB DEFAULT '{}',
    ADD COLUMN backtest_period_days INTEGER DEFAULT 30;

-- 2. Create Economic Impact Ledger (The "Truth" Layer)
CREATE TABLE IF NOT EXISTS public.economic_impact_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    proposal_id UUID NOT NULL REFERENCES public.proposals(id),
    
    expected_impact_usd NUMERIC(12,2) NOT NULL,
    actual_impact_usd NUMERIC(12,2),
    variance_usd NUMERIC(12,2) GENERATED ALWAYS AS (actual_impact_usd - expected_impact_usd) STORED,
    
    agent_confidence_at_execution NUMERIC(4,3),
    confidence_error NUMERIC(4,3), -- Measured after actual impact is known
    
    measured_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enhance Governance Policies with Deterministic Caps & Circuit Breakers
ALTER TABLE public.governance_policies
    ADD COLUMN max_daily_usd_exposure NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN max_weekly_usd_exposure NUMERIC(12,2) DEFAULT 0.00,
    ADD COLUMN current_daily_usage_usd NUMERIC(12,2) DEFAULT 0.00,
    
    -- Failure Containment (Circuit Breakers)
    ADD COLUMN consecutive_negative_variance_limit INTEGER DEFAULT 3,
    ADD COLUMN current_consecutive_negative_variance INTEGER DEFAULT 0,
    ADD COLUMN circuit_breaker_triggered BOOLEAN DEFAULT FALSE,
    ADD COLUMN circuit_breaker_reason TEXT;

-- 4. RLS for Impact Ledger
ALTER TABLE public.economic_impact_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view impact ledger"
ON public.economic_impact_ledger FOR SELECT
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'owner');

-- 5. Helper Function to Reset Daily Usage (Deterministic Boundary Enforcement)
-- This would typically be called by a cron job (pg_cron)
CREATE OR REPLACE FUNCTION public.reset_daily_governance_usage()
RETURNS void AS $$
BEGIN
    UPDATE public.governance_policies SET current_daily_usage_usd = 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
