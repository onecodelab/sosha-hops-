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
        const supabaseAdmin = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Authorization: Only super_admin can call this
        const authHeader = req.headers.get('Authorization')
        if (!authHeader) throw new Error('Unauthorized')

        const userClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_ANON_KEY') ?? '',
            { global: { headers: { Authorization: authHeader } } }
        )

        const { data: { user }, error: authError } = await userClient.auth.getUser()
        if (authError || !user) throw new Error('Unauthorized')

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profile?.role !== 'super_admin') {
            throw new Error('Insufficient permissions. Super Admin role required.')
        }

        const { action, email, password, fullName, organizationName, supplier_id } = await req.json()

        if (action === 'create_owner') {
            // Logic similar to create-organization but centralized here
            const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name: fullName }
            })
            if (createError) throw createError

            const { data: orgData, error: orgError } = await supabaseAdmin
                .from('organizations')
                .insert({ name: organizationName || `${fullName}'s Restaurant`, plan: 'free' })
                .select()
                .single()
            if (orgError) throw orgError

            // Create Main Branch for the new organization
            const { data: branchData, error: branchError } = await supabaseAdmin
                .from('branches')
                .insert({
                    name: 'Main Branch',
                    organization_id: orgData.id,
                    is_active: true
                })
                .select()
                .single()
            if (branchError) throw branchError

            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update({
                    full_name: fullName,
                    role: 'owner',
                    organization_id: orgData.id,
                    home_branch_id: branchData.id,
                    status: 'active'
                })
                .eq('id', authData.user.id)
            if (profileError) throw profileError

            await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
                app_metadata: { organization_id: orgData.id }
            })

            return new Response(JSON.stringify({ success: true, userId: authData.user.id, orgId: orgData.id }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            })
        }

        if (action === 'create_supplier') {
            const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name: fullName }
            })
            if (createError) throw createError

            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update({
                    full_name: fullName,
                    role: 'supplier',
                    organization_id: '00000000-0000-0000-0000-000000000000', // Baro Platform
                    supplier_id: supplier_id || null,
                    status: 'active'
                })
                .eq('id', authData.user.id)
            if (profileError) throw profileError

            await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
                app_metadata: { organization_id: '00000000-0000-0000-0000-000000000000' }
            })

            return new Response(JSON.stringify({ success: true, userId: authData.user.id }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            })
        }

        if (action === 'create_driver') {
            const { data: authData, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true,
                user_metadata: { full_name: fullName }
            })
            if (createError) throw createError

            const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update({
                    full_name: fullName,
                    role: 'driver',
                    organization_id: '00000000-0000-0000-0000-000000000000',
                    status: 'active'
                })
                .eq('id', authData.user.id)
            if (profileError) throw profileError

            await supabaseAdmin.auth.admin.updateUserById(authData.user.id, {
                app_metadata: { organization_id: '00000000-0000-0000-0000-000000000000' }
            })

            return new Response(JSON.stringify({ success: true, userId: authData.user.id }), {
                headers: { ...corsHeaders, 'Content-Type': 'application/json' },
                status: 200
            })
        }

        throw new Error('Invalid action')

    } catch (error: any) {
        return new Response(JSON.stringify({ success: false, error: error.message }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200
        })
    }
})
