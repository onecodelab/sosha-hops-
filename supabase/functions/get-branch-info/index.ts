import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        const sbUrl = Deno.env.get('SUPABASE_URL')!;
        const sbKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SERVICE_ROLE_KEY')!;
        const supabase = createClient(sbUrl, sbKey);

        const { branch_id } = await req.json();

        if (!branch_id) {
            return new Response(JSON.stringify({ error: "Missing branch_id" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 400,
            });
        }

        // 1. Get branch details + organization
        const { data: branch, error: branchErr } = await supabase
            .from('branches')
            .select('id, name, location, organization_id')
            .eq('id', branch_id)
            .single();

        if (branchErr || !branch) {
            return new Response(JSON.stringify({ error: "Branch not found" }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 404,
            });
        }

        // 2. Get active bank accounts for this organization
        const { data: bankAccounts, error: bankErr } = await supabase
            .from('bank_settings')
            .select('bank_key, account_number')
            .eq('organization_id', branch.organization_id)
            .eq('is_active', true);

        if (bankErr) {
            console.error("[get-branch-info] Bank fetch error:", bankErr);
        }

        // 3. Filter out banks with empty account numbers
        const activeBanks = (bankAccounts || []).filter(b => b.account_number && b.account_number.trim() !== '');

        // 4. Format for the chatbot
        const bankInfo = activeBanks.map(b => ({
            bank: b.bank_key,
            account: b.account_number,
            display_name: {
                'cbe': 'Commercial Bank of Ethiopia (CBE)',
                'telebirr': 'Telebirr',
                'abyssinia': 'Bank of Abyssinia',
                'dashen': 'Dashen Bank',
                'cbebirr': 'CBE Birr',
            }[b.bank_key] || b.bank_key
        }));

        return new Response(JSON.stringify({
            success: true,
            branch: {
                id: branch.id,
                name: branch.name,
                location: branch.location,
            },
            payment_methods: bankInfo,
            message: bankInfo.length > 0
                ? `We accept payments via: ${bankInfo.map(b => b.display_name).join(', ')}.`
                : "No payment methods configured for this branch. Please ask the waiter."
        }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });

    } catch (error: any) {
        console.error("[get-branch-info] Error:", error.message);
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
        });
    }
});
