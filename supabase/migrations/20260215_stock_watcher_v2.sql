-- Migration: Upgrading Stock Watcher to Pace-Aware (Urgency Engine)
-- Date: 2026-02-15

CREATE OR REPLACE FUNCTION public.handle_stock_proposal_v2()
RETURNS TRIGGER AS $$
DECLARE
    v_org_id UUID;
    v_ingredient_name TEXT;
    v_unit_abbr TEXT;
    v_lead_time_hours INTEGER;
    v_avg_daily_usage NUMERIC;
    v_hourly_velocity NUMERIC;
    v_tte_hours NUMERIC;
    v_proposal_exists BOOLEAN;
    v_urgency_score NUMERIC;
    v_impact_narrative TEXT;
BEGIN
    -- 1. Get ingredient metadata and usage stats
    SELECT 
        i.organization_id, 
        i.name, 
        i.lead_time_hours,
        u.abbreviation,
        -- Calculate avg daily usage from last 14 days (reusing logic from intel view)
        COALESCE((
            SELECT SUM(oi.quantity * ri.quantity_needed * public.get_unit_conversion_factor(i2.unit_type, ri.unit_type, i2.weight_per_unit))
            FROM public.order_items oi
            JOIN public.orders o ON oi.order_id = o.id
            JOIN public.recipes r ON oi.menu_item_id = r.menu_item_id
            JOIN public.recipe_ingredients ri ON r.id = ri.recipe_id
            JOIN public.ingredients i2 ON ri.ingredient_id = i2.id
            WHERE ri.ingredient_id = NEW.ingredient_id
              AND o.status IN ('paid', 'closed', 'served') 
              AND o.created_at >= (now() - interval '14 days')
        ), 0) / 14.0 as daily_usage
    INTO 
        v_org_id, v_ingredient_name, v_lead_time_hours, v_unit_abbr, v_avg_daily_usage
    FROM public.ingredients i
    JOIN public.units u ON i.unit_id = u.id
    WHERE i.id = NEW.ingredient_id;

    -- 2. Calculate TTE (Time to Exhaustion)
    v_hourly_velocity := v_avg_daily_usage / 24.0;
    
    IF v_hourly_velocity > 0 THEN
        v_tte_hours := NEW.current_stock / v_hourly_velocity;
    ELSE
        v_tte_hours := 999; -- Infinite stock if no usage
    END IF;

    -- 3. Determine Urgency (Decision Logic)
    -- Trigger if stock is below par_min OR if TTE is less than lead_time_hours (Predictive Gap)
    IF NEW.current_stock < NEW.par_min OR v_tte_hours < (v_lead_time_hours + 4) THEN -- +4hr safety buffer
        
        -- Check for existing pending proposal
        SELECT EXISTS (
            SELECT 1 FROM public.proposals 
            WHERE branch_id = NEW.branch_id 
            AND proposal_type = 'procurement'
            AND status = 'pending'
            AND (data->>'ingredient_id')::UUID = NEW.ingredient_id
        ) INTO v_proposal_exists;

        IF NOT v_proposal_exists THEN
            
            -- Calculate Urgency Score (0 to 1)
            -- 1.0 = Out of stock or TTE < Lead Time
            -- 0.5 = TTE is 2x Lead Time
            v_urgency_score := CASE 
                WHEN NEW.current_stock <= 0 THEN 1.0
                WHEN v_tte_hours <= v_lead_time_hours THEN 1.0
                ELSE LEAST(1.0, (v_lead_time_hours * 1.5) / NULLIF(v_tte_hours, 0))
            END;

            v_impact_narrative := CASE 
                WHEN v_tte_hours <= v_lead_time_hours THEN 'Stockout imminent before delivery arrival (' || ROUND(v_tte_hours, 1) || 'h left vs ' || v_lead_time_hours || 'h lead).'
                WHEN NEW.current_stock < NEW.par_min THEN 'Below static par level.'
                ELSE 'Predictive depletion detected based on sales pace.'
            END;

            INSERT INTO public.proposals (
                organization_id, branch_id, actor_type, actor_id, proposal_type, 
                data, confidence, impact_score, status,
                -- Kernel Dimensions
                risk_operational, risk_financial, opt_resilience, opt_customer_satisfaction,
                risk_explanation, reasoning
            ) VALUES (
                v_org_id, NEW.branch_id, 'agent', '00000000-0000-0000-0000-000000000001', 'procurement',
                jsonb_build_object(
                    'ingredient_id', NEW.ingredient_id,
                    'suggested_quantity', (NEW.par_max - NEW.current_stock),
                    'tte_hours', ROUND(v_tte_hours, 1),
                    'lead_time_hours', v_lead_time_hours,
                    'avg_daily_usage', ROUND(v_avg_daily_usage, 2),
                    'urgency_score', ROUND(v_urgency_score, 2)
                ),
                0.985, v_urgency_score, 'pending',
                -- Logic: High urgency = High operational risk if not acted (negative impact)
                0.010, 0.050, 0.990, 0.950,
                jsonb_build_array(
                    jsonb_build_object('factor', 'Pace Correlation', 'weight', 0.8, 'impact', v_impact_narrative),
                    jsonb_build_object('factor', 'Lead Time Gap', 'weight', 0.2, 'impact', 'Delivery window is ' || v_lead_time_hours || 'h')
                ),
                'Predictive replenishment for ' || v_ingredient_name || '. ' || v_impact_narrative
            );

            -- Log to Black Box
            INSERT INTO public.business_audit_logs (
                organization_id, branch_id, event_type, actor_name, entity_type, entity_id, new_state
            ) VALUES (
                v_org_id, NEW.branch_id, 'PREDICTIVE_STOCK_ALERT', 'UrgencyEngineAgent', 'ingredient', 
                NEW.ingredient_id, jsonb_build_object('tte_hours', v_tte_hours, 'lead_time', v_lead_time_hours)
            );

        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Re-attach Trigger
DROP TRIGGER IF EXISTS trg_stock_watcher ON public.branch_inventory;
CREATE TRIGGER trg_stock_watcher
AFTER UPDATE OF current_stock ON public.branch_inventory
FOR EACH ROW
EXECUTE FUNCTION public.handle_stock_proposal_v2();
