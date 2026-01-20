-- SOSHA PO SYSTEM HARDENING: Schema & Workflow
-- 1. Redirect foreign keys from the non-existent 'users' table to public.profiles

-- Drop constraints if they exist (to handle potential partial migrations)
ALTER TABLE IF EXISTS public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_approved_by_fkey;
ALTER TABLE IF EXISTS public.purchase_orders DROP CONSTRAINT IF EXISTS purchase_orders_created_by_fkey;
ALTER TABLE IF EXISTS public.po_activity_log DROP CONSTRAINT IF EXISTS po_activity_log_performed_by_fkey;

-- Apply correct foreign keys to public.profiles
ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_created_by_fkey 
  FOREIGN KEY (created_by) REFERENCES public.profiles(id);

ALTER TABLE public.purchase_orders
  ADD CONSTRAINT purchase_orders_approved_by_fkey 
  FOREIGN KEY (approved_by) REFERENCES public.profiles(id);

ALTER TABLE public.po_activity_log
  ADD CONSTRAINT po_activity_log_performed_by_fkey 
  FOREIGN KEY (performed_by) REFERENCES public.profiles(id);

-- 2. Standardize workflow statuses (Ensure 'pending_approval' exists)
-- If status is a text column with a check constraint, we need to update it.
-- If it's an enum, we've already done most in fix_po_status_enum.sql, but let's ensure 'pending_approval' is standard.

DO $$ 
BEGIN
    -- Check if 'po_status' enum exists and add 'pending_approval'
    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'po_status') THEN
        ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'pending_approval';
    END IF;
END $$;

-- 3. Standardize RLS policies to use public.profiles and public.get_user_role()
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Owners and Admins can view all POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can create POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can update own POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Owners and Admins can update all POs" ON public.purchase_orders;

-- VIEW: Everyone can see POs they are involved in or if they are Managers+
CREATE POLICY "Staff can view relevant POs" ON public.purchase_orders
  FOR SELECT USING (
    auth.uid() = created_by 
    OR public.get_user_role() IN ('owner', 'admin', 'manager')
  );

-- INSERT: Managers+ can create POs
CREATE POLICY "Managers can create POs" ON public.purchase_orders
  FOR INSERT WITH CHECK (
    public.get_user_role() IN ('owner', 'admin', 'manager')
  );

-- UPDATE: Owners/Admins (Full control), Managers (Creators, for drafts/revisions)
CREATE POLICY "Owners and Admins can update all POs" ON public.purchase_orders
  FOR UPDATE USING (
    public.get_user_role() IN ('owner', 'admin')
  );

CREATE POLICY "Managers can update own POs" ON public.purchase_orders
  FOR UPDATE USING (
    auth.uid() = created_by AND status IN ('draft', 'needs_revision')
  );

-- PO Activity Log Policies
DROP POLICY IF EXISTS "Allow authenticated read access" ON public.po_activity_log;
DROP POLICY IF EXISTS "Allow insert for authenticated" ON public.po_activity_log;

CREATE POLICY "Relevant staff can read activity" ON public.po_activity_log
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Relevant staff can insert activity" ON public.po_activity_log
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
