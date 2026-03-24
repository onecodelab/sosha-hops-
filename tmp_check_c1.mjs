import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkC1() {
  const { data: table } = await supabase
    .from('tables')
    .select('id, table_number, branch_id, organization_id')
    .eq('table_number', 'C1')
    .single();

  console.log('Table C1:', table);

  if (table) {
    const { data: orders } = await supabase
      .from('orders')
      .select('id, status, table_id, branch_id, organization_id, created_at')
      .eq('table_id', table.id);

    console.log('Orders for C1:', orders);
  }
}

checkC1();
