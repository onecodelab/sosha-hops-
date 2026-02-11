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
        const supabase = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { table_number, branch_id } = await req.json()

        if (!table_number || !branch_id) {
            return new Response(JSON.stringify({ error: "Missing table_number or branch_id" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            })
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
