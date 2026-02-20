-- MIGRATION: 20260215_agent_deployment_rings.sql
-- PURPOSE: Infrastructure for safe Agent testing and rollout

BEGIN;

-- 1. Create Deployment Rings Table
CREATE TABLE IF NOT EXISTS public.agent_deployment_rings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    name TEXT NOT NULL, -- 'DEV', 'STAGING', 'PROD'
    risk_threshold_usd NUMERIC NOT NULL DEFAULT 50, -- Max risk for auto-approval in this ring
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(organization_id, name)
);

-- 2. Add Ring ID to critical Agent/Governance tables
-- (Note: We will use this in Phase 3/4 when we build the Proposals engine)
ALTER TABLE public.restock_requests 
ADD COLUMN IF NOT EXISTS deployment_ring_id UUID REFERENCES public.agent_deployment_rings(id);

-- 3. Seed Default Rings for existing organizations
INSERT INTO public.agent_deployment_rings (organization_id, name, risk_threshold_usd)
SELECT id, 'PROD', 100 FROM public.organizations
ON CONFLICT DO NOTHING;

INSERT INTO public.agent_deployment_rings (organization_id, name, risk_threshold_usd)
SELECT id, 'STAGING', 500 FROM public.organizations
ON CONFLICT DO NOTHING;

INSERT INTO public.agent_deployment_rings (organization_id, name, risk_threshold_usd)
SELECT id, 'DEV', 999999 FROM public.organizations
ON CONFLICT DO NOTHING;

-- 4. Enable RLS
ALTER TABLE public.agent_deployment_rings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Rings are viewable by org" 
ON public.agent_deployment_rings FOR SELECT 
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

COMMIT;
