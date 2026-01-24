-- FORCE CLEAR STUCK TABLES & ORDERS
-- This wipes out the "ghost" orders that are locking your tables
-- and resets all tables to "available" so you can use them again.

-- 1. Delete the specific broken order (and any others in weird states)
DELETE FROM public.orders 
WHERE status NOT IN ('closed', 'cancelled') 
AND created_at < NOW() - INTERVAL '1 hour'; -- Safety: only delete old stuck orders

-- 2. Reset ALL tables to available
-- This forces every table to be free, removing locks
UPDATE public.tables 
SET 
    status = 'available',
    current_order_id = NULL,
    current_session_id = NULL;

-- 3. Close any dangling sessions
UPDATE public.table_sessions
SET is_active = false, closed_at = NOW()
WHERE is_active = true;

NOTIFY pgrst, 'reload schema';
