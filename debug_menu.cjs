const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://pgglpdnxrvndwxwbmajf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZ2xwZG54cnZuZHd4d2JtYWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTc4NzUsImV4cCI6MjA3OTk3Mzg3NX0.Sn2eJY8mvN-IeEJnOxnI7GPFNbIGqKqAp8F9vZrMEZM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function check() {
    console.log("Checking 'menu' columns...");
    const { data: menuData, error: menuError } = await supabase.from('menu').select('*').limit(1);
    if (menuError) console.error("Menu Error:", menuError);
    else console.log("Menu Columns:", Object.keys(menuData[0] || {}));

    console.log("\nChecking 'menu_items' columns...");
    const { data: itemsData, error: itemsError } = await supabase.from('menu_items').select('*').limit(1);
    if (itemsError) console.error("Menu Items Error:", itemsError);
    else console.log("Menu Items Columns:", Object.keys(itemsData[0] || {}));
}

check();
