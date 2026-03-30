-- Add chatbot credit tracking to organizations
ALTER TABLE public.organizations 
ADD COLUMN IF NOT EXISTS max_monthly_credits INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS used_monthly_credits INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS credit_reset_date TIMESTAMPTZ DEFAULT (now() + interval '30 days');

-- Index for performance checks
CREATE INDEX IF NOT EXISTS idx_org_credits ON public.organizations(used_monthly_credits, max_monthly_credits);

-- Optional: Create a log table for transparency
CREATE TABLE IF NOT EXISTS public.credit_usage_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    amount INTEGER DEFAULT 1,
    action_type TEXT, -- e.g. 'chat_message', 'tool_call'
    metadata JSONB
);

CREATE INDEX IF NOT EXISTS idx_credit_logs_org ON public.credit_usage_logs(organization_id, created_at);

ALTER TABLE public.credit_usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable view for org staff" ON public.credit_usage_logs
    FOR SELECT USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    );

-- RPC for atomic credit increment
CREATE OR REPLACE FUNCTION public.increment_org_credits(org_id UUID, amount INTEGER DEFAULT 1)
RETURNS VOID AS $$
BEGIN
    UPDATE public.organizations
    SET used_monthly_credits = COALESCE(used_monthly_credits, 0) + amount
    WHERE id = org_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

