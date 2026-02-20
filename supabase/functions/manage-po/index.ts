import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
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

        const { action, po_id, reason, user_id, notes } = await req.json();
        // action: 'list_pending', 'approve', 'reject', 'analyze_risk'

        if (!user_id || !action) {
            return new Response(JSON.stringify({ error: "Missing required fields (user_id, action)" }), { status: 400, headers: corsHeaders });
        }

        // 1. Authorization Check (Must be Owner/Manager)
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id, role, full_name')
            .eq('id', user_id)
            .single();

        if (!['owner', 'admin'].includes(profile?.role)) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });
        }
        const organizationId = profile.organization_id;

        // 2. Handle Actions
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
                    approved_by: user_id,
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
                    status: 'rejected', // or 'draft' per business logic, but 'rejected' is clearer for agent
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
