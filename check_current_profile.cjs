const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://pgglpdnxrvndwxwbmajf.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZ2xwZG54cnZuZHd4d2JtYWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTc4NzUsImV4cCI6MjA3OTk3Mzg3NX0.Sn2eJY8mvN-IeEJnOxnI7GPFNbIGqKqAp8F9vZrMEZM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProfiles() {
    console.log("🔍 Checking Profiles Table...\n");

    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, full_name, email, role, organization_id')
        .limit(10);

    if (error) {
        console.error("Error fetching profiles:", error);
        return;
    }

    console.table(profiles);

    const { data: orgs, error: orgError } = await supabase
        .from('organizations') // Just in case it's organizations
        .select('*')
        .limit(5);

    if (orgError) {
        // Try other names if organizations doesn't exist
        const { data: rest, error: restError } = await supabase.from('restaurants').select('*').limit(5);
        if (!restError) console.log("\nFound 'restaurants' table:", rest);
    } else {
        console.log("\nFound 'organizations' table:", orgs);
    }

    // Check table sessions too since we fixed it earlier
    const { data: sessions, error: sessionError } = await supabase
        .from('table_sessions')
        .select('id, organization_id')
        .limit(5);

    if (!sessionError) {
        console.log("\nTable Sessions Sample:", sessions);
    }
}

checkProfiles();
