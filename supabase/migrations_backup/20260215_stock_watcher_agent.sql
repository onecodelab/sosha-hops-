-- Migration: Implementing "Stock Watcher" Agent Trigger
-- Date: 2026-02-15

-- This trigger automatically generates a PROPOSAL when stock levels fall below par_min.
-- This is the "Brain" of the autonomous procurement system.

CREATE OR REPLACE FUNCTION public.handle_stock_proposal()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
    v_ingredient_name TEXT;
    v_unit_abbr TEXT;
    v_proposal_exists BOOLEAN;
BEGIN
    -- Only act if current_stock has fallen below par_min
    IF NEW.current_stock < NEW.par_min THEN
        
        -- Get relevant info
        SELECT organization_id, name INTO v_org_id, v_ingredient_name 
        FROM public.ingredients WHERE id = NEW.ingredient_id;
        
        SELECT u.abbreviation INTO v_unit_abbr
        FROM public.ingredients i
        JOIN public.units u ON i.unit_id = u.id
        WHERE i.id = NEW.ingredient_id;

        -- Check if a pending procurement proposal already exists for this ingredient at this branch
        SELECT EXISTS (
            SELECT 1 FROM public.proposals 
            WHERE branch_id = NEW.branch_id 
            AND proposal_type = 'procurement'
            AND status = 'pending'
            AND (data->>'ingredient_id')::UUID = NEW.ingredient_id
        ) INTO v_proposal_exists;

        -- If no pending proposal, create one
        IF NOT v_proposal_exists THEN
            INSERT INTO public.proposals (
                organization_id,
                branch_id,
                actor_type,
                actor_id,
                proposal_type,
                data,
                confidence,
                impact_score,
                -- Kernel Dimensions
                risk_operational,
                opt_resilience,
                risk_explanation,
                reasoning,
                status
            ) VALUES (
                v_org_id,
                NEW.branch_id,
                'agent',
                '00000000-0000-0000-0000-000000000001',
                'procurement',
                jsonb_build_object(
                    'ingredient_id', NEW.ingredient_id,
                    'suggested_quantity', (NEW.par_max - NEW.current_stock),
                    'current_stock', NEW.current_stock,
                    'par_min', NEW.par_min,
                    'par_max', NEW.par_max
                ),
                0.980,
                0.150,
                -- Decomposed Risk & Optimization
                0.010, -- Low operational risk to order replenishment
                0.950, -- High resilience benefit (preventing stockout)
                jsonb_build_array(
                    jsonb_build_object('factor', 'Stock Level', 'weight', 0.8, 'impact', 'Negative phase detected'),
                    jsonb_build_object('factor', 'Par Compliance', 'weight', 0.2, 'impact', 'Restoring buffer')
                ),
                'Critical stock levels detected for ' || v_ingredient_name || '. Current stock (' || NEW.current_stock || v_unit_abbr || ') is below par (' || NEW.par_min || v_unit_abbr || '). Autodesigning replenishment to reach par_max.',
                'pending'
            );
            
            -- Log the action to the Black Box
            INSERT INTO public.business_audit_logs (
                organization_id,
                branch_id,
                event_type,
                actor_name,
                entity_type,
                entity_id,
                new_state
            ) VALUES (
                v_org_id,
                NEW.branch_id,
                'STOCK_CRITICAL_ALERT',
                'StockWatcherAgent',
                'ingredient',
                NEW.ingredient_id,
                jsonb_build_object('current_stock', NEW.current_stock, 'par_min', NEW.par_min)
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the Trigger
DROP TRIGGER IF EXISTS trg_stock_watcher ON public.branch_inventory;
CREATE TRIGGER trg_stock_watcher
AFTER UPDATE OF current_stock ON public.branch_inventory
FOR EACH ROW
EXECUTE FUNCTION public.handle_stock_proposal();
