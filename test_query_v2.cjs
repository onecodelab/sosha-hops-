
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://pgglpdnxrwndwxbmajf.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZ2xwZG54cnZuZHd4d2JtYWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTc4NzUsImV4cCI6MjA3OTk3Mzg3NX0.Sn2eJY8mvN-IeEJnOxnI7GPFNbIGqKqAp8F9vZrMEZM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testFetch() {
    console.log("Testing Transaction Log Query...");

    // Test 'week' range as seen in screenshot
    const queryStart = `${new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0]}T00:00:00`;
    const queryEnd = `${new Date(Date.now() + 86400000).toISOString().split('T')[0]}T00:00:00`;

    console.log(`Range: ${queryStart} to ${queryEnd}`);

    const { data: feed, error: feedErr } = await supabase
        .from('orders')
        .select(`
            *, 
            waiter:profiles!orders_waiter_id_fkey (full_name, role),
            closed_by_user:profiles(full_name, role),
            order_items (
                id,
                quantity,
                price,
                menu_item:menu (name)
            )
        `)
        .gte('created_at', queryStart)
        .lt('created_at', queryEnd)
        .order('created_at', { ascending: false })
        .limit(10);

    if (feedErr) {
        console.error("Query Failed:", JSON.stringify(feedErr, null, 2));
    } else {
        console.log(`Success! Found ${feed.length} records.`);
        if (feed.length > 0) {
            console.log("Sample Record:", JSON.stringify(feed[0], null, 2));
        }
    }
}

testFetch();
