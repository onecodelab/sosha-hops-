import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, cn, showToast, Input } from '../components/ui';
import {
    Zap,
    Search,
    History,
    CheckCircle2,
    X,
    Cpu,
    TrendingUp,
    ShieldCheck,
    ArrowRight,
    Filter,
    Eye,
    Activity,
    AlertTriangle,
    Clock,
    Truck,
    AlertCircle,
    Sparkles,
    Brain,
    MessageSquare,
    BarChart3,
    ArrowLeft,
    Home,
    LayoutDashboard,
    Maximize,
    Minimize
} from 'lucide-react';
import { Proposal, BusinessAuditLog, GovernancePolicy } from '../types';
import { useBranch } from '../contexts/BranchContext';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { BaroCommandChat } from '../components/BaroCommandChat';

const OwnerCommandCenter: React.FC = () => {
    const navigate = useNavigate();
    const { activeBranchId } = useBranch();
    const queryClient = useQueryClient();
    const [view, setView] = useState<'intelligence' | 'proposals' | 'audit' | 'governance'>('intelligence');
    const [searchTerm, setSearchTerm] = useState('');
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        
        // Attempt automatic fullscreen on mount (Browser policies may block this if no prior user gesture)
        const enterFullscreen = async () => {
            try {
                if (!document.fullscreenElement) {
                    await document.documentElement.requestFullscreen();
                }
            } catch (err) {
                console.log("Auto-fullscreen on mount prevented by browser policy", err);
            }
        };
        
        // Small delay to ensure component is fully mounted
        const timeout = setTimeout(enterFullscreen, 100);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            clearTimeout(timeout);
        };
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (err) {
            console.error("Fullscreen toggle failed:", err);
        }
    };

    // 1. Fetch Proposals
    const { data: proposals, isLoading: proposalsLoading } = useQuery({
        queryKey: ['proposals', activeBranchId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('proposals')
                .select('*')
                .eq('status', 'pending')
                .order('created_at', { ascending: false });
            if (error) return [];
            return data as Proposal[];
        }
    });

    // 2. Fetch Audit Logs
    const { data: auditLogs, isLoading: auditLoading } = useQuery({
        queryKey: ['audit-logs', activeBranchId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('business_audit_logs')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(50);
            if (error) return [];
            return data as BusinessAuditLog[];
        }
    });

    // 3. Fetch Governance Policies
    const { data: policies, isLoading: policiesLoading } = useQuery({
        queryKey: ['governance-policies', activeBranchId],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('governance_policies')
                .select('*')
                .eq('is_active', true);
            if (error) return [];
            return data as GovernancePolicy[];
        }
    });

    // 4. Mutation: Decide Proposal
    const { mutate: decideProposal, isPending: isDeciding } = useMutation({
        mutationFn: async ({ id, status }: { id: string, status: 'approved' | 'rejected' }) => {
            const { error } = await supabase
                .from('proposals')
                .update({
                    status,
                    decided_at: new Date().toISOString(),
                    decided_by: (await supabase.auth.getUser()).data.user?.id
                })
                .eq('id', id);
            if (error) throw error;
        },
        onSuccess: (_, vars) => {
            showToast(`Proposal ${vars.status}`, 'success');
            queryClient.invalidateQueries({ queryKey: ['proposals'] });
            queryClient.invalidateQueries({ queryKey: ['audit-logs'] });
        },
        onError: (err: any) => showToast(err.message, 'error')
    });

    const getProposalIcon = (type: string) => {
        switch (type) {
            case 'procurement': return <TrendingUp className="w-4 h-4 text-blue-400" />;
            case 'waste': return <AlertTriangle className="w-4 h-4 text-red-400" />;
            case 'schedule': return <Activity className="w-4 h-4 text-purple-400" />;
            default: return <Cpu className="w-4 h-4 text-primary" />;
        }
    };

    const navItems = [
        { id: 'intelligence' as const, label: 'Command Chat', icon: Brain, badge: null },
        { id: 'proposals' as const, label: 'Agent Proposals', icon: Zap, badge: proposals?.length || null },
        { id: 'audit' as const, label: 'Black Box Audit', icon: History, badge: null },
        { id: 'governance' as const, label: 'Governance', icon: ShieldCheck, badge: null },
    ];

    return (
        <div className="h-full min-h-0 bg-[#0a0a0a] flex flex-col animate-in fade-in duration-700">
            {/* ─── CUSTOM FULL-SCREEN HEADER ─── */}
            <header className="flex-none px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800/50 bg-[#0d0d0d]/90 backdrop-blur-md z-10 w-full relative">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                <div className="flex items-center gap-4 relative z-10">
                    <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors bg-[#111] border border-gray-800/50 shadow-sm shadow-black/50" title="Exit to Landing Page">
                            <Home className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => navigate('/app/admin')} className="rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors bg-[#111] border border-gray-800/50 shadow-sm shadow-black/50" title="Return to Dashboard">
                            <LayoutDashboard className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors bg-[#111] border border-gray-800/50 shadow-sm shadow-black/50" title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}>
                            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                        </Button>
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Command Center</h1>
                            <Badge className="bg-primary/20 text-primary border-none text-[9px] uppercase tracking-widest px-2 py-0.5 pointer-events-none">System Active</Badge>
                        </div>
                        <p className="text-[10px] md:text-[11px] text-gray-400 font-mono uppercase tracking-widest mt-1">Agentic Oversight & Strategic Control</p>
                    </div>
                </div>

                {/* ─── HORIZONTAL NAV TABS ─── */}
                <div className="flex items-center gap-1 bg-[#111]/80 border border-gray-800/50 rounded-xl p-1 w-full md:w-auto overflow-x-auto custom-scrollbar relative z-10">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setView(item.id)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all text-[11px] font-bold uppercase tracking-widest",
                                view === item.id
                                    ? "bg-primary text-black shadow-lg shadow-primary/20"
                                    : "text-gray-500 hover:bg-white/5 hover:text-gray-300"
                            )}
                        >
                            <item.icon className="w-4 h-4" />
                            <span className="hidden md:inline">{item.label}</span>
                            {item.badge && item.badge > 0 && (
                                <span className={cn(
                                    "ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold",
                                    view === item.id ? "bg-black/20 text-black" : "bg-primary/20 text-primary"
                                )}>
                                    {item.badge}
                                </span>
                            )}
                        </button>
                    ))}
                </div>
            </header>

            {/* ─── CONTENT AREA ─── */}
            <div className="flex-1 min-h-0 relative p-4 md:p-6 lg:p-8 lg:pb-6 bg-gradient-to-br from-[#0a0a0a] via-[#050505] to-[#080808] flex flex-col">
                <AnimatePresence mode="wait">
                    {view === 'intelligence' ? (
                        <motion.div
                            key="intelligence"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
                            className="flex-1 min-h-0 w-full bg-[#0a0a0a] border border-gray-800/50 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                        >
                            <BaroCommandChat />
                        </motion.div>
                    ) : view === 'proposals' ? (
                        <motion.div
                            key="proposals"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="space-y-4 overflow-y-auto custom-scrollbar pb-8"
                            style={{ maxHeight: 'calc(100vh - 220px)' }}
                        >
                            {/* Search Bar */}
                            <div className="flex justify-between items-center sticky top-0 z-10 bg-background/80 backdrop-blur-md py-2">
                                <div className="relative w-full max-w-md">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                                    <Input
                                        placeholder="Search proposals..."
                                        className="pl-10 h-10 bg-[#1A1A1A] border-gray-800 text-sm"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Button variant="outline" size="sm" className="border-gray-800 text-gray-500">
                                    <Filter className="w-4 h-4 mr-2" /> Filter
                                </Button>
                            </div>

                            {proposalsLoading ? (
                                <div className="py-20 text-center text-gray-500">Loading intelligence...</div>
                            ) : proposals?.length === 0 ? (
                                <div className="py-24 text-center bg-[#1A1A1A] border border-gray-800 border-dashed rounded-3xl">
                                    <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-4 opacity-20" />
                                    <h3 className="text-white font-black uppercase text-sm tracking-widest">System Clear</h3>
                                    <p className="text-xs text-gray-500 mt-1">Agents are operational but no actions require approval.</p>
                                </div>
                            ) : proposals?.map((p) => (
                                <Card key={p.id} className="bg-[#1A1A1A] border-gray-800 overflow-hidden group hover:border-primary/30 transition-all">
                                    <div className="p-1 bg-gradient-to-r from-primary/10 via-transparent to-transparent" />
                                    <div className="p-6">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-black/40 flex items-center justify-center border border-white/5">
                                                    {getProposalIcon(p.proposal_type)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="text-white font-black uppercase text-sm tracking-tight">{p.proposal_type} PROPOSAL</h4>
                                                        <Badge className="bg-primary/20 text-primary text-[9px] uppercase font-black px-1.5 py-0">{(p.confidence * 100).toFixed(0)}% CONFIDENCE</Badge>
                                                    </div>
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-0.5">VIA AI_PROCUREMENT_AGENT_V2</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[10px] text-gray-500 uppercase tracking-widest">{format(new Date(p.created_at), 'MM/dd HH:mm')}</p>
                                                <p className="text-xs text-primary font-black mt-1">IMPACT: +{(p.impact_score * 100).toFixed(1)}% EFFICIENCY</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                                            {/* Risk Decomposition */}
                                            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                                                <h5 className="text-[10px] font-black text-red-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <ShieldCheck className="w-3 h-3" /> Risk Decomposition
                                                </h5>
                                                <div className="space-y-3">
                                                    {[
                                                        { label: 'Financial', score: p.risk_financial, color: 'bg-red-500' },
                                                        { label: 'Fraud', score: p.risk_fraud, color: 'bg-orange-500' },
                                                        { label: 'Operational', score: p.risk_operational, color: 'bg-yellow-500' },
                                                        { label: 'Reputational', score: p.risk_reputational, color: 'bg-blue-500' }
                                                    ].map(r => (
                                                        <div key={r.label} className="space-y-1">
                                                            <div className="flex justify-between text-[9px] uppercase font-bold">
                                                                <span className="text-gray-500">{r.label}</span>
                                                                <span className={cn(r.score > 0.5 ? "text-red-400" : "text-gray-400")}>
                                                                    {(r.score * 100).toFixed(0)}%
                                                                </span>
                                                            </div>
                                                            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${r.score * 100}%` }}
                                                                    className={cn("h-full rounded-full", r.color)}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Optimization Matrix */}
                                            <div className="bg-black/30 rounded-xl p-4 border border-white/5">
                                                <h5 className="text-[10px] font-black text-primary uppercase tracking-widest mb-3 flex items-center gap-2">
                                                    <TrendingUp className="w-3 h-3" /> Optimization Objectives
                                                </h5>
                                                <div className="space-y-3">
                                                    {[
                                                        { label: 'Profit Alpha', score: p.opt_profit, color: 'bg-primary' },
                                                        { label: 'Staff Fatigue', score: p.opt_staff_fatigue, color: 'bg-purple-500' },
                                                        { label: 'Satisfaction', score: p.opt_customer_satisfaction, color: 'bg-green-500' },
                                                        { label: 'Resilience', score: p.opt_resilience, color: 'bg-blue-500' }
                                                    ].map(o => (
                                                        <div key={o.label} className="space-y-1">
                                                            <div className="flex justify-between text-[9px] uppercase font-bold">
                                                                <span className="text-gray-500">{o.label}</span>
                                                                <span className="text-gray-300">{(o.score * 100).toFixed(0)}%</span>
                                                            </div>
                                                            <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                                                <motion.div
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: `${o.score * 100}%` }}
                                                                    className={cn("h-full rounded-full", o.color)}
                                                                />
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Urgency Engine Metrics */}
                                        {p.proposal_type === 'procurement' && p.data?.tte_hours !== undefined && (
                                            <div className="grid grid-cols-3 gap-4 mb-6">
                                                <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Clock className="w-3 h-3 text-primary" />
                                                        <span className="text-[9px] font-black text-primary uppercase">Stock Life</span>
                                                    </div>
                                                    <p className="text-lg font-black text-white leading-none">{p.data.tte_hours}<span className="text-[10px] ml-1 text-gray-500">hrs</span></p>
                                                    <p className="text-[9px] text-gray-500 uppercase mt-1">Left at current pace</p>
                                                </div>
                                                <div className="bg-white/5 border border-white/10 rounded-xl p-3">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <Truck className="w-3 h-3 text-blue-400" />
                                                        <span className="text-[9px] font-black text-blue-400 uppercase">Lead Time</span>
                                                    </div>
                                                    <p className="text-lg font-black text-white leading-none">{p.data.lead_time_hours}<span className="text-[10px] ml-1 text-gray-500">hrs</span></p>
                                                    <p className="text-[9px] text-gray-500 uppercase mt-1">Supplier response</p>
                                                </div>
                                                <div className={cn(
                                                    "border rounded-xl p-3",
                                                    p.data.tte_hours <= p.data.lead_time_hours
                                                        ? "bg-red-500/10 border-red-500/30"
                                                        : "bg-green-500/10 border-green-500/30"
                                                )}>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <AlertCircle className={cn(
                                                            "w-3 h-3",
                                                            p.data.tte_hours <= p.data.lead_time_hours ? "text-red-500" : "text-green-500"
                                                        )} />
                                                        <span className={cn(
                                                            "text-[9px] font-black uppercase",
                                                            p.data.tte_hours <= p.data.lead_time_hours ? "text-red-500" : "text-green-500"
                                                        )}>Gap Analysis</span>
                                                    </div>
                                                    <p className="text-lg font-black text-white leading-none">
                                                        {p.data.tte_hours <= p.data.lead_time_hours
                                                            ? `-${Math.abs(p.data.lead_time_hours - p.data.tte_hours).toFixed(0)}h`
                                                            : `+${(p.data.tte_hours - p.data.lead_time_hours).toFixed(0)}h`
                                                        }
                                                    </p>
                                                    <p className="text-[9px] text-gray-500 uppercase mt-1">Delivery window</p>
                                                </div>
                                            </div>
                                        )}

                                        <div className="bg-black/20 rounded-xl p-4 mb-6 border border-white/5">
                                            <div className="flex items-center gap-2 mb-2">
                                                <Eye className="w-3 h-3 text-gray-500" />
                                                <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Logic Justification</span>
                                            </div>
                                            <p className="text-sm text-gray-300 italic">"{p.reasoning}"</p>
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <Button variant="ghost" size="sm" className="text-gray-500 hover:text-white">
                                                <Eye className="w-4 h-4 mr-2" /> View JSON Payload
                                            </Button>
                                            <div className="flex gap-3">
                                                <Button
                                                    variant="outline" size="sm"
                                                    className="border-red-500/20 text-red-500 hover:bg-red-500/10 h-10 px-6 font-black uppercase tracking-widest text-[10px]"
                                                    onClick={() => decideProposal({ id: p.id, status: 'rejected' })}
                                                    disabled={isDeciding}
                                                >
                                                    Reject
                                                </Button>
                                                <Button
                                                    size="sm"
                                                    className="bg-primary text-black hover:bg-white h-10 px-6 font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20"
                                                    onClick={() => decideProposal({ id: p.id, status: 'approved' })}
                                                    disabled={isDeciding}
                                                >
                                                    Approve & Apply
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </motion.div>
                    ) : view === 'governance' ? (
                        <motion.div
                            key="governance"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto custom-scrollbar pb-8"
                            style={{ maxHeight: 'calc(100vh - 220px)' }}
                        >
                            {policiesLoading ? (
                                <div className="col-span-2 py-20 text-center text-gray-500">Retrieving governance boundaries...</div>
                            ) : policies?.length === 0 ? (
                                <div className="col-span-2 py-20 text-center text-gray-500">No active policies found. System is in unrestricted mode.</div>
                            ) : policies?.map(policy => (
                                <Card key={policy.id} className="bg-[#1A1A1A] border-gray-800 p-6 relative overflow-hidden group">
                                    {policy.circuit_breaker_triggered && (
                                        <div className="absolute top-0 right-0 bg-red-500 text-black px-4 py-1 font-black text-[10px] uppercase tracking-widest z-10 animate-pulse">
                                            Circuit Breaker Active
                                        </div>
                                    )}

                                    <div className="flex justify-between items-start mb-6">
                                        <div>
                                            <h3 className="text-white font-black uppercase text-sm tracking-widest mb-1">{policy.action_type} POLICY</h3>
                                            <p className="text-[10px] text-gray-500 uppercase tracking-widest font-mono">VERSION: {policy.version_id}</p>
                                        </div>
                                        <Badge className={cn(
                                            "font-black uppercase text-[10px] tracking-widest",
                                            policy.is_active ? "bg-green-500/20 text-green-500" : "bg-red-500/20 text-red-500"
                                        )}>
                                            {policy.is_active ? 'ACTIVE' : 'SUSPENDED'}
                                        </Badge>
                                    </div>

                                    <div className="space-y-6">
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Daily Limit Usage</span>
                                                <span className="text-xs text-white font-black">
                                                    ${policy.current_daily_usage_usd.toLocaleString()} / ${policy.max_daily_usd_exposure.toLocaleString()}
                                                </span>
                                            </div>
                                            <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${Math.min(100, (policy.current_daily_usage_usd / policy.max_daily_usd_exposure) * 100)}%` }}
                                                    className={cn(
                                                        "h-full rounded-full",
                                                        (policy.current_daily_usage_usd / policy.max_daily_usd_exposure) > 0.8 ? "bg-red-500" : "bg-primary"
                                                    )}
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Auto-Approve Cutoff</p>
                                                <p className="text-sm text-white font-black">${policy.auto_approve_threshold_usd}</p>
                                            </div>
                                            <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest mb-1">Max Risk Floor</p>
                                                <p className="text-sm text-white font-black">{(policy.max_risk_allowed * 100).toFixed(1)}%</p>
                                            </div>
                                        </div>

                                        <div className="pt-4 border-t border-white/5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Activity className="w-4 h-4 text-gray-500" />
                                                    <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Failure Containment</span>
                                                </div>
                                                <span className="text-[10px] text-gray-400 font-mono">
                                                    {policy.current_consecutive_negative_variance} / {policy.consecutive_negative_variance_limit} VAR LIMIT
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div
                            key="audit"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-[#1A1A1A] border border-gray-800 rounded-2xl overflow-hidden"
                            style={{ maxHeight: 'calc(100vh - 220px)' }}
                        >
                            {/* Search Bar for Audit */}
                            <div className="p-4 bg-black/40 border-b border-gray-800 flex justify-between items-center">
                                <div className="relative w-full max-w-md">
                                    <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                                    <Input
                                        placeholder="Search audit logs..."
                                        className="pl-10 h-10 bg-[#0d0d0d] border-gray-800 text-sm"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                    />
                                </div>
                                <Button variant="outline" size="sm" className="border-gray-800 text-gray-500 ml-4">
                                    <Filter className="w-4 h-4 mr-2" /> Filter
                                </Button>
                            </div>

                            <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 300px)' }}>
                                <table className="w-full text-xs text-left">
                                    <thead className="bg-black/40 border-b border-gray-800 text-[10px] font-black text-gray-500 uppercase tracking-widest font-mono sticky top-0">
                                        <tr>
                                            <th className="px-6 py-4">Timestamp</th>
                                            <th className="px-6 py-4">Actor</th>
                                            <th className="px-6 py-4">Event</th>
                                            <th className="px-6 py-4">Entity</th>
                                            <th className="px-6 py-4 text-right">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {auditLoading ? (
                                            <tr><td colSpan={5} className="py-10 text-center">Loading audit stream...</td></tr>
                                        ) : auditLogs?.length === 0 ? (
                                            <tr><td colSpan={5} className="py-20 text-center text-gray-600">No events logged yet.</td></tr>
                                        ) : auditLogs?.map((log) => (
                                            <tr key={log.id} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="px-6 py-4 text-gray-500 font-mono">
                                                    {format(new Date(log.created_at), 'HH:mm:ss.SSS')}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <div className={cn(
                                                            "w-2 h-2 rounded-full",
                                                            log.actor_name?.includes('Agent') ? "bg-primary animate-pulse" : "bg-blue-500"
                                                        )} />
                                                        <span className="text-white font-bold">{log.actor_name || 'System'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant="outline" className="text-[9px] font-black tracking-widest border-gray-800 bg-black/40 uppercase">
                                                        {log.event_type}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-gray-400 font-mono">{log.entity_type}:{log.entity_id.slice(0, 8)}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <button className="text-primary hover:underline font-black uppercase text-[10px] tracking-widest group-hover:translate-x-1 transition-transform inline-flex items-center gap-1">
                                                        View <ArrowRight className="w-3 h-3" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default OwnerCommandCenter;
