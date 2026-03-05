import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // Authorization: Only super_admin can call this
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Unauthorized')

        const userClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: authError } = await userClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'super_admin') {
            throw new Error('Insufficient permissions. Super Admin role required.')
        }

        const { userId } = await req.json()
        if (!userId) throw new Error('userId is required')

        // Prevent self-deletion
        if (userId === user.id) {
            throw new Error('Cannot delete your own account')
        }

        // 1. Manual Cleanup: Handle foreign key constraints BEFORE deleting Auth/Profile
        // We use individual await calls with logging to identify blockers.
        console.log(`Starting cleanup for user: ${userId}`);

        const tablesToNullify = [
            { table: 'profiles', column: 'created_by' },
            { table: 'orders', column: 'waiter_id' },
            { table: 'orders', column: 'assigned_driver_id' },
            { table: 'table_sessions', column: 'waiter_id' },
            { table: 'order_payments', column: 'created_by' },
            { table: 'purchase_orders', column: 'created_by' },
            { table: 'purchase_orders', column: 'approved_by' },
            { table: 'purchase_orders', column: 'performed_by' },
            { table: 'purchase_orders', column: 'received_by' },
            { table: 'purchase_orders', column: 'supplier_user_id' },
            { table: 'proposals', column: 'decided_by' },
            { table: 'proposals', column: 'actor_id' },
            { table: 'business_audit_logs', column: 'actor_id' },
            { table: 'waste_logs', column: 'reported_by' },
            { table: 'goods_received_notes', column: 'received_by' },
            { table: 'inventory_transactions', column: 'performed_by' },
            { table: 'onboarding_applications', column: 'email' } // Nullify email if matched to avoid lookup issues
        ];

        for (const { table, column } of tablesToNullify) {
            try {
                // Try to set to NULL
                const { error: updateError } = await supabaseAdmin
                    .from(table)
                    .update({ [column]: null })
                    .eq(column, userId);

                if (updateError) {
                    // If update is blocked (e.g. NOT NULL), try to delete the row instead
                    if (updateError.message?.includes('not-null') || updateError.code === '23502' || updateError.message?.includes('foreign key')) {
                        console.warn(`Cleanup blocked on ${table}.${column}. Deleting related row instead...`);
                        await supabaseAdmin.from(table).delete().eq(column, userId);
                    } else {
                        console.warn(`Error nullifying ${table}.${column}:`, updateError.message);
                    }
                }
            } catch (err: any) {
                console.warn(`Exception nullifying ${table}.${column}:`, err.message);
            }
        }

        // 1a. Explicit Deletions (Historical data that MUST be removed)
        const tablesToDelete = [
            { table: 'staff_shifts', column: 'staff_id' },
            { table: 'tips_ledger', column: 'staff_id' },
            { table: 'staff_actions', column: 'staff_id' },
            { table: 'waste_logs', column: 'staff_id' },
            { table: 'po_activity_log', column: 'performed_by' },
            { table: 'audit_logs', column: 'staff_id' },
            { table: 'business_audit_logs', column: 'actor_id' }
        ];

        for (const { table, column } of tablesToDelete) {
            try {
                const { error } = await supabaseAdmin.from(table).delete().eq(column, userId);
                if (error) console.warn(`Error deleting from ${table}:`, error.message);
            } catch (err: any) {
                console.warn(`Exception deleting from ${table}:`, err.message);
            }
        }

        // 2. Explicitly delete the profile for this user
        console.log(`Final Profile Wipe: ${userId}`);
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', userId)

        if (profileError) {
            console.error('Profile deletion error:', profileError);
            throw new Error(`Profile ${userId} deletion blocked: ${profileError.message}. Table constraint likely missed.`);
        }

        // 3. Finally delete from Supabase Auth
        console.log(`Final Auth Wipe: ${userId}`);
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(userId)

        if (deleteError) {
            const isUserNotFound = deleteError.message?.includes('not found') || (deleteError as any).status === 404;
            if (!isUserNotFound) throw deleteError;
        }

        return new Response(JSON.stringify({ success: true }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })

    } catch (error: any) {
        console.error('Deletion Final Failure:', error.message);
        return new Response(JSON.stringify({
            success: false,
            error: error.message || 'Unknown database error during deletion'
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })
    }
})
