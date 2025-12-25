
import React, { useState } from 'react';
import { Button, Card, CardContent, CardHeader, CardTitle } from './ui';
import { Database, Copy, Check, RefreshCw, Terminal } from 'lucide-react';
import { SoshaLogo } from './SoshaLogo';

export const SetupGuide: React.FC = () => {
  const [copied, setCopied] = useState(false);

  const sqlCode = `-- 1. Category System Migration
create table if not exists public.categories (
  id uuid default uuid_generate_v4() primary key,
  name text not null unique,
  created_at timestamp with time zone default now()
);

-- Ensure category_id exists on menu table
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name='menu' and column_name='category_id') then
    alter table public.menu add column category_id uuid references public.categories(id) on delete set null;
  end if;
end $$;

-- 2. Repair Table: recipe_items
drop table if exists public.recipe_items cascade;
create table public.recipe_items (
  id uuid default uuid_generate_v4() primary key,
  menu_id uuid references public.menu(id) on delete cascade,
  ingredient_id uuid references public.ingredients(id) on delete cascade,
  qty_per_item numeric not null default 0,
  created_at timestamp with time zone default now()
);

-- 3. Security Policies (RLS)
alter table public.categories enable row level security;
alter table public.menu enable row level security;
alter table public.recipe_items enable row level security;

drop policy if exists "Allow all to view categories" on public.categories;
create policy "Allow all to view categories" on public.categories for select using (true);

drop policy if exists "Managers manage categories" on public.categories;
create policy "Managers manage categories" on public.categories for all using (
  auth.uid() in (select id from public.users where role in ('owner', 'manager'))
);

-- 4. Inventory Intelligence View
create or replace view public.ingredient_overview as
with usage_stats as (
    select 
        ingredient_id,
        abs(sum(case when event_type = 'deduction' then qty_change else 0 end)) / 7.0 as avg_daily_usage
    from public.inventory_events
    where created_at > now() - interval '7 days'
    group by ingredient_id
)
select 
    i.*,
    coalesce(u.avg_daily_usage, 0) as avg_7d_usage,
    case 
        when coalesce(u.avg_daily_usage, 0) > 0 
        then floor(i.current_stock / u.avg_daily_usage)::int 
        else null 
    end as est_days_left_by_usage,
    case 
        when i.current_stock <= 0 then 'EMPTY'
        when i.current_stock <= i.par_min then 'LOW'
        else 'HEALTHY'
    end as stock_status
from public.ingredients i
left join usage_stats u on i.id = u.ingredient_id;

-- 5. Reload schema cache
NOTIFY pgrst, 'reload schema';
`;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 text-foreground font-sans">
      <div className="max-w-4xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        <div className="space-y-6">
           <div className="w-20 h-20 mb-6">
              <SoshaLogo className="w-full h-full" />
           </div>
           <h1 className="text-4xl font-bold text-white tracking-tight leading-tight">Relational <span className="text-primary">Schema Ready</span></h1>
           <div className="space-y-4 text-gray-400">
             <p className="text-lg">This upgrade links your <b>Menu</b> to a dedicated <b>Categories</b> table. Any category you delete in Supabase will instantly disappear from the app.</p>
             <div className="flex gap-3 items-center bg-white/5 p-4 rounded-2xl border border-white/10 shadow-xl">
                <Terminal className="w-5 h-5 text-primary" />
                <span className="text-xs font-mono">Ensures category_id exists on 'menu' table</span>
             </div>
           </div>
           <Button onClick={() => window.location.reload()} className="w-full h-14 text-lg bg-white text-black hover:bg-gray-200 mt-4 rounded-2xl shadow-2xl font-black uppercase tracking-widest">
             <RefreshCw className="w-5 h-5 mr-2" /> Sync System Now
           </Button>
        </div>
        <Card className="bg-[#111] border-gray-800 shadow-2xl h-[600px] flex flex-col overflow-hidden rounded-[2.5rem]">
           <CardHeader className="bg-black/40 border-b border-gray-800 py-4 flex flex-row items-center justify-between px-6">
              <span className="text-xs font-black text-gray-500 uppercase tracking-widest">Relational Engine (SQL)</span>
              <Button size="sm" variant={copied ? 'secondary' : 'outline'} onClick={() => handleCopy(sqlCode)} className="rounded-xl h-8">
                 {copied ? <Check className="w-4 h-4 mr-2" /> : <Copy className="w-4 h-4 mr-2" />}
                 {copied ? 'Copied' : 'Copy'}
              </Button>
           </CardHeader>
           <CardContent className="p-0 flex-1 overflow-hidden relative group">
              <textarea 
                readOnly 
                value={sqlCode} 
                className="w-full h-full bg-[#0A0A0A] text-gray-300 font-mono text-[10px] p-6 resize-none focus:outline-none custom-scrollbar" 
                spellCheck={false} 
              />
           </CardContent>
        </Card>
      </div>
    </div>
  );
};
