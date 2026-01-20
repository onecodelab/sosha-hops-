const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://pgglpdnxrwndwxbmajf.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZ2xwZG54cnZuZHd4d2JtYWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTc4NzUsImV4cCI6MjA3OTk3Mzg3NX0.Sn2eJY8mvN-IeEJnOxnI7GPFNbIGqKqAp8F9vZrMEZM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function testQuery() {
    console.log("Checking DB Connection...");
    const { data: tables, error: tableError } = await supabase.from('tables').select('id, table_number');
    if (tableError) {
        console.error("Table Error:", tableError);
    } else {
        console.log(`Found ${tables.length} tables:`, tables.map(t => t.table_number).join(', '));
    }

    const { data: orders, error: orderError } = await supabase.from('orders').select('id, created_at').limit(5);
    if (orderError) {
        console.error("Order Error:", orderError);
    } else {
        console.log(`Found ${orders.length} latest orders:`, orders.map(o => o.created_at));
    }
}

testQuery();
