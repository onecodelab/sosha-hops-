import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ShieldAlert, Clock, AlertTriangle, LogOut } from 'lucide-react';

const ZERO_ORG = '00000000-0000-0000-0000-000000000000';

/** Locked screen for pending/suspended accounts */
const AccountLockedScreen: React.FC<{ status: string; onSignOut: () => void }> = ({ status, onSignOut }) => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-white gap-8 p-6 text-center">
        <div className="relative">
            <div className="absolute inset-0 bg-amber-500/20 blur-[80px] rounded-full" />
            <div className="relative p-6 bg-amber-500/10 rounded-[2rem] border border-amber-500/20">
                <Clock className="w-16 h-16 text-amber-500" />
            </div>
        </div>
        <div className="max-w-md space-y-3">
            <h1 className="text-3xl font-black tracking-tight">Account {status === 'suspended' ? 'Suspended' : 'Pending'}</h1>
            <p className="text-muted text-sm font-medium leading-relaxed">
                {status === 'suspended'
                    ? 'Your account has been suspended. Please contact support for assistance.'
                    : "Your account is pending approval. We'll be in touch soon."}
            </p>
        </div>
        <button
            onClick={onSignOut}
            className="flex items-center gap-3 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white/60 hover:text-white hover:bg-white/10 transition-all"
        >
            <LogOut className="w-4 h-4" /> Sign Out
        </button>
    </div>
);

/** Error screen for incomplete or invalid accounts */
const AccountErrorScreen: React.FC<{ title: string; message: string; onSignOut: () => void }> = ({ title, message, onSignOut }) => (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background text-white gap-8 p-6 text-center">
        <div className="relative">
            <div className="absolute inset-0 bg-red-500/20 blur-[80px] rounded-full" />
            <div className="relative p-6 bg-red-500/10 rounded-[2rem] border border-red-500/20">
                <AlertTriangle className="w-16 h-16 text-red-500" />
            </div>
        </div>
        <div className="max-w-md space-y-3">
            <h1 className="text-3xl font-black tracking-tight">{title}</h1>
            <p className="text-muted text-sm font-medium leading-relaxed">{message}</p>
        </div>
        <button
            onClick={onSignOut}
            className="flex items-center gap-3 px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white/60 hover:text-white hover:bg-white/10 transition-all"
        >
            <LogOut className="w-4 h-4" /> Sign Out
        </button>
    </div>
);

const AppDispatcher: React.FC = () => {
    const { profile, loading, signOut } = useAuth();
    const navigate = useNavigate();
    const [guardState, setGuardState] = useState<'loading' | 'locked' | 'error' | 'ok'>('loading');
    const [errorInfo, setErrorInfo] = useState({ title: '', message: '' });

    useEffect(() => {
        if (loading) return;
        if (!profile) return;

        // Guard 1: Check account status
        if (profile.status && profile.status !== 'active') {
            setGuardState('locked');
            return;
        }

        // Guard 2: Owner stuck in default org
        if (profile.organization_id === ZERO_ORG && profile.role?.toLowerCase() === 'owner') {
            setGuardState('error');
            setErrorInfo({
                title: 'Account Setup Incomplete',
                message: 'Your restaurant organization has not been set up yet. Please contact support to complete your account setup.'
            });
            return;
        }

        // Guard 3: Route by role
        const role = profile.role?.toLowerCase().trim();
        switch (role) {
            case 'super_admin': navigate('/app/baro-admin', { replace: true }); break;
            case 'owner': navigate('/app/admin', { replace: true }); break;
            case 'admin': navigate('/app/admin', { replace: true }); break;
            case 'manager': navigate('/app/manager', { replace: true }); break;
            case 'waiter': navigate('/app/waiter', { replace: true }); break;
            case 'kitchen': navigate('/app/kitchen', { replace: true }); break;
            case 'supplier': navigate('/app/supplier/dashboard', { replace: true }); break;
            case 'driver': navigate('/app/driver/dashboard', { replace: true }); break;
            default:
                setGuardState('error');
                setErrorInfo({
                    title: 'Invalid Account',
                    message: 'Your account has an unrecognized role. Please contact support.'
                });
                return;
        }
        setGuardState('ok');
    }, [profile, loading, navigate]);

    if (loading || guardState === 'loading' || guardState === 'ok') return <LoadingSpinner />;

    if (guardState === 'locked') {
        return <AccountLockedScreen status={profile?.status || 'pending'} onSignOut={signOut} />;
    }

    if (guardState === 'error') {
        return <AccountErrorScreen title={errorInfo.title} message={errorInfo.message} onSignOut={signOut} />;
    }

    return <LoadingSpinner />;
};

export default AppDispatcher;
