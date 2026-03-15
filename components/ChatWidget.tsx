import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MessageCircle, X, Send, Loader2, Sparkles, ArrowUp } from 'lucide-react';
import { cn } from './ui';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { useBranch } from '../contexts/BranchContext';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
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
                    table_number: tableFromUrl,
                    organization_id: organizationId,
                    branch_id: branchId,
                },
            });

            if (error) throw error;

            const assistantMsg: ChatMessage = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: data?.text || '⚠️ No response.',
                timestamp: new Date(),
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
    }, [inputValue, sessionId, tableFromUrl, organizationId, branchId]);

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
                        className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-black shadow-xl shadow-amber-500/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
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
                        className="fixed bottom-5 right-5 z-50 w-[360px] h-[520px] md:w-[400px] md:h-[560px] bg-[#0a0a0a] border border-white/[0.08] rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06] bg-black/40">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-emerald-600/30 border border-emerald-500/30 flex items-center justify-center">
                                    <Sparkles className="w-4 h-4 text-emerald-400" />
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold text-white">Restaurant Assistant</h3>
                                    <span className="text-[9px] text-emerald-400 font-mono">● Online</span>
                                </div>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-500 hover:text-white transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Messages */}
                        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                            {messages.length === 0 && (
                                <div className="h-full flex flex-col items-center justify-center text-center opacity-50">
                                    <Sparkles className="w-8 h-8 text-emerald-500/50 mb-3" />
                                    <p className="text-xs text-gray-500 max-w-[200px]">
                                        Hi! Ask me about our menu, place an order, or get your bill.
                                    </p>
                                </div>
                            )}

                            {messages.map(msg => (
                                <div
                                    key={msg.id}
                                    className={cn(
                                        "flex gap-2 max-w-[85%]",
                                        msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                                    )}
                                >
                                    <div className={cn(
                                        "px-3 py-2 rounded-xl text-xs leading-relaxed",
                                        msg.role === 'user'
                                            ? "bg-amber-500 text-black rounded-tr-sm"
                                            : "bg-[#1a1a1a] text-gray-300 rounded-tl-sm border border-white/[0.06]"
                                    )}>
                                        <div className="whitespace-pre-wrap">{msg.content}</div>
                                    </div>
                                </div>
                            ))}

                            {isTyping && (
                                <div className="flex items-center gap-2">
                                    <div className="bg-[#1a1a1a] border border-white/[0.06] rounded-xl px-3 py-2">
                                        <Loader2 className="w-3 h-3 text-emerald-400 animate-spin" />
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div className="p-3 border-t border-white/[0.06] bg-black/30">
                            <div className="flex items-center gap-2">
                                <input
                                    ref={inputRef}
                                    value={inputValue}
                                    onChange={e => setInputValue(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && handleSend()}
                                    placeholder="Type a message..."
                                    className="flex-1 bg-[#111] border border-white/[0.08] rounded-xl px-3 py-2.5 text-xs text-white placeholder:text-gray-600 outline-none focus:border-emerald-500/30"
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={!inputValue.trim()}
                                    className={cn(
                                        "p-2 rounded-xl transition-all",
                                        inputValue.trim()
                                            ? "bg-emerald-500 text-white hover:bg-emerald-400 active:scale-95"
                                            : "bg-white/5 text-gray-600"
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
