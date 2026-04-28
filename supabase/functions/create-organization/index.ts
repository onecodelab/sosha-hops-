import { Redis } from "https://esm.sh/@upstash/redis";
import { corsHeaders, rateLimit } from "../_shared/identity.ts";

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const supabaseClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // --- RATE LIMITING (By IP) ---
        const redisUrl = Deno.env.get('UPSTASH_REDIS_REST_URL');
        const redisToken = Deno.env.get('UPSTASH_REDIS_REST_TOKEN');
        if (redisUrl && redisToken) {
            const redis = new Redis({ url: redisUrl, token: redisToken });
            const clientIp = req.headers.get('x-real-ip') || req.headers.get('x-forwarded-for') || 'anonymous';
            const limit = await rateLimit(redis, `register:${clientIp}`, 3, 3600); // Max 3 per hour
            if (!limit.success) {
                return new Response(JSON.stringify({ error: "Registration limit exceeded. Please try again later." }), { status: 429, headers: corsHeaders });
            }
        }

        const body = await req.json()
        const { z } = await import("https://esm.sh/zod");
        const schema = z.object({
            email: z.string().email(),
            password: z.string().min(8),
            organizationName: z.string().min(2),
            fullName: z.string().min(2)
        });

        const result = schema.safeParse(body);
        if (!result.success) {
            return new Response(JSON.stringify({ error: "Validation failed", details: result.error.format() }), { status: 400, headers: corsHeaders });
        }

        const { email, password, organizationName, fullName } = result.data;

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
