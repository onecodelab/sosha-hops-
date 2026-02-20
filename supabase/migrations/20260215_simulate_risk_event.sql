-- Simulation: Demonstrating the Risk Engine & Governance Flow (FIXED)
-- Date: 2026-02-15

DO $$ 
DECLARE
    v_org_id UUID;
    v_branch_id UUID;
    v_ingredient_id UUID;
    v_proposal_id UUID;
    v_kernel_decision JSONB;
BEGIN
    -- 1. Setup Context (Joining with branches to get organization_id)
    SELECT b.organization_id, bi.branch_id, bi.ingredient_id 
    INTO v_org_id, v_branch_id, v_ingredient_id
    FROM public.branch_inventory bi
    JOIN public.branches b ON bi.branch_id = b.id
    LIMIT 1;

    IF v_org_id IS NULL THEN
        RAISE EXCEPTION 'No inventory context found. Please ensure organizations, branches, and inventory are set up.';
    END IF;

    -- 2. Log the "Anomalous Event" in the Black Box
    INSERT INTO public.business_audit_logs (
        organization_id, branch_id, event_type, actor_name, entity_type, entity_id, 
        old_state, new_state, metadata
    ) VALUES (
        v_org_id, v_branch_id, 'STOCK_ANOMALY_DETECTED', 'RiskEngineWatcher', 'ingredient', v_ingredient_id,
        jsonb_build_object('current_stock', 20), jsonb_build_object('current_stock', -50),
        jsonb_build_object('risk_factor', 'Sudden Negative Velocity', 'severity', 'CRITICAL')
    );

    -- 3. Optimization Engine proposes replenishment, but Risk Engine flags it
    INSERT INTO public.proposals (
        organization_id, branch_id, actor_type, actor_id, proposal_type, 
        data, confidence, impact_score, reasoning,
        -- Risk Matrix (Simulated High Risk)
        risk_financial, risk_fraud, risk_operational, risk_reputational,
        risk_explanation,
        -- Optimization Matrix
        opt_profit, opt_staff_fatigue, opt_customer_satisfaction, opt_resilience
    ) VALUES (
        v_org_id, v_branch_id, 'agent', '00000000-0000-0000-0000-000000000001', 'procurement',
        jsonb_build_object('total_value_usd', 1250.00, 'ingredient_id', v_ingredient_id, 'qty', 100),
        0.85, 0.20, 
        'Anomalous stock depletion detected. Replenishment logic triggered, but flagged for review due to suspicious negative inventory velocity (-70 units in 1 hour).',
        -- Risk: High Fraud & Financial
        0.650, 0.820, 0.300, 0.100,
        jsonb_build_array(
            jsonb_build_object('factor', 'Negative Velocity', 'weight', 0.9, 'impact', 'Possible theft/unrecorded waste'),
            jsonb_build_object('factor', 'Threshold Violation', 'weight', 0.1, 'impact', 'Total value exceeds $1,000')
        ),
        -- Opt
        0.100, 0.050, 0.900, 0.950
    ) RETURNING id INTO v_proposal_id;

    -- 4. Kernel Gatekeeper evaluates the Proposal
    SELECT public.evaluate_governance_policy(v_proposal_id) INTO v_kernel_decision;
    
    -- 5. Print out the decision to the console
    RAISE NOTICE '--- OPERATIONAL KERNEL DECISION ---';
    RAISE NOTICE 'Decision: %', v_kernel_decision->>'decision';
    RAISE NOTICE 'Reason: %', v_kernel_decision->>'reason';
    RAISE NOTICE '-----------------------------------';

END $$;
