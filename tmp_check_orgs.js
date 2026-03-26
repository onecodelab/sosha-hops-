import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkOrgs() {
  const { data, error } = await supabase.from('organizations').select('id, name, chatbot_logo_url');
  console.log(JSON.stringify(data, null, 2));
}

checkOrgs();
