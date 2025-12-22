import React, { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from './ui';
import { Database, Copy, Check, RefreshCw, Terminal, Code } from 'lucide-react';
import { SoshaLogo } from './SoshaLogo';

export const SetupGuide: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'sql' | 'function'>('sql');

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

-- 4. Create Menu Table
create table if not exists public.menu (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  category text not null,
  price numeric not null,
  image_url text,
  is_available boolean default true,
  restaurant_id uuid references public.restaurants(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  stock_quantity integer default 0
);

-- 5. Create Orders Table with Rich Tracking
create table if not exists public.orders (
  id uuid default uuid_generate_v4() primary key,
  order_number text,
  table_number text not null,
  status text not null default 'pending',
  source text check (source in ('dine_in', 'takeaway', 'delivery', 'chatbot')) default 'dine_in',
  payment_status text check (payment_status in ('unpaid', 'paid', 'split', 'failed')) default 'unpaid',
  -- Updated payment_method check constraint to include 'abyssinia'
  payment_method text check (payment_method in ('cash', 'cbe', 'abyssinia', 'telebirr', 'pos', 'chapa', 'none')),
  order_handler_name text,
  payment_handler_name text,
  created_by_role text check (created_by_role in ('waiter', 'manager', 'system')),
  total_amount numeric not null default 0,
  waiter_id uuid references public.users(id),
  restaurant_id uuid references public.restaurants(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  order_type text default 'dine-in',
  accepted_at timestamp with time zone,
  ready_at timestamp with time zone,
  served_at timestamp with time zone,
  paid_at timestamp with time zone,
  customer_notes text
);

-- 6. Create Order Items Table
create table if not exists public.order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  menu_item_id uuid references public.menu(id),
  quantity integer not null default 1,
  price numeric not null,
  special_instructions text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Create Staff Shifts Table
create table if not exists public.staff_shifts (
  id uuid default uuid_generate_v4() primary key,
  staff_id uuid references public.users(id) on delete cascade,
  clock_in timestamp with time zone default now(),
  clock_out timestamp with time zone,
  status text check (status in ('active', 'completed')) default 'active',
  created_at timestamp with time zone default now()
);

-- 8. Enable Row Level Security (RLS)
alter table public.users enable row level security;
alter table public.menu enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.restaurants enable row level security;
alter table public.staff_shifts enable row level security;

-- 9. Create Permissive Policies
create policy "Public access" on public.users for all using (true) with check (true);
create policy "Public access" on public.menu for all using (true) with check (true);
create policy "Public access" on public.orders for all using (true) with check (true);
create policy "Public access" on public.order_items for all using (true) with check (true);
create policy "Public access" on public.restaurants for all using (true) with check (true);
create policy "Public access" on public.staff_shifts for all using (true) with check (true);

-- 10. Smart Trigger for Linking Invites
create or replace function public.handle_new_user()
returns trigger as $$
declare
  existing_user_id uuid;
begin
  select id into existing_user_id from public.users where email = new.email limit 1;
  if existing_user_id is not null then
    update public.users set id = new.id, invitation_pending = false, created_at = now() where id = existing_user_id;
  else
    insert into public.users (id, email, full_name, role, created_at)
    values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', 'New User'), coalesce(new.raw_user_meta_data->>'role', 'waiter'), now());
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();
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
           <h1 className="text-4xl font-bold text-white tracking-tight">System Setup <span className="text-primary">Required</span></h1>
           <div className="space-y-4 text-gray-400">
             <p className="text-lg">Staff performance and operational tracking require updated schema. Please run the updated SQL script.</p>
             <div className="flex flex-col gap-4 pl-4 border-l-2 border-primary/30">
                <div className="flex gap-3">
                   <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                   <p>Run the SQL migration script in your Supabase SQL Editor.</p>
                </div>
                <div className="flex gap-3">
                   <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                   <p>Refresh the application to enable all features.</p>
                </div>
             </div>
           </div>
           <Button onClick={() => window.location.reload()} className="w-full h-12 text-base bg-white text-black hover:bg-gray-200 mt-4">
             <RefreshCw className="w-4 h-4 mr-2" /> Refresh App
           </Button>
        </div>
        <Card className="bg-[#111] border-gray-800 shadow-2xl h-[600px] flex flex-col overflow-hidden">
           <CardHeader className="bg-black/40 border-b border-gray-800 py-3 flex flex-row items-center justify-between">
              <Button size="sm" variant={activeTab === 'sql' ? 'primary' : 'ghost'} onClick={() => setActiveTab('sql')} className="text-xs h-8">
                 <Database className="w-3 h-3 mr-2" /> SQL Editor
              </Button>
              <Button size="sm" variant={copied ? 'secondary' : 'outline'} onClick={() => handleCopy(sqlCode)}>
                 {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                 {copied ? 'Copied' : 'Copy'}
              </Button>
           </CardHeader>
           <CardContent className="p-0 flex-1 overflow-hidden relative group">
              <textarea 
                readOnly 
                value={sqlCode} 
                className="w-full h-full bg-[#0A0A0A] text-gray-300 font-mono text-xs p-4 resize-none focus:outline-none custom-scrollbar" 
                spellCheck={false} 
              />
           </CardContent>
        </Card>
      </div>
    </div>
  );
};