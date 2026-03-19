import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL");
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  Deno.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
  const { data, error } = await supabase
    .from("tables")
    .select("*")
    .eq("branch_id", "effde1a0-09d3-4508-a66c-64fbd636bcc9");

  if (error) {
    console.error("Error fetching tables:", error);
  } else {
    console.log("Found tables:", data.length);
    console.log(JSON.stringify(data.map(t => t.table_number), null, 2));
  }
}

checkTables();
