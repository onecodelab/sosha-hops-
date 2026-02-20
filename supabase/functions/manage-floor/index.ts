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

        const { action, branch_id, table_id } = await req.json();
        // action: 'view_map', 'close_all_tables', 'clear_table'

        if (!action) {
            return new Response(JSON.stringify({ error: "Missing required field: action" }), { status: 400, headers: corsHeaders });
        }

        // 1. Authorization
        const { data: profile } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single();

        if (!['owner', 'admin'].includes(profile?.role)) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 403, headers: corsHeaders });
        }
        const organizationId = profile.organization_id;

        // 2. Handle Actions
        if (action === 'list_branches') {
            const { data, error } = await supabase
                .from('branches')
                .select('id, name, location, organization_id')
                .eq('organization_id', organizationId);

            if (error) throw error;

            return new Response(JSON.stringify({
                success: true,
                branches: data
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        if (action === 'view_map') {
            let query = supabase
                .from('tables')
                .select('id, table_number, status, branch_id, current_session_id')
                .eq('organization_id', organizationId);

            if (branch_id) {
                query = query.eq('branch_id', branch_id);
            }

            const { data, error } = await query;
            if (error) throw error;

            // Summary stats
            const occupied = data.filter(t => t.status === 'occupied').length;
            const available = data.length - occupied;

            return new Response(JSON.stringify({
                success: true,
                stats: { total: data.length, occupied, available },
                tables: data.map(t => `Table ${t.table_number}: ${t.status}`)
            }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            });
        }

        if (action === 'clear_table') {
            if (!table_id) throw new Error("Table ID required");

            // Check ownership
            const { data: table } = await supabase.from('tables').select('organization_id').eq('id', table_id).single();
            if (table?.organization_id !== organizationId) throw new Error("Unauthorized table access");

            // Logic from orderService to clear
            await supabase.from('table_sessions').update({ is_active: false, closed_at: new Date().toISOString() }).eq('table_id', table_id).eq('is_active', true);
            await supabase.from('tables').update({ status: 'available', current_order_id: null, current_session_id: null }).eq('id', table_id);

            return new Response(JSON.stringify({ success: true, message: `Table cleared.` }), {
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
