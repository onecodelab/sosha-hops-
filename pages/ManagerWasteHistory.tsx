import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, Button, Input, showToast, cn, Badge } from '../components/ui';
import { Trash2, Search, DollarSign, Calendar, Filter, User, AlertTriangle, ArrowDownRight } from 'lucide-react';
import { supabase } from '../supabase';
import { useBranch } from '../contexts/BranchContext';
import { format } from 'date-fns';

const ManagerWasteHistory: React.FC = () => {
    const { activeBranchId } = useBranch();
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch Logs
    useEffect(() => {
        if (!activeBranchId) return;
        fetchLogs();
    }, [activeBranchId]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('waste_logs')
                .select(`
          *,
          ingredients (name, sku),
          profiles:reported_by (full_name, email)
        `)
                .eq('branch_id', activeBranchId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setLogs(data || []);
        } catch (err: any) {
            console.error("Error fetching waste logs:", err);
            showToast("Failed to load waste history", "error");
        } finally {
            setLoading(false);
        }
    };

    // Stats
    const stats = useMemo(() => {
        const totalCost = logs.reduce((sum, log) => sum + (Number(log.cost_snapshot) || 0), 0);
        const totalItems = logs.length;
        // Most common reason
        const reasons: Record<string, number> = {};
        logs.forEach(l => { reasons[l.waste_reason] = (reasons[l.waste_reason] || 0) + 1; });
        const topReason = Object.entries(reasons).sort((a, b) => b[1] - a[1])[0];

        return { totalCost, totalItems, topReason: topReason ? topReason[0] : 'None' };
    }, [logs]);

    // Render Reason Badge
    const getReasonBadge = (reason: string) => {
        const styles: Record<string, string> = {
            spoiled: 'bg-red-500/10 text-red-500 border-red-500/20',
            burnt: 'bg-orange-500/10 text-orange-500 border-orange-500/20',
            dropped: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20',
            expired: 'bg-purple-500/10 text-purple-500 border-purple-500/20',
            overproduction: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
            other: 'bg-gray-500/10 text-gray-400 border-gray-500/20',
        };
        return (
            <span className={cn("px-2 py-1 rounded-md border text-[10px] font-black uppercase tracking-wider", styles[reason] || styles.other)}>
                {reason}
            </span>
        );
    };

    return (
        <DashboardLayout title="Waste Analytics" subtitle="Track Loss & Cost Impact">
            <div className="space-y-8 animate-in fade-in duration-500 pb-20">
                {/* Top Stats - SOSHA STYLE */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-[#1A1A1A] border border-gray-800 rounded-3xl p-6 relative overflow-hidden group hover:border-red-500/30 transition-all">
                        <div className="absolute inset-0 bg-gradient-to-br from-red-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-[10px] font-black text-red-400 uppercase tracking-[0.2em] mb-2">Total Loss Value</p>
                                <h3 className="text-3xl font-black text-white tracking-tight drop-shadow-[0_0_15px_rgba(220,38,38,0.5)]">
                                    <span className="text-lg opacity-50 mr-1">ETB</span>
                                    {stats.totalCost.toLocaleString()}
                                </h3>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20 group-hover:scale-110 transition-transform">
                                <DollarSign className="w-6 h-6 text-red-500" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#1A1A1A] border border-gray-800 rounded-3xl p-6 relative overflow-hidden group hover:border-blue-500/30 transition-all">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-[10px] font-black text-blue-400 uppercase tracking-[0.2em] mb-2">Incidents</p>
                                <h3 className="text-3xl font-black text-white tracking-tight">
                                    {stats.totalItems}
                                </h3>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 group-hover:scale-110 transition-transform">
                                <Trash2 className="w-6 h-6 text-blue-500" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#1A1A1A] border border-gray-800 rounded-3xl p-6 relative overflow-hidden group hover:border-amber-500/30 transition-all">
                        <div className="absolute inset-0 bg-gradient-to-br from-amber-600/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <div className="flex justify-between items-start relative z-10">
                            <div>
                                <p className="text-[10px] font-black text-amber-500 uppercase tracking-[0.2em] mb-2">Primary Cause</p>
                                <h3 className="text-2xl font-black text-white tracking-tight capitalize truncate max-w-[150px]">
                                    {stats.topReason}
                                </h3>
                            </div>
                            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center border border-amber-500/20 group-hover:scale-110 transition-transform">
                                <AlertTriangle className="w-6 h-6 text-amber-500" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Filters & List - SOSHA STYLE */}
                <div className="bg-[#1A1A1A] border border-gray-800 rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col min-h-[500px]">
                    <div className="p-6 border-b border-gray-800 flex flex-col md:flex-row items-center justify-between gap-4 bg-white/[0.02]">
                        <div className="relative w-full md:w-96 group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-white transition-colors" />
                            <input
                                placeholder="Search by ingredient or staff..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full h-12 pl-12 bg-black/20 border border-white/10 rounded-2xl text-white placeholder:text-gray-600 focus:outline-none focus:border-white/20 focus:bg-black/40 transition-all font-medium"
                            />
                        </div>
                        <Button
                            variant="outline"
                            onClick={fetchLogs}
                            className="h-10 border-white/10 hover:bg-white/5 text-gray-400 hover:text-white rounded-xl uppercase text-[10px] font-black tracking-widest w-full md:w-auto"
                        >
                            Refresh Data
                        </Button>
                    </div>

                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="sticky top-0 bg-black/40 backdrop-blur-md z-10">
                                <tr className="border-b border-gray-800">
                                    <th className="px-8 py-5 text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Reported</th>
                                    <th className="px-6 py-5 text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Staff Member</th>
                                    <th className="px-6 py-5 text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Ingredient</th>
                                    <th className="px-6 py-5 text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Loss Qty</th>
                                    <th className="px-6 py-5 text-[9px] font-black text-gray-500 uppercase tracking-[0.2em]">Reason</th>
                                    <th className="px-8 py-5 text-[9px] font-black text-gray-500 uppercase tracking-[0.2em] text-right">Value Impact</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {logs
                                    .filter(l =>
                                        l.ingredients?.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                                        l.profiles?.full_name.toLowerCase().includes(searchTerm.toLowerCase())
                                    )
                                    .map((log) => (
                                        <tr key={log.id} className="hover:bg-white/[0.02] transition-colors">
                                            <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                                                {format(new Date(log.created_at), 'MMM dd, HH:mm')}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex items-center gap-2">
                                                    <User className="w-3 h-3 text-gray-600" />
                                                    <span className="text-white font-medium">{log.profiles?.full_name || 'Unknown'}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-col">
                                                    <span className="text-white font-bold">{log.ingredients?.name}</span>
                                                    <span className="text-[10px] text-gray-600 font-mono tracking-wider">{log.ingredients?.sku}</span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className="text-red-400 font-bold font-mono">
                                                    -{Number(log.quantity)} {log.unit_type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4">
                                                {getReasonBadge(log.waste_reason)}
                                                {log.notes && <p className="text-[10px] text-gray-500 mt-1 italic">"{log.notes}"</p>}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-zinc-300 font-mono font-medium">
                                                    ETB {Number(log.cost_snapshot).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                                </span>
                                            </td>
                                        </tr>
                                    ))}
                                {logs.length === 0 && !loading && (
                                    <tr>
                                        <td colSpan={6} className="py-24 text-center text-gray-600">
                                            <Trash2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                            <p className="uppercase font-bold tracking-widest text-xs">No Waste Records Found</p>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </DashboardLayout>
    );
};

export default ManagerWasteHistory;
