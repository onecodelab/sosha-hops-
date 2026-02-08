-- BARO PO RECEIVING: RLS HARDENING
-- Allows Managers to update POs they created to 'verified' status upon receipt.

-- 1. Update Purchase Orders Policies
DROP POLICY IF EXISTS "Managers can update own POs" ON public.purchase_orders;

CREATE POLICY "Managers can update own POs" ON public.purchase_orders
  FOR UPDATE USING (
    auth.uid() = created_by 
    AND (
      status IN ('draft', 'needs_revision') -- For editing
      OR 
      status IN ('sent', 'approved') -- For receiving/verified
    )
  );

-- 2. Ensure GRN tables are accessible to Managers+
-- (Checking existence and applying policies if needed)
DO $$ 
BEGIN
    -- Goods Received Notes
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'goods_received_notes') THEN
        ALTER TABLE public.goods_received_notes ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Managers can manage GRNs" ON public.goods_received_notes;
        CREATE POLICY "Managers can manage GRNs" ON public.goods_received_notes
            FOR ALL USING (public.get_user_role() IN ('owner', 'admin', 'manager'));
    END IF;

    -- GRN Items
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'grn_items') THEN
        ALTER TABLE public.grn_items ENABLE ROW LEVEL SECURITY;
        DROP POLICY IF EXISTS "Managers can manage GRN items" ON public.grn_items;
        CREATE POLICY "Managers can manage GRN items" ON public.grn_items
            FOR ALL USING (public.get_user_role() IN ('owner', 'admin', 'manager'));
    END IF;
END $$;
