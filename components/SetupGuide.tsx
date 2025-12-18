
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

-- 3. Create Users Table
create table if not exists public.users (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  role text check (role in ('owner', 'admin', 'manager', 'waiter', 'kitchen')),
  restaurant_id uuid references public.restaurants(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
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
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Create Orders Table
create table if not exists public.orders (
  id uuid default uuid_generate_v4() primary key,
  table_no text not null,
  status text not null default 'pending',
  total_amount numeric not null default 0,
  payment_method text,
  paid_at timestamp with time zone,
  verified_by uuid references public.users(id),
  restaurant_id uuid references public.restaurants(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Create Order Items Table
create table if not exists public.order_items (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id) on delete cascade not null,
  menu_item_id uuid references public.menu(id),
  quantity integer not null default 1,
  price_at_time numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. Create Inventory Tables
create table if not exists public.ingredients (
  id uuid default uuid_generate_v4() primary key,
  sku text unique not null,
  name text not null,
  category text,
  unit_type text not null,
  current_stock numeric default 0,
  par_min numeric default 10,
  cost_per_unit numeric default 0,
  supplier_id uuid,
  is_active boolean default true,
  created_at timestamp with time zone default now()
);

create table if not exists public.tables (
  id uuid default uuid_generate_v4() primary key,
  table_number text not null,
  capacity integer default 4,
  x_position numeric default 0,
  y_position numeric default 0,
  shape text check (shape in ('square', 'round', 'rectangle')) default 'square',
  status text default 'available',
  created_at timestamp with time zone default now()
);

-- 8. Enable Row Level Security (RLS)
alter table public.users enable row level security;
alter table public.menu enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.ingredients enable row level security;
alter table public.restaurants enable row level security;
alter table public.tables enable row level security;

-- 9. Create Permissive Policies (Base)
create policy "Public menu access" on public.menu for all using (true) with check (true);
create policy "Public orders access" on public.orders for all using (true) with check (true);
create policy "Public order_items access" on public.order_items for all using (true) with check (true);
create policy "Public ingredients access" on public.ingredients for all using (true) with check (true);
create policy "Public restaurants access" on public.restaurants for all using (true) with check (true);
create policy "Public tables access" on public.tables for all using (true) with check (true);

-- 10. Seed Default Restaurant
insert into public.restaurants (name)
select 'Sosha Main Branch'
where not exists (select 1 from public.restaurants);

-- 11. Helper Functions
create or replace function public.increment_stock(row_id uuid, quantity numeric)
returns void as $$
begin
  update public.ingredients 
  set current_stock = current_stock + quantity
  where id = row_id;
end;
$$ language plpgsql security definer;

-- 12. Add Analytics Columns
alter table public.orders add column if not exists order_type text default 'dine-in';
alter table public.orders add column if not exists kitchen_accepted_at timestamp with time zone;
alter table public.orders add column if not exists ready_at timestamp with time zone;
alter table public.orders add column if not exists served_at timestamp with time zone;
alter table public.orders add column if not exists notes text;

-- 13. Manager Dashboard & Staff Updates
alter table public.users add column if not exists is_online boolean default false;
alter table public.users add column if not exists shift_start timestamp with time zone;
alter table public.users add column if not exists created_by uuid; 
alter table public.users add column if not exists phone text;
alter table public.users add column if not exists invitation_pending boolean default false;

create table if not exists public.operational_issues (
  id uuid default uuid_generate_v4() primary key,
  issue_type text not null, 
  status text default 'open',
  description text,
  order_id uuid references public.orders(id),
  table_number text,
  staff_id uuid references public.users(id),
  staff_name text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  resolved_at timestamp with time zone
);
alter table public.operational_issues enable row level security;
create policy "Public operational_issues access" on public.operational_issues for all using (true) with check (true);

-- 14. Smart Trigger for Linking Invites
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
             <p className="text-lg">
               Floor layout data requires the new `tables` table. Please run the updated SQL script.
             </p>
             <div className="flex flex-col gap-4 pl-4 border-l-2 border-primary/30">
                <div className="flex gap-3">
                   <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                   <p>Run the SQL migration script.</p>
                </div>
                <div className="flex gap-3">
                   <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                   <p>Refresh the application.</p>
                </div>
             </div>
           </div>

           <Button 
             onClick={() => window.location.reload()} 
             className="w-full h-12 text-base bg-white text-black hover:bg-gray-200 mt-4"
           >
             <RefreshCw className="w-4 h-4 mr-2" /> Refresh App
           </Button>
        </div>

        <Card className="bg-[#111] border-gray-800 shadow-2xl h-[600px] flex flex-col overflow-hidden">
           <CardHeader className="bg-black/40 border-b border-gray-800 py-3 flex flex-row items-center justify-between">
              <div className="flex gap-2">
                 <Button 
                    size="sm" 
                    variant={activeTab === 'sql' ? 'primary' : 'ghost'} 
                    onClick={() => setActiveTab('sql')}
                    className="text-xs h-8"
                 >
                    <Database className="w-3 h-3 mr-2" /> SQL Editor
                 </Button>
              </div>
              <Button 
                size="sm" 
                variant={copied ? 'secondary' : 'outline'}
                onClick={() => handleCopy(sqlCode)}
                className={copied ? "bg-green-500/10 text-green-500" : ""}
              >
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
              <div className="absolute inset-0 pointer-events-none shadow-[inset_0_-20px_20px_rgba(0,0,0,0.5)]" />
           </CardContent>
        </Card>

      </div>
    </div>
  );
};
