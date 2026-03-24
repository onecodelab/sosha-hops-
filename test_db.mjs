import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runDiagnostic() {
  const { data: branches } = await supabase.from("branches").select("id, name, organization_id");
  console.log("BRANCHES:" + JSON.stringify(branches));

  const { data: orders } = await supabase
    .from("orders")
    .select("id, order_number, branch_id, status, source, table_number, created_at, waiter_id")
    .eq("source", "chatbot")
    .is("waiter_id", null);
  console.log("UNASSIGNED_ORDERS:" + JSON.stringify(orders));
}

runDiagnostic();
