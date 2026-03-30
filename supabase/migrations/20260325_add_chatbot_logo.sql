-- Migration to add chatbot_logo_url to organizations
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'chatbot_logo_url'
    ) THEN 
        ALTER TABLE public.organizations ADD COLUMN chatbot_logo_url TEXT DEFAULT '';
    END IF; 
END $$;

-- Allow anyone to read table info (required for chatbot styling)
DROP POLICY IF EXISTS "Enable read access for all users" ON "public"."tables";
CREATE POLICY "Enable read access for all users" ON "public"."tables"
FOR SELECT USING (true);

