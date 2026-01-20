
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testStaffPerformance() {
    console.log('Testing get_staff_performance_metrics...');

    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - 30); // Last 30 days

    const { data, error } = await supabase.rpc('get_staff_performance_metrics', {
        start_date: start.toISOString(),
        end_date: end.toISOString()
    });

    if (error) {
        console.error('RPC Error:', error.message);
        if (error.message.includes('function get_staff_performance_metrics') && error.message.includes('does not exist')) {
            console.log('ACTION REQUIRED: The migration has NOT been run yet.');
        }
    } else {
        console.log('Success! Data returned:', data?.length, 'rows');
        if (data && data.length > 0) {
            console.log('Sample Row:', data[0]);
        } else {
            console.log('No data found (might be no orders/shifts in last 30d).');
        }
    }
}

testStaffPerformance();
