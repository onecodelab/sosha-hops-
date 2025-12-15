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

-- 7. Create Inventory Table
create table if not exists public.inventory (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  quantity numeric not null default 0,
  unit text not null,
  par_level numeric default 10,
  cost_per_unit numeric default 0,
  supplier text,
  location text,
  status text default 'ok',
  restaurant_id uuid references public.restaurants(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. Enable Row Level Security (RLS)
alter table public.users enable row level security;
alter table public.menu enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory enable row level security;
alter table public.restaurants enable row level security;

-- 9. Create Permissive Policies (Base)
create policy "Public menu access" on public.menu for all using (true) with check (true);
create policy "Public orders access" on public.orders for all using (true) with check (true);
create policy "Public order_items access" on public.order_items for all using (true) with check (true);
create policy "Public inventory access" on public.inventory for all using (true) with check (true);
create policy "Public restaurants access" on public.restaurants for all using (true) with check (true);

-- 10. Seed Default Restaurant
insert into public.restaurants (name)
select 'Sosha Main Branch'
where not exists (select 1 from public.restaurants);

-- 11. Add Analytics Columns
alter table public.orders add column if not exists order_type text default 'dine-in';
alter table public.orders add column if not exists kitchen_accepted_at timestamp with time zone;
alter table public.orders add column if not exists ready_at timestamp with time zone;
alter table public.orders add column if not exists served_at timestamp with time zone;
alter table public.orders add column if not exists notes text; -- Special instructions

-- 12. Manager Dashboard & Staff Updates
alter table public.users add column if not exists is_online boolean default false;
alter table public.users add column if not exists shift_start timestamp with time zone;
alter table public.users add column if not exists created_by uuid; 
alter table public.users add column if not exists phone text;
alter table public.users add column if not exists invitation_pending boolean default false;

-- Update existing users to have is_online false if null
update public.users set is_online = false where is_online is null;

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

-- 13. Quality Control (Order Issues)
create table if not exists public.order_issues (
  id uuid default uuid_generate_v4() primary key,
  order_id uuid references public.orders(id),
  issue_type text not null, 
  description text,
  reported_by uuid references public.users(id),
  assigned_to uuid references public.users(id),
  status text default 'open',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  resolved_at timestamp with time zone
);
alter table public.order_issues enable row level security;
create policy "Public order_issues access" on public.order_issues for all using (true) with check (true);

-- 14. FIX: Manually Insert Kitchen User (raminsjourney@gmail.com)
insert into public.users (id, email, full_name, role, is_online, created_at)
values (
  '71c4de6f-a78f-4e23-a4b9-e8beb6505436',
  'raminsjourney@gmail.com',
  'Kitchen Staff',
  'kitchen',
  true,
  now()
)
on conflict (id) do nothing;

-- 15. AUTOMATION: Smart Trigger for Linking Invites
create or replace function public.handle_new_user()
returns trigger as $$
declare
  existing_user_id uuid;
begin
  -- Check if a user profile with this email already exists (invited user)
  select id into existing_user_id from public.users where email = new.email limit 1;

  if existing_user_id is not null then
    -- Update the existing profile with the real Auth ID
    update public.users 
    set id = new.id, 
        invitation_pending = false,
        created_at = now() 
    where id = existing_user_id;
  else
    -- Standard Insert
    insert into public.users (id, email, full_name, role, created_at)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data->>'full_name', 'New User'),
      coalesce(new.raw_user_meta_data->>'role', 'waiter'),
      now()
    );
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- 16. OWNER-ONLY STAFF MANAGEMENT POLICIES
drop policy if exists "Public users access" on public.users;

create policy "Staff can view all users"
on public.users for select
to authenticated
using (true);

create policy "Only owner can create staff"
on public.users for insert
to authenticated
with check (
  exists (
    select 1 from public.users
    where id = auth.uid() and role = 'owner'
  )
);

create policy "Only owner can update staff"
on public.users for update
to authenticated
using (
  exists (
    select 1 from public.users
    where id = auth.uid() and role = 'owner'
  )
);

create policy "Only owner can delete staff"
on public.users for delete
to authenticated
using (
  exists (
    select 1 from public.users
    where id = auth.uid() and role = 'owner'
  )
);

-- 17. FIX FOREIGN KEY CONSTRAINTS
ALTER TABLE public.users 
ALTER COLUMN created_by DROP NOT NULL;

ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_id_fkey;

ALTER TABLE public.users 
DROP CONSTRAINT IF EXISTS users_created_by_fkey;

ALTER TABLE public.users 
ADD CONSTRAINT users_created_by_fkey 
FOREIGN KEY (created_by) 
REFERENCES public.users(id) 
ON DELETE SET NULL;
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
               We updated the schema to support direct invites. Please run the updated SQL script.
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