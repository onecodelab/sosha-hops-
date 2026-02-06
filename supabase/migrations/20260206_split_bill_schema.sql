-- Create order_payments table to track partial payments
CREATE TABLE IF NOT EXISTS order_payments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  payment_method TEXT NOT NULL,
  reference TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE order_payments ENABLE ROW LEVEL SECURITY;

-- Add policies
-- Allow everyone to read payments (for bill verification)
CREATE POLICY "Enable read access for all users" ON order_payments FOR SELECT USING (true);

-- Allow authenticated users (waiters/admins) to record payments
CREATE POLICY "Enable insert for authenticated users" ON order_payments FOR INSERT WITH CHECK (auth.role() = 'authenticated');

-- Create an index for faster lookups by order
CREATE INDEX idx_order_payments_order_id ON order_payments(order_id);
