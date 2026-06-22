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

/* ─── CATEGORY CHIP ─── */
const CategoryChip: React.FC<{
    label: string;
    isActive: boolean;
    onClick: () => void;
}> = ({ label, isActive, onClick }) => {
    return (
        <button
            onClick={onClick}
            className={cn(
                "h-[40px] px-6 rounded-full text-[13px] font-medium tracking-wide transition-all duration-300 whitespace-nowrap flex items-center justify-center",
                isActive 
                    ? "bg-[#84CC16] text-[#FFFFFF] font-semibold shadow-md shadow-[#84CC16]/20" 
                    : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0] hover:text-[#0F172A]"
            )}
        >
            {label}
        </button>
    );
};

/* ─── FEATURED SPECIAL CARD (HERO) ─── */
const FeaturedSpecialCard: React.FC<{ item: MenuItem; onAdd: (item: MenuItem) => void }> = ({ item, onAdd }) => {
    const [imageError, setImageError] = useState(false);
    return (
        <motion.div
            whileTap={{ scale: 0.98 }}
            className="flex-none w-[280px] bg-[#FFFFFF] border border-[#E2E8F0] rounded-[24px] overflow-hidden flex flex-row group transition-all duration-300 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.05)] hover:shadow-[0_12px_24px_-8px_rgba(15,23,42,0.08)] hover:border-[#84CC16]/30"
        >
            <div className="w-[100px] h-full bg-[#FAFAFA] relative overflow-hidden flex-shrink-0">
                {!imageError && item.image_url ? (
                    <motion.img 
                        src={item.image_url} 
                        alt={item.name} 
                        onError={() => setImageError(true)}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" 
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <UtensilsCrossed className="w-6 h-6 text-[#64748B]/30" />
                    </div>
                )}
            </div>
            <div className="p-4 flex flex-col justify-between flex-1 min-w-0">
                <div>
                    <h4 className="text-[15px] font-semibold text-[#0F172A] truncate tracking-tight">{item.name}</h4>
                    <p className="text-[12px] text-[#64748B] line-clamp-2 mt-1 leading-normal">
                        {item.description || 'Chef\'s special selection.'}
                    </p>
                </div>
                <div className="flex items-center justify-between mt-3 pt-1">
                    <span className="text-[15px] font-bold text-[#0F172A]">
                        ETB {item.price.toLocaleString()}
                    </span>
                    <button
                        onClick={(e) => { e.stopPropagation(); onAdd(item); }}
                        className="w-11 h-11 rounded-full bg-[#84CC16] text-[#FFFFFF] flex items-center justify-center shadow-lg shadow-[#84CC16]/20 hover:bg-[#84CC16]/90 active:scale-95 transition-all flex-shrink-0"
                    >
                        <Plus className="w-5 h-5 font-bold" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

/* ─── PRODUCT CARD ─── */
const ProductCard: React.FC<{ item: MenuItem; onAdd: (item: MenuItem) => void }> = ({ item, onAdd }) => {
    const [imageError, setImageError] = useState(false);
    return (
        <motion.div
            whileTap={{ scale: 0.98 }}
            className="bg-[#FFFFFF] border border-[#E2E8F0] rounded-[24px] overflow-hidden flex flex-col group transition-all duration-300 shadow-[0_4px_20px_-4px_rgba(15,23,42,0.05)] hover:shadow-[0_12px_24px_-8px_rgba(15,23,42,0.08)] hover:border-[#84CC16]/30"
        >
            <div className="aspect-[4/3] w-full overflow-hidden bg-[#FAFAFA] relative">
                {!imageError && item.image_url ? (
                    <motion.img 
                        src={item.image_url} 
                        alt={item.name} 
                        onError={() => setImageError(true)}
                        whileHover={{ scale: 1.05 }}
                        transition={{ duration: 0.3 }}
                        className="w-full h-full object-cover" 
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <UtensilsCrossed className="w-8 h-8 text-[#64748B]/30" />
                    </div>
                )}
            </div>
            <div className="p-4 flex flex-col flex-1">
                <h3 className="text-[18px] font-semibold text-[#0F172A] line-clamp-1 mb-1 tracking-tight">
                    {item.name}
                </h3>
                <p className="text-[14px] text-[#64748B] line-clamp-2 mb-3 h-10 leading-snug">
                    {item.description || 'Delicately prepared with fresh ingredients.'}
                </p>
                <div className="mt-auto flex items-center justify-between pt-1">
                    <span className="text-[20px] font-bold text-[#0F172A]">
                        ETB {item.price.toLocaleString()}
                    </span>
                    <button
                        onClick={(e) => { e.stopPropagation(); onAdd(item); }}
                        className="w-11 h-11 rounded-full bg-[#84CC16] text-[#FFFFFF] flex items-center justify-center shadow-lg shadow-[#84CC16]/20 hover:bg-[#84CC16]/90 active:scale-95 transition-all flex-shrink-0"
                    >
                        <Plus className="w-5 h-5 font-bold" />
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

/* ─── MENU CARD (CHAT) ─── */
const MenuCard: React.FC<{ item: MenuItem; index: number; onAdd: (item: MenuItem) => void }> = ({ item, index, onAdd }) => {
    const [imageError, setImageError] = useState(false);
    return (
        <motion.div
            whileHover={{ y: -4 }}
            className="relative w-36 h-48 bg-[#FFFFFF] border border-[#E2E8F0] rounded-[24px] overflow-hidden flex flex-col p-3 shadow-sm transition-all duration-300"
        >
            <div className="flex-1 flex items-center justify-center relative z-10 mb-2">
                <div className="w-16 h-16 rounded-full overflow-hidden bg-[#FAFAFA] border border-[#E2E8F0]/60 p-1 flex items-center justify-center">
                    {!imageError && item.image_url ? (
                        <img 
                            src={item.image_url} 
                            alt={item.name} 
                            onError={() => setImageError(true)}
                            className="w-full h-full object-cover rounded-full" 
                        />
                    ) : (
                        <UtensilsCrossed className="w-6 h-6 text-[#64748B]/30" />
                    )}
                </div>
            </div>

            <div className="text-center mb-2 relative z-10 px-1">
                <h3 className="text-[#0F172A] text-[12px] font-semibold leading-tight line-clamp-2">
                    {item.name}
                </h3>
            </div>

            <div className="flex items-center justify-between relative z-10 mt-auto">
                <span className="text-[12px] font-bold text-[#0F172A] leading-none">
                    ETB {item.price.toLocaleString()}
                </span>

                <button
                    onClick={() => onAdd(item)}
                    className="w-8 h-8 rounded-full bg-[#84CC16] flex items-center justify-center text-white shadow-md shadow-[#84CC16]/20 hover:scale-105 active:scale-90 transition-all"
                >
                    <Plus className="w-4 h-4 font-bold" />
                </button>
            </div>
        </motion.div>
    );
};

/* ─── MENU CAROUSEL ─── */
const MenuCarousel: React.FC<{ items: MenuItem[]; onAddToCart: (item: MenuItem) => void; isFallback?: boolean }> = ({ items, onAddToCart, isFallback }) => {
    return (
        <div className="w-full mt-2">
            {isFallback && (
                <div className="mb-3 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#84CC16] animate-pulse" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[#64748B]">House Favorites For You</span>
                </div>
            )}
            <div className="flex gap-3 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-2 snap-x snap-mandatory">
                {items.map((item, i) => (
                    <div key={item.id} className="snap-start flex-shrink-0">
                        <MenuCard 
                            index={i}
                            item={item} 
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
        <div className="fixed inset-0 z-[100] flex flex-col justify-end bg-black/40 backdrop-blur-sm">
            <div className="absolute inset-0 z-0" onClick={onClose} />
            <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                className="relative z-10 w-full max-w-md mx-auto bg-[#FFFFFF] border-t border-[#E2E8F0] rounded-t-[24px] shadow-[0_-8px_30px_rgba(15,23,42,0.08)] max-h-[80vh] flex flex-col"
            >
                <div className="w-12 h-1 bg-[#E2E8F0] rounded-full mx-auto my-3 flex-shrink-0" />
                <div className="px-6 pb-4 flex items-center justify-between border-b border-[#E2E8F0]">
                    <div>
                        <h3 className="text-[18px] font-bold text-[#0F172A]">Your Cart</h3>
                        <p className="text-[12px] text-[#64748B] font-medium">{cart.length} item{cart.length !== 1 ? 's' : ''}</p>
                    </div>
                    <button onClick={onClose} className="p-2 bg-[#FAFAFA] hover:bg-[#F1F5F9] rounded-full transition-all border border-[#E2E8F0]">
                        <X className="w-4 h-4 text-[#64748B]" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-4 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                    {cart.length === 0 ? (
                        <div className="text-center py-12 flex flex-col items-center opacity-60">
                            <ShoppingBag className="w-12 h-12 mb-4 text-[#64748B]" />
                            <div className="text-[#64748B] text-sm font-bold uppercase tracking-wider">Your cart is empty</div>
                        </div>
                    ) : cart.map(c => (
                        <div key={c.menuItem.id} className="flex items-center gap-4 p-3 bg-[#FAFAFA] border border-[#E2E8F0] rounded-[16px] shadow-sm">
                            {c.menuItem.image_url && (
                                <img src={c.menuItem.image_url} alt={c.menuItem.name} className="w-16 h-16 rounded-[12px] object-cover shadow-sm" />
                            )}
                            <div className="flex-1 min-w-0 py-1">
                                <p className="text-[14px] font-semibold text-[#0F172A] truncate mb-0.5">{c.menuItem.name}</p>
                                <p className="text-[12px] font-bold text-[#84CC16]">ETB {c.menuItem.price.toLocaleString()}</p>
                            </div>
                            <div className="flex items-center gap-3 bg-[#FFFFFF] rounded-full p-1 border border-[#E2E8F0]">
                                <button onClick={() => c.quantity <= 1 ? onRemove(c.menuItem.id) : onUpdateQty(c.menuItem.id, -1)}
                                    className="w-8 h-8 rounded-full bg-[#FAFAFA] flex items-center justify-center text-[#0F172A] text-sm font-bold hover:bg-red-500/10 hover:text-red-500 transition-all border border-[#E2E8F0]/40"
                                >−</button>
                                <span className="text-sm font-bold w-3 text-center text-[#0F172A]">{c.quantity}</span>
                                <button onClick={() => onUpdateQty(c.menuItem.id, 1)}
                                    className="w-8 h-8 rounded-full bg-[#84CC16] flex items-center justify-center text-white text-sm font-bold shadow-md shadow-[#84CC16]/20 hover:scale-105 active:scale-95 transition-all"
                                >+</button>
                            </div>
                        </div>
                    ))}
                </div>

                {cart.length > 0 && (
                    <div className="p-6 bg-[#FAFAFA] border-t border-[#E2E8F0] space-y-4 pb-8 rounded-b-[24px]">
                        <div className="flex justify-between items-center px-2">
                            <span className="text-xs text-[#64748B] font-bold uppercase tracking-wider">Total Amount</span>
                            <span className="text-xl font-bold text-[#0F172A] tracking-tight">ETB {total.toLocaleString()}</span>
                        </div>
                        <button
                            onClick={onPlaceOrder}
                            disabled={isPlacing}
                            className="w-full h-12 rounded-full bg-[#84CC16] text-[#FFFFFF] font-bold uppercase tracking-wider text-sm shadow-md shadow-[#84CC16]/20 hover:bg-[#84CC16]/90 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-3"
                        >
                            {isPlacing ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShoppingBag className="w-5 h-5" />}
                            {isPlacing ? 'Placing Order...' : 'Place Order'}
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
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

/* ─── PAYMENT CARD ─── */
const PaymentCard: React.FC<{
    orderId: string;
    orderNumber: string;
    total: number;
    banks: { bank_key: string; account_number: string; account_name?: string }[];
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
            <div className="p-6 rounded-[24px] bg-[#FFFFFF] border border-[#22C55E]/30 text-center space-y-2">
                <CheckCircle2 className="w-10 h-10 text-[#22C55E] mx-auto mb-2" />
                <p className="text-sm font-bold text-[#0F172A]">Payment Verified! 🎉</p>
                <p className="text-[12px] text-[#64748B]">Table session closing… Thank you for dining with us 💚</p>
            </div>
        );
    }

    if (paymentStatus === 'failed' || paymentStatus === 'error') {
        return (
            <div className="p-6 rounded-[24px] bg-[#FFFFFF] border border-red-200 space-y-4">
                <div className="text-center">
                    <X className="w-10 h-10 text-red-500 mx-auto mb-2" />
                    <p className="text-[16px] font-bold text-[#0F172A]">Verification Failed</p>
                    <p className="text-[12px] text-[#64748B] mt-1 leading-relaxed">{lastError || 'Reference not valid. Check the ref number and try again.'}</p>
                    {lastVerifiedContext && (
                        <div className="mt-2 p-2 rounded-xl bg-red-50 border border-red-100 inline-block">
                             <p className="text-[10px] text-red-600 font-bold uppercase tracking-tighter">
                                Verified Target: {BANK_DISPLAY[lastVerifiedContext.bank]?.name || lastVerifiedContext.bank} ({lastVerifiedContext.account})
                             </p>
                        </div>
                    )}
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => { setPaymentStatus('idle'); setRefNumber(''); setStep('enter_ref'); }}
                        className="flex-1 h-11 rounded-full border border-[#E2E8F0] text-[13px] font-semibold text-[#0F172A] bg-[#FAFAFA] hover:bg-[#F1F5F9] transition-all"
                    >
                        Try Again
                    </button>
                    <button
                        onClick={() => showToast('Waiter notified! 🙋 Please wait.', 'success')}
                        className="flex-1 h-11 rounded-full bg-[#84CC16] text-[#0F172A] text-[13px] font-semibold shadow-md shadow-[#84CC16]/20 hover:bg-[#84CC16]/90 transition-all"
                    >
                        🙋 Call Waiter
                    </button>
                </div>
            </div>
        );
    }

    if (paymentStatus === 'verifying') {
        return (
            <div className="p-6 rounded-[24px] bg-[#FFFFFF] border border-[#84CC16]/30 text-center space-y-2">
                <Loader2 className="w-8 h-8 text-[#84CC16] mx-auto mb-2 animate-spin" />
                <p className="text-sm font-bold text-[#0F172A]">Verifying payment...</p>
                <p className="text-[12px] text-[#64748B]">Checking your reference — almost done!</p>
            </div>
        );
    }

    return (
        <div className="p-6 rounded-[24px] bg-[#FFFFFF] border border-[#E2E8F0] space-y-5 shadow-sm">
            <div className="flex justify-between items-center">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-wider text-[#84CC16]">Your Bill</p>
                    <p className="text-[12px] font-mono text-[#64748B]">#{orderNumber}</p>
                </div>
                <p className="text-[22px] font-bold text-[#0F172A]">ETB {total.toLocaleString()}</p>
            </div>

            {step === 'select_bank' && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Pay with</p>
                    <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] pb-1">
                        {banks.map(bank => {
                            const display = BANK_DISPLAY[bank.bank_key] || { name: bank.bank_key };
                            return (
                                <button
                                    key={bank.bank_key}
                                    onClick={() => handleSelectBank(bank)}
                                    className="flex-none px-4 py-2.5 rounded-full text-[12px] font-semibold border border-[#E2E8F0] text-[#64748B] bg-[#FAFAFA] hover:border-[#84CC16] hover:text-[#0F172A] hover:bg-[#FFFFFF] transition-all"
                                >
                                    {display.name}
                                </button>
                            );
                        })}
                    </div>
                </motion.div>
            )}

            {step === 'send_payment' && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <div className="p-4 rounded-2xl bg-[#FAFAFA] border border-[#E2E8F0] space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#84CC16]">Send to</p>
                        <p className="text-[18px] font-bold text-[#0F172A] font-mono tracking-wider">{selectedAccount}</p>
                        {banks.find(b => b.bank_key === selectedBank)?.account_name && (
                            <p className="text-[13px] font-bold text-[#0F172A] uppercase tracking-wide">
                                {banks.find(b => b.bank_key === selectedBank)?.account_name}
                            </p>
                        )}
                        <p className="text-[12px] text-[#64748B]">{BANK_DISPLAY[selectedBank]?.name} • ETB {total.toLocaleString()}</p>
                    </div>
                    <p className="text-[12px] text-[#64748B] leading-relaxed">
                        Open your <strong>{BANK_DISPLAY[selectedBank]?.name}</strong> app, send the exact amount, then come back with the <strong>transaction reference</strong>.
                    </p>
                    <button
                        onClick={() => setStep('enter_ref')}
                        className="w-full h-11 rounded-full bg-[#84CC16] text-[#0F172A] font-bold uppercase tracking-wider text-xs shadow-md shadow-[#84CC16]/20 hover:bg-[#84CC16]/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                    >
                        <Receipt className="w-4 h-4" /> I've Sent It — Enter Reference
                    </button>
                    <button onClick={() => setStep('select_bank')} className="w-full text-center text-[11px] text-[#64748B] hover:text-[#0F172A] transition-colors">
                        ← Change payment method
                    </button>
                </motion.div>
            )}

            {step === 'enter_ref' && (
                <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                    <p className="text-[12px] text-[#64748B]">Paste the <strong>transaction reference / REFID</strong> from your receipt:</p>
                    <input
                        type="text"
                        value={refNumber}
                        onChange={e => setRefNumber(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleVerify()}
                        placeholder="e.g. TT2503250001234"
                        className="w-full h-12 px-4 rounded-xl bg-[#FAFAFA] border border-[#E2E8F0] text-sm text-[#0F172A] placeholder:text-[#64748B]/50 focus:outline-none focus:border-[#84CC16] focus:bg-[#FFFFFF] transition-all font-mono"
                        autoFocus
                    />
                    <button
                        onClick={handleVerify}
                        disabled={!refNumber.trim() || isVerifying}
                        className="w-full h-12 rounded-full bg-[#84CC16] text-[#0F172A] font-bold uppercase tracking-wider text-xs shadow-md shadow-[#84CC16]/20 hover:bg-[#84CC16]/90 active:scale-[0.98] transition-all disabled:opacity-40 flex items-center justify-center gap-2"
                    >
                        {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        {isVerifying ? 'Verifying...' : 'Confirm Payment'}
                    </button>
                    <button onClick={() => setStep('send_payment')} className="w-full text-center text-[11px] text-[#64748B] hover:text-[#0F172A] transition-colors">
                        ← Back
                    </button>
                </motion.div>
            )}
        </div>
    );
};

/* ─── STEPPER NAV / TRACKING ─── */
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
                "absolute top-3.5 left-[calc(50%+1rem)] right-[-1rem] h-[2px] z-0 transition-colors duration-500",
                completed ? "bg-[#84CC16]" : "bg-[#E2E8F0]"
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
        "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold z-10 transition-all duration-500 border",
        completed ? "bg-[#84CC16] border-[#84CC16] text-white shadow-sm" :
        active ? "bg-white border-[#84CC16] text-[#84CC16] ring-4 ring-[#84CC16]/10" :
        "bg-[#FAFAFA] border-[#E2E8F0] text-[#64748B]"
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
                    className="flex flex-row items-center justify-between cursor-pointer rounded-2xl bg-[#FAFAFA] border border-[#E2E8F0] px-4 py-3 hover:bg-[#F1F5F9] transition-colors shadow-sm"
                >
                    <div className="flex items-center gap-4">
                        <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#84CC16] opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-[#84CC16]"></span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-[9px] font-bold text-[#64748B] uppercase tracking-wider leading-none mb-1">Status</span>
                            <span className="text-[11px] font-bold text-[#0F172A] uppercase tracking-wide leading-none">{activeStage.title}</span>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {orderNumber && <span className="text-[10px] font-bold uppercase tracking-wider text-[#84CC16] bg-[#84CC16]/10 border border-[#84CC16]/20 px-2 py-1 rounded-md">#{orderNumber}</span>}
                        <div className={cn("w-6 h-6 rounded-full bg-[#E2E8F0]/50 flex items-center justify-center transition-transform duration-300", isExpanded ? "rotate-180" : "rotate-0")}>
                            <ChevronDown className="w-4 h-4 text-[#64748B]" />
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
                                                    "text-[10px] font-bold uppercase tracking-tight transition-colors duration-500",
                                                    active ? "text-[#0F172A]" : completed ? "text-[#84CC16]" : "text-[#64748B]"
                                                )}>
                                                    {stage.title}
                                                </p>
                                                <p className="text-[8px] text-[#64748B]/70 font-medium uppercase tracking-[0.05em] mt-0.5 leading-none">
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

/* ─── BILL SPLITTER ─── */
const BillSplitter: React.FC<{ total: number }> = ({ total }) => {
    const [people, setPeople] = useState(2);
    return (
        <div className="mt-4 p-5 rounded-[24px] bg-[#FFFFFF] border border-[#E2E8F0] w-full max-w-sm shadow-sm">
            <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-[#84CC16]" />
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#64748B]">Bill Splitter</span>
            </div>

            <div className="space-y-4">
                <div className="flex justify-between items-end">
                    <div>
                        <p className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">Total Bill</p>
                        <p className="text-lg font-bold text-[#0F172A]">ETB {total.toLocaleString()}</p>
                    </div>
                    <div className="text-right">
                        <p className="text-[10px] text-[#64748B] uppercase tracking-wide mb-1">Each Pays</p>
                        <p className="text-lg font-bold text-[#84CC16]">ETB {Math.round(total / people).toLocaleString()}</p>
                    </div>
                </div>

                <div className="pt-4 border-t border-[#E2E8F0]">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-xs text-[#64748B] font-medium">Number of People</span>
                        <span className="text-[16px] font-bold text-[#0F172A]">{people}</span>
                    </div>
                    <input
                        type="range" min="2" max="12" step="1"
                        value={people} onChange={(e) => setPeople(parseInt(e.target.value))}
                        className="w-full accent-[#84CC16] bg-[#F1F5F9] rounded-lg appearance-none h-1.5 cursor-pointer"
                    />
                </div>
            </div>
        </div>
    );
};

/* ─── STAR RATING ─── */
const StarRating: React.FC = () => {
    const [rating, setRating] = useState(0);
    const [hover, setHover] = useState(0);
    const [submitted, setSubmitted] = useState(false);

    if (submitted) return (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-3 text-xs text-[#22C55E] font-bold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" /> Thanks for your feedback!
        </motion.div>
    );

    return (
        <div className="mt-4 p-4 rounded-[16px] bg-[#FFFFFF] border border-[#E2E8F0] inline-block shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-3 text-center">Rate your experience</p>
            <div className="flex gap-2 justify-center">
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
                                (hover || rating) >= star ? "fill-[#84CC16] text-[#84CC16]" : "text-[#E2E8F0]"
                            )}
                        />
                    </button>
                ))}
            </div>
        </div>
    );
};

/* ─── ACTION BUTTONS / PILLS ─── */
const ActionButtons: React.FC<{ buttons: { label: string; prompt: string }[]; onAction: (p: string) => void }> = ({ buttons, onAction }) => (
    <div className="flex gap-2 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] py-1">
        {buttons.map((btn, i) => (
            <button
                key={i}
                onClick={() => onAction(btn.prompt)}
                className="flex-none px-4 py-2 rounded-full border border-[#E2E8F0] bg-[#FFFFFF] text-[#0F172A] text-[12px] font-medium hover:border-[#84CC16] hover:text-[#84CC16] transition-all whitespace-nowrap shadow-sm"
            >
                {btn.label}
            </button>
        ))}
    </div>
);

const CategoryPills: React.FC<{ pills: string[]; onSelect: (p: string) => void }> = ({ pills, onSelect }) => (
    <div className="flex flex-wrap gap-1.5 mt-2">
        {pills.map((pill, i) => (
            <button
                key={i}
                onClick={() => onSelect(`Show me ${pill}`)}
                className="px-3 py-1 rounded-full bg-[#FAFAFA] border border-[#E2E8F0] text-[11px] font-medium text-[#64748B] hover:border-[#84CC16] hover:text-[#84CC16] transition-all"
            >
                {pill}
            </button>
        ))}
    </div>
);

/* ─── MENU VIEW ─── */
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

    const specials = items.slice(0, 4);

    return (
        <div className="flex-1 overflow-y-auto pb-32 pt-6 bg-[#FAFAFA] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            {/* Categories */}
            <div className="flex gap-2.5 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-6 mb-6">
                <CategoryChip
                    label="All"
                    isActive={activeCategory === 'All'}
                    onClick={() => onCategoryChange('All')}
                />
                {categories.map(cat => (
                    <CategoryChip
                        key={cat}
                        label={cat}
                        isActive={activeCategory === cat}
                        onClick={() => onCategoryChange(cat)}
                    />
                ))}
            </div>

            {/* Hero Specials Section */}
            {specials.length > 0 && (
                <div className="mb-8">
                    <div className="px-6 mb-3">
                        <h3 className="text-[18px] font-bold text-[#0F172A] tracking-tight">Today's Specials</h3>
                        <p className="text-[12px] text-[#64748B]">Handpicked delicacies for you today</p>
                    </div>
                    <div className="flex gap-4 overflow-x-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] px-6 pb-2 snap-x snap-mandatory">
                        {specials.map(item => (
                            <div key={`special-${item.id}`} className="snap-start flex-shrink-0">
                                <FeaturedSpecialCard item={item} onAdd={onAddToCart} />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Menu Grid */}
            <div className="px-6 mb-12">
                <div className="mb-6">
                    <h3 className="text-[28px] font-bold text-[#0F172A] tracking-tight leading-tight">Best Choice</h3>
                    <p className="text-[14px] text-[#64748B]">Most ordered by customers today</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    {filteredItems.map(item => (
                        <ProductCard key={item.id} item={item} onAdd={onAddToCart} />
                    ))}
                </div>
            </div>
        </div>
    );
});



/* ─── TRACKING VIEW ─── */
const TrackingView: React.FC<{ 
    activeOrder: ActiveOrder | null; 
    refreshOrder: () => void;
    branchBanks: { bank_key: string; account_number: string; account_name?: string }[];
    latestOrderId: string | null;
    onPaymentSubmitted: () => void;
}> = ({ activeOrder, refreshOrder, branchBanks, latestOrderId, onPaymentSubmitted }) => {
    return (
        <div className="flex-1 flex flex-col p-6 overflow-y-auto pb-32 bg-[#FAFAFA] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            <h2 className="text-[28px] font-bold text-[#0F172A] mb-2 uppercase tracking-tight">Order Tracking</h2>
            <p className="text-[14px] text-[#64748B] mb-6">Track your active order status below</p>
            {activeOrder ? (
                <div className="space-y-6">
                    <div className="p-6 rounded-[24px] bg-[#FFFFFF] border border-[#E2E8F0] shadow-sm">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <p className="text-[10px] font-bold text-[#84CC16] uppercase tracking-wider mb-1">Active Order</p>
                                <p className="text-[18px] font-bold text-[#0F172A]">#{activeOrder.order_number}</p>
                            </div>
                            <button onClick={refreshOrder} className="p-2.5 rounded-full bg-[#FAFAFA] border border-[#E2E8F0] hover:bg-[#F1F5F9] transition-all">
                                <Loader2 className="w-4 h-4 text-[#64748B]" />
                            </button>
                        </div>
                        <TrackingWidget status={ORDER_STATUS_MAP[activeOrder.status] as any || 'placed'} orderNumber={activeOrder.order_number} />
                        <div className="mt-8 pt-6 border-t border-[#E2E8F0] flex justify-between items-center">
                            <span className="text-[14px] font-semibold text-[#64748B] uppercase">Total Amount</span>
                            <span className="text-[20px] font-bold text-[#0F172A]">ETB {activeOrder.total_amount.toLocaleString()}</span>
                        </div>
                    </div>

                    {branchBanks.length > 0 && (
                        <PaymentCard
                            orderId={activeOrder.id}
                            orderNumber={activeOrder.order_number}
                            total={activeOrder.total_amount}
                            banks={branchBanks}
                            onPaymentSubmitted={onPaymentSubmitted}
                        />
                    )}

                    <button 
                        onClick={() => showToast('Waiter notified! 🙋 Please wait.', 'success')}
                        className="w-full h-12 rounded-full bg-[#FFFFFF] border border-[#E2E8F0] text-[#0F172A] font-bold uppercase tracking-wider text-xs shadow-sm hover:bg-[#FAFAFA] transition-all"
                    >
                        Call Waiter 🙋
                    </button>
                </div>
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-60 py-12">
                    <div className="w-20 h-20 rounded-full bg-[#FFFFFF] border border-[#E2E8F0] flex items-center justify-center mb-4 shadow-sm">
                        <PackageCheck className="w-10 h-10 text-[#64748B]" />
                    </div>
                    <p className="text-[16px] font-bold text-[#0F172A] uppercase tracking-wide">No Active Orders</p>
                    <p className="text-[12px] text-[#64748B] mt-1 max-w-[240px]">Your current orders and tracking updates will appear here</p>
                </div>
            )}
        </div>
    );
};

/* ─── BOTTOM NAVIGATION ─── */
const BottomNav: React.FC<{
    currentView: 'menu' | 'orders';
    onViewChange: (v: 'menu' | 'orders') => void;
}> = ({ currentView, onViewChange }) => {
    return (
        <div className="fixed bottom-6 inset-x-4 max-w-md mx-auto bg-white/85 backdrop-blur-xl border border-[#E2E8F0] px-8 py-3 flex items-center justify-between z-[90] rounded-[24px] shadow-[0_8px_30px_rgb(15,23,42,0.06)] transition-all duration-300">
            <button 
                onClick={() => onViewChange('menu')} 
                className={cn(
                    "flex flex-col items-center gap-1 transition-all duration-300 flex-1", 
                    currentView === 'menu' ? "text-[#84CC16] scale-105 font-semibold" : "text-[#64748B] hover:text-[#0F172A]"
                )}
            >
                <ShoppingBag className="w-5 h-5" />
                <span className="text-[10px] tracking-wide">Menu</span>
            </button>

            <button 
                onClick={() => onViewChange('orders')} 
                className={cn(
                    "flex flex-col items-center gap-1 transition-all duration-300 flex-1", 
                    currentView === 'orders' ? "text-[#84CC16] scale-105 font-semibold" : "text-[#64748B] hover:text-[#0F172A]"
                )}
            >
                <Receipt className="w-5 h-5" />
                <span className="text-[10px] tracking-wide">Orders</span>
            </button>
        </div>
    );
};

/* ─── CUSTOMER CHAT PAGE (MAIN COMPONENT) ─── */
const CustomerChatPage: React.FC = () => {
    const { t } = useLanguage();
    const { tableId } = useParams<{ tableId: string }>();
    const [searchParams] = useSearchParams();
    const [branchToken, setBranchToken] = useState<string>('');
    const [activeOrgId, setActiveOrgId] = useState('');
    const [categories, setCategories] = useState<string[]>([]);
    const [branchName, setBranchName] = useState('');
    const [branchId, setBranchId] = useState('');
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [isVerified, setIsVerified] = useState(false);
    const [isVerifying, setIsVerifying] = useState(true);
    const [orgName, setOrgName] = useState('');
    const [orgLogoUrl, setOrgLogoUrl] = useState('');
    const [tableNumber, setTableNumber] = useState('');
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
    const [branchBanks, setBranchBanks] = useState<{ bank_key: string; account_number: string; account_name?: string }[]>([]);
    const [currentView, setCurrentView] = useState<'menu' | 'orders'>('menu');
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
        const fetchOptions: RequestInit = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${authToken}`,
            },
            body: JSON.stringify(body),
        };
        if (signal) {
            fetchOptions.signal = signal;
        }
        console.log('invokeSecureFunction fetch call debug:', {
            url: `${SUPABASE_URL}/functions/v1/${functionName}`,
            fetchOptions
        });
        const response = await fetch(`${SUPABASE_URL}/functions/v1/${functionName}`, fetchOptions);
        const payload = await response.json().catch(() => ({}));
        if (!response.ok || payload?.error) {
            throw new Error(payload?.detail || payload?.error || `Failed to call ${functionName}.`);
        }
        return payload;
    }, [getEdgeAuthToken]);

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
            const result = await invokeSecureFunction('place-order', payload);
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
    }, [branchId, cart, generateOrderNumber, isPlacingOrder, refreshActiveOrder, tableId, tableNumber, invokeSecureFunction]);

    useEffect(() => {
        localStorage.setItem(cartStorageKey, JSON.stringify(cart));
    }, [cart, cartStorageKey]);

    const bootstrappedRef = useRef(false);

    useEffect(() => {
        if (bootstrappedRef.current) return;
        bootstrappedRef.current = true;

        const isTokenExpired = (token: string): boolean => {
            try {
                const parts = token.split('.');
                if (parts.length < 2) return true;
                const payload = JSON.parse(atob(parts[0].replace(/-/g, '+').replace(/_/g, '/')));
                if (payload.exp) {
                    return payload.exp * 1000 < Date.now();
                }
                return false;
            } catch {
                return true;
            }
        };

        const bootstrap = async () => {
            if (!tableId) return;
            
            const urlToken = searchParams.get('token');
            setIsHistoryLoading(true);
            setIsVerifying(true);

            try {
                const { data: tableData } = await supabase
                    .from('tables')
                    .select('*')
                    .eq('id', tableId)
                    .maybeSingle();

                if (!tableData) {
                    showToast('Table not found. Please scan a valid QR code.', 'error');
                    setIsHistoryLoading(false);
                    setIsVerifying(false);
                    return;
                }

                setTableNumber(tableData.table_number || '');
                setBranchId(tableData.branch_id || '');
                const currentBranchId = tableData.branch_id;
                const currentOrgId = tableData.organization_id;

                if (currentOrgId) setActiveOrgId(currentOrgId);

                const sessionTokenKey = `baro_table_session_${tableId}`;
                let activeToken = (sessionStorage.getItem(sessionTokenKey) || '').replace(/[\r\n\s]+/g, '');

                if (activeToken && isTokenExpired(activeToken)) {
                    activeToken = '';
                    sessionStorage.removeItem(sessionTokenKey);
                }

                if (!activeToken) {
                    if (urlToken) {
                        try {
                            const { data: sessionToken, error: rpcErr } = await supabase.rpc('get_table_session_token', {
                                p_table_id: tableId,
                                p_qr_token: urlToken
                            });

                            if (rpcErr || !sessionToken) {
                                throw new Error(rpcErr?.message || 'Failed to exchange table token');
                            }

                            activeToken = sessionToken.replace(/[\r\n\s]+/g, '');
                            sessionStorage.setItem(sessionTokenKey, activeToken);
                        } catch (e) {
                            console.error('Token exchange failed:', e);
                            showToast('Verification failed. Please scan a valid QR code.', 'error');
                            setIsVerified(false);
                            setIsHistoryLoading(false);
                            setIsVerifying(false);
                            return;
                        }
                    } else {
                        setIsVerified(false);
                        setIsHistoryLoading(false);
                        setIsVerifying(false);
                        return;
                    }
                }

                setBranchToken(activeToken);
                setIsVerified(true);

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

                if (currentOrgId) {
                    supabase.from('bank_settings')
                        .select('*')
                        .eq('organization_id', currentOrgId)
                        .eq('is_active', true)
                        .then(({ data }) => { if (data) setBranchBanks(data); })
                        .catch(() => null);
                }

                if (currentBranchId) {
                    supabase.from('branches').select('name').eq('id', currentBranchId).maybeSingle()
                        .then(({ data }) => { if (data?.name) setBranchName(data.name); });
                    
                    if (currentOrgId) {
                        supabase.from('organizations').select('name, chatbot_logo_url').eq('id', currentOrgId).maybeSingle()
                            .then(({ data }) => {
                                if (data?.name) setOrgName(data.name);
                                if (data?.chatbot_logo_url) setOrgLogoUrl(data.chatbot_logo_url);
                            });
                    }
                }

                refreshActiveOrder().catch(() => null);

            } catch (err) {
                console.error('Fatal bootstrap failure:', err);
            } finally {
                setIsHistoryLoading(false);
                setIsVerifying(false);
            }
        };

        bootstrap();
    }, [tableId, searchParams, refreshActiveOrder]);

    useEffect(() => {
        let isMounted = true;
        let pollId = window.setInterval(async () => {
            try {
                if (isMounted) await refreshActiveOrder();
            } catch (err) { console.warn('Polling error:', err); }
        }, 10000);
        return () => { isMounted = false; window.clearInterval(pollId); };
    }, [refreshActiveOrder]);

    if (isVerifying || isHistoryLoading) {
        return (
            <div className="flex flex-col h-[100dvh] items-center justify-center bg-[#FAFAFA] text-[#0F172A] text-center">
                <Loader2 className="w-10 h-10 text-[#84CC16] animate-spin mb-4" />
                <p className="text-sm font-bold uppercase tracking-widest text-[#64748B] animate-pulse">Verifying Session...</p>
            </div>
        );
    }

    if (!isVerified) {
        return (
            <div className="flex flex-col h-[100dvh] items-center justify-center bg-[#FAFAFA] text-[#0F172A] text-center p-6 relative">
                <div className="relative z-10 w-full max-w-sm rounded-[24px] bg-[#FFFFFF] border border-[#E2E8F0] p-8 shadow-sm flex flex-col items-center gap-6">
                    <div className="w-16 h-16 rounded-full bg-red-50 border border-red-100 flex items-center justify-center">
                        <X className="w-8 h-8 text-red-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold uppercase tracking-tight text-[#0F172A]">Session Invalid or Expired</h2>
                        <p className="text-xs text-[#64748B] mt-2 leading-relaxed">
                            For security reasons, your digital ordering session has expired or is invalid.
                        </p>
                    </div>
                    <div className="p-4 rounded-[16px] bg-[#FAFAFA] border border-[#E2E8F0] text-[10px] text-[#64748B] leading-relaxed uppercase tracking-wider">
                        📱 Please scan the physical QR code printed on your table to start ordering.
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-[100dvh] bg-[#FAFAFA] overflow-hidden relative font-sans text-[#0F172A] select-none">
            {/* Header */}
            <div className="flex-none px-6 py-3 flex items-center justify-between bg-white/80 backdrop-blur-md border-b border-[#E2E8F0] z-50 sticky top-0 animate-fade-in">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-transparent border border-[#E2E8F0] flex items-center justify-center overflow-hidden flex-shrink-0">
                        {orgLogoUrl ? <img src={orgLogoUrl} alt="Logo" className="w-full h-full object-contain" /> : <Sparkles className="w-5 h-5 text-[#84CC16]" />}
                    </div>
                    <div>
                        <h1 className="text-[20px] font-bold text-[#0F172A] leading-tight tracking-tight">{orgName || 'Restaurant'}</h1>
                        <p className="text-[12px] font-medium text-[#64748B]">
                            {branchName || 'Main Branch'} • Table {tableNumber || 'Guest'}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <LanguageSwitcher />
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative z-10 flex flex-col bg-[#FAFAFA]">
                {currentView === 'menu' && (
                    <MenuView
                        items={allItems}
                        categories={categories}
                        activeCategory={activeCategory}
                        onCategoryChange={setActiveCategory}
                        onAddToCart={addToCart}
                    />
                )}


                {currentView === 'orders' && (
                    <TrackingView 
                        activeOrder={activeOrder} 
                        refreshOrder={refreshActiveOrder}
                        branchBanks={branchBanks}
                        latestOrderId={latestOrderId}
                        onPaymentSubmitted={() => {
                            setSessionCompleted(true);
                            setRatingSubmitted(false);
                        }}
                    />
                )}
            </div>

            {/* Bottom Navigation */}
            <BottomNav currentView={currentView} onViewChange={setCurrentView} />

            {/* Floating Cart Button */}
            {cart.length > 0 && !isCartOpen && (
                <motion.button
                    initial={{ scale: 0, y: 20 }}
                    animate={{ scale: 1, y: 0 }}
                    onClick={() => setIsCartOpen(true)}
                    className="fixed bottom-24 right-6 z-[85] h-12 px-5 rounded-full bg-[#84CC16] text-[#FFFFFF] shadow-lg shadow-[#84CC16]/20 flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform"
                >
                    <ShoppingBag className="w-4.5 h-4.5" />
                    <span className="text-sm font-bold">
                        Cart ({cart.reduce((s, c) => s + c.quantity, 0)}) • ETB {cart.reduce((s, c) => s + c.menuItem.price * c.quantity, 0).toLocaleString()}
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
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center">
                        <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="bg-[#FFFFFF] w-full max-w-sm rounded-[24px] p-8 border border-[#E2E8F0] shadow-md flex flex-col items-center gap-6">
                            <div className="w-16 h-16 rounded-[24px] bg-[#22C55E]/10 border border-[#22C55E]/20 flex items-center justify-center mb-2">
                                <CheckCircle2 className="w-8 h-8 text-[#22C55E]" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold mb-2 uppercase tracking-wide">Thank You! 🥂</h2>
                                <p className="text-[#64748B] text-sm">Your order is complete. How was your experience today?</p>
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
