-- Migration: Data Hardening for Operational State Machine (OSM)
-- Date: 2026-02-15

-- 1. Create Machine-Readable Enums
DO $$ BEGIN
    CREATE TYPE public.waste_category_enum AS ENUM (
        'SPOILED',      -- Physical decay/expiry
        'BURNT',       -- Preparation error
        'DROPPED',     -- Physical accident
        'EXPIRED',     -- Shelf-life reached
        'OVER_PROD',   -- Demand forecasting error
        'THEFT_SUSP',  -- Suspected shrinkage
        'OTHER'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.void_reason_enum AS ENUM (
        'CUSTOMER_ERR',  -- Customer changed mind
        'STAFF_ERR',     -- Wrong order entered
        'OUT_OF_STOCK',  -- Ingredient unavailable
        'TEST_ORDER',    -- Developer/Manager testing
        'COMPLIMENTARY', -- Management decided free item
        'FRAUD_SUSP'     -- Potential security issue
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Harden Waste Logs
ALTER TABLE public.waste_logs 
    RENAME COLUMN waste_reason TO raw_waste_reason;

ALTER TABLE public.waste_logs 
    ADD COLUMN waste_category public.waste_category_enum DEFAULT 'OTHER';

-- Update existing data if possible (mapping)
UPDATE public.waste_logs 
SET waste_category = CASE 
    WHEN lower(raw_waste_reason) = 'spoiled' THEN 'SPOILED'::public.waste_category_enum
    WHEN lower(raw_waste_reason) = 'burnt' THEN 'BURNT'::public.waste_category_enum
    WHEN lower(raw_waste_reason) = 'dropped' THEN 'DROPPED'::public.waste_category_enum
    WHEN lower(raw_waste_reason) = 'expired' THEN 'EXPIRED'::public.waste_category_enum
    WHEN lower(raw_waste_reason) = 'overproduction' THEN 'OVER_PROD'::public.waste_category_enum
    ELSE 'OTHER'::public.waste_category_enum
END;

-- 3. Harden Proposals with Simulation Metadata
ALTER TABLE public.proposals
    ADD COLUMN simulation_data JSONB DEFAULT '{}',
    ADD COLUMN policy_context TEXT,
    ADD COLUMN risk_score NUMERIC(4,3) DEFAULT 0.000;

-- 4. Governance Policies Table
CREATE TABLE IF NOT EXISTS public.governance_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    
    action_type TEXT NOT NULL, -- e.g., 'procurement', 'void', 'discount'
    auto_approve_threshold_usd NUMERIC(10,2) DEFAULT 0.0,
    max_risk_allowed NUMERIC(4,3) DEFAULT 0.05,
    min_confidence_required NUMERIC(4,3) DEFAULT 0.95,
    
    is_active BOOLEAN DEFAULT TRUE,
    version_id TEXT NOT NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.governance_policies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can manage governance"
ON public.governance_policies FOR ALL
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'owner');
