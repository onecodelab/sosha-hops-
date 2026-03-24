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

// Verifier service URL and API key from environment
const VERIFIER_URL = import.meta.env.VITE_VERIFIER_URL || 'http://localhost:3002';
const VERIFIER_API_KEY = import.meta.env.VITE_VERIFIER_API_KEY || 'test-key-123';

/**
 * Calls the local verifier-service's /verify-payment endpoint directly.
 * No job queue, no edge function — direct HTTP call.
 */
export function usePaymentVerification() {
    const { organizationId } = useAuth();
    const [job, setJob] = useState<VerificationJob | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const startVerification = async (params: StartVerificationParams) => {
        if (!organizationId) {
            setError("No Organization ID found. Please log in again.");
            return;
        }

        setIsVerifying(true);
        setError(null);
        setJob(null);

        try {
            // Build the payload for the verifier service
            const payload: any = {
                payment_method: params.payment_method,
                reference: params.reference,
                expected_amount: params.expected_amount,
            };

            // Add bank-specific params from additional_data
            if (params.additional_data) {
                if (params.additional_data.accountSuffix) {
                    payload.accountSuffix = params.additional_data.accountSuffix;
                }
                if (params.additional_data.suffix) {
                    payload.suffix = params.additional_data.suffix;
                }
                if (params.additional_data.expected_receiver) {
                    payload.expected_receiver = params.additional_data.expected_receiver;
                }
                if (params.additional_data.phoneNumber) {
                    payload.phoneNumber = params.additional_data.phoneNumber;
                }
                if (params.additional_data.receiptNumber) {
                    payload.receiptNumber = params.additional_data.receiptNumber;
                }
            }

            console.log('[Verify] Calling verifier service:', `${VERIFIER_URL}/verify-payment`, payload);

            // Call the local verifier service directly
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout

            const response = await fetch(`${VERIFIER_URL}/verify-payment`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': VERIFIER_API_KEY,
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            const data = await response.json();
            console.log('[Verify] Response:', data);

            if (!response.ok) {
                throw new Error(data?.error || `Verifier returned ${response.status}`);
            }

            // Build a job-like response for backward compatibility with the BillModal UI
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
            console.error("Failed to verify payment:", err);

            const errorMessage = err.name === 'AbortError'
                ? 'Verification timed out. Please try again.'
                : (err.message || 'Verification failed');

            // Build a failed job for UI consistency
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
