import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';

config({ path: '.env' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMenuDetailed() {
  const orgId = "a9fd383e-030d-4f7b-95d1-f843d5e3a2b8"; // CaDE
  const branchId = "effde1a0-09d3-4508-a66c-64fbd636bcc9";

  // Test 1: Exact same query as the chatbot edge function
  console.log("=== Test 1: Exact chatbot query (org + branch filter) ===");
  const { data: d1, error: e1 } = await supabase
    .from("view_menu_details")
    .select("id, name, price, category, image_url, is_available, description")
    .eq("organization_id", orgId)
    .eq("branch_id", branchId)
    .limit(20);
  console.log("Error:", e1);
  console.log("Items:", d1?.length);
  if (d1?.length > 0) console.log("First:", d1[0].name, d1[0].price);

  // Test 2: Only org filter (no branch)
  console.log("\n=== Test 2: Only org filter ===");
  const { data: d2, error: e2 } = await supabase
    .from("view_menu_details")
    .select("id, name, price, category, image_url, is_available, description")
    .eq("organization_id", orgId)
    .limit(20);
  console.log("Error:", e2);
  console.log("Items:", d2?.length);
  if (d2?.length > 0) d2.forEach(i => console.log(` - ${i.name}: ETB ${i.price} [${i.category}]`));

  // Test 3: Check what branch_id values exist in the view
  console.log("\n=== Test 3: Distinct branch_ids in view_menu_details ===");
  const { data: d3 } = await supabase
    .from("view_menu_details")
    .select("branch_id, organization_id")
    .eq("organization_id", orgId);
  const uniqueBranches = [...new Set((d3 || []).map(r => r.branch_id))];
  console.log("Branch IDs for CaDE org:", uniqueBranches);
}

checkMenuDetailed();
