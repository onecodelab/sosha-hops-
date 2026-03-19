-- Add unique constraint to order_payments reference to prevent double-use
-- We use a partial index to allow multiple NULL references (for cash/manual entries)
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_payment_reference 
ON order_payments (reference) 
WHERE reference IS NOT NULL;

-- Create payment_audit table to track ALL verification attempts
CREATE TABLE IF NOT EXISTS payment_audit (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    reference TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    amount NUMERIC,
    status TEXT NOT NULL, -- 'success', 'failed_validation', 'fraud_attempt'
    details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for audit table
ALTER TABLE payment_audit ENABLE ROW LEVEL SECURITY;

-- Allow only admins to read audit logs
CREATE POLICY "Enable audit read for admins" 
ON payment_audit FOR SELECT 
USING (EXISTS (
    SELECT 1 FROM staff_profiles 
    WHERE id = auth.uid() AND role = 'admin'
));

-- Allow anyone to insert audit logs (triggered by the app)
CREATE POLICY "Enable audit insert for all" 
ON payment_audit FOR INSERT 
WITH CHECK (true);

-- Index for fraud checks
CREATE INDEX idx_payment_audit_reference ON payment_audit(reference);
