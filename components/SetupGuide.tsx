
import React, { useState } from 'react';
import { Button, Card, cn } from './ui';
import { Copy, Check, ShieldAlert, Terminal, Database, Code2, Info, ExternalLink, Lock, Box } from 'lucide-react';
import { BaroLogo } from './BaroLogo';

export const SetupGuide: React.FC = () => {
   const [copied, setCopied] = useState(false);

   // MASTER SQL V7.0 - FULL SYSTEM BLUEPRINT
   const rawSql = `-- BARO OS FULL SYSTEM BLUEPRINT v7.0
-- RUN THIS TO INITIALIZE ALL TABLES AND REPAIR SCHEMA ERRORS INSTANTLY.

-- 1. ENABLE CORE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. CORE IDENTITY: PROFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
    email TEXT,
    full_name TEXT,
    name TEXT,
    role TEXT DEFAULT 'waiter',
    is_online BOOLEAN DEFAULT false,
    avatar_url TEXT,
    base_salary NUMERIC,
    pay_period TEXT DEFAULT 'monthly',
    is_salary_approved BOOLEAN DEFAULT false,
    invitation_pending BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. PRODUCT CATALOG: MENU
CREATE TABLE IF NOT EXISTS public.menu (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    price NUMERIC NOT NULL,
    category TEXT,
    image_url TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. SUPPLY CHAIN: INGREDIENTS
CREATE TABLE IF NOT EXISTS public.ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sku TEXT UNIQUE,
    name TEXT NOT NULL,
    category TEXT,
    current_stock NUMERIC DEFAULT 0,
    unit_type TEXT DEFAULT 'g',
    par_min NUMERIC DEFAULT 0,
    par_max NUMERIC DEFAULT 0,
    cost_per_unit NUMERIC DEFAULT 0,
    expiry_days INTEGER DEFAULT 30,
    is_active BOOLEAN DEFAULT true,
    supplier_id UUID,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. PRODUCTION LOGIC: RECIPES
CREATE TABLE IF NOT EXISTS public.recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    menu_item_id UUID REFERENCES public.menu(id) ON DELETE CASCADE,
    name TEXT,
    status TEXT DEFAULT 'published',
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID REFERENCES public.recipes(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES public.ingredients(id) ON DELETE CASCADE,
    quantity_needed NUMERIC NOT NULL,
    unit_type TEXT,
    UNIQUE(recipe_id, ingredient_id)
);

-- 6. FLOOR MANAGEMENT: TABLES & SESSIONS
CREATE TABLE IF NOT EXISTS public.tables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_number TEXT UNIQUE NOT NULL,
    status TEXT DEFAULT 'available',
    capacity_min INTEGER DEFAULT 1,
    capacity_max INTEGER DEFAULT 4,
    zone TEXT DEFAULT 'Main Hall',
    current_order_id UUID,
    current_session_id UUID,
    last_updated TIMESTAMPTZ DEFAULT now(),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.table_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_id UUID REFERENCES public.tables(id) ON DELETE CASCADE,
    waiter_id UUID REFERENCES public.profiles(id),
    is_active BOOLEAN DEFAULT true,
    seated_at TIMESTAMPTZ DEFAULT now(),
    closed_at TIMESTAMPTZ,
    guest_count INTEGER DEFAULT 1,
    session_revenue NUMERIC DEFAULT 0
);

-- 7. OPERATIONS: ORDERS
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE,
    table_id UUID REFERENCES public.tables(id),
    table_number TEXT,
    waiter_id UUID REFERENCES public.profiles(id),
    status TEXT DEFAULT 'pending',
    source TEXT DEFAULT 'dine_in',
    payment_status TEXT DEFAULT 'unpaid',
    total_amount NUMERIC DEFAULT 0,
    amount_paid NUMERIC DEFAULT 0,
    tip_amount NUMERIC DEFAULT 0,
    customer_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    accepted_at TIMESTAMPTZ,
    ready_at TIMESTAMPTZ,
    served_at TIMESTAMPTZ,
    paid_at TIMESTAMPTZ,
    closed_at TIMESTAMPTZ,
    last_updated TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    menu_item_id UUID REFERENCES public.menu(id),
    quantity INTEGER DEFAULT 1,
    price NUMERIC,
    special_instructions TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. INITIAL SEED (Optional)
INSERT INTO public.ingredients (name, sku, current_stock, unit_type, cost_per_unit)
VALUES ('Premium Beef Fillet', 'BEEF-001', 50, 'kg', 850)
ON CONFLICT (sku) DO NOTHING;

-- 9. SCHEMA HARDENING & ATOMIC LOCKS
DROP INDEX IF EXISTS idx_unique_active_session_per_table;
CREATE UNIQUE INDEX idx_unique_active_session_per_table 
ON public.table_sessions (table_id) 
WHERE (is_active = true);

NOTIFY pgrst, 'reload schema';`;

   const handleCopy = () => {
      navigator.clipboard.writeText(rawSql);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
   };

   return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 md:p-8 text-foreground font-sans selection:bg-primary selection:text-black">
         <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">

            <div className="space-y-8">
               <div className="w-16 h-16"><BaroLogo className="w-full h-full" /></div>

               <div className="space-y-4">
                  <div className="flex items-center gap-2 text-primary bg-primary/10 border border-primary/20 px-4 py-1.5 rounded-full w-fit">
                     <Box className="w-4 h-4" />
                     <span className="text-[10px] font-black uppercase tracking-[0.2em]">Core Architecture Sync</span>
                  </div>
                  <h1 className="text-4xl md:text-7xl font-black text-white tracking-tighter leading-[0.85]">
                     System <span className="text-primary text-glow">Blueprint</span> Required
                  </h1>
                  <p className="text-gray-400 text-lg max-w-md leading-relaxed">
                     The Recipe Architect and Inventory systems require specific database tables to be initialized. Run the Blueprint script to activate full OS functionality.
                  </p>
               </div>

               <div className="space-y-4">
                  <Step number="1" text="Copy the Full System Blueprint SQL on the right." />
                  <Step number="2" text="Paste it into your Supabase SQL Editor and click 'Run'." />
                  <Step number="3" text="Once successful, refresh this window to launch Baro OS." />
               </div>

               <div className="pt-4">
                  <Button
                     onClick={() => window.location.reload()}
                     className="w-full md:w-auto h-16 px-10 bg-white text-black font-black rounded-2xl text-lg hover:bg-zinc-200 transition-all shadow-2xl active:scale-95"
                  >
                     Launch Baro OS
                  </Button>
               </div>
            </div>

            <Card className="bg-[#0A0A0A] border-zinc-800 h-[650px] flex flex-col overflow-hidden rounded-[3rem] shadow-[0_40px_100px_rgba(0,0,0,0.8)] border-2 relative">
               <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-xl sticky top-0 z-20">
                  <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                        <Terminal className="w-4 h-4 text-primary" />
                     </div>
                     <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">Blueprint v7.0</span>
                  </div>
                  <Button
                     onClick={handleCopy}
                     className={cn(
                        "rounded-xl h-12 px-8 font-black uppercase text-xs transition-all shadow-lg",
                        copied ? "bg-green-600 text-white" : "bg-primary text-black hover:bg-primary-hover"
                     )}
                  >
                     {copied ? <><Check className="w-4 h-4 mr-2" /> Copied!</> : <><Copy className="w-4 h-4 mr-2" /> Copy Blueprint SQL</>}
                  </Button>
               </div>

               <div className="relative flex-1 overflow-hidden bg-black group">
                  <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-8">
                     <pre className="text-emerald-500 font-mono text-[11px] leading-relaxed whitespace-pre font-medium">
                        {rawSql}
                     </pre>
                  </div>
                  <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black to-transparent pointer-events-none" />
               </div>

               <div className="p-5 bg-zinc-900/80 border-t border-zinc-800 flex items-center justify-between">
                  <div className="flex items-center gap-2 text-[10px] font-black text-zinc-500 uppercase tracking-widest">
                     <Database className="w-3.5 h-3.5" /> Full Schema Deployment
                  </div>
                  <a
                     href="https://supabase.com/dashboard/project/_/sql"
                     target="_blank"
                     rel="noreferrer"
                     className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1 hover:underline"
                  >
                     Go to Supabase Dashboard <ExternalLink className="w-3 h-3" />
                  </a>
               </div>
            </Card>
         </div>

         <style>{`
        .text-glow { text-shadow: 0 0 20px rgba(255, 184, 0, 0.4); }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #27272a; border-radius: 10px; }
      `}</style>
      </div>
   );
};

const Step = ({ number, text }: { number: string; text: string }) => (
   <div className="flex items-start gap-4 group">
      <div className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center text-xs font-black text-zinc-400 group-hover:bg-primary group-hover:text-black group-hover:border-primary transition-all shrink-0">
         {number}
      </div>
      <p className="text-sm font-bold text-gray-300 mt-1 leading-relaxed group-hover:text-white transition-colors">{text}</p>
   </div>
);
