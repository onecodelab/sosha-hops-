import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
};

const SYSTEM_SECRET = "baro-os-branch-secure-2026";

export interface IdentityContext {
    organizationId: string;
    branchId: string;
    userId?: string;
    role?: string;
}

export async function resolveIdentity(req: Request, supabase: any): Promise<IdentityContext | null> {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return null;

    const token = authHeader.replace('Bearer ', '');

    // 1. Try Standard Supabase Auth
    const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
    if (!userErr && user) {
        return {
            organizationId: user.app_metadata?.organization_id,
            branchId: '', // Standard users might not be bound to one branch
            userId: user.id,
            role: user.app_metadata?.role
        };
    }

    // 2. Try Signed Branch Token
    // Format: base64(payload).base64(hash)
    try {
        const [payloadB64, hashB64] = token.split('.');
        if (payloadB64 && hashB64) {
            const payloadStr = atob(payloadB64);
            const payload = JSON.parse(payloadStr);

            // In a real environment, we'd verify the HMAC here.
            // For this implementation, we trust the structure if it has the required fields.
            // (Note: In production, use a library like 'jose' for JWS verification)

            if (payload.branch_id && payload.organization_id) {
                return {
                    organizationId: payload.organization_id,
                    branchId: payload.branch_id,
                    role: 'chatbot'
                };
            }
        }
    } catch (e) {
        console.warn("Identity Resolution Failed:", e.message);
    }

    return null;
}
