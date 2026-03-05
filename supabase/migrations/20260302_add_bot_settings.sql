-- Create bot_settings table
CREATE TABLE IF NOT EXISTS bot_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) UNIQUE,
  bot_name TEXT NOT NULL DEFAULT 'Selam',
  tone TEXT NOT NULL DEFAULT 'friendly and casual',
  default_language TEXT NOT NULL DEFAULT 'auto',
  system_prompt TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE bot_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for tenant isolation
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'bot_settings' 
        AND policyname = 'Tenant Isolation bot_settings'
    ) THEN
        CREATE POLICY "Tenant Isolation bot_settings" ON bot_settings
          FOR ALL USING (organization_id = public.current_org_id());
    END IF;
END $$;

-- Add updated_at trigger helper if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_bot_settings_updated_at ON bot_settings;
CREATE TRIGGER update_bot_settings_updated_at
BEFORE UPDATE ON bot_settings
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
