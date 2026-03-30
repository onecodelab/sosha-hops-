import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function check() {
  const { data: orgs } = await supabase.from('organizations').select('id, name, chatbot_logo_url');
  console.log("== ORGS ==");
  orgs.forEach(o => console.log(`${o.name} (${o.id}): ${o.chatbot_logo_url || 'EMPTY'}`));
  
  const { data: branches } = await supabase.from('branches').select('id, name, organization_id');
  console.log("\n== BRANCHES ==");
  branches.forEach(b => console.log(`${b.name} -> org: ${b.organization_id}`));
}
check();
