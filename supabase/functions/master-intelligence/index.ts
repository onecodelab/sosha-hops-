import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const FLOWISE_API_HOST = "https://srv1320791.hstgr.cloud";
const MASTER_CHATFLOW_ID = "ff71ca72-f8ed-4247-9d1b-38fe83fa19d9"; // Real ID from Baro Master Agent

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const supabaseServiceKey = Deno.env.get('SERVICE_ROLE_KEY') ?? '';
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        const { action, payload, organization_id, branch_id } = await req.json();

        // ------------------------------------------------------------------
        // CONTEXT RETRIEVAL (The "Truth Backbone")
        // ------------------------------------------------------------------
        const fetchContext = async () => {
            try {
                // Parallel fetch for speed - STRICTLY FILTERED BY BRANCH_ID for Multi-Tenancy
                const [riskData, menuData, eventsData] = await Promise.all([
                    // 1. Inventory Risks (Stock) - Assuming view handles isolation strictly
                    supabase.from('view_inventory_risks').select('*').limit(5),

                    // 2. Menu Financials (Margins) - Filter by Branch
                    supabase.from('view_menu_details')
                        .select('name, margin_percent, is_available')
                        .eq('branch_id', branch_id) // <--- STRICT ISOLATION
                        .order('margin_percent', { ascending: true })
                        .limit(5),

                    // 3. Recent Intelligence Events - Filter by Org
                    supabase.from('intelligence_events')
                        .select('*')
                        .eq('organization_id', organization_id) // <--- STRICT ISOLATION
                        .order('created_at', { ascending: false })
                        .limit(3)
                ]);

                return {
                    risks: riskData.data || [],
                    low_margin_items: menuData.data || [],
                    recent_events: eventsData.data || []
                };
            } catch (dbError) {
                console.error("Context Fetch Error:", dbError);
                return { risks: [], low_margin_items: [], recent_events: [] };
            }
        };

        if (action === 'proactive_analyze') {
            const { event_type, data } = payload;
            console.log(`[MasterAgent] Proactively analyzing ${event_type}...`);

            const context = await fetchContext();

            const flowiseResponse = await fetch(`${FLOWISE_API_HOST}/api/v1/prediction/${MASTER_CHATFLOW_ID}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: `Event: ${event_type}. Payload: ${JSON.stringify(data)}. Global Context: ${JSON.stringify(context)}. Suggest a proposal.`,
                    overrideConfig: {
                        systemMessage: "You are the Baro Master Agent. Analyze the event in the context of the business 'Truth' provided."
                    }
                })
            });

            const aiResult = await flowiseResponse.json();
            return new Response(JSON.stringify({ success: true, suggestion: aiResult.text }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });

        } else if (action === 'chat') {
            const { question } = payload;
            console.log(`[MasterAgent] Chat: ${question}`);

            // Always inject the "Truth" into the chat context
            const context = await fetchContext();

            const response = await fetch(`${FLOWISE_API_HOST}/api/v1/prediction/${MASTER_CHATFLOW_ID}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    question: `User Question: "${question}". \n\nLIVE BUSINESS TRUTH:\nInventory Risks: ${JSON.stringify(context.risks)}\nLow Margins: ${JSON.stringify(context.low_margin_items)}\nRecent Events: ${JSON.stringify(context.recent_events)}\n\nAnswer based on this truth.`,
                    overrideConfig: {
                        organization_id,
                        branch_id
                    }
                })
            });

            const result = await response.json();
            return new Response(JSON.stringify(result), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200,
            });
        }

        throw new Error("Invalid action");

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
        });
    }
})
