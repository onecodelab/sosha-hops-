import { useState } from 'react';
import { useAuth } from '../AuthContext';

export interface VerificationJob {
    id: string;
    organization_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    result_data?: any;
    last_error?: string;
    created_at: string;
}

interface StartVerificationParams {
    payment_method: string;
    reference: string;
    amount?: number;
    expected_amount: number;
    additional_data?: any;
}

// ================================================================
// VERIFIER CONFIGURATION — Hardcoded for reliability
// ================================================================

// Primary: Your Railway-hosted verifier service
const RAILWAY_URL = 'https://verifier-service-repo-production.up.railway.app';

// Secondary Backup: Official SDK (different endpoint & auth format)
const OFFICIAL_SDK_URL = 'https://verifyapi.leulzenebe.pro';

// API keys for different tiers
const RAILWAY_API_KEY = import.meta.env.VITE_RAILWAY_API_KEY || import.meta.env.VITE_VERIFIER_API_KEY || 'test-key-123';
const LEUL_API_KEY = import.meta.env.VITE_LEUL_API_KEY || import.meta.env.VITE_VERIFIER_API_KEY || 'test-key-123';

// Check if the env var points to a valid, non-dead URL
const envUrl = import.meta.env.VITE_VERIFIER_URL || '';
const DEAD_HOSTS = ['trycloudflare.com', 'localhost', '127.0.0.1'];
const isEnvUrlDead = !envUrl || DEAD_HOSTS.some(dead => envUrl.includes(dead)) || envUrl === 'VITE_VERIFIER_URL';

// Use env URL only if it's valid, otherwise use Railway
const PRIMARY_URL = isEnvUrlDead ? RAILWAY_URL : envUrl;

/**
 * Payment verification hook with automatic failover.
 * 
 * Flow:
 *   1. Try PRIMARY (Railway or valid env URL) via POST /verify-payment
 *   2. If that fails, try OFFICIAL SDK via POST /verify (different format)
 *   3. If both fail, return a clear error to the user
 */
export function usePaymentVerification() {
    const { organizationId } = useAuth();
    const [job, setJob] = useState<VerificationJob | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // ── Attempt 1: Railway verifier (/verify-payment) ──
    const tryRailway = async (params: StartVerificationParams): Promise<any> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 25000);

        const payload: any = {
            payment_method: params.payment_method,
            reference: params.reference,
            expected_amount: params.expected_amount,
        };

        // Merge bank-specific params
        if (params.additional_data) {
            Object.assign(payload, params.additional_data);
        }

        console.log('[Verify] Attempt 1 — Railway:', `${PRIMARY_URL}/verify-payment`);

        try {
            const response = await fetch(`${PRIMARY_URL}/verify-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': RAILWAY_API_KEY,
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(`Railway HTTP ${response.status}: ${text.slice(0, 100)}`);
            }

            const data = await response.json();
            // If the service returned a JSON error body, treat it as success path
            // (the caller will check data.success/data.validated)
            return data;
        } catch (err) {
            clearTimeout(timeoutId);
            throw err;
        }
    };

    // ── Attempt 2: Official SDK (/verify) — different payload format ──
    const tryOfficialSDK = async (params: StartVerificationParams): Promise<any> => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        // The official SDK uses a different payload shape:
        //   { bank, transaction_id, receiver_account }
        // And uses Authorization: Bearer <key> instead of x-api-key
        const payload: any = {
            bank: params.payment_method,
            transaction_id: params.reference,
        };

        // Map receiver account from additional_data
        if (params.additional_data) {
            payload.receiver_account =
                params.additional_data.accountSuffix ||
                params.additional_data.suffix ||
                params.additional_data.expected_receiver ||
                undefined;
        }

        console.log('[Verify] Attempt 2 — Official SDK:', `${OFFICIAL_SDK_URL}/verify`);

        try {
            const response = await fetch(`${OFFICIAL_SDK_URL}/verify`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${LEUL_API_KEY}`,
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                const text = await response.text().catch(() => '');
                throw new Error(`Official SDK HTTP ${response.status}: ${text.slice(0, 100)}`);
            }

            const raw = await response.json();

            // Normalize the official SDK response to match our expected shape
            return {
                success: raw.success ?? raw.validated ?? false,
                validated: raw.validated ?? false,
                amount: raw.amount ?? raw.amount_found ?? params.expected_amount,
                receipt_reference: raw.receipt_reference ?? params.reference,
                error: raw.error ?? raw.message,
                validation: raw.validation ?? null,
            };
        } catch (err) {
            clearTimeout(timeoutId);
            throw err;
        }
    };

    // ── Attempt 3: Supabase Proxy (Internal) ──
    // This calls your own Edge Function which proxies to the official SDK.
    // It's the most secure because the API key is kept in Supabase secrets.
    const trySupabaseProxy = async (params: StartVerificationParams): Promise<any> => {
        const { supabase } = await import('../supabase');
        
        const payload = {
            bank: params.payment_method,
            transaction_id: params.reference,
            receiver_account: params.additional_data?.expected_receiver || params.additional_data?.accountSuffix,
            amount: params.expected_amount
        };

        console.log('[Verify] Attempt 3 — Supabase Proxy');

        const { data, error } = await supabase.functions.invoke('verify-payment', {
            body: payload
        });

        if (error) throw error;
        return data;
    };

    // ── Main verification entry point ──
    const startVerification = async (params: StartVerificationParams) => {
        if (!organizationId) {
            setError("No Organization ID found. Please log in again.");
            return;
        }

        setIsVerifying(true);
        setError(null);
        setJob(null);

        try {
            let data: any;

            // ATTEMPT 1: Railway service
            try {
                data = await tryRailway(params);
                console.log('[Verify] Railway response:', data);

                const systemError = data?.error?.toLowerCase() || '';
                if (data && !data.success && (systemError.includes('chrome') || systemError.includes('puppeteer') || systemError.includes('browser'))) {
                    throw new Error('Railway System Error: ' + systemError);
                }
            } catch (railwayErr: any) {
                console.warn('[Verify] Railway failed, trying Tier 2 (Official SDK)...');

                // ATTEMPT 2: Official SDK (Direct)
                try {
                    data = await tryOfficialSDK(params);
                    console.log('[Verify] Official SDK succeeded:', data);
                } catch (sdkErr: any) {
                    console.warn('[Verify] Official SDK failed, trying Tier 3 (Internal Proxy)...');
                    
                    // ATTEMPT 3: Internal Supabase Proxy
                    try {
                        data = await trySupabaseProxy(params);
                        console.log('[Verify] Supabase Proxy succeeded:', data);
                    } catch (proxyErr: any) {
                        console.error('[Verify] All tiers failed.');
                        throw new Error(
                            `Verification unavailable. Railway: ${railwayErr.message}. SDK: ${sdkErr.message}. Local: ${proxyErr.message}`
                        );
                    }
                }
            }

            // Build job result for backward compatibility with BillModal UI
            const jobResult: VerificationJob = {
                id: crypto.randomUUID(),
                organization_id: organizationId,
                status: (data?.success && data?.validated) ? 'completed' : 'failed',
                result_data: {
                    success: data?.success || false,
                    validated: data?.validated || false,
                    amount: data?.amount || params.expected_amount,
                    receipt_reference: data?.receipt_reference || params.reference,
                    error: data?.error,
                    validation: data?.validation || null,
                },
                last_error: (!data?.success || !data?.validated)
                    ? (data?.error || 'Transaction not found or invalid')
                    : undefined,
                created_at: new Date().toISOString(),
            };

            setJob(jobResult);

            if (!data?.success || !data?.validated) {
                setError(data?.error || 'Transaction not found or invalid');
            }

        } catch (err: any) {
            console.error('[Verify] All attempts exhausted:', err.message);

            const errorMessage = err.name === 'AbortError'
                ? 'Verification timed out. Both services are unavailable. Please try again later.'
                : (err.message || 'Verification failed');

            const failedJob: VerificationJob = {
                id: crypto.randomUUID(),
                organization_id: organizationId,
                status: 'failed',
                result_data: { success: false, error: errorMessage },
                last_error: errorMessage,
                created_at: new Date().toISOString(),
            };
            setJob(failedJob);
            setError(errorMessage);
        } finally {
            setIsVerifying(false);
        }
    };

    return {
        startVerification,
        job,
        isVerifying,
        error,
        reset: () => {
            setJob(null);
            setIsVerifying(false);
            setError(null);
        }
    };
}
