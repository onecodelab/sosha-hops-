-- 1. Create Staff Shifts Table
CREATE TABLE IF NOT EXISTS public.staff_shifts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    staff_name TEXT,
    role TEXT,
    clock_in_time TIMESTAMP WITH TIME ZONE DEFAULT now(),
    clock_out_time TIMESTAMP WITH TIME ZONE,
    shift_duration_minutes INTEGER,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Create Staff Actions Table (for Accountability Log)
CREATE TABLE IF NOT EXISTS public.staff_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    staff_name TEXT,
    role TEXT,
    action_type TEXT,
    entity_type TEXT,
    entity_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Create Tips Ledger Table
CREATE TABLE IF NOT EXISTS public.tips_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    staff_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    amount NUMERIC DEFAULT 0,
    tip_type TEXT CHECK (tip_type IN ('cash', 'digital')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_staff_shifts_id ON staff_shifts(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_shifts_status ON staff_shifts(status);
CREATE INDEX IF NOT EXISTS idx_staff_actions_id ON staff_actions(staff_id);
CREATE INDEX IF NOT EXISTS idx_tips_ledger_staff ON tips_ledger(staff_id);

-- Simple RLS (Allow all for now to unblock, recommend tightening later)
ALTER TABLE public.staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tips_ledger ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
    CREATE POLICY "Allow all access to staff_shifts" ON public.staff_shifts FOR ALL USING (true);
    CREATE POLICY "Allow all access to staff_actions" ON public.staff_actions FOR ALL USING (true);
    CREATE POLICY "Allow all access to tips_ledger" ON public.tips_ledger FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
