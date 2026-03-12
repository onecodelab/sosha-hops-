import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Plus, ChevronDown, ArrowUp, X, FileText, Loader2, Check,
    Archive, Sparkles, Activity, Zap, TrendingUp, TrendingDown,
    AlertTriangle, Package, BarChart3, UtensilsCrossed, Receipt,
    Users, DollarSign, Clock, ShieldCheck, Bot, Send, Cpu,
    ChefHat, Store, Boxes, Brain
} from 'lucide-react';
import { cn, Badge, Button, showToast } from './ui';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { useBranch } from '../contexts/BranchContext';

/* ─── TYPES ─── */
interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    isStreaming?: boolean;
    metadata?: {
        type?: 'insight' | 'alert' | 'summary' | 'action';
        branches?: string[];
    };
}

interface AttachedFile {
    id: string;
    file: File;
    type: string;
    preview: string | null;
    uploadStatus: string;
}

interface BranchSnapshot {
    id: string;
    name: string;
    todayRevenue: number;
    todayOrders: number;
    activeAlerts: number;
    avgMargin: number;
    topDish: string;
    pendingOrders: number;
    lowStockItems: number;
}

interface ContextMetric {
    label: string;
    value: string;
    trend?: 'up' | 'down' | 'neutral';
    color: string;
    icon: React.ReactNode;
}

/* ─── QUICK ACTION CHIPS ─── */
const QUICK_ACTIONS = [
    { label: 'Business Overview', icon: <BarChart3 className="w-3.5 h-3.5" />, prompt: 'Give me a complete business overview across all branches right now.' },
    { label: 'Inventory Check', icon: <Boxes className="w-3.5 h-3.5" />, prompt: 'What items are running low in inventory? Show me critical stock levels for all branches.' },
    { label: 'Revenue Today', icon: <DollarSign className="w-3.5 h-3.5" />, prompt: 'How much revenue have we made today across all branches? Break it down.' },
    { label: 'Menu Performance', icon: <UtensilsCrossed className="w-3.5 h-3.5" />, prompt: 'Which dishes are performing best and worst? Any items I should consider removing?' },
    { label: 'Staff Status', icon: <Users className="w-3.5 h-3.5" />, prompt: 'Who is currently clocked in? Any staffing concerns for today?' },
    { label: 'Pending Actions', icon: <Clock className="w-3.5 h-3.5" />, prompt: 'What needs my immediate attention? Show me all pending approvals and alerts.' },
];

/* ─── UTILS ─── */
const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const getTimeGreeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
};

/* ─── FILE PREVIEW CARD ─── */
const FilePreviewCard: React.FC<{ file: AttachedFile; onRemove: (id: string) => void }> = ({ file, onRemove }) => {
    const isImage = file.type.startsWith('image/') && file.preview;
    return (
        <div className="relative group flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden border border-gray-700/50 bg-[#151515] transition-all hover:border-primary/40">
            {isImage ? (
                <img src={file.preview!} alt={file.file.name} className="w-full h-full object-cover" />
            ) : (
                <div className="w-full h-full p-2.5 flex flex-col justify-between">
                    <FileText className="w-4 h-4 text-gray-500" />
                    <div>
                        <p className="text-[10px] text-gray-300 truncate">{file.file.name}</p>
                        <p className="text-[9px] text-gray-600">{formatFileSize(file.file.size)}</p>
                    </div>
                </div>
            )}
            <button
                onClick={() => onRemove(file.id)}
                className="absolute top-1 right-1 p-0.5 bg-black/60 hover:bg-black/80 rounded-full text-white opacity-0 group-hover:opacity-100 transition-opacity"
            >
                <X className="w-3 h-3" />
            </button>
            {file.uploadStatus === 'uploading' && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                </div>
            )}
        </div>
    );
};

/* ─── BRANCH SNAPSHOT CARD ─── */
const BranchSnapshotCard: React.FC<{ snapshot: BranchSnapshot }> = ({ snapshot }) => (
    <div className="bg-[#111]/80 border border-gray-800/60 rounded-xl p-4 hover:border-primary/20 transition-all group">
        <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">{snapshot.name}</h4>
            </div>
            {snapshot.activeAlerts > 0 && (
                <Badge className="bg-red-500/20 text-red-400 text-[9px] px-1.5 py-0 h-4 border-none">
                    {snapshot.activeAlerts} alerts
                </Badge>
            )}
        </div>
        <div className="grid grid-cols-2 gap-3">
            <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest">Revenue</p>
                <p className="text-sm font-bold text-primary">ETB {snapshot.todayRevenue.toLocaleString()}</p>
            </div>
            <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest">Orders</p>
                <p className="text-sm font-bold text-white">{snapshot.todayOrders}</p>
            </div>
            <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest">Margin</p>
                <p className={cn("text-sm font-bold", snapshot.avgMargin >= 60 ? "text-green-400" : "text-red-400")}>
                    {snapshot.avgMargin}%
                </p>
            </div>
            <div>
                <p className="text-[9px] text-gray-500 uppercase tracking-widest">Low Stock</p>
                <p className={cn("text-sm font-bold", snapshot.lowStockItems > 0 ? "text-red-400" : "text-green-400")}>
                    {snapshot.lowStockItems} items
                </p>
            </div>
        </div>
        {snapshot.topDish && (
            <div className="mt-3 pt-3 border-t border-white/5">
                <p className="text-[9px] text-gray-500 uppercase tracking-widest">Top Performer</p>
                <p className="text-xs text-gray-300 font-medium mt-0.5">{snapshot.topDish}</p>
            </div>
        )}
    </div>
);

/* ─── MAIN COMPONENT ─── */
export const BaroCommandChat: React.FC = () => {
    const { profile, organizationId } = useAuth();
    const { branches, activeBranchId } = useBranch();
    const ownerName = profile?.full_name?.split(' ')[0] || profile?.email?.split('@')[0] || 'Boss';

    // State
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputValue, setInputValue] = useState('');
    const [files, setFiles] = useState<AttachedFile[]>([]);
    const [isTyping, setIsTyping] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [branchSnapshots, setBranchSnapshots] = useState<BranchSnapshot[]>([]);
    const [liveMetrics, setLiveMetrics] = useState<ContextMetric[]>([]);
    const [isSnapshotLoading, setIsSnapshotLoading] = useState(true);
    const [hasInteracted, setHasInteracted] = useState(false);

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
        }
    }, [inputValue]);

    // Auto-scroll on new messages
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
        }
    }, [messages, isTyping]);

    // Fetch branch snapshots on mount
    useEffect(() => {
        const loadSnapshots = async () => {
            setIsSnapshotLoading(true);
            try {
                const snapshots: BranchSnapshot[] = [];
                for (const branch of branches) {
                    // Fetch today's orders
                    const today = new Date().toISOString().split('T')[0];
                    const { data: orders } = await supabase
                        .from('orders')
                        .select('total_amount, status')
                        .eq('branch_id', branch.id)
                        .gte('created_at', today + 'T00:00:00')
                        .lte('created_at', today + 'T23:59:59');

                    const totalRevenue = (orders || [])
                        .filter(o => o.status !== 'cancelled')
                        .reduce((sum, o) => sum + (o.total_amount || 0), 0);
                    const orderCount = (orders || []).filter(o => o.status !== 'cancelled').length;
                    const pendingCount = (orders || []).filter(o => o.status === 'pending' || o.status === 'preparing').length;

                    // Fetch low stock items
                    const { data: lowStock } = await supabase
                        .from('ingredients')
                        .select('id')
                        .lte('current_stock', supabase.rpc ? 0 : 5); // simplified - check par_min

                    // Fetch top dish
                    const { data: topDishes } = await supabase
                        .from('order_items')
                        .select('quantity, menu_item:menu_items(name)')
                        .eq('branch_id', branch.id)
                        .gte('created_at', today + 'T00:00:00')
                        .limit(100);

                    let topDishName = 'N/A';
                    // Simple top dish calculation
                    const dishCounts: Record<string, number> = {};
                    if (topDishes) {
                        for (const order of topDishes) {
                            const items = (order as any).items || [];
                            for (const item of items) {
                                const name = item?.menu_item?.name;
                                if (name) {
                                    dishCounts[name] = (dishCounts[name] || 0) + (item.quantity || 1);
                                }
                            }
                        }
                        const sorted = Object.entries(dishCounts).sort(([, a], [, b]) => b - a);
                        if (sorted.length > 0) topDishName = `${sorted[0][0]} (${sorted[0][1]} sold)`;
                    }

                    snapshots.push({
                        id: branch.id,
                        name: branch.name,
                        todayRevenue: totalRevenue,
                        todayOrders: orderCount,
                        activeAlerts: 0,
                        avgMargin: 74, // Stabilized placeholder
                        topDish: topDishName,
                        pendingOrders: pendingCount,
                        lowStockItems: lowStock?.length || 0,
                    });
                }
                setBranchSnapshots(snapshots);

                // Calculate org-wide metrics
                const totalRev = snapshots.reduce((s, b) => s + b.todayRevenue, 0);
                const totalOrders = snapshots.reduce((s, b) => s + b.todayOrders, 0);
                const totalAlerts = snapshots.reduce((s, b) => s + b.activeAlerts, 0);
                const avgMargin = snapshots.length > 0
                    ? Math.round(snapshots.reduce((s, b) => s + b.avgMargin, 0) / snapshots.length) : 0;
                const totalLowStock = snapshots.reduce((s, b) => s + b.lowStockItems, 0);

                setLiveMetrics([
                    { label: 'Today Revenue', value: `ETB ${totalRev.toLocaleString()}`, trend: 'up', color: 'text-primary', icon: <DollarSign className="w-3 h-3" /> },
                    { label: 'Total Orders', value: `${totalOrders}`, trend: 'up', color: 'text-blue-400', icon: <Receipt className="w-3 h-3" /> },
                    { label: 'Avg Margin', value: `${avgMargin}%`, trend: avgMargin >= 60 ? 'up' : 'down', color: avgMargin >= 60 ? 'text-green-400' : 'text-red-400', icon: <TrendingUp className="w-3 h-3" /> },
                    { label: 'Low Stock', value: `${totalLowStock}`, color: totalLowStock > 0 ? 'text-red-400' : 'text-green-400', icon: <Package className="w-3 h-3" /> },
                    { label: 'Active Alerts', value: `${totalAlerts}`, color: totalAlerts > 0 ? 'text-red-400' : 'text-green-400', icon: <AlertTriangle className="w-3 h-3" /> },
                ]);
            } catch (err) {
                console.error('Snapshot load error:', err);
            } finally {
                setIsSnapshotLoading(false);
            }
        };

        if (branches.length > 0) {
            loadSnapshots();
        } else {
            setIsSnapshotLoading(false);
        }
    }, [branches]);

    // File handling
    const handleFiles = useCallback((newFilesList: FileList | File[]) => {
        const newFiles = Array.from(newFilesList).map(file => ({
            id: Math.random().toString(36).substr(2, 9),
            file,
            type: file.type.startsWith('image/') ? 'image/unknown' : (file.type || 'application/octet-stream'),
            preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
            uploadStatus: 'pending',
        }));
        setFiles(prev => [...prev, ...newFiles]);
        newFiles.forEach(f => {
            setTimeout(() => {
                setFiles(prev => prev.map(p => p.id === f.id ? { ...p, uploadStatus: 'complete' } : p));
            }, 600 + Math.random() * 800);
        });
    }, []);

    // Drag & drop
    const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const onDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const onDrop = (e: React.DragEvent) => {
        e.preventDefault(); setIsDragging(false);
        if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
    };

    // Send message
    const handleSend = async (overrideMessage?: string) => {
        const msg = overrideMessage || inputValue.trim();
        if (!msg && files.length === 0) return;

        setHasInteracted(true);
        const userMsg: ChatMessage = {
            id: Math.random().toString(36).substr(2, 9),
            role: 'user',
            content: msg,
            timestamp: new Date(),
        };
        setMessages(prev => [...prev, userMsg]);

        // Capture files for processing before clearing state
        const attachedFiles = [...files];

        setInputValue('');
        setFiles([]);
        if (textareaRef.current) textareaRef.current.style.height = 'auto';

        setIsTyping(true);

        try {
            // Convert files to base64 if any
            const processedFiles = await Promise.all(attachedFiles.map(async (f) => {
                return new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        resolve({
                            name: f.file.name,
                            type: f.file.type,
                            data: (reader.result as string).split(',')[1] // Get base64 part
                        });
                    };
                    reader.readAsDataURL(f.file);
                });
            }));

            // Build context for the AI
            const branchContext = branchSnapshots.map(b =>
                `Branch "${b.name}": Revenue ETB ${b.todayRevenue}, ${b.todayOrders} orders, ${b.avgMargin}% margin, ${b.lowStockItems} low stock items, Top dish: ${b.topDish}`
            ).join('\n');

            const { data, error } = await supabase.functions.invoke('master-intelligence', {
                body: {
                    action: 'chat',
                    organization_id: organizationId,
                    branch_id: activeBranchId,
                    payload: {
                        question: msg,
                        owner_name: ownerName,
                        branch_context: branchContext,
                        all_branches: true,
                        attachments: processedFiles
                    }
                }
            });

            if (error) throw error;

            const responseText = data?.text || data?.content || '⚠️ No response from intelligence core.';

            const assistantMsg: ChatMessage = {
                id: Math.random().toString(36).substr(2, 9),
                role: 'assistant',
                content: responseText,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, assistantMsg]);
        } catch (err: any) {
            console.error('Chat error:', err);

            // Try to extract a more specific error message if available
            let errorMessage = err.message || 'Unknown error';

            // Supabase FunctionsHttpError often has context with more details
            if (err.context && typeof err.context === 'object') {
                try {
                    const errorText = await err.context.text();
                    if (errorText) {
                        const parsedError = JSON.parse(errorText);
                        errorMessage = parsedError.error || parsedError.message || errorMessage;
                    }
                } catch (e) {
                    // Ignore parsing errors and stick with the original message
                }
            }

            const errorMsg: ChatMessage = {
                id: Math.random().toString(36).substr(2, 9),
                role: 'assistant',
                content: `❌ Error: ${errorMessage}. Please check your AI configuration or try again.`,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsTyping(false);
        }
    };

    const handleCreateProposal = async (content: string) => {
        try {
            // Extract JSON from content (it might be wrapped in text or backticks)
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                showToast("No structured proposal data found in message.", "error");
                return;
            }

            const proposalData = JSON.parse(jsonMatch[0]);

            showToast("Generating formal proposal...", "success");

            const { data, error } = await supabase.functions.invoke('master-intelligence', {
                body: {
                    action: 'create_proposal',
                    organization_id: organizationId,
                    branch_id: activeBranchId,
                    payload: {
                        proposal_data: proposalData
                    }
                }
            });

            if (error) throw error;

            showToast("Proposal created successfully! View it in 'Agent Proposals' tab.", "success");
        } catch (err: any) {
            console.error('Proposal creation error:', err);
            showToast(`Failed to create proposal: ${err.message}`, "error");
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const hasContent = inputValue.trim() || files.length > 0;

    return (
        <div className="w-full h-full flex flex-col" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>

            {/* ─── SCROLLABLE AREA: GREETING + MESSAGES ─── */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="max-w-4xl mx-auto px-4 md:px-8 pb-4">

                    {/* ─── GREETING HERO (shown when no messages) ─── */}
                    {!hasInteracted && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, ease: [0.2, 0, 0, 1] }}
                            className="pt-8 md:pt-16 pb-6"
                        >
                            {/* Avatar & Greeting */}
                            <div className="text-center mb-8">
                                <div className="w-16 h-16 mx-auto mb-5 relative">
                                    <div className="absolute inset-0 bg-primary/20 rounded-2xl animate-pulse-slow blur-xl" />
                                    <div className="relative w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center backdrop-blur-sm">
                                        <Brain className="w-8 h-8 text-primary" />
                                    </div>
                                </div>
                                <h1 className="text-3xl md:text-4xl font-light text-white mb-2 tracking-tight">
                                    {getTimeGreeting()},{' '}
                                    <span className="relative inline-block font-semibold">
                                        {ownerName}
                                        <svg
                                            className="absolute w-[130%] h-[14px] -bottom-1 -left-[15%] text-primary/60"
                                            viewBox="0 0 140 20" fill="none" preserveAspectRatio="none" aria-hidden="true"
                                        >
                                            <path d="M6 14 Q 70 22, 134 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                                        </svg>
                                    </span>
                                </h1>
                                <p className="text-sm text-gray-500 font-mono uppercase tracking-widest">
                                    Baro Intelligence • All Branches • Real-time
                                </p>
                            </div>

                            {/* ─── BRANCH SNAPSHOTS ─── */}
                            {isSnapshotLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-5 h-5 text-primary animate-spin mr-3" />
                                    <span className="text-xs text-gray-500 font-mono uppercase tracking-widest">Loading branch intelligence...</span>
                                </div>
                            ) : branchSnapshots.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2, duration: 0.5 }}
                                    className="mb-8"
                                >
                                    <div className="flex items-center gap-2 mb-4">
                                        <Store className="w-3.5 h-3.5 text-primary" />
                                        <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Branch Overview</span>
                                    </div>
                                    <div className={cn(
                                        "grid gap-4",
                                        branchSnapshots.length === 1 ? "grid-cols-1 max-w-md" :
                                            branchSnapshots.length === 2 ? "grid-cols-1 md:grid-cols-2" :
                                                "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
                                    )}>
                                        {branchSnapshots.map(snap => (
                                            <BranchSnapshotCard key={snap.id} snapshot={snap} />
                                        ))}
                                    </div>
                                </motion.div>
                            )}

                            {/* ─── LIVE KPI BAR ─── */}
                            {liveMetrics.length > 0 && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.3, duration: 0.5 }}
                                    className="flex flex-wrap gap-3 justify-center mb-10"
                                >
                                    {liveMetrics.map((metric, i) => (
                                        <div key={i} className="flex items-center gap-2 bg-[#111]/60 border border-gray-800/50 rounded-lg px-3 py-2">
                                            <span className={cn("opacity-60", metric.color)}>{metric.icon}</span>
                                            <span className="text-[10px] text-gray-500 uppercase tracking-wider">{metric.label}</span>
                                            <span className={cn("text-xs font-bold font-mono", metric.color)}>{metric.value}</span>
                                            {metric.trend === 'up' && <TrendingUp className="w-3 h-3 text-green-500" />}
                                            {metric.trend === 'down' && <TrendingDown className="w-3 h-3 text-red-500" />}
                                        </div>
                                    ))}
                                </motion.div>
                            )}

                            {/* ─── QUICK ACTIONS ─── */}
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.4, duration: 0.5 }}
                                className="flex flex-wrap justify-center gap-2"
                            >
                                {QUICK_ACTIONS.map((action, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleSend(action.prompt)}
                                        className="inline-flex items-center gap-2 px-3.5 py-2 text-xs text-gray-400 bg-transparent border border-gray-800/60 rounded-full hover:bg-primary/5 hover:border-primary/30 hover:text-primary transition-all duration-200 group"
                                    >
                                        <span className="opacity-50 group-hover:opacity-100 transition-opacity">{action.icon}</span>
                                        {action.label}
                                    </button>
                                ))}
                            </motion.div>
                        </motion.div>
                    )}

                    {/* ─── CHAT MESSAGES ─── */}
                    {hasInteracted && (
                        <div className="pt-6 space-y-6">
                            <AnimatePresence initial={false}>
                                {messages.map((msg) => (
                                    <motion.div
                                        key={msg.id}
                                        initial={{ opacity: 0, y: 12 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
                                        className={cn("flex gap-3 max-w-[92%]", msg.role === 'user' ? "ml-auto flex-row-reverse" : "")}
                                    >
                                        {/* Avatar */}
                                        <div className={cn(
                                            "w-8 h-8 rounded-xl flex-shrink-0 flex items-center justify-center mt-1 border",
                                            msg.role === 'user'
                                                ? "bg-white/5 border-white/10"
                                                : "bg-primary/10 border-primary/20"
                                        )}>
                                            {msg.role === 'user'
                                                ? <div className="w-3 h-3 rounded-full bg-gradient-to-br from-white/80 to-white/40" />
                                                : <Brain className="w-4 h-4 text-primary" />}
                                        </div>

                                        {/* Message Bubble */}
                                        <div className={cn(
                                            "px-4 py-3 rounded-2xl text-sm leading-relaxed",
                                            msg.role === 'user'
                                                ? "bg-white/5 text-white rounded-tr-md border border-white/10"
                                                : "bg-[#111]/80 text-gray-200 rounded-tl-md border border-gray-800/50"
                                        )}>
                                            <div className="whitespace-pre-wrap">{msg.content}</div>

                                            {/* Actionable Suggestion Detection */}
                                            {!isTyping && msg.role === 'assistant' && msg.content.includes('{') && (
                                                <div className="mt-4 pt-4 border-t border-white/5">
                                                    <div className="flex items-center gap-2 mb-3">
                                                        <Sparkles className="w-3 h-3 text-primary" />
                                                        <span className="text-[10px] font-black text-primary uppercase tracking-widest">Actionable Intelligence</span>
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        className="w-full bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 h-9 rounded-xl text-[10px] font-black uppercase tracking-widest"
                                                        onClick={() => handleCreateProposal(msg.content)}
                                                    >
                                                        Review & Create Proposal
                                                    </Button>
                                                </div>
                                            )}

                                            <p className={cn(
                                                "text-[9px] mt-2 font-mono uppercase tracking-widest",
                                                msg.role === 'user' ? "text-gray-600 text-right" : "text-gray-600"
                                            )}>
                                                {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    </motion.div>
                                ))}
                            </AnimatePresence>

                            {/* Typing Indicator */}
                            {isTyping && (
                                <motion.div
                                    initial={{ opacity: 0, y: 8 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="flex items-center gap-3"
                                >
                                    <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                                        <Brain className="w-4 h-4 text-primary animate-pulse" />
                                    </div>
                                    <div className="bg-[#111]/80 border border-gray-800/50 rounded-2xl rounded-tl-md px-4 py-3">
                                        <div className="flex items-center gap-2 text-xs text-primary/60 font-mono uppercase tracking-widest">
                                            <Loader2 className="w-3 h-3 animate-spin" />
                                            <span className="baro-typing-text">Analyzing your business data...</span>
                                        </div>
                                    </div>
                                </motion.div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* ─── INPUT AREA (Pinned Bottom) ─── */}
            <div className="flex-none px-4 md:px-8 pb-4 pt-2">
                <div className="max-w-4xl mx-auto">
                    <div className={cn(
                        "relative flex flex-col rounded-2xl border transition-all duration-200 cursor-text",
                        "bg-[#0d0d0d] border-gray-800/60",
                        "shadow-[0_-4px_30px_rgba(0,0,0,0.3)]",
                        "hover:border-gray-700/60",
                        "focus-within:border-primary/30 focus-within:shadow-[0_-4px_30px_rgba(255,184,0,0.08)]",
                        isDragging && "border-primary/50 bg-primary/5"
                    )}>
                        {/* File previews */}
                        {files.length > 0 && (
                            <div className="flex gap-2 px-4 pt-3 overflow-x-auto custom-scrollbar">
                                {files.map(f => (
                                    <FilePreviewCard key={f.id} file={f} onRemove={id => setFiles(prev => prev.filter(fi => fi.id !== id))} />
                                ))}
                            </div>
                        )}

                        {/* Textarea */}
                        <div className="px-4 pt-3 pb-2">
                            <textarea
                                ref={textareaRef}
                                value={inputValue}
                                onChange={e => setInputValue(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder={hasInteracted ? "Ask about your business..." : `Ask me anything about your restaurant, ${ownerName}...`}
                                className="w-full bg-transparent border-0 outline-none text-white text-[15px] placeholder:text-gray-600 resize-none overflow-hidden leading-relaxed font-normal"
                                rows={1}
                                autoFocus
                                style={{ minHeight: '1.5em', maxHeight: '200px' }}
                            />
                        </div>

                        {/* Action Bar */}
                        <div className="flex items-center justify-between px-3 pb-3">
                            <div className="flex items-center gap-1">
                                {/* Attach Button */}
                                <button
                                    onClick={() => fileInputRef.current?.click()}
                                    className="p-2 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors"
                                    aria-label="Attach file"
                                >
                                    <Plus className="w-5 h-5" />
                                </button>

                                {/* Branch indicator */}
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/5">
                                    <Store className="w-3 h-3 text-gray-500" />
                                    <span className="text-[10px] text-gray-500 font-mono uppercase tracking-wider">
                                        All Branches
                                    </span>
                                </div>
                            </div>

                            {/* Right side: Model + Send */}
                            <div className="flex items-center gap-2">
                                <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-gray-500 hover:bg-white/5 transition-colors cursor-pointer">
                                    <Cpu className="w-3 h-3" />
                                    <span className="text-[10px] font-mono uppercase tracking-wider">Baro AI</span>
                                </div>

                                <button
                                    onClick={() => handleSend()}
                                    disabled={!hasContent}
                                    className={cn(
                                        "p-2 rounded-xl transition-all duration-200",
                                        hasContent
                                            ? "bg-primary text-black hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-95"
                                            : "bg-gray-800/40 text-gray-600 cursor-default"
                                    )}
                                    aria-label="Send message"
                                >
                                    <ArrowUp className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Drag overlay */}
                    {isDragging && (
                        <div className="absolute inset-0 bg-black/80 border-2 border-dashed border-primary rounded-2xl z-50 flex flex-col items-center justify-center backdrop-blur-sm pointer-events-none">
                            <Archive className="w-8 h-8 text-primary mb-2 animate-bounce" />
                            <p className="text-primary font-medium text-sm">Drop files to upload</p>
                        </div>
                    )}

                    {/* Hidden file input */}
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={e => {
                            if (e.target.files) handleFiles(e.target.files);
                            e.target.value = '';
                        }}
                    />

                    <p className="text-center text-[10px] text-gray-600 mt-3 font-mono">
                        AI-powered insights from your restaurant data • Baro Intelligence v2026.1
                    </p>
                </div>
            </div>
        </div>
    );
};

export default BaroCommandChat;
