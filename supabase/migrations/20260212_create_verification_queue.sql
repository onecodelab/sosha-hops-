-- 1. Create Job Status Enum
CREATE TYPE public.job_status AS ENUM ('pending', 'processing', 'completed', 'failed', 'retrying');

-- 2. Create Verification Jobs Table
CREATE TABLE IF NOT EXISTS public.payment_verification_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    
    -- Request Data
    payment_method TEXT NOT NULL,
    reference TEXT NOT NULL,
    amount NUMERIC, 
    expected_amount NUMERIC, -- Explicitly what we expect
    additional_data JSONB DEFAULT '{}'::jsonb, -- Store phone, suffix, etc.
    
    -- Processing Data
    status public.job_status DEFAULT 'pending',
    worker_id TEXT, -- ID of the node processing this
    attempt_count INTEGER DEFAULT 0,
    last_error TEXT,
    result_data JSONB, -- The raw scraper result
    
    -- Constraints
    CONSTRAINT valid_payment_method CHECK (payment_method IN ('telebirr', 'cbe', 'dashen', 'abyssinia', 'cbebirr', 'image'))
);

-- 3. Indexes for Queue Performance
CREATE INDEX idx_jobs_status_created ON public.payment_verification_jobs(status, created_at) WHERE status = 'pending';
CREATE INDEX idx_jobs_org_ref ON public.payment_verification_jobs(organization_id, reference);

-- 4. Enable Realtime (Crucial for frontend updates)
ALTER PUBLICATION supabase_realtime ADD TABLE public.payment_verification_jobs;

-- 5. RLS Policies
ALTER TABLE public.payment_verification_jobs ENABLE ROW LEVEL SECURITY;

-- Allow Users to create jobs (frontend trigger)
CREATE POLICY "Users can create verification jobs" ON public.payment_verification_jobs
    FOR INSERT WITH CHECK (organization_id = public.current_org_id());

-- Allow Users to view their own organization's jobs
CREATE POLICY "Users can view verification jobs" ON public.payment_verification_jobs
    FOR SELECT USING (organization_id = public.current_org_id());

-- Allow Service Role (Workers) full access using a specific strategy? 
-- Usually workers run with service_role key, bypassing RLS. 
-- But if we wanted RLS for workers, we'd need a worker role.
-- Note: 'service_role' key always bypasses RLS.

-- 6. Trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON public.payment_verification_jobs
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();

-- 7. Worker Checkout RPC (Concurrency Safe)
CREATE OR REPLACE FUNCTION public.checkout_verification_job(worker_id_param TEXT)
RETURNS SETOF public.payment_verification_jobs AS $$
DECLARE
    row public.payment_verification_jobs%ROWTYPE;
BEGIN
    UPDATE public.payment_verification_jobs
    SET 
        status = 'processing',
        worker_id = worker_id_param,
        attempt_count = attempt_count + 1,
        updated_at = now()
    WHERE id = (
        SELECT id
        FROM public.payment_verification_jobs
        WHERE status = 'pending'
        ORDER BY created_at ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 1
    )
    RETURNING * INTO row;
    
    RETURN NEXT row;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8. Complete Job RPC
CREATE OR REPLACE FUNCTION public.complete_verification_job(job_id_param UUID, status_param public.job_status, result_param JSONB, error_param TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
    UPDATE public.payment_verification_jobs
    SET 
        status = status_param,
        result_data = result_param,
        last_error = error_param,
        updated_at = now()
    WHERE id = job_id_param;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
