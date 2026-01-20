-- FIX for Missing PO Status Enum Values
-- Run this in Supabase SQL Editor to fix "invalid input value" errors

ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'needs_revision';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE po_status ADD VALUE IF NOT EXISTS 'partial_received';

-- Verify the values are added
-- SELECT enum_range(NULL::po_status);
