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
    const branchTokenSecret = Deno.env.get('BRANCH_TOKEN_SECRET') || 'baro-os-branch-secure-2026';

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

        const rawPayload = decodeBase64(payloadB64);
        console.log("[verifyBranchToken] rawPayload:", rawPayload);
        const expectedSignature = new Uint8Array(
            await crypto.subtle.sign('HMAC', key, encoder.encode(rawPayload)),
        );
        const providedSignature = Uint8Array.from(decodeBase64(signatureB64), (char) => char.charCodeAt(0));

        console.log("[verifyBranchToken] providedSignature length:", providedSignature.length, "expectedSignature length:", expectedSignature.length);
        if (!timingSafeEqual(expectedSignature, providedSignature)) {
            console.warn("[verifyBranchToken] Signature mismatch!");
            return null;
        }

        const payload = JSON.parse(rawPayload);
        console.log("[verifyBranchToken] payload:", payload);
        if (!payload.branch_id || !payload.organization_id) {
            console.warn("[verifyBranchToken] Missing branch_id or organization_id in payload!");
            return null;
        }

        if (payload.exp !== undefined) {
            const expiry = Number(payload.exp);
            const nowSeconds = Math.floor(Date.now() / 1000);
            console.log("[verifyBranchToken] expiry:", expiry, "now:", nowSeconds);
            if (!Number.isFinite(expiry) || expiry <= nowSeconds) {
                console.warn("[verifyBranchToken] Token expired!");
                return null;
            }
        }

        if (typeof payload.branch_id !== 'string' || typeof payload.organization_id !== 'string') {
            console.warn("[verifyBranchToken] branch_id or organization_id is not a string!");
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
        console.log("[resolveIdentity] Authenticated via Internal Token or Service Role Key");
        return {
            organizationId: 'SERVICE_ROLE',
            branchId: 'SERVICE_ROLE',
            role: 'service_role'
        };
    }

    if (!authHeader) {
        console.warn("[resolveIdentity] No Authorization header found!");
        return null;
    }
    const token = authHeader.replace('Bearer ', '');
    console.log("[resolveIdentity] Authorization token starts with:", token.substring(0, 15) + "...");

    // 1. Try Standard Supabase Auth
    try {
        const { data: { user }, error: userErr } = await supabase.auth.getUser(token);
        if (userErr) {
            console.log("[resolveIdentity] Standard Supabase Auth returned error:", userErr.message);
        }
        if (!userErr && user) {
            console.log("[resolveIdentity] Standard Supabase Auth succeeded for user:", user.id);
            return {
                organizationId: user.app_metadata?.organization_id,
                branchId: '', // Standard users might not be bound to one branch
                userId: user.id,
                role: user.app_metadata?.role
            };
        }
    } catch (e) {
        console.error("[resolveIdentity] Standard Supabase Auth threw error:", e);
    }

    // 2. Try Signed Branch Token
    console.log("[resolveIdentity] Attempting to verify branch token...");
    const branchIdentity = await verifyBranchToken(token);
    if (branchIdentity) {
        console.log("[resolveIdentity] Branch token verification succeeded!");
        return branchIdentity;
    }

    console.warn("[resolveIdentity] Both standard auth and branch token verification failed!");
    return null;
}

/**
 * Basic Rate Limiter using Upstash Redis
 * @param redis Upstash Redis client
 * @param identifier Unique ID (e.g., user.id or IP)
 * @param limit Max requests
 * @param windowSeconds Window in seconds
 */
export async function rateLimit(redis: any, identifier: string, limit: number, windowSeconds: number): Promise<{ success: boolean; remaining: number }> {
    if (!redis) return { success: true, remaining: 999 }; // Fail open if redis is down? Or fail closed? (Audit says fail open for MVP)

    const key = `ratelimit:${identifier}`;
    const count = await redis.incr(key);

    if (count === 1) {
        await redis.expire(key, windowSeconds);
    }

    return {
        success: count <= limit,
        remaining: Math.max(0, limit - count)
    };
}

/**
 * Log a security-sensitive action to the business_audit_logs table
 */
export async function logAudit(
    supabase: any,
    organizationId: string,
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata: any = {}
) {
    try {
        await supabase.from('business_audit_logs').insert({
            organization_id: organizationId,
            actor_id: userId,
            action,
            entity_type: entityType,
            entity_id: entityId,
            metadata,
            created_at: new Date().toISOString()
        });
    } catch (e) {
        console.error("[AUDIT LOG ERROR] Failed to insert audit log:", e.message);
    }
}

