import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Send, Loader2, UtensilsCrossed, ArrowUp, ShoppingBag,
    Receipt, CreditCard, MessageCircle, Sparkles, X, ChevronDown,
    CheckCircle2, Timer, ChefHat, PackageCheck, Star, Users
} from 'lucide-react';
import { cn, showToast } from '../components/ui';
import { supabase } from '../supabase';
import ThemeToggle from '../components/ThemeToggle';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useLanguage } from '../contexts/LanguageContext';

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
// Moved inside component for translation support

/* ─── MENU CAROUSEL ─── */
/* ─── HELPERS ─── */
const getPastelColor = (index: number) => {
    const colors = [
        'bg-[#E0F2FE]', // Light Blue
        'bg-[#FEE2E2]', // Light Red
        'bg-[#F3E8FF]', // Light Purple
        'bg-[#DCFCE7]', // Light Green
        'bg-[#FEF3C7]', // Light Yellow
    ];
    return colors[index % colors.length];
};

const FreshLeaf: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M2 22C2 22 2 18 7 18C12 18 16 22 16 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M12 2C12 2 12 10 7 14C2 18 2 22 2 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M12 2C12 2 12 10 17 14C22 18 22 22 22 22" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
);

/* ─── MENU CAROUSEL ─── */
const MenuCard: React.FC<{ item: MenuItem; index: number; onAdd: (item: MenuItem) => void }> = ({ item, index, onAdd }) => {
    return (
        <motion.div
            whileHover={{ y: -5 }}
            className={cn(
                "relative w-52 h-64 rounded-[2.5rem] overflow-hidden shadow-sm flex flex-col p-5 group",
                getPastelColor(index)
            )}
        >
            {/* Decorative Leaves */}
            <FreshLeaf className="absolute -top-2 -right-2 w-12 h-12 text-black/5 rotate-12" />
            <FreshLeaf className="absolute bottom-10 -left-4 w-16 h-16 text-black/5 -rotate-45" />

            {/* Image Section - Floating */}
            <div className="flex-1 flex items-center justify-center relative z-10">
                <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="w-32 h-32"
                >
                    {item.image_url ? (
                        <img
                            src={item.image_url}
                            alt={item.name}
                            className="w-full h-full object-contain drop-shadow-2xl"
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center bg-black/5 rounded-full">
                            <UtensilsCrossed className="w-12 h-12 text-black/20" />
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Title - Centered Inside */}
            <div className="text-center mb-4 relative z-10 px-2">
                <h3 className="text-gray-900 text-sm font-black leading-tight line-clamp-2">
                    {item.name}
                </h3>
            </div>

            {/* Footer: Price & Add Button */}
            <div className="flex items-end justify-between relative z-10">
                <div className="flex flex-col">
                    <span className="text-[10px] text-gray-500 line-through opacity-60">
                        ETB {(item.price * 1.2).toFixed(0)}
                    </span>
                    <div className="flex items-baseline gap-0.5">
                        <span className="text-[10px] font-bold text-gray-900">ETB</span>
                        <span className="text-lg font-black text-gray-900 leading-none">
                            {item.price.toLocaleString()}
                        </span>
                    </div>
                </div>

                <button
                    onClick={() => onAdd(item)}
                    className="w-10 h-10 rounded-full bg-[#84CC16] flex items-center justify-center text-white shadow-lg shadow-lime-500/30 hover:bg-lime-500 active:scale-90 transition-all"
                >
                    <ShoppingBag className="w-5 h-5" />
                </button>
            </div>
        </motion.div>
    );
};

const MenuCarousel: React.FC<{ items: MenuItem[]; onSelect: (name: string) => void }> = ({ items, onSelect }) => {
    return (
        <div className="w-full mt-4 -mx-1 px-1">
            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide no-scrollbar snap-x snap-mandatory">
                {items.map((item, i) => (
                    <div key={item.id} className="snap-start first:pl-2 last:pr-2">
                        <MenuCard 
                            index={i}
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

const TrackingWidget: React.FC<{ status: 'placed' | 'preparing' | 'ready' | 'delivered' }> = ({ status }) => {
    const { t } = useLanguage();
    const stages = [
        { key: 'placed', label: t('restock.statuses.pending') || 'Placed', icon: <Timer className="w-4 h-4" /> },
        { key: 'preparing', label: t('ordersTables.kitchenSync') || 'Preparing', icon: <ChefHat className="w-4 h-4" /> },
        { key: 'ready', label: t('ordersTables.productionReady') || 'Ready', icon: <CheckCircle2 className="w-4 h-4" /> },
        { key: 'delivered', label: t('ordersTables.settleVector') || 'Delivered', icon: <PackageCheck className="w-4 h-4" /> },
    ];

    const currentIndex = stages.findIndex(s => s.key === status);

    return (
        <div className="mt-4 p-4 rounded-2xl bg-card border border-border w-full max-w-sm">
            <div className="flex justify-between items-center mb-6">
                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Order Status</span>
                <span className="text-[10px] font-mono text-gray-500">Ref: #ORD-9281</span>
            </div>

            <div className="relative flex justify-between">
                {/* Progress Line */}
                <div className="absolute top-4 left-0 w-full h-[2px] bg-white/5 z-0" />
                <div
                    className="absolute top-4 left-0 h-[2px] bg-lime-500 z-0 transition-all duration-1000"
                    style={{ width: `${(currentIndex / (stages.length - 1)) * 100}%` }}
                />

                {stages.map((stage, i) => {
                    const isActive = i <= currentIndex;
                    const isCurrent = i === currentIndex;
                    return (
                        <div key={stage.key} className="relative z-10 flex flex-col items-center gap-2">
                            <div className={cn(
                                "w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500",
                                isCurrent ? "bg-lime-500 text-black scale-110 shadow-[0_0_15px_rgba(132,204,22,0.4)]" :
                                isActive ? "bg-lime-500/20 text-lime-400" : "bg-[#1a1a1a] text-gray-600"
                            )}>
                                {stage.icon}
                            </div>
                            <span className={cn(
                                "text-[8px] font-bold uppercase tracking-tighter transition-colors",
                                isActive ? "text-foreground" : "text-gray-600"
                            )}>
                                {stage.label}
                            </span>
                        </div>
                    );
                })}
            </div>
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
                        {msg.content.replace(/[\*_\[\]\(\)]/g, '')}
                    </div>

                    {/* Inline Pills */}
                    {msg.metadata?.pills && (
                        <CategoryPills pills={msg.metadata.pills} onSelect={onQuickAction} />
                    )}

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
                        <TrackingWidget status={msg.metadata.tracking.status} />
                    )}
                    {msg.metadata.splitter && (
                        <BillSplitter total={msg.metadata.splitter.total} />
                    )}
                    {msg.metadata.rating && (
                        <StarRating />
                    )}
                    {msg.metadata.buttons && (
                        <ActionButtons buttons={msg.metadata.buttons} onAction={onQuickAction} />
                    )}
                </div>
            )}

            {/* Attachments Section */}
            {msg.attachments?.type === 'menu' && (
                <div className="w-full max-w-[95%] pl-9">
                    <MenuCarousel items={msg.attachments.data} onSelect={onQuickAction} />
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

    const QUICK_PROMPTS = [
        { label: '✨ Best Offers', icon: <Sparkles className="w-3.5 h-3.5" />, prompt: 'Show me the best offers' },
        { label: '🍹 Drinks', icon: <UtensilsCrossed className="w-3.5 h-3.5" />, prompt: 'Show me the drinks menu' },
        { label: '☕ Coffee', icon: <ChefHat className="w-4 h-4" />, prompt: 'I would like to see the coffee options' },
        { label: '🍕 Food Menu', icon: <ShoppingBag className="w-3.5 h-3.5" />, prompt: 'Show me the food menu' },
    ];

    const { branchId, tableNumber } = useParams<{ branchId: string; tableNumber: string }>();
    const [searchParams] = useSearchParams();
    const [activeOrgId, setActiveOrgId] = useState(searchParams.get('org') || '');

    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [hasInteracted, setHasInteracted] = useState(false);
    const [branchName, setBranchName] = useState('');
    const [topItems, setTopItems] = useState<MenuItem[]>([]);
    const [isHistoryLoading, setIsHistoryLoading] = useState(true);
    const [isVerified, setIsVerified] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [orgName, setOrgName] = useState('');
    const [dynamicPrompts, setDynamicPrompts] = useState<{ label: string; prompt: string }[]>([]);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);
    const hasInitialGreetingSent = useRef(false);

    const sessionId = branchId ? getSessionId(branchId, tableNumber || 'GUEST') : '';

    /* TEMPORARILY DISABLED NFC VERIFICATION FOR TESTING
    // Verify NFC Token
    useEffect(() => {
        const verifyToken = searchParams.get('verify');
        if (!verifyToken || !branchId || !tableNumber) return;

        const checkToken = async () => {
            setIsVerifying(true);
            try {
                // Call the mcp-server directly to verify the token and update occupancy
                const { data, error } = await supabase.functions.invoke('mcp-server', {
                    body: {
                        action: 'run_mcp_tool',
                        organization_id: activeOrgId,
                        branch_id: branchId,
                        server_name: 'supabase',
                        tool_name: 'verify_nfc_tap',
                        input: {
                            token: verifyToken,
                            table_number: tableNumber,
                            session_id: sessionId
                        }
                    }
                });

                if (!error && data?.success) {
                    setIsVerified(true);
                    showToast("Table physical connection verified!", "success");
                } else {
                    console.error("NFC Verification failed:", error || data);
                }
            } catch (err) {
                console.error("Error verifying NFC tap:", err);
            } finally {
                setIsVerifying(false);
            }
        };

        checkToken();
    }, [searchParams, branchId, tableNumber, orgId, sessionId]);
    */

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
            if (!sessionId) {
                setIsHistoryLoading(false);
                return;
            }
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
                            metadata: m.metadata,
                            attachments: m.metadata?.attachments
                        }));
                    setMessages(mapped);
                    setHasInteracted(true);
                }
            } catch (e) {
                console.error('History load failed:', e);
            } finally {
                setIsHistoryLoading(false);
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
                .select('id, name, organization_id')
                .eq('id', branchId)
                .maybeSingle();
            if (data) {
                setBranchName(data.name);
                if (!activeOrgId && data.organization_id) {
                    setActiveOrgId(data.organization_id);
                }
            }
        };
        loadBranch();
    }, [branchId, activeOrgId]);

    // Initialize/Update dynamic prompts when language/defaults change
    useEffect(() => {
        if (dynamicPrompts.length === 0 || messages.length === 0) {
            setDynamicPrompts(QUICK_PROMPTS.map(p => ({ label: p.label, prompt: p.prompt })));
        }
    }, [t, messages.length]);

    // Load organization name
    useEffect(() => {
        const loadOrg = async () => {
            if (!activeOrgId) return;
            const { data } = await supabase
                .from('organizations')
                .select('name')
                .eq('id', activeOrgId)
                .maybeSingle();
            if (data) setOrgName(data.name);
        };
        loadOrg();
    }, [activeOrgId]);

    // Send message
    const handleSend = useCallback(async (overrideMessage?: string) => {
        const msg = overrideMessage || inputValue.trim();
        if (!msg) return;

        const isInit = msg === 'init_chat';
        if (!isInit) {
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
        }
        
        setIsTyping(true);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

        try {
            const { data, error } = await supabase.functions.invoke('customer-intelligence', {
                body: {
                    message: msg,
                    session_id: sessionId,
                    table_number: tableNumber || 'Guest',
                    organization_id: activeOrgId || undefined,
                    organization_name: orgName,
                    branch_id: branchId,
                    branch_name: branchName,
                    is_verified: true // HARDCODED TO TRUE FOR NOW FOR TESTING
                }
            });

            clearTimeout(timeoutId);

            if (error) throw error;

            const responseText = data?.text || '⚠️ No response. Please try again.';
            const assistantMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: responseText,
                timestamp: new Date(),
                metadata: data?.metadata,
                attachments: data?.metadata?.attachments
            };
            
            // Extract top performer items from metadata if present
            if (data?.metadata?.top_performing_items) {
                setTopItems(data.metadata.top_performing_items);
            } else if (data?.metadata?.attachments?.type === 'menu' && topItems.length === 0) {
                // Fallback: use first few items from a menu attachment if we don't have top items yet
                setTopItems((data.metadata.attachments.data || []).slice(0, 6));
            }

            setMessages(prev => [...prev, assistantMsg]);
            
            // Update dynamic prompts if metadata contains suggested buttons
            if (data?.metadata?.buttons && Array.isArray(data.metadata.buttons)) {
                setDynamicPrompts(data.metadata.buttons);
            } else if (data?.metadata?.suggested_prompts && Array.isArray(data.metadata.suggested_prompts)) {
                setDynamicPrompts(data.metadata.suggested_prompts);
            }
            
            if (isInit) {
                setHasInteracted(true);
            }
        } catch (err: any) {
            console.error('Chat error full details:', err);
            if (err.name === 'AbortError') {
                showToast("Request timed out. Please try again.", "error");
            }
            if (!isInit) {
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
    }, [inputValue, sessionId, tableNumber, activeOrgId, branchId, topItems.length, branchName, orgName]);

    // Proactive Greeting
    useEffect(() => {
        const sendGreeting = async () => {
            // Wait for core context to be ready
            if (!isHistoryLoading && sessionId && messages.length === 0 && !isTyping && !hasInitialGreetingSent.current && activeOrgId && branchName) {
                hasInitialGreetingSent.current = true;
                try {
                    await handleSend('init_chat');
                } catch (err) {
                    console.error('Initial greeting failed:', err);
                    hasInitialGreetingSent.current = false; // Allow retry if it failed early
                }
            }
        };
        sendGreeting();
    }, [sessionId, messages.length, isTyping, handleSend, isHistoryLoading, activeOrgId, branchName]);

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const hasContent = inputValue.trim().length > 0;

    return (
        <div className="w-full h-[100dvh] flex flex-col bg-background text-foreground overflow-hidden font-sans">
            {/* ─── HEADER ─── */}
            <div className="flex-none px-4 py-3 border-b border-border bg-background/60 backdrop-blur-xl safe-area-top z-50">
                <div className="max-w-2xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/30 border border-emerald-500/30 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                            <Sparkles className="w-4.5 h-4.5 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold text-foreground leading-none">
                                {orgName || branchName || 'CADE'}
                            </h1>
                            <p className="text-[10px] text-muted-foreground mt-1 font-mono uppercase tracking-[0.2em]">
                                {branchName || 'AI Assistant'} {tableNumber && tableNumber !== 'T1' ? `• Table ${tableNumber}` : ''}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <ThemeToggle />
                        <LanguageSwitcher />
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-[9px] text-emerald-400 font-black uppercase tracking-widest">{t('common.online') || 'Online'}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── PERSISTENT DISCOVERY SECTION REMOVED ─── */}

            {/* ─── SCROLLABLE CHAT AREA ─── */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto">
                <div className="max-w-2xl mx-auto px-4 pb-4">
                    {!hasInteracted && messages.length === 0 && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="pt-12 pb-8 text-center"
                        >
                            <div className="w-20 h-20 mx-auto mb-8 relative">
                                <motion.div 
                                    animate={{ 
                                        scale: [1, 1.2, 1],
                                        opacity: [0.2, 0.4, 0.2]
                                    }}
                                    transition={{ duration: 4, repeat: Infinity }}
                                    className="absolute inset-0 bg-emerald-500/30 rounded-3xl blur-2xl" 
                                />
                                <div className="relative w-20 h-20 rounded-3xl bg-card border border-border flex items-center justify-center">
                                    <UtensilsCrossed className="w-10 h-10 text-emerald-400" />
                                </div>
                            </div>
                            <h2 className="text-3xl md:text-4xl font-black text-foreground mb-3 tracking-tight">
                                Welcome to<br/>{orgName || 'our restaurant'}! 
                            </h2>
                            <div className="flex items-center justify-center gap-2 mb-6 opacity-60">
                                <div className="h-[1px] w-8 bg-border" />
                                <span className="text-[10px] font-mono tracking-[0.3em] uppercase">{branchName || 'AI Guest Experience'}</span>
                                <div className="h-[1px] w-8 bg-border" />
                            </div>
                        </motion.div>
                    )}

                    <div className={cn("space-y-6 pt-6 transition-all duration-300", (!hasInteracted && !isTyping) ? "opacity-0" : "opacity-100")}>
                        <AnimatePresence initial={false}>
                            {messages.map(msg => (
                                <MessageBubble 
                                    key={msg.id} 
                                    msg={msg} 
                                    onQuickAction={handleSend}
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
                    {dynamicPrompts.length > 0 && (
                        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
                            {dynamicPrompts.map((action, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSend(action.prompt)}
                                    className="flex-none px-4 py-2 rounded-full bg-lime-500/10 border border-lime-500/20 text-lime-600 dark:text-lime-400 text-[10px] font-bold uppercase tracking-wider hover:bg-lime-500/20 transition-all whitespace-nowrap flex items-center gap-2"
                                >
                                    {action.icon}
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    )}

                    <div className={cn(
                        "relative flex items-end rounded-3xl border transition-all duration-500",
                        "bg-input-bg border-border",
                        "focus-within:border-lime-500/40 focus-within:bg-card"
                    )}>
                        <textarea
                            ref={textareaRef}
                            value={inputValue}
                            onChange={e => setInputValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            placeholder={t('common.search') || "Ask me anything..."}
                            className="flex-1 bg-transparent border-0 outline-none text-foreground text-sm placeholder:text-muted-foreground resize-none overflow-hidden px-5 py-4 leading-relaxed"
                            rows={1}
                            style={{ minHeight: '1.5em', maxHeight: '120px' }}
                        />
                        <button
                            onClick={() => handleSend()}
                            disabled={!hasContent || isTyping}
                            className={cn(
                                "m-2 p-2.5 rounded-2xl transition-all duration-500 flex-shrink-0",
                                hasContent && !isTyping
                                    ? "bg-[#84CC16] text-white hover:bg-lime-500 hover:scale-105 active:scale-95 shadow-lg shadow-lime-500/20"
                                    : "bg-muted/10 text-muted-foreground cursor-not-allowed"
                            )}
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                    <div className="flex items-center justify-between mt-3 px-1">
                        <p className="text-[8px] text-gray-700 font-mono uppercase tracking-[0.2em]">
                            Powered by Baro AI
                        </p>
                        <div className="flex items-center gap-1 opacity-20">
                            <div className="w-1 h-1 rounded-full bg-foreground" />
                            <div className="w-1 h-1 rounded-full bg-foreground" />
                            <div className="w-1 h-1 rounded-full bg-foreground" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CustomerChatPage;
