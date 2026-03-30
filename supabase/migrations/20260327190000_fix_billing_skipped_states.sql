-- Fix: Safely bill chatbot orders if the waiter skips "accepted" and marks as "served", "paid", or "closed" directly.
BEGIN;

CREATE OR REPLACE FUNCTION public.fn_bill_chatbot_order()
RETURNS TRIGGER AS $$
BEGIN
    -- Trigger when status moves from pending to ANY positive terminal/progressed state
    IF (NEW.status IN ('accepted', 'served', 'paid', 'closed') AND OLD.status = 'pending') 
       AND (NEW.source = 'chatbot') 
       AND (NEW.billed_for_credits = false) THEN
        
        -- A. Deduct 20 credits from the organization
        PERFORM public.increment_org_credits(NEW.organization_id, 20);
        
        -- B. Log the usage for auditing
        INSERT INTO public.credit_usage_logs (
            organization_id,
            amount,
            action_type,
            metadata
        ) VALUES (
            NEW.organization_id,
            20,
            'chatbot_order_accepted',
            jsonb_build_object(
                'order_id', NEW.id,
                'table_id', NEW.table_id,
                'source', NEW.source,
                'note', 'Billed at waiter approval/completion stage'
            )
        );
        
        -- C. Mark as billed to prevent double-charging if status is toggled
        NEW.billed_for_credits := true;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
