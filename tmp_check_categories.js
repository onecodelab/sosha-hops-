import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
);

async function checkCategories() {
  console.log("Checking categories in view_menu_details...");
  const { data, error } = await supabase
    .from('view_menu_details')
    .select('category')
    .limit(100);

  if (error) {
    console.error("Error fetching from view_menu_details:", error);
  } else {
    const categories = Array.from(new Set(data?.map(i => i.category).filter(Boolean)));
    console.log("Unique categories found in view_menu_details:", categories);
  }

  console.log("\nChecking categories in menu_items (if exists)...");
  const { data: menuItems, error: menuErr } = await supabase
    .from('menu_items')
    .select('category')
    .limit(100);

  if (menuErr) {
    console.warn("menu_items table might not exist or has no category column.");
  } else {
    const m_categories = Array.from(new Set(menuItems?.map(i => i.category).filter(Boolean)));
    console.log("Unique categories found in menu_items:", m_categories);
  }
}

checkCategories();
