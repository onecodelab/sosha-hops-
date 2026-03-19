import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllTables() {
  const { data, error } = await supabase.from("tables").select("table_number, branch_id");
  if (error) {
    console.error(error);
  } else {
    console.log(`Found ${data.length} tables in the database.`);
    if (data.length > 0) {
      console.log(data);
    }
  }
}

checkAllTables();
