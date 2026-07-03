import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MarketingLayout } from '../components/MarketingLayout';
import { LeafBubbleBackground } from '../components/LeafBubbleBackground';
import { Button } from '../components/ui';
import { WaveDivider } from '../components/WaveDivider';
import { BaroLeafyCard } from '../components/ElectricCard';
import { BaroLogo3D } from '../components/BaroLogo3D';
import { useLanguage } from '../contexts/LanguageContext';
import {
    BarChart3,
    ChefHat,
    MousePointer2,
    Cpu,
    ArrowRight,
    Sparkles,
    Zap,
    ShieldCheck,
    Globe,
    MonitorSmartphone
} from 'lucide-react';

const categories = [
    {
        title: 'Front of House',
        icon: MousePointer2,
        desc: 'Precision interfaces for the moments that matter. Built for speed, designed for elegance. The first touchpoint of your hospitality stream.',
        features: ['Quick-Action POS', 'Table Command', 'Split-Second Payments', 'Guest Profiles'],
        color: '#FFB800', // brand-yellow
        accent: 'brand-yellow',
        glow: 'rgba(255, 184, 0, 0.1)'
    },
    {
        title: 'Back of House',
        icon: ChefHat,
        desc: 'The organic engine of your operation. Seamless coordination between fire and flow. Turning heat into balanced output.',
        features: ['Digital KDS', 'Prep Management', 'Recipe Intelligence', 'Station Sync'],
        color: '#A3E635', // brand-green
        accent: 'brand-green',
        glow: 'rgba(163, 230, 53, 0.1)'
    },
    {
        title: 'Intelligence',
        icon: BarChart3,
        desc: 'Deep data surfacing from the delta. Clarity that empowers decision-making through real-time operational transparency.',
        features: ['Real-time Analytics', 'Performance Delta', 'Financial Flow', 'AI Forecasting'],
        color: '#00D1FF', // brand-blue
        accent: 'brand-blue',
        glow: 'rgba(0, 209, 255, 0.1)'
    },
    {
        title: 'Operations',
        icon: Cpu,
        desc: 'The technical infrastructure that keeps the pulse strong across every branch, ensuring absolute stability and security.',
        features: ['Multi-Branch Control', 'Living Inventory', 'Staff Logistics', 'Protocol Security'],
        color: '#A3E635', // brand-green
        accent: 'brand-green',
        glow: 'rgba(163, 230, 53, 0.1)'
    },
];

const Features: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();

    return (
        <MarketingLayout>
            {/* Hero Section */}
            <section className="relative pt-32 pb-24 md:pt-48 md:pb-32 overflow-hidden bg-black liquid-bg">
                <div className="absolute inset-0 bg-black/40 pointer-events-none" />
                <div className="absolute top-[10%] left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brand-green/30 to-transparent blur-[2px] pointer-events-none" />

                <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
                    <div className="flex justify-center mb-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        <div className="px-4 py-1.5 rounded-full border border-brand-green/20 bg-brand-green/5 flex items-center gap-3">
                            <Zap className="w-3.5 h-3.5 text-brand-green" />
                            <span className="mono-os text-[10px] font-black text-brand-green uppercase tracking-[0.4em]">System_v.02_Protocols</span>
                        </div>
                    </div>

                    <h1 className="text-7xl md:text-9xl font-black uppercase tracking-tighter mb-12 text-white leading-[0.85] animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-200">
                        Operational <br />
                        <span className="serif-ital text-brand-green lowercase">stream</span>
                    </h1>

                    <p className="serif-ital text-2xl text-white/50 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-400">
                        A high-fidelity infrastructure designed to channel
                        hospitality vitality into technical precision.
                        Every module, a vital tributary.
                    </p>
                </div>

                <WaveDivider variant="strong" color="fill-brand-blue/30" />
            </section>

            {/* 🌊 THE STREAM: STAGGERED MODULES */}
            <section className="bg-brand-blue/30 relative py-20">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex flex-col gap-32">
                        {categories.map((cat, idx) => (
                            <div
                                key={cat.title}
                                className={`flex flex-col ${idx % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'} items-center gap-16 md:gap-32`}
                            >
                                {/* Focal Point Side */}
                                <div className="w-full md:w-1/2 relative group">
                                    <div className="absolute inset-0 bg-white/[0.02] rounded-[3rem] blur-3xl group-hover:bg-white/[0.04] transition-all duration-1000" />
                                    <div className="relative z-10 flex flex-col items-center">
                                        <BaroLogo3D
                                            size="lg"
                                            animate
                                            className="opacity-80 group-hover:opacity-100 group-hover:scale-105 transition-all duration-700"
                                        />
                                        <div
                                            className="mt-[-80px] px-8 py-3 rounded-2xl bg-black border border-white/5 shadow-2xl backdrop-blur-3xl animate-in slide-in-from-bottom-4"
                                            style={{ borderColor: `${cat.color}22` }}
                                        >
                                            <span className={`mono-os text-[10px] font-black uppercase tracking-[0.5em] text-${cat.accent}`}>
                                                Protocol_{idx + 1}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* Content Side */}
                                <div className="w-full md:w-1/2">
                                    <BaroLeafyCard
                                        color={cat.color}
                                        badge={cat.title}
                                        className="hover:scale-[1.02] transition-transform duration-700"
                                    >
                                        <div className="p-10 flex flex-col items-start h-full">
                                            <div className="flex items-center gap-4 mb-8">
                                                <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-center">
                                                    <cat.icon className="w-6 h-6 text-white" />
                                                </div>
                                                <h2 className="text-3xl font-black uppercase tracking-tight text-white group-hover:text-brand-yellow transition-colors">
                                                    {cat.title}
                                                </h2>
                                            </div>

                                            <p className="serif-ital text-xl text-white/50 mb-10 leading-relaxed text-left">
                                                {cat.desc}
                                            </p>

                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-12 gap-y-6 w-full mt-auto">
                                                {cat.features.map(f => (
                                                    <div key={f} className="flex items-center gap-4 group/item">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-brand-green group-hover/item:scale-150 transition-transform" />
                                                        <span className="mono-os text-[10px] text-white/40 group-hover/item:text-white transition-colors font-black uppercase tracking-widest">
                                                            {f}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </BaroLeafyCard>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* 🚢 CTA: THE DELTA EXPANSION */}
            <section className="relative py-72 bg-black overflow-hidden">
                <WaveDivider position="top" color="fill-brand-blue/30" />

                {/* Atmospheric Glows */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-brand-yellow/5 blur-[150px] rounded-full pointer-events-none" />
                <LeafBubbleBackground />

                <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                    <div className="flex justify-center mb-10">
                        <div className="w-12 h-12 rounded-full border border-white/10 flex items-center justify-center animate-bounce">
                            <ArrowRight className="w-5 h-5 text-brand-green rotate-90" />
                        </div>
                    </div>

                    <h2 className="text-6xl md:text-9xl font-black uppercase tracking-tighter mb-12 text-white leading-[0.8] animate-in slide-in-from-bottom-6">
                        Expand the <br />
                        <span className="serif-ital text-brand-yellow lowercase">delta</span>
                    </h2>

                    <p className="serif-ital text-2xl text-white/30 max-w-2xl mx-auto mb-20">
                        Every operation has its own journey. Let's map your
                        Organic Pulse and unlock the full potential of your hospitality engine.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-10">
                        <Button
                            size="lg"
                            onClick={() => navigate('/book-demo')}
                            className="px-16 h-20 bg-brand-yellow hover:bg-white text-black font-black uppercase tracking-widest text-[10px] rounded-full shadow-2xl shadow-brand-yellow/20 group transition-all relative overflow-hidden"
                        >
                            <span className="relative z-10 flex items-center gap-4">
                                Book Protocol Demo
                                <ArrowRight className="w-5 h-5 group-hover:translate-x-3 transition-transform" />
                            </span>
                        </Button>

                        <Button
                            variant="outline"
                            size="lg"
                            onClick={() => navigate('/signup')}
                            className="px-16 h-20 border-white/10 hover:border-brand-green text-white font-black uppercase tracking-widest text-[10px] rounded-full hover:bg-brand-green/5 transition-all group"
                        >
                            <span className="flex items-center gap-4 opacity-60 group-hover:opacity-100">
                                Initialize System
                                <Sparkles className="w-4 h-4 text-primary" />
                            </span>
                        </Button>
                    </div>

                    <div className="mt-40 flex flex-wrap justify-center items-center gap-16 opacity-10">
                        <div className="flex items-center gap-3">
                            <MonitorSmartphone className="w-5 h-5" />
                            <span className="mono-os text-[9px] font-black uppercase tracking-widest text-white">Full_Mobility</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <Globe className="w-5 h-5" />
                            <span className="mono-os text-[9px] font-black uppercase tracking-widest text-white">Global_Sync</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <ShieldCheck className="w-5 h-5" />
                            <span className="mono-os text-[9px] font-black uppercase tracking-widest text-white">Military_Secure</span>
                        </div>
                    </div>
                </div>
            </section>
        </MarketingLayout>
    );
};

export default Features;
