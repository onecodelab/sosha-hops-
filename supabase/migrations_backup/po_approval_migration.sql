-- Migration: PO Approval Workflow
-- Adds approval columns and audit trail for Purchase Orders

-- Step 1: Add new columns to purchase_orders
ALTER TABLE purchase_orders
  ADD COLUMN IF NOT EXISTS approval_notes TEXT,
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS risk_flags JSONB DEFAULT '[]'::jsonb;

-- Step 2: Create audit log table for PO activity
CREATE TABLE IF NOT EXISTS po_activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  po_id UUID NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN (
    'created', 'submitted', 'approved', 'rejected', 
    'revision_requested', 'sent', 'withdrawn', 'edited', 'received'
  )),
  performed_by UUID NOT NULL REFERENCES users(id),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Step 3: Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_po_activity_log_po_id ON po_activity_log(po_id);
CREATE INDEX IF NOT EXISTS idx_po_activity_log_performed_by ON po_activity_log(performed_by);

-- Step 4: Enable RLS
ALTER TABLE po_activity_log ENABLE ROW LEVEL SECURITY;

-- Step 5: RLS Policies
CREATE POLICY "Allow authenticated read access" ON po_activity_log
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow insert for authenticated" ON po_activity_log
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Note: Status values for purchase_orders are now:
-- 'draft', 'pending_approval', 'needs_revision', 'approved', 'sent', 'partial_received', 'received'
