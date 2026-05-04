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
// VERIFIER CONFIGURATION
// ================================================================

// Primary: Your Railway-hosted verifier service
const RAILWAY_URL = 'https://verifier-service-repo-production.up.railway.app';
const RAILWAY_API_KEY = import.meta.env.VITE_RAILWAY_API_KEY || 'test-key-123';

// Secondary: Official @creofam/verifier API (verifyapi.leulzenebe.pro)
// SDK uses x-api-key header and individual endpoints per bank (/verify-cbe, /verify-telebirr, etc.)
const OFFICIAL_SDK_BASE = 'https://verifyapi.leulzenebe.pro';
const LEUL_API_KEY = import.meta.env.VITE_LEUL_API_KEY || '';

// Check if the env var points to a valid, non-dead URL
const envUrl = import.meta.env.VITE_VERIFIER_URL || '';
const DEAD_HOSTS = ['trycloudflare.com', 'localhost', '127.0.0.1'];
const isEnvUrlDead = !envUrl || DEAD_HOSTS.some(dead => envUrl.includes(dead)) || envUrl === 'VITE_VERIFIER_URL';

// Use env URL only if it's valid, otherwise fall back to Railway
const PRIMARY_URL = isEnvUrlDead ? RAILWAY_URL : envUrl;

/**
 * Maps a payment_method key to the correct @creofam/verifier endpoint path and payload builder.
 * The SDK calls individual endpoints: /verify-cbe, /verify-telebirr, /verify-dashen, etc.
 * Auth: x-api-key header (NOT Authorization: Bearer).
 */
function buildOfficialSDKRequest(method: string, reference: string, additional_data: any = {}): { path: string; body: Record<string, any> } | null {
    const ref = reference.trim().toUpperCase();
    switch (method) {
        case 'cbe':
            return {
                path: '/verify-cbe',
                body: {
                    reference: ref,
                    accountSuffix: additional_data.accountSuffix || additional_data.expected_receiver || additional_data.receiver_account || ''
                }
            };
        case 'telebirr':
            return {
                path: '/verify-telebirr',
                body: { reference: ref }
            };
        case 'dashen':
            return {
                path: '/verify-dashen',
                body: { reference: ref }
            };
        case 'abyssinia':
            return {
                path: '/verify-abyssinia',
                body: {
                    reference: ref,
                    suffix: additional_data.suffix || additional_data.accountSuffix || additional_data.expected_receiver || ''
                }
            };
        case 'cbebirr':
            return {
                path: '/verify-cbebirr',
                body: {
                    reference: ref,
                    ...(additional_data.phoneNumber ? { phoneNumber: additional_data.phoneNumber } : {})
                }
            };
        default:
            return null;
    }
}

/**
 * Normalise a raw response from verifyapi.leulzenebe.pro into our standard shape.
 * Different banks return different field names — the SDK's adapter code handles this,
 * but since we're calling directly we normalize here.
 */
function normalizeOfficialSDKResponse(raw: any, method: string, reference: string, expected_amount: number): any {
    if (!raw) return { success: false, validated: false, error: 'Empty response' };

    // Handle nested .data wrapper
    const d = (raw?.data && typeof raw.data === 'object') ? raw.data : raw;

    // Detect success signals across all bank response formats
    const isOk = raw?.ok === true || raw?.success === true || raw?.validated === true;
    if (!isOk || raw?.error) {
        return {
            success: false,
            validated: false,
            error: raw?.error || 'Transaction not found or verification failed',
            raw
        };
    }

    // Extract amount — try multiple field names used by different banks
    const amountRaw = d?.amount ?? d?.settledAmount ?? d?.totalPaidAmount ?? d?.txnAmount ?? null;
    const amount = amountRaw ? parseFloat(String(amountRaw).replace(/[^0-9.]/g, '')) : null;

    // Amount validation: ensure it meets expected_amount (allow small rounding diff)
    const amountMatches = amount !== null && amount >= (expected_amount * 0.99);

    return {
        success: true,
        validated: amountMatches,
        amount: amount ?? expected_amount,
        receipt_reference: d?.reference ?? reference,
        payer_name: d?.payerName ?? d?.payer ?? null,
        receiver_account: d?.receiverAccount ?? null,
        transaction_date: d?.txnDate ?? d?.paymentDate ?? d?.date ?? null,
        validation: {
            passed: amountMatches,
            reason: amountMatches ? 'Amount verified' : `Expected ${expected_amount}, got ${amount}`,
            amount_expected: expected_amount,
            amount_found: amount
        },
        raw
    };
}

/**
 * Payment verification hook with automatic failover.
 *
 * Flow:
 *   1. Try PRIMARY Railway service via POST /verify-payment
 *   2. If that fails, try Official SDK (verifyapi.leulzenebe.pro) using
 *      the CORRECT per-bank endpoints with x-api-key auth
 *   3. If both fail, proxy through Supabase Edge Function
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
            reference: params.reference.trim().toUpperCase(),
            expected_amount: params.expected_amount,
        };

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
                throw new Error(`Railway HTTP ${response.status}: ${text.slice(0, 200)}`);
            }

            const data = await response.json();

            // If the Railway service itself reports a system error (puppeteer/chrome crash), fall through
            const systemError = data?.error?.toLowerCase() || '';
            if (data && !data.success && (systemError.includes('chrome') || systemError.includes('puppeteer') || systemError.includes('browser') || systemError.includes('eai_again'))) {
                throw new Error('Railway System Error: ' + systemError);
            }

            return data;
        } catch (err) {
            clearTimeout(timeoutId);
            throw err;
        }
    };

    // ── Attempt 2: Official @creofam/verifier SDK (verifyapi.leulzenebe.pro) ──
    // Uses x-api-key auth and calls per-bank endpoints (/verify-cbe, /verify-telebirr, etc.)
    // This matches EXACTLY what verify.leul.et uses internally.
    const tryOfficialSDK = async (params: StartVerificationParams): Promise<any> => {
        const request = buildOfficialSDKRequest(params.payment_method, params.reference, params.additional_data);
        if (!request) {
            throw new Error(`No SDK adapter for payment method: ${params.payment_method}`);
        }

        if (!LEUL_API_KEY) {
            throw new Error('VITE_LEUL_API_KEY is not configured');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);

        console.log('[Verify] Attempt 2 — Official SDK:', `${OFFICIAL_SDK_BASE}${request.path}`, request.body);

        try {
            const response = await fetch(`${OFFICIAL_SDK_BASE}${request.path}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': LEUL_API_KEY,
                    'accept': 'application/json',
                },
                body: JSON.stringify(request.body),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const raw = await response.json().catch(() => null);

            if (!response.ok) {
                throw new Error(`Official SDK HTTP ${response.status}: ${JSON.stringify(raw)?.slice(0, 200)}`);
            }

            // Normalize the response to our standard shape
            return normalizeOfficialSDKResponse(raw, params.payment_method, params.reference, params.expected_amount);
        } catch (err) {
            clearTimeout(timeoutId);
            throw err;
        }
    };

    // ── Attempt 3: Supabase Edge Function Proxy ──
    const trySupabaseProxy = async (params: StartVerificationParams): Promise<any> => {
        const { supabase } = await import('../supabase');

        const payload = {
            bank: params.payment_method,
            transaction_id: params.reference.trim().toUpperCase(),
            receiver_account: params.additional_data?.expected_receiver || params.additional_data?.accountSuffix,
            amount: params.expected_amount
        };

        console.log('[Verify] Attempt 3 — Supabase Proxy', payload);

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

            // ATTEMPT 1: Railway
            try {
                data = await tryRailway(params);
                console.log('[Verify] Railway response:', data);
            } catch (railwayErr: any) {
                console.warn('[Verify] Railway failed, trying Official SDK...', railwayErr.message);

                // ATTEMPT 2: Official SDK
                try {
                    data = await tryOfficialSDK(params);
                    console.log('[Verify] Official SDK response:', data);
                } catch (sdkErr: any) {
                    console.warn('[Verify] Official SDK failed, trying Supabase Proxy...', sdkErr.message);

                    // ATTEMPT 3: Supabase Proxy
                    try {
                        data = await trySupabaseProxy(params);
                        console.log('[Verify] Supabase Proxy response:', data);
                    } catch (proxyErr: any) {
                        console.error('[Verify] All tiers failed.');
                        throw new Error(
                            `Verification unavailable. Railway: ${railwayErr.message}. SDK: ${sdkErr.message}. Proxy: ${proxyErr.message}`
                        );
                    }
                }
            }

            // Build job result for BillModal UI
            const isSuccess = (data?.success === true) && (data?.validated === true);
            const jobResult: VerificationJob = {
                id: crypto.randomUUID(),
                organization_id: organizationId,
                status: isSuccess ? 'completed' : 'failed',
                result_data: {
                    success: data?.success || false,
                    validated: data?.validated || false,
                    amount: data?.amount || data?.amount_found || params.expected_amount,
                    receipt_reference: data?.receipt_reference || params.reference,
                    error: data?.error,
                    validation: data?.validation || null,
                },
                last_error: !isSuccess ? (data?.error || 'Transaction not found or amount mismatch') : undefined,
                created_at: new Date().toISOString(),
            };

            setJob(jobResult);

            if (!isSuccess) {
                setError(data?.error || 'Transaction not found or amount mismatch');
            }

        } catch (err: any) {
            console.error('[Verify] All attempts exhausted:', err.message);

            const errorMessage = err.name === 'AbortError'
                ? 'Verification timed out. Please try again.'
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
