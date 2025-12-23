import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://pgglpdnxrvndwxwbmajf.supabase.co';
const SUPABASE_ANON_KEY =
  process.env.SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZ2xwZG54cnZuZHd4d2JtYWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTc4NzUsImV4cCI6MjA3OTk3Mzg3NX0.Sn2eJY8mvN-IeEJnOxnI7GPFNbIGqKqAp8F9vZrMEZM';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const failures = [];

const log = (msg) => console.log(`[SOSHA CHECK] ${msg}`);
const ok = (msg) => console.log(`✔ ${msg}`);
const fail = (msg, error) => {
  failures.push(msg);
  console.error(`✗ ${msg}`);
  if (error) {
    console.error(error.message || error);
  }
};

async function ensureTestWaiter() {
  const email = 'sosha-smoke-waiter@example.com';

  log('Ensuring test waiter user exists');
  const { data, error } = await supabase
    .from('users')
    .select('id, email, role')
    .eq('email', email)
    .limit(1);

  if (error) {
    fail('Failed to read users for test waiter', error);
    return null;
  }

  if (data && data.length > 0) {
    ok(`Using existing test waiter (${email})`);
    return data[0];
  }

  const { data: inserted, error: insertError } = await supabase
    .from('users')
    .insert({
      email,
      role: 'waiter',
      full_name: 'Smoke Test Waiter',
      is_online: true,
    })
    .select('id, email, role')
    .single();

  if (insertError || !inserted) {
    fail('Could not create test waiter user', insertError);
    return null;
  }

  ok('Created test waiter user');
  return inserted;
}

async function ensureTestMenuItem() {
  const name = 'Sosha Smoke Test Dish';

  log('Ensuring test menu item exists');
  const { data, error } = await supabase
    .from('menu')
    .select('id, name, price')
    .eq('name', name)
    .limit(1);

  if (error) {
    fail('Failed to read menu items for smoke test', error);
    return null;
  }

  if (data && data.length > 0) {
    ok(`Using existing test menu item (${name})`);
    return data[0];
  }

  const { data: inserted, error: insertError } = await supabase
    .from('menu')
    .insert({
      name,
      price: 100,
      category: 'Test',
      is_available: true,
      stock_quantity: 999,
    })
    .select('id, name, price')
    .single();

  if (insertError || !inserted) {
    fail('Could not create test menu item', insertError);
    return null;
  }

  ok('Created test menu item');
  return inserted;
}

async function createTestOrder(kind, waiterId, menuItem) {
  const label = kind === 'waiter' ? 'Waiter order' : 'Chatbot order';
  const table =
    kind === 'waiter' ? 'T-SOSHA-SMOKE-WAITER' : 'T-SOSHA-SMOKE-CHATBOT';
  const notes =
    kind === 'waiter' ? 'sosha-check waiter flow' : 'sosha-check chatbot flow';

  log(`Creating ${label}`);
  const { data: order, error } = await supabase
    .from('orders')
    .insert({
      table_number: table,
      waiter_id: waiterId ?? null,
      status: 'pending',
      order_type: 'dine-in',
      total_amount: menuItem.price,
      customer_notes: notes,
    })
    .select('id, order_number, status, payment_method, created_at, customer_notes')
    .single();

  if (error || !order) {
    fail(`${label} creation failed`, error);
    return null;
  }

  const { error: itemError } = await supabase.from('order_items').insert({
    order_id: order.id,
    menu_item_id: menuItem.id,
    quantity: 1,
    price: menuItem.price,
    special_instructions: null,
  });

  if (itemError) {
    fail(`${label} item insert failed`, itemError);
    return null;
  }

  ok(`${label} created with one item (order id=${order.id})`);
  return order;
}

async function updateOrderStatus(orderId, update) {
  const targetStatus = update.status;
  const { data, error } = await supabase
    .from('orders')
    .update(update)
    .eq('id', orderId)
    .select('id, status, payment_method')
    .single();

  if (error || !data) {
    const baseMsg = `Order status transition to '${targetStatus}' failed`;
    if (error?.message && error.message.toLowerCase().includes('constraint')) {
      fail(`${baseMsg} due to constraint`, error);
    } else {
      fail(baseMsg, error);
    }
    return null;
  }

  ok(`Order ${orderId} status is now '${data.status}'`);
  return data;
}

async function runStatusFlow(order) {
  log('Running status transition flow on waiter order');
  const now = new Date().toISOString();

  if (!await updateOrderStatus(order.id, { status: 'preparing', preparing_at: now })) return;
  if (!await updateOrderStatus(order.id, { status: 'ready', ready_at: now })) return;
  if (!await updateOrderStatus(order.id, { status: 'served', served_at: now })) return;
  if (!await updateOrderStatus(order.id, {
    status: 'paid',
    payment_method: 'cash',
    paid_at: now,
  })) return;
  await updateOrderStatus(order.id, {
    status: 'completed',
    completed_at: now,
  });
}

async function testPaymentMethods(menuItem, waiterId) {
  log('Verifying payment_method accepts all configured methods');

  const methods = ['cash', 'chapa', 'cbe', 'abyssinia'];

  for (const method of methods) {
    const { data: order, error } = await supabase
      .from('orders')
      .insert({
        table_number: `T-SOSHA-${method.toUpperCase()}`,
        waiter_id: waiterId ?? null,
        status: 'paid',
        order_type: 'dine-in',
        total_amount: menuItem.price,
        payment_method: method,
        paid_at: new Date().toISOString(),
        customer_notes: `sosha-check payment ${method}`,
      })
      .select('id, status, payment_method')
      .single();

    if (error || !order) {
      fail(`Payment method '${method}' failed to save`, error);
    } else if (order.payment_method !== method) {
      fail(
        `Payment method mismatch: expected '${method}' but got '${order.payment_method}'`
      );
    } else {
      ok(`Payment method '${method}' saved correctly`);
    }
  }
}

async function verifyRecentActivityMarkers() {
  log('Verifying recent orders include smoke-test markers');

  const { data: orders, error } = await supabase
    .from('orders')
    .select('id, customer_notes, payment_method, waiter_id, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    fail('Failed to read recent orders for activity check', error);
    return;
  }

  const waiterOrder = orders?.find((o) =>
    (o.customer_notes || '').includes('sosha-check waiter')
  );
  const chatbotOrder = orders?.find((o) =>
    (o.customer_notes || '').includes('sosha-check chatbot')
  );

  if (!waiterOrder) {
    fail('Waiter order did not appear in recent orders list');
  } else if (!waiterOrder.waiter_id) {
    fail('Waiter smoke-test order has no waiter_id (expected a waiter-linked order)');
  } else {
    ok('Waiter order appeared in recent orders list with a waiter_id');
  }

  if (!chatbotOrder) {
    fail('Chatbot order did not appear in Recent Activity (recent orders)');
  } else if (chatbotOrder.waiter_id) {
    fail('Chatbot smoke-test order has waiter_id set (expected NULL to mark unclaimed/bot order)');
  } else {
    ok('Chatbot order appeared in recent orders list with waiter_id = NULL');
  }
}

async function main() {
  log('Starting Sosha OS smoke checks...');

  const waiter = await ensureTestWaiter();
  const menuItem = await ensureTestMenuItem();

  if (!waiter || !menuItem) {
    fail('Setup failed; skipping remaining checks');
    finish();
    return;
  }

  const waiterOrder = await createTestOrder('waiter', waiter.id, menuItem);
  const chatbotOrder = await createTestOrder('chatbot', null, menuItem);

  if (waiterOrder) {
    await runStatusFlow(waiterOrder);
  }

  await testPaymentMethods(menuItem, waiter.id);
  await verifyRecentActivityMarkers();

  finish();
}

function finish() {
  if (failures.length > 0) {
    console.error('\nSosha OS smoke check FAILED.');
    console.error('Problems detected:');
    for (const msg of failures) {
      console.error(` - ${msg}`);
    }
    process.exit(1);
  } else {
    ok('\nSosha OS smoke check PASSED. Core restaurant flows look healthy.');
    process.exit(0);
  }
}

main().catch((err) => {
  fail('Unexpected error in sosha-smoke script', err);
  finish();
});