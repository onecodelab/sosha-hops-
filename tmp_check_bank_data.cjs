
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    try {
        const { data: bba } = await supabase.from('branch_bank_accounts').select('*').limit(5);
        console.log('Branch Bank Accounts:', JSON.stringify(bba, null, 2));
    } catch (e) {
        console.error('Error (table likely doesn\'t exist):', e.message);
    }
}

check();
