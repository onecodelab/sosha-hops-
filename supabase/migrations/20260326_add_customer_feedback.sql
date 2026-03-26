-- Create customer feedback table
CREATE TABLE IF NOT EXISTS public.customer_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
    organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
    branch_id UUID REFERENCES public.branches(id) ON DELETE CASCADE,
    table_id UUID REFERENCES public.tables(id) ON DELETE SET NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    customer_name TEXT
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_feedback_org ON public.customer_feedback(organization_id);
CREATE INDEX IF NOT EXISTS idx_feedback_branch ON public.customer_feedback(branch_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON public.customer_feedback(created_at);

-- RLS Policies
ALTER TABLE public.customer_feedback ENABLE ROW LEVEL SECURITY;

-- 1. Anyone can insert feedback (public access)
CREATE POLICY "Enable public insert for customer feedback" ON public.customer_feedback
    FOR INSERT WITH CHECK (true);

-- 2. Staff/Admins can view feedback for their organization
CREATE POLICY "Enable view for organization staff" ON public.customer_feedback
    FOR SELECT USING (
        organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid()) OR
        auth.jwt() ->> 'email' LIKE '%@baro.com'
    );
