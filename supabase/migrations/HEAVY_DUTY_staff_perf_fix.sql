-- HEAVY DUTY FIX: Staff Performance Signature Cleanup
-- This script drops all previous versions of the function to clear signature conflicts in Supabase.

-- 1. Drop old versions to prevent ambiguity
DROP FUNCTION IF EXISTS public.get_staff_performance_metrics(timestamp with time zone, timestamp with time zone);
DROP FUNCTION IF EXISTS public.get_staff_performance_metrics(timestamp with time zone, timestamp with time zone, uuid);

-- 2. Create the clean version with branch support
CREATE OR REPLACE FUNCTION get_staff_performance_metrics(
  start_date TIMESTAMP WITH TIME ZONE, 
  end_date TIMESTAMP WITH TIME ZONE,
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  staff_id UUID,
  staff_name TEXT,
  role TEXT,
  total_orders BIGINT,
  total_sales NUMERIC,
  shifts_count BIGINT,
  hours_worked NUMERIC,
  avg_order_value NUMERIC,
  orders_per_shift NUMERIC,
  sales_per_hour NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  WITH 
  -- Shift Stats per Staff
  shift_stats AS (
    SELECT 
      ss.staff_id,
      COUNT(ss.id) as shifts_count,
      SUM(EXTRACT(EPOCH FROM (COALESCE(ss.clock_out_time, now()) - ss.clock_in_time))/3600)::NUMERIC as hours_worked
    FROM staff_shifts ss
    WHERE ss.clock_in_time >= start_date 
      AND (ss.clock_out_time <= end_date OR ss.clock_out_time IS NULL)
      AND ss.status != 'cancelled'
      AND (p_branch_id IS NULL OR ss.branch_id = p_branch_id)
    GROUP BY ss.staff_id
  ),

  -- Sales/Orders Stats per Staff
  performance_stats AS (
    SELECT 
      p.id as st_id,
      p.full_name,
      p.role as st_role,
      
      -- Orders Count Logic
      CASE 
        WHEN p.role = 'waiter' THEN 
          (SELECT COUNT(*) FROM orders o WHERE o.waiter_id = p.id AND o.created_at BETWEEN start_date AND end_date AND o.status IN ('paid', 'closed', 'served') AND (p_branch_id IS NULL OR o.branch_id = p_branch_id))
        ELSE 
          (SELECT COUNT(DISTINCT o.id) 
           FROM orders o 
           JOIN staff_shifts s ON s.staff_id = p.id 
           WHERE o.created_at BETWEEN s.clock_in_time AND COALESCE(s.clock_out_time, now())
             AND o.created_at BETWEEN start_date AND end_date
             AND s.status != 'cancelled'
             AND o.status IN ('paid', 'closed', 'served')
             AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
             AND (p_branch_id IS NULL OR s.branch_id = p_branch_id))
      END as total_orders,

      -- Sales Logic
      CASE 
        WHEN p.role = 'waiter' THEN 
          (SELECT COALESCE(SUM(o.total_amount), 0) FROM orders o WHERE o.waiter_id = p.id AND o.created_at BETWEEN start_date AND end_date AND o.status IN ('paid', 'closed', 'served') AND (p_branch_id IS NULL OR o.branch_id = p_branch_id))
        ELSE 
          (SELECT COALESCE(SUM(o.total_amount), 0) 
           FROM orders o 
           JOIN staff_shifts s ON s.staff_id = p.id 
           WHERE o.created_at BETWEEN s.clock_in_time AND COALESCE(s.clock_out_time, now())
             AND o.created_at BETWEEN start_date AND end_date
             AND s.status != 'cancelled'
             AND o.status IN ('paid', 'closed', 'served')
             AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
             AND (p_branch_id IS NULL OR s.branch_id = p_branch_id))
      END as total_sales

    FROM profiles p
    WHERE p.role IN ('waiter', 'kitchen', 'manager', 'admin')
      AND (p_branch_id IS NULL OR p.home_branch_id = p_branch_id)
  )

  SELECT 
    ps.st_id as staff_id,
    ps.full_name as staff_name,
    ps.st_role as role,
    ps.total_orders,
    ps.total_sales,
    COALESCE(ss.shifts_count, 0) as shifts_count,
    ROUND(COALESCE(ss.hours_worked, 0), 2) as hours_worked,
    
    CASE 
      WHEN ps.total_orders > 0 THEN ROUND(ps.total_sales / ps.total_orders, 2)
      ELSE 0 
    END as avg_order_value,

    CASE 
      WHEN COALESCE(ss.shifts_count, 0) > 0 THEN ROUND(ps.total_orders::NUMERIC / ss.shifts_count, 1)
      ELSE 0
    END as orders_per_shift,

    CASE 
      WHEN COALESCE(ss.hours_worked, 0) > 0 THEN ROUND(ps.total_sales / ss.hours_worked, 2)
      ELSE 0
    END as sales_per_hour

  FROM performance_stats ps
  LEFT JOIN shift_stats ss ON ps.st_id = ss.staff_id;
END;
$$ LANGUAGE plpgsql;

-- 3. Force Cache Reload
NOTIFY pgrst, 'reload schema';
