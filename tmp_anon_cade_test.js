import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkAnonCaDE() {
  const { data, error } = await supabase.from('organizations').select('name, chatbot_logo_url').eq('name', 'CaDE').maybeSingle();
  console.log("Anon CaDE Result:", { data, error });
}

checkAnonCaDE();
