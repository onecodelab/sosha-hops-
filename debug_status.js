import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // If you have it, else try anon

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Env vars", { supabaseUrl, hasKey: !!supabaseKey });
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);

async function debugTables() {
    console.log("--- Debugging Tables vs Orders ---");

    // 1. Get All Tables
    const { data: tables, error: tErr } = await supabase.from('tables').select('*');
    if (tErr) { console.error("Error fetching tables", tErr); return; }

    // 2. Get All Active Orders
    const { data: orders, error: oErr } = await supabase.from('orders')
        .select('*')
        .neq('status', 'paid')
        .neq('status', 'cancelled')
        .is('closed_at', null);

    if (oErr) { console.error("Error fetching orders", oErr); return; }

    console.log(`Found ${tables.length} Tables.`);
    console.log(`Found ${orders.length} Active Orders.`);

    // 3. Find Discrepancies
    let discrepancies = 0;
    for (const table of tables) {
        const activeOrderForTable = orders.find(o => o.table_id === table.id);
        const isOccupied = table.status === 'occupied';

        if (activeOrderForTable && !isOccupied) {
            console.log(`[MISMATCH] Table ${table.table_number} (${table.id}) is '${table.status}' but has Active Order ${activeOrderForTable.id}`);
            discrepancies++;
        } else if (!activeOrderForTable && isOccupied) {
            console.log(`[MISMATCH] Table ${table.table_number} (${table.id}) is 'occupied' but has NO Active Order`);
            discrepancies++;
        }
    }

    if (discrepancies === 0) {
        console.log("✅ No discrepancies found! (Wait, then why is the UI wrong?)");
    } else {
        console.log(`❌ Found ${discrepancies} mismatches.`);
    }
}

debugTables();
