import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { showToast } from '@/components/ui';

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
const RAW_RAILWAY_KEY = import.meta.env.VITE_RAILWAY_API_KEY || import.meta.env.VITE_VERIFIER_API_KEY || 'test-key-123';
const RAILWAY_API_KEY = RAW_RAILWAY_KEY.includes(',') ? RAW_RAILWAY_KEY.split(',')[0].trim() : RAW_RAILWAY_KEY;

// Secondary: Official verify.et platform API
// Uses x-api-key header and unified /api/verify endpoint
const OFFICIAL_SDK_BASE = 'https://verify.et';
const LEUL_API_KEY = 'VERIFY_BANK_ET_D1z7Tz7xL2nNSO4MXMTL-PWhvk7LBZzdaRxCFYBOWTEId_VuhzUxJ2HV_UMEeePZ';

// Check if the env var points to a valid, non-dead URL
const envUrl = import.meta.env.VITE_VERIFIER_URL || '';
const DEAD_HOSTS = ['trycloudflare.com', 'localhost', '127.0.0.1'];
const isEnvUrlDead = !envUrl || DEAD_HOSTS.some(dead => envUrl.includes(dead)) || envUrl === 'VITE_VERIFIER_URL';

// Use env URL only if it's valid, otherwise fall back to Railway
const PRIMARY_URL = isEnvUrlDead ? RAILWAY_URL : envUrl;

/**
 * Maps a payment_method key to the unified verify.et /api/verify endpoint.
 * Auth: x-api-key header.
 */
function buildOfficialSDKRequest(method: string, reference: string, additional_data: any = {}): { path: string; body: Record<string, any> } | null {
    const ref = reference.trim().toUpperCase();
    const suffix = additional_data.suffix || additional_data.accountSuffix || additional_data.expected_receiver || additional_data.receiver_account || '';
    const phoneNumber = additional_data.phoneNumber || additional_data.phone || '';

    return {
        path: '/api/verify',
        body: {
            bank: method,
            reference: ref,
            ...(suffix ? { suffix: String(suffix), accountSuffix: String(suffix) } : {}),
            ...(phoneNumber ? { phoneNumber: String(phoneNumber), phone: String(phoneNumber) } : {})
        }
    };
}

/**
 * Normalise a raw response from verify.et into our standard shape.
 */
function normalizeOfficialSDKResponse(raw: any, method: string, reference: string, expected_amount: number): any {
    if (!raw) return { success: false, validated: false, error: 'Empty response' };

    // Handle nested array in .data wrapper from verify.et
    const dRaw = (raw?.data && typeof raw.data === 'object') ? (Array.isArray(raw.data) ? raw.data[0] : raw.data) : raw;
    const d = (dRaw && typeof dRaw === 'object' && dRaw.result) ? dRaw.result : dRaw;

    // Detect success signals across all bank response formats
    const isOk = raw?.ok === true || raw?.success === true || raw?.validated === true || d?.status === 'success' || d?.verified === true;
    if (!isOk || raw?.error || d?.status === 'failed') {
        return {
            success: false,
            validated: false,
            error: raw?.error || d?.reason || raw?.message || 'Transaction not found or verification failed',
            raw
        };
    }

    // Extract amount
    const amountRaw = d?.amount ?? d?.settledAmount ?? d?.totalPaidAmount ?? d?.txnAmount ?? d?.amountValue ?? null;
    const amount = amountRaw ? parseFloat(String(amountRaw).replace(/[^0-9.]/g, '')) : null;

    // Amount validation: ensure it meets expected_amount
    const amountMatches = amount !== null && amount >= (expected_amount * 0.99);

    return {
        success: true,
        validated: amountMatches,
        amount: amount ?? expected_amount,
        receipt_reference: d?.referenceNumber ?? d?.reference ?? reference,
        payer_name: d?.senderName ?? d?.payerName ?? d?.payer ?? null,
        receiver_account: d?.receiverAccount ?? d?.receiverName ?? null,
        transaction_date: d?.timestamp ?? d?.txnDate ?? d?.paymentDate ?? d?.date ?? null,
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

        const keys = RAW_RAILWAY_KEY.split(',').map(k => k.trim()).filter(Boolean);
        let lastErr: any = null;
        const cacheBuster = `?cb=${Date.now()}`;

        for (const apiKey of keys) {
            console.log(`[Verify] Attempt 1 — Railway (${apiKey.slice(0, 5)}...):`, `${PRIMARY_URL}/verify-payment${cacheBuster}`);
            try {
                const response = await fetch(`${PRIMARY_URL}/verify-payment${cacheBuster}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': apiKey,
                    },
                    body: JSON.stringify(payload),
                    signal: controller.signal,
                });

                if (response.status === 403) {
                    console.warn(`[Verify] Railway key ${apiKey.slice(0, 5)}... rejected (403). Trying next...`);
                    continue;
                }

                if (!response.ok) {
                    const text = await response.text().catch(() => '');
                    throw new Error(`Railway HTTP ${response.status}: ${text.slice(0, 200)}`);
                }

                const data = await response.json();
                const systemError = data?.error?.toLowerCase() || '';
                if (data && !data.success && (systemError.includes('chrome') || systemError.includes('puppeteer') || systemError.includes('browser') || systemError.includes('eai_again'))) {
                    throw new Error('Railway System Error: ' + systemError);
                }

                clearTimeout(timeoutId);
                return data;
            } catch (err: any) {
                lastErr = err;
                if (err.name === 'AbortError') break;
            }
        }

        clearTimeout(timeoutId);
        throw lastErr || new Error('All Railway keys failed');
    };

    // ── Attempt 2: Official @creofam/verifier SDK (verify.et) ──
    // Uses x-api-key auth and calls per-bank endpoints (/verify-cbe, /verify-telebirr, etc.)
    // This matches EXACTLY what verify.et uses internally.
    const tryOfficialSDK = async (params: StartVerificationParams): Promise<any> => {
        const request = buildOfficialSDKRequest(params.payment_method, params.reference, params.additional_data);
        if (!request) {
            throw new Error(`No SDK adapter for payment method: ${params.payment_method}`);
        }

        if (!LEUL_API_KEY) {
            throw new Error('VITE_LEUL_API_KEY or VITE_VERIFIER_API_KEY is not configured');
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 20000);
        const cacheBuster = `?cb=${Date.now()}`;

        console.log('[Verify] Attempt 2 — Official SDK:', `${OFFICIAL_SDK_BASE}${request.path}${cacheBuster}`, request.body);

        try {
            const response = await fetch(`${OFFICIAL_SDK_BASE}${request.path}${cacheBuster}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': LEUL_API_KEY,
                    'accept': 'application/json',
                },
                body: JSON.stringify(request.body),
                signal: controller.signal,
            });

            const raw = await response.json().catch(() => null);

            // If it failed and we sent an accountSuffix, 
            // try one more time WITHOUT the suffix (sometimes CBE works without it)
            if (params.payment_method === 'cbe' && !response.ok) {
                console.warn('[Verify] SDK failed with suffix, trying WITHOUT suffix...');
                const retryResponse = await fetch(`${OFFICIAL_SDK_BASE}/api/verify`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': LEUL_API_KEY,
                    },
                    body: JSON.stringify({ bank: 'cbe', reference: params.reference.trim().toUpperCase() }),
                    signal: controller.signal,
                });
                const retryRaw = await retryResponse.json().catch(() => null);
                if (retryResponse.ok && (retryRaw?.ok || retryRaw?.success)) {
                    clearTimeout(timeoutId);
                    return normalizeOfficialSDKResponse(retryRaw, params.payment_method, params.reference, params.expected_amount);
                }
            }

            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`Official SDK HTTP ${response.status}: ${JSON.stringify(raw)?.slice(0, 200)}`);
            }

            return normalizeOfficialSDKResponse(raw, params.payment_method, params.reference, params.expected_amount);
        } catch (err) {
            clearTimeout(timeoutId);
            throw err;
        }
    };

    // ── Attempt 1: Supabase Edge Function Proxy (Server-side, No CORS) ──
    const trySupabaseProxy = async (params: StartVerificationParams): Promise<any> => {
        const { supabase } = await import('@/lib/supabase');

        const payload = {
            bank: params.payment_method,
            transaction_id: params.reference.trim().toUpperCase(),
            receiver_account: params.additional_data?.expected_receiver || params.additional_data?.accountSuffix || params.additional_data?.suffix || '',
            phone_number: params.additional_data?.phoneNumber || params.additional_data?.phone || '',
            suffix: params.additional_data?.suffix || params.additional_data?.accountSuffix || '',
            amount: params.expected_amount,
            organization_id: organizationId
        };

        console.log('[Verify] Attempt 1 — Supabase Proxy:', payload);

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

            // ATTEMPT 1: Supabase Proxy (bypasses browser CORS completely)
            try {
                data = await trySupabaseProxy(params);
                console.log('[Verify] Supabase Proxy response:', data);
            } catch (proxyErr: any) {
                console.warn('[Verify] Supabase Proxy failed, trying Railway...', proxyErr.message);

                // ATTEMPT 2: Railway
                try {
                    data = await tryRailway(params);
                    console.log('[Verify] Railway response:', data);
                } catch (railwayErr: any) {
                    console.warn('[Verify] Railway failed, trying Official SDK...', railwayErr.message);

                    // ATTEMPT 3: Official SDK
                    try {
                        data = await tryOfficialSDK(params);
                        console.log('[Verify] Official SDK response:', data);
                    } catch (sdkErr: any) {
                        console.error('[Verify] All tiers failed.');
                        throw new Error(
                            `Verification unavailable. Proxy: ${proxyErr.message}. Railway: ${railwayErr.message}. SDK: ${sdkErr.message}`
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
                    error: data?.error || data?.message,
                    validation: data?.validation || null,
                },
                last_error: !isSuccess ? (data?.error || data?.message || 'Transaction not found or amount mismatch') : undefined,
                created_at: new Date().toISOString(),
            };

            setJob(jobResult);

            if (!isSuccess) {
                const foundAmount = data?.amount ?? data?.amount_found ?? data?.result_data?.amount;
                const expected = params.expected_amount;
                const hasAmount = foundAmount !== undefined && foundAmount !== null && !isNaN(Number(foundAmount));

                if (hasAmount && Number(foundAmount) < expected) {
                    const shortage = (expected - Number(foundAmount)).toFixed(2);
                    const bannerHtml = `
                        <div class="space-y-1.5">
                            <div class="flex items-center justify-between border-b border-white/20 pb-1 font-black text-xs uppercase tracking-wider">
                                <span>⚠️ የክፍያ ጉድለት / PAYMENT SHORTAGE</span>
                            </div>
                            <div class="text-xs space-y-0.5">
                                <div>ደረሰኝ ድምር (Bill Total): <span class="font-mono font-bold">${expected.toFixed(2)} ETB</span></div>
                                <div>የተከፈለው (Paid in Bank): <span class="font-mono font-black text-yellow-300">${Number(foundAmount).toFixed(2)} ETB</span></div>
                                <div class="text-red-200 font-bold">የቀረው ያልተከፈለ (Missing): <span class="font-mono text-white underline">${shortage} ETB</span></div>
                            </div>
                            <div class="text-[11px] opacity-90 italic">
                                የተከፈለው መጠን ከትዕዛዙ ያንሳል! እባክዎ የቀረውን ${shortage} ብር ያስከፍሉ። / Amount paid is less than bill total. Please collect remaining balance.
                            </div>
                        </div>
                    `;
                    showToast(bannerHtml, 'error', 10000);
                } else {
                    const failReason = data?.error || data?.message || 'Transaction reference not found or invalid';
                    const bannerHtml = `
                        <div class="space-y-1">
                            <div class="font-black text-xs uppercase tracking-wider border-b border-white/20 pb-1">
                                ❌ ማረጋገጥ አልተቻለም / VERIFICATION FAILED
                            </div>
                            <div class="text-xs font-medium">${failReason}</div>
                            <div class="text-[11px] opacity-80">እባክዎ የባንክ ማጣቀሻ ቁጥሩን (Reference Number) ትክክለኛነት ከደንበኛው ጋር ያረጋግጡ። / Please verify transaction reference with customer.</div>
                        </div>
                    `;
                    showToast(bannerHtml, 'error', 10000);
                }

                setError(data?.error || data?.message || 'Transaction not found or amount mismatch');
            } else {
                showToast(`የክፍያ ማረጋገጫ ተሳክቷል! ${data?.amount || params.expected_amount} ETB Verified ✓`, 'success', 4000);
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
