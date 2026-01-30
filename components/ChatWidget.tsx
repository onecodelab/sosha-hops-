
import React, { useState, useRef, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { MessageSquare, X, Send, Bot, Sparkles, User, ChevronDown, ArrowRight, Zap, Box, FileText } from 'lucide-react';
import { cn } from './ui';

// --- Types ---
interface Message {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
}

// --- Configuration ---
const FLOWISE_API_URL = "http://localhost:3000/api/v1/prediction/ff2d46d5-8a02-4705-92e8-d4b535f6efe2";

export const ChatWidget: React.FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [view, setView] = useState<'intro' | 'chat'>('intro'); // 'intro' or 'chat'
    const [messages, setMessages] = useState<Message[]>([
        {
            id: 'welcome',
            role: 'assistant',
            content: "Welcome to Sosha OS. System ready. How can I assist you with your operations today?",
            timestamp: new Date()
        }
    ]);
    const [inputValue, setInputValue] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Auto-scroll to bottom
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen, view]);

    // Handle Send
    const handleSend = async (text: string = inputValue) => {
        const contentToSend = text.trim();
        if (!contentToSend) return;

        // If in intro mode, switch to chat
        if (view === 'intro') {
            setView('chat');
        }

        const userMsg: Message = {
            id: crypto.randomUUID(),
            role: 'user',
            content: contentToSend,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMsg]);
        setInputValue('');
        setIsLoading(true);

        try {
            const response = await fetch(FLOWISE_API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    question: userMsg.content
                })
            });

            const data = await response.json();
            const botResponseText = typeof data === 'object' ? (data.text || JSON.stringify(data)) : data;

            const botMsg: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: botResponseText,
                timestamp: new Date()
            };

            setMessages(prev => [...prev, botMsg]);
        } catch (error) {
            console.error("Chat error:", error);
            const errorMsg: Message = {
                id: crypto.randomUUID(),
                role: 'assistant',
                content: "⚠️ Connection to Sosha AI lost. Please check if the Flowise server is running on port 3000.",
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const startChat = () => {
        setView('chat');
    };

    // Reset view when closing
    useEffect(() => {
        if (!isOpen) {
            // Optional: Reset to intro after a delay or keep state? 
            // setView('intro'); 
        }
    }, [isOpen]);

    return (
        <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end pointer-events-none">

            {/* Chat Window */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="pointer-events-auto mb-4 w-[380px] h-[600px] max-h-[80vh] flex flex-col rounded-3xl overflow-hidden shadow-2xl border border-white/10 backdrop-blur-xl bg-black/90 ring-1 ring-white/5"
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5 absolute top-0 left-0 right-0 z-10 glass-panel">
                            <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-yellow-600 to-yellow-400 flex items-center justify-center shadow-lg shadow-yellow-500/20">
                                    <Bot className="w-5 h-5 text-black" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                                        Sosha AI
                                        <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse"></span>
                                    </h3>
                                    <p className="text-[10px] text-gray-400 font-mono tracking-wider uppercase">Operating System</p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 pt-16 bg-gradient-to-b from-black via-[#111] to-[#050505] relative overflow-hidden flex flex-col">

                            {/* INTRO VIEW */}
                            <AnimatePresence mode="wait">
                                {view === 'intro' ? (
                                    <motion.div
                                        key="intro"
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: -20 }}
                                        className="h-full flex flex-col items-center justify-center p-8 space-y-8"
                                    >
                                        <div className="relative">
                                            <div className="w-32 h-32 rounded-full bg-gradient-to-tr from-yellow-500/20 to-transparent flex items-center justify-center border border-yellow-500/30 shadow-[0_0_30px_rgba(234,179,8,0.1)]">
                                                <Bot className="w-16 h-16 text-yellow-500" />
                                            </div>
                                            <div className="absolute -top-2 -right-2 bg-green-500 text-black text-[10px] font-bold px-2 py-0.5 rounded-full border border-black uppercase tracking-wider">
                                                Online
                                            </div>
                                        </div>

                                        <div className="text-center space-y-2">
                                            <h2 className="text-2xl font-bold text-white tracking-tight">How can I help you?</h2>
                                            <p className="text-gray-400 text-sm max-w-[250px] mx-auto leading-relaxed">
                                                I can help you create POs, check inventory, and analyze staff performance.
                                            </p>
                                        </div>

                                        <div className="w-full space-y-2">
                                            <button onClick={() => handleSend("Show me low stock items")} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-left text-sm text-gray-300 hover:bg-white/10 hover:border-yellow-500/30 hover:text-yellow-500 transition-all flex items-center gap-3 group">
                                                <Box className="w-4 h-4 text-gray-500 group-hover:text-yellow-500" />
                                                Check Inventory Status
                                            </button>
                                            <button onClick={() => handleSend("Draft a new PO for Fresh Farms")} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-left text-sm text-gray-300 hover:bg-white/10 hover:border-yellow-500/30 hover:text-yellow-500 transition-all flex items-center gap-3 group">
                                                <FileText className="w-4 h-4 text-gray-500 group-hover:text-yellow-500" />
                                                Create Purchase Order
                                            </button>
                                            <button onClick={() => handleSend("Who is the top server today?")} className="w-full p-3 bg-white/5 border border-white/10 rounded-xl text-left text-sm text-gray-300 hover:bg-white/10 hover:border-yellow-500/30 hover:text-yellow-500 transition-all flex items-center gap-3 group">
                                                <Zap className="w-4 h-4 text-gray-500 group-hover:text-yellow-500" />
                                                Staff Analytics
                                            </button>
                                        </div>

                                        <button
                                            onClick={startChat}
                                            className="w-full py-3.5 bg-primary text-black font-bold rounded-xl shadow-lg shadow-yellow-500/20 hover:bg-primary-hover transform hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2"
                                        >
                                            Start Conversation <ArrowRight className="w-4 h-4" />
                                        </button>
                                    </motion.div>
                                ) : (
                                    /* CHAT VIEW */
                                    <motion.div
                                        key="chat"
                                        initial={{ opacity: 0, x: 20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="h-full flex flex-col"
                                    >
                                        {/* Messages Area */}
                                        <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-gray-800 scrollbar-track-transparent pb-20">
                                            {messages.map((msg) => (
                                                <motion.div
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    key={msg.id}
                                                    className={cn(
                                                        "flex gap-3 max-w-[85%]",
                                                        msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                                                    )}
                                                >
                                                    {/* Avatar */}
                                                    <div className={cn(
                                                        "w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center shadow-lg",
                                                        msg.role === 'user' ? "bg-[#222] text-white border border-white/10" : "bg-gradient-to-br from-yellow-600 to-yellow-400 text-black"
                                                    )}>
                                                        {msg.role === 'user' ? <User className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
                                                    </div>

                                                    {/* Bubble */}
                                                    <div className={cn(
                                                        "p-3 rounded-2xl text-sm leading-relaxed shadow-sm",
                                                        msg.role === 'user'
                                                            ? "bg-[#222] text-white border border-white/10 rounded-tr-sm"
                                                            : "bg-white/5 text-gray-200 border border-white/5 rounded-tl-sm backdrop-blur-sm"
                                                    )}>
                                                        {msg.content}
                                                    </div>
                                                </motion.div>
                                            ))}

                                            {/* Loading Indicator */}
                                            {isLoading && (
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="flex gap-3 max-w-[85%]"
                                                >
                                                    <div className="w-8 h-8 rounded-full bg-white/5 text-yellow-500 flex-shrink-0 flex items-center justify-center">
                                                        <Bot className="w-4 h-4" />
                                                    </div>
                                                    <div className="bg-[#222] border border-white/5 p-4 rounded-2xl rounded-tl-sm flex items-center gap-1">
                                                        <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                                        <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                                        <span className="w-1.5 h-1.5 bg-gray-500 rounded-full animate-bounce"></span>
                                                    </div>
                                                </motion.div>
                                            )}
                                            <div ref={messagesEndRef} />
                                        </div>

                                        {/* Input Area */}
                                        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/5 bg-black/60 backdrop-blur-xl">
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    value={inputValue}
                                                    onChange={(e) => setInputValue(e.target.value)}
                                                    onKeyDown={handleKeyPress}
                                                    placeholder="Type your command..."
                                                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-4 pr-12 py-3.5 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-primary/50 focus:bg-white/10 transition-all shadow-inner"
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => handleSend()}
                                                    disabled={!inputValue.trim() || isLoading}
                                                    className="absolute right-2 top-2 p-1.5 bg-primary text-black rounded-lg hover:bg-primary-hover disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95 shadow-lg shadow-yellow-500/20"
                                                >
                                                    <Send className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Toggle Button */}
            <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                onClick={() => setIsOpen(!isOpen)}
                className="pointer-events-auto group relative w-14 h-14 rounded-full bg-primary text-black shadow-2xl shadow-yellow-500/20 flex items-center justify-center overflow-hidden border-2 border-primary/50"
            >
                {/* Glow effect */}
                <span className="absolute inset-0 bg-white/30 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>

                <AnimatePresence mode="wait">
                    {isOpen ? (
                        <motion.div
                            key="close"
                            initial={{ rotate: -90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: 90, opacity: 0 }}
                        >
                            <ChevronDown className="w-7 h-7" />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="open"
                            initial={{ rotate: 90, opacity: 0 }}
                            animate={{ rotate: 0, opacity: 1 }}
                            exit={{ rotate: -90, opacity: 0 }}
                        >
                            <MessageSquare className="w-6 h-6 fill-current" />
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Notification Badge (Optional) */}
                {!isOpen && (
                    <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-black flex items-center justify-center">
                        <span className="w-full h-full rounded-full bg-red-500 animate-ping absolute opacity-75"></span>
                    </span>
                )}
            </motion.button>
        </div>
    );
};
