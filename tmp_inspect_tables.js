import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function inspect() {
  const { data: tables } = await supabase.from('tables').select('id, table_number, branch_id, organization_id');
  console.log("== TABLES ==");
  tables?.forEach(t => console.log(`Table ${t.table_number}: branch=${t.branch_id}, org=${t.organization_id}`));
}
inspect();
