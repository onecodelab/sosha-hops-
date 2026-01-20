
import React, { useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, cn, showToast } from '../components/ui';
import { POApprovalBadge } from '../components/POApprovalBadge';
import { PODetailView } from '../components/PODetailView';
import { usePendingPO } from '../hooks/usePendingPO';
import { useRoleAccess } from '../hooks/useRoleAccess';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { PurchaseOrder, POStatus } from '../types';
import {
    Search, Filter, Clock, AlertTriangle, DollarSign,
    Truck, User, Calendar, ChevronRight, FileText, RefreshCw
} from 'lucide-react';

const PendingPO: React.FC = () => {
    const { t } = useLanguage();
    const { user } = useAuth();
    const { isOwnerOrAdmin } = useRoleAccess();
    const { pendingPOs, isLoading } = usePendingPO();

    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<POStatus | 'all'>('all');
    // Owner Filters
    const [filterSupplier, setFilterSupplier] = useState<string>('all');
    const [filterManager, setFilterManager] = useState<string>('all');
    const [filterUrgency, setFilterUrgency] = useState<string>('all'); // all, urgent (<= 3 days), this_week

    // Derived lists for dropdowns
    const uniqueSuppliers = Array.from(new Set(pendingPOs?.map(p => p.supplier?.name).filter(Boolean))) || [];
    const uniqueManagers = Array.from(new Set(pendingPOs?.map(p => p.creator?.full_name).filter(Boolean))) || [];

    const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);

    // Filter POs
    const filteredPOs = pendingPOs?.filter(po => {
        // 1. Role Access
        if (!isOwnerOrAdmin && po.created_by !== user?.id) return false;

        // 2. Search
        const matchesSearch =
            po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            po.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase());

        // 3. Status
        const matchesStatus = filterStatus === 'all' || po.status === filterStatus;

        // 4. Owner Filters
        if (isOwnerOrAdmin) {
            if (filterSupplier !== 'all' && po.supplier?.name !== filterSupplier) return false;
            if (filterManager !== 'all' && po.creator?.full_name !== filterManager) return false;

            if (filterUrgency !== 'all') {
                const daysUntil = Math.ceil((new Date(po.expected_delivery).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                if (filterUrgency === 'urgent' && daysUntil > 3) return false;
                if (filterUrgency === 'week' && daysUntil > 7) return false;
            }
        }

        return matchesSearch && matchesStatus;
    }) || [];

    // Stats
    const draftCount = pendingPOs?.filter(po => po.status === 'draft').length || 0;
    const pendingCount = pendingPOs?.filter(po => ['pending', 'pending_approval'].includes(po.status)).length || 0;
    const revisionCount = pendingPOs?.filter(po => po.status === 'needs_revision').length || 0;
    const arrivingCount = pendingPOs?.filter(po => ['approved', 'sent'].includes(po.status)).length || 0;
    const totalValue = filteredPOs.reduce((sum, po) => sum + po.total_amount, 0);

    const statusTabs: { value: POStatus | 'all'; label: string; count: number }[] = [
        { value: 'all', label: 'All Pending', count: pendingPOs?.length || 0 },
        { value: 'draft', label: 'Drafts', count: draftCount },
        { value: 'pending_approval', label: 'Awaiting Review', count: pendingCount },
        { value: 'needs_revision', label: 'Needs Revision', count: revisionCount },
        { value: 'approved', label: 'Arriving / Approved', count: arrivingCount },
    ];

    return (
        <DashboardLayout
            title={isOwnerOrAdmin ? "PO Approvals" : "My Pending Orders"}
            subtitle={isOwnerOrAdmin ? "Review and approve purchase orders" : "Track your submitted orders"}
        >
            <div className="space-y-6 animate-in fade-in duration-500">
                {/* ... (Stats Row is fine) ... */}

                {/* Filters Section */}
                <div className="space-y-4">
                    {/* Top Row: Tabs + Search */}
                    <div className="flex flex-col md:flex-row justify-between gap-4">
                        <div className="flex bg-[#1A1A1A] p-1 rounded-xl border border-gray-800 overflow-x-auto">
                            {statusTabs.map(tab => (
                                <button
                                    key={tab.value}
                                    onClick={() => setFilterStatus(tab.value)}
                                    className={cn(
                                        "px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center gap-2 whitespace-nowrap",
                                        filterStatus === tab.value
                                            ? "bg-white/10 text-white"
                                            : "text-gray-500 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    {tab.label}
                                    <span className={cn(
                                        "text-[10px] px-1.5 py-0.5 rounded-full",
                                        filterStatus === tab.value ? "bg-primary/20 text-primary" : "bg-black/20"
                                    )}>
                                        {tab.count}
                                    </span>
                                </button>
                            ))}
                        </div>
                        <div className="relative w-full md:w-72">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                            <Input
                                placeholder="Search POs..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="pl-9 bg-[#1A1A1A] border-gray-800"
                            />
                        </div>
                    </div>

                    {/* Owner Advanced Filters */}
                    {isOwnerOrAdmin && (
                        <div className="flex flex-wrap gap-3 bg-[#1A1A1A] p-3 rounded-xl border border-gray-800">
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase px-2">
                                <Filter className="w-3 h-3" /> Filters:
                            </div>

                            {/* Supplier Filter */}
                            <select
                                value={filterSupplier}
                                onChange={(e) => setFilterSupplier(e.target.value)}
                                className="bg-black/40 text-sm text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
                            >
                                <option value="all">All Suppliers</option>
                                {uniqueSuppliers.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>

                            {/* Manager Filter */}
                            <select
                                value={filterManager}
                                onChange={(e) => setFilterManager(e.target.value)}
                                className="bg-black/40 text-sm text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
                            >
                                <option value="all">All Managers</option>
                                {uniqueManagers.map(m => <option key={m} value={m}>{m}</option>)}
                            </select>

                            {/* Urgency Filter */}
                            <select
                                value={filterUrgency}
                                onChange={(e) => setFilterUrgency(e.target.value)}
                                className="bg-black/40 text-sm text-gray-300 border border-gray-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary"
                            >
                                <option value="all">Any Date</option>
                                <option value="urgent">Urgent (≤ 3 Days)</option>
                                <option value="week">Due This Week</option>
                            </select>
                        </div>
                    )}
                </div>

                {/* PO Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {isLoading && (
                        <div className="col-span-full py-20 text-center text-gray-500">
                            <RefreshCw className="w-8 h-8 mx-auto animate-spin mb-4" />
                            Loading...
                        </div>
                    )}

                    {!isLoading && filteredPOs.length === 0 && (
                        <div className="col-span-full py-20 text-center text-gray-500">
                            <FileText className="w-16 h-16 mx-auto opacity-20 mb-4" />
                            <p className="font-bold">{t('po.empty')}</p>
                            <p className="text-sm">All caught up!</p>
                        </div>
                    )}

                    {filteredPOs.map(po => (
                        <Card
                            key={po.id}
                            onClick={() => setSelectedPO(po)}
                            className="bg-[#1A1A1A] border-gray-800 hover:border-primary/50 transition-all cursor-pointer group"
                        >
                            <CardContent className="p-5 space-y-4">
                                {/* Header */}
                                <div className="flex items-start justify-between">
                                    <div>
                                        <p className="font-mono font-bold text-white text-lg">{po.po_number}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            Created {new Date(po.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                    <POApprovalBadge status={po.status} />
                                </div>

                                {/* Details */}
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Truck className="w-4 h-4 text-gray-500" />
                                        <span className="text-gray-300">{po.supplier?.name || 'Unknown Supplier'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <User className="w-4 h-4 text-gray-500" />
                                        <span className="text-gray-400">{po.creator?.full_name || 'Unknown'}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm">
                                        <Calendar className="w-4 h-4 text-gray-500" />
                                        <span className="text-gray-400">ETA: {new Date(po.expected_delivery).toLocaleDateString()}</span>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                                    <p className="text-xl font-black text-primary font-mono">
                                        ETB {po.total_amount.toLocaleString()}
                                    </p>
                                    <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-primary transition-colors" />
                                </div>

                                {/* Risk Flags */}
                                {po.total_amount > 50000 && (
                                    <Badge className="bg-orange-500/10 text-orange-500 border-orange-500/20 text-[9px]">
                                        <AlertTriangle className="w-3 h-3 mr-1" /> High Value
                                    </Badge>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>

            </div>

            {/* Detail View Modal */}
            {selectedPO && (
                <PODetailView
                    po={selectedPO}
                    isOpen={!!selectedPO}
                    onClose={() => setSelectedPO(null)}
                />
            )}
        </DashboardLayout>
    );
};

export default PendingPO;
