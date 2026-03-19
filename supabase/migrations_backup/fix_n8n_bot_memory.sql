-- ============================================================
-- FIX: n8n Bot Memory & Conversation Logger
-- ============================================================

-- 1. Create bot_memory table for session tracking
CREATE TABLE IF NOT EXISTS public.bot_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id TEXT NOT NULL,
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    telegram_id TEXT,
    messages JSONB DEFAULT '[]', -- Stores the conversation logic
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique session per org (usually session_id is the Telegram chat_id)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bot_memory_session_org 
ON public.bot_memory (session_id, organization_id);

-- 2. ENABLE RLS
ALTER TABLE public.bot_memory ENABLE ROW LEVEL SECURITY;

-- 3. UNBLOCK n8n (ANON)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Allow anon manage bot_memory" ON public.bot_memory;
    CREATE POLICY "Allow anon manage bot_memory" 
    ON public.bot_memory 
    FOR ALL 
    TO anon
    USING (true)
    WITH CHECK (true);
END $$;

-- 4. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS tr_update_bot_memory_updated_at ON public.bot_memory;
CREATE TRIGGER tr_update_bot_memory_updated_at
BEFORE UPDATE ON public.bot_memory
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- 5. Diagnostic: Check if we have any memory entries
SELECT count(*) as memory_count FROM public.bot_memory;
