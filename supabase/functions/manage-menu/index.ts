
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
        const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
        const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
        const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
        const authHeader = req.headers.get('Authorization');

        if (!authHeader) {
            return new Response(JSON.stringify({ error: 'Missing authorization header' }), { status: 401, headers: corsHeaders });
        }

        const supabase = createClient(supabaseUrl, serviceRoleKey);
        const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });

        const { data: { user }, error: userErr } = await authClient.auth.getUser();
        if (userErr || !user) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
        }

        const body = await req.json();
        const { action, item, target_id } = body;
        // item: { id?, name, price, category, ... }

        // 1. Resolve Organization ID from User Profile
        const { data: profile, error: profileErr } = await supabase
            .from('profiles')
            .select('organization_id, role')
            .eq('id', user.id)
            .single();

        if (profileErr || !profile || !profile.organization_id) {
            return new Response(JSON.stringify({ error: "User not associated with an Organization" }), { status: 403, headers: corsHeaders });
        }

        const organizationId = profile.organization_id;
        const isOwnerOrAdmin = ['owner', 'admin'].includes(profile.role);

        if (!isOwnerOrAdmin) {
            return new Response(JSON.stringify({ error: "Unauthorized: Insufficient permissions" }), { status: 403, headers: corsHeaders });
        }

        // 2. Handle Actions
        if (action === 'upsert') {
            if (!item) throw new Error('Missing item payload');

            if (item.id) {
                const { data: existingItem } = await supabase
                    .from('menu')
                    .select('organization_id')
                    .eq('id', item.id)
                    .maybeSingle();

                if (existingItem && existingItem.organization_id !== organizationId) {
                    return new Response(JSON.stringify({ error: 'Item not found or unauthorized' }), { status: 404, headers: corsHeaders });
                }
            }

            const payload = {
                ...item,
                organization_id: organizationId,
                // Ensure we don't accidentally overwrite id if it's new (item.id might be null/undefined)
            };

            // Clean payload of undefined
            if (!payload.id) delete payload.id;

            const { data, error } = await supabase
                .from('menu')
                .upsert(payload)
                .select()
                .single();

            if (error) throw error;

            return new Response(JSON.stringify({ success: true, data }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });

        } else if (action === 'delete') {
            if (!target_id) throw new Error("Missing target_id for delete");

            // Verify ownership (RLS does this, but BFF should too)
            // We can just call the RPC provided it respects Org ID, 
            // OR we just delete directly since we have Service Role and we validated Org ID implies ownership... 
            // WAIT: Service Role bypasses RLS. We MUST check that the item belongs to the Org!

            const { data: existingItem } = await supabase
                .from('menu')
                .select('organization_id')
                .eq('id', target_id)
                .single();

            if (!existingItem || existingItem.organization_id !== organizationId) {
                return new Response(JSON.stringify({ error: "Item not found or unauthorized" }), { status: 404, headers: corsHeaders });
            }

            // Call the RPC for clean cascading delete
            const { error } = await supabase.rpc('permanently_delete_menu_item', { target_id });

            if (error) throw error;

            return new Response(JSON.stringify({ success: true }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            });
        }

        return new Response(JSON.stringify({ error: "Invalid Action" }), { status: 400, headers: corsHeaders });

    } catch (error) {
        console.error(error);
        return new Response(JSON.stringify({ error: error.message }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }
});
