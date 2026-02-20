import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles,
    Send,
    Zap,
    Activity,
    TrendingUp,
    AlertTriangle,
    Database,
    Loader2,
    Cpu
} from 'lucide-react';
import { Card, Input, Badge, cn } from './ui';
import { supabase } from '../supabase';

interface MasterAssistantProps {
    organizationId: string;
    branchId?: string;
}

interface ContextMetric {
    label: string;
    value: string;
    trend?: 'up' | 'down' | 'neutral';
    color: string;
}

export const MasterAssistant: React.FC<MasterAssistantProps> = ({ organizationId, branchId }) => {
    const [query, setQuery] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([]);
    const [pulseEvents, setPulseEvents] = useState<any[]>([]);
    const [pinnedContext, setPinnedContext] = useState<ContextMetric[]>([]);
    const scrollRef = useRef<HTMLDivElement>(null);

    // 1. Live Pulse Feed
    useEffect(() => {
        const channel = supabase
            .channel('intel-events')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'intelligence_events'
            }, (payload) => {
                setPulseEvents(prev => [payload.new, ...prev].slice(0, 3));
            })
            .subscribe();

        // Initial fetch of vital signs (Mocked for now, would come from views)
        setPinnedContext([
            { label: 'Revenue Risk', value: '$1,240', trend: 'down', color: 'text-red-500' },
            { label: 'Avg Margin', value: '68%', trend: 'up', color: 'text-green-500' },
            { label: 'Active Alerts', value: '3', color: 'text-yellow-500' },
        ]);

        return () => { channel.unsubscribe(); };
    }, []);

    // Auto-scroll
    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!query.trim()) return;

        const userMsg = query;
        setQuery('');
        setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
        setIsTyping(true);

        try {
            const { data, error } = await supabase.functions.invoke('master-intelligence', {
                body: {
                    action: 'chat',
                    organization_id: organizationId,
                    branch_id: branchId,
                    payload: { question: userMsg }
                }
            });

            if (error) throw error;
            if (data && data.error) throw new Error(data.error); // Catch function-returned errors

            if (data && data.text) {
                setMessages(prev => [...prev, { role: 'assistant', content: data.text }]);
            } else if (data && data.content) {
                // Handle alternative response format (e.g. from Google Generative AI directly)
                setMessages(prev => [...prev, { role: 'assistant', content: data.content }]);
            } else {
                console.error("Master Intelligence Response:", data);
                setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ System Core Error: Received empty response from neural net." }]);
            }
        } catch (err: any) {
            console.error("Master Assistant Error:", err);
            setMessages(prev => [...prev, { role: 'assistant', content: `❌ Connection Refused: ${err.message || "Unknown Error"}. Please check function deployment.` }]);
        } finally {
            setIsTyping(false);
        }
    };

    return (
        <div className="w-full h-[600px] flex gap-6">
            {/* 1. Main Chat Interface (The "Brain") */}
            <Card className="flex-1 bg-[#0a0a0a] border-gray-800 flex flex-col overflow-hidden relative shadow-2xl">
                {/* Header */}
                <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/40 backdrop-blur-md">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center relative">
                            <div className="absolute inset-0 bg-primary/20 rounded-full animate-ping" />
                            <Sparkles className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                            <h3 className="font-black text-white tracking-tight leading-none">BARO INTELLIGENCE</h3>
                            <span className="text-[10px] text-gray-500 font-mono uppercase">Unified Neural Backbone</span>
                        </div>
                    </div>
                    <Badge className="bg-white/5 text-gray-400 hover:bg-white/10 uppercase font-mono text-[9px] tracking-widest">
                        v2026.1
                    </Badge>
                </div>

                {/* Messages Area */}
                <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-hide">
                    {messages.length === 0 && (
                        <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-50">
                            <Cpu className="w-12 h-12 text-gray-700" />
                            <p className="text-gray-500 font-mono text-sm max-w-xs">
                                "Ask me about margins, stock risks, or staff performance. I see everything."
                            </p>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={cn(
                                "flex gap-4 max-w-[90%]",
                                msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                            )}
                        >
                            <div className={cn(
                                "w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center mt-1",
                                msg.role === 'user' ? "bg-white/10" : "bg-primary/10"
                            )}>
                                {msg.role === 'user' ? <div className="w-2 h-2 bg-white rounded-full" /> : <Sparkles className="w-4 h-4 text-primary" />}
                            </div>
                            <div className={cn(
                                "p-4 rounded-2xl text-sm leading-relaxed",
                                msg.role === 'user'
                                    ? "bg-white/5 text-white rounded-tr-none border border-white/10"
                                    : "bg-primary/5 text-gray-200 rounded-tl-none border border-primary/10"
                            )}>
                                {msg.content}
                            </div>
                        </motion.div>
                    ))}

                    {isTyping && (
                        <div className="flex items-center gap-2 text-primary/50 text-xs font-mono ml-12 animate-pulse">
                            <Loader2 className="w-3 h-3 animate-spin" /> ACCESSING TRUTH VIEWS...
                        </div>
                    )}
                </div>

                {/* Input Area */}
                <div className="p-4 bg-black/40 backdrop-blur-md border-t border-white/5">
                    <div className="relative">
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                            placeholder="Command the neural core..."
                            className="w-full pl-4 pr-12 py-6 bg-[#111] border-gray-800 focus:border-primary/50 text-white placeholder:text-gray-700 font-medium rounded-xl"
                        />
                        <button
                            onClick={handleSend}
                            className="absolute right-2 top-1/2 -translate-y-1/2 p-2 hover:bg-primary/10 rounded-lg text-primary transition-colors"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </Card>

            {/* 2. Pinned Context Sidebar (The "Truth") */}
            <div className="w-72 space-y-6">
                {/* Vital Signs Card */}
                <Card className="bg-[#0a0a0a] border-gray-800 p-5 space-y-4 shadow-xl">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Activity className="w-3 h-3 text-primary" /> Live Vitals
                        </h4>
                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    </div>

                    <div className="space-y-3">
                        {pinnedContext.map((metric, i) => (
                            <div key={i} className="flex items-center justify-between group cursor-default">
                                <span className="text-xs text-gray-500 group-hover:text-gray-300 transition-colors">{metric.label}</span>
                                <span className={cn("text-sm font-bold font-mono", metric.color)}>{metric.value}</span>
                            </div>
                        ))}
                    </div>
                </Card>

                {/* Pulse Feed Card */}
                <Card className="bg-[#0a0a0a] border-gray-800 p-5 space-y-4 shadow-xl flex-1 min-h-[200px]">
                    <div className="flex items-center justify-between">
                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Zap className="w-3 h-3 text-yellow-500" /> Pulse Events
                        </h4>
                    </div>

                    <div className="space-y-3">
                        {pulseEvents.length === 0 ? (
                            <div className="text-center py-8 opacity-30">
                                <Database className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                                <span className="text-[10px] text-gray-500 font-mono uppercase">No recent events</span>
                            </div>
                        ) : pulseEvents.map((event) => (
                            <motion.div
                                key={event.id}
                                initial={{ opacity: 0, x: -10 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="bg-white/5 border border-white/5 p-3 rounded-xl"
                            >
                                <div className="flex justify-between items-start mb-1">
                                    <Badge className="text-[9px] px-1 py-0 h-4 bg-primary/20 text-primary hover:bg-primary/20 border-none">
                                        {event.event_type}
                                    </Badge>
                                    <span className="text-[9px] text-gray-600 font-mono">NOW</span>
                                </div>
                                <p className="text-[10px] text-gray-400 font-medium leading-tight line-clamp-2 mt-2">
                                    {event.payload?.ingredient_id ? `Stock alert for item ${event.payload.ingredient_id.slice(0, 4)}...` : 'System anomaly detected.'}
                                </p>
                            </motion.div>
                        ))}
                    </div>
                </Card>
            </div>
        </div>
    );
};
