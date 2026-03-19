-- Migration: 20260215_master_intelligence_events.sql
-- Purpose: Sensor layer for proactive AI reasoning

BEGIN;

-- 1. Intelligence Events Table
CREATE TABLE IF NOT EXISTS public.intelligence_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    branch_id UUID REFERENCES public.branches(id),
    
    event_type TEXT NOT NULL, -- 'LOW_STOCK', 'SURGE_DEMAND', 'UNUSUAL_WASTE', 'SPEED_DEVIATION'
    priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
    
    payload JSONB NOT NULL,
    processed_at TIMESTAMPTZ,
    agent_id UUID, -- If processed by a specific worker
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Trigger Function: Capture Intelligence Events
CREATE OR REPLACE FUNCTION public.fn_capture_intelligence_event()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
    v_event_type TEXT;
    v_priority TEXT := 'medium';
    v_payload JSONB;
BEGIN
    -- Determine Org ID
    IF TG_TABLE_NAME = 'branch_inventory' THEN
        SELECT organization_id INTO v_org_id FROM public.ingredients WHERE id = NEW.ingredient_id;
        IF NEW.current_stock < NEW.par_min THEN
            v_event_type := 'LOW_STOCK';
            v_priority := 'high';
            v_payload := jsonb_build_object(
                'ingredient_id', NEW.ingredient_id,
                'current_stock', NEW.current_stock,
                'par_min', NEW.par_min
            );
        END IF;
    ELSIF TG_TABLE_NAME = 'waste_logs' THEN
        SELECT organization_id INTO v_org_id FROM public.ingredients WHERE id = NEW.ingredient_id;
        v_event_type := 'WASTE_REPORTED';
        v_payload := jsonb_build_object(
            'ingredient_id', NEW.ingredient_id,
            'quantity', NEW.quantity,
            'reason', NEW.waste_reason
        );
    ELSIF TG_TABLE_NAME = 'orders' THEN
        v_org_id := NEW.organization_id;
        IF NEW.status = 'pending' AND NEW.total_amount > 5000 THEN
            v_event_type := 'HIGH_VALUE_ORDER';
            v_priority := 'medium';
            v_payload := jsonb_build_object('order_id', NEW.id, 'amount', NEW.total_amount);
        END IF;
    END IF;

    -- Only insert if we identified a relevant event
    IF v_event_type IS NOT NULL THEN
        INSERT INTO public.intelligence_events (
            organization_id,
            branch_id,
            event_type,
            priority,
            payload
        ) VALUES (
            v_org_id,
            NEW.branch_id,
            v_event_type,
            v_priority,
            v_payload
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Bind Triggers
DROP TRIGGER IF EXISTS trg_intel_inventory ON public.branch_inventory;
CREATE TRIGGER trg_intel_inventory
AFTER UPDATE OF current_stock ON public.branch_inventory
FOR EACH ROW EXECUTE FUNCTION public.fn_capture_intelligence_event();

DROP TRIGGER IF EXISTS trg_intel_waste ON public.waste_logs;
CREATE TRIGGER trg_intel_waste
AFTER INSERT ON public.waste_logs
FOR EACH ROW EXECUTE FUNCTION public.fn_capture_intelligence_event();

DROP TRIGGER IF EXISTS trg_intel_orders ON public.orders;
CREATE TRIGGER trg_intel_orders
AFTER INSERT ON public.orders
FOR EACH ROW EXECUTE FUNCTION public.fn_capture_intelligence_event();

-- 4. RLS
ALTER TABLE public.intelligence_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can view intelligence events"
ON public.intelligence_events FOR SELECT
USING (organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()));

COMMIT;
