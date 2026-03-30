import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkAnon() {
  const { data, error } = await supabase.from('organizations').select('name, chatbot_logo_url').limit(1);
  console.log("Anon Result:", { data, error });
}

checkAnon();
