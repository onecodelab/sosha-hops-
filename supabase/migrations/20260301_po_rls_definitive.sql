-- PURCHASE ORDER RLS DEFINITIVE REPAIR
-- This script reconciles the rigid "creator-only" policies with the multi-tenant organization model.

-- 1. Enable RLS on core tables
ALTER TABLE public.purchase_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.po_activity_log ENABLE ROW LEVEL SECURITY;

-- 2. Clean up old/broken policies
DROP POLICY IF EXISTS "Users can view own POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Owners and Admins can view all POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can create POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can update own POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Owners and Admins can update all POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Users can delete own POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Suppliers view own POs" ON public.purchase_orders;
DROP POLICY IF EXISTS "Suppliers update own PO status" ON public.purchase_orders;
DROP POLICY IF EXISTS "Tenant Isolation Select purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Tenant Isolation Insert purchase_orders" ON public.purchase_orders;
DROP POLICY IF EXISTS "Tenant Isolation Update purchase_orders" ON public.purchase_orders;

-- 3. NEW DEFINITIVE POLICIES: purchase_orders

-- Policy: Organization Visibility (Owners, Admins, Managers, Waiters, Kitchen)
-- Anyone in the same organization can view the POs
CREATE POLICY "Org-wide PO Visibility" ON public.purchase_orders
FOR SELECT USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- Policy: Supplier Visibility
-- Suppliers can see POs specifically assigned to their supplier_id
CREATE POLICY "Supplier PO Visibility" ON public.purchase_orders
FOR SELECT USING (
    auth.uid() IN (
        SELECT id FROM public.profiles 
        WHERE supplier_id = purchase_orders.supplier_id
    )
);

-- Policy: Creation Access
-- Only Owners, Admins, and Managers can create POs
CREATE POLICY "Staff Create POs" ON public.purchase_orders
FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('owner', 'admin', 'manager', 'super_admin')
        AND organization_id = purchase_orders.organization_id
    )
);

-- Policy: Management/Update Access
-- Staff can update POs in their own org
CREATE POLICY "Staff Update POs" ON public.purchase_orders
FOR UPDATE USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() 
        AND role IN ('owner', 'admin', 'manager', 'super_admin')
        AND organization_id = purchase_orders.organization_id
    )
);

-- Policy: Supplier Status Updates
-- Suppliers can update the status of POs assigned to them
CREATE POLICY "Supplier Update PO Status" ON public.purchase_orders
FOR UPDATE USING (
    auth.uid() IN (
        SELECT id FROM public.profiles 
        WHERE role = 'supplier'
        AND supplier_id = purchase_orders.supplier_id
    )
)
WITH CHECK (
    auth.uid() IN (
        SELECT id FROM public.profiles 
        WHERE role = 'supplier'
        AND supplier_id = purchase_orders.supplier_id
    )
);

-- 4. NEW DEFINITIVE POLICIES: purchase_order_items
DROP POLICY IF EXISTS "Access to PO items based on PO access" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Suppliers view PO items" ON public.purchase_order_items;
DROP POLICY IF EXISTS "Tenant Isolation Select purchase_order_items" ON public.purchase_order_items;

CREATE POLICY "Inherit PO Item Visibility" ON public.purchase_order_items
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.id = purchase_order_items.po_id
    )
);

CREATE POLICY "Staff Manage PO Items" ON public.purchase_order_items
FOR ALL USING (
    EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid()
        AND role IN ('owner', 'admin', 'manager', 'super_admin')
        AND organization_id = purchase_order_items.organization_id
    )
);

-- 5. NEW DEFINITIVE POLICIES: po_activity_log
DROP POLICY IF EXISTS "Tenant Isolation Select po_activity_log" ON public.po_activity_log;

CREATE POLICY "Activity Log Visibility" ON public.po_activity_log
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.purchase_orders po
        WHERE po.id = po_activity_log.po_id
    )
);

CREATE POLICY "Activity Log Insert" ON public.po_activity_log
FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
);

-- 6. Enum Expansion for Activity Log (v2)
ALTER TYPE public.po_action_type ADD VALUE IF NOT EXISTS 'updated';

NOTIFY pgrst, 'reload schema';
