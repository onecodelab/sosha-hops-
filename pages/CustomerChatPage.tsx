import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, Loader2, UtensilsCrossed, ArrowUp, ShoppingBag,
    Receipt, CreditCard, MessageCircle, Sparkles, X, ChevronDown,
    CheckCircle2, Timer, ChefHat, PackageCheck, Star, Users, Trash2,
    Leaf as FreshLeaf
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
        tracking?: { status: 'placed' | 'preparing' | 'ready' | 'delivered' };
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

/* ─── DEFAULT QUICK PROMPTS ─── */
const QUICK_PROMPTS = [
    { label: 'Track Order', prompt: 'Track my order' },
    { label: 'Add More', prompt: 'I want to add more items' },
    { label: 'Recommendations', prompt: 'What do you recommend?' },
    { label: 'Budget Meal', prompt: 'What can I get within my budget?' },
    { label: 'Popular Items', prompt: 'Show me your most popular items' },
];

/* ─── QUICK PROMPTS ─── */
// Moved inside component for translation support

/* ─── MENU CAROUSEL ─── */
/* ─── HELPERS ─── */
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

const AbstractWave: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 22C6 17 12 15 12 10C12 5 6 3 6 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M14 22C14 15 22 13 22 8C22 4 14 2 14 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M2 22C2 18 5 17 5 14C5 11 2 9 2 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
);

/* ─── MENU CAROUSEL ─── */
const MenuCard: React.FC<{ item: MenuItem; index: number; onAdd: (item: MenuItem) => void }> = ({ item, index, onAdd }) => {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className={cn(
                "relative w-40 h-52 rounded-[2rem] overflow-hidden flex flex-col p-4 group transition-all duration-300",
                getCardTheme(index)
            )}
        >
            {/* Radiant Concentric Rings (Background Art) */}
            <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[140%] aspect-square border border-foreground/[0.04] rounded-full pointer-events-none transition-transform duration-700 group-hover:scale-110" />
            <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180%] aspect-square border border-foreground/[0.02] rounded-full pointer-events-none transition-transform duration-1000 group-hover:scale-110" />

            {/* Ambient Element Glow */}
            <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-28 bg-lime-500/20 blur-[30px] rounded-full pointer-events-none transition-opacity duration-500 group-hover:opacity-100 opacity-60" />

            {/* Image Section - Framed Circular Plate */}
            <div className="flex-1 flex items-center justify-center relative z-10 mt-3 mb-2">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
                    className="w-24 h-24 rounded-full p-1 border border-lime-500/30 bg-gradient-to-br from-card to-muted shadow-xl relative group-hover:border-lime-500/60 transition-colors"
                >
                    <div className="w-full h-full rounded-full overflow-hidden bg-background">
                        {item.image_url ? (
                            <img
                                src={item.image_url}
                                alt={item.name}
                                className="w-full h-full object-cover scale-110"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center">
                                <UtensilsCrossed className="w-8 h-8 text-muted-foreground/30" />
                            </div>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Title - Centered Inside */}
            <div className="text-center mb-3 relative z-10 px-1">
                <h3 className="text-foreground text-[13px] font-black leading-tight line-clamp-2 uppercase tracking-tight">
                    {item.name}
                </h3>
            </div>

            {/* Footer: Price & Add Button */}
            <div className="flex items-center justify-between relative z-10">
                <div className="flex items-baseline gap-0.5">
                    <span className="text-[8px] font-bold text-muted-foreground">ETB</span>
                    <span className="text-base font-black text-foreground leading-none">
                        {item.price.toLocaleString()}
                    </span>
                </div>

                <button
                    onClick={() => onAdd(item)}
                    className="h-8 px-3 rounded-full bg-[#84CC16] flex items-center justify-center gap-1.5 text-black shadow-lg shadow-lime-500/30 hover:bg-lime-500 active:scale-90 transition-all"
                >
                    <ShoppingBag className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Add</span>
                </button>
            </div>
        </motion.div>
    );
};

const MenuCarousel: React.FC<{ items: MenuItem[]; onAddToCart: (item: MenuItem[] | MenuItem) => void; isFallback?: boolean }> = ({ items, onAddToCart, isFallback }) => {
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

/* ─── RICH UI COMPONENTS ─── */
const ActionButtons: React.FC<{ buttons: { label: string; prompt: string }[]; onAction: (p: string) => void }> = ({ buttons, onAction }) => (
    <div className="flex flex-wrap gap-2 mt-3">
        {buttons.map((btn, i) => (
            <motion.button
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.05, backgroundColor: "rgba(132, 204, 22, 0.15)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onAction(btn.prompt)}
                className="px-4 py-2.5 rounded-2xl bg-lime-500/10 border border-lime-500/20 text-lime-600 dark:text-lime-400 text-[11px] font-black uppercase tracking-wider hover:border-lime-500/40 transition-all flex items-center gap-2 group relative overflow-hidden"
            >
                <div className="absolute inset-0 bg-lime-500/5 animate-pulse" style={{ animationDuration: '2s' }} />
                <span className="relative z-10">{btn.label}</span>
                <Sparkles className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
        ))}
    </div>
);

const ORDER_STATUS_MAP: Record<string, string> = {
    'pending': 'placed',
    'accepted': 'preparing',
    'preparing': 'preparing',
    'ready': 'ready',
    'served': 'delivered',
    'completed': 'delivered',
    'delivered': 'delivered',
};

/* ─── PAYMENT CARD ─── */
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
                    accountSuffix: selectedAccount,      // Added for verifier compatibility
                    expected_receiver: selectedAccount,   // Added for verifier compatibility
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

    // ── STEP: Verified ──
    if (paymentStatus === 'verified') {
        return (
            <div className="p-5 rounded-2xl bg-card border border-emerald-500/30 text-center space-y-1">
                <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="text-sm font-bold text-foreground">Payment Verified! 🎉</p>
                <p className="text-[10px] text-muted-foreground">Table session closing… Thank you for dining with us 💚</p>
            </div>
        );
    }

    // ── STEP: Failed/Error ──
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

    // ── STEP: Verifying ──
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
            {/* Bill Summary */}
            <div className="flex justify-between items-center">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-amber-500">Your Bill</p>
                    <p className="text-[10px] font-mono text-muted-foreground">#{orderNumber}</p>
                </div>
                <p className="text-2xl font-black text-foreground">ETB {total.toLocaleString()}</p>
            </div>

            {/* Step 1 — Pick Bank */}
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

            {/* Step 2 — Show Account & Guide */}
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

            {/* Step 3 — Enter Reference */}
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

/* ─── STEPPER COMPONENTS ─── */
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
                        {/* Status Pulsing Dot */}
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

const CategoryPills: React.FC<{ pills: string[]; onSelect: (p: string) => void }> = ({ pills, onSelect }) => (
    <div className="flex gap-2 mt-3 overflow-x-auto no-scrollbar pb-1">
        {pills.map((pill, i) => (
            <button
                key={i}
                onClick={() => onSelect(`Show me ${pill}`)}
                className="flex-none px-3 py-1 rounded-md bg-muted/5 border border-border text-[10px] font-mono uppercase tracking-widest text-gray-400 hover:text-foreground hover:border-foreground/30 transition-all"
            >
                {pill}
            </button>
        ))}
    </div>
);

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

/* ─── MESSAGE BUBBLE ─── */
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
                {/* Avatar */}
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

                {/* Bubble */}
                <div className={cn(
                    "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                    isUser
                        ? "bg-gradient-to-br from-amber-500 to-amber-600 text-black rounded-tr-md"
                        : "bg-card text-foreground rounded-tl-md border border-border"
                )}>
                    <div className="whitespace-pre-wrap">
                        {msg.content
                            .replace(/\[System Note:.*$/gs, '') // Hide internal debug notes
                            .replace(/^\|.*\|$/gm, '') // Remove markdown table rows
                            .replace(/^[*-] .*(?:ETB|Birr|Price).*$/gmi, '') // Remove bulleted menu items
                            .replace(/^(?:ID|Name|Category|Image URL|Availability|Description|Ref|Status):\s*.*$/gmi, '') // Strip technical fields
                            .replace(/[\*_\[\]\(\)]/g, '') // Remove markdown special chars
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

            {/* Rich Metadata Section */}
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

            {/* Attachments Section */}
            {msg.attachments?.type === 'menu' && msg.attachments.data?.length > 0 && (
                <div className="w-full max-w-[95%] pl-9">
                    <MenuCarousel 
                        items={msg.attachments.data} 
                        onAddToCart={onAddToCart} 
                        isFallback={msg.metadata?.attachments?.is_fallback || msg.metadata?.is_fallback} 
                    />
                </div>
            )}
        </div>
    );
};

/* ─── DISCOVERY SECTION (Top Performers) ─── */
const DiscoveryItem: React.FC<{ item: MenuItem; index: number; compact?: boolean; onSelect: (n: string) => void }> = ({ item, index, compact, onSelect }) => (
    <motion.div
        whileHover={{ y: -5 }}
        onClick={() => onSelect(`Tell me more about ${item.name}`)}
        className={cn(
            "relative rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col group cursor-pointer",
            getPastelColor(index),
            compact ? "w-32 h-40 p-3" : "w-44 h-56 p-5"
        )}
    >
        {/* Decorative Leaf */}
        <FreshLeaf className="absolute -top-1 -right-1 w-8 h-8 text-black/5 rotate-12" />

        <div className="flex-1 flex items-center justify-center relative z-10">
            <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                className={compact ? "w-20 h-20" : "w-28 h-28"}
            >
                {item.image_url ? (
                    <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-contain drop-shadow-xl"
                    />
                ) : (
                    <UtensilsCrossed className="w-10 h-10 text-black/10" />
                )}
            </motion.div>
        </div>
        
        <div className="text-center mb-1 relative z-10">
            <h4 className={cn("text-gray-900 font-black leading-tight line-clamp-2 px-1", compact ? "text-[10px]" : "text-xs")}>
                {item.name}
            </h4>
        </div>

        <div className="flex items-center justify-between mt-auto px-1 relative z-10">
            <p className={cn("font-black text-gray-900", compact ? "text-[11px]" : "text-sm")}>
                ETB {item.price.toLocaleString()}
            </p>
            <div className={cn("rounded-full bg-white/40 flex items-center justify-center", compact ? "w-5 h-5" : "w-7 h-7")}>
                <ChevronDown className="w-3 h-3 text-gray-900/40" />
            </div>
        </div>
    </motion.div>
);

const DiscoverySection: React.FC<{ items: MenuItem[]; compact?: boolean; onSelect: (n: string) => void }> = ({ items, compact, onSelect }) => (
    <motion.div 
        layout
        className={cn(
            "w-full overflow-hidden transition-all duration-500",
            compact ? "px-4 py-2 bg-background/40 backdrop-blur-md border-b border-border" : "py-8"
        )}
    >
        <div className={cn("max-w-2xl mx-auto", compact ? "flex items-center gap-4" : "")}>
            {!compact && (
                <div className="text-center mb-6">
                    <h3 className="text-lg font-bold text-white mb-1">Your Daily Offer</h3>
                    <p className="text-xs text-gray-500 uppercase tracking-widest font-mono">Chef's Fresh Picks</p>
                </div>
            )}
            {compact && (
                <div className="flex-none pr-2 border-r border-border mr-2">
                    <p className="text-[10px] font-black uppercase tracking-tighter text-lime-600 dark:text-lime-500 leading-tight">Top<br/>Items</p>
                </div>
            )}
            <div className={cn(
                "flex gap-3 overflow-x-auto no-scrollbar pb-2 snap-x snap-mandatory",
                compact ? "flex-1" : "justify-center"
            )}>
                {items.map((item, i) => (
                    <div key={item.id} className="snap-start">
                        <DiscoveryItem item={item} index={i} compact={compact} onSelect={onSelect} />
                    </div>
                ))}
            </div>
        </div>
    </motion.div>
);

/* ─── MAIN PAGE ─── */
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
    const [isFetchingCategories, setIsFetchingCategories] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [branchName, setBranchName] = useState('');
    const [branchId, setBranchId] = useState('');
    const [topItems, setTopItems] = useState<MenuItem[]>([]);
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

    // Active order tracking
    interface ActiveOrder {
        id: string;
        order_number: string;
        status: string;
        total_amount: number;
    }
    const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null);
    const [branchBanks, setBranchBanks] = useState<{ bank_key: string; account_number: string }[]>([]);

    // Sync cart to localStorage
    useEffect(() => {
        localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    }, [cart, cartStorageKey]);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const hasInitialGreetingSent = useRef(false);
    const historyLoadedRef = useRef(false);

    const [isIntroCompleted, setIsIntroCompleted] = useState(false);
    useEffect(() => {
        if (!isHistoryLoading && historyLoadedRef.current && messages.length > 0) {
            setIsIntroCompleted(true);
        }
    }, [isHistoryLoading, messages.length]);

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

    // QR Token Verification
    useEffect(() => {
        const urlToken = searchParams.get('token');
        if (!urlToken) {
            // No token in URL - allow access (backwards-compatible for Test Chatbot)
            setIsVerified(true);
            return;
        }
        if (!tableId) return;

        const verifyQrToken = async () => {
            setIsVerifying(true);
            try {
                const { data: tableData } = await supabase
                    .from('tables')
                    .select('qr_token, status')
                    .eq('id', tableId)
                    .maybeSingle();

                if (!tableData) {
                    showToast('Table not found.', 'error');
                    return;
                }

                if (tableData.qr_token && tableData.qr_token === urlToken) {
                    setIsVerified(true);
                    // Mark table as occupied if it was available
                    if (tableData.status === 'available') {
                        await supabase
                            .from('tables')
                            .update({ status: 'occupied', current_session_id: sessionId })
                            .eq('id', tableId);
                    }
                } else {
                    showToast('Invalid table token. Please scan the correct QR code.', 'error');
                }
            } catch (err) {
                console.error('QR token verification failed:', err);
            } finally {
                setIsVerifying(false);
            }
        };

        verifyQrToken();
    }, [tableId, searchParams, sessionId]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    }, [inputValue]);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages, isTyping]);

    // The public chat route now relies on guarded edge functions rather than direct anon table reads.
    // We keep this loading flag so the initial greeting waits for secure branch context.
    useEffect(() => {
        if (!sessionId) {
            setIsHistoryLoading(false);
        }
    }, [sessionId]);

    useEffect(() => {
        const loadBranchContext = async () => {
            if (!branchId) {
                setIsHistoryLoading(false);
                return;
            }

            setIsHistoryLoading(true);
            try {
                const data = await invokeSecureFunction('get-branch-info', { branch_id: branchId });
                if (data?.branch?.name) {
                    setBranchName(data.branch.name);
                }
                if (data?.organization?.name) {
                    setOrgName(data.organization.name);
                }
                if (data?.organization?.id) {
                    setActiveOrgId(data.organization.id);
                }
            } catch (e: any) {
                console.error('Branch context load failed:', e);
                showToast(e.message || 'Unable to open this chat link.', 'error');
            } finally {
                setIsHistoryLoading(false);
            }
        };
        loadBranchContext();
    }, [branchId, invokeSecureFunction]);

    // Load table info, then branch + org names for display
    useEffect(() => {
        const loadTableInfo = async () => {
            if (!tableId) return;
            const { data: tableData } = await supabase
                .from('tables')
                .select('id, table_number, branch_id, organization_id')
                .eq('id', tableId)
                .maybeSingle();
            
            if (!tableData) return;
            setTableNumber(tableData.table_number || '');
            setBranchId(tableData.branch_id || '');
            if (tableData.organization_id) {
                setActiveOrgId(tableData.organization_id);
            }

            if (tableData.branch_id) {
                const { data: branchData } = await supabase
                    .from('branches')
                    .select('name, organization_id')
                    .eq('id', tableData.branch_id)
                    .maybeSingle();
                if (branchData) {
                    setBranchName(branchData.name);
                    if (!tableData.organization_id && branchData.organization_id) {
                        setActiveOrgId(branchData.organization_id);
                    }
                }
            }
        };
        loadTableInfo();
    }, [tableId]);

    // Initialize/Update dynamic prompts when language/defaults change
    useEffect(() => {
        if (dynamicPrompts.length === 0 || messages.length === 0) {
            setDynamicPrompts(QUICK_PROMPTS.map(p => ({ label: p.label, prompt: p.prompt })));
        }
    }, [t, messages.length]);

    // Send message
    const handleSend = useCallback(async (textOverride?: string, isCategoryClick = false) => {
        const textToSend = textOverride || inputValue.trim();
        if (!textToSend.trim() || isTyping) return;

        // 1. Add User Message (Skip if silent category browse)
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
        setHasInteracted(true); // Mark interaction

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
            }, controller.signal);

            if (data?.metadata?.customer_id) {
                localStorage.setItem(`baro_customer_${activeOrgId}`, data.metadata.customer_id);
            }

            clearTimeout(timeoutId);

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
            
            // Extract top performer items from metadata if present
            if (data?.metadata?.top_performing_items) {
                setTopItems(data.metadata.top_performing_items);
            } else if (parsedAttachments && topItems.length === 0) {
                setTopItems(parsedAttachments.data.slice(0, 6));
            }

            setMessages(prev => [...prev, assistantMsg]);
            
            // Update dynamic prompts if metadata contains suggested buttons
            // Filter out legacy generic menu buttons to prevent redundancy with category chips
            const filterGeneric = (buttons: any[]) => buttons.filter(btn => 
                !['best offers', 'drinks', 'food menu', 'show menu', 'popular items'].includes(btn.label?.toLowerCase().replace(/[✨🍹🍕🤩]/g, '').trim())
            );

            if (data?.metadata?.buttons && Array.isArray(data.metadata.buttons)) {
                setDynamicPrompts(filterGeneric(data.metadata.buttons));
            } else if (data?.metadata?.suggested_prompts && Array.isArray(data.metadata.suggested_prompts)) {
                setDynamicPrompts(filterGeneric(data.metadata.suggested_prompts));
            }
            
            if (textToSend === 'init_chat') {
                setHasInteracted(true);
            }
        } catch (err: any) {
            console.error('Chat error full details:', err);
            if (err.name === 'AbortError') {
                showToast("Request timed out. Please try again.", "error");
            }
            if (textToSend !== 'init_chat') {
                const errorMsg: ChatMessage = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: `❌ ${err.message || 'Sorry, something went wrong. Please try again.'}`,
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, errorMsg]);
            }
        } finally {
            setIsTyping(false);
        }
    }, [inputValue, sessionId, tableId, tableNumber, activeOrgId, branchId, topItems.length, branchName, orgName, invokeSecureFunction, isVerified]);

    // Proactive Greeting
    useEffect(() => {
        const sendGreeting = async () => {
            // Wait for core context to be ready
            if (!isHistoryLoading && sessionId && messages.length === 0 && !isTyping && !hasInitialGreetingSent.current && tableId && isVerified) {
                hasInitialGreetingSent.current = true;
                try {
                    await handleSend('init_chat');
                } catch (err) {
                    console.error('Initial greeting failed:', err);
                    hasInitialGreetingSent.current = false;
                }
            }
        };
        sendGreeting();
    }, [sessionId, messages.length, isTyping, handleSend, isHistoryLoading, tableId, isVerified]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const hasContent = inputValue.trim().length > 0;

    if (isVerifying || (isHistoryLoading && tableId)) {
        return (
            <div className="w-full h-[100dvh] flex flex-col items-center justify-center bg-background text-foreground space-y-4">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin" />
                <p className="text-sm font-medium animate-pulse">Verifying Table Connection...</p>
            </div>
        );
    }

    if (!isVerified && !isVerifying) {
        return (
            <div className="w-full h-[100dvh] flex flex-col items-center justify-center bg-background text-foreground p-8 text-center">
                <div className="w-20 h-20 rounded-3xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mb-6">
                    <X className="w-10 h-10 text-red-500" />
                </div>
                <h1 className="text-2xl font-black mb-2">Access Denied</h1>
                <p className="text-muted-foreground text-sm max-w-xs mx-auto">
                    This table session is protected. Please scan the QR code on your table to start ordering.
                </p>
                <Button 
                    className="mt-8 bg-foreground text-background hover:bg-foreground/90 rounded-2xl px-8"
                    onClick={() => window.location.reload()}
                >
                    Try Again
                </Button>
            </div>
        );
    }

    return (
        <div className="w-full h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden font-sans">
            {/* ─── HEADER ─── */}
            <div className="flex-none px-4 py-3 border-b border-border bg-background/60 backdrop-blur-xl safe-area-top z-50">
                <div className="max-w-2xl mx-auto flex items-center justify-between gap-1">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                        <div className="w-8 h-8 sm:w-9 sm:h-9 flex-none rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/30 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.4)] overflow-hidden transition-shadow duration-500">
                            {orgLogoUrl ? (
                                <img src={orgLogoUrl} alt="Logo" className="w-full h-full object-cover" />
                            ) : (
                                <Sparkles className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-emerald-400" />
                            )}
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-sm font-bold text-foreground leading-none truncate">
                                {orgName || branchName || 'CADE'}
                            </h1>
                            <p className="text-[8px] sm:text-[10px] text-muted-foreground mt-1 font-mono uppercase tracking-[0.1em] sm:tracking-[0.2em] truncate">
                                {branchName || 'AI Assistant'} {tableNumber && tableNumber !== 'T1' ? `• Table ${tableNumber}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 sm:gap-3 flex-none">
                        <ThemeToggle />
                        <LanguageSwitcher />
                        <button
                            onClick={() => {
                                if (confirm("This will clear the chat display. Your order history is preserved. Continue?")) {
                                    setMessages([]);
                                    setHasInteracted(false);
                                    hasInitialGreetingSent.current = false;
                                    setCart([]);
                                    localStorage.removeItem(cartStorageKey);
                                }
                            }}
                            className="p-1.5 sm:p-2 hover:bg-red-500/10 text-muted-foreground hover:text-red-500 rounded-full transition-all flex-none"
                            title="Clear Chat"
                        >
                            <Trash2 className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
                        </button>
                        <div className="flex items-center gap-1.5 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex-none">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="hidden sm:inline text-[9px] text-emerald-400 font-black uppercase tracking-widest">{t('common.online') || 'Online'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── PINNED ORDER STATUS / PAYMENT ─── */}
            {activeOrder && !sessionCompleted && (
                <div className="flex-none px-4 py-2 border-b border-border bg-background/80 backdrop-blur-sm">
                    <div className="max-w-2xl mx-auto">
                        {activeOrder.status === 'served' ? (
                            <PaymentCard
                                orderId={activeOrder.id}
                                orderNumber={activeOrder.order_number}
                                total={activeOrder.total_amount}
                                banks={branchBanks}
                                onPaymentSubmitted={() => {
                                    if (activeOrder) setLatestOrderId(activeOrder.id);
                                    setActiveOrder(null);
                                    setCart([]);
                                    localStorage.removeItem(cartStorageKey);
                                    setSessionCompleted(true);
                                }}
                            />
                        ) : (
                            <TrackingWidget
                                status={(ORDER_STATUS_MAP[activeOrder.status] || 'placed') as any}
                                orderNumber={activeOrder.order_number}
                                compact
                            />
                        )}
                    </div>
                </div>
            )}

            {/* ─── PERSISTENT DISCOVERY SECTION REMOVED ─── */}

            {/* ─── SCROLLABLE CHAT AREA ─── */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto pt-4 pb-4">
                <div className="max-w-2xl mx-auto px-4">
                    {!isIntroCompleted ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 1.05 }}
                            className="flex flex-col items-center justify-start pt-6 md:pt-[8vh] min-h-[60vh] text-center px-4"
                        >
                            <div className="relative w-28 h-28 md:w-32 md:h-32 mx-auto mb-8">
                                {/* Glowing ambient light */}
                                <motion.div 
                                    animate={{ 
                                        scale: [1, 1.2, 1],
                                        opacity: [0.3, 0.6, 0.3]
                                    }}
                                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                                    className="absolute -inset-4 bg-emerald-500/25 rounded-full blur-2xl z-0" 
                                />
                                <motion.div 
                                    animate={{ 
                                        scale: [1, 1.1, 1],
                                        opacity: [0.1, 0.3, 0.1]
                                    }}
                                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                                    className="absolute -inset-8 bg-emerald-400/10 rounded-full blur-3xl z-0" 
                                />
                                
                                {/* Agentic Core replacing avatar */}
                                <div className="relative z-10 w-full h-full rounded-full bg-card border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.3)] flex items-center justify-center overflow-hidden ring-4 ring-emerald-500/5 group">
                                    {orgLogoUrl ? (
                                        <img src={orgLogoUrl} alt="Logo" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                    ) : (
                                        <Sparkles className="w-12 h-12 text-emerald-400" />
                                    )}
                                </div>

                                {/* Floating Moana Leaves/Sparkles */}
                                <motion.div animate={{ y: [-4, 4, -4], rotate: [10, 20, 10] }} transition={{ duration: 3, repeat: Infinity }} className="absolute -top-4 -right-2 text-3xl z-20 drop-shadow-lg">🌿</motion.div>
                                <motion.div animate={{ y: [4, -4, 4], rotate: [-10, -20, -10] }} transition={{ duration: 4, repeat: Infinity }} className="absolute bottom-2 -left-4 text-4xl z-20 drop-shadow-lg">🍃</motion.div>
                                <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }} transition={{ duration: 2, repeat: Infinity }} className="absolute top-1/2 -right-8 text-2xl z-20">🍀</motion.div>
                            </div>

                            <motion.h2 
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="text-xl md:text-2xl font-bold text-foreground mb-10 tracking-tight leading-relaxed max-w-[340px] mx-auto normal-case"
                            >
                                <span className="cursive-vibe text-[#84CC16]">slay first, eat second —</span> <br/>
                                <span className="text-emerald-500/90 font-black text-xs sm:text-sm tracking-widest uppercase">jk eat first, chat with me to orderrr 🫶🔥</span>
                            </motion.h2>

                            <motion.button
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.6 }}
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                onClick={() => setIsIntroCompleted(true)}
                                className="w-full max-w-[280px] h-14 rounded-full bg-[#84CC16] hover:bg-lime-400 text-black font-black uppercase tracking-widest text-sm shadow-[0_0_30px_rgba(132,204,22,0.4)] flex items-center justify-center gap-2 relative overflow-hidden group mx-auto transition-colors"
                            >
                                <div className="absolute inset-0 bg-white/20 w-0 group-hover:w-full transition-all duration-300 ease-out" />
                                <span className="relative z-10 flex items-center gap-2">Open Menu <Sparkles className="w-4 h-4" /></span>
                            </motion.button>
                        </motion.div>
                    ) : !hasInteracted && messages.length === 0 ? (
                        <div className="pt-12 pb-8 text-center">
                            <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-4" />
                            <p className="text-sm text-muted-foreground animate-pulse">Initializing Menu...</p>
                        </div>
                    ) : null}

                    <div className={cn("space-y-6 pt-6 transition-all duration-300", (!hasInteracted && !isTyping) ? "opacity-0" : "opacity-100")}>
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
                            <motion.div
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex items-center gap-2.5"
                            >
                                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/30 border border-emerald-500/30 flex items-center justify-center">
                                    <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                                </div>
                                <div className="bg-card border border-border rounded-2xl rounded-tl-md px-4 py-3 shadow-lg">
                                    <div className="flex items-center gap-3">
                                        <div className="flex gap-1">
                                            <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0 }} className="w-1 h-1 bg-emerald-400 rounded-full" />
                                            <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.2 }} className="w-1 h-1 bg-emerald-400 rounded-full" />
                                            <motion.div animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1.5, delay: 0.4 }} className="w-1 h-1 bg-emerald-400 rounded-full" />
                                        </div>
                                        <span className="text-[10px] text-emerald-400/60 uppercase font-bold tracking-widest">Assistant Thinking</span>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-none px-4 pb-6 pt-2 safe-area-bottom bg-background z-50">
                <div className="max-w-2xl mx-auto">
                    {/* Dynamic Suggestion Chips Area */}
                    <div className={cn(
                        "flex gap-2 overflow-x-auto no-scrollbar mb-4 transition-opacity duration-300",
                        (isTyping) ? "opacity-50 pointer-events-none" : "opacity-100"
                    )}>
                        {/* 1. Contextual Actions from Assistant (Metadata) */}
                        {dynamicPrompts.map((action: any, i) => (
                            <button
                                key={`dyn-btn-${i}`}
                                disabled={isTyping}
                                onClick={() => handleSend(action.prompt)}
                                className="flex-none px-4 py-2.5 rounded-full bg-lime-500/10 border border-lime-500/20 text-lime-600 dark:text-lime-400 text-[10px] font-black uppercase tracking-wider hover:bg-lime-500/20 transition-all whitespace-nowrap flex items-center gap-2 active:scale-95"
                            >
                                <Sparkles className="w-3 h-3" />
                                {action.label}
                            </button>
                        ))}

                        {/* 2. Menu Navigation Categories (Direct Fetch) */}
                        {categories.map((cat, i) => (
                            <button
                                key={`cat-${i}`}
                                disabled={isTyping}
                                onClick={() => handleSend(cat, true)}
                                className="flex-none px-4 py-2.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-black uppercase tracking-wider hover:bg-emerald-500/20 transition-all whitespace-nowrap active:scale-95"
                            >
                                {cat}
                            </button>
                        ))}

                        {/* 3. Minimal Fallback (Only if both empty) */}
                        {categories.length === 0 && dynamicPrompts.length === 0 && (
                            <div className="flex-none px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-zinc-500 text-[10px] font-black uppercase tracking-wider whitespace-nowrap animate-pulse">
                                Loading Menu Categories...
                            </div>
                        )}
                    </div>

                    <div className={cn(
                        "relative flex items-end rounded-3xl border transition-all duration-500",
                        "bg-white/5 border-white/10 focus-within:border-lime-500/40"
                    )}>
                        <textarea
                            ref={textareaRef}
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            disabled={isTyping}
                            placeholder={!hasInteracted ? "Waiting..." : "Ask me anything..."}
                            className="flex-1 bg-transparent border-0 outline-none text-foreground text-sm placeholder:text-muted-foreground resize-none overflow-hidden px-5 py-4 leading-relaxed"
                            rows={1}
                            style={{ minHeight: '1.5em', maxHeight: '120px' }}
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={!hasContent || isTyping}
                            className={cn(
                                "m-2 p-2.5 rounded-2xl transition-all duration-500 flex-shrink-0",
                                hasContent && !isTyping ? "bg-[#84CC16] text-white shadow-lg shadow-lime-500/20" : "bg-white/5 text-muted-foreground"
                            )}
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Floating Cart Button */}
            {cart.length > 0 && !isCartOpen && (
                <motion.button
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    onClick={() => setIsCartOpen(true)}
                    className="fixed bottom-24 right-5 z-50 w-14 h-14 rounded-full bg-[#84CC16] text-black shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                >
                    <ShoppingBag className="w-6 h-6" />
                    <span className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-red-500 text-white text-[10px] font-black flex items-center justify-center">
                        {cart.reduce((s, c) => s + c.quantity, 0)}
                    </span>
                </motion.button>
            )}

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

                {/* --- RATING OVERLAY ON SESSION COMPLETE --- */}
                {sessionCompleted && !ratingSubmitted && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
                    >
                        <motion.div
                            initial={{ y: 20, opacity: 0, scale: 0.9 }}
                            animate={{ y: 0, opacity: 1, scale: 1 }}
                            transition={{ delay: 0.1, duration: 0.4 }}
                            className="bg-card w-full max-w-sm rounded-[2rem] p-8 border border-border shadow-2xl flex flex-col items-center gap-6"
                        >
                            <div className="w-16 h-16 rounded-3xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-2">
                                <CheckCircle2 className="w-8 h-8 text-emerald-500" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-black mb-2 uppercase tracking-wide">Thank You! 🥂</h2>
                                <p className="text-muted-foreground text-sm">
                                    Your order is complete. How was your experience today?
                                </p>
                            </div>

                            <RatingInteraction
                                className="mt-4"
                                onChange={async (val) => {
                                    // 1. Submit to DB (Don't wait to show transition)
                                    try {
                                        supabase.from('customer_feedback').insert({
                                            rating: val,
                                            order_id: latestOrderId,
                                            organization_id: activeOrgId || null,
                                            branch_id: branchId || null,
                                            table_id: tableId || null,
                                        }).then(({ error }) => {
                                            if (error) console.error('Feedback save failed:', error);
                                        });
                                    } catch (e) {
                                        console.error('Feedback fetch error:', e);
                                    }

                                    setTimeout(() => {
                                        setRatingSubmitted(true);
                                        if (tableId) {
                                            localStorage.removeItem(`baro_session_${tableId}`);
                                        }
                                        showToast('Thank you for your feedback! 🫶', 'success');
                                        setTimeout(() => window.location.reload(), 2000);
                                    }, 800);
                                }}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

export default CustomerChatPage;
