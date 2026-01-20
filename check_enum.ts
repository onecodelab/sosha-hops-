
import { supabase } from './supabase';

async function checkEnum() {
    console.log("Checking enum values with random UUIDs...");

    // Random UUIDs will cause FK error, but that means Enum check PASSED
    const supplierId = '00000000-0000-0000-0000-000000000001';
    const userId = '00000000-0000-0000-0000-000000000001';
    const deliveryDate = new Date().toISOString();

    const candidates = [
        'Draft',
        'Pending',
        'Approved',
        'Sent',
        'Received',
        'rejected',
        'received',
        'partial_received',
        'partially_received',
        'cancelled',
        'closed',
        'completed',
        'archived'
    ];

    for (const status of candidates) {
        process.stdout.write(`Testing status: "${status}" ... `);
        const { error } = await supabase.from('purchase_orders').insert({
            po_number: `TEST-${Math.floor(Math.random() * 100000)}`,
            supplier_id: supplierId, // Will likely fail FK
            total_amount: 100,
            status: status,
            expected_delivery: deliveryDate,
            created_by: userId // Will likely fail FK
        });

        if (error) {
            if (error.message.includes('invalid input value for enum')) {
                console.log("INVALID ❌");
            } else if (error.message.includes('violates foreign key constraint') || error.message.includes('details')) {
                console.log("VALID ENUM (FK Error) ✅");
            } else {
                // Other errors might also mean valid enum (e.g. RLS preventing insert)
                // But usually enum check happens early.
                // If RLS blocks insert completely, we might not get enum error.
                // But let's see.
                console.log(`ERROR (other): ${error.message} ⚠️`);
            }
        } else {
            console.log("VALID ✅");
        }
    }
}

checkEnum();
