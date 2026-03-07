const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSchema() {
    console.log("Checking order_items for organization_id column...");
    const { data, error } = await supabase.from('order_items').select('id, organization_id').limit(1);

    if (error) {
        console.error("Query Error:", error.message);
    } else {
        console.log("Success! Data (or empty if none):", data);
    }
}
checkSchema();
