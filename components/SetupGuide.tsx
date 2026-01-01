
import React, { useState } from 'react';
/* Import missing cn utility */
import { Button, Card, cn } from './ui';
import { Copy, Check, ShieldAlert, Terminal, Database, Code2, Info, ExternalLink, Lock } from 'lucide-react';
import { SoshaLogo } from './SoshaLogo';

export const SetupGuide: React.FC = () => {
  const [copied, setCopied] = useState(false);

  // MASTER SQL V6.3 - ENSURES ALL COLUMNS FROM USER CSV & APP LOGIC MATCH
  const rawSql = `-- SOSHA OS MASTER REPAIR & ATOMIC LOCK SCRIPT v6.3
-- RUN THIS TO FIX 'column does not exist' ERRORS INSTANTLY.

-- 1. ENABLE CORE EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. HARDEN TABLES SCHEMA (Ensures current_session_id exists)
ALTER TABLE IF EXISTS public.tables ADD COLUMN IF NOT EXISTS current_order_id UUID;
ALTER TABLE IF EXISTS public.tables ADD COLUMN IF NOT EXISTS current_session_id UUID;
ALTER TABLE IF EXISTS public.tables ADD COLUMN IF NOT EXISTS zone TEXT DEFAULT 'Main Hall';
ALTER TABLE IF EXISTS public.tables ADD COLUMN IF NOT EXISTS capacity_min INTEGER DEFAULT 1;
ALTER TABLE IF EXISTS public.tables ADD COLUMN IF NOT EXISTS capacity_max INTEGER DEFAULT 4;

-- 3. INITIALIZE/REPAIR SESSION REGISTRY
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

-- ALIGN COLUMN NAMES (Your CSV showed 'assigned_waiter_id', app needs 'waiter_id')
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='table_sessions' AND column_name='assigned_waiter_id') THEN
    ALTER TABLE public.table_sessions RENAME COLUMN assigned_waiter_id TO waiter_id;
  END IF;
END $$;

-- 4. CLEANUP DUPLICATES & RESET STATES
UPDATE public.table_sessions SET is_active = false, closed_at = NOW() WHERE is_active = true;
UPDATE public.orders SET status = 'closed', closed_at = NOW() WHERE status NOT IN ('paid', 'closed', 'cancelled');
UPDATE public.tables SET status = 'available', current_order_id = NULL, current_session_id = NULL;

-- Remove duplicate physical table records
DELETE FROM public.tables a USING (
      SELECT MIN(ctid) as ctid, table_number 
      FROM public.tables 
      GROUP BY table_number 
      HAVING COUNT(*) > 1
) b
WHERE a.table_number = b.table_number 
AND a.ctid > b.ctid;

-- 5. APPLY ATOMIC LOCK (Prevents two waiters seating same table)
DROP INDEX IF EXISTS idx_unique_active_session_per_table;
CREATE UNIQUE INDEX idx_unique_active_session_per_table 
ON public.table_sessions (table_id) 
WHERE (is_active = true);

-- 6. REFRESH CACHE
NOTIFY pgrst, 'reload schema';`;

  const handleCopy = () => {
    navigator.clipboard.writeText(rawSql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center p-4 md:p-8 text-foreground font-sans selection:bg-red-500 selection:text-white">
      <div className="max-w-6xl w-full grid grid-cols-1 lg:grid-cols-2 gap-8 items-center">
        
        <div className="space-y-8">
           <div className="w-16 h-16"><SoshaLogo className="w-full h-full" /></div>
           
           <div className="space-y-4">
              <div className="flex items-center gap-2 text-primary bg-primary/10 border border-primary/20 px-4 py-1.5 rounded-full w-fit">
                 <Lock className="w-4 h-4" />
                 <span className="text-[10px] font-black uppercase tracking-[0.2em]">Atomic Session Locking Required</span>
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter leading-[0.9]">
                 Database <span className="text-primary text-glow">Verification</span> Failed
              </h1>
              <p className="text-gray-400 text-lg max-w-md leading-relaxed">
                 Your database is missing the linkage columns between physical tables and live orders. Run the repair script to fix it instantly.
              </p>
           </div>

           <div className="space-y-4">
              <Step number="1" text="Copy the Repair SQL script on the right." />
              <Step number="2" text="Run it in Supabase SQL Editor. It will add the missing 'current_session_id' column." />
              <Step number="3" text="Refresh the app." />
           </div>

           <div className="pt-4">
              <Button 
                onClick={() => window.location.reload()} 
                className="w-full md:w-auto h-16 px-10 bg-white text-black font-black rounded-2xl text-lg hover:bg-zinc-200 transition-all shadow-2xl active:scale-95"
              >
                Refresh App After Patching
              </Button>
           </div>
        </div>

        <Card className="bg-[#0A0A0A] border-zinc-800 h-[600px] flex flex-col overflow-hidden rounded-[2.5rem] shadow-[0_40px_100px_rgba(0,0,0,0.8)] border-2 relative">
           <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50 backdrop-blur-xl sticky top-0 z-20">
              <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center border border-primary/20">
                    <Terminal className="w-4 h-4 text-primary" />
                 </div>
                 <span className="text-[11px] font-black text-zinc-400 uppercase tracking-widest">Repair Patch v6.3</span>
              </div>
              <Button 
                onClick={handleCopy} 
                className={cn(
                  "rounded-xl h-12 px-8 font-black uppercase text-xs transition-all shadow-lg",
                  copied ? "bg-green-600 text-white" : "bg-primary text-black hover:bg-primary-hover"
                )}
              >
                 {copied ? <><Check className="w-4 h-4 mr-2" /> Copied!</> : <><Copy className="w-4 h-4 mr-2" /> Copy Repair SQL</>}
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
                 <Database className="w-3.5 h-3.5" /> Schema Hardening
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
