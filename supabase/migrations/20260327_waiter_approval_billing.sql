-- 20260327_waiter_approval_billing.sql
-- Refined Credit Logic: Bill 20 credits only when a chatbot order is accepted by a waiter

-- 1. Add billed_for_credits column to prevent duplicate charging
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS billed_for_credits BOOLEAN DEFAULT false;

-- 2. Trigger Function for Billing
CREATE OR REPLACE FUNCTION public.fn_bill_chatbot_order()
RETURNS TRIGGER AS $$
BEGIN
    -- Only trigger when status moves from pending to accepted
    -- AND the source is recorded as 'chatbot'
    -- AND we havent billed this order yet
    IF (NEW.status = 'accepted' AND OLD.status = 'pending') 
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
                'note', 'Billed at waiter approval stage'
            )
        );
        
        -- C. Mark as billed to prevent double-charging if status is toggled
        NEW.billed_for_credits := true;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Create Trigger
DROP TRIGGER IF EXISTS trig_bill_chatbot_order ON public.orders;
CREATE TRIGGER trig_bill_chatbot_order
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_bill_chatbot_order();

COMMENT ON COLUMN public.orders.billed_for_credits IS 'Tracks if the 20-credit chatbot success fee has been deducted for this order.';
