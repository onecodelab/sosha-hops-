-- ============================================================
-- AGENT HARDENED SCHEMA
-- Customer Intelligence + Chatbot System Prompt
-- ============================================================

-- 1. Add chatbot_system_prompt to organizations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'organizations' AND column_name = 'chatbot_system_prompt'
    ) THEN
        ALTER TABLE public.organizations ADD COLUMN chatbot_system_prompt TEXT DEFAULT '';
    END IF;
END $$;

-- 2. Customer Profiles (Deep Personalization)
CREATE TABLE IF NOT EXISTS public.customer_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    full_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    email TEXT DEFAULT '',
    preferences JSONB DEFAULT '{}',
    visit_count INT DEFAULT 0,
    total_spent NUMERIC(12,2) DEFAULT 0,
    last_visit TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique per phone per org (a customer is unique per restaurant chain)
CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_profile_phone_org
ON public.customer_profiles (phone, organization_id)
WHERE phone <> '';

-- RLS
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Service role full access customer_profiles" ON public.customer_profiles;
    CREATE POLICY "Service role full access customer_profiles"
    ON public.customer_profiles
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

    -- Anon can read/write their own profile via session (enforced by Edge Function)
    DROP POLICY IF EXISTS "Anon manage customer_profiles" ON public.customer_profiles;
    CREATE POLICY "Anon manage customer_profiles"
    ON public.customer_profiles
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);
END $$;

-- 3. Customer Chats (Session-based history)
CREATE TABLE IF NOT EXISTS public.customer_chats (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL,
    customer_id UUID REFERENCES public.customer_profiles(id) ON DELETE SET NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    table_number TEXT,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_chats_session ON public.customer_chats (session_id, created_at);
CREATE INDEX IF NOT EXISTS idx_customer_chats_customer ON public.customer_chats (customer_id);

-- RLS
ALTER TABLE public.customer_chats ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Service role full access customer_chats" ON public.customer_chats;
    CREATE POLICY "Service role full access customer_chats"
    ON public.customer_chats
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

    DROP POLICY IF EXISTS "Anon manage customer_chats" ON public.customer_chats;
    CREATE POLICY "Anon manage customer_chats"
    ON public.customer_chats
    FOR ALL
    TO anon
    USING (true)
    WITH CHECK (true);
END $$;

-- 4. Trigger for updated_at on customer_profiles
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_customer_profiles_updated_at ON public.customer_profiles;
CREATE TRIGGER tr_customer_profiles_updated_at
BEFORE UPDATE ON public.customer_profiles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- Done
NOTIFY pgrst, 'reload schema';
