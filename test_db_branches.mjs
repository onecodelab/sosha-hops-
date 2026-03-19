import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkBranches() {
  const { data, error } = await supabase.from("branches").select("id, name");
  if (error) console.error(error);
  else console.log("Branches:", data);
}

checkBranches();
