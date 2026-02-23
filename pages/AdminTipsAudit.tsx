import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../supabase';
import { Card, CardHeader, CardContent, Badge, showToast, Button } from '../components/ui';
import { DollarSign, RefreshCw, HandCoins, History, Users, Search } from 'lucide-react';

interface TipEntry {
    id: string;
    amount: number;
    tip_type: string;
    created_at: string;
    staff: {
        full_name: string;
    };
    order: {
        order_number: string;
        total_amount: number;
    };
}

const AdminTipsAudit: React.FC = () => {
    const [tips, setTips] = useState<TipEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'today' | 'week' | 'month'>('today');
    const [searchTerm, setSearchTerm] = useState('');

    const fetchTips = async () => {
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
          order:orders(order_number, total_amount),
          staff:profiles(full_name)
        `)
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
    }, [filter]);

    // Aggregate stats
    const totalTips = tips.reduce((sum, t) => sum + t.amount, 0);
    const digitalTips = tips.filter(t => t.tip_type === 'digital').reduce((sum, t) => sum + t.amount, 0);
    const cashTips = tips.filter(t => t.tip_type === 'cash').reduce((sum, t) => sum + t.amount, 0);

    // Filter for display
    const filteredTips = tips.filter(t =>
        (t.staff?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) || '') ||
        (t.order?.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) || '')
    );

    return (
        <DashboardLayout
            title="Tips & Gratuity Audit"
            subtitle="System-wide tip tracking and Staff earnings review"
            actions={
                <div className="flex gap-3">
                    <div className="flex bg-primary/5 p-1 rounded-lg border border-primary/20">
                        {(['today', 'week', 'month'] as const).map(range => (
                            <button
                                key={range}
                                onClick={() => setFilter(range)}
                                className={`px-4 py-1.5 text-[10px] font-black rounded-md transition-all uppercase tracking-[0.2em] ${filter === range ? "bg-primary text-black" : "text-gray-400 hover:text-white"
                                    }`}
                            >
                                {range}
                            </button>
                        ))}
                    </div>
                    <Button onClick={fetchTips} variant="outline" size="icon" className="border-white/10 bg-white/5 hover:bg-white/10">
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </Button>
                </div>
            }
        >
            <div className="space-y-6 animate-in fade-in duration-500">

                {/* Overview Overview */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <Card className="bg-primary/10 border-primary/20 p-6 flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[10px] font-black uppercase text-primary tracking-[0.2em]">Total Gratuity ({filter})</p>
                            <DollarSign className="w-5 h-5 text-primary opacity-50" />
                        </div>
                        <h3 className="text-4xl font-black text-white font-mono tracking-tighter">ETB {totalTips.toLocaleString()}</h3>
                    </Card>

                    <Card className="bg-emerald-500/10 border-emerald-500/20 p-6 flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[10px] font-black uppercase text-emerald-500 tracking-[0.2em]">Digital/Bank Tips</p>
                            <HandCoins className="w-5 h-5 text-emerald-500 opacity-50" />
                        </div>
                        <h3 className="text-4xl font-black text-white font-mono tracking-tighter">ETB {digitalTips.toLocaleString()}</h3>
                    </Card>

                    <Card className="bg-blue-500/10 border-blue-500/20 p-6 flex flex-col justify-center">
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[10px] font-black uppercase text-blue-500 tracking-[0.2em]">Cash Tips</p>
                            <HandCoins className="w-5 h-5 text-blue-500 opacity-50" />
                        </div>
                        <h3 className="text-4xl font-black text-white font-mono tracking-tighter">ETB {cashTips.toLocaleString()}</h3>
                    </Card>
                </div>

                {/* Global Audit Ledger */}
                <Card className="bg-[#09090b] border-primary/20">
                    <CardHeader className="border-b border-primary/20 px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <History className="w-5 h-5 text-primary" />
                            <div>
                                <span className="font-bold text-sm uppercase tracking-wider text-white">System Ledger</span>
                                <p className="text-[10px] text-gray-400 font-mono mt-0.5">{filteredTips.length} records found</p>
                            </div>
                        </div>

                        <div className="relative w-full md:w-64">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Search staff or order..."
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                                className="w-full h-9 pl-9 pr-3 text-xs bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-primary/50"
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                        {loading ? (
                            <div className="py-20 text-center"><RefreshCw className="w-8 h-8 animate-spin mx-auto text-primary/50" /></div>
                        ) : filteredTips.length === 0 ? (
                            <div className="py-20 text-center text-gray-500 font-bold uppercase tracking-widest text-xs">
                                No tip records match your criteria.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-[10px] text-gray-500 uppercase bg-black/40 font-black tracking-widest">
                                        <tr>
                                            <th className="px-6 py-4">Timestamp</th>
                                            <th className="px-6 py-4">Staff Member</th>
                                            <th className="px-6 py-4">Order Ref</th>
                                            <th className="px-6 py-4">Order Total</th>
                                            <th className="px-6 py-4">Tip Type</th>
                                            <th className="px-6 py-4 text-right">Amount</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-primary/10">
                                        {filteredTips.map((t) => (
                                            <tr key={t.id} className="hover:bg-white/[0.02] transition-colors group">
                                                <td className="px-6 py-4 flex flex-col">
                                                    <span className="text-white font-bold text-xs">{new Date(t.created_at).toLocaleTimeString()}</span>
                                                    <span className="text-[9px] text-gray-500 font-mono">{new Date(t.created_at).toLocaleDateString()}</span>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <div className="flex items-center gap-2">
                                                        <Users className="w-3 h-3 text-primary opacity-50" />
                                                        <span className="text-white font-bold uppercase text-[10px] tracking-widest">{t.staff?.full_name || 'Unknown'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4">
                                                    <span className="text-gray-300 font-mono text-xs">{t.order?.order_number || 'N/A'}</span>
                                                </td>
                                                <td className="px-6 py-4 font-mono text-gray-400 text-xs">
                                                    ETB {t.order?.total_amount?.toLocaleString() || '0'}
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

export default AdminTipsAudit;
