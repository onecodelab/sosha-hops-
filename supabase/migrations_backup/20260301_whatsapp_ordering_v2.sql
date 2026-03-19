-- 1. Modify bank_settings to support multi-tenancy
-- Add organization_id if it doesn't exist
ALTER TABLE public.bank_settings ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

-- Backfill existing settings with the default organization
UPDATE public.bank_settings SET organization_id = '00000000-0000-0000-0000-000000000000' WHERE organization_id IS NULL;

-- Make organization_id NOT NULL for future entries
ALTER TABLE public.bank_settings ALTER COLUMN organization_id SET NOT NULL;

-- Update Unique constraint to be per-organization
ALTER TABLE public.bank_settings DROP CONSTRAINT IF EXISTS bank_settings_bank_key_key;
ALTER TABLE public.bank_settings ADD CONSTRAINT bank_settings_bank_key_org_unique UNIQUE (bank_key, organization_id);

-- Enable RLS for bank_settings (ensure it's on)
ALTER TABLE public.bank_settings ENABLE ROW LEVEL SECURITY;

-- Drop old global policy if it exists
DROP POLICY IF EXISTS "Enable read access for all users" ON public.bank_settings;
DROP POLICY IF EXISTS "Enable write access for admins" ON public.bank_settings;

-- New Tenant-Isolated Policies for bank_settings
CREATE POLICY "Tenant Isolation Select bank_settings" ON public.bank_settings
    FOR SELECT USING (organization_id = public.current_org_id());

CREATE POLICY "Tenant Isolation Insert bank_settings" ON public.bank_settings
    FOR INSERT WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY "Tenant Isolation Update bank_settings" ON public.bank_settings
    FOR UPDATE USING (organization_id = public.current_org_id());

CREATE POLICY "Tenant Isolation Delete bank_settings" ON public.bank_settings
    FOR DELETE USING (organization_id = public.current_org_id());


-- 2. Create payments table for verified WhatsApp/Chatbot transactions
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    branch_id UUID NOT NULL REFERENCES public.branches(id),
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL, 
    customer_phone TEXT NOT NULL,
    bank_key TEXT NOT NULL,
    reference TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    status TEXT DEFAULT 'verified', -- 'verified', 'linked', 'error'
    metadata JSONB, -- Store full bank response
    created_at TIMESTAMPTZ DEFAULT NOW(),
    source TEXT DEFAULT 'whatsapp'
);

-- Unique reference per organization to prevent re-use
CREATE UNIQUE INDEX IF NOT EXISTS idx_payments_reference_org 
ON public.payments (reference, organization_id);

CREATE INDEX IF NOT EXISTS idx_payments_org_branch ON public.payments(organization_id, branch_id);

-- Enable RLS for payments
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Tenant-Isolated Policies for payments
CREATE POLICY "Tenant Isolation Select payments" ON public.payments
    FOR SELECT USING (organization_id = public.current_org_id());

CREATE POLICY "Tenant Isolation Insert payments" ON public.payments
    FOR INSERT WITH CHECK (organization_id = public.current_org_id());

CREATE POLICY "Tenant Isolation Update payments" ON public.payments
    FOR UPDATE USING (organization_id = public.current_org_id());

CREATE POLICY "Tenant Isolation Delete payments" ON public.payments
    FOR DELETE USING (organization_id = public.current_org_id());

-- Standardize indices for performance
CREATE INDEX IF NOT EXISTS idx_bank_settings_org_id ON public.bank_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_payments_order_id ON public.payments(order_id);
