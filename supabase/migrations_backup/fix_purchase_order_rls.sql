-- Fix Purchase Order RLS Policies

-- Enable RLS
ALTER TABLE purchase_orders ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts (and ensure we have a clean slate)
DROP POLICY IF EXISTS "Users can view own POs" ON purchase_orders;
DROP POLICY IF EXISTS "Owners and Admins can view all POs" ON purchase_orders;
DROP POLICY IF EXISTS "Users can create POs" ON purchase_orders;
DROP POLICY IF EXISTS "Users can update own POs" ON purchase_orders;
DROP POLICY IF EXISTS "Owners and Admins can update all POs" ON purchase_orders;

-- 1. VIEW Policies
-- Manager/Staff can view their own POs
CREATE POLICY "Users can view own POs" ON purchase_orders
  FOR SELECT USING (auth.uid() = created_by);

-- Owners and Admins can view ALL POs
CREATE POLICY "Owners and Admins can view all POs" ON purchase_orders
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('owner', 'admin')
    )
  );

-- 2. INSERT Policies
-- Authenticated users can create POs (assigning themselves as creator)
CREATE POLICY "Users can create POs" ON purchase_orders
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- 3. UPDATE Policies
-- Creators can update their own POs (e.g., drafts)
CREATE POLICY "Users can update own POs" ON purchase_orders
  FOR UPDATE USING (auth.uid() = created_by);

-- Owners/Admins can update ANY PO (approvals, badging, etc.)
CREATE POLICY "Owners and Admins can update all POs" ON purchase_orders
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.role IN ('owner', 'admin')
    )
  );

-- 4. DELETE Policies
-- Creators can delete their own POs (e.g. drafts)
CREATE POLICY "Users can delete own POs" ON purchase_orders
  FOR DELETE USING (auth.uid() = created_by);

-- Ensure purchase_order_items inherits access (usually handled by cascade or public, but let's be safe if RLS is on items)
-- Assuming purchase_order_items RLS is usually OFF or standard. 
-- Just in case, let's enable it and add similar policies if it's not already.
ALTER TABLE purchase_order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Access to PO items based on PO access" ON purchase_order_items;

CREATE POLICY "Access to PO items based on PO access" ON purchase_order_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM purchase_orders po
      WHERE po.id = purchase_order_items.po_id
      -- If the user can see the PO, they can see the items (Postgres doesn't automatically recurse RLS, so we need to check PO access explicitly or duplicate logic)
      AND (
        po.created_by = auth.uid() 
        OR 
        EXISTS (SELECT 1 FROM users WHERE users.id = auth.uid() AND users.role IN ('owner', 'admin'))
      )
    )
  );
