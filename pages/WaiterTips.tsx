import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';
import { Card, CardHeader, CardContent, Badge, showToast } from '../components/ui';
import { DollarSign, Filter, RefreshCw, HandCoins, History } from 'lucide-react';

interface TipEntry {
    id: string;
    amount: number;
    tip_type: string;
    created_at: string;
    order: {
        order_number: string;
        total_amount: number;
    };
}

const WaiterTips: React.FC = () => {
    const { user } = useAuth();
    const [tips, setTips] = useState<TipEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'today' | 'week' | 'month'>('today');

    const fetchTips = async () => {
        if (!user) return;
        setLoading(true);
        try {
            const start = new Date();
            if (filter === 'today') {
                start.setHours(0, 0, 0, 0);
            } else if (filter === 'week') {
                start.setDate(start.getDate() - 7);
            } else if (filter === 'month') {
                start.setDate(start.getDate() - 30);
            }

            const { data, error } = await supabase
                .from('tips_ledger')
                .select(`
          id, amount, tip_type, created_at,
          order:orders!tips_ledger_order_id_fkey(order_number, total_amount)
        `)
                .eq('staff_id', user.id)
                .gte('created_at', start.toISOString())
                .order('created_at', { ascending: false });

            if (error) throw error;
            setTips(data as unknown as TipEntry[]);
        } catch (err: any) {
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTips();
    }, [filter, user]);

    const totalTips = tips.reduce((sum, t) => sum + t.amount, 0);
    const digitalTips = tips.filter(t => t.tip_type === 'digital').reduce((sum, t) => sum + t.amount, 0);
    const cashTips = tips.filter(t => t.tip_type === 'cash').reduce((sum, t) => sum + t.amount, 0);

    return (
        <DashboardLayout
            title="My Tips & Gratuity"
            subtitle="Track your earnings and tip history"
            actions={
                <div className="flex gap-2">
                    <div className="flex bg-primary/5 p-1 rounded-lg border border-primary/20">
                        {(['today', 'week', 'month'] as const).map(range => (
                            <button
                                key={range}
                                onClick={() => setFilter(range)}
                                className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all uppercase tracking-wider ${filter === range ? "bg-primary text-black" : "text-gray-400 hover:text-white"
                                    }`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                    <button onClick={fetchTips} className="w-10 h-10 bg-white/5 border border-white/10 flex items-center justify-center rounded-xl hover:bg-white/10 transition-colors text-white">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            }
        >
            <div className="space-y-6 animate-in fade-in duration-500">

                {/* Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-primary/10 border-primary/20 p-6 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase text-primary tracking-widest mb-1">Total Tips ({filter})</p>
                            <h3 className="text-3xl font-black text-white font-mono">ETB {totalTips.toLocaleString()}</h3>
                        </div>
                        <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center text-primary">
                            <DollarSign className="w-6 h-6" />
                        </div>
                    </Card>

                    <Card className="bg-emerald-500/10 border-emerald-500/20 p-6 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase text-emerald-500 tracking-widest mb-1">Digital (Bank)</p>
                            <h3 className="text-3xl font-black text-white font-mono">ETB {digitalTips.toLocaleString()}</h3>
                        </div>
                        <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center text-emerald-500">
                            <HandCoins className="w-6 h-6" />
                        </div>
                    </Card>

                    <Card className="bg-blue-500/10 border-blue-500/20 p-6 flex items-center justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase text-blue-500 tracking-widest mb-1">Cash Tips</p>
                            <h3 className="text-3xl font-black text-white font-mono">ETB {cashTips.toLocaleString()}</h3>
                        </div>
                        <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center text-blue-500">
                            <HandCoins className="w-6 h-6" />
                        </div>
                    </Card>
                </div>

                {/* Audit Log */}
                <Card className="bg-[#09090b] border-primary/20">
                    <CardHeader className="border-b border-primary/20 px-6 py-4 flex flex-row items-center gap-3">
                        <History className="w-5 h-5 text-primary" />
                        <span className="font-bold text-sm uppercase tracking-wider text-white">Recent Tip History</span>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="py-20 text-center"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary/50" /></div>
                        ) : tips.length === 0 ? (
                            <div className="py-20 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">
                                No tips found for this period.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-[10px] text-gray-500 uppercase bg-black/40 font-black tracking-widest">
                                        <tr>
                                            <th className="px-6 py-4">Time</th>
                                            <th className="px-6 py-4">Order Ref</th>
                                            <th className="px-6 py-4">Order Total</th>
                                            <th className="px-6 py-4">Type</th>
                                            <th className="px-6 py-4 text-right">Tip Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-primary/10">
                                        {tips.map((t) => (
                                            <tr key={t.id} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                                                    {new Date(t.created_at).toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-white font-bold">{t.order?.order_number || 'N/A'}</span>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-gray-400 text-xs">
                                                    ETB {t.order?.total_amount?.toLocaleString()}
                                                </td>
                                                <td className="px-6 py-4">
                                                    <Badge variant={t.tip_type === 'digital' ? 'glass' : 'outline'} className={t.tip_type === 'digital' ? 'text-emerald-400 border-emerald-400/30 bg-emerald-400/10' : 'text-blue-400 border-blue-400/30 bg-blue-400/10'}>
                                                        {t.tip_type.toUpperCase()}
                                                    </Badge>
                                                </td>
                                                <td className="px-6 py-4 text-right">
                                                    <span className="font-black text-primary font-mono text-lg">ETB {t.amount.toLocaleString()}</span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </CardContent>
                </Card>

            </div>
        </DashboardLayout>
    );
};

export default WaiterTips;
