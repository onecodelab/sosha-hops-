import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, Loader2, UtensilsCrossed, ArrowUp, ShoppingBag,
    Receipt, CreditCard, MessageCircle, Sparkles, X, ChevronDown,
    CheckCircle2, Timer, ChefHat, PackageCheck, Star, Users, Trash2,
    Leaf as FreshLeaf, Plus
} from 'lucide-react';
import { cn, showToast, Button } from '../components/ui';
import { supabase } from '../supabase';
import ThemeToggle from '../components/ThemeToggle';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useLanguage } from '../contexts/LanguageContext';
import { RatingInteraction } from '../components/ui/RatingInteraction';

const getPastelColor = (index: number) => {
    const colors = [
        'bg-[#F0FFF4]', // Mint
        'bg-[#FFF5F5]', // Rose
        'bg-[#F0F5FF]', // Sky
        'bg-[#FFF9F0]', // Peach
        'bg-[#F5F3FF]', // Lavender
    ];
    return colors[index % colors.length];
};

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
const QUICK_PROMPTS = [
    { label: 'Track Order', prompt: 'Track my order' },
    { label: 'Add More', prompt: 'I want to add more items' },
    { label: 'Recommendations', prompt: 'What do you recommend?' },
    { label: 'Budget Meal', prompt: 'What can I get within my budget?' },
    { label: 'Popular Items', prompt: 'Show me your most popular items' },
];

/* ─── TYPES ─── */
interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    attachments?: {
        type: 'menu';
        data: any[];
    };
    metadata?: {
        buttons?: { label: string; prompt: string }[];
        tracking?: { status: 'placed' | 'preparing' | 'ready' | 'delivered'; orderNumber?: string };
        pills?: string[];
        splitter?: { total: number };
        rating?: { type: 'stars' };
    };
}

interface MenuItem {
    id: string;
    name: string;
    price: number;
    image_url?: string;
    category?: string;
    description?: string;
    demand_status?: string;
}

interface CartItem {
    menuItem: MenuItem;
    quantity: number;
}

interface ActiveOrder {
    id: string;
    order_number: string;
    status: string;
    total_amount: number;
}

/* ─── SESSION MANAGEMENT ─── */
const getSessionId = (tableId: string): string => {
    const key = `baro_session_${tableId}`;
    let sid = localStorage.getItem(key);
    if (!sid) {
        sid = crypto.randomUUID();
        localStorage.setItem(key, sid);
    }
    return sid;
};

const getCardTheme = (index: number) => {
    const themes = [
        'bg-card border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.05)]',
        'bg-card border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.05)]',
        'bg-card border border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.05)]',
        'bg-card border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.05)]',
        'bg-card border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.05)]',
    ];
    return themes[index % themes.length];
};

/* ─── MENU CAROUSEL ─── */
const MenuCard: React.FC<{ item: MenuItem; index: number; onAdd: (item: MenuItem) => void }> = ({ item, index, onAdd }) => {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className={cn(
                "relative w-36 h-48 rounded-[2rem] overflow-hidden flex flex-col p-3 group transition-all duration-300",
                getCardTheme(index)
            )}
        >
            <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] aspect-square border border-foreground/[0.04] rounded-full pointer-events-none transition-transform duration-700 group-hover:scale-110" />
            <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180%] aspect-square border border-foreground/[0.02] rounded-full pointer-events-none transition-transform duration-1000 group-hover:scale-110" />
            <div className="absolute top-[40%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 bg-lime-500/20 blur-[25px] rounded-full pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-60" />

            <div className="flex-1 flex items-center justify-center relative z-10 mt-1 mb-1">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                    className="w-20 h-20 rounded-full p-1 border border-lime-500/30 bg-gradient-to-br from-card to-muted shadow-xl relative group-hover:border-lime-500/60 transition-colors"
                >
                    <div className="w-full h-full rounded-full overflow-hidden bg-background">
                        {item.image_url ? (
                            <img src={item.image_url} alt={item.name} className="w-full h-full object-cover scale-110" />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center">
                                <UtensilsCrossed className="w-6 h-6 text-muted-foreground/30" />
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            <div className="text-center mb-2 relative z-10 px-1">
                <h3 className="text-foreground text-[11px] font-black leading-tight line-clamp-2 uppercase tracking-tight">
                    {item.name}
                </h3>
            </div>

            <div className="flex items-center justify-between relative z-10">
                <div className="flex items-baseline gap-0.5">
                    <span className="text-[7px] font-bold text-muted-foreground">ETB</span>
                    <span className="text-[14px] font-black text-foreground leading-none">
                        {item.price.toLocaleString()}
                    </span>
                </div>

                <button
                    onClick={() => onAdd(item)}
                    className="h-7 px-2.5 rounded-full bg-[#84CC16] flex items-center justify-center gap-1 text-black shadow-lg shadow-lime-500/20 hover:bg-lime-500 active:scale-90 transition-all"
                >
                    <ShoppingBag className="w-3 h-3" />
                    <span className="text-[9px] font-black uppercase tracking-widest">Add</span>
                </button>
            </div>
        </motion.div>
    );
};

const MenuCarousel: React.FC<{ items: MenuItem[]; onAddToCart: (item: MenuItem) => void; isFallback?: boolean }> = ({ items, onAddToCart, isFallback }) => {
    return (
        <div className="w-full mt-2 -mx-1 px-1">
            {isFallback && (
                <div className="mb-3 flex items-center gap-2 px-1">
                    <Sparkles className="w-4 h-4 text-amber-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-amber-500/80">House Favorites For You</span>
                </div>
            )}
            <div className="flex gap-3 overflow-x-auto pb-4 scrollbar-hide no-scrollbar snap-x snap-mandatory">
                {items.map((item, i) => (
                    <div key={item.id} className="snap-start first:pl-2 last:pr-2">
                        <MenuCard 
                            index={i}
                            item={{
                                ...item,
                                demand_status: item.demand_status || (Math.random() > 0.7 ? 'High Demand' : 'Low Demand')
                            }} 
                            onAdd={() => onAddToCart(item)}
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ─── CART DRAWER ─── */
const CartDrawer: React.FC<{
    cart: CartItem[];
    onUpdateQty: (id: string, delta: number) => void;
    onRemove: (id: string) => void;
    onPlaceOrder: () => void;
    onClose: () => void;
    isPlacing: boolean;
}> = ({ cart, onUpdateQty, onRemove, onPlaceOrder, onClose, isPlacing }) => {
    const total = cart.reduce((s, c) => s + c.menuItem.price * c.quantity, 0);
    return (
        <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-[100] bg-card border-t border-border rounded-t-[2.5rem] shadow-2xl max-h-[70vh] flex flex-col"
        >
            <div className="p-5 border-b border-border flex items-center justify-between">
                <div>
                    <h3 className="text-base font-black text-foreground uppercase tracking-tight">Your Cart</h3>
                    <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-widest">{cart.length} item{cart.length !== 1 ? 's' : ''}</p>
                </div>
                <button onClick={onClose} className="p-2 hover:bg-muted/10 rounded-full transition-all">
                    <X className="w-5 h-5 text-muted-foreground" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3">
                {cart.length === 0 ? (
                    <div className="text-center py-10 text-muted-foreground text-sm">Your cart is empty</div>
                ) : cart.map(c => (
                    <div key={c.menuItem.id} className="flex items-center gap-3 p-3 bg-muted/5 border border-border rounded-2xl">
                        {c.menuItem.image_url && (
                            <img src={c.menuItem.image_url} alt={c.menuItem.name} className="w-12 h-12 rounded-xl object-cover" />
                        )}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-bold text-foreground truncate">{c.menuItem.name}</p>
                            <p className="text-xs text-muted-foreground">ETB {c.menuItem.price.toLocaleString()}</p>
                        </div>
                        <div className="flex items-center gap-2">
                            <button onClick={() => c.quantity <= 1 ? onRemove(c.menuItem.id) : onUpdateQty(c.menuItem.id, -1)}
                                className="w-7 h-7 rounded-full bg-muted/10 border border-border flex items-center justify-center text-foreground text-sm font-bold hover:bg-red-500/10 hover:text-red-500 transition-all"
                            >−</button>
                            <span className="text-sm font-black w-5 text-center">{c.quantity}</span>
                            <button onClick={() => onUpdateQty(c.menuItem.id, 1)}
                                className="w-7 h-7 rounded-full bg-lime-500/20 border border-lime-500/30 flex items-center justify-center text-lime-500 text-sm font-bold hover:bg-lime-500/30 transition-all"
                            >+</button>
                        </div>
                    </div>
                ))}
            </div>

            {cart.length > 0 && (
                <div className="p-5 border-t border-border space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-muted-foreground font-bold uppercase tracking-widest">Total</span>
                        <span className="text-xl font-black text-foreground">ETB {total.toLocaleString()}</span>
                    </div>
                    <button
                        onClick={onPlaceOrder}
                        disabled={isPlacing}
                        className="w-full h-14 rounded-2xl bg-[#84CC16] text-black font-black uppercase tracking-wider text-sm shadow-lg shadow-lime-500/30 hover:bg-lime-500 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {isPlacing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingBag className="w-5 h-5" />}
                        {isPlacing ? 'Placing Order...' : 'Place Order'}
                    </button>
                </div>
            )}
        </motion.div>
    );
};


const ORDER_STATUS_MAP: Record<string, string> = {
    'pending': 'placed',
    'accepted': 'preparing',
    'preparing': 'preparing',
    'ready': 'ready',
    'served': 'delivered',
    'completed': 'delivered',
    'delivered': 'delivered',
};

const BANK_DISPLAY: Record<string, { name: string; logo?: string }> = {
    'telebirr':  { name: 'Telebirr' },
    'cbe':       { name: 'CBE' },
    'cbe_birr':  { name: 'CBE Birr' },
    'abyssinia': { name: 'Abyssinia' },
    'dashen':    { name: 'Dashen' },
    'awash':     { name: 'Awash' },
    'hibret':    { name: 'Hibret' },
};

const PaymentCard: React.FC<{
    orderId: string;
    orderNumber: string;
    total: number;
    banks: { bank_key: string; account_number: string }[];
    onPaymentSubmitted: () => void;
}> = ({ orderId, orderNumber, total, banks, onPaymentSubmitted }) => {
    const [step, setStep] = useState<'select_bank' | 'send_payment' | 'enter_ref'>('select_bank');
    const [selectedBank, setSelectedBank] = useState('');
    const [selectedAccount, setSelectedAccount] = useState('');
    const [refNumber, setRefNumber] = useState('');
    const [isVerifying, setIsVerifying] = useState(false);
    const [lastError, setLastError] = useState<string | null>(null);
    const [paymentStatus, setPaymentStatus] = useState<'idle' | 'verifying' | 'verified' | 'failed' | 'error'>('idle');
    const [lastVerifiedContext, setLastVerifiedContext] = useState<{ account: string, bank: string } | null>(null);

    const handleSelectBank = (bank: { bank_key: string; account_number: string }) => {
        setSelectedBank(bank.bank_key);
        setSelectedAccount(bank.account_number);
        setStep('send_payment');
    };

    const handleVerify = async () => {
        if (!selectedBank || !refNumber.trim()) return;
        setIsVerifying(true);
        setPaymentStatus('verifying');
        try {
            const { data, error } = await supabase.functions.invoke('verify-payment', {
                body: {
                    order_id: orderId,
                    bank: selectedBank,
                    transaction_id: refNumber.trim(),
                    receiver_account: selectedAccount,
                    accountSuffix: selectedAccount,
                    expected_receiver: selectedAccount,
                },
            });

            if (error) {
                const errMsg = error.message || 'Connection failed.';
                showToast(`Server: ${errMsg}`, 'error');
                throw error;
            }

            if (!data?.success) {
                const errMsg = data?.error || data?.message || 'Verification failed. Please check your reference number.';
                showToast(errMsg, 'error');
                setPaymentStatus('failed');
                setIsVerifying(false);
                setLastError(errMsg);
                if (data?.receiver_account) {
                    setLastVerifiedContext({ account: data.receiver_account, bank: data.bank_key || selectedBank });
                }
                return;
            }

        setPaymentStatus('verified');
            showToast('Payment verified! ✅', 'success');
            setTimeout(() => onPaymentSubmitted(), 2500);
        } catch (err: any) {
            showToast(err.message || 'Something went wrong.', 'error');
            setPaymentStatus('error');
        } finally {
            setIsVerifying(false);
        }
    };

    if (paymentStatus === 'verified') {
        return (
            <div className="p-5 rounded-2xl bg-card border border-emerald-500/30 text-center space-y-1">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-foreground">Payment Verified! 🎉</p>
                <p className="text-[10px] text-muted-foreground">Table session closing… Thank you for dining with us 💚</p>
            </div>
        );
    }

    if (paymentStatus === 'failed' || paymentStatus === 'error') {
        return (
            <div className="p-4 rounded-2xl bg-card border border-red-500/30 space-y-3">
                <div className="text-center">
                    <X className="w-8 h-8 text-red-500 mx-auto mb-1" />
                    <p className="text-sm font-bold text-foreground">Verification Failed</p>
                    <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">{lastError || 'Reference not valid. Check the ref number and try again.'}</p>
                    {lastVerifiedContext && (
                        <div className="mt-2 p-2 rounded-lg bg-red-500/5 border border-red-500/10 inline-block">
                             <p className="text-[9px] text-red-400 font-black uppercase tracking-tighter">
                                Verified Target: {BANK_DISPLAY[lastVerifiedContext.bank]?.name || lastVerifiedContext.bank} ({lastVerifiedContext.account})
                             </p>
                        </div>
                    )}
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => { setPaymentStatus('idle'); setRefNumber(''); setStep('enter_ref'); }}
                        className="flex-1 h-10 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted/10 transition-all"
                    >
                        Try Again
                    </button>
                    <button
                        onClick={() => showToast('Waiter notified! 🙋 Please wait.', 'success')}
                        className="flex-1 h-10 rounded-xl bg-amber-500 text-black text-xs font-bold hover:bg-amber-400 transition-all"
                    >
                        🙋 Call Waiter
                    </button>
                </div>
            </div>
        );
    }

    if (paymentStatus === 'verifying') {
        return (
            <div className="p-5 rounded-2xl bg-card border border-lime-500/20 text-center space-y-1">
                <Loader2 className="w-8 h-8 text-lime-500 mx-auto mb-2 animate-spin" />
                <p className="text-sm font-bold text-foreground">Verifying payment...</p>
                <p className="text-[10px] text-muted-foreground">Checking your reference — almost done!</p>
            </div>
        );
    }

    return (
        <div className="p-4 rounded-2xl bg-card border border-border space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Your Bill</p>
                    <p className="text-[10px] font-mono text-muted-foreground">#{orderNumber}</p>
                </div>
                <p className="text-2xl font-black text-foreground">ETB {total.toLocaleString()}</p>
            </div>

            {step === 'select_bank' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pay with</p>
                    <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {banks.map(bank => {
                            const display = BANK_DISPLAY[bank.bank_key] || { name: bank.bank_key };
                            return (
                                <button
                                    key={bank.bank_key}
                                    onClick={() => handleSelectBank(bank)}
                                    className="flex-none px-4 py-2.5 rounded-xl text-[11px] font-bold uppercase tracking-wider border border-border text-muted-foreground hover:border-lime-500/50 hover:text-lime-400 transition-all"
                                >
                                    {display.name}
                                </button>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {step === 'send_payment' && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <div className="p-3 rounded-xl bg-lime-500/5 border border-lime-500/20 space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-lime-400">Send to</p>
                        <p className="text-lg font-black text-foreground font-mono tracking-widest">{selectedAccount}</p>
                        <p className="text-[10px] text-muted-foreground">{BANK_DISPLAY[selectedBank]?.name} • ETB {total.toLocaleString()}</p>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        📱 Open your <strong>{BANK_DISPLAY[selectedBank]?.name}</strong> app, send the exact amount, then come back with the <strong>transaction reference</strong> from your receipt.
                    </p>
                    <button
                        onClick={() => setStep('enter_ref')}
                        className="w-full h-11 rounded-xl bg-[#84CC16] text-black font-black uppercase tracking-wider text-sm hover:bg-lime-500 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <Receipt className="w-4 h-4" /> I've Sent It — Enter Reference
                    </button>
                    <button onClick={() => setStep('select_bank')} className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                        ← Change payment method
                    </button>
                </motion.div>
            )}

            {step === 'enter_ref' && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <p className="text-[10px] text-muted-foreground">Paste the <strong>transaction reference / REFID</strong> from your {BANK_DISPLAY[selectedBank]?.name} receipt:</p>
                    <input
                        type="text"
                        value={refNumber}
                        onChange={e => setRefNumber(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleVerify()}
                        placeholder="e.g. TT2503250001234"
                        className="w-full h-12 px-4 rounded-xl bg-muted/5 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-lime-500/50 transition-colors font-mono"
                        autoFocus
                    />
                    <button
                        onClick={handleVerify}
                        disabled={!refNumber.trim() || isVerifying}
                        className="w-full h-12 rounded-xl bg-[#84CC16] text-black font-black uppercase tracking-wider text-sm shadow-lg shadow-lime-500/30 hover:bg-lime-500 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                        {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        {isVerifying ? 'Verifying...' : 'Confirm Payment'}
                    </button>
                    <button onClick={() => setStep('send_payment')} className="w-full text-center text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                        ← Back
                    </button>
                </motion.div>
            )}
        </div>
    );
};

const StepperNav: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <div className="flex w-full items-start justify-between relative">{children}</div>
);

const StepperItem: React.FC<{ 
    step: number; 
    active: boolean; 
    completed: boolean; 
    children: React.ReactNode;
    isLast: boolean;
}> = ({ step, active, completed, children, isLast }) => (
    <div className={cn("relative flex-1 flex flex-col items-center gap-2 group", !isLast && "mr-2")}>
        {children}
        {!isLast && (
            <div className={cn(
                "absolute top-3.5 left-[calc(50%+1rem)] right-[-1rem] h-[1.5px] z-0 transition-colors duration-500",
                completed ? "bg-[#84CC16]" : "bg-white/5"
            )} />
        )}
    </div>
);

const StepperIndicator: React.FC<{ 
    active: boolean; 
    completed: boolean; 
    children: React.ReactNode 
}> = ({ active, completed, children }) => (
    <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black z-10 transition-all duration-500 border",
        completed ? "bg-[#84CC16] border-[#84CC16] text-black shadow-[0_0_15px_rgba(132,204,22,0.3)]" :
        active ? "bg-black border-lime-500/50 text-lime-400 ring-4 ring-lime-500/10 shadow-[0_0_15px_rgba(132,204,22,0.4)]" :
        "bg-[#0A0A0A] border-white/5 text-muted-foreground"
    )}>
        {completed ? <CheckCircle2 className="w-3.5 h-3.5" /> : children}
    </div>
);

const TrackingWidget: React.FC<{ status: 'placed' | 'preparing' | 'ready' | 'delivered'; orderNumber?: string; compact?: boolean }> = ({ status, orderNumber, compact }) => {
    const [isExpanded, setIsExpanded] = useState(!compact);
    const stages = [
        { key: 'placed', title: 'Placed', desc: 'Order received' },
        { key: 'preparing', title: 'Preparing', desc: 'In kitchen' },
        { key: 'ready', title: 'Ready', desc: 'Ready to serve' },
        { key: 'delivered', title: 'Served', desc: 'Dining now' },
    ];
    const currentIndex = stages.findIndex(s => s.key === status);
    const activeStage = stages[currentIndex >= 0 ? currentIndex : 0];

    return (
        <div className={cn("w-full relative z-10 transition-all", compact ? 'pt-2 pb-0 px-2' : 'py-6 max-w-md mx-auto')}>
            {compact && (
                <div 
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex flex-row items-center justify-between cursor-pointer rounded-2xl bg-muted/5 border border-border px-4 py-3 hover:bg-muted/10 transition-colors shadow-sm"
                >
                    <div className="flex items-center gap-4">
                        <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-lime-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#84CC16]"></span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest leading-none mb-1">Status</span>
                            <span className="text-[11px] font-black text-foreground uppercase tracking-wide leading-none">{activeStage.title}</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {orderNumber && <span className="text-[10px] font-bold uppercase tracking-widest text-[#84CC16] bg-lime-500/10 border border-lime-500/20 px-2 py-1 rounded-md">#{orderNumber}</span>}
                        <div className={cn("w-6 h-6 rounded-full bg-muted/10 flex items-center justify-center transition-transform duration-300", isExpanded ? "rotate-180" : "rotate-0")}>
                            <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        </div>
                    </div>
                </div>
            )}
            
            <AnimatePresence>
                {(!compact || isExpanded) && (
                    <motion.div
                        initial={compact ? { height: 0, opacity: 0 } : false}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={compact ? { height: 0, opacity: 0 } : undefined}
                        className={cn("overflow-hidden", compact && "pt-6 pb-2")}
                    >
                        <StepperNav>
                            {stages.map((stage, i) => {
                                const completed = i < currentIndex || (status === 'delivered' && i <= currentIndex);
                                const active = i === currentIndex;
                                const isLast = i === stages.length - 1;

                                return (
                                    <StepperItem key={stage.key} step={i + 1} active={active} completed={completed} isLast={isLast}>
                                        <div className="flex flex-col items-center gap-2.5 relative z-10">
                                            <StepperIndicator active={active} completed={completed}>
                                                {i + 1}
                                            </StepperIndicator>
                                            <div className="text-center">
                                                <p className={cn(
                                                    "text-[9px] font-black uppercase tracking-tight transition-colors duration-500",
                                                    active ? "text-foreground" : completed ? "text-[#84CC16]" : "text-muted-foreground"
                                                )}>
                                                    {stage.title}
                                                </p>
                                                <p className="text-[7px] text-muted-foreground/50 font-medium uppercase tracking-[0.05em] mt-0.5 leading-none">
                                                    {stage.desc}
                                                </p>
                                            </div>
                                        </div>
                                    </StepperItem>
                                );
                            })}
                        </StepperNav>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

const BillSplitter: React.FC<{ total: number }> = ({ total }) => {
    const [people, setPeople] = useState(2);
    return (
        <div className="mt-4 p-5 rounded-3xl bg-gradient-to-br from-amber-500/10 to-amber-600/5 border border-amber-500/20 w-full max-w-xs">
            <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-amber-500" />
                <span className="text-[10px] font-black uppercase tracking-widest text-amber-500">Bill Splitter</span>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-end">
                    <div>
                        <p className="text-[10px] text-gray-500 uppercase mb-1">Total Bill</p>
                        <p className="text-xl font-bold">ETB {total.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-gray-500 uppercase mb-1">Each Pays</p>
                        <p className="text-xl font-bold text-amber-500">ETB {Math.round(total / people).toLocaleString()}</p>
                    </div>
                </div>

                <div className="pt-4 border-t border-border/10">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-muted-foreground">Number of People</span>
                        <span className="text-lg font-bold text-foreground">{people}</span>
                    </div>
                    <input
                        type="range" min="2" max="12" step="1"
                        value={people} onChange={(e) => setPeople(parseInt(e.target.value))}
                        className="w-full accent-amber-500 bg-muted/10 rounded-lg appearance-none h-1.5"
                    />
                </div>
            </div>
        </div>
    );
};

const StarRating: React.FC = () => {
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [submitted, setSubmitted] = useState(false);

    if (submitted) return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-xs text-lime-500 font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Thanks for your feedback!
        </motion.div>
    );

    return (
        <div className="mt-4 p-4 rounded-2xl bg-card border border-border inline-block">
            <p className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3 text-center">Rate your experience</p>
            <div className="flex gap-2">
                {[1, 2, 3, 4, 5].map((star) => (
                    <button
                        key={star}
                        onMouseEnter={() => setHover(star)}
                        onMouseLeave={() => setHover(0)}
                        onClick={() => { setRating(star); setTimeout(() => setSubmitted(true), 1000); }}
                        className="transition-transform active:scale-90"
                    >
                        <Star
                            className={cn(
                                "w-6 h-6 transition-colors",
                                (hover || rating) >= star ? "fill-amber-500 text-amber-500" : "text-gray-700"
                            )}
                        />
                    </button>
                ))}
            </div>
        </div>
    );
};

/* ─── NEW UBER-LIKE UI COMPONENTS ─── */
const UberMenuCard: React.FC<{ item: MenuItem; onAdd: (item: MenuItem) => void }> = ({ item, onAdd }) => {
    return (
        <motion.div
            whileTap={{ scale: 0.98 }}
            className="bg-card border border-border rounded-2xl overflow-hidden flex flex-col group transition-all duration-300 touch-pan-y"
        >
            <div className="aspect-square relative overflow-hidden bg-muted/5">
                {item.image_url ? (
                    <img src={item.image_url} alt={item.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <UtensilsCrossed className="w-10 h-10 text-muted-foreground/20" />
                    </div>
                )}
                <button
                    onClick={(e) => { e.stopPropagation(); onAdd(item); }}
                    className="absolute bottom-3 right-3 w-10 h-10 rounded-full bg-[#84CC16] text-black shadow-lg flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                >
                    <Plus className="w-5 h-5" />
                </button>
            </div>
            <div className="p-4 flex flex-col flex-1">
                <h3 className="text-sm font-bold text-[#84CC16] line-clamp-1 mb-1">{item.name}</h3>
                <p className="text-[10px] text-muted-foreground line-clamp-2 mb-2 h-7">{item.description}</p>
                <div className="mt-auto flex items-center justify-between">
                    <span className="text-sm font-black text-foreground">ETB {item.price.toLocaleString()}</span>
                    <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                        <span className="text-[10px] font-bold text-muted-foreground">5.0</span>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

const MenuView: React.FC<{
    items: MenuItem[];
    categories: string[];
    activeCategory: string;
    onCategoryChange: (c: string) => void;
    onAddToCart: (item: MenuItem) => void;
}> = React.memo(({ items, categories, activeCategory, onCategoryChange, onAddToCart }) => {
    const filteredItems = activeCategory === 'All' 
        ? items 
        : items.filter(item => item.category === activeCategory);

    return (
        <div className="flex-1 overflow-y-auto pb-32 pt-6 no-scrollbar">
            {/* Categories */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 mb-8">
                <button
                    onClick={() => onCategoryChange('All')}
                    className={cn(
                        "px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shadow-lg shadow-black/20",
                        activeCategory === 'All' ? "bg-[#84CC16] text-black" : "bg-card border border-border text-muted-foreground"
                    )}
                >
                    All Type
                </button>
                {categories.map(cat => (
                    <button
                        key={cat}
                        onClick={() => onCategoryChange(cat)}
                        className={cn(
                            "px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap shadow-lg shadow-black/20",
                            activeCategory === cat ? "bg-[#84CC16] text-black" : "bg-card border border-border text-muted-foreground"
                        )}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            {/* Menu Grid */}
            <div className="px-4 mb-12">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex flex-col">
                        <h3 className="text-xl font-black text-foreground uppercase tracking-tight">Best Choice</h3>
                        <div className="w-8 h-1 bg-[#84CC16] rounded-full mt-1" />
                    </div>
                    <button className="text-[10px] text-muted-foreground uppercase font-black tracking-widest px-3 py-1.5 rounded-full border border-border hover:bg-white/5 transition-colors">See all</button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {filteredItems.map(item => (
                        <UberMenuCard key={item.id} item={item} onAdd={onAddToCart} />
                    ))}
                </div>
            </div>
        </div>
    );
});

const TrackingView: React.FC<{ activeOrder: ActiveOrder | null; refreshOrder: () => void }> = ({ activeOrder, refreshOrder }) => {
    return (
        <div className="flex-1 flex flex-col p-6 overflow-y-auto pb-24">
            <h2 className="text-2xl font-black text-foreground mb-6 uppercase tracking-tight">Order Tracking</h2>
            {activeOrder ? (
                <div className="space-y-6">
                    <div className="p-6 rounded-3xl bg-card border border-border shadow-xl">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Active Order</p>
                                <p className="text-lg font-black text-foreground">#{activeOrder.order_number}</p>
                            </div>
                            <button onClick={refreshOrder} className="p-2 rounded-full bg-white/5 hover:bg-white/10">
                                <Loader2 className="w-4 h-4 text-muted-foreground" />
                            </button>
                        </div>
                        <TrackingWidget status={ORDER_STATUS_MAP[activeOrder.status] as any || 'placed'} orderNumber={activeOrder.order_number} />
                        <div className="mt-8 pt-6 border-t border-border flex justify-between items-center">
                            <span className="text-sm font-bold text-muted-foreground uppercase">Total Amount</span>
                            <span className="text-xl font-black text-foreground">ETB {activeOrder.total_amount.toLocaleString()}</span>
                        </div>
                    </div>
                    <button className="w-full h-14 rounded-2xl bg-white/5 border border-white/10 text-foreground font-bold uppercase tracking-widest text-xs">
                        Call Waiter 🙋
                    </button>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 pt-[10vh]">
                    <div className="w-20 h-20 rounded-full bg-muted/20 flex items-center justify-center mb-4">
                        <PackageCheck className="w-10 h-10 text-muted-foreground" />
                    </div>
                    <p className="text-sm font-bold text-muted-foreground uppercase tracking-widest">No Active Orders</p>
                    <p className="text-[10px] text-muted-foreground/60 mt-1 uppercase tracking-tighter">Your recent orders will appear here</p>
                </div>
            )}
        </div>
    );
};

const BottomNav: React.FC<{
    currentView: 'menu' | 'chat' | 'tracking';
    onViewChange: (v: 'menu' | 'chat' | 'tracking') => void;
}> = ({ currentView, onViewChange }) => {
    return (
        <div className="fixed bottom-0 inset-x-0 bg-background/90 backdrop-blur-lg border-t border-border px-6 py-3 flex items-center justify-between z-[60] safe-area-bottom">
            <button onClick={() => onViewChange('menu')} className={cn("flex flex-col items-center gap-1 transition-colors", currentView === 'menu' ? "text-[#84CC16]" : "text-muted-foreground")}>
                <div className={cn("p-2 rounded-full", currentView === 'menu' && "bg-[#84CC16]/10")}>
                    <ShoppingBag className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-tighter">Menu</span>
            </button>
            <button onClick={() => onViewChange('chat')} className={cn("flex flex-col items-center gap-1 transition-colors", currentView === 'chat' ? "text-[#84CC16]" : "text-muted-foreground")}>
                <div className={cn("p-2 rounded-full", currentView === 'chat' && "bg-[#84CC16]/10")}>
                    <MessageCircle className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-tighter">Chat</span>
            </button>
            <button onClick={() => onViewChange('tracking')} className={cn("flex flex-col items-center gap-1 transition-colors", currentView === 'tracking' ? "text-[#84CC16]" : "text-muted-foreground")}>
                <div className={cn("p-2 rounded-full", currentView === 'tracking' && "bg-[#84CC16]/10")}>
                    <Timer className="w-5 h-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-tighter">Tracking</span>
            </button>
        </div>
    );
};
const MessageBubble: React.FC<{ msg: ChatMessage; onQuickAction: (p: string, s?: boolean) => void; onAddToCart: (item: MenuItem) => void }> = ({ msg, onQuickAction, onAddToCart }) => {
    const isUser = msg.role === 'user';
    return (
        <div className={cn("flex flex-col gap-2", isUser ? "items-end" : "items-start")}>
            <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
                className={cn("flex gap-2.5 max-w-[88%]", isUser ? "flex-row-reverse" : "")}
            >
                <div className={cn(
                    "w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mt-1",
                    isUser
                        ? "bg-gradient-to-br from-amber-400 to-amber-600"
                        : "bg-gradient-to-br from-lime-500/20 to-lime-600/30 border border-lime-500/30"
                )}>
                    {isUser
                        ? <div className="w-2.5 h-2.5 rounded-full bg-white/90" />
                        : <Sparkles className="w-3.5 h-3.5 text-lime-500" />
                    }
                </div>

                <div className={cn(
                    "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                    isUser
                        ? "bg-gradient-to-br from-amber-500 to-amber-600 text-black rounded-tr-md"
                        : "bg-card text-foreground rounded-tl-md border border-border"
                )}>
                    <div className="whitespace-pre-wrap">
                        {msg.content
                            .replace(/\[System Note:.*$/gs, '')
                            .replace(/^\|.*\|$/gm, '')
                            .replace(/^[*-] .*(?:ETB|Birr|Price).*$/gmi, '')
                            .replace(/^(?:ID|Name|Category|Image URL|Availability|Description|Ref|Status):\s*.*$/gmi, '')
                            .replace(/[\*_\[\]\(\)]/g, '')
                            .trim()}
                    </div>

                    <p className={cn(
                        "text-[9px] mt-1.5 opacity-50",
                        isUser ? "text-black/60 text-right" : "text-gray-500"
                    )}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            </motion.div>

            {!isUser && msg.metadata && (
                <div className="w-full max-w-[90%] pl-9 space-y-2">
                    {msg.metadata.tracking && (
                        <TrackingWidget status={msg.metadata.tracking.status} orderNumber={msg.metadata.tracking.orderNumber} />
                    )}
                    {msg.metadata.splitter && (
                        <BillSplitter total={msg.metadata.splitter.total} />
                    )}
                    {msg.metadata.rating && (
                        <StarRating />
                    )}
                </div>
            )}

            {msg.attachments?.type === 'menu' && msg.attachments.data?.length > 0 && (
                <div className="w-full max-w-[95%] pl-9">
                    <MenuCarousel 
                        items={msg.attachments.data} 
                        onAddToCart={onAddToCart} 
                    />
                </div>
            )}
        </div>
    );
};

const CustomerChatPage: React.FC = () => {
    const { t } = useLanguage();
    const { tableId } = useParams<{ tableId: string }>();
    const [searchParams] = useSearchParams();
    const branchToken = searchParams.get('token') || '';
    const [activeOrgId, setActiveOrgId] = useState('');
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [categories, setCategories] = useState<string[]>([]);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [branchName, setBranchName] = useState('');
    const [branchId, setBranchId] = useState('');
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [isVerified, setIsVerified] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [orgName, setOrgName] = useState('');
    const [orgLogoUrl, setOrgLogoUrl] = useState('');
    const [tableNumber, setTableNumber] = useState('');
    const [dynamicPrompts, setDynamicPrompts] = useState<{ label: string; prompt: string }[]>([]);
    const cartStorageKey = `baro_cart_${tableId}`;
    const [cart, setCart] = useState<CartItem[]>(() => {
        try {
            const saved = localStorage.getItem(cartStorageKey);
            return saved ? JSON.parse(saved) : [];
        } catch { return []; }
    });
    const [isCartOpen, setIsCartOpen] = useState(false);
    const [isPlacingOrder, setIsPlacingOrder] = useState(false);
    const [sessionCompleted, setSessionCompleted] = useState(false);
    const [ratingSubmitted, setRatingSubmitted] = useState(false);
    const [latestOrderId, setLatestOrderId] = useState<string | null>(null);
    const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
    const [branchBanks, setBranchBanks] = useState<{ bank_key: string; account_number: string }[]>([]);
    const [currentView, setCurrentView] = useState<'menu' | 'chat' | 'tracking'>('menu');
    const [allItems, setAllItems] = useState<MenuItem[]>([]);
    const [activeCategory, setActiveCategory] = useState<string>('All');

    const generateOrderNumber = useCallback(() => {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const randomSuffix = Math.floor(1000 + Math.random() * 9000);
        return `ORD-${dateStr}-${randomSuffix}`;
    }, []);

    const addToCart = useCallback((menuItem: MenuItem) => {
        setCart(prev => {
            const existing = prev.find(item => item.menuItem.id === menuItem.id);
            if (existing) {
                return prev.map(item =>
                    item.menuItem.id === menuItem.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }
            return [...prev, { menuItem, quantity: 1 }];
        });
        setIsCartOpen(true);
    }, []);

    const updateCartQty = useCallback((menuItemId: string, delta: number) => {
        setCart(prev => prev.flatMap(item => {
            if (item.menuItem.id !== menuItemId) return [item];
            const nextQty = item.quantity + delta;
            if (nextQty <= 0) return [];
            return [{ ...item, quantity: nextQty }];
        }));
    }, []);

    const removeFromCart = useCallback((menuItemId: string) => {
        setCart(prev => prev.filter(item => item.menuItem.id !== menuItemId));
    }, []);

    const refreshActiveOrder = useCallback(async () => {
        if (!tableId) {
            setActiveOrder(null);
            return null;
        }
        const { data, error } = await supabase
            .from('orders')
            .select('id, order_number, status, total_amount')
            .eq('table_id', tableId)
            .is('closed_at', null)
            .neq('status', 'cancelled')
            .neq('status', 'closed')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (error) {
            console.warn('Active order refresh failed:', error);
            return null;
        }

        const nextOrder = data as ActiveOrder | null;
        setActiveOrder(nextOrder);
        if (nextOrder?.id) {
            setLatestOrderId(nextOrder.id);
            setSessionCompleted(false);
        }
        return nextOrder;
    }, [tableId]);

    const refreshBranchBanks = useCallback(async () => {
        if (!branchId) {
            setBranchBanks([]);
            return;
        }
        const { data, error } = await supabase
            .from('bank_settings')
            .select('bank_key, account_number')
            .eq('branch_id', branchId)
            .eq('is_active', true);
        if (error) {
            console.warn('Branch bank fetch failed:', error);
            return;
        }
        setBranchBanks(data || []);
    }, [branchId]);

    const handlePlaceOrder = useCallback(async () => {
        if (isPlacingOrder || cart.length === 0) return;
        if (!tableId || !branchId) {
            showToast('Please wait for the table to be verified before placing an order.', 'error');
            return;
        }
        setIsPlacingOrder(true);
        try {
            const subtotal = cart.reduce((sum, item) => sum + (item.menuItem.price * item.quantity), 0);
            const totalAmount = subtotal * 1.15;
            const payload = {
                branch_id: branchId,
                items: cart.map(item => ({
                    menu_item_id: item.menuItem.id,
                    quantity: item.quantity,
                    unit_price: item.menuItem.price,
                    notes: '',
                })),
                order_details: {
                    table_id: tableId,
                    table_number: tableNumber || 'Guest',
                    total_amount: totalAmount,
                    customer_notes: '',
                    order_number: generateOrderNumber(),
                    source: 'chatbot',
                },
            };
            const { data, error } = await supabase.functions.invoke('place-order', {
                body: payload,
            });
            if (error) throw error;
            const result = typeof data === 'string' ? (() => { try { return JSON.parse(data); } catch { return null; } })() : data;
            if (!result?.success && !result?.order_id) {
                throw new Error(result?.detail || result?.error || 'Order submission failed.');
            }
            const optimisticOrder: ActiveOrder = {
                id: result.order_id || crypto.randomUUID(),
                order_number: result.order_number || payload.order_details.order_number,
                status: result.status || 'pending',
                total_amount: totalAmount,
            };
            setActiveOrder(optimisticOrder);
            setLatestOrderId(optimisticOrder.id);
            setSessionCompleted(false);
            setCart([]);
            setIsCartOpen(false);
            showToast('Order placed successfully!', 'success');
            window.setTimeout(() => {
                refreshActiveOrder().catch(err => console.warn('Active order sync failed:', err));
            }, 300);
        } catch (err: any) {
            console.error('Order placement failure:', err);
            showToast(err.message || 'Order submission failed. Please try again.', 'error');
        } finally {
            setIsPlacingOrder(false);
        }
    }, [branchId, cart, generateOrderNumber, isPlacingOrder, refreshActiveOrder, tableId, tableNumber]);

    useEffect(() => {
        localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    }, [cart, cartStorageKey]);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const hasInitialGreetingSent = useRef(false);
    const sessionId = tableId ? getSessionId(tableId) : '';

    const getEdgeAuthToken = useCallback(async () => {
        if (branchToken) return branchToken;
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token || '';
    }, [branchToken]);

    const invokeSecureFunction = useCallback(async (functionName: string, body: Record<string, unknown>, signal?: AbortSignal) => {
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
            throw new Error('Supabase environment is not configured.');
        }
        const authToken = await getEdgeAuthToken();
        if (!authToken) {
            throw new Error('This chat link is missing a valid secure token.');
        }
        const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify(body),
            signal,
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.error) {
            throw new Error(payload?.detail || payload?.error || `Failed to call ${functionName}.`);
        }
        return payload;
    }, [getEdgeAuthToken]);

    // 1. Unified Bootstrap (Security + Parallel Speed)
    useEffect(() => {
        const bootstrap = async () => {
            if (!tableId) return;
            
            const urlToken = searchParams.get('token');
            setIsHistoryLoading(true);
            setIsVerifying(true);

            try {
                // 1. Fetch Table Info (Minimal & Essential)
                const { data: tableData } = await supabase
                    .from('tables')
                    .select('*')
                    .eq('id', tableId)
                    .maybeSingle();

                if (!tableData) {
                    showToast('Table not found. Please scan a valid QR code.', 'error');
                    setIsHistoryLoading(false);
                    return;
                }

                setTableNumber(tableData.table_number || '');
                setBranchId(tableData.branch_id || '');
                const currentBranchId = tableData.branch_id;
                const currentOrgId = tableData.organization_id;

                if (currentOrgId) setActiveOrgId(currentOrgId);
                setIsVerified(true); // Allow access even if token check is skipped

                // 2. Fetch Menu Items (Resilient)
                try {
                    let menuQuery = supabase.from('view_menu_details').select('*').eq('is_available', true);
                    if (currentBranchId) {
                        menuQuery = menuQuery.eq('branch_id', currentBranchId);
                    } else if (currentOrgId) {
                        menuQuery = menuQuery.eq('organization_id', currentOrgId);
                    }

                    const { data: menuData } = await menuQuery;
                    if (menuData) {
                        setAllItems(menuData);
                        const cats = [...new Set(menuData.map((r: any) => r.category).filter(Boolean))] as string[];
                        setCategories(cats);
                    }
                } catch (e) { console.warn('Menu load failed:', e); }

                // 3. Fetch Banks (Optional - Don't let failure stop us)
                if (currentBranchId) {
                    supabase.from('bank_settings')
                        .select('*')
                        .eq('branch_id', currentBranchId)
                        .eq('is_active', true)
                        .then(({ data }) => { if (data) setBranchBanks(data); })
                        .catch(() => null);
                }

                // 4. Fetch Branch/Org Branding (Optional)
                if (currentBranchId) {
                    invokeSecureFunction('get-branch-info', { branch_id: currentBranchId })
                        .then(data => {
                            if (data?.branch?.name) setBranchName(data.branch.name);
                            if (data?.organization?.name) setOrgName(data.organization.name);
                            if (data?.organization?.chatbot_logo_url) setOrgLogoUrl(data.organization.chatbot_logo_url);
                        })
                        .catch(() => {
                            // Manual fallback if edge function fails
                            supabase.from('branches').select('name').eq('id', currentBranchId).maybeSingle()
                                .then(({ data }) => { if (data?.name) setBranchName(data.name); });
                        });
                }

                // 5. Initial Order Sync
                refreshActiveOrder().catch(() => null);

            } catch (err) {
                console.error('Fatal bootstrap failure:', err);
            } finally {
                setIsHistoryLoading(false);
                setIsVerifying(false);
            }

            } catch (err) {
                console.error('Bootstrap failure:', err);
            } finally {
                setIsHistoryLoading(false);
                setIsVerifying(false);
            }
        };

        bootstrap();
    }, [tableId, searchParams, sessionId, invokeSecureFunction, refreshActiveOrder]);

    // Simplified interactions
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    }, [inputValue]);

    useEffect(() => {
        let isMounted = true;
        let pollId = window.setInterval(async () => {
            try {
                if (isMounted) await refreshActiveOrder();
            } catch (err) { console.warn('Polling error:', err); }
        }, 10000);
        return () => { isMounted = false; window.clearInterval(pollId); };
    }, [refreshActiveOrder]);

    const handleSend = useCallback(async (textOverride?: string, isCategoryClick = false) => {
        const textToSend = textOverride || inputValue.trim();
        if (!textToSend.trim() || isTyping) return;

        if (textToSend !== 'init_chat' && !isCategoryClick) {
            const userMessage: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'user',
                content: textToSend,
                timestamp: new Date(),
            };
            setMessages((prev) => [...prev, userMessage]);
            setInputValue('');
            if (textareaRef.current) textareaRef.current.style.height = 'auto';
        }
        
        setIsTyping(true);
        setHasInteracted(true);

        try {
            const data = await invokeSecureFunction('customer-intelligence', {
                message: textToSend,
                session_id: sessionId,
                table_id: tableId,
                table_number: tableNumber || 'Guest',
                organization_id: activeOrgId || undefined,
                organization_name: orgName,
                branch_id: branchId,
                branch_name: branchName,
                is_verified: isVerified
            });

            if (data?.metadata?.customer_id) {
                localStorage.setItem(`baro_customer_${activeOrgId}`, data.metadata.customer_id);
            }

            const responseText = data?.text || '⚠️ No response. Please try again.';
            const rawItems = data?.metadata?.attachments?.items || data?.metadata?.attachments?.data;
            const parsedAttachments = rawItems && Array.isArray(rawItems) && rawItems.length > 0
                ? { type: 'menu' as const, data: rawItems }
                : undefined;
            const assistantMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: responseText,
                timestamp: new Date(),
                metadata: data?.metadata,
                attachments: parsedAttachments
            };
            
            setMessages(prev => [...prev, assistantMsg]);

            if (data?.metadata?.buttons && Array.isArray(data.metadata.buttons)) {
                setDynamicPrompts(data.metadata.buttons);
            }
        } catch (err: any) {
            console.error('Chat error:', err);
            showToast('Unable to reach assistant.', 'error');
        } finally {
            setIsTyping(false);
        }
    }, [inputValue, isTyping, sessionId, tableId, tableNumber, activeOrgId, orgName, branchId, branchName, isVerified, invokeSecureFunction]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="flex flex-col h-[100dvh] bg-background overflow-hidden relative font-sans text-foreground selection:bg-[#84CC16]/30">
            {/* Background Decorations */}
            <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
                <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] bg-[#84CC16]/5 rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] bg-emerald-500/5 rounded-full blur-[100px]" />
            </div>

            {/* Header */}
            <div className="flex-none px-6 py-4 flex items-center justify-between bg-background/90 backdrop-blur-lg border-b border-border z-50">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-card border border-[#84CC16]/20 flex items-center justify-center overflow-hidden">
                        {orgLogoUrl ? <img src={orgLogoUrl} alt="Logo" className="w-full h-full object-cover" /> : <Sparkles className="w-5 h-5 text-[#84CC16]" />}
                    </div>
                    <div>
                        <h1 className="text-sm font-black uppercase tracking-tight text-foreground">{orgName || 'Sosha'}</h1>
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{branchName || 'Restaurant'} • Table {tableNumber}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <LanguageSwitcher />
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative z-10 flex flex-col">
                {currentView === 'menu' && (
                    <MenuView
                        items={allItems}
                        categories={categories}
                        activeCategory={activeCategory}
                        onCategoryChange={setActiveCategory}
                        onAddToCart={addToCart}
                    />
                )}

                {currentView === 'tracking' && (
                    <TrackingView activeOrder={activeOrder} refreshOrder={refreshActiveOrder} />
                )}

                {currentView === 'chat' && (
                    <div ref={scrollRef} className="h-full overflow-y-auto pb-48 custom-scrollbar">
                        <div className="max-w-2xl mx-auto p-4 space-y-6">
                            <AnimatePresence initial={false}>
                                {messages.map(msg => (
                                    <MessageBubble 
                                        key={msg.id} 
                                        msg={msg} 
                                        onQuickAction={handleSend}
                                        onAddToCart={addToCart}
                                    />
                                ))}
                            </AnimatePresence>
                            {isTyping && (
                                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2.5">
                                    <div className="w-7 h-7 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                        <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
                                    </div>
                                    <div className="bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3 shadow-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="flex gap-1">
                                                <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0 }} className="w-1 h-1 bg-emerald-400 rounded-full" />
                                                <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-1 h-1 bg-emerald-400 rounded-full" />
                                                <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="w-1 h-1 bg-emerald-400 rounded-full" />
                                            </div>
                                            <span className="text-[10px] text-emerald-400/60 uppercase font-bold tracking-widest">Thinking...</span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Persistent Input Area for Chat */}
            {currentView === 'chat' && (
                <div className="fixed bottom-[72px] inset-x-0 z-50 pointer-events-none">
                    {/* Backdrop Gradient to prevent text bleed */}
                    <div className="absolute inset-x-0 bottom-0 top-[-40px] bg-gradient-to-t from-background via-background/95 to-transparent pointer-events-none" />
                    
                    <div className="max-w-2xl mx-auto px-4 pb-4 pointer-events-auto relative">
                        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4 py-1">
                            {dynamicPrompts.map((action: any, i) => (
                                <button 
                                    key={i} 
                                    onClick={() => handleSend(action.prompt)} 
                                    className="flex-none px-4 py-2.5 rounded-full bg-card border border-lime-500/30 text-lime-600 text-[10px] font-black uppercase tracking-wider hover:bg-lime-500/10 whitespace-nowrap shadow-xl shadow-black/10 backdrop-blur-md"
                                >
                                    {action.label}
                                </button>
                            ))}
                        </div>
                        <div className="relative flex items-end rounded-3xl border bg-card/95 backdrop-blur-2xl border-border shadow-2xl focus-within:border-[#84CC16]/50 transition-all">
                            <textarea
                                ref={textareaRef}
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ask me anything..."
                                className="flex-1 bg-transparent border-0 outline-none text-foreground text-sm px-5 py-4 resize-none min-h-[56px] max-h-[120px]"
                            />
                            <button onClick={() => handleSend()} className={cn("m-2 p-2.5 rounded-2xl transition-all", inputValue.trim() ? "bg-[#84CC16] text-black shadow-lg shadow-lime-500/30" : "bg-muted/10 text-muted-foreground")}>
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Bottom Navigation */}
            <BottomNav currentView={currentView} onViewChange={setCurrentView} />

            {/* Floating Cart Button */}
            {cart.length > 0 && !isCartOpen && (
                <motion.button
                    initial={{ scale: 0 }} animate={{ scale: 1 }}
                    onClick={() => setIsCartOpen(true)}
                    className="fixed bottom-24 right-5 z-[55] w-14 h-14 rounded-full bg-[#84CC16] text-black shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                >
                    <ShoppingBag className="w-6 h-6" />
                    <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                        {cart.reduce((s, c) => s + c.quantity, 0)}
                    </span>
                </motion.button>
            )}

            {/* Overlays */}
            <AnimatePresence>
                {isCartOpen && (
                    <CartDrawer
                        cart={cart}
                        onUpdateQty={updateCartQty}
                        onRemove={removeFromCart}
                        onPlaceOrder={handlePlaceOrder}
                        onClose={() => setIsCartOpen(false)}
                        isPlacing={isPlacingOrder}
                    />
                )}

                {sessionCompleted && !ratingSubmitted && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center">
                        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-card w-full max-w-sm rounded-[2rem] p-8 border border-border shadow-2xl flex flex-col items-center gap-6">
                            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black mb-2 uppercase tracking-wide">Thank You! 🥂</h2>
                                <p className="text-muted-foreground text-sm">Your order is complete. How was your experience today?</p>
                            </div>
                            <RatingInteraction onChange={async (val) => {
                                try {
                                    await supabase.from('customer_feedback').insert({ rating: val, order_id: latestOrderId, organization_id: activeOrgId, branch_id: branchId, table_id: tableId });
                                } catch (e) { console.error(e); }
                                setRatingSubmitted(true);
                                if (tableId) localStorage.removeItem(`baro_session_${tableId}`);
                                showToast('Thank you for your feedback! 🫶', 'success');
                                setTimeout(() => window.location.reload(), 2000);
                            }} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CustomerChatPage;
