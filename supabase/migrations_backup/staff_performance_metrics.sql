-- 1. Create Staff Shifts Table
CREATE TABLE IF NOT EXISTS public.staff_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    staff_name TEXT,
    role TEXT,
    clock_in_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
    clock_out_time TIMESTAMP WITH TIME ZONE,
    shift_duration_minutes INTEGER,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create Staff Actions Table (for Accountability Log)
CREATE TABLE IF NOT EXISTS public.staff_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    staff_name TEXT,
    role TEXT,
    action_type TEXT,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Create Tips Ledger Table
CREATE TABLE IF NOT EXISTS public.tips_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    amount NUMERIC DEFAULT 0,
    tip_type TEXT CHECK (tip_type IN ('cash', 'digital')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_staff_shifts_id ON staff_shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_branch ON staff_shifts(branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_status ON staff_shifts(status);
CREATE INDEX IF NOT EXISTS idx_staff_actions_id ON staff_actions(staff_id);
CREATE INDEX IF NOT EXISTS idx_tips_ledger_staff ON tips_ledger(staff_id);

-- Simple RLS
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tips_ledger ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to staff_shifts') THEN
        CREATE POLICY "Allow all access to staff_shifts" ON public.staff_shifts FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to staff_actions') THEN
        CREATE POLICY "Allow all access to staff_actions" ON public.staff_actions FOR ALL USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all access to tips_ledger') THEN
        CREATE POLICY "Allow all access to tips_ledger" ON public.tips_ledger FOR ALL USING (true);
    END IF;
END $$;

-- 4. Function to calculate comprehensive staff performance metrics
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
