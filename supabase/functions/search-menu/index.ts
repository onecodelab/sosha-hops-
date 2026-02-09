
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const url = new URL(req.url);
        const query = url.searchParams.get('query') || '';
        const category = url.searchParams.get('category') || '';
        const branch_id = url.searchParams.get('branch_id') || '';

        // 1. Initialize Supabase Client
        const sbUrl = Deno.env.get('SUPABASE_URL');
        const sbKey = Deno.env.get('SUPABASE_ANON_KEY');
        const supabase = createClient(sbUrl!, sbKey!);

        // 2. Query Menu View
        let dbQuery = supabase
            .from('view_menu_details')
            .select('id, name, price, category, image_url, is_available')
            .eq('is_available', true);

        if (branch_id) {
            dbQuery = dbQuery.eq('branch_id', branch_id);
        }

        if (category) {
            dbQuery = dbQuery.ilike('category', `%${category}%`);
        }

        if (query) {
            dbQuery = dbQuery.ilike('name', `%${query}%`);
        }

        const { data, error } = await dbQuery.limit(10);

        if (error) throw error;

        return new Response(JSON.stringify(data), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 500,
        });
    }
});
