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
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const authHeader = req.headers.get('Authorization');
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            });
        }

        const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
        const { data: { user }, error: userErr } = await authClient.auth.getUser();
        if (userErr || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 401,
            });
        }

        const { table_number, branch_id } = await req.json()

        if (!table_number || !branch_id) {
            return new Response(JSON.stringify({ error: "Missing table_number or branch_id" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            })
        }

        // 1. Authorization: Fetch User Profile for Organization Context
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single();

        if (profileErr || !profile) {
            return new Response(JSON.stringify({ error: 'User profile not found' }), { status: 403, headers: corsHeaders });
        }

        // 2. Branch Verification
        const { data: branchData, error: branchErr } = await supabase
            .from('branches')
            .select('organization_id')
            .eq('id', branch_id)
            .single();

        if (branchErr || !branchData) {
            return new Response(JSON.stringify({ error: 'Branch not found' }), { status: 404, headers: corsHeaders });
        }

        if (branchData.organization_id !== profile.organization_id) {
            return new Response(JSON.stringify({ error: 'Tenant isolation violation' }), { status: 403, headers: corsHeaders });
        }

        const { data: table, error } = await supabase
            .from('tables')
            .select('*')
            .eq('branch_id', branch_id)
            .eq('table_number', table_number)
            .maybeSingle()

        if (error) throw error

        if (!table) {
            return new Response(JSON.stringify({ exists: false, message: `Table ${table_number} does not exist.` }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            })
        }

        return new Response(JSON.stringify({
            exists: true,
            id: table.id,
            status: "ready", // AI needs to see 'ready' to proceed. The actual status is handled by place-order.
            message: `Table ${table_number} is verified and ready for your order.`
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        })

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        })
    }
})
