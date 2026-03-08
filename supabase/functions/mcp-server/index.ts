import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, resolveIdentity } from "../_shared/identity.ts";

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Use service role for tool logic
        const supabase = createClient(sbUrl, sbKey);

        // 1. Resolve Identity (Standard JWT or Signed Branch Token)
        const identity = await resolveIdentity(req, supabase);
        if (!identity) {
            return new Response(JSON.stringify({ error: "Unauthorized", detail: "Invalid or missing token" }), { status: 401, headers: corsHeaders });
        }

        const { organizationId, branchId } = identity;

        // 2. MCP Tool Execution
        const body = await req.json();
        const { tool, params } = body;

        let result: any;

        switch (tool) {
            case 'get_menu':
                const queryStr = params.query || '';
                const catStr = params.category || '';

                let dbQuery = supabase
                    .from('view_menu_details')
                    .select('id, name, price, category, image_url, is_available')
                    .eq('organization_id', organizationId)
                    .eq('is_available', true);

                if (branchId) dbQuery = dbQuery.eq('branch_id', branchId);
                if (catStr) dbQuery = dbQuery.ilike('category', `%${catStr}%`);
                if (queryStr) dbQuery = dbQuery.ilike('name', `%${queryStr}%`);

                const { data: menuData, error: menuErr } = await dbQuery.limit(20);
                if (menuErr) throw menuErr;
                result = { items: menuData };
                break;

            case 'get_branch_info':
                const { data: branch, error: bErr } = await supabase
                    .from('branches')
                    .select('id, name, location')
                    .eq('id', branchId || params.branch_id)
                    .eq('organization_id', organizationId)
                    .single();

                if (bErr) throw bErr;

                const { data: banks } = await supabase
                    .from('bank_settings')
                    .select('bank_key, account_number')
                    .eq('organization_id', organizationId)
                    .eq('is_active', true);

                result = {
                    branch: branch,
                    payment_methods: banks?.filter(b => b.account_number) || []
                };
                break;

            default:
                return new Response(JSON.stringify({ error: "Unknown tool", tool }), { status: 400, headers: corsHeaders });
        }

        return new Response(JSON.stringify({ success: true, result }), {
            headers: corsHeaders,
            status: 200,
        });

    } catch (error: any) {
        console.error("[MCP-SERVER] Error:", error.message);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: corsHeaders,
            status: 500,
        });
    }
});
