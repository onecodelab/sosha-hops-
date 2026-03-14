-- Create chat_memory table for persistent conversations
CREATE TABLE IF NOT EXISTS public.chat_memory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.chat_memory ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own chat history"
    ON public.chat_memory FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own chat messages"
    ON public.chat_memory FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Create index for faster retrieval
CREATE INDEX IF NOT EXISTS idx_chat_memory_user_id ON public.chat_memory(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_memory_created_at ON public.chat_memory(created_at);

-- Grant access to service role for intelligence processing
GRANT ALL ON public.chat_memory TO service_role;
GRANT ALL ON public.chat_memory TO authenticated;
