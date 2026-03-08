import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, resolveIdentity } from "../_shared/identity.ts";

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        let query = url.searchParams.get('query') || '';
        let category = url.searchParams.get('category') || '';
        let branch_id = url.searchParams.get('branch_id') || '';

        if (req.method === 'POST') {
            const body = await req.json();
            query = body.query || query;
            category = body.category || category;
            branch_id = body.branch_id || branch_id;
        }

        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!; // Use service role for consistent lookup
        const supabase = createClient(sbUrl, sbKey);

        // 1. Resolve Identity (Standard JWT or Signed Branch Token)
        const identity = await resolveIdentity(req, supabase);
        if (!identity) {
            return new Response(JSON.stringify({ error: "Unauthorized", detail: "Invalid or missing token" }), { status: 401, headers: corsHeaders });
        }

        const { organizationId, branchId: tokenBranchId } = identity;
        const targetBranchId = tokenBranchId || branch_id;

        // 2. Query Menu View
        let dbQuery = supabase
            .from('view_menu_details')
            .select('id, name, price, category, image_url, is_available')
            .eq('organization_id', organizationId)
            .eq('is_available', true);

        // Note: RLS will automatically filter by organizationId due to our Phase 1 migrations.
        // We still allow branch_id filtering for UX.
        if (branch_id && branch_id !== '00000000-0000-0000-0000-000000000000') {
            dbQuery = dbQuery.eq('branch_id', branch_id);
        }

        if (category) {
            dbQuery = dbQuery.ilike('category', `%${category}%`);
        }

        if (query) {
            dbQuery = dbQuery.ilike('name', `%${query}%`);
        }

        const { data, error } = await dbQuery.limit(20);

        if (error) throw error;

        return new Response(JSON.stringify(data), {
            headers: corsHeaders,
            status: 200,
        });

    } catch (err: any) {
        console.error("[search-menu] Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), {
            headers: corsHeaders,
            status: 500,
        });
    }
});
