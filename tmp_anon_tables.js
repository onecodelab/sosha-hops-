import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  const { data, error } = await supabase.from('tables').select('id, table_number, branch_id, organization_id').limit(1);
  console.log("Anon Tables Result:", { data, error });
}
check();
