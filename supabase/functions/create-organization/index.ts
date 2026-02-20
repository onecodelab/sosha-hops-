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
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { email, password, organizationName, fullName } = await req.json()

        // 1. Create Auth User
        const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: { full_name: fullName }
        })

        if (authError) throw authError

        const userId = authData.user.id

        // 2. Create Organization
        const { data: orgData, error: orgError } = await supabaseClient
            .from('organizations')
            .insert({ name: organizationName, plan: 'free' })
            .select()
            .single()

        if (orgError) throw orgError

        const orgId = orgData.id

        // 3. Create Profile (as owner)
        const { error: profileError } = await supabaseClient
            .from('profiles')
            .insert({
                id: userId,
                email,
                full_name: fullName,
                name: fullName,
                role: 'owner',
                organization_id: orgId,
                is_online: false
            })

        if (profileError) throw profileError

        // 4. Create Default Branch
        const { data: branchData, error: branchError } = await supabaseClient
            .from('branches')
            .insert({
                name: 'Main Branch',
                location: 'Default',
                organization_id: orgId
            })
            .select()
            .single()

        if (branchError) throw branchError

        // 5. Update Auth MetaData with org_id for JWT claims
        await supabaseClient.auth.admin.updateUserById(userId, {
            app_metadata: { organization_id: orgId }
        })

        return new Response(
            JSON.stringify({ success: true, userId, orgId, branchId: branchData.id }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        )

    } catch (error) {
        return new Response(
            JSON.stringify({ error: error.message }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
    }
})
