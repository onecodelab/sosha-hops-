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

-- 9. Create Permissive Policies
create policy "Public users access" on public.users for all using (true) with check (true);
create policy "Public menu access" on public.menu for all using (true) with check (true);
create policy "Public orders access" on public.orders for all using (true) with check (true);
create policy "Public order_items access" on public.order_items for all using (true) with check (true);
create policy "Public inventory access" on public.inventory for all using (true) with check (true);
create policy "Public restaurants access" on public.restaurants for all using (true) with check (true);

-- 10. Seed Default Restaurant
insert into public.restaurants (name)
select 'Sosha Main Branch'
where not exists (select 1 from public.restaurants);`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sqlCode);
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
               We couldn't detect the necessary database tables. This usually happens when you are running the app for the first time.
             </p>
             <div className="flex flex-col gap-4 pl-4 border-l-2 border-primary/30">
                <div className="flex gap-3">
                   <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold shrink-0">1</div>
                   <p>Copy the SQL migration script.</p>
                </div>
                <div className="flex gap-3">
                   <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold shrink-0">2</div>
                   <p>Go to <strong className="text-white">Supabase Dashboard</strong> → <strong className="text-white">SQL Editor</strong>.</p>
                </div>
                <div className="flex gap-3">
                   <div className="w-6 h-6 rounded-full bg-gray-800 flex items-center justify-center text-xs font-bold shrink-0">3</div>
                   <p>Paste the script and click <strong className="text-green-500">Run</strong>.</p>
                </div>
             </div>
           </div>

           <Button 
             onClick={() => window.location.reload()} 
             className="w-full h-12 text-base bg-white text-black hover:bg-gray-200 mt-4"
           >
             <RefreshCw className="w-4 h-4 mr-2" /> I've ran the script, Refresh App
           </Button>
        </div>

        <Card className="bg-[#111] border-gray-800 shadow-2xl h-[500px] flex flex-col overflow-hidden">
           <CardHeader className="bg-black/40 border-b border-gray-800 py-3 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-400 font-mono">
                 <Terminal className="w-4 h-4" /> migration.sql
              </div>
              <Button 
                size="sm" 
                variant={copied ? 'secondary' : 'primary'}
                onClick={handleCopy}
                className={copied ? "bg-green-500/10 text-green-500" : ""}
              >
                 {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                 {copied ? 'Copied' : 'Copy SQL'}
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
