import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, cn, showToast, Input } from '../components/ui';
import {
    Home,
    LayoutDashboard,
    Maximize,
    Minimize
} from 'lucide-react';
import { useBranch } from '../contexts/BranchContext';
import { motion } from 'framer-motion';
import { BaroCommandChat } from '../components/BaroCommandChat';

const OwnerCommandCenter: React.FC = () => {
    const navigate = useNavigate();
    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFullscreenChange);
        
        // Attempt automatic fullscreen on mount (Browser policies may block this if no prior user gesture)
        const enterFullscreen = async () => {
            try {
                if (!document.fullscreenElement) {
                    await document.documentElement.requestFullscreen();
                }
            } catch (err) {
                console.log("Auto-fullscreen on mount prevented by browser policy", err);
            }
        };
        
        // Small delay to ensure component is fully mounted
        const timeout = setTimeout(enterFullscreen, 100);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            clearTimeout(timeout);
        };
    }, []);

    const toggleFullscreen = async () => {
        try {
            if (!document.fullscreenElement) {
                await document.documentElement.requestFullscreen();
            } else {
                await document.exitFullscreen();
            }
        } catch (err) {
            console.error("Fullscreen toggle failed:", err);
        }
    };


    return (
        <div className="h-full min-h-0 bg-[#0a0a0a] flex flex-col animate-in fade-in duration-700">
            {/* ─── CUSTOM FULL-SCREEN HEADER ─── */}
            <header className="flex-none px-4 md:px-8 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-gray-800/50 bg-[#0d0d0d]/90 backdrop-blur-md z-10 w-full relative">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                <div className="flex items-center gap-4 relative z-10">
                    <div className="flex gap-2">
                        <Button variant="ghost" size="icon" onClick={() => navigate('/')} className="rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors bg-[#111] border border-gray-800/50 shadow-sm shadow-black/50" title="Exit to Landing Page">
                            <Home className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => navigate('/app/admin')} className="rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors bg-[#111] border border-gray-800/50 shadow-sm shadow-black/50" title="Return to Dashboard">
                            <LayoutDashboard className="w-5 h-5" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={toggleFullscreen} className="rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors bg-[#111] border border-gray-800/50 shadow-sm shadow-black/50" title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}>
                            {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
                        </Button>
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">Command Center</h1>
                            <Badge className="bg-primary/20 text-primary border-none text-[9px] uppercase tracking-widest px-2 py-0.5 pointer-events-none">System Active</Badge>
                        </div>
                        <p className="text-[10px] md:text-[11px] text-gray-400 font-mono uppercase tracking-widest mt-1">Agentic Oversight & Strategic Control</p>
                    </div>
                </div>

            </header>

            {/* ─── CONTENT AREA ─── */}
            <div className="flex-1 min-h-0 relative p-4 md:p-6 lg:p-8 lg:pb-6 bg-gradient-to-br from-[#0a0a0a] via-[#050505] to-[#080808] flex flex-col">
                        <motion.div
                            key="intelligence"
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.98 }}
                            transition={{ duration: 0.3, ease: [0.2, 0, 0, 1] }}
                            className="flex-1 min-h-0 w-full bg-[#0a0a0a] border border-gray-800/50 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                        >
                            <BaroCommandChat />
                        </motion.div>
            </div>
        </div>
    );
};

export default OwnerCommandCenter;
