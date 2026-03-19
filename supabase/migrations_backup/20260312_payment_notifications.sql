-- Migration: Payment Notifications from Public Portal
-- Description: Allows guests to submit transaction references for verification.

CREATE TABLE IF NOT EXISTS public.payment_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    transaction_ref TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- pending, verified, rejected
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    organization_id UUID NOT NULL
);

-- Enable RLS
ALTER TABLE public.payment_notifications ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (guests sending notifications)
CREATE POLICY "Public anonymous insert notifications" ON public.payment_notifications
FOR INSERT WITH CHECK (true);

-- Allow organization members to view notifications
CREATE POLICY "Org members view notifications" ON public.payment_notifications
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.organization_id = payment_notifications.organization_id
    )
);

NOTIFY pgrst, 'reload schema';
