
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://pgglpdnxrwndwxbmajf.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZ2xwZG54cnZuZHd4d2JtYWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTc4NzUsImV4cCI6MjA3OTk3Mzg3NX0.Sn2eJY8mvN-IeEJnOxnI7GPFNbIGqKqAp8F9vZrMEZM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectOrders() {
    console.log("Inspecting Order Timestamps...");
    const now = new Date();
    const localToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const isoToday = localToday.toISOString();

    console.log(`Current Time (UTC): ${now.toISOString()}`);
    console.log(`Today Midnight (Local -> UTC): ${isoToday}`);

    const { data: orders, error } = await supabase
        .from('orders')
        .select('id, order_number, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error("Error fetching orders:", error);
        return;
    }

    console.log("\nRecent Orders:");
    orders.forEach(o => {
        const isAfterToday = o.created_at >= isoToday;
        console.log(`[ID: ${o.id.slice(0, 8)}] Num: ${o.order_number} | Created: ${o.created_at} | After Today? ${isAfterToday}`);
    });

    console.log("\nTesting 'Today' Filter explicitly...");
    const { data: todayOrders, error: tErr } = await supabase
        .from('orders')
        .select('id, order_number, created_at')
        .gte('created_at', isoToday)
        .order('created_at', { ascending: false });

    if (tErr) console.error("Today Query Error:", tErr);
    else console.log(`Today Filter found ${todayOrders.length} orders.`);
}

inspectOrders();
