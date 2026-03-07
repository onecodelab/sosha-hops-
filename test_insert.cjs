const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.REACT_APP_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;
// Using anon key to simulate client

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOrderItems() {
    // 1. Get a recent order
    const { data: recentOrder } = await supabase.from('orders').select('id, branch_id, table_id, organization_id').order('created_at', { ascending: false }).limit(1).single();

    if (!recentOrder) {
        console.log("No orders found");
        return;
    }

    console.log("Found recent order:", recentOrder);

    // 2. Try to insert an order item directly
    const mockItem = {
        order_id: recentOrder.id,
        menu_item_id: '15d38ccb-b9d9-4ca7-b08e-8a033f2832a8', // Just a UUID
        quantity: 1,
        price: 100,
        organization_id: recentOrder.organization_id // Assuming we need this
    };

    console.log("Attempting to insert mock item:", mockItem);

    // We expect this to fail due to RLS if the Edge Function uses anon key, 
    // OR it might fail for another reason like missing columns
    const { error: insertErr } = await supabase.from('order_items').insert([mockItem]);

    if (insertErr) {
        console.error("EXPECTED Insert Error:", insertErr);
    } else {
        console.log("Insert succeeded unexpectedly!");
    }
}

checkOrderItems().catch(console.error);
