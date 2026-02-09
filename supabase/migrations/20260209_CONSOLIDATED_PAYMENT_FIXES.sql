-- 1. Create order_payments table (if missing)
CREATE TABLE IF NOT EXISTS order_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS for order_payments
ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;

-- Add policies for order_payments
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable read access for all users' AND tablename = 'order_payments') THEN
        CREATE POLICY "Enable read access for all users" ON order_payments FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable insert for authenticated users' AND tablename = 'order_payments') THEN
        CREATE POLICY "Enable insert for authenticated users" ON order_payments FOR INSERT WITH CHECK (auth.role() = 'authenticated');
    END IF;
END $$;

-- 2. Add unique constraint to prevent double-use of receipts
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_payment_reference 
ON order_payments (reference) 
WHERE reference IS NOT NULL;

-- 3. Create payment_audit table to track ALL verification attempts
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

-- Add policies for audit table
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable audit read for admins' AND tablename = 'payment_audit') THEN
        CREATE POLICY "Enable audit read for admins" ON payment_audit FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Enable audit insert for all' AND tablename = 'payment_audit') THEN
        CREATE POLICY "Enable audit insert for all" ON payment_audit FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_payments_order_id ON order_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_audit_reference ON payment_audit(reference);
