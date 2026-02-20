const { createClient } = require('@supabase/supabase-js');
const SUPABASE_URL = 'https://pgglpdnxrwndwxbmajf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZ2xwZG54cnduZHd4Ym1hamYiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTczMDQyODQ4NCwiZXhwIjoyMDQ2MDA0NDg0fQ.BHYWFZZSI5Inl1I6i623qJ07r7r';

const s = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
    const { data, error } = await s.from('ingredients').select('name').limit(10);
    if (error) console.log('ERROR:', error);
    else console.log('INGREDIENTS:', data.map(i => i.name).join(', '));
}
run();
