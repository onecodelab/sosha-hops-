-- Create bank_settings table
CREATE TABLE IF NOT EXISTS bank_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bank_key TEXT UNIQUE NOT NULL, -- e.g., 'cbe', 'telebirr', 'abyssinia', 'dashen', 'cbebirr'
    account_number TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE bank_settings ENABLE ROW LEVEL SECURITY;

-- Create policies (Allow all authenticated users to read, but only admins to write)
CREATE POLICY "Enable read access for all users" ON bank_settings
    FOR SELECT USING (true);

CREATE POLICY "Enable write access for admins" ON bank_settings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM profiles
            WHERE profiles.id = auth.uid()
            AND (profiles.role = 'admin' OR profiles.role = 'owner')
        )
    );

-- Seed initial data
INSERT INTO bank_settings (bank_key, account_number) VALUES 
('cbe', '1000302293007'),
('abyssinia', '16408'),
('telebirr', ''),
('dashen', ''),
('cbebirr', '')
ON CONFLICT (bank_key) DO UPDATE SET 
account_number = EXCLUDED.account_number,
updated_at = NOW();
