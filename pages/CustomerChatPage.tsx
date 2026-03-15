import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, Loader2, UtensilsCrossed, ArrowUp, ShoppingBag,
    Receipt, CreditCard, MessageCircle, Sparkles, X, ChevronDown
} from 'lucide-react';
import { cn, showToast } from '../components/ui';
import { supabase } from '../supabase';

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

/* ─── SESSION MANAGEMENT ─── */
const getSessionId = (branchId: string, tableNumber: string): string => {
    const key = `baro_session_${branchId}_${tableNumber}`;
    let sid = localStorage.getItem(key);
    if (!sid) {
        sid = crypto.randomUUID();
        localStorage.setItem(key, sid);
    }
    return sid;
};

/* ─── QUICK PROMPTS ─── */
const QUICK_PROMPTS = [
    { label: 'Show Menu', icon: <UtensilsCrossed className="w-3.5 h-3.5" />, prompt: 'Show me the menu please' },
    { label: 'My Order', icon: <ShoppingBag className="w-3.5 h-3.5" />, prompt: "What's the status of my order?" },
    { label: 'Get Bill', icon: <Receipt className="w-3.5 h-3.5" />, prompt: 'I would like the bill please' },
    { label: 'Payment', icon: <CreditCard className="w-3.5 h-3.5" />, prompt: 'How can I pay?' },
];

/* ─── MENU CAROUSEL ─── */
const MenuCard: React.FC<{ item: MenuItem; onAdd: (item: MenuItem) => void }> = ({ item, onAdd }) => {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className="flex-none w-48 bg-[#111] border border-white/[0.08] rounded-[2.5rem] overflow-hidden group relative"
        >
            {/* Image Section */}
            <div className="h-44 bg-gradient-to-br from-gray-800 to-gray-900 relative">
                {item.image_url ? (
                    <img
                        src={item.image_url}
                        alt={item.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center opacity-20">
                        <UtensilsCrossed className="w-12 h-12" />
                    </div>
                )}
                
                {/* ID Badge (Optional, matched screenshot) */}
                <div className="absolute top-3 right-3 w-8 h-8 bg-white text-black rounded-full flex items-center justify-center text-xs font-bold shadow-lg">
                    1
                </div>

                {/* PS Badge (Proprietary/Original, matched screenshot) */}
                <div className="absolute top-4 left-4 bg-blue-600/20 backdrop-blur-md px-1.5 py-0.5 rounded text-[8px] font-black text-blue-400 border border-blue-400/30">
                    Ps
                </div>
            </div>

            {/* Info Section */}
            <div className="p-5 pb-6">
                <h3 className="text-amber-500 text-xs font-black uppercase tracking-wider mb-1 line-clamp-1">
                    {item.name}
                </h3>
                <p className="text-white text-sm font-bold mb-4">
                    ETB {item.price.toLocaleString()}
                </p>

                {item.demand_status && (
                    <div className="flex items-center gap-1.5 opacity-60">
                        <div className={cn(
                            "w-1 h-1 rounded-full",
                            item.demand_status.toLowerCase().includes('low') ? "bg-red-400" : "bg-emerald-400"
                        )} />
                        <span className="text-[10px] font-mono uppercase tracking-widest">
                            {item.demand_status}
                        </span>
                    </div>
                )}

                <button
                    onClick={() => onAdd(item)}
                    className="absolute bottom-4 right-5 w-8 h-8 rounded-full bg-emerald-500 flex items-center justify-center text-black opacity-0 group-hover:opacity-100 transition-opacity duration-200 active:scale-90"
                >
                    <ArrowUp className="w-4 h-4 rotate-45" />
                </button>
            </div>
        </motion.div>
    );
};

const MenuCarousel: React.FC<{ items: MenuItem[]; onSelect: (name: string) => void }> = ({ items, onSelect }) => {
    return (
        <div className="w-full mt-4 -mx-1 px-1">
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide no-scrollbar snap-x snap-mandatory">
                {items.map((item) => (
                    <div key={item.id} className="snap-start first:pl-2 last:pr-2">
                        <MenuCard 
                            item={{
                                ...item,
                                demand_status: item.demand_status || (Math.random() > 0.7 ? 'High Demand' : 'Low Demand')
                            }} 
                            onAdd={() => onSelect(`Add ${item.name} to my order`)} 
                        />
                    </div>
                ))}
            </div>
        </div>
    );
};

/* ─── MESSAGE BUBBLE ─── */
const MessageBubble: React.FC<{ msg: ChatMessage; onQuickAction: (p: string) => void }> = ({ msg, onQuickAction }) => {
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
                        : "bg-gradient-to-br from-emerald-500/20 to-emerald-600/30 border border-emerald-500/30"
                )}>
                    {isUser
                        ? <div className="w-2.5 h-2.5 rounded-full bg-white/90" />
                        : <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                    }
                </div>

                {/* Bubble */}
                <div className={cn(
                    "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                    isUser
                        ? "bg-gradient-to-br from-amber-500 to-amber-600 text-black rounded-tr-md shadow-lg shadow-amber-500/10"
                        : "bg-[#1a1a1a] text-gray-200 rounded-tl-md border border-white/[0.06]"
                )}>
                    <div className="whitespace-pre-wrap">{msg.content}</div>
                    <p className={cn(
                        "text-[9px] mt-1.5 opacity-50",
                        isUser ? "text-black/60 text-right" : "text-gray-500"
                    )}>
                        {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                </div>
            </motion.div>

            {/* Attachments Section */}
            {msg.attachments?.type === 'menu' && (
                <div className="w-full max-w-[95%]">
                    <MenuCarousel items={msg.attachments.data} onSelect={onQuickAction} />
                </div>
            )}
        </div>
    );
};

/* ─── MAIN PAGE ─── */
const CustomerChatPage: React.FC = () => {
    const { branchId, tableNumber } = useParams<{ branchId: string; tableNumber: string }>();
    const [searchParams] = useSearchParams();
    const orgId = searchParams.get('org') || '';

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [branchName, setBranchName] = useState('');

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    const sessionId = branchId && tableNumber ? getSessionId(branchId, tableNumber) : '';

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

    // Load history on mount
    useEffect(() => {
        const load = async () => {
            if (!sessionId) return;
            try {
                const { data, error } = await supabase
                    .from('customer_chats')
                    .select('*')
                    .eq('session_id', sessionId)
                    .order('created_at', { ascending: true })
                    .limit(50);

                if (!error && data && data.length > 0) {
                    const mapped: ChatMessage[] = data
                        .filter(m => m.role !== 'system')
                        .map(m => ({
                            id: m.id,
                            role: m.role as any,
                            content: m.content,
                            timestamp: new Date(m.created_at),
                        }));
                    setMessages(mapped);
                    setHasInteracted(true);
                }
            } catch (e) {
                console.error('History load failed:', e);
            }
        };
        load();
    }, [sessionId]);

    // Load branch name
    useEffect(() => {
        const loadBranch = async () => {
            if (!branchId) return;
            const { data } = await supabase
                .from('branches')
                .select('name')
                .eq('id', branchId)
                .maybeSingle();
            if (data) setBranchName(data.name);
        };
        loadBranch();
    }, [branchId]);

    // Send message
    const handleSend = useCallback(async (overrideMessage?: string) => {
        const msg = overrideMessage || inputValue.trim();
        if (!msg) return;

        setHasInteracted(true);
        const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: msg,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        if (textareaRef.current) textareaRef.current.style.height = 'auto';
        setIsTyping(true);

        try {
            const { data, error } = await supabase.functions.invoke('customer-intelligence', {
                body: {
                    message: msg,
                    session_id: sessionId,
                    table_number: tableNumber,
                    organization_id: orgId,
                    branch_id: branchId,
                },
            });

            if (error) throw error;

            const responseText = data?.text || '⚠️ No response. Please try again.';
            const assistantMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: responseText,
                timestamp: new Date(),
                attachments: data?.attachments
            };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (err: any) {
            console.error('Chat error:', err);
            const errorMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: `❌ Sorry, something went wrong. Please try again.`,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    }, [inputValue, sessionId, tableNumber, orgId, branchId]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const hasContent = inputValue.trim().length > 0;

    return (
        <div className="w-full h-[100dvh] flex flex-col bg-[#0a0a0a] text-white overflow-hidden">
            {/* ─── HEADER ─── */}
            <div className="flex-none px-4 py-3 border-b border-white/[0.06] bg-black/60 backdrop-blur-xl safe-area-top">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/30 border border-emerald-500/30 flex items-center justify-center">
                            <Sparkles className="w-4.5 h-4.5 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-white leading-none">
                                {branchName || 'Restaurant Assistant'}
                            </h1>
                            <p className="text-[10px] text-gray-500 mt-0.5 font-mono uppercase tracking-widest">
                                {tableNumber && tableNumber !== 'T1' ? `Table ${tableNumber}` : 'AI Assistant'}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">Online</span>
                    </div>
                </div>
            </div>

            {/* ─── SCROLLABLE CHAT AREA ─── */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto px-4 pb-4">
                    {/* Welcome Hero */}
                    {!hasInteracted && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, ease: [0.2, 0, 0, 1] }}
                            className="pt-12 md:pt-20 pb-8 text-center"
                        >
                            <div className="w-16 h-16 mx-auto mb-6 relative">
                                <div className="absolute inset-0 bg-emerald-500/20 rounded-2xl blur-xl animate-pulse" />
                                <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/20 flex items-center justify-center">
                                    <UtensilsCrossed className="w-8 h-8 text-emerald-400" />
                                </div>
                            </div>
                            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
                                Welcome to {branchName || 'our restaurant'}! 🎉
                            </h2>
                            <p className="text-sm text-gray-400 max-w-md mx-auto mb-2">
                                I'm your AI assistant. I can show you the menu, take your order, and help with payments.
                            </p>
                            <p className="text-xs text-gray-600 font-mono">
                                Table {tableNumber}
                            </p>

                            {/* Quick Actions */}
                            <div className="flex flex-wrap justify-center gap-2 mt-8">
                                {QUICK_PROMPTS.map((action, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSend(action.prompt)}
                                        className="inline-flex items-center gap-2 px-4 py-2.5 text-xs text-gray-300 bg-white/[0.04] border border-white/[0.08] rounded-full hover:bg-emerald-500/10 hover:border-emerald-500/20 hover:text-emerald-400 transition-all duration-200 active:scale-95"
                                    >
                                        <span className="opacity-60">{action.icon}</span>
                                        {action.label}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}

                    {/* Messages */}
                    {hasInteracted && (
                        <div className="pt-4 space-y-6">
                            <AnimatePresence initial={false}>
                                {messages.map(msg => (
                                    <MessageBubble 
                                        key={msg.id} 
                                        msg={msg} 
                                        onQuickAction={handleSend}
                                    />
                                ))}
                            </AnimatePresence>

                            {/* Typing Indicator */}
                            {isTyping && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-2.5"
                                >
                                    <div className="w-7 h-7 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/30 border border-emerald-500/30 flex items-center justify-center">
                                        <Sparkles className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                                    </div>
                                    <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-2xl rounded-tl-md px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />
                                            <span className="text-xs text-emerald-400/60">Thinking...</span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── INPUT AREA (Pinned Bottom) ─── */}
            <div className="flex-none px-3 pb-3 pt-2 safe-area-bottom bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a] to-transparent">
                <div className="max-w-2xl mx-auto">
                    <div className={cn(
                        "relative flex items-end rounded-2xl border transition-all duration-200",
                        "bg-[#111] border-white/[0.08]",
                        "focus-within:border-emerald-500/30 focus-within:shadow-[0_0_20px_rgba(16,185,129,0.06)]"
                    )}>
                        <textarea
                            ref={textareaRef}
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder="Type your message..."
                            className="flex-1 bg-transparent border-0 outline-none text-white text-sm placeholder:text-gray-600 resize-none overflow-hidden px-4 py-3 leading-relaxed"
                            rows={1}
                            style={{ minHeight: '1.5em', maxHeight: '120px' }}
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={!hasContent}
                            className={cn(
                                "m-1.5 p-2 rounded-xl transition-all duration-200 flex-shrink-0",
                                hasContent
                                    ? "bg-emerald-500 text-white hover:bg-emerald-400 shadow-lg shadow-emerald-500/20 active:scale-95"
                                    : "bg-white/5 text-gray-600 cursor-default"
                            )}
                        >
                            <ArrowUp className="w-4 h-4" />
                        </button>
                    </div>
                    <p className="text-[9px] text-gray-700 text-center mt-2 font-mono">
                        Powered by Baro AI
                    </p>
                </div>
            </div>
        </div>
    );
};

export default CustomerChatPage;
