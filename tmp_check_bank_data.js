
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    try {
        const { data: orgs } = await supabase.from('organizations').select('id, name');
        console.log('Organizations:', JSON.stringify(orgs, null, 2));
        
        const { data: bankSettings } = await supabase.from('bank_settings').select('*').eq('is_active', true);
        console.log('Active Bank Settings:', JSON.stringify(bankSettings, null, 2));

        const { data: orders } = await supabase.from('orders')
            .select('id, order_number, transaction_reference, status')
            .order('created_at', { ascending: false })
            .limit(5);
        console.log('Recent Orders:', JSON.stringify(orders, null, 2));

    } catch (e) {
        console.error('Error:', e);
    }
}

check();
