import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { Client } from "https://deno.land/x/postgres@v0.17.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // The database URL must come from the environment (connection string)
    const databaseUrl = Deno.env.get('YOUR_DB_URL') || "postgresql://postgres.pgglpdnxrvndwxwbmajf:Zg2wZ2vG3eZ2wX2v@aws-0-eu-central-1.pooler.supabase.com:6543/postgres";

    const client = new Client(databaseUrl);
    await client.connect();

    const sql = `
      -- Migration to fix missing foreign keys on tips_ledger
      ALTER TABLE public.tips_ledger
      ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;

      ALTER TABLE public.tips_ledger
      ADD COLUMN IF NOT EXISTS staff_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

      -- Add indexes for better query performance since we join on these
      CREATE INDEX IF NOT EXISTS idx_tips_ledger_order_id ON public.tips_ledger(order_id);
      CREATE INDEX IF NOT EXISTS idx_tips_ledger_staff_id ON public.tips_ledger(staff_id);
    `;

    await client.queryArray(sql);
    await client.end();

    return new Response(
      JSON.stringify({ success: true, message: "Migration applied successfully" }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  }
});
