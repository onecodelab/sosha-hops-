
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { DashboardLayout } from '../components/DashboardLayout';
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
               waiter:profiles!orders_waiter_id_fkey (id, full_name, role),
               order_items (
                  id,
                  quantity,
                  price,
                  menu_item:menu (name)
               )
            `)
                .eq('waiter_id', user.id)
                .eq('branch_id', activeBranchId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data as unknown as Order[];
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

    return (
        <DashboardLayout
            title="My Order Transactions"
            subtitle="Audit trail of orders served and payments processed"
        >
            <div className="space-y-6 animate-in fade-in duration-500">
                {/* Controls */}
                <div className="flex flex-col md:flex-row justify-between gap-4 items-center px-1">
                    {/* Tabs */}
                    <div className="flex bg-[#1A1A1A] p-1 rounded-lg border border-gray-800 w-full md:w-auto overflow-x-auto">
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
                                        "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap",
                                        filterStatus === status
                                            ? "bg-white/10 text-white shadow-sm"
                                            : "text-gray-400 hover:text-white hover:bg-white/5"
                                    )}
                                >
                                    <span className="capitalize">{status}</span>
                                    <span className={cn("text-xs px-1.5 py-0.5 rounded-full", filterStatus === status ? "bg-black/40 text-white" : "bg-black/20 text-gray-500")}>
                                        {count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    {/* Search */}
                    <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                            placeholder="Search order or table..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-9 bg-[#1A1A1A] border-gray-800 focus:border-primary/50 h-10"
                        />
                    </div>
                </div>

                {/* Table */}
                <Card className="bg-[#1A1A1A] border-gray-800 min-h-[500px] flex flex-col overflow-hidden">
                    <CardHeader className="border-b border-gray-800 pb-3 bg-black/20">
                        <CardTitle className="text-white flex items-center gap-2 text-base">
                            <FileText className="w-5 h-5 text-gray-400" /> Transaction History
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0 flex-1 overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-[10px] text-gray-500 uppercase bg-black/40 border-b border-gray-800 font-black tracking-widest">
                                <tr>
                                    <th className="px-6 py-4">Order Number</th>
                                    <th className="px-6 py-4">Table</th>
                                    <th className="px-6 py-4">Created</th>
                                    <th className="px-6 py-4">Method</th>
                                    <th className="px-6 py-4 text-right">Amount</th>
                                    <th className="px-6 py-4 text-center">Status</th>
                                    <th className="px-6 py-4 text-right w-20">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800">
                                {isLoading ? (
                                    <tr><td colSpan={7} className="p-20 text-center"><div className="flex flex-col items-center gap-3 opacity-20"><RefreshCw className="w-10 h-10 animate-spin text-primary" /><p className="text-[10px] font-black uppercase tracking-widest">Syncing Records...</p></div></td></tr>
                                ) : filteredOrders.length === 0 ? (
                                    <tr><td colSpan={7} className="p-20 text-center text-gray-600 uppercase font-black tracking-widest text-xs">No transactions detected</td></tr>
                                ) : filteredOrders.map((order) => (
                                    <tr key={order.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4 font-mono font-bold text-white text-xs">{order.order_number}</td>
                                        <td className="px-6 py-4">
                                            <Badge variant="outline" className="bg-black/40 border-white/5 text-gray-300 font-black">#{order.table_number}</Badge>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-col">
                                                <span className="text-gray-300 font-bold text-xs">{format(new Date(order.created_at), 'MMM dd, yyyy')}</span>
                                                <span className="text-[10px] text-gray-500 font-black uppercase">{format(new Date(order.created_at), 'hh:mm a')}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-gray-400">
                                                <CreditCard className="w-3.5 h-3.5 opacity-50" />
                                                <span className="text-[10px] font-black uppercase tracking-widest">{order.payment_method || 'CASH'}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right font-mono text-primary font-black text-sm">
                                            ETB {order.total_amount?.toLocaleString() || '0'}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            {getStatusBadge(order)}
                                        </td>
                                        <td className="px-6 py-4 text-right relative">
                                            <button
                                                onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === order.id ? null : order.id); }}
                                                className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                                            >
                                                <MoreVertical className="w-4 h-4" />
                                            </button>

                                            {activeDropdown === order.id && (
                                                <div className="absolute right-8 top-8 w-48 bg-[#222] border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                                    <div className="p-1">
                                                        <button
                                                            onClick={() => setSelectedOrder(order)}
                                                            className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded flex items-center gap-2"
                                                        >
                                                            <Eye className="w-4 h-4" /> View Details
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
        </DashboardLayout>
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
