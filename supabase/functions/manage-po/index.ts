import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        );

        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        const authHeader = req.headers.get('Authorization');
        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: corsHeaders });
        }

        const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
        const { data: { user }, error: userErr } = await authClient.auth.getUser();
        if (userErr || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
        }

        const { action, po_id, reason, notes } = await req.json();
        // action: 'list_pending', 'approve', 'reject', 'analyze_risk'

        if (!action) {
            return new Response(JSON.stringify({ error: "Missing required field: action" }), { status: 400, headers: corsHeaders });
        }

        // 1. Authorization & Profile Fetch
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id, role, full_name, supplier_id')
            .eq('id', user.id)
            .single();

        if (!profile) {
            return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404, headers: corsHeaders });
        }

        // 2. Handle Actions
        if (action === 'update_supplier_status') {
            if (profile.role !== 'supplier' && !['owner', 'admin'].includes(profile.role)) {
                return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });
            }
            if (!po_id || !notes) throw new Error("PO ID and status (in notes) required");

            const targetStatus = notes; // Using 'notes' as status for simplicity or add 'status' to JSON

            // Suppliers can only update POs assigned to them
            let query = supabase.from('purchase_orders').update({
                status: targetStatus,
                updated_at: new Date().toISOString()
            }).eq('id', po_id);

            if (profile.role === 'supplier') {
                query = query.eq('supplier_id', profile.supplier_id);
            }

            const { error: updateError } = await query;
            if (updateError) throw updateError;

            // Log activity
            await supabase.from('po_activity_log').insert({
                po_id: po_id,
                action_type: 'updated',
                performed_by: user.id,
                notes: `Status updated by ${profile.role}: ${targetStatus}`,
                organization_id: '00000000-0000-0000-0000-000000000000' // Default or fetch real one
            });

            return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
        }

        // Owner/Admin Only Actions below
        if (!['owner', 'admin'].includes(profile.role)) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });
        }
        const organizationId = profile.organization_id;

        if (action === 'list_pending') {
            const { data, error } = await supabase
                .from('purchase_orders')
                .select(`id, status, total_amount, supplier:suppliers(name), created_at, created_by:profiles!created_by(full_name)`)
                .eq('organization_id', organizationId)
                .in('status', ['pending_approval', 'pending'])
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) throw error;

            return new Response(JSON.stringify({
                success: true,
                count: data.length,
                orders: data.map(po => `ID: ${po.id} | Supplier: ${po.supplier?.name} | Amount: $${po.total_amount} | Created By: ${po.created_by?.full_name}`)
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        if (action === 'approve') {
            if (!po_id) throw new Error("PO ID required");

            const { error } = await supabase
                .from('purchase_orders')
                .update({
                    status: 'approved',
                    approved_by: user.id,
                    approved_at: new Date().toISOString(),
                    approval_notes: notes || "Approved by AI Master Agent"
                })
                .eq('id', po_id)
                .eq('organization_id', organizationId); // Safety check

            if (error) throw error;

            return new Response(JSON.stringify({ success: true, message: `PO ${po_id} approved.` }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        if (action === 'reject') {
            if (!po_id) throw new Error("PO ID required");
            if (!reason) throw new Error("Reason required for rejection");

            const { error } = await supabase
                .from('purchase_orders')
                .update({
                    status: 'rejected',
                    approval_notes: `Rejected by AI: ${reason}`
                })
                .eq('id', po_id)
                .eq('organization_id', organizationId);

            if (error) throw error;

            return new Response(JSON.stringify({ success: true, message: `PO ${po_id} rejected.` }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        return new Response(JSON.stringify({ error: "Invalid Action" }), { status: 400, headers: corsHeaders });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
