import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabase';
import { Order, OrderItem, Organization, Branch } from '../types';
import {
    CheckCircle2, Smartphone, Landmark, Coins,
    Receipt, ArrowRight, ShieldCheck, Heart,
    ExternalLink, AlertCircle, Loader2
} from 'lucide-react';
import { Button, Card, Badge, cn } from '../components/ui';
import { motion, AnimatePresence } from 'framer-motion';

const BANK_CONFIG: Record<string, { label: string, color: string, icon: any, bgColor: string, scheme?: string }> = {
    telebirr: {
        label: "Telebirr",
        color: "text-purple-400",
        bgColor: "bg-purple-500/10",
        icon: Smartphone,
        scheme: "telebirr://"
    },
    cbe: {
        label: "CBE",
        color: "text-blue-400",
        bgColor: "bg-blue-500/10",
        icon: Landmark,
        scheme: "cbe://"
    },
    dashen: {
        label: "Dashen",
        color: "text-emerald-400",
        bgColor: "bg-emerald-500/10",
        icon: Landmark,
        scheme: "amole://"
    },
    abyssinia: {
        label: "Abyssinia",
        color: "text-zinc-400",
        bgColor: "bg-zinc-500/10",
        icon: Landmark,
        scheme: "boa://"
    },
    cbebirr: {
        label: "CBE Birr",
        color: "text-orange-400",
        bgColor: "bg-orange-500/10",
        icon: Coins,
        scheme: "cbebirr://"
    }
};

export default function PublicPayment() {
    const { orderId } = useParams<{ orderId: string }>();
    const [order, setOrder] = useState<Order | null>(null);
    const [items, setItems] = useState<OrderItem[]>([]);
    const [org, setOrg] = useState<Organization | null>(null);
    const [branch, setBranch] = useState<Branch | null>(null);
    const [bankSettings, setBankSettings] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [coping, setCoping] = useState<string | null>(null);
    const [txnRef, setTxnRef] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (!orderId) return;
        fetchOrderDetails();
    }, [orderId]);

    const handleCopy = (text: string, id: string) => {
        navigator.clipboard.writeText(text);
        setCoping(id);
        setTimeout(() => setCoping(null), 2000);
    };

    const handlePay = (bank: any) => {
        const config = BANK_CONFIG[bank.bank_key];
        handleCopy(bank.account_number, bank.id);

        // Attempt deep link after a short delay for clipboard
        if (config?.scheme) {
            setTimeout(() => {
                window.location.href = config.scheme!;
            }, 300);
        }
    };

    const submitVerification = async () => {
        if (!txnRef || !orderId || !order) return;
        setSubmitting(true);
        try {
            const { error: payErr } = await supabase.from('payment_notifications').insert({
                order_id: orderId,
                transaction_ref: txnRef,
                organization_id: order.organization_id
            });
            if (payErr) throw payErr;
            setSubmitted(true);
        } catch (err) {
            console.error(err);
        } finally {
            setSubmitting(false);
        }
    };

    const fetchOrderDetails = async () => {
        try {
            setLoading(true);

            // 1. Fetch Order
            const { data: orderData, error: orderErr } = await supabase
                .from('orders')
                .select('*')
                .eq('id', orderId)
                .maybeSingle();

            if (orderErr) throw orderErr;
            if (!orderData) throw new Error("Order not found or access denied.");
            setOrder(orderData);

            // 2. Fetch Order Items (with menu names)
            const { data: itemData, error: itemErr } = await supabase
                .from('order_items')
                .select(`
          *,
          menu_item:menu (name)
        `)
                .eq('order_id', orderId);

            if (itemErr) console.error("Error fetching items:", itemErr);
            setItems(itemData || []);

            // 3. Fetch Org & Branch
            const [orgRes, branchRes] = await Promise.all([
                supabase.from('organizations').select('name').eq('id', orderData.organization_id).maybeSingle(),
                supabase.from('branches').select('name').eq('id', orderData.branch_id).maybeSingle()
            ]);

            setOrg(orgRes.data);
            setBranch(branchRes.data);

            // 4. Fetch Bank Settings
            const { data: banks } = await supabase
                .from('bank_settings')
                .select('*')
                .eq('organization_id', orderData.organization_id)
                .eq('is_active', true);

            setBankSettings(banks || []);

        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
                <Loader2 className="w-12 h-12 text-primary animate-spin mb-4" />
                <h2 className="text-white font-black uppercase tracking-[0.2em] animate-pulse">Initializing Baro Pay</h2>
            </div>
        );
    }

    if (error || !order) {
        return (
            <div className="min-h-screen bg-[#050505] flex flex-col items-center justify-center p-6 text-center">
                <div className="bg-red-500/10 border border-red-500/20 p-8 rounded-[2.5rem] max-w-sm">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h1 className="text-2xl font-black text-white mb-2 uppercase tracking-tighter">Access Denied</h1>
                    <p className="text-zinc-500 text-sm mb-6">{error || "This payment link is invalid or expired."}</p>
                    <Button onClick={() => window.location.reload()} className="w-full h-12 bg-white/5 border border-white/10">Try Again</Button>
                </div>
            </div>
        );
    }

    const isClosed = order.status === 'closed' || order.payment_status === 'paid';

    return (
        <div className="min-h-screen bg-[#050505] text-white p-4 font-sans selection:bg-primary selection:text-black">
            <div className="max-w-md mx-auto pt-8 pb-12 space-y-6">

                {/* Header Section */}
                <header className="text-center space-y-2">
                    <div className="inline-flex items-center gap-2 bg-white/5 border border-white/10 px-4 py-1.5 rounded-full mb-4">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-300">Live Secure Invoice</span>
                    </div>
                    <h1 className="text-3xl font-black tracking-tighter uppercase leading-none">{org?.name || 'Restaurant'}</h1>
                    <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">{branch?.name || 'Main Branch'}</p>
                </header>

                {/* Bill Summary Card */}
                <Card className="overflow-hidden border-white/5 bg-[#0A0A0A]/80 backdrop-blur-xl relative">
                    {/* Status Overlay for Closed Orders */}
                    {isClosed && (
                        <div className="absolute inset-0 z-10 bg-[#0A0A0A]/60 backdrop-blur-sm flex items-center justify-center animate-in fade-in duration-500">
                            <div className="bg-green-600 text-white px-8 py-3 rounded-2xl rotate-[-5deg] shadow-2xl border-4 border-white/20 font-black text-2xl uppercase tracking-[0.2em]">
                                THANK YOU
                            </div>
                        </div>
                    )}

                    <div className="p-6 space-y-6">
                        <div className="flex justify-between items-start">
                            <div className="space-y-1">
                                <span className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em]">Transaction ID</span>
                                <p className="font-mono text-xs text-zinc-400">ORD-{order.order_number || order.id.slice(0, 8)}</p>
                            </div>
                            <Badge variant={isClosed ? "success" : "warning"} className="h-6 px-3">
                                {isClosed ? "PAID" : "UNPAID"}
                            </Badge>
                        </div>

                        <div className="py-8 border-y border-white/5 flex flex-col items-center justify-center text-center">
                            <span className="text-[11px] font-black text-primary uppercase tracking-[0.3em] mb-2">Amount to Pay</span>
                            <div className="relative">
                                <h2 className="text-6xl font-black tracking-tighter tabular-nums">
                                    {order.total_amount.toLocaleString()}
                                </h2>
                                <span className="absolute -top-1 -right-8 text-xs font-black text-zinc-500">ETB</span>
                            </div>
                        </div>

                        {/* Itemized List (Collapsible-ish) */}
                        <div className="space-y-3">
                            <h4 className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                <Receipt className="w-3 h-3" /> Order Details
                            </h4>
                            <div className="space-y-2">
                                {items.map((item, id) => (
                                    <div key={id} className="flex justify-between items-center bg-white/[0.02] p-3 rounded-xl border border-white/5">
                                        <span className="text-xs font-bold uppercase text-zinc-300">
                                            {item.menu_item?.name || 'Item'}
                                            <span className="ml-2 text-[10px] text-zinc-600">x{item.quantity}</span>
                                        </span>
                                        <span className="text-xs font-mono font-bold">{(item.price * item.quantity).toLocaleString()}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Tax Info */}
                        <div className="bg-white/5 p-4 rounded-xl flex justify-between items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                            <span>Incl. 15% VAT ({(order.total_amount - (order.total_amount / 1.15)).toFixed(2)} ETB)</span>
                            <div className="flex items-center gap-1.5">
                                <ShieldCheck className="w-3 h-3 text-primary" />
                                ERCA COMPLIANT
                            </div>
                        </div>
                    </div>
                </Card>

                {/* Universal Payment Options */}
                {!isClosed && (
                    <div className="space-y-4 animate-in slide-in-from-bottom duration-700 delay-200">
                        <h3 className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] ml-2">Choose Payment Mode</h3>
                        <div className="grid gap-3">
                            {bankSettings.map((bank: any) => {
                                const config = BANK_CONFIG[bank.bank_key] || { label: bank.bank_key, color: "text-white", icon: Landmark, bgColor: "bg-white/5" };
                                const isCoping = coping === bank.id;
                                return (
                                    <motion.div
                                        whileTap={{ scale: 0.98 }}
                                        key={bank.id}
                                        onClick={() => handlePay(bank)}
                                        className={cn(
                                            "group p-5 rounded-[2rem] border border-white/5 bg-[#0D0D0D] hover:bg-[#151515] transition-all cursor-pointer relative overflow-hidden",
                                            isCoping ? "border-primary/50" : "hover:border-primary/20"
                                        )}
                                    >
                                        <div className="flex items-center justify-between relative z-10">
                                            <div className="flex items-center gap-4">
                                                <div className={cn("w-12 h-12 rounded-2xl flex items-center justify-center", config.bgColor)}>
                                                    <config.icon className={cn("w-6 h-6", config.color)} />
                                                </div>
                                                <div className="space-y-0.5 text-left">
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-black text-sm uppercase tracking-tight">{config.label}</h4>
                                                        {isCoping && <span className="text-[9px] font-black text-primary animate-pulse uppercase">COPIED ACCOUNT</span>}
                                                    </div>
                                                    <p className="text-[11px] font-mono font-bold text-primary tracking-widest">{bank.account_number}</p>
                                                    <p className="text-[9px] text-zinc-600 font-bold uppercase">{bank.account_name || 'Restaurant Account'}</p>
                                                </div>
                                            </div>
                                            <div className="bg-white/5 p-2 rounded-xl group-hover:bg-primary/10 transition-colors">
                                                <ExternalLink className="w-4 h-4 text-zinc-700 group-hover:text-primary transition-colors" />
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })}
                        </div>

                        {/* Verification Flow */}
                        <div className="bg-white/5 rounded-[2rem] p-6 space-y-4 border border-white/10">
                            <div className="space-y-1">
                                <h4 className="text-[10px] font-black text-white uppercase tracking-widest">Verify Your Payment</h4>
                                <p className="text-[9px] text-zinc-500 font-bold uppercase">Enter your bank reference to notify the waiter</p>
                            </div>

                            {submitted ? (
                                <div className="bg-green-500/10 border border-green-500/20 p-4 rounded-2xl flex items-center gap-3 text-green-500">
                                    <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                                    <span className="text-xs font-black uppercase tracking-tight">Notification sent! Waiter is checking.</span>
                                </div>
                            ) : (
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        placeholder="Trans. Ref (e.g. 1AB2C3D...)"
                                        className="flex-1 bg-black border border-white/10 rounded-xl px-4 py-3 text-xs font-mono focus:outline-none focus:border-primary transition-colors"
                                        value={txnRef}
                                        onChange={(e) => setTxnRef(e.target.value)}
                                    />
                                    <Button
                                        onClick={submitVerification}
                                        disabled={!txnRef || submitting}
                                        className="bg-primary text-black font-black uppercase text-[10px] h-auto px-6"
                                    >
                                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "SEND"}
                                    </Button>
                                </div>
                            )}
                        </div>

                        <p className="text-[9px] text-zinc-600 text-center font-bold px-6 leading-relaxed">
                            Click a bank above to copy details and launch your app.
                            Provide the reference number to speed up verification.
                        </p>
                    </div>
                )}

                {/* Footer Info */}
                <footer className="pt-8 text-center space-y-6">
                    <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent w-full" />
                    <div className="flex flex-col items-center gap-3">
                        <div className="bg-primary/10 p-3 rounded-2xl">
                            <Heart className="w-5 h-5 text-primary fill-primary/20" />
                        </div>
                        <p className="text-sm font-black text-white/50 italic tracking-tight">"Thanks for choosing {org?.name}!"</p>
                    </div>

                    <div className="flex items-center justify-center gap-6 pt-4">
                        <div className="flex flex-col items-center gap-1 opacity-40 grayscale">
                            <span className="text-[8px] font-black uppercase tracking-widest mb-1">Infrastructure</span>
                            <p className="text-[10px] font-black">Baro OS Enterprise</p>
                        </div>
                    </div>
                </footer>
            </div>
        </div>
    );
}
