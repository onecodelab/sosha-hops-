-- FORCE CLEAR STUCK TABLES (Fixed Order)
-- 1. Unlink orders from tables FIRST (Fixes FK violation)
UPDATE public.tables 
SET 
    status = 'available',
    current_order_id = NULL,
    current_session_id = NULL;

-- 2. Close sessions
UPDATE public.table_sessions
SET is_active = false, closed_at = NOW()
WHERE is_active = true;

-- 3. NOW it is safe to delete the broken orders
DELETE FROM public.orders 
WHERE status NOT IN ('closed', 'cancelled') 
AND created_at < NOW() - INTERVAL '1 hour';

NOTIFY pgrst, 'reload schema';
