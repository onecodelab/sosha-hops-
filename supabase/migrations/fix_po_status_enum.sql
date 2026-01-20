-- EMERGENCY FIX: Missing PO Status Enum Values
-- Run this in Supabase SQL Editor to fix "invalid input value" errors

-- 1. Ensure all new statuses exist in the enum
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'pending_approval';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'needs_revision';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'partial_received';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'verified';

-- 2. Verify statuses
-- SELECT enum_range(NULL::po_status);
