-- Migration: Isolate Bank Settings by Organization
-- Description: Adds organization_id to bank_settings and updates unique constraints to support multi-tenancy.

-- 1. Add organization_id column
ALTER TABLE bank_settings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;

-- 2. Drop the existing global unique constraint on bank_key
-- We need to find the name of the constraint first. In the previous migration it was implicit.
-- Usually it's 'bank_settings_bank_key_key'
ALTER TABLE bank_settings DROP CONSTRAINT IF EXISTS bank_settings_bank_key_key;

-- 3. Create a new composite unique constraint
ALTER TABLE bank_settings ADD CONSTRAINT bank_settings_org_bank_key_unique UNIQUE (organization_id, bank_key);

-- 4. Update RLS policies
DROP POLICY IF EXISTS "Enable read access for all users" ON bank_settings;
DROP POLICY IF EXISTS "Enable write access for admins" ON bank_settings;

CREATE POLICY "Enable read access for organization members" ON bank_settings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.organization_id = bank_settings.organization_id
        )
    );

CREATE POLICY "Enable write access for organization admins" ON bank_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND profiles.organization_id = bank_settings.organization_id
            AND (profiles.role = 'admin' OR profiles.role = 'owner')
        )
    );

-- 5. Handle existing data (optional but good practice)
-- If there are any global bank settings, we might want to assign them to a default organization 
-- or leave them with NULL organization_id if that's allowed (though we want isolation).
-- For this system, we'll assume we start fresh or owners will re-add their settings.
