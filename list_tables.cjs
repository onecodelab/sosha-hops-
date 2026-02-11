
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://pgglpdnxrvndwxwbmajf.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZ2xwZG54cnZuZHd4d2JtYWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTc4NzUsImV4cCI6MjA3OTk3Mzg3NX0.Sn2eJY8mvN-IeEJnOxnI7GPFNbIGqKqAp8F9vZrMEZM';

const supabase = createClient(supabaseUrl, supabaseKey);

async function listTables() {
    const { data, error } = await supabase
        .from('information_schema.tables') // This might be blocked by Supabase API
        .select('*');

    // Alternative: Try to select from suspected tables
    const tables = ['order_items', 'suppliers', 'menu_items', 'menu'];
    for (const t of tables) {
        const { error } = await supabase.from(t).select('id').limit(1);
        console.log(`Table '${t}' exists?`, !error ? 'YES' : 'NO (' + error.message + ')');
    }
}

listTables();
