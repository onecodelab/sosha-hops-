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

async function checkTables() {
  const { data, error } = await supabase
    .from("tables")
    .select("*");

  if (error) {
    console.error("Error fetching tables:", error);
  } else {
    console.log("Total tables in DB:", data.length);
    const branchTables = data.filter(t => t.branch_id === "effde1a0-09d3-4508-a66c-64fbd636bcc9");
    console.log("Tables in branch effde1a0-09d3-4508-a66c-64fbd636bcc9:", branchTables.length);
    console.log("Branch table numbers:", JSON.stringify(branchTables.map(t => t.table_number), null, 2));

    const otherTables = data.filter(t => t.branch_id !== "effde1a0-09d3-4508-a66c-64fbd636bcc9");
    if (otherTables.length > 0) {
      console.log("Example of other branch:", otherTables[0].branch_id);
    }
  }
}

checkTables();
