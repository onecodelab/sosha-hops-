import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, showToast, cn } from '../components/ui';
import {
    Search, FileText, Truck, PackageCheck, Calendar,
    ShoppingBag, DollarSign, CheckCircle2, MoreVertical,
    Eye, Clock, AlertCircle, Building
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../AuthContext';
import { PurchaseOrder } from '../types';

const SupplierDashboard: React.FC = () => {
    const { t } = useLanguage();
    const { profile } = useAuth();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
    const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

    // Fetch POs assigned to this supplier
    const { data: purchaseOrders, isLoading } = useQuery({
        queryKey: ['supplier-purchase-orders', profile?.supplier_id],
        queryFn: async () => {
            if (!profile?.supplier_id) return [];
            const { data, error } = await supabase
                .from('purchase_orders')
                .select(`
                    *,
                    branch:branches(name),
                    items:purchase_order_items(*, ingredient:ingredients(name, unit_type, units(abbreviation))),
                    activity_log:po_activity_log(*, performer:profiles(full_name))
                `)
                .eq('supplier_id', profile.supplier_id)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as any[];
        },
        enabled: !!profile?.supplier_id
    });

    // Mutation to update PO status
    const { mutate: updateStatus, isPending: isUpdating } = useMutation({
        mutationFn: async ({ poId, status, notes }: { poId: string, status: string, notes?: string }) => {
            // We use the manage-po logic or direct update if allowed by RLS
            // For now, let's assume direct update is handled by our RLS policy
            const { error } = await supabase
                .from('purchase_orders')
                .update({
                    status: status,
                    updated_at: new Date().toISOString()
                })
                .eq('id', poId);

            if (error) throw error;

            // Log activity
            await supabase.from('po_activity_log').insert({
                po_id: poId,
                action_type: 'updated',
                performed_by: profile?.id,
                notes: notes || `Status updated to ${status} by supplier`,
                organization_id: purchaseOrders?.find(p => p.id === poId)?.organization_id
            });
        },
        onSuccess: () => {
            showToast('Order status updated successfully', 'success');
            queryClient.invalidateQueries({ queryKey: ['supplier-purchase-orders'] });
            setIsDetailsModalOpen(false);
        },
        onError: (err: any) => showToast(err.message, 'error')
    });

    const filteredPOs = purchaseOrders?.filter(po => {
        const matchesSearch = po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
            po.branch?.name?.toLowerCase().includes(searchTerm.toLowerCase());

        if (filterStatus === 'all') return matchesSearch;
        return matchesSearch && po.status === filterStatus;
    }) || [];

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'sent':
                return <Badge className="bg-blue-500/10 text-blue-400 border-blue-500/20">Sent to You</Badge>;
            case 'coming':
                return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">In Transit</Badge>;
            case 'received':
                return <Badge className="bg-green-500/10 text-green-500 border-green-500/20">Delivered</Badge>;
            case 'verified':
                return <Badge className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Verified by Client</Badge>;
            default:
                return <Badge variant="outline" className="opacity-50">{status}</Badge>;
        }
    };

    const handleAction = (poId: string, status: string) => {
        const notes = status === 'coming' ? 'Supplier marked order as in transit.' : 'Supplier marked order as delivered.';
        updateStatus({ poId, status, notes });
    };

    return (
        <DashboardLayout
            title="Supplier Portal"
            subtitle="Manage your incoming procurement streams"
        >
            <div className="space-y-8 animate-in fade-in duration-700">
                {/* Stats Summary */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="bg-card/40 backdrop-blur-2xl border border-primary/20 rounded-[2rem] p-8 flex items-center justify-between group overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative">
                            <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-1">New Orders</p>
                            <h2 className="text-4xl font-black text-foreground tracking-tighter">
                                {purchaseOrders?.filter(p => p.status === 'sent').length || 0}
                            </h2>
                        </div>
                        <div className="p-4 bg-blue-500/10 rounded-2xl relative">
                            <ShoppingBag className="w-8 h-8 text-blue-400" />
                        </div>
                    </div>

                    <div className="bg-card/40 backdrop-blur-2xl border border-primary/20 rounded-[2rem] p-8 flex items-center justify-between group overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative">
                            <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-1">In Transit</p>
                            <h2 className="text-4xl font-black text-foreground tracking-tighter">
                                {purchaseOrders?.filter(p => p.status === 'coming').length || 0}
                            </h2>
                        </div>
                        <div className="p-4 bg-yellow-500/10 rounded-2xl relative">
                            <Truck className="w-8 h-8 text-yellow-400" />
                        </div>
                    </div>

                    <div className="bg-card/40 backdrop-blur-2xl border border-primary/20 rounded-[2rem] p-8 flex items-center justify-between group overflow-hidden relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-green-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                        <div className="relative">
                            <p className="text-[10px] font-black text-muted uppercase tracking-[0.2em] mb-1">Delivered (Month)</p>
                            <h2 className="text-4xl font-black text-foreground tracking-tighter">
                                {purchaseOrders?.filter(p => ['received', 'verified'].includes(p.status)).length || 0}
                            </h2>
                        </div>
                        <div className="p-4 bg-green-500/10 rounded-2xl relative">
                            <CheckCircle2 className="w-8 h-8 text-green-400" />
                        </div>
                    </div>
                </div>

                {/* Filters & Search */}
                <div className="flex flex-col md:flex-row justify-between gap-6 items-center">
                    <div className="flex bg-muted/10 p-1.5 rounded-[1.5rem] border border-border w-full md:w-auto overflow-x-auto no-scrollbar backdrop-blur-md">
                        {['all', 'sent', 'coming', 'received'].map(status => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={cn(
                                    "px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-[1.1rem] transition-all whitespace-nowrap",
                                    filterStatus === status
                                        ? "bg-primary text-black shadow-lg shadow-primary/20"
                                        : "text-muted hover:text-foreground hover:bg-muted/10"
                                )}
                            >
                                {status === 'all' ? 'All Orders' : status === 'sent' ? 'New Requests' : status === 'coming' ? 'In Transit' : 'Completed'}
                            </button>
                        ))}
                    </div>

                    <div className="relative w-full md:w-80 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted group-hover:text-primary transition-colors" />
                        <Input
                            placeholder="Find PO# or Restaurant..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 h-12 bg-muted/10 border-border focus:border-primary/50 text-foreground font-black rounded-xl"
                        />
                    </div>
                </div>

                {/* Main Table */}
                <div className="bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] overflow-hidden shadow-2xl">
                    <div className="p-8 border-b border-border bg-muted/5">
                        <h3 className="text-foreground flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em]">
                            <Building className="w-4 h-4 text-primary" /> Incoming Demand Manifest
                        </h3>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead className="text-[10px] font-black text-muted uppercase bg-muted/5 border-b border-border tracking-[0.2em]">
                                <tr>
                                    <th className="px-8 py-6">PO Number</th>
                                    <th className="px-8 py-6">Client (Restaurant)</th>
                                    <th className="px-8 py-6">Expected By</th>
                                    <th className="px-8 py-6 text-right">Commitment</th>
                                    <th className="px-8 py-6 text-center">Protocol Status</th>
                                    <th className="px-8 py-6 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {isLoading ? (
                                    <tr><td colSpan={6} className="p-20 text-center text-muted animate-pulse font-black uppercase tracking-widest">Scanning Network...</td></tr>
                                ) : filteredPOs.length === 0 ? (
                                    <tr><td colSpan={6} className="p-20 text-center text-muted font-black uppercase tracking-widest">No active procurement detected</td></tr>
                                ) : filteredPOs.map((po) => (
                                    <tr key={po.id} className="hover:bg-primary/5 transition-all group">
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-muted/10 rounded-lg">
                                                    <FileText className="w-4 h-4 text-primary" />
                                                </div>
                                                <span className="font-mono font-black text-foreground">{po.po_number}</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-black text-foreground">{po.branch?.name || 'Main Unit'}</span>
                                                <span className="text-[10px] text-muted font-bold uppercase tracking-widest">Level 1 Partner</span>
                                            </div>
                                        </td>
                                        <td className="px-8 py-6">
                                            <div className="flex items-center gap-2 text-muted font-mono text-[11px] font-bold">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(po.expected_delivery).toLocaleDateString()}
                                            </div>
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <span className="font-mono text-foreground font-black tracking-tighter text-lg">
                                                <span className="text-[10px] mr-1 opacity-40">ETB</span>
                                                {po.total_amount.toLocaleString()}
                                            </span>
                                        </td>
                                        <td className="px-8 py-6 text-center">
                                            {getStatusBadge(po.status)}
                                        </td>
                                        <td className="px-8 py-6 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    size="sm"
                                                    variant="outline"
                                                    className="rounded-xl border-border hover:bg-muted/10"
                                                    onClick={() => {
                                                        setSelectedPO(po);
                                                        setIsDetailsModalOpen(true);
                                                    }}
                                                >
                                                    <Eye className="w-4 h-4 mr-2" /> Details
                                                </Button>

                                                {po.status === 'sent' && (
                                                    <Button
                                                        size="sm"
                                                        className="bg-primary text-black font-black uppercase tracking-widest text-[9px] rounded-xl px-5 hover:scale-105 transition-all"
                                                        onClick={() => handleAction(po.id, 'coming')}
                                                        disabled={isUpdating}
                                                    >
                                                        Mark Coming
                                                    </Button>
                                                )}

                                                {po.status === 'coming' && (
                                                    <Button
                                                        size="sm"
                                                        className="bg-foreground text-background font-black uppercase tracking-widest text-[9px] rounded-xl px-5 hover:scale-105 transition-all"
                                                        onClick={() => handleAction(po.id, 'received')}
                                                        disabled={isUpdating}
                                                    >
                                                        Confirm Delivery
                                                    </Button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>

            {/* Details Modal */}
            {isDetailsModalOpen && selectedPO && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" onClick={() => setIsDetailsModalOpen(false)} />
                    <div className="bg-card w-full max-w-2xl rounded-[2.5rem] border border-primary/20 shadow-2xl relative overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between bg-muted/5">
                            <div>
                                <h2 className="text-2xl font-black tracking-tighter text-foreground">Manifest #{selectedPO.po_number}</h2>
                                <p className="text-[10px] font-black text-muted uppercase tracking-[0.3em] mt-1">Incoming Goods Specification</p>
                            </div>
                            <Button variant="ghost" size="icon" className="rounded-full hover:bg-muted/10" onClick={() => setIsDetailsModalOpen(false)}>
                                <AlertCircle className="w-6 h-6 rotate-45" />
                            </Button>
                        </div>

                        <div className="p-8 space-y-6 max-h-[60vh] overflow-y-auto custom-scrollbar">
                            <div className="grid grid-cols-2 gap-8 mb-8 pb-8 border-b border-white/5">
                                <div>
                                    <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Destination</p>
                                    <div className="flex items-center gap-2">
                                        <Building className="w-4 h-4 text-primary" />
                                        <span className="font-bold text-foreground">{selectedPO.branch?.name || 'Main Unit'}</span>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Status</p>
                                    {getStatusBadge(selectedPO.status)}
                                </div>
                            </div>

                            <div className="space-y-4">
                                <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
                                    <ShoppingBag className="w-4 h-4" /> Component Nodes (Items)
                                </h4>
                                <div className="space-y-3">
                                    {selectedPO.items?.map((item: any, idx: number) => (
                                        <div key={idx} className="flex items-center justify-between p-4 bg-muted/10 rounded-2xl border border-white/5 group hover:border-primary/20 transition-all">
                                            <div className="flex flex-col">
                                                <span className="font-bold text-foreground">{item.ingredient?.name}</span>
                                                <span className="text-[10px] text-muted font-bold">{item.ingredient?.units?.abbreviation || item.ingredient?.unit_type} specification</span>
                                            </div>
                                            <div className="flex items-center gap-8">
                                                <div className="text-right">
                                                    <p className="text-[9px] font-black text-muted uppercase tracking-widest">Quantity</p>
                                                    <p className="text-sm font-black text-foreground">{item.ordered_quantity}</p>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] font-black text-muted uppercase tracking-widest">Rate</p>
                                                    <p className="text-sm font-black text-foreground">{item.unit_price} <span className="text-[8px] opacity-40">ETB</span></p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-white/5 flex items-center justify-between font-black">
                                <span className="text-[10px] text-muted uppercase tracking-[0.2em]">Total Commitment Value</span>
                                <span className="text-2xl text-foreground tracking-tighter">
                                    <span className="text-xs mr-1 opacity-40 italic">ETB</span>
                                    {selectedPO.total_amount.toLocaleString()}
                                </span>
                            </div>
                        </div>

                        <div className="p-8 bg-muted/5 flex gap-4">
                            {selectedPO.status === 'sent' && (
                                <Button
                                    className="flex-1 bg-primary text-black font-black uppercase tracking-widest h-14 rounded-2xl hover:scale-105 transition-all shadow-xl shadow-primary/10"
                                    onClick={() => handleAction(selectedPO.id, 'coming')}
                                    disabled={isUpdating}
                                >
                                    Initiate Transit
                                </Button>
                            )}
                            {selectedPO.status === 'coming' && (
                                <Button
                                    className="flex-1 bg-foreground text-background font-black uppercase tracking-widest h-14 rounded-2xl hover:scale-105 transition-all shadow-xl shadow-foreground/10"
                                    onClick={() => handleAction(selectedPO.id, 'received')}
                                    disabled={isUpdating}
                                >
                                    Confirm Delivery Completion
                                </Button>
                            )}
                            <Button
                                variant="ghost"
                                className="px-8 text-muted font-black uppercase tracking-widest text-[10px] h-14 rounded-2xl"
                                onClick={() => setIsDetailsModalOpen(false)}
                            >
                                Dismiss
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </DashboardLayout>
    );
};

export default SupplierDashboard;
