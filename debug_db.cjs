
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log("--- BRANCHES ---");
    const { data: branches } = await supabase.from('branches').select('id, name');
    console.log(JSON.stringify(branches, null, 2));

    console.log("\n--- RESTAURANTS ---");
    const { data: restaurants } = await supabase.from('restaurants').select('id, name');
    console.log(JSON.stringify(restaurants, null, 2));

    console.log("\n--- PROFILES SCHEMA (First row) ---");
    const { data: profiles } = await supabase.from('profiles').select('*').limit(1);
    if (profiles && profiles.length > 0) {
        console.log(Object.keys(profiles[0]));
    }
}

check();
