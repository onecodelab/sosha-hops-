-- Simulation: Demonstrating Pace-Based Demand Logic
-- Date: 2026-02-15

-- This script finds your MOST IMPORTANT ingredient (Common Denominator) 
-- and shows how the Agent proposes an order based on Menu PACE.

DO $$ 
DECLARE
    v_org_id UUID;
    v_branch_id UUID;
    v_target_ingredient_id UUID;
    v_ingredient_name TEXT;
    v_menu_count INTEGER;
    v_proposal_id UUID;
BEGIN
    -- 1. Identify the "Best Ingredient" (Highest Recipe Dependency)
    SELECT 
        ri.ingredient_id, i.name, COUNT(DISTINCT ri.recipe_id) 
    INTO 
        v_target_ingredient_id, v_ingredient_name, v_menu_count
    FROM public.recipe_ingredients ri
    JOIN public.ingredients i ON ri.ingredient_id = i.id
    GROUP BY ri.ingredient_id, i.name
    ORDER BY COUNT(DISTINCT ri.recipe_id) DESC
    LIMIT 1;

    -- 2. get branch context
    SELECT b.organization_id, b.id INTO v_org_id, v_branch_id
    FROM public.branches b LIMIT 1;

    IF v_target_ingredient_id IS NULL THEN
        RAISE NOTICE 'No recipe mapping found. Using placeholder logic.';
        RETURN;
    END IF;

    -- 3. Simulate "High Pace" Event in the Black Box
    INSERT INTO public.business_audit_logs (
        organization_id, branch_id, event_type, actor_name, entity_type, entity_id, 
        metadata
    ) VALUES (
        v_org_id, v_branch_id, 'DEMAND_PACE_ACCELERATION', 'InsightEngine', 'inventory', v_target_ingredient_id,
        jsonb_build_object(
            'event', 'High Velocity Spike',
            'menu_impact_count', v_menu_count,
            'velocity_multiplier', 2.5,
            'reason', 'Dinner rush + Event nearby'
        )
    );

    -- 4. Optimization Engine proposes "Predictive Replenishment"
    INSERT INTO public.proposals (
        organization_id, branch_id, actor_type, actor_id, proposal_type, 
        data, confidence, impact_score, reasoning,
        -- Risk Matrix (Low Risk, High Alpha)
        risk_financial, risk_fraud, risk_operational, risk_reputational,
        risk_explanation,
        -- Optimization Matrix
        opt_profit, opt_staff_fatigue, opt_customer_satisfaction, opt_resilience
    ) VALUES (
        v_org_id, v_branch_id, 'agent', '00000000-0000-0000-0000-000000000001', 'procurement',
        jsonb_build_object(
            'ingredient_id', v_target_ingredient_id,
            'order_qty', 100,
            'predictive_exhaustion_time', '4 hours',
            'current_pace_consumption', '12 units/hr',
            'base_pace_consumption', '3 units/hr'
        ),
        0.985, 0.450, 
        'High Pace spike detected across ' || v_menu_count || ' menu items using ' || v_ingredient_name || '. At current flow (12 units/hr), stock will hit zero in 4 hours. Proposing immediate replenishment to maintain menu availability and capture revenue spike.',
        -- Risk: Low
        0.050, 0.010, 0.020, 0.005,
        jsonb_build_array(
            jsonb_build_object('factor', 'Velocity Correlation', 'weight', 0.95, 'impact', 'Confirmed by sales pace'),
            jsonb_build_object('factor', 'Financial Exposure', 'weight', 0.05, 'impact', 'Within budget boundaries')
        ),
        -- Opt: High Resilience & Customer Satisfaction
        0.400, 0.100, 0.950, 0.990
    ) RETURNING id INTO v_proposal_id;

    RAISE NOTICE '--- PACE SIMULATION CREATED ---';
    RAISE NOTICE 'Target: %', v_ingredient_name;
    RAISE NOTICE 'Menu Dependency Count: %', v_menu_count;
    RAISE NOTICE 'Proposal ID: %', v_proposal_id;
    RAISE NOTICE '-------------------------------';

END $$;
