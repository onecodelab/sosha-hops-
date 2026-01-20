
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function testFetch() {
    console.log("Testing Transaction Log Query...");
    const dateFilter = 'week';
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
        console.error("Query Failed:", feedErr);
    } else {
        console.log(`Success! Found ${feed.length} records.`);
        if (feed.length > 0) {
            console.log("Sample Record:", JSON.stringify(feed[0], null, 2));
        }
    }
}

testFetch();
