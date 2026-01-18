
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, showToast, cn } from '../components/ui';
import {
    TrendingUp, AlertTriangle, Clock, DollarSign,
    RefreshCw, Zap, Users, ShieldAlert, XCircle, LayoutGrid, List
} from 'lucide-react';
import { analyticsService, TableMetric } from '../services/analyticsService';
import { useRoleAccess } from '../hooks/useRoleAccess';
import { motion, AnimatePresence } from 'framer-motion';

const AdminFloorAnalytics: React.FC = () => {
    const { hasPermission } = useRoleAccess();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');

    // Fetch Metrics
    const { data: metrics, isLoading, refetch } = useQuery({
        queryKey: ['floor-analytics', timeRange],
        queryFn: () => analyticsService.getFloorMetrics(timeRange),
        enabled: hasPermission('canViewAnalytics'), // Security Check
    });

    if (!hasPermission('canViewAnalytics')) {
        return (
            <DashboardLayout title="Floor Analytics" subtitle="Restricted Access">
                <div className="flex flex-col items-center justify-center h-[50vh] text-center p-8">
                    <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
                    <h2 className="text-2xl font-black text-white mb-2">Access Denied</h2>
                    <p className="text-zinc-400">You do not have permission to view sensitive financial analytics.</p>
                </div>
            </DashboardLayout>
        );
    }

    // Derived Aggregates
    const totalRev = metrics?.reduce((sum, m) => sum + m.total_revenue, 0) || 0;
    const avgUtil = metrics && metrics.length > 0
        ? Math.round(metrics.reduce((sum, m) => sum + m.utilization_rate, 0) / metrics.length)
        : 0;
    const camperCount = metrics?.filter(m => m.is_camper).length || 0;
    const topTables = [...(metrics || [])].sort((a, b) => b.score - a.score).slice(0, 3);
    const bottomTables = [...(metrics || [])].sort((a, b) => a.score - b.score).slice(0, 3);

    return (
        <DashboardLayout
            title="Floor Analytics"
            subtitle="Advanced performance metrics & suspicious activity detection"
            actions={
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => refetch()} size="sm" className="gap-2">
                        <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} /> Refresh
                    </Button>
                </div>
            }
        >
            <div className="space-y-8 animate-in fade-in duration-500 pb-20">

                {/* 1. KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <MetricCard
                        label="Total Revenue"
                        value={`ETB ${totalRev.toLocaleString()}`}
                        icon={DollarSign}
                        trend="+12% vs last week" // Placeholder trend
                        color="green"
                    />
                    <MetricCard
                        label="Floor Utilization"
                        value={`${avgUtil}%`}
                        icon={Zap}
                        subValue="Target: 75%"
                        color="blue"
                    />
                    <MetricCard
                        label="Active Campers"
                        value={camperCount}
                        icon={Clock}
                        subValue={camperCount > 0 ? "Action Required" : "Floor Optimized"}
                        color={camperCount > 0 ? "red" : "gray"}
                    />
                    <MetricCard
                        label="Dead Hours"
                        value="2h"
                        icon={XCircle}
                        subValue="14:00 - 16:00"
                        color="yellow"
                    />
                </div>

                {/* 2. Visualization & Heatmap */}
                <Card className="bg-black/40 border-white/5 backdrop-blur-sm overflow-hidden">
                    <CardHeader className="flex flex-row items-center justify-between border-b border-white/5 pb-4">
                        <div className="space-y-1">
                            <CardTitle className="text-lg font-black uppercase tracking-widest text-white flex items-center gap-2">
                                <LayoutGrid className="w-5 h-5 text-primary" /> Performance Heatmap
                            </CardTitle>
                            <p className="text-xs text-zinc-500 font-mono">
                                Live scoring based on Revenue (50%), Utilization (30%), Turnover (20%)
                            </p>
                        </div>
                        <div className="flex bg-zinc-900 p-1 rounded-lg border border-white/5">
                            {(['today', 'week', 'month'] as const).map(t => (
                                <button
                                    key={t}
                                    onClick={() => setTimeRange(t)}
                                    className={cn(
                                        "px-4 py-1.5 text-[10px] font-black uppercase tracking-wider rounded-md transition-all",
                                        timeRange === t ? "bg-zinc-800 text-white shadow-sm" : "text-zinc-500 hover:text-white"
                                    )}
                                >
                                    {t}
                                </button>
                            ))}
                        </div>
                    </CardHeader>

                    <CardContent className="p-6">
                        {isLoading ? (
                            <div className="h-64 flex items-center justify-center">
                                <RefreshCw className="w-8 h-8 animate-spin text-zinc-600" />
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4">
                                {metrics?.map((table) => {
                                    const score = table.score;
                                    let grade = "F";
                                    if (score >= 90) grade = "A";
                                    else if (score >= 80) grade = "B";
                                    else if (score >= 65) grade = "C";
                                    else if (score >= 50) grade = "D";

                                    return (
                                        <div
                                            key={table.table_id}
                                            className={cn(
                                                "relative aspect-square rounded-2xl border flex flex-col items-center justify-center p-4 transition-all hover:scale-105 cursor-pointer group",
                                                getHeatmapColor(table.score)
                                            )}
                                        >
                                            <span className="text-2xl font-black text-white/90">{table.table_number}</span>
                                            <Badge variant="outline" className="mt-2 text-[11px] border-white/20 bg-black/20 text-white backdrop-blur-md font-black">
                                                GRADE: {grade}
                                            </Badge>

                                            {/* Hover Details */}
                                            <div className="absolute inset-0 bg-black/95 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-4 text-center rounded-2xl z-10 space-y-1">
                                                <p className="text-[10px] font-bold text-zinc-400 uppercase">Rev/Hour</p>
                                                <p className="text-lg font-black text-white">ETB {table.revenue_per_hour}</p>
                                                <div className="w-full h-px bg-white/10 my-2" />
                                                <p className="text-[10px] font-bold text-zinc-400 uppercase">Turnover</p>
                                                <p className="text-xs font-mono text-white">{table.avg_duration_minutes}m Avg</p>
                                            </div>

                                            {/* Alerts */}
                                            {table.is_camper && (
                                                <div className="absolute -top-2 -right-2 bg-red-500 text-white p-1.5 rounded-full shadow-[0_0_15px_rgba(239,68,68,0.5)] animate-bounce z-20">
                                                    <AlertTriangle className="w-4 h-4" />
                                                </div>
                                            )}
                                            {table.reopen_abuse && (
                                                <div className="absolute -top-2 -left-2 bg-orange-500 text-white p-1.5 rounded-full shadow-[0_0_15px_rgba(249,115,22,0.5)] animate-pulse z-20">
                                                    <RefreshCw className="w-4 h-4" />
                                                </div>
                                            )}
                                            {table.void_count > 0 && (
                                                <div className="absolute -bottom-2 -right-2 bg-zinc-600 text-white px-2 py-0.5 rounded-full text-[8px] font-black z-20">
                                                    {table.void_count} VOIDS
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* 3. Rankings & Insights */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Top Performers */}
                    <Card className="bg-gradient-to-br from-green-500/5 to-transparent border-green-500/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-green-400 text-sm uppercase tracking-widest font-black">
                                <TrendingUp className="w-4 h-4" /> Top Performers ({timeRange})
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {topTables.map((t, i) => (
                                <div key={t.table_id} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-4">
                                        <span className="text-xl font-black text-zinc-600 w-6">#{i + 1}</span>
                                        <div>
                                            <p className="font-bold text-white text-sm">Table {t.table_number}</p>
                                            <p className="text-[10px] text-zinc-500 uppercase">{t.zone}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-green-400 font-bold">ETB {t.total_revenue.toLocaleString()}</p>
                                        <p className="text-[10px] text-zinc-500">{t.total_sessions} Sessions</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>

                    {/* Underperformers */}
                    <Card className="bg-gradient-to-br from-red-500/5 to-transparent border-red-500/10">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-red-400 text-sm uppercase tracking-widest font-black">
                                <AlertTriangle className="w-4 h-4" /> Underperforming Areas
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-3">
                            {bottomTables.map((t, i) => (
                                <div key={t.table_id} className="flex items-center justify-between p-3 bg-black/20 rounded-xl border border-white/5">
                                    <div className="flex items-center gap-4">
                                        <div className="w-2 h-2 rounded-full bg-red-500" />
                                        <div>
                                            <p className="font-bold text-white text-sm">Table {t.table_number}</p>
                                            <p className="text-[10px] text-zinc-500 uppercase">{t.zone}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-mono text-red-400 font-bold">Score: {t.score}/100</p>
                                        <p className="text-[10px] text-zinc-500">{t.dead_hours}h Idle</p>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </div>

            </div>
        </DashboardLayout >
    );
};

// Helper: Heatmap Color Logic
const getHeatmapColor = (score: number) => {
    if (score >= 80) return "bg-green-500/10 border-green-500/30 shadow-[0_0_20px_rgba(34,197,94,0.1)]";
    if (score >= 50) return "bg-yellow-500/10 border-yellow-500/30";
    return "bg-red-500/10 border-red-500/30";
};

// Sub-component: KPI Card
const MetricCard = ({ label, value, icon: Icon, trend, subValue, color }: any) => {
    const colors: any = {
        green: "text-green-500 bg-green-500/10",
        blue: "text-blue-500 bg-blue-500/10",
        red: "text-red-500 bg-red-500/10",
        yellow: "text-yellow-500 bg-yellow-500/10",
        gray: "text-zinc-500 bg-zinc-500/10"
    };

    return (
        <Card className="bg-black/40 border-white/5 backdrop-blur-sm">
            <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{label}</span>
                    <div className={cn("p-2 rounded-lg", colors[color])}>
                        <Icon className="w-4 h-4" />
                    </div>
                </div>
                <div className="space-y-1">
                    <h3 className="text-2xl font-black text-white tracking-tight">{value}</h3>
                    {(trend || subValue) && (
                        <p className="text-xs font-medium text-zinc-400 flex items-center gap-1">
                            {trend && <span className="text-green-500">{trend}</span>}
                            {subValue}
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
};

export default AdminFloorAnalytics;
