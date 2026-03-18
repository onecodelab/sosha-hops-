-- Add verification_token to tables for NFC Tap Verification
ALTER TABLE tables
ADD COLUMN verification_token UUID DEFAULT gen_random_uuid() UNIQUE;

-- We don't want to break existing rows, so we assign a default UUID.
-- The UNIQUE constraint ensures no two tables have the same NFC link.
