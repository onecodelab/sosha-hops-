import React from "react";
import { cn } from "./ui";

export type SoshaLeafyCardProps = {
    /** Accent / border color. Defaults to Sosha Lime. */
    color?: string;
    /** Badge text in the top pill. */
    badge?: string;
    /** Extra class names. */
    className?: string;
    /** Content to render inside the card */
    children?: React.ReactNode;
};

/**
 * SoshaLeafyCard
 * An organic, "vitality" card with foliage silhouettes and stable, crisp glass effects.
 */
export const SoshaLeafyCard = ({
    color = "#A3E635", // Sosha Lime
    badge,
    className = "",
    children
}: SoshaLeafyCardProps) => {
    return (
        <div className={cn("relative group transition-all duration-700 h-full", className)}>
            {/* Main Container */}
            <div
                className="relative p-[1.5px] rounded-[2.5rem] overflow-hidden bg-[#050505] h-full flex flex-col shadow-2xl transition-all duration-500"
                style={{
                    boxShadow: `0 20px 50px -12px ${color}22`,
                    borderColor: `${color}33`
                }}
            >
                {/* Organic Background Glow - Stable */}
                <div className="absolute inset-x-0 top-0 h-40 opacity-30 pointer-events-none"
                    style={{ background: `radial-gradient(circle at 50% 0%, ${color}44, transparent 70%)` }} />

                {/* Leafy Decorations - Crisp Silhouettes */}
                <div className="absolute top-2 right-4 opacity-10 pointer-events-none group-hover:opacity-30 transition-all duration-1000 group-hover:rotate-6">
                    <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="0.5">
                        <path d="M12 22C12 22 12 18 12 12C12 6 12 2 12 2M12 12C12 12 16 10 19 12C22 14 22 17 22 17M12 7C12 7 15 5 18 7C21 9 21 12 21 12M12 12C12 12 8 10 5 12C2 14 2 17 2 17M12 7C12 7 9 5 6 7C3 9 3 12 3 12" strokeLinecap="round" />
                    </svg>
                </div>

                <div className="absolute bottom-2 left-4 opacity-0 group-hover:opacity-10 pointer-events-none transition-all duration-1000 scale-x-[-1] -rotate-6">
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="0.5">
                        <path d="M12 22C12 22 12 18 12 12C12 6 12 2 12 2M12 12C12 12 16 10 19 12C22 14 22 17 22 17M12 7C12 7 15 5 18 7C21 9 21 12 21 12M12 12C12 12 8 10 5 12C2 14 2 17 2 17M12 7C12 7 9 5 6 7C3 9 3 12 3 12" strokeLinecap="round" />
                    </svg>
                </div>

                {/* Vitality Breathing Border */}
                <div
                    className="absolute inset-0 rounded-[2.5rem] border border-white/5 group-hover:border-primary/20 transition-colors pointer-events-none"
                />
                <div
                    className="absolute inset-0 rounded-[2.5rem] border-[1px] animate-pulse duration-[4000ms] pointer-events-none"
                    style={{ borderColor: `${color}22` }}
                />

                {/* Stable Content area */}
                <div className="relative z-10 flex-1 flex flex-col p-1">
                    <div className="bg-[#0A0A0A]/90 backdrop-blur-xl rounded-[2.3rem] overflow-hidden border border-white/5 flex-1 flex flex-col">
                        {/* Organic Badge */}
                        {badge && (
                            <div className="px-6 pt-5">
                                <div
                                    className="inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[9px] font-black uppercase tracking-[0.2em]"
                                    style={{
                                        backgroundColor: `${color}11`,
                                        borderColor: `${color}33`,
                                        color: color
                                    }}
                                >
                                    <div className="w-1.5 h-1.5 rounded-full bg-current animate-ping" />
                                    {badge}
                                </div>
                            </div>
                        )}

                        <div className="relative flex-1 flex flex-col">
                            {children}
                        </div>
                    </div>
                </div>

                {/* Subtle Ambient Glow */}
                <div
                    className="absolute inset-x-0 bottom-0 h-40 opacity-0 group-hover:opacity-10 transition-opacity duration-1000 -z-10 blur-3xl pointer-events-none"
                    style={{ background: `radial-gradient(circle at 50% 100%, ${color}, transparent 70%)` }}
                />
            </div>
        </div>
    );
};
