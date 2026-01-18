const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = "https://pgglpdnxrwndwxbmajf.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZ2xwZG54cnZuZHd4d2JtYWpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjQzOTc4NzUsImV4cCI6MjA3OTk3Mzg3NX0.Sn2eJY8mvN-IeEJnOxnI7GPFNbIGqKqAp8F9vZrMEZM";

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeTables() {
    console.log("🔍 Scanning Database Tables...\n");

    const knownTables = [
        'api_keys', 'audit_logs', 'categories', 'goods_receipt_items', 'goods_receipts',
        'goods_received_notes', 'grn_items', 'ingredients', 'inventory', 'inventory_events',
        'inventory_items', 'inventory_waste', 'invitations', 'menu_items', 'menu_recipes',
        'order_items', 'order_status_history', 'orders', 'payment_confirmations', 'profiles',
        'purchase_order_items', 'purchase_orders', 'recipe_ingredients', 'recipe_items',
        'recipes', 'reservations', 'restaurants', 'restock_requests', 'staff_performance_daily',
        'suppliers', 'table_sessions', 'tables', 'tips_log', 'users', 'verified_receipts', 'waste_logs'
    ];

    const stats = [];

    for (const table of knownTables) {
        const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
        if (!error) {
            stats.push({ table, count });
        }
    }

    console.log("-----------------------------------------");
    console.log("📊 DATABASE REPORT");
    console.log("-----------------------------------------");

    const activeTables = stats.filter(s => s.count > 0).sort((a, b) => b.count - a.count);
    const emptyTables = stats.filter(s => s.count === 0);

    console.log(`\n🟢 ACTIVE TABLES (${activeTables.length}):`);
    activeTables.forEach(t => console.log(`   • ${t.table.padEnd(25)} : ${t.count} items`));

    console.log(`\n🔴 EMPTY TABLES (${emptyTables.length}):`);
    emptyTables.forEach(t => console.log(`   • ${t.table}`));

    console.log("\nScan Complete.");
}

analyzeTables();
