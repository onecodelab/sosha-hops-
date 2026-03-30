
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { useLayoutConfig } from '../contexts/LayoutContext';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, cn } from '../components/ui';
import {
    Search, FileText, Eye, Download, MoreVertical,
    ShoppingBag, Calendar, Hash, User, CreditCard
} from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useBranch } from '../contexts/BranchContext';
import { Order } from '../types';
import { OrderDetailsModal } from '../components/OrderDetailsModal';
import { format } from 'date-fns';
import { enrichOrdersWithProfiles } from '../utils/orderProfileEnrichment';

const WaiterOrders: React.FC = () => {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

    // Fetch Waiter's Orders
    const { data: orders, isLoading } = useQuery({
        queryKey: ['waiter-orders', user?.id, activeBranchId],
        queryFn: async () => {
            if (!user?.id || !activeBranchId) return [];
            const { data, error } = await supabase
                .from('orders')
                .select(`
               *,
               order_items (
                  id,
                  quantity,
                  price,
                  special_instructions,
                  menu_item:menu!menu_item_id (name)
               )
            `)
                .eq('waiter_id', user.id)
                .eq('branch_id', activeBranchId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return enrichOrdersWithProfiles((data || []) as unknown as Order[]);
        },
        enabled: !!user?.id && !!activeBranchId
    });

    const filteredOrders = orders?.filter(order => {
        const orderNo = order.order_number?.toLowerCase() || '';
        const tableNo = order.table_number?.toLowerCase() || '';
        const matchesSearch = orderNo.includes(searchTerm.toLowerCase()) || tableNo.includes(searchTerm.toLowerCase());

        let matchesStatus = true;
        if (filterStatus !== 'all') {
            if (filterStatus === 'paid') matchesStatus = order.payment_status === 'paid';
            else if (filterStatus === 'pending') matchesStatus = order.payment_status === 'pending';
            else matchesStatus = order.status === filterStatus;
        }

        return matchesSearch && matchesStatus;
    }) || [];

    const getStatusBadge = (order: Order) => {
        if (order.payment_status === 'paid') return <Badge variant="success" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">VERIFIED</Badge>;
        if (order.status === 'cancelled') return <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20">CANCELLED</Badge>;
        return <Badge variant="warning" className="bg-orange-500/10 text-orange-500 border-orange-500/20 uppercase">{order.status}</Badge>;
    };

    // Close dropdowns on outside click
    React.useEffect(() => {
        const handleClick = () => setActiveDropdown(null);
        window.addEventListener('click', handleClick);
        return () => window.removeEventListener('click', handleClick);
    }, []);

    useLayoutConfig({
        title: "My Order Transactions",
        subtitle: "Audit trail of orders served and payments processed"
    });

    return (
        <>
            <div className="space-y-6 animate-in fade-in duration-500">
                {/* Controls */}
                <div className="flex flex-col lg:flex-row justify-between gap-6 items-center">
                    {/* Premium Segmented Tabs */}
                    <div className="flex bg-muted/10 p-1.5 rounded-2xl border border-border w-full lg:w-auto overflow-x-auto no-scrollbar snap-x">
                        {['all', 'pending', 'paid', 'cancelled'].map(status => {
                            const count = orders?.filter(o => {
                                if (status === 'all') return true;
                                if (status === 'paid') return o.payment_status === 'paid';
                                if (status === 'pending') return o.payment_status === 'pending';
                                return o.status === status;
                            }).length || 0;

                            return (
                                <button
                                    key={status}
                                    onClick={() => setFilterStatus(status)}
                                    className={cn(
                                        "px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-3 whitespace-nowrap snap-start",
                                        filterStatus === status
                                            ? "bg-primary text-black shadow-lg"
                                            : "text-muted hover:text-foreground hover:bg-muted/10"
                                    )}
                                >
                                    <span>{status}</span>
                                    <span className={cn(
                                        "text-[9px] px-2 py-0.5 rounded-full font-bold",
                                        filterStatus === status ? "bg-black/20 text-black" : "bg-muted/20 text-muted"
                                    )}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Premium Search */}
                    <div className="relative w-full lg:w-80 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted group-focus-within:text-primary transition-colors" />
                        <Input
                            placeholder="Search order or table..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-12 bg-card/60 backdrop-blur-xl border-border focus:border-primary/50 h-12 rounded-2xl shadow-inner text-sm font-bold"
                        />
                    </div>
                </div>

                {/* Premium Transaction Card */}
                <Card className="bg-card/60 backdrop-blur-xl border-border rounded-[2.5rem] shadow-2xl overflow-hidden min-h-[500px] flex flex-col">
                    <CardHeader className="border-b border-border p-8 bg-muted/5">
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-4 text-foreground">
                                <div className="p-3 bg-primary/10 rounded-2xl">
                                    <FileText className="w-6 h-6 text-primary" strokeWidth={3} />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-xl font-black tracking-tight">Audit Trail</span>
                                    <span className="text-[10px] text-muted uppercase font-black tracking-widest mt-1">Order Transaction History</span>
                                </div>
                            </CardTitle>
                            <Button variant="ghost" className="h-10 px-4 rounded-xl bg-muted/5 border border-border text-muted hover:text-foreground text-[10px] font-black uppercase tracking-widest">
                                <Download className="w-4 h-4 mr-2" /> Export CSV
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-x-auto custom-scrollbar">
                        <table className="w-full text-sm text-left whitespace-nowrap">
                            <thead className="text-[10px] text-muted uppercase bg-muted/10 border-b border-border font-black tracking-[0.2em]">
                                <tr>
                                    <th className="px-4 md:px-8 py-3 md:py-5">Sync ID</th>
                                    <th className="px-4 md:px-8 py-3 md:py-5">Station</th>
                                    <th className="px-4 md:px-8 py-3 md:py-5">Timestamp</th>
                                    <th className="px-4 md:px-8 py-3 md:py-5">Flow</th>
                                    <th className="px-4 md:px-8 py-3 md:py-5 text-right">Value</th>
                                    <th className="px-4 md:px-8 py-3 md:py-5 text-center">Protocol</th>
                                    <th className="px-4 md:px-8 py-3 md:py-5 text-right w-20">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border/40">
                                {isLoading ? (
                                    <tr><td colSpan={7} className="p-20 text-center"><div className="flex flex-col items-center gap-4 opacity-20"><RefreshCw className="w-12 h-12 animate-spin text-primary" /><p className="text-[10px] font-black uppercase tracking-[0.4em]">Optimizing Cache...</p></div></td></tr>
                                ) : filteredOrders.length === 0 ? (
                                    <tr><td colSpan={7} className="p-24 text-center text-muted uppercase font-black tracking-[0.4em] text-xs">No records initialized</td></tr>
                                ) : filteredOrders.map((order) => (
                                    <tr key={order.id} className="hover:bg-primary/[0.02] transition-colors group">
                                        <td className="px-4 md:px-8 py-3 md:py-5 font-mono font-black text-foreground text-xs uppercase opacity-80">{order.order_number}</td>
                                        <td className="px-4 md:px-8 py-3 md:py-5">
                                            <Badge className="bg-muted/10 border-border text-foreground font-black px-3 py-1 rounded-lg shadow-sm">#{order.table_number}</Badge>
                                        </td>
                                        <td className="px-4 md:px-8 py-3 md:py-5">
                                            <div className="flex flex-col">
                                                <span className="text-foreground font-black text-xs uppercase">{format(new Date(order.created_at), 'MMM dd')}</span>
                                                <span className="text-[9px] text-muted font-black uppercase tracking-widest mt-1">{format(new Date(order.created_at), 'hh:mm a')}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 md:px-8 py-3 md:py-5">
                                            <div className="flex items-center gap-3 text-muted">
                                                <CreditCard className="w-4 h-4 opacity-30" strokeWidth={3} />
                                                <span className="text-[9px] font-black uppercase tracking-[0.2em]">{order.payment_method || 'CASH'}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 md:px-8 py-3 md:py-5 text-right font-mono text-foreground font-black text-sm">
                                            ETB {order.total_amount?.toLocaleString() || '0'}
                                        </td>
                                        <td className="px-4 md:px-8 py-3 md:py-5 text-center">
                                            {getStatusBadge(order)}
                                        </td>
                                        <td className="px-4 md:px-8 py-3 md:py-5 text-right relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === order.id ? null : order.id); }}
                                                className="p-2.5 bg-muted/5 hover:bg-primary/10 rounded-xl text-muted hover:text-primary transition-all shadow-inner"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>

                                            {activeDropdown === order.id && (
                                                <div className="absolute right-12 top-12 w-56 bg-card border border-border rounded-2xl shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="p-2">
                                                        <button
                                                            onClick={() => setSelectedOrder(order)}
                                                            className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted hover:bg-primary/10 hover:text-primary rounded-xl flex items-center gap-3 transition-colors"
                                                        >
                                                            <Eye className="w-4 h-4" /> Inspect Node
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </CardContent>
                </Card>
            </div>

            <OrderDetailsModal
                isOpen={!!selectedOrder}
                onClose={() => setSelectedOrder(null)}
                order={selectedOrder}
            />
        </>
    );
};

// Simple Refresh icon for the empty state
const RefreshCw = ({ className }: { className?: string }) => (
    <svg
        xmlns="http://www.w3.org/2000/svg"
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
    >
        <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
        <path d="M21 3v5h-5" />
        <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
        <path d="M3 21v-5h5" />
    </svg>
);

export default WaiterOrders;
