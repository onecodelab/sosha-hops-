import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
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

export function usePaymentVerification() {
    const { organizationId } = useAuth();
    const [job, setJob] = useState<VerificationJob | null>(null);
    const [isVerifying, setIsVerifying] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const channelRef = useRef<any>(null);

    // Cleanup subscription on unmount
    useEffect(() => {
        return () => {
            if (channelRef.current) supabase.removeChannel(channelRef.current);
        };
    }, []);

    const startVerification = async (params: StartVerificationParams) => {
        if (!organizationId) {
            setError("No Organization ID found. Please log in again.");
            return;
        }

        setIsVerifying(true);
        setError(null);
        setJob(null);

        try {
            // 1. Create Job
            const { data, error: insertError } = await supabase
                .from('payment_verification_jobs')
                .insert({
                    organization_id: organizationId,
                    payment_method: params.payment_method,
                    reference: params.reference,
                    expected_amount: params.expected_amount,
                    amount: params.amount,
                    additional_data: params.additional_data,
                    status: 'pending'
                })
                .select()
                .single();

            if (insertError) throw insertError;

            const newJob = data as VerificationJob;
            setJob(newJob);

            // 2. Subscribe to Realtime Updates
            if (channelRef.current) supabase.removeChannel(channelRef.current);

            const channel = supabase
                .channel(`job-${newJob.id}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'UPDATE',
                        schema: 'public',
                        table: 'payment_verification_jobs',
                        filter: `id=eq.${newJob.id}`
                    },
                    (payload) => {
                        const updatedJob = payload.new as VerificationJob;
                        setJob(updatedJob);

                        if (updatedJob.status === 'completed' || updatedJob.status === 'failed') {
                            setIsVerifying(false);
                            if (updatedJob.status === 'failed') {
                                setError(updatedJob.last_error || "Verification failed");
                            }
                        }
                    }
                )
                .subscribe();

            channelRef.current = channel;

        } catch (err: any) {
            console.error("Failed to start verification:", err);
            setError(err.message);
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
            if (channelRef.current) supabase.removeChannel(channelRef.current);
        }
    };
}
