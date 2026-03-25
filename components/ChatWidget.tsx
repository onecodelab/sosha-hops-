import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    MessageCircle, X, Send, Loader2, Sparkles, ArrowUp,
    UtensilsCrossed, TrendingUp, DollarSign, Timer, ChefHat,
    CheckCircle2, PackageCheck, Users, Star
} from 'lucide-react';
import { cn } from './ui';
import { DisplayCards } from './ui/display-cards';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { useBranch } from '../contexts/BranchContext';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
    metadata?: {
        buttons?: { label: string; prompt: string }[];
        tracking?: { status: 'placed' | 'preparing' | 'ready' | 'delivered' };
        pills?: string[];
        splitter?: { total: number };
        rating?: { type: 'stars' };
    };
    attachments?: {
        type: 'menu';
        data: any[];
    };
}

const getSessionId = (): string => {
    const key = 'baro_widget_session';
    let sid = localStorage.getItem(key);
    if (!sid) {
        sid = crypto.randomUUID();
        localStorage.setItem(key, sid);
    }
    return sid;
};

/* ─── RICH UI COMPONENTS (Mirrored from CustomerChatPage) ─── */
const ActionButtons: React.FC<{ buttons: { label: string; prompt: string }[]; onAction: (p: string) => void }> = ({ buttons, onAction }) => (
    <div className="flex flex-wrap gap-2 mt-2">
        {buttons.map((btn, i) => (
            <motion.button
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ scale: 1.05, backgroundColor: "rgba(16, 185, 129, 0.15)" }}
                whileTap={{ scale: 0.95 }}
                onClick={() => onAction(btn.prompt)}
                className="px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-wider hover:border-emerald-500/40 transition-all flex items-center gap-2 group relative overflow-hidden"
            >
                <div className="absolute inset-0 bg-emerald-500/5 animate-pulse" style={{ animationDuration: '2s' }} />
                <span className="relative z-10">{btn.label}</span>
                <Sparkles className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.button>
        ))}
    </div>
);

const TrackingWidget: React.FC<{ status: 'placed' | 'preparing' | 'ready' | 'delivered' }> = ({ status }) => {
    const stages = [
        { key: 'placed', label: 'Placed', icon: <Timer className="w-3 h-3" /> },
        { key: 'preparing', label: 'Prep', icon: <ChefHat className="w-3 h-3" /> },
        { key: 'ready', label: 'Ready', icon: <CheckCircle2 className="w-3 h-3" /> },
        { key: 'delivered', label: 'Done', icon: <PackageCheck className="w-3 h-3" /> },
    ];
    const currentIndex = stages.findIndex(s => s.key === status);

    return (
        <div className="mt-2 p-3 rounded-xl bg-primary/5 border border-primary/10 w-full">
            <div className="flex justify-between items-center mb-4">
                <span className="text-[9px] font-black uppercase tracking-widest text-emerald-500">Live Status</span>
            </div>
            <div className="relative flex justify-between">
                <div className="absolute top-3 left-0 w-full h-[1px] bg-primary/10" />
                <div className="absolute top-3 left-0 h-[1px] bg-emerald-500 transition-all duration-1000" style={{ width: `${(currentIndex / (stages.length - 1)) * 100}%` }} />
                {stages.map((stage, i) => (
                    <div key={stage.key} className="relative z-10 flex flex-col items-center gap-1">
                        <div className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center transition-all",
                            i === currentIndex ? "bg-emerald-500 text-black scale-110 shadow-none" :
                            i < currentIndex ? "bg-emerald-500/20 text-emerald-400" : "bg-[#1a1a1a] text-gray-600"
                        )}>
                            {stage.icon}
                        </div>
                        <span className={cn("text-[7px] font-bold uppercase", i <= currentIndex ? "text-white" : "text-gray-600")}>{stage.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
};

const BillSplitter: React.FC<{ total: number }> = ({ total }) => {
    const [people, setPeople] = useState(2);
    return (
        <div className="mt-2 p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 w-full">
            <div className="flex items-center gap-2 mb-2">
                <Users className="w-3 h-3 text-amber-500" />
                <span className="text-[9px] font-black uppercase tracking-widest text-amber-500">Splitter</span>
            </div>
            <div className="flex justify-between items-end mb-3">
                <div>
                    <p className="text-[8px] text-gray-500 uppercase">Total</p>
                    <p className="text-sm font-bold">ETB {total.toLocaleString()}</p>
                </div>
                <div className="text-right">
                    <p className="text-[8px] text-gray-500 uppercase">Each</p>
                    <p className="text-sm font-bold text-amber-500">ETB {Math.round(total / people).toLocaleString()}</p>
                </div>
            </div>
            <input
                type="range" min="2" max="10"
                value={people} onChange={(e) => setPeople(parseInt(e.target.value))}
                className="w-full accent-amber-500 bg-primary/10 rounded-lg appearance-none h-1"
            />
        </div>
    );
};

const StarRating: React.FC = () => {
    const [rating, setRating] = useState(0);
    const [submitted, setSubmitted] = useState(false);
    if (submitted) return <div className="mt-2 text-[10px] text-emerald-400 font-bold">Thanks for rating!</div>;

    return (
        <div className="mt-2 p-3 rounded-xl bg-primary/5 border border-primary/10 inline-block">
            <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} onClick={() => { setRating(s); setTimeout(() => setSubmitted(true), 800); }}>
                        <Star className={cn("w-4 h-4 transition-colors", rating >= s ? "fill-amber-500 text-amber-500" : "text-gray-700")} />
                    </button>
                ))}
            </div>
        </div>
    );
};

export const ChatWidget: React.FC = () => {
    const { organizationId: contextOrgId } = useAuth();
    const { activeBranchId } = useBranch();

    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const sessionId = getSessionId();

    // Extract params from URL for guest customers (QR scans)
    const urlParams = new URLSearchParams(window.location.search);
    const tableFromUrl = urlParams.get('table') || '';
    const branchFromUrl = urlParams.get('branch') || '';
    const orgFromUrl = urlParams.get('org') || '';

    const organizationId = contextOrgId || orgFromUrl;
    const branchId = activeBranchId || branchFromUrl;

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages, isTyping]);

    // Focus input when opened
    useEffect(() => {
        if (isOpen && inputRef.current) {
            setTimeout(() => inputRef.current?.focus(), 300);
        }
    }, [isOpen]);

    // Load history on open
    useEffect(() => {
        if (!isOpen) return;
        const load = async () => {
            try {
                const { data } = await supabase
                    .from('customer_chats')
                    .select('*')
                    .eq('session_id', sessionId)
                    .order('created_at', { ascending: true })
                    .limit(30);

                if (data && data.length > 0) {
                    setMessages(data.filter(m => m.role !== 'system').map(m => ({
                        id: m.id,
                        role: m.role,
                        content: m.content,
                        timestamp: new Date(m.created_at),
                        metadata: m.metadata,
                        attachments: m.metadata?.attachments
                    })));
                }
            } catch (e) {
                console.error('Widget history load failed:', e);
            }
        };
        load();
    }, [isOpen, sessionId]);

    const handleSend = useCallback(async () => {
        const msg = inputValue.trim();
        if (!msg) return;

        const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: msg,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsTyping(true);

        try {
            const { data, error } = await supabase.functions.invoke('customer-intelligence', {
                body: {
                    message: msg,
                    session_id: sessionId,
                    table_id: tableFromUrl || undefined
                },
            });

            if (error) throw error;

            // Parse attachments from API format: metadata.attachments.items
            const rawItems = data?.metadata?.attachments?.items;
            const parsedAttachments = rawItems && Array.isArray(rawItems) && rawItems.length > 0
                ? { type: 'menu' as const, data: rawItems }
                : undefined;

            const assistantMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: data?.text || data?.response || '⚠️ No response.',
                timestamp: new Date(),
                metadata: data?.metadata,
                attachments: parsedAttachments
            };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (err: any) {
            setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `❌ Error: ${err.message || 'Failed to connect.'}`,
                timestamp: new Date(),
            }]);
        } finally {
            setIsTyping(false);
        }
    }, [inputValue, sessionId, tableFromUrl]);

    return (
        <>
            {/* Floating Bubble */}
            <AnimatePresence>
                {!isOpen && (
                    <motion.button
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0, opacity: 0 }}
                        onClick={() => setIsOpen(true)}
                        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-black flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
                    >
                        <MessageCircle className="w-6 h-6" />
                    </motion.button>
                )}
            </AnimatePresence>

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.25, ease: [0.2, 0, 0, 1] }}
                        className="fixed bottom-5 right-5 z-50 w-[360px] h-[520px] md:w-[400px] md:h-[560px] bg-[#0a0a0a] border border-primary/10 rounded-2xl flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-primary/10 bg-black/40">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/30 border border-emerald-500/30 flex items-center justify-center">
                                    <Sparkles className="w-4 h-4 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold text-white">Restaurant Assistant</h3>
                                    <span className="text-[9px] text-emerald-400 font-mono">● Online</span>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-primary/5 text-gray-500 hover:text-white transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                            {messages.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-center py-10">
                                    <div className="mb-12 scale-[0.85] md:scale-90 transition-transform hover:scale-100 duration-700">
                                        <DisplayCards
                                            cards={[
                                                {
                                                    title: "Featured Dish",
                                                    description: "Chef's Signature Burger",
                                                    icon: "trending-up",
                                                    date: "Hot 🔥"
                                                },
                                                {
                                                    title: "Special Offer",
                                                    description: "20% off all drinks today",
                                                    icon: "dollar-sign",
                                                    date: "Limited Time"
                                                },
                                                {
                                                    title: "Fast Tracking",
                                                    description: "Real-time order status",
                                                    icon: <Sparkles className="size-4 text-emerald-500" />,
                                                    date: "Live"
                                                }
                                            ]}
                                        />
                                    </div>
                                    <div className="relative">
                                        <div className="absolute inset-0 bg-emerald-500/10 blur-xl rounded-full" />
                                        <Sparkles className="w-8 h-8 text-emerald-500 mb-3 relative z-10 animate-pulse" />
                                    </div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-500/60 mb-1">
                                        Baro AI Assistant
                                    </p>
                                    <p className="text-xs text-gray-500 max-w-[240px] leading-relaxed">
                                        Hi! I can help you browse the menu, track orders, or handle your bill in real-time.
                                    </p>
                                </div>
                            )}

                            {messages.map(msg => (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex flex-col gap-2",
                                        msg.role === 'user' ? "items-end" : "items-start"
                                    )}
                                >
                                    <div className={cn(
                                        "flex gap-2 max-w-[88%]",
                                        msg.role === 'user' ? "flex-row-reverse" : ""
                                    )}>
                                        <div className={cn(
                                            "px-4 py-3 rounded-2xl text-[13px] leading-relaxed",
                                            msg.role === 'user'
                                                ? "bg-gradient-to-br from-amber-400 to-amber-600 text-black rounded-tr-md font-medium"
                                                : "bg-[#1a1a1a] text-gray-200 rounded-tl-md border border-primary/10"
                                        )}>
                                            <div className="whitespace-pre-wrap">{msg.content}</div>
                                        </div>
                                    </div>

                                    {! (msg.role === 'user') && msg.metadata && (
                                        <div className="w-full pl-2 space-y-1">
                                            {msg.metadata.tracking && <TrackingWidget status={msg.metadata.tracking.status} />}
                                            {msg.metadata.splitter && <BillSplitter total={msg.metadata.splitter.total} />}
                                            {msg.metadata.rating && <StarRating />}
                                            {msg.metadata.buttons && <ActionButtons buttons={msg.metadata.buttons} onAction={handleSend} />}
                                        </div>
                                    )}
                                </div>
                            ))}

                            {isTyping && (
                                <div className="flex items-center gap-2">
                                    <div className="bg-[#1a1a1a] border border-primary/10 rounded-xl px-3 py-2">
                                        <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="p-3 border-t border-primary/10 bg-black/30">
                            <div className="flex items-center gap-2">
                                <input
                                    ref={inputRef}
                                    value={inputValue}
                                    onChange={e => setInputValue(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-[#111] border border-primary/10 rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-gray-600 outline-none focus:border-emerald-500/30"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!inputValue.trim()}
                                    className={cn(
                                        "p-2 rounded-xl transition-all",
                                        inputValue.trim()
                                            ? "bg-emerald-500 text-white hover:bg-emerald-400 active:scale-95"
                                            : "bg-primary/5 text-gray-600"
                                    )}
                                >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
};
