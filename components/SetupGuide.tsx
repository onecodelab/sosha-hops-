
import React, { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from './ui';
import { Database, Copy, Check, RefreshCw, Terminal } from 'lucide-react';
import { SoshaLogo } from './SoshaLogo';

export const SetupGuide: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const sqlCode = `-- 1. Enable UUID extension
create extension if not exists "uuid-ossp";

-- 2. Create Restaurants Table
create table if not exists public.restaurants (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 3. Create Users Table (Public Profile)
create table if not exists public.users (
  id uuid primary key,
  email text,
  full_name text,
  role text check (role in ('owner', 'admin', 'manager', 'waiter', 'kitchen', 'security')),
  restaurant_id uuid references public.restaurants(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  is_online boolean default false,
  shift_start timestamp with time zone,
  phone text,
  invitation_pending boolean default false,
  created_by uuid
);

-- 4. Create Staff Shifts Table (Ensuring staff_id exists)
create table if not exists public.staff_shifts (
  id uuid default uuid_generate_v4() primary key,
  staff_id uuid references public.users(id) on delete cascade,
  staff_name text,
  role text,
  clock_in_time timestamp with time zone default now(),
  clock_out_time timestamp with time zone,
  shift_duration_minutes integer,
  status text check (status in ('active', 'completed')) default 'active',
  created_at timestamp with time zone default now()
);

-- REPAIR SCRIPT (Run this if you get "column not found" errors)
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name='staff_shifts' and column_name='staff_id') then
    alter table public.staff_shifts add column staff_id uuid references public.users(id);
  end if;
end $$;

-- 5. Create Staff Actions Table
create table if not exists public.staff_actions (
  id uuid default uuid_generate_v4() primary key,
  staff_id uuid references public.users(id) on delete cascade,
  staff_name text,
  role text,
  action_type text not null,
  entity_type text,
  entity_id uuid,
  details jsonb,
  shift_id uuid references public.staff_shifts(id),
  created_at timestamp with time zone default now()
);

-- 6. Create Daily Performance Table
create table if not exists public.staff_performance_daily (
  id uuid default uuid_generate_v4() primary key,
  staff_id uuid references public.users(id) on delete cascade,
  staff_name text,
  role text,
  date date default current_date,
  revenue_attributed numeric default 0,
  cash_handled numeric default 0,
  orders_taken integer default 0,
  orders_served integer default 0,
  total_shift_minutes integer default 0,
  idle_time_minutes integer default 0,
  created_at timestamp with time zone default now(),
  unique(staff_id, date)
);

-- 7. Enable RLS
alter table public.staff_shifts enable row level security;
alter table public.staff_actions enable row level security;
alter table public.staff_performance_daily enable row level security;

-- 8. Create Permissive Policies
create policy "Public access shifts" on public.staff_shifts for all using (true) with check (true);
create policy "Public access actions" on public.staff_actions for all using (true) with check (true);
create policy "Public access performance" on public.staff_performance_daily for all using (true) with check (true);

-- 9. IMPORTANT: Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-foreground">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="space-y-6">
           <div className="w-20 h-20 mb-6">
              <SoshaLogo className="w-full h-full" />
           </div>
           <h1 className="text-4xl font-bold text-white tracking-tight">Fix Schema <span className="text-primary">Cache</span></h1>
           <div className="space-y-4 text-gray-400">
             <p className="text-lg">Your database is out of sync. Please run the repair script to ensure the <code className="text-primary">staff_id</code> column is recognized.</p>
             <div className="flex gap-3 items-center bg-white/5 p-3 rounded-xl border border-white/10">
                <Terminal className="w-5 h-5 text-primary" />
                <span className="text-xs font-mono">Includes NOTIFY pgrst reload command</span>
             </div>
           </div>
           <Button onClick={() => window.location.reload()} className="w-full h-12 text-base bg-white text-black hover:bg-gray-200 mt-4">
             <RefreshCw className="w-4 h-4 mr-2" /> Refresh App
           </Button>
        </div>
        <Card className="bg-[#111] border-gray-800 shadow-2xl h-[500px] flex flex-col overflow-hidden">
           <CardHeader className="bg-black/40 border-b border-gray-800 py-3 flex flex-row items-center justify-between">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-widest">SQL Repair Script</span>
              <Button size="sm" variant={copied ? 'secondary' : 'outline'} onClick={() => handleCopy(sqlCode)}>
                 {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                 {copied ? 'Copied' : 'Copy'}
              </Button>
           </CardHeader>
           <CardContent className="p-0 flex-1 overflow-hidden relative group">
              <textarea 
                readOnly 
                value={sqlCode} 
                className="w-full h-full bg-[#0A0A0A] text-gray-300 font-mono text-[10px] p-4 resize-none focus:outline-none custom-scrollbar" 
                spellCheck={false} 
              />
           </CardContent>
        </Card>
      </div>
    </div>
  );
};
