import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLayoutConfig } from '../contexts/LayoutContext';
import { Button, cn, showToast, Badge } from '../components/ui';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import {
    Users,
    Store,
    Truck,
    ShieldCheck,
    UserPlus,
    Mail,
    Lock,
    Building,
    Database,
    Search,
    Clock,
    FileText,
    CheckCircle2,
    XCircle,
    Phone,
    MapPin,
    Package,
    Car,
    UtensilsCrossed,
    Hash,
    Loader2,
    Copy,
    CheckCheck,
    MoreVertical,
    Ban,
    RefreshCw,
    Trash2,
    AlertTriangle
} from 'lucide-react';

type ProvisionAction = 'create_owner' | 'create_supplier' | 'create_driver';
type MainTab = 'directory' | 'credits' | 'provision' | 'applications';

interface OrganizationCreditRow {
    id: string;
    name: string;
    plan: string | null;
    is_active: boolean | null;
    created_at: string;
    used_monthly_credits: number | null;
    max_monthly_credits: number | null;
    credit_reset_at: string | null;
}

interface OnboardingApplication {
    id: string;
    created_at: string;
    role: 'owner' | 'supplier' | 'driver';
    full_name: string;
    email: string;
    phone: string;
    restaurant_name?: string;
    restaurant_type?: string;
    city?: string;
    branch_count?: number;
    company_name?: string;
    supply_category?: string;
    cities_covered?: string;
    vehicle_type?: string;
    status: 'pending' | 'approved' | 'rejected';
}

export const BaroAdminDashboard: React.FC = () => {
    const { user } = useAuth();
    const queryClient = useQueryClient();
    const [mainTab, setMainTab] = useState<MainTab>('directory');
    const [activeTab, setActiveTab] = useState<ProvisionAction>('create_owner');
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [appFilter, setAppFilter] = useState<'pending' | 'all'>('pending');
    const [credentialModal, setCredentialModal] = useState<{ name: string; email: string; password: string; role: string } | null>(null);
    const [copied, setCopied] = useState(false);
    const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; name: string } | null>(null);
    const [openDropdown, setOpenDropdown] = useState<string | null>(null);
    const [creditTopUps, setCreditTopUps] = useState<Record<string, string>>({});
    const [planSelections, setPlanSelections] = useState<Record<string, 'basic' | 'pro' | 'enterprise'>>({});

    const { data: accounts, isLoading: isLoadingAccounts } = useQuery({
        queryKey: ['admin-accounts'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select(`
                    id, email, full_name, role, created_at, status, organization_id,
                    organization:organizations(name)
                `)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data;
        }
    });

    const { data: organizations, isLoading: isLoadingOrganizations } = useQuery({
        queryKey: ['admin-organizations'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('organizations')
                .select('id, name, plan, is_active, created_at, used_monthly_credits, max_monthly_credits, credit_reset_at')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as OrganizationCreditRow[];
        }
    });

    const { data: applications, isLoading: isLoadingApps } = useQuery({
        queryKey: ['onboarding-applications', appFilter],
        queryFn: async () => {
            let query = supabase
                .from('onboarding_applications')
                .select('*')
                .order('created_at', { ascending: false });

            if (appFilter === 'pending') {
                query = query.eq('status', 'pending');
            }

            const { data, error } = await query;
            if (error) throw error;
            return data as OnboardingApplication[];
        }
    });

    const { mutate: approveApplication, isPending: isApproving } = useMutation({
        mutationFn: async (app: OnboardingApplication) => {
            // Generate a temporary password
            const tempPassword = `Baro_${Date.now().toString(36)}!`;

            // Map role to action
            const actionMap: Record<string, ProvisionAction> = {
                owner: 'create_owner',
                supplier: 'create_supplier',
                driver: 'create_driver',
            };

            // Call provision-user edge function
            const { data, error } = await supabase.functions.invoke('provision-user', {
                body: {
                    action: actionMap[app.role],
                    email: app.email,
                    password: tempPassword,
                    fullName: app.full_name,
                    organizationName: app.role === 'supplier' ? app.company_name : (app.restaurant_name || `${app.full_name}'s Restaurant`),
                }
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error);

            // Mark application as approved
            const { error: updateError } = await supabase
                .from('onboarding_applications')
                .update({ status: 'approved' })
                .eq('id', app.id);

            if (updateError) throw updateError;

            return { tempPassword, userId: data.userId };
        },
        onSuccess: (result, app) => {
            setCredentialModal({
                name: app.full_name,
                email: app.email,
                password: result.tempPassword,
                role: app.role,
            });
            setCopied(false);
            queryClient.invalidateQueries({ queryKey: ['onboarding-applications'] });
            queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
        },
        onError: (err: any) => {
            showToast(err.message || 'Failed to approve application', 'error');
        }
    });

    const { mutate: rejectApplication, isPending: isRejecting } = useMutation({
        mutationFn: async (appId: string) => {
            const { error } = await supabase
                .from('onboarding_applications')
                .update({ status: 'rejected' })
                .eq('id', appId);

            if (error) throw error;
        },
        onSuccess: () => {
            showToast('Application rejected.', 'success');
            queryClient.invalidateQueries({ queryKey: ['onboarding-applications'] });
        },
        onError: (err: any) => {
            showToast(err.message || 'Failed to reject application', 'error');
        }
    });

    const { mutate: suspendUser, isPending: isSuspending } = useMutation({
        mutationFn: async (userId: string) => {
            const { error } = await supabase
                .from('profiles')
                .update({ status: 'suspended' })
                .eq('id', userId);
            if (error) throw error;
        },
        onSuccess: () => {
            showToast('User suspended.', 'success');
            queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
            setOpenDropdown(null);
        },
        onError: (err: any) => showToast(err.message || 'Failed to suspend user', 'error'),
    });

    const { mutate: reactivateUser, isPending: isReactivating } = useMutation({
        mutationFn: async (userId: string) => {
            const { error } = await supabase
                .from('profiles')
                .update({ status: 'active' })
                .eq('id', userId);
            if (error) throw error;
        },
        onSuccess: () => {
            showToast('User reactivated.', 'success');
            queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
            setOpenDropdown(null);
        },
        onError: (err: any) => showToast(err.message || 'Failed to reactivate user', 'error'),
    });

    const { mutate: deleteUser, isPending: isDeleting } = useMutation({
        mutationFn: async (userId: string) => {
            const { data, error } = await supabase.functions.invoke('delete-user', {
                body: { userId }
            });
            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error);
        },
        onSuccess: () => {
            showToast('User permanently deleted.', 'success');
            queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
            setDeleteConfirm(null);
            setOpenDropdown(null);
        },
        onError: (err: any) => showToast(err.message || 'Failed to delete user', 'error'),
    });

    const { mutate: bulkActivate, isPending: isBulkActivating } = useMutation({
        mutationFn: async () => {
            const { data, error } = await supabase.functions.invoke('provision-user', {
                body: { action: 'bulk_activate' }
            });
            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error);
            return data;
        },
        onSuccess: (data) => {
            showToast(`Successfully activated ${data.count || 0} accounts!`, 'success');
            queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
        },
        onError: (err: any) => showToast(err.message || 'Failed to bulk activate accounts', 'error'),
    });

    const { mutate: setupOrganization, isPending: isSettingUp } = useMutation({
        mutationFn: async ({ userId, organizationName }: { userId: string, organizationName: string }) => {
            const { data, error } = await supabase.functions.invoke('provision-user', {
                body: { action: 'setup_organization', userId, organizationName }
            });
            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error);
            return data;
        },
        onSuccess: () => {
            showToast('Organization setup complete!', 'success');
            queryClient.invalidateQueries({ queryKey: ['admin-accounts'] });
            setSetupOrgModal(null);
            setOpenDropdown(null);
        },
        onError: (err: any) => showToast(err.message || 'Failed to setup organization', 'error'),
    });

    const { mutate: topUpCredits, isPending: isTopingUpCredits } = useMutation({
        mutationFn: async ({ organizationId, amount }: { organizationId: string; amount: number }) => {
            const { data, error } = await supabase.rpc('admin_topup_monthly_credits', {
                p_organization_id: organizationId,
                p_amount: amount,
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error || 'Top up failed');
            return data;
        },
        onSuccess: (_, vars) => {
            showToast(`Added ${vars.amount} credits successfully.`, 'success');
            queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
            setCreditTopUps(prev => {
                const next = { ...prev };
                delete next[vars.organizationId];
                return next;
            });
        },
        onError: (err: any) => showToast(err.message || 'Failed to add credits', 'error'),
    });

    const { mutate: changePlan, isPending: isChangingPlan } = useMutation({
        mutationFn: async ({ organizationId, plan }: { organizationId: string; plan: 'basic' | 'pro' | 'enterprise' }) => {
            const { data, error } = await supabase.rpc('admin_update_organization_plan', {
                p_organization_id: organizationId,
                p_plan: plan,
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error || 'Plan update failed');
            return data;
        },
        onSuccess: (_, vars) => {
            showToast(`Organization switched to ${vars.plan.toUpperCase()}.`, 'success');
            queryClient.invalidateQueries({ queryKey: ['admin-organizations'] });
        },
        onError: (err: any) => showToast(err.message || 'Failed to update plan', 'error'),
    });

    const [setupOrgModal, setSetupOrgModal] = useState<{ id: string; name: string } | null>(null);
    const [repairOrgName, setRepairOrgName] = useState('');

    const [formData, setFormData] = useState({
        email: '',
        password: '',
        fullName: '',
        organizationName: '',
        supplier_id: ''
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const getCreditSummary = (org: OrganizationCreditRow) => {
        const used = Math.max(0, Number(org.used_monthly_credits || 0));
        const max = Math.max(0, Number(org.max_monthly_credits || 0));
        const remaining = Math.max(0, max - used);
        const ratio = max > 0 ? used / max : 0;

        if (remaining === 0) {
            return { label: 'At Limit', tone: 'danger' as const, ratio };
        }

        if (ratio >= 0.8) {
            return { label: 'Warning', tone: 'warning' as const, ratio };
        }

        return { label: 'Healthy', tone: 'healthy' as const, ratio };
    };

    const handleProvision = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const { data, error } = await supabase.functions.invoke('provision-user', {
                body: {
                    action: activeTab,
                    ...formData
                }
            });

            if (error) throw error;
            if (data && data.success === false) throw new Error(data.error);

            showToast(`${activeTab.replace('create_', '').toUpperCase()} account created successfully!`, 'success');
            setFormData({
                email: '',
                password: '',
                fullName: '',
                organizationName: '',
                supplier_id: ''
            });
        } catch (error: any) {
            console.error('Provisioning error:', error);
            showToast(error.message || 'Failed to provision account', 'error');
        } finally {
            setLoading(false);
        }
    };

    const TabButton = ({ action, icon: Icon, label }: { action: ProvisionAction, icon: any, label: string }) => (
        <button
            onClick={() => setActiveTab(action)}
            className={cn(
                "flex items-center gap-3 px-6 py-4 rounded-2xl font-bold transition-all duration-300",
                activeTab === action
                    ? "bg-primary text-black shadow-lg shadow-primary/20 scale-105"
                    : "bg-card/40 text-muted hover:text-foreground hover:bg-card/60"
            )}
        >
            <Icon className="w-5 h-5" />
            {label}
        </button>
    );

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'super_admin': return <Badge className="bg-red-500/10 text-red-500 border-none text-[9px] font-black uppercase tracking-widest px-3 py-1">🛡️ Super Admin</Badge>;
            case 'owner': return <Badge className="bg-amber-500/10 text-amber-500 border-none text-[9px] font-black uppercase tracking-widest px-3 py-1">🍽️ Owner</Badge>;
            case 'manager': return <Badge className="bg-blue-500/10 text-blue-400 border-none text-[9px] font-black uppercase tracking-widest px-3 py-1">👔 Manager</Badge>;
            case 'waiter': return <Badge className="bg-teal-500/10 text-teal-400 border-none text-[9px] font-black uppercase tracking-widest px-3 py-1">💁 Waiter</Badge>;
            case 'kitchen': return <Badge className="bg-orange-500/10 text-orange-400 border-none text-[9px] font-black uppercase tracking-widest px-3 py-1">🧑‍🍳 Kitchen</Badge>;
            case 'supplier': return <Badge className="bg-purple-500/10 text-purple-400 border-none text-[9px] font-black uppercase tracking-widest px-3 py-1">📦 Supplier</Badge>;
            case 'driver': return <Badge className="bg-emerald-500/10 text-emerald-400 border-none text-[9px] font-black uppercase tracking-widest px-3 py-1">🚗 Driver</Badge>;
            default: return <Badge variant="outline" className="text-[9px] font-black uppercase tracking-widest">{role}</Badge>;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'approved': return <Badge className="bg-green-500/10 text-green-500 border-none text-[9px] font-black uppercase tracking-widest">✅ Approved</Badge>;
            case 'rejected': return <Badge className="bg-red-500/10 text-red-500 border-none text-[9px] font-black uppercase tracking-widest">❌ Rejected</Badge>;
            default: return <Badge className="bg-amber-500/10 text-amber-500 border-none text-[9px] font-black uppercase tracking-widest">⏳ Pending</Badge>;
        }
    };

    const pendingCount = applications?.filter(a => a.status === 'pending').length || 0;

    useLayoutConfig({
        title: "Platform Administration",
        subtitle: "Baro OS Multi-tenant Account Management"
    });

    return (
        <>
            <div className="max-w-6xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

                {/* Main View Switcher */}
                <div className="flex bg-muted/10 p-1.5 rounded-[1.5rem] border border-border w-max mx-auto backdrop-blur-md">
                    <button
                        onClick={() => setMainTab('directory')}
                        className={cn(
                            "px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-[1.1rem] transition-all flex items-center gap-3",
                            mainTab === 'directory' ? "bg-primary text-black shadow-lg shadow-primary/20" : "text-muted hover:text-foreground"
                        )}
                    >
                        <Database className="w-4 h-4" /> Tenant Directory
                    </button>
                    <button
                        onClick={() => setMainTab('credits')}
                        className={cn(
                            "px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-[1.1rem] transition-all flex items-center gap-3",
                            mainTab === 'credits' ? "bg-primary text-black shadow-lg shadow-primary/20" : "text-muted hover:text-foreground"
                        )}
                    >
                        <ShieldCheck className="w-4 h-4" /> Credit Control
                    </button>
                    <button
                        onClick={() => setMainTab('provision')}
                        className={cn(
                            "px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-[1.1rem] transition-all flex items-center gap-3",
                            mainTab === 'provision' ? "bg-primary text-black shadow-lg shadow-primary/20" : "text-muted hover:text-foreground"
                        )}
                    >
                        <UserPlus className="w-4 h-4" /> Provision New
                    </button>
                    <button
                        onClick={() => setMainTab('applications')}
                        className={cn(
                            "px-8 py-3 text-[10px] font-black uppercase tracking-widest rounded-[1.1rem] transition-all flex items-center gap-3 relative",
                            mainTab === 'applications' ? "bg-primary text-black shadow-lg shadow-primary/20" : "text-muted hover:text-foreground"
                        )}
                    >
                        <FileText className="w-4 h-4" /> Applications
                        {pendingCount > 0 && (
                            <span className={cn(
                                "absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-[9px] font-black flex items-center justify-center",
                                mainTab === 'applications' ? "bg-black text-primary" : "bg-amber-500 text-black animate-pulse"
                            )}>
                                {pendingCount}
                            </span>
                        )}
                    </button>
                </div>

                {/* ═══════════════════ CREDIT CONTROL TAB ═══════════════════ */}
                {mainTab === 'credits' && (
                    <div className="space-y-6 animate-in fade-in">
                        <div className="flex items-center justify-between gap-4">
                            <div>
                                <h2 className="text-2xl font-black tracking-tight">Credit Control</h2>
                                <p className="text-sm text-muted font-medium">
                                    Monitor organization usage and top up credits for tenants that reached their monthly limit.
                                </p>
                            </div>
                            <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3 text-xs font-bold text-amber-400">
                                1 message = 1 credit, 1 chatbot order = 20 credits
                            </div>
                        </div>

                        {isLoadingOrganizations ? (
                            <div className="py-20 text-center text-muted animate-pulse font-black uppercase tracking-widest">
                                Loading organizations...
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                                {organizations?.map(org => {
                                    const used = Math.max(0, Number(org.used_monthly_credits || 0));
                                    const max = Math.max(0, Number(org.max_monthly_credits || 0));
                                    const remaining = Math.max(0, max - used);
                                    const summary = getCreditSummary(org);
                                    const owner = accounts?.find(acc => acc.role === 'owner' && acc.organization_id === org.id);
                                    const percent = max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0;
                                    const inputValue = creditTopUps[org.id] ?? '';
                                    const selectedPlan = planSelections[org.id] ?? (org.plan === 'pro' || org.plan === 'enterprise' ? org.plan : 'basic');

                                    return (
                                        <div key={org.id} className="bg-card/60 backdrop-blur-xl border border-border rounded-[2rem] p-6 shadow-2xl shadow-black/20">
                                            <div className="flex items-start justify-between gap-4 mb-5">
                                                <div>
                                                    <div className="flex items-center gap-3 flex-wrap">
                                                        <h3 className="text-2xl font-black tracking-tight">{org.name}</h3>
                                                        <Badge className={cn(
                                                            "border-none text-[9px] font-black uppercase tracking-widest px-3 py-1",
                                                            summary.tone === 'danger' && "bg-red-500/10 text-red-400",
                                                            summary.tone === 'warning' && "bg-amber-500/10 text-amber-400",
                                                            summary.tone === 'healthy' && "bg-green-500/10 text-green-400"
                                                        )}>
                                                            {summary.label}
                                                        </Badge>
                                                        <Badge className="bg-primary/10 text-primary border-none text-[9px] font-black uppercase tracking-widest px-3 py-1">
                                                            {org.plan || 'basic'}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-xs text-muted font-mono mt-2">
                                                        {owner?.full_name || 'No owner found'}{owner?.email ? ` • ${owner.email}` : ''}
                                                    </p>
                                                </div>

                                                <div className="text-right">
                                                    <div className="text-4xl font-black tracking-tight">{used}</div>
                                                    <div className="text-[10px] uppercase tracking-[0.35em] text-muted font-black">
                                                        / {max || 0} credits
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="h-3 rounded-full bg-white/5 overflow-hidden">
                                                    <div
                                                        className={cn(
                                                            "h-full rounded-full transition-all duration-500",
                                                            summary.tone === 'danger' && "bg-red-500",
                                                            summary.tone === 'warning' && "bg-amber-500",
                                                            summary.tone === 'healthy' && "bg-primary"
                                                        )}
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between text-xs font-black uppercase tracking-widest text-muted">
                                                    <span>{percent}% utilized</span>
                                                    <span>{remaining} credits remaining</span>
                                                </div>
                                            </div>

                                            <div className="mt-6 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-1">
                                                        Plan Access
                                                    </label>
                                                    <select
                                                        value={selectedPlan}
                                                        onChange={(e) => setPlanSelections(prev => ({ ...prev, [org.id]: e.target.value as 'basic' | 'pro' | 'enterprise' }))}
                                                        className="w-full bg-background/70 border border-primary/20 rounded-2xl py-3 px-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-bold"
                                                    >
                                                        <option value="basic">Basic</option>
                                                        <option value="pro">Pro</option>
                                                        <option value="enterprise">Enterprise</option>
                                                    </select>
                                                    <p className="text-[10px] font-bold text-muted ml-1">
                                                        Choose the plan the tenant should receive access to.
                                                    </p>
                                                </div>

                                                <Button
                                                    onClick={() => changePlan({ organizationId: org.id, plan: selectedPlan })}
                                                    disabled={isChangingPlan}
                                                    className="h-12 px-6 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-black font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20"
                                                >
                                                    {isChangingPlan ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                                                    Apply Plan
                                                </Button>
                                            </div>

                                            <div className="mt-6 grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
                                                <div className="space-y-2">
                                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-1">
                                                        Add Credits
                                                    </label>
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={inputValue}
                                                        onChange={(e) => setCreditTopUps(prev => ({ ...prev, [org.id]: e.target.value }))}
                                                        placeholder="Enter credits to add"
                                                        className="w-full bg-background/70 border border-primary/20 rounded-2xl py-3 px-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-bold placeholder:text-muted/30"
                                                    />
                                                </div>

                                                <Button
                                                    onClick={() => {
                                                        const amount = Number(creditTopUps[org.id] || 0);
                                                        if (!amount || amount <= 0) {
                                                            showToast('Enter a valid credit amount.', 'error');
                                                            return;
                                                        }
                                                        topUpCredits({ organizationId: org.id, amount });
                                                    }}
                                                    disabled={isTopingUpCredits}
                                                    className="h-12 px-6 rounded-2xl bg-primary text-black font-black uppercase tracking-widest shadow-lg shadow-primary/20"
                                                >
                                                    {isTopingUpCredits ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <ShieldCheck className="w-4 h-4 mr-2" />}
                                                    Top Up
                                                </Button>
                                            </div>

                                            <div className={cn(
                                                "mt-5 rounded-2xl border px-4 py-3 text-xs font-bold",
                                                summary.tone === 'danger' && "border-red-500/20 bg-red-500/5 text-red-300",
                                                summary.tone === 'warning' && "border-amber-500/20 bg-amber-500/5 text-amber-300",
                                                summary.tone === 'healthy' && "border-green-500/20 bg-green-500/5 text-green-300"
                                            )}>
                                                {summary.tone === 'danger'
                                                    ? 'This organization has reached its limit. Add credits to keep the chatbot running.'
                                                    : summary.tone === 'warning'
                                                        ? 'This organization is close to its limit. Top up before the chatbot stops.'
                                                        : 'Usage is healthy for this billing cycle.'}
                                            </div>

                                            <div className="mt-4 grid grid-cols-2 gap-3 text-xs font-bold text-muted">
                                                <div className="bg-white/5 rounded-2xl px-4 py-3">
                                                    Reset: {org.credit_reset_at ? new Date(org.credit_reset_at).toLocaleDateString() : 'Not set'}
                                                </div>
                                                <div className="bg-white/5 rounded-2xl px-4 py-3">
                                                    Remaining: {remaining}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════════════════ APPLICATIONS TAB ═══════════════════ */}
                {mainTab === 'applications' && (
                    <div className="space-y-6 animate-in fade-in">
                        {/* Filter */}
                        <div className="flex items-center gap-4">
                            <div className="flex bg-muted/10 p-1 rounded-xl border border-border">
                                <button
                                    onClick={() => setAppFilter('pending')}
                                    className={cn(
                                        "px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                                        appFilter === 'pending' ? "bg-amber-500/10 text-amber-500" : "text-muted hover:text-foreground"
                                    )}
                                >
                                    Pending Review
                                </button>
                                <button
                                    onClick={() => setAppFilter('all')}
                                    className={cn(
                                        "px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all",
                                        appFilter === 'all' ? "bg-primary/10 text-primary" : "text-muted hover:text-foreground"
                                    )}
                                >
                                    All Applications
                                </button>
                            </div>
                        </div>

                        {/* Applications Grid */}
                        {isLoadingApps ? (
                            <div className="py-20 text-center text-muted animate-pulse font-black uppercase tracking-widest">
                                Loading applications...
                            </div>
                        ) : applications?.length === 0 ? (
                            <div className="py-20 text-center bg-card/40 rounded-[2.5rem] border border-dashed border-border">
                                <FileText className="w-12 h-12 text-muted/20 mx-auto mb-4" />
                                <p className="font-black text-muted uppercase tracking-widest">No applications found</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                {applications?.map(app => (
                                    <div
                                        key={app.id}
                                        className="bg-card/60 backdrop-blur-xl border border-border rounded-[2rem] overflow-hidden group hover:border-primary/20 transition-all shadow-xl"
                                    >
                                        {/* Card Header */}
                                        <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="p-3 bg-primary/5 rounded-xl">
                                                    {app.role === 'owner' && <UtensilsCrossed className="w-5 h-5 text-amber-500" />}
                                                    {app.role === 'supplier' && <Package className="w-5 h-5 text-blue-400" />}
                                                    {app.role === 'driver' && <Car className="w-5 h-5 text-emerald-400" />}
                                                </div>
                                                <div>
                                                    <h3 className="font-black text-foreground text-lg tracking-tight">{app.full_name}</h3>
                                                    <p className="text-xs text-muted font-mono">{app.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-end gap-2">
                                                {getRoleBadge(app.role)}
                                                {app.status !== 'pending' && getStatusBadge(app.status)}
                                            </div>
                                        </div>

                                        {/* Card Body */}
                                        <div className="p-6 space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="flex items-center gap-2 text-muted">
                                                    <Phone className="w-3.5 h-3.5 text-primary" />
                                                    <span className="text-xs font-bold">{app.phone}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-muted">
                                                    <Clock className="w-3.5 h-3.5 text-primary" />
                                                    <span className="text-xs font-bold">{new Date(app.created_at).toLocaleDateString()}</span>
                                                </div>
                                            </div>

                                            {/* Role-specific details */}
                                            {app.role === 'owner' && (
                                                <div className="bg-muted/5 rounded-xl p-4 space-y-2 border border-white/5">
                                                    <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-2">Restaurant Details</p>
                                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                                        <div><span className="text-muted">Name:</span> <span className="font-bold text-foreground">{app.restaurant_name}</span></div>
                                                        <div><span className="text-muted">Type:</span> <span className="font-bold text-foreground">{app.restaurant_type}</span></div>
                                                        <div><span className="text-muted">City:</span> <span className="font-bold text-foreground">{app.city}</span></div>
                                                        <div><span className="text-muted">Branches:</span> <span className="font-bold text-foreground">{app.branch_count}</span></div>
                                                    </div>
                                                </div>
                                            )}

                                            {app.role === 'supplier' && (
                                                <div className="bg-muted/5 rounded-xl p-4 space-y-2 border border-white/5">
                                                    <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-2">Supplier Details</p>
                                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                                        <div><span className="text-muted">Company:</span> <span className="font-bold text-foreground">{app.company_name}</span></div>
                                                        <div><span className="text-muted">Category:</span> <span className="font-bold text-foreground">{app.supply_category}</span></div>
                                                        <div className="col-span-2"><span className="text-muted">Cities:</span> <span className="font-bold text-foreground">{app.cities_covered}</span></div>
                                                    </div>
                                                </div>
                                            )}

                                            {app.role === 'driver' && (
                                                <div className="bg-muted/5 rounded-xl p-4 space-y-2 border border-white/5">
                                                    <p className="text-[9px] font-black text-primary uppercase tracking-widest mb-2">Driver Details</p>
                                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                                        <div><span className="text-muted">City:</span> <span className="font-bold text-foreground">{app.city}</span></div>
                                                        <div><span className="text-muted">Vehicle:</span> <span className="font-bold text-foreground">{app.vehicle_type}</span></div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Action Buttons */}
                                            {app.status === 'pending' && (
                                                <div className="flex gap-3 pt-2">
                                                    <Button
                                                        onClick={() => approveApplication(app)}
                                                        disabled={isApproving || isRejecting}
                                                        className="flex-1 bg-green-500 hover:bg-green-400 text-black font-black uppercase tracking-widest text-[10px] h-12 rounded-xl shadow-lg shadow-green-500/10 transition-all hover:scale-[1.02]"
                                                    >
                                                        {isApproving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                                        Approve
                                                    </Button>
                                                    <Button
                                                        onClick={() => rejectApplication(app.id)}
                                                        disabled={isApproving || isRejecting}
                                                        variant="outline"
                                                        className="flex-1 border-red-500/20 text-red-400 hover:bg-red-500/10 font-black uppercase tracking-widest text-[10px] h-12 rounded-xl transition-all"
                                                    >
                                                        {isRejecting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <XCircle className="w-4 h-4 mr-2" />}
                                                        Reject
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* ═══════════════════ PROVISION TAB ═══════════════════ */}
                {mainTab === 'provision' && (
                    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in">
                        {/* Role Selector Tabs */}
                        <div className="flex flex-wrap gap-4 justify-center">
                            <TabButton action="create_owner" icon={Store} label="Restaurant Owner" />
                            <TabButton action="create_supplier" icon={Building} label="Supplier" />
                            <TabButton action="create_driver" icon={Truck} label="Delivery Driver" />
                        </div>

                        {/* Form Section */}
                        <div className="bg-card/40 backdrop-blur-2xl border border-primary/20 rounded-3xl p-8 shadow-2xl relative overflow-hidden group">
                            {/* Decorative Elements */}
                            <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 blur-[80px] rounded-full group-hover:bg-primary/10 transition-colors" />

                            <div className="relative space-y-6">
                                <div className="flex items-center gap-4 mb-8">
                                    <div className="p-4 bg-primary/10 rounded-2xl">
                                        {activeTab === 'create_owner' && <Store className="w-8 h-8 text-primary" />}
                                        {activeTab === 'create_supplier' && <Building className="w-8 h-8 text-primary" />}
                                        {activeTab === 'create_driver' && <Truck className="w-8 h-8 text-primary" />}
                                    </div>
                                    <div>
                                        <h2 className="text-2xl font-black tracking-tight">
                                            {activeTab === 'create_owner' && 'New Restaurant Account'}
                                            {activeTab === 'create_supplier' && 'New Supplier Account'}
                                            {activeTab === 'create_driver' && 'New Delivery Driver'}
                                        </h2>
                                        <p className="text-muted text-sm font-medium">Fill in the details to provision the new platform entity.</p>
                                    </div>
                                </div>

                                <form onSubmit={handleProvision} className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted ml-1">Full Name</label>
                                        <div className="relative">
                                            <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                            <input
                                                name="fullName"
                                                value={formData.fullName}
                                                onChange={handleInputChange}
                                                placeholder="e.g. John Doe"
                                                required
                                                className="w-full bg-background/50 border border-primary/20 rounded-2xl py-3 pl-12 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-bold placeholder:text-muted/30"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted ml-1">Email Address</label>
                                        <div className="relative">
                                            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                            <input
                                                name="email"
                                                type="email"
                                                value={formData.email}
                                                onChange={handleInputChange}
                                                placeholder="name@example.com"
                                                required
                                                className="w-full bg-background/50 border border-primary/20 rounded-2xl py-3 pl-12 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-bold placeholder:text-muted/30"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-black uppercase tracking-widest text-muted ml-1">Initial Password</label>
                                        <div className="relative">
                                            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                            <input
                                                name="password"
                                                type="password"
                                                value={formData.password}
                                                onChange={handleInputChange}
                                                placeholder="••••••••"
                                                required
                                                className="w-full bg-background/50 border border-primary/20 rounded-2xl py-3 pl-12 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-bold placeholder:text-muted/30"
                                            />
                                        </div>
                                    </div>

                                    {activeTab === 'create_owner' && (
                                        <div className="space-y-2">
                                            <label className="text-xs font-black uppercase tracking-widest text-muted ml-1">Restaurant Name</label>
                                            <div className="relative">
                                                <Store className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                                <input
                                                    name="organizationName"
                                                    value={formData.organizationName}
                                                    onChange={handleInputChange}
                                                    placeholder="e.g. Baro Bistro"
                                                    required
                                                    className="w-full bg-background/50 border border-primary/20 rounded-2xl py-3 pl-12 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-bold placeholder:text-muted/30"
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {activeTab === 'create_supplier' && (
                                        <>
                                            <div className="space-y-2">
                                                <label className="text-xs font-black uppercase tracking-widest text-muted ml-1">Company Name</label>
                                                <div className="relative">
                                                    <Building className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                                    <input
                                                        name="organizationName"
                                                        value={formData.organizationName}
                                                        onChange={handleInputChange}
                                                        placeholder="e.g. Fresh Farms Supply"
                                                        required
                                                        className="w-full bg-background/50 border border-primary/20 rounded-2xl py-3 pl-12 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-bold placeholder:text-muted/30"
                                                    />
                                                </div>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs font-black uppercase tracking-widest text-muted ml-1">Supplier ID (Optional Reference)</label>
                                                <div className="relative">
                                                    <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                                    <input
                                                        name="supplier_id"
                                                        value={formData.supplier_id}
                                                        onChange={handleInputChange}
                                                        placeholder="UUID of existing supplier entity"
                                                        className="w-full bg-background/50 border border-primary/20 rounded-2xl py-3 pl-12 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-bold placeholder:text-muted/30"
                                                    />
                                                </div>
                                            </div>
                                        </>
                                    )}

                                    <div className="md:col-span-2 pt-4">
                                        <Button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full py-6 rounded-2xl text-lg font-black uppercase tracking-widest gap-3 shadow-xl shadow-primary/20"
                                        >
                                            {loading ? (
                                                <div className="h-5 w-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                                            ) : (
                                                <UserPlus className="w-6 h-6" />
                                            )}
                                            {loading ? 'Processing...' : 'Provision Account'}
                                        </Button>
                                    </div>
                                </form>
                            </div>
                        </div>

                        {/* Security Warning */}
                        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-4 items-center">
                            <ShieldCheck className="w-6 h-6 text-amber-500 shrink-0" />
                            <p className="text-amber-500/90 text-sm font-bold">
                                Provisioning an account will immediately create an active Auth user and related profile.
                                Passwords should be shared securely with beneficiaries.
                            </p>
                        </div>
                    </div>
                )}

                {/* ═══════════════════ DIRECTORY TAB ═══════════════════ */}
                {mainTab === 'directory' && (
                    <div className="bg-card/40 backdrop-blur-2xl border border-border rounded-[2rem] p-8 shadow-2xl relative overflow-hidden flex flex-col min-h-[500px] animate-in fade-in">
                        <div className="flex items-center justify-between mb-8">
                            <h2 className="text-2xl font-black tracking-tight">Registered Entities</h2>
                            <div className="flex items-center gap-4">
                                {accounts?.some(a => a.status === 'pending') && (
                                    <Button
                                        onClick={() => {
                                            if (window.confirm('Are you sure you want to activate all pending accounts?')) {
                                                bulkActivate();
                                            }
                                        }}
                                        disabled={isBulkActivating}
                                        className="bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20 text-[10px] font-black uppercase tracking-widest h-11 px-6 rounded-xl"
                                    >
                                        {isBulkActivating ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCheck className="w-4 h-4 mr-2" />}
                                        Activate All Pending
                                    </Button>
                                )}
                                <div className="relative w-72">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                                    <input
                                        type="text"
                                        placeholder="Search by name or email..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full bg-background/50 border border-white/5 rounded-2xl py-3 pl-12 pr-4 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-bold placeholder:text-muted/30 text-sm object-contain"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="flex-1 overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-muted">Entity / Name</th>
                                        <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-muted">Role</th>
                                        <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-muted">Status</th>
                                        <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-muted">Organization</th>
                                        <th className="py-4 px-6 text-[10px] font-black uppercase tracking-widest text-muted text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {isLoadingAccounts ? (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center text-muted text-sm font-bold animate-pulse">Loading directory...</td>
                                        </tr>
                                    ) : accounts?.filter(acc =>
                                        acc.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        acc.email?.toLowerCase().includes(searchTerm.toLowerCase())
                                    ).length === 0 ? (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center text-muted text-sm font-bold">No registered entities found.</td>
                                        </tr>
                                    ) : (
                                        accounts?.filter(acc =>
                                            acc.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                            acc.email?.toLowerCase().includes(searchTerm.toLowerCase())
                                        ).map(account => (
                                            <tr key={account.id} className={cn("border-b border-white/5 hover:bg-white/5 transition-colors", account.status === 'suspended' && "opacity-60")}>
                                                <td className="py-4 px-6">
                                                    <div className="flex flex-col">
                                                        <span className="font-bold text-foreground">{account.full_name}</span>
                                                        <span className="text-xs text-muted font-mono">{account.email}</span>
                                                    </div>
                                                </td>
                                                <td className="py-4 px-6">
                                                    {getRoleBadge(account.role)}
                                                </td>
                                                <td className="py-4 px-6">
                                                    {account.status === 'suspended' ? (
                                                        <Badge className="bg-amber-500/10 text-amber-500 border-none text-[9px] font-black uppercase tracking-widest px-3 py-1 animate-pulse">
                                                            ⚠ Suspended
                                                        </Badge>
                                                    ) : account.status === 'active' ? (
                                                        <Badge className="bg-green-500/10 text-green-500 border-none text-[9px] font-black uppercase tracking-widest px-3 py-1">
                                                            Active
                                                        </Badge>
                                                    ) : (
                                                        <Badge className="bg-white/5 text-muted border-none text-[9px] font-black uppercase tracking-widest px-3 py-1">
                                                            {account.status || 'pending'}
                                                        </Badge>
                                                    )}
                                                </td>
                                                <td className="py-4 px-6">
                                                    <span className="text-sm font-bold text-muted-foreground break-words max-w-xs">{Array.isArray(account.organization) ? (account.organization[0] as any)?.name : (account.organization as any)?.name || 'Baro Platform'}</span>
                                                </td>
                                                <td className="py-4 px-6">
                                                    <div className="flex items-center justify-end relative">
                                                        <button
                                                            onClick={() => setOpenDropdown(openDropdown === account.id ? null : account.id)}
                                                            className="p-2 rounded-xl hover:bg-white/10 text-muted hover:text-foreground transition-all"
                                                        >
                                                            <MoreVertical className="w-4 h-4" />
                                                        </button>
                                                        {openDropdown === account.id && (
                                                            <div className="absolute top-full right-0 mt-1 bg-[#111] border border-white/10 rounded-2xl shadow-2xl shadow-black/80 z-50 overflow-hidden min-w-[200px] animate-in fade-in zoom-in-95 duration-150">
                                                                {account.role === 'owner' && account.organization_id === '00000000-0000-0000-0000-000000000000' && (
                                                                    <button
                                                                        onClick={() => {
                                                                            setSetupOrgModal({ id: account.id, name: account.full_name });
                                                                            setRepairOrgName(`${account.full_name}'s Restaurant`);
                                                                            setOpenDropdown(null);
                                                                        }}
                                                                        className="w-full px-5 py-3 text-left flex items-center gap-3 text-xs font-black uppercase tracking-widest text-primary hover:bg-primary/10 transition-colors border-b border-white/5"
                                                                    >
                                                                        <Building className="w-4 h-4" /> Complete Setup
                                                                    </button>
                                                                )}
                                                                {(account.status === 'suspended' || account.status === 'pending' || !account.status) ? (
                                                                    <button
                                                                        onClick={() => reactivateUser(account.id)}
                                                                        disabled={isReactivating}
                                                                        className="w-full px-5 py-3 text-left flex items-center gap-3 text-xs font-black uppercase tracking-widest text-green-400 hover:bg-green-500/10 transition-colors"
                                                                    >
                                                                        <RefreshCw className={cn("w-4 h-4", isReactivating && "animate-spin")} />
                                                                        {account.status === 'pending' ? 'Activate Account' : 'Reactivate'}
                                                                    </button>
                                                                ) : (
                                                                    <button
                                                                        onClick={() => suspendUser(account.id)}
                                                                        disabled={isSuspending}
                                                                        className="w-full px-5 py-3 text-left flex items-center gap-3 text-xs font-black uppercase tracking-widest text-amber-400 hover:bg-amber-500/10 transition-colors"
                                                                    >
                                                                        <Ban className="w-4 h-4" /> Suspend
                                                                    </button>
                                                                )}
                                                                <button
                                                                    onClick={() => { setDeleteConfirm({ id: account.id, name: account.full_name }); setOpenDropdown(null); }}
                                                                    className="w-full px-5 py-3 text-left flex items-center gap-3 text-xs font-black uppercase tracking-widest text-red-400 hover:bg-red-500/10 transition-colors border-t border-white/5"
                                                                >
                                                                    <Trash2 className="w-4 h-4" /> Delete
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ═══════════════════ DELETE CONFIRMATION MODAL ═══════════════════ */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setDeleteConfirm(null)}>
                    <div
                        className="bg-[#111] border border-red-500/20 rounded-[2.5rem] p-10 max-w-md w-full mx-4 shadow-[0_50px_100px_rgba(0,0,0,0.9)] animate-in zoom-in-95 duration-300 space-y-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-red-500/10 rounded-xl">
                                <AlertTriangle className="w-8 h-8 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white tracking-tight">Delete Account</h3>
                                <p className="text-xs text-muted font-bold">{deleteConfirm.name}</p>
                            </div>
                        </div>

                        <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                            <p className="text-red-400 text-sm font-bold">
                                Are you sure? This will permanently delete the account and all associated data. This action cannot be undone.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                onClick={() => setDeleteConfirm(null)}
                                variant="outline"
                                className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-xs border-white/10"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => deleteUser(deleteConfirm.id)}
                                disabled={isDeleting}
                                className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-xs bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/20"
                            >
                                {isDeleting ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                                Delete Forever
                            </Button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══════════════════ CREDENTIAL MODAL ═══════════════════ */}
            {credentialModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setCredentialModal(null)}>
                    <div
                        className="bg-[#111] border border-white/10 rounded-[2.5rem] p-10 max-w-lg w-full mx-4 shadow-[0_50px_100px_rgba(0,0,0,0.9)] animate-in zoom-in-95 duration-300 space-y-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-green-500/10 rounded-xl">
                                <CheckCircle2 className="w-8 h-8 text-green-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white tracking-tight">Account Provisioned</h3>
                                <p className="text-xs text-muted font-bold">{credentialModal.name} — {credentialModal.role}</p>
                            </div>
                        </div>

                        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                            <div>
                                <label className="text-[9px] font-black text-muted uppercase tracking-widest mb-1 block">Email</label>
                                <p className="text-white font-mono text-sm font-bold">{credentialModal.email}</p>
                            </div>
                            <div>
                                <label className="text-[9px] font-black text-muted uppercase tracking-widest mb-2 block">Temporary Password</label>
                                <div className="flex items-center gap-3">
                                    <input
                                        readOnly
                                        value={credentialModal.password}
                                        className="flex-1 bg-black/50 border border-primary/20 rounded-xl px-4 py-3 font-mono text-sm font-bold text-primary select-all outline-none"
                                        onClick={(e) => (e.target as HTMLInputElement).select()}
                                    />
                                    <button
                                        onClick={() => {
                                            navigator.clipboard.writeText(credentialModal.password);
                                            setCopied(true);
                                            setTimeout(() => setCopied(false), 2000);
                                        }}
                                        className="p-3 bg-primary/10 border border-primary/20 rounded-xl hover:bg-primary/20 transition-all text-primary"
                                    >
                                        {copied ? <CheckCheck className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-4">
                            <p className="text-amber-500/80 text-[10px] font-black uppercase tracking-widest">
                                ⚠️ Share this password securely. It cannot be retrieved again.
                            </p>
                        </div>

                        <Button
                            onClick={() => setCredentialModal(null)}
                            className="w-full h-14 rounded-2xl font-black uppercase tracking-widest text-xs"
                        >
                            Done — Close
                        </Button>
                    </div>
                </div>
            )}
            {/* ═══════════════════ SETUP ORGANIZATION MODAL (REPAIR) ═══════════════════ */}
            {setupOrgModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setSetupOrgModal(null)}>
                    <div
                        className="bg-[#111] border border-primary/20 rounded-[2.5rem] p-10 max-w-md w-full mx-4 shadow-[0_50px_100px_rgba(0,0,0,0.9)] animate-in zoom-in-95 duration-300 space-y-6"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-primary/10 rounded-xl">
                                <Building className="w-8 h-8 text-primary" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black text-white tracking-tight">Complete Account Setup</h3>
                                <p className="text-xs text-muted font-bold">For {setupOrgModal.name}</p>
                            </div>
                        </div>

                        <div className="space-y-4">
                            <p className="text-sm text-muted font-medium">
                                This will create a new organization and main branch, then link this owner to them. This resolves the "Account Setup Incomplete" error.
                            </p>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-1">Restaurant/Org Name</label>
                                <input
                                    value={repairOrgName}
                                    onChange={(e) => setRepairOrgName(e.target.value)}
                                    placeholder="e.g. Baro Bistro"
                                    className="w-full bg-background/50 border border-primary/20 rounded-2xl py-4 px-6 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all font-bold"
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <Button
                                onClick={() => setSetupOrgModal(null)}
                                variant="outline"
                                className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-xs border-white/10"
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={() => setupOrganization({ userId: setupOrgModal.id, organizationName: repairOrgName })}
                                disabled={isSettingUp || !repairOrgName}
                                className="flex-1 h-14 rounded-2xl font-black uppercase tracking-widest text-xs bg-primary text-black shadow-lg shadow-primary/20"
                            >
                                {isSettingUp ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                                Setup Now
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default BaroAdminDashboard;
