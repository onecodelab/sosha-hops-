
import React, { useMemo } from 'react';
import { Card, Badge, cn } from './ui';
import { Order } from '../types';
import {
    Clock, Calendar, DollarSign,
    Hash, User, ShoppingBag, ChevronRight, CreditCard
} from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';

interface TableOrderHistoryProps {
    orders: Order[];
    view: 'daily' | 'weekly' | 'monthly';
    onOrderClick?: (order: Order) => void;
}

export const TableOrderHistory: React.FC<TableOrderHistoryProps> = ({
    orders,
    view,
    onOrderClick
}) => {
    const { t } = useLanguage();

    const groupedOrders = useMemo(() => {
        const groups: Record<string, Order[]> = {};

        orders.forEach(order => {
            const date = new Date(order.created_at);
            let groupKey = '';

            if (view === 'daily') {
                groupKey = date.toLocaleDateString(t('common.locale') === 'am' ? 'am-ET' : 'en-US', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                });
            } else if (view === 'weekly') {
                const startOfWeek = new Date(date);
                startOfWeek.setDate(date.getDate() - date.getDay());
                groupKey = `${t('tableStatus.weekOf')} ${startOfWeek.toLocaleDateString(t('common.locale') === 'am' ? 'am-ET' : 'en-US', { month: 'short', day: 'numeric' })}`;
            } else {
                groupKey = date.toLocaleDateString(t('common.locale') === 'am' ? 'am-ET' : 'en-US', { month: 'long', year: 'numeric' });
            }

            if (!groups[groupKey]) groups[groupKey] = [];
            groups[groupKey].push(order);
        });

        return Object.entries(groups).sort((a, b) => {
            return new Date(b[1][0].created_at).getTime() - new Date(a[1][0].created_at).getTime();
        });
    }, [orders, view, t]);

    if (orders.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 opacity-30 grayscale">
                <ShoppingBag className="w-12 h-12 mb-4" />
                <p className="text-[10px] font-black uppercase tracking-[0.3em]">{t('tableStatus.noTransactions')}</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {groupedOrders.map(([groupName, groupOrders]) => (
                <div key={groupName} className="space-y-4">
                    <div className="flex items-center gap-4 px-2">
                        <div className="h-px flex-1 bg-white/5" />
                        <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-zinc-500 whitespace-nowrap">
                            {groupName}
                        </h3>
                        <div className="h-px flex-1 bg-white/5" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {groupOrders.map(order => (
                            <Card
                                key={order.id}
                                variant="interactive"
                                className="p-5 bg-black/40 border-white/5 hover:border-primary/30 transition-all rounded-[1.5rem] group"
                                onClick={() => onOrderClick?.(order)}
                            >
                                <div className="flex items-center justify-between gap-4">
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-11 h-11 rounded-xl bg-white/5 flex-shrink-0 flex items-center justify-center border border-white/5 group-hover:bg-primary/10 transition-colors">
                                            <User className="w-5 h-5 text-zinc-500 group-hover:text-primary transition-colors" />
                                        </div>
                                        <div className="min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="text-[11px] font-black text-white uppercase tracking-tight truncate">
                                                    {t('tableStatus.by')} {order.waiter?.full_name || 'System'}
                                                </span>
                                                <Badge variant="outline" className="text-[9px] border-white/10 text-zinc-500 flex-shrink-0">
                                                    #{order.order_number || order.id.slice(0, 4)}
                                                </Badge>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                                                <span className="text-[9px] text-zinc-500 font-bold uppercase flex items-center gap-1 whitespace-nowrap">
                                                    <Clock className="w-3 h-3" />
                                                    {new Date(order.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                                <span className="text-[9px] text-zinc-500 font-bold uppercase flex items-center gap-1 whitespace-nowrap">
                                                    <CreditCard className="w-3 h-3" />
                                                    {order.payment_method || 'Cash'}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="text-right flex items-center gap-5 flex-shrink-0">
                                        <div className="flex flex-col items-end">
                                            <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none mb-1.5 opacity-60">{t('tableStatus.items')}: {order.order_items?.length || 0}</p>
                                            <p className="text-sm font-black text-primary font-mono tracking-tighter">
                                                {t('common.etb')} {order.total_amount.toLocaleString()}
                                            </p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-zinc-700 group-hover:text-primary transition-all translate-x-0 group-hover:translate-x-1 duration-300" />
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
};
