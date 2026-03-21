import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export const corsHeaders = {
    'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Content-Type': 'application/json',
};

export interface IdentityContext {
    organizationId: string;
    branchId: string;
    userId?: string;
    role?: string;
}

function normalizeBase64(value: string): string {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padding = normalized.length % 4;
    if (padding === 0) return normalized;
    return normalized + '='.repeat(4 - padding);
}

function decodeBase64(value: string): string {
    return atob(normalizeBase64(value));
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
    if (a.length !== b.length) return false;
    let mismatch = 0;
    for (let i = 0; i < a.length; i += 1) {
        mismatch |= a[i] ^ b[i];
    }
    return mismatch === 0;
}

async function verifyBranchToken(token: string): Promise<IdentityContext | null> {
    const branchTokenSecret = Deno.env.get('BRANCH_TOKEN_SECRET');
    if (!branchTokenSecret) {
        return null;
    }

    const [payloadB64, signatureB64] = token.split('.');
    if (!payloadB64 || !signatureB64) {
        return null;
    }

    try {
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
            'raw',
            encoder.encode(branchTokenSecret),
            { name: 'HMAC', hash: 'SHA-256' },
            false,
            ['sign'],
        );

        const expectedSignature = new Uint8Array(
            await crypto.subtle.sign('HMAC', key, encoder.encode(payloadB64)),
        );
        const providedSignature = Uint8Array.from(decodeBase64(signatureB64), (char) => char.charCodeAt(0));

        if (!timingSafeEqual(expectedSignature, providedSignature)) {
            return null;
        }

        const payload = JSON.parse(decodeBase64(payloadB64));
        if (!payload.branch_id || !payload.organization_id) {
            return null;
        }

        return {
            organizationId: payload.organization_id,
            branchId: payload.branch_id,
            role: payload.role ?? 'chatbot',
        };
    } catch (e) {
        console.warn("Identity Resolution Failed:", e instanceof Error ? e.message : String(e));
        return null;
    }
}

export async function resolveIdentity(req: Request, supabase: any): Promise<IdentityContext | null> {
    const authHeader = req.headers.get('Authorization');
    const internalToken = req.headers.get('X-Internal-Token');
    const systemSecret = Deno.env.get('MCP_INTERNAL_TOKEN');

    // 0. Try Internal Token or Service Role Key
    if ((systemSecret && internalToken === systemSecret) ||
        (authHeader && authHeader.replace('Bearer ', '') === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))) {
        return {
            organizationId: 'SERVICE_ROLE',
            branchId: 'SERVICE_ROLE',
            role: 'service_role'
        };
    }

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
    const branchIdentity = await verifyBranchToken(token);
    if (branchIdentity) {
        return branchIdentity;
    }

    return null;
}
