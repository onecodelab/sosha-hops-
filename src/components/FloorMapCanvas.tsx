import React from 'react';
import { cn } from './ui';
import { motion } from 'framer-motion';
import { Clock, AlertTriangle, Users } from 'lucide-react';

interface TableData {
    id: string;
    table_number: string;
    zone: string;
    status: 'available' | 'occupied' | 'needs_cleaning' | 'reserved';
    pos_x: number;
    pos_y: number;
    needs_cleanup?: boolean;
    active_session?: { seated_at: string } | null;
}

interface FloorMapCanvasProps {
    tables: TableData[];
    onTableClick: (table: TableData) => void;
    currentTime: Date;
    isAnalyticsMode?: boolean;
}

const ZONE_LABELS = [
    { name: 'BAR ZONE', x: 10, y: 8 },
    { name: 'VIP ZONE', x: 70, y: 8 },
    { name: 'INDOOR ZONE', x: 35, y: 40 },
    { name: 'OUTDOOR ZONE', x: 35, y: 75 },
];

export const FloorMapCanvas: React.FC<FloorMapCanvasProps> = ({
    tables,
    onTableClick,
    currentTime,
    isAnalyticsMode = false
}) => {

    const getTableColor = (table: TableData) => {
        if (table.needs_cleanup) return { bg: 'bg-purple-500', glow: 'shadow-purple-500/40', text: 'text-white' };
        if (table.status === 'occupied') return { bg: 'bg-red-500', glow: 'shadow-red-500/40', text: 'text-white' };
        if (table.status === 'needs_cleaning') return { bg: 'bg-yellow-500', glow: 'shadow-yellow-500/40', text: 'text-black' };
        if (table.status === 'reserved') return { bg: 'bg-blue-500', glow: 'shadow-blue-500/40', text: 'text-white' };
        return { bg: 'bg-green-500', glow: 'shadow-green-500/40', text: 'text-white' };
    };

    const getElapsedMins = (table: TableData) => {
        if (!table.active_session?.seated_at) return 0;
        return Math.floor((currentTime.getTime() - new Date(table.active_session.seated_at).getTime()) / 60000);
    };

    return (
        <div className="relative w-full aspect-[4/3] max-h-[600px] bg-[#0a0a0a] rounded-[2rem] border border-white/10 overflow-hidden">
            {/* Grid Background */}
            <div className="absolute inset-0 opacity-10"
                style={{
                    backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.1) 1px, transparent 1px)',
                    backgroundSize: '20px 20px'
                }}
            />

            {/* Zone Labels */}
            {ZONE_LABELS.map((zone) => (
                <div
                    key={zone.name}
                    className="absolute text-[10px] font-black uppercase tracking-[0.3em] text-white/20"
                    style={{ left: `${zone.x}%`, top: `${zone.y}%` }}
                >
                    {zone.name}
                </div>
            ))}

            {/* Zone Dividers (subtle lines) */}
            <div className="absolute left-[50%] top-[5%] h-[25%] w-px bg-white/5" />
            <div className="absolute left-[5%] top-[65%] w-[90%] h-px bg-white/5" />

            {/* Table Markers */}
            {tables.map((table) => {
                const colors = getTableColor(table);
                const elapsed = getElapsedMins(table);

                return (
                    <motion.button
                        key={table.id}
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.3, delay: Math.random() * 0.3 }}
                        onClick={() => onTableClick(table)}
                        className={cn(
                            "absolute w-14 h-14 rounded-full flex flex-col items-center justify-center transition-all duration-300",
                            "hover:scale-110 hover:z-20 cursor-pointer",
                            colors.bg, colors.text,
                            "shadow-lg", colors.glow
                        )}
                        style={{
                            left: `${table.pos_x || 50}%`,
                            top: `${table.pos_y || 50}%`,
                            transform: 'translate(-50%, -50%)'
                        }}
                    >
                        <span className="text-sm font-black tracking-tight">{table.table_number}</span>

                        {/* Elapsed time badge for occupied tables */}
                        {table.status === 'occupied' && elapsed > 0 && (
                            <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/80 px-2 py-0.5 rounded-full border border-white/10">
                                <Clock className="w-2.5 h-2.5 text-zinc-400" />
                                <span className="text-[9px] font-bold text-zinc-300">{elapsed}m</span>
                            </div>
                        )}

                        {/* Pulse animation for occupied */}
                        {table.status === 'occupied' && (
                            <div className={cn(
                                "absolute inset-0 rounded-full animate-ping opacity-30",
                                colors.bg
                            )} />
                        )}
                    </motion.button>
                );
            })}

            {/* Legend */}
            <div className="absolute bottom-4 right-4 flex items-center gap-4 bg-black/60 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10">
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-green-500" />
                    <span className="text-[9px] text-zinc-400 font-bold uppercase">Free</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-500" />
                    <span className="text-[9px] text-zinc-400 font-bold uppercase">Occupied</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-yellow-500" />
                    <span className="text-[9px] text-zinc-400 font-bold uppercase">Dirty</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                    <span className="text-[9px] text-zinc-400 font-bold uppercase">Ready</span>
                </div>
            </div>
        </div>
    );
};

export default FloorMapCanvas;
