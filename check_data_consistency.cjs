
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://pgglpdnxrvndwxwbmajf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZ2xwZG54cnZuZHd4d2JtYWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTc4NzUsImV4cCI6MjA3OTk3Mzg3NX0.Sn2eJY8mvN-IeEJnOxnI7GPFNbIGqKqAp8F9vZrMEZM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

async function run() {
    console.log("Checking Branches...");
    const { data: branches, error: bErr } = await supabase.from('branches').select('id, name, organization_id');
    if (bErr) console.error("Branch Error:", bErr.message);
    else console.log("Branches:", JSON.stringify(branches, null, 2));

    console.log("\nChecking Organizations...");
    const { data: orgs, error: oErr } = await supabase.from('organizations').select('id, name');
    if (oErr) console.error("Org Error:", oErr.message);
    else console.log("Orgs:", JSON.stringify(orgs, null, 2));

    console.log("\nChecking User Profile...");
    const { data: profiles, error: pErr } = await supabase.from('profiles').select('id, full_name, role, organization_id');
    if (pErr) console.error("Profile Error:", pErr.message);
    else console.log("Profiles:", JSON.stringify(profiles, null, 2));
}

run();
