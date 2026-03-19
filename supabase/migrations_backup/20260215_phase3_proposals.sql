-- Migration: Implementing Phase 3 (The Proposal Engine & Black Box Audit)
-- Date: 2026-02-15

-- 1. Proposals Table
-- This is where AI Agents or System Triggers "draft" actions for Owner approval.
CREATE TABLE IF NOT EXISTS public.proposals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    branch_id UUID REFERENCES public.branches(id),
    
    actor_type TEXT NOT NULL CHECK (actor_type IN ('agent', 'staff', 'system')),
    actor_id UUID NOT NULL, -- UUID of profile (if staff) or agent_id (if agent)
    
    proposal_type TEXT NOT NULL CHECK (proposal_type IN ('procurement', 'waste', 'schedule', 'policy_change', 'pricing')),
    
    data JSONB NOT NULL, -- The payload (e.g., PO snapshot, schedule shifts, or proposed price)
    
    confidence NUMERIC(4,3) CHECK (confidence >= 0 AND confidence <= 1), -- Agent confidence score
    impact_score NUMERIC(4,3) CHECK (impact_score >= 0 AND impact_score <= 1), -- Projected financial/UX impact
    
    reasoning TEXT, -- Natural language justification for the proposal
    
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'applied', 'withdrawn')),
    
    decided_by UUID REFERENCES public.profiles(id),
    decided_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Business Audit Logs (The "Black Box")
-- Records every significant state change in the business for total transparency.
CREATE TABLE IF NOT EXISTS public.business_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    branch_id UUID REFERENCES public.branches(id),
    
    event_type TEXT NOT NULL, -- e.g., 'PO_APPROVED', 'WASTE_REPORTED', 'PRICE_CHANGED'
    
    actor_id UUID REFERENCES public.profiles(id), -- Null if system/agent
    actor_name TEXT, -- 'ProcurementAgent', 'John Doe', etc.
    
    entity_type TEXT NOT NULL, -- e.g., 'purchase_order', 'ingredient', 'menu_item'
    entity_id UUID NOT NULL,
    
    old_state JSONB,
    new_state JSONB,
    
    metadata JSONB, -- Additional context (IP, Latency, Confidence, etc.)
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. RLS & Security
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.business_audit_logs ENABLE ROW LEVEL SECURITY;

-- Proposals: Viewable by Owner/Admin, manageable by Agents (Service Role handles Agents usually)
CREATE POLICY "Users can view proposals for their organization"
ON public.proposals FOR SELECT
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

CREATE POLICY "Owners can update (approve/reject) proposals"
ON public.proposals FOR UPDATE
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('owner', 'admin')
);

-- Audit Logs: Viewable only by Owner/Admin
CREATE POLICY "Owners can view audit logs"
ON public.business_audit_logs FOR SELECT
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) IN ('owner', 'admin')
);

-- 4. Indices for Performance
CREATE INDEX idx_proposals_org ON public.proposals(organization_id);
CREATE INDEX idx_proposals_status ON public.proposals(status);
CREATE INDEX idx_audit_org ON public.business_audit_logs(organization_id);
CREATE INDEX idx_audit_entity ON public.business_audit_logs(entity_type, entity_id);

-- 5. Trigger for updated_at on proposals
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE 'plpgsql';

CREATE TRIGGER update_proposals_modtime
BEFORE UPDATE ON public.proposals
FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
