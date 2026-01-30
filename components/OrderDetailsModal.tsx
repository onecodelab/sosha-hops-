
import React from 'react';
import { Dialog, Badge, Button, cn } from './ui';
import { Order } from '../types';
import {
    X, Receipt, Clock, MapPin, User, CreditCard,
    DollarSign, Hash, ShieldCheck, ShoppingBag
} from 'lucide-react';

interface OrderDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: Order | null;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ isOpen, onClose, order }) => {
    if (!order) return null;

    const subtotal = order.subtotal_amount || 0;
    const vat = order.vat_amount || 0;
    const tip = order.tip_amount || 0;
    const total = order.total_amount || 0;

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'paid': return 'bg-green-500/20 text-green-400 border-green-500/30';
            case 'served': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
            case 'closed': return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
            default: return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
        }
    };

    return (
        <Dialog isOpen={isOpen} onClose={onClose} title="Transaction Details">
            <div className="space-y-6 animate-in fade-in zoom-in duration-300">

                {/* Header Section */}
                <div className="flex justify-between items-start bg-white/5 p-4 rounded-2xl border border-white/5">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Receipt No</span>
                            <Badge variant="outline" className="font-mono text-zinc-300 border-white/10 uppercase">
                                #{order.order_number || order.id.slice(0, 8)}
                            </Badge>
                        </div>
                        <h3 className="text-3xl font-black tracking-tighter text-white">
                            Table {order.table_number || 'N/A'}
                        </h3>
                        <div className="flex items-center gap-3 text-[10px] text-zinc-500 font-bold uppercase">
                            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(order.created_at).toLocaleTimeString()}</span>
                            <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {order.order_type || 'Dine-in'}</span>
                        </div>
                    </div>
                    <Badge className={cn("px-4 py-1.5 rounded-full text-[10px] font-black uppercase shadow-lg", getStatusColor(order.status))}>
                        {order.status}
                    </Badge>
                </div>

                {/* Staff & Role Section */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Served By</span>
                        <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-primary" />
                            <div>
                                <p className="text-xs font-black text-white">{order.waiter?.full_name || 'System'}</p>
                                <p className="text-[9px] font-bold text-primary uppercase">{(order as any).waiter?.role || 'Waiter'}</p>
                            </div>
                        </div>
                    </div>
                    <div className="bg-black/40 p-4 rounded-2xl border border-white/5 space-y-2">
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 block">Payment Method</span>
                        <div className="flex items-center gap-2">
                            <CreditCard className="w-4 h-4 text-blue-400" />
                            <div>
                                <p className="text-xs font-black text-white uppercase">{order.payment_method || 'Unpaid'}</p>
                                <p className="text-[9px] font-bold text-zinc-500 uppercase">{order.payment_status}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Order Items Section */}
                <div className="space-y-3">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2 px-1">
                        <ShoppingBag className="w-3 h-3" /> Items Summary
                    </h4>
                    <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-black/40 text-[9px] font-black uppercase text-zinc-500">
                                <tr>
                                    <th className="px-4 py-2">Item</th>
                                    <th className="px-4 py-2 text-center">Qty</th>
                                    <th className="px-4 py-2 text-right">Price</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-[11px] text-zinc-300">
                                {order.order_items?.map((item: any) => (
                                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                        <td className="px-4 py-3 font-black text-white">{item.menu_item?.name || 'Unknown Item'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <span className="bg-zinc-800 px-2 py-0.5 rounded font-mono text-[10px]">x{item.quantity}</span>
                                        </td>
                                        <td className="px-4 py-3 text-right font-mono">{(item.price * item.quantity).toLocaleString()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Financial Section */}
                <div className="bg-black/60 p-6 rounded-[2rem] border border-white/10 space-y-3 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-8 opacity-5">
                        <Receipt className="w-32 h-32" />
                    </div>

                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        <span>Subtotal</span>
                        <span className="text-white font-mono">{subtotal.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                        <span>Tax (VAT)</span>
                        <span className="text-white font-mono">{vat.toLocaleString()}</span>
                    </div>

                    <div className="pt-4 border-t border-white/10 flex justify-between items-end">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500">Final Total</p>
                            <h4 className="text-4xl font-black tracking-tighter text-primary">ETB {total.toLocaleString()}</h4>
                        </div>
                        {order.payment_status === 'paid' && (
                            <div className="flex items-center gap-1.5 px-3 py-1 bg-green-500/10 rounded-lg text-green-400 border border-green-500/20">
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-black uppercase">Verified</span>
                            </div>
                        )}
                    </div>
                </div>

                <Button
                    variant="outline"
                    className="w-full border-white/10 bg-white/5 h-12 rounded-[1rem] font-black uppercase tracking-widest hover:bg-white/10"
                    onClick={onClose}
                >
                    Close Detail
                </Button>
            </div>
        </Dialog>
    );
};
