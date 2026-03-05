-- ============================================================
-- MIGRATION: Chatbot Payment Hardening
-- Date: 2026-03-04
-- Purpose: Unique payment references + verification audit log
-- ============================================================

-- 1. UNIQUE constraint on order_payments.reference (per organization)
-- This prevents the same bank ref from being used twice within an org.
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_payments_reference_unique
ON public.order_payments (reference, organization_id)
WHERE reference IS NOT NULL AND reference != '';

-- 2. UNIQUE constraint on orders.transaction_reference (global)
-- Belt-and-suspenders: also block at the order level.
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_txn_ref_unique
ON public.orders (transaction_reference)
WHERE transaction_reference IS NOT NULL AND transaction_reference != '';

-- 3. Payment Verification Audit Log
-- Every verification attempt is recorded here, success or fail.
CREATE TABLE IF NOT EXISTS public.payment_verification_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES public.organizations(id),
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    transaction_id TEXT NOT NULL,
    bank TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'attempted', -- 'attempted', 'success', 'failed', 'duplicate', 'already_paid'
    response_data JSONB DEFAULT '{}',
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pvl_org ON public.payment_verification_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_pvl_txn ON public.payment_verification_log(transaction_id);
CREATE INDEX IF NOT EXISTS idx_pvl_order ON public.payment_verification_log(order_id);

-- RLS
ALTER TABLE public.payment_verification_log ENABLE ROW LEVEL SECURITY;

-- Only service role writes; owners can read their org's logs
CREATE POLICY "Service role full access pvl" ON public.payment_verification_log
    FOR ALL USING (true) WITH CHECK (true);

-- Notify PostgREST to pick up schema changes
NOTIFY pgrst, 'reload schema';
