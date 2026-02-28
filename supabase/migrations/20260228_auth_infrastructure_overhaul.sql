-- ============================================================
-- Baro Restaurant OS — Auth Infrastructure Overhaul
-- Run this ENTIRE file in Supabase SQL Editor
-- ============================================================

-- 0a. Add status column to profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending' 
CHECK (status IN ('pending', 'active', 'suspended'));

-- Set existing real users to active so nothing breaks
-- Only activate users who have a REAL org (not 000...000),
-- OR roles that legitimately live in the default org (super_admin, supplier, driver)
UPDATE public.profiles SET status = 'active' 
WHERE role IS NOT NULL AND organization_id IS NOT NULL
  AND (
    organization_id != '00000000-0000-0000-0000-000000000000'
    OR role IN ('super_admin', 'supplier', 'driver')
  );

-- 0b. Add supplier_user_id to purchase_orders
ALTER TABLE public.purchase_orders
ADD COLUMN IF NOT EXISTS supplier_user_id UUID REFERENCES auth.users(id);

-- 0c. Create onboarding_applications table
CREATE TABLE IF NOT EXISTS public.onboarding_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  role TEXT NOT NULL CHECK (role IN ('owner', 'supplier', 'driver')),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT NOT NULL,
  -- Owner fields
  restaurant_name TEXT,
  restaurant_type TEXT,
  city TEXT,
  branch_count INTEGER,
  -- Supplier fields
  company_name TEXT,
  supply_category TEXT,
  cities_covered TEXT,
  -- Driver fields
  vehicle_type TEXT,
  status TEXT NOT NULL DEFAULT 'pending' 
    CHECK (status IN ('pending', 'approved', 'rejected'))
);

-- Public can insert (anyone can apply), only super_admin can read/update
ALTER TABLE public.onboarding_applications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can apply" ON public.onboarding_applications
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Super admin can read all" ON public.onboarding_applications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

CREATE POLICY "Super admin can update" ON public.onboarding_applications
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'super_admin'
    )
  );

-- 0d. Fix initialize_new_branch() trigger
CREATE OR REPLACE FUNCTION public.initialize_new_branch()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.branch_inventory (branch_id, ingredient_id, current_stock, par_min, par_max)
    SELECT NEW.id, id, 0, 0, 100 FROM public.ingredients
    WHERE organization_id = NEW.organization_id
    ON CONFLICT (branch_id, ingredient_id) DO NOTHING;

    INSERT INTO public.tables (branch_id, organization_id, table_number, zone, status, capacity_min, capacity_max)
    VALUES 
        (NEW.id, NEW.organization_id, '1', 'indoor', 'available', 2, 4),
        (NEW.id, NEW.organization_id, '2', 'indoor', 'available', 2, 4),
        (NEW.id, NEW.organization_id, '3', 'indoor', 'available', 2, 4),
        (NEW.id, NEW.organization_id, '4', 'indoor', 'available', 4, 6),
        (NEW.id, NEW.organization_id, '5', 'indoor', 'available', 4, 10)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 0e. Enable RLS on tables and branches
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenant Isolation Select tables" ON public.tables;
CREATE POLICY "Tenant Isolation Select tables" ON public.tables
    FOR SELECT USING (organization_id = public.current_org_id());

DROP POLICY IF EXISTS "Tenant Isolation Insert tables" ON public.tables;
CREATE POLICY "Tenant Isolation Insert tables" ON public.tables
    FOR INSERT WITH CHECK (organization_id = public.current_org_id());

DROP POLICY IF EXISTS "Tenant Isolation Update tables" ON public.tables;
CREATE POLICY "Tenant Isolation Update tables" ON public.tables
    FOR UPDATE USING (organization_id = public.current_org_id());

DROP POLICY IF EXISTS "Tenant Isolation Delete tables" ON public.tables;
CREATE POLICY "Tenant Isolation Delete tables" ON public.tables
    FOR DELETE USING (organization_id = public.current_org_id());

DROP POLICY IF EXISTS "Tenant Isolation Select branches" ON public.branches;
CREATE POLICY "Tenant Isolation Select branches" ON public.branches
    FOR SELECT USING (organization_id = public.current_org_id());

DROP POLICY IF EXISTS "Tenant Isolation Insert branches" ON public.branches;
CREATE POLICY "Tenant Isolation Insert branches" ON public.branches
    FOR INSERT WITH CHECK (organization_id = public.current_org_id());

DROP POLICY IF EXISTS "Tenant Isolation Update branches" ON public.branches;
CREATE POLICY "Tenant Isolation Update branches" ON public.branches
    FOR UPDATE USING (organization_id = public.current_org_id());

-- 0f. Add supplier RLS to purchase_orders
DROP POLICY IF EXISTS "Supplier can view own POs" ON public.purchase_orders;
CREATE POLICY "Supplier can view own POs" ON public.purchase_orders
    FOR SELECT USING (supplier_user_id = auth.uid());

DROP POLICY IF EXISTS "Supplier can update own PO status" ON public.purchase_orders;
CREATE POLICY "Supplier can update own PO status" ON public.purchase_orders
    FOR UPDATE USING (supplier_user_id = auth.uid());

-- 0g. Fix nooncafe user
UPDATE auth.users 
SET raw_app_meta_data = raw_app_meta_data || 
    jsonb_build_object('organization_id', '1f91fb49-30df-4171-a4e6-c311a788efa3')
WHERE email = 'nooncafe@gmail.com';

DO $$
DECLARE
    v_org UUID := '1f91fb49-30df-4171-a4e6-c311a788efa3';
    v_uid UUID := '268c46ec-6503-483d-9acf-96d69129c1fa';
    v_bid UUID;
BEGIN
    UPDATE public.profiles SET organization_id = v_org, status = 'active' WHERE id = v_uid;
    IF NOT EXISTS (SELECT 1 FROM public.branches WHERE organization_id = v_org) THEN
        INSERT INTO public.branches (name, organization_id, is_active)
        VALUES ('Main Branch', v_org, true) RETURNING id INTO v_bid;
        UPDATE public.profiles SET home_branch_id = v_bid WHERE id = v_uid;
    END IF;
END $$;

-- 0h. Fix get_staff_performance_metrics RPC (from architecture audit)
CREATE OR REPLACE FUNCTION get_staff_performance_metrics(
  start_date TIMESTAMP WITH TIME ZONE, 
  end_date TIMESTAMP WITH TIME ZONE,
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  staff_id UUID, staff_name TEXT, role TEXT,
  total_orders BIGINT, total_sales NUMERIC,
  shifts_count BIGINT, hours_worked NUMERIC,
  avg_order_value NUMERIC, orders_per_shift NUMERIC,
  sales_per_hour NUMERIC
) AS $$
DECLARE v_org_id UUID;
BEGIN
    v_org_id := public.current_org_id();
    RETURN QUERY
    WITH 
    shift_stats AS (
      SELECT ss.staff_id, COUNT(ss.id) as shifts_count,
        SUM(EXTRACT(EPOCH FROM (COALESCE(ss.clock_out_time, now()) - ss.clock_in_time))/3600)::NUMERIC as hours_worked
      FROM staff_shifts ss
      WHERE ss.organization_id = v_org_id
        AND ss.clock_in_time >= start_date
        AND (ss.clock_out_time <= end_date OR ss.clock_out_time IS NULL)
        AND ss.status != 'cancelled'
        AND (p_branch_id IS NULL OR ss.branch_id = p_branch_id)
      GROUP BY ss.staff_id
    ),
    performance_stats AS (
      SELECT p.id as st_id, p.full_name, p.role as st_role,
        CASE WHEN p.role = 'waiter' THEN
          (SELECT COUNT(*) FROM orders o WHERE o.organization_id = v_org_id
             AND o.waiter_id = p.id AND o.created_at BETWEEN start_date AND end_date
             AND o.status IN ('paid','closed','served')
             AND (p_branch_id IS NULL OR o.branch_id = p_branch_id))
        ELSE
          (SELECT COUNT(DISTINCT o.id) FROM orders o JOIN staff_shifts s ON s.staff_id = p.id
             WHERE o.organization_id = v_org_id
             AND o.created_at BETWEEN s.clock_in_time AND COALESCE(s.clock_out_time, now())
             AND o.created_at BETWEEN start_date AND end_date
             AND s.status != 'cancelled' AND o.status IN ('paid','closed','served')
             AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
             AND (p_branch_id IS NULL OR s.branch_id = p_branch_id))
        END as total_orders,
        CASE WHEN p.role = 'waiter' THEN
          (SELECT COALESCE(SUM(o.total_amount),0) FROM orders o WHERE o.organization_id = v_org_id
             AND o.waiter_id = p.id AND o.created_at BETWEEN start_date AND end_date
             AND o.status IN ('paid','closed','served')
             AND (p_branch_id IS NULL OR o.branch_id = p_branch_id))
        ELSE
          (SELECT COALESCE(SUM(o.total_amount),0) FROM orders o JOIN staff_shifts s ON s.staff_id = p.id
             WHERE o.organization_id = v_org_id
             AND o.created_at BETWEEN s.clock_in_time AND COALESCE(s.clock_out_time, now())
             AND o.created_at BETWEEN start_date AND end_date
             AND s.status != 'cancelled' AND o.status IN ('paid','closed','served')
             AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
             AND (p_branch_id IS NULL OR s.branch_id = p_branch_id))
        END as total_sales
      FROM profiles p
      WHERE p.organization_id = v_org_id
        AND p.role IN ('waiter','kitchen','manager','admin')
        AND (p_branch_id IS NULL OR p.home_branch_id = p_branch_id)
    )
    SELECT ps.st_id, ps.full_name, ps.st_role, ps.total_orders, ps.total_sales,
      COALESCE(ss.shifts_count,0), ROUND(COALESCE(ss.hours_worked,0),2),
      CASE WHEN ps.total_orders > 0 THEN ROUND(ps.total_sales/ps.total_orders,2) ELSE 0 END,
      CASE WHEN COALESCE(ss.shifts_count,0) > 0 THEN ROUND(ps.total_orders::NUMERIC/ss.shifts_count,1) ELSE 0 END,
      CASE WHEN COALESCE(ss.hours_worked,0) > 0 THEN ROUND(ps.total_sales/ss.hours_worked,2) ELSE 0 END
    FROM performance_stats ps LEFT JOIN shift_stats ss ON ps.st_id = ss.staff_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 0i. Reload schema
NOTIFY pgrst, 'reload schema';
