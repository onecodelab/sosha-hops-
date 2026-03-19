-- Migration: Seeding Default Governance Policies
-- Date: 2026-02-15

-- This script sets the INITIAL BOUNDARIES for the kernel. 
-- It transforms the system from "Advisory" to "Governed."

DO $$ 
DECLARE
    v_org_id UUID;
BEGIN
    -- Get the first organization as a default (for single-tenant or first-run setup)
    SELECT id INTO v_org_id FROM public.organizations LIMIT 1;

    IF v_org_id IS NOT NULL THEN
        
        -- 1. Procurement Policy (High Trust/High Exposure)
        INSERT INTO public.governance_policies (
            organization_id,
            action_type,
            auto_approve_threshold_usd,
            max_risk_allowed,
            min_confidence_required,
            max_daily_usd_exposure,
            max_weekly_usd_exposure,
            version_id
        ) VALUES (
            v_org_id,
            'procurement',
            500.00,  -- Auto-approve POs under $500 if risk is low
            0.050,   -- Max 5% risk for auto-approval
            0.980,   -- Requires 98% confidence
            2000.00, -- Max $2k per day total
            10000.00,-- Max $10k per week total
            'v1.0-default'
        ) ON CONFLICT DO NOTHING;

        -- 2. Waste Policy (Zero Autonomy - Always Review)
        INSERT INTO public.governance_policies (
            organization_id,
            action_type,
            auto_approve_threshold_usd,
            max_risk_allowed,
            min_confidence_required,
            max_daily_usd_exposure,
            max_weekly_usd_exposure,
            version_id
        ) VALUES (
            v_org_id,
            'waste',
            0.00,    -- Never auto-approve waste logs (always needs manual review/audit)
            0.010,   -- Very low risk ceiling
            0.990,   -- Extremely high confidence
            100.00,  -- Low exposure
            500.00,
            'v1.0-default'
        ) ON CONFLICT DO NOTHING;

    END IF;
END $$;
