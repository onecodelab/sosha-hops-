import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MarketingLayout } from '../components/MarketingLayout';
import { Button } from '../components/ui';
import { WaveDivider } from '../components/WaveDivider';
import { useLanguage } from '../contexts/LanguageContext';
import {
    ArrowRight,
    CheckCircle2,
    Check,
    Camera,
    GraduationCap,
    Crown,
    Sparkles,
    Server,
    ShieldCheck,
    BarChart3,
    Utensils,
    Layers,
    ClipboardList,
    Monitor,
    Users,
    Wallet,
    Zap,
    Mail,
} from 'lucide-react';

/* ──── included features list ──── */
const INCLUDED_FEATURES = [
    { icon: Layers, key: 'inventory' },
    { icon: Utensils, key: 'recipe' },
    { icon: ClipboardList, key: 'po' },
    { icon: Monitor, key: 'kds' },
    { icon: Users, key: 'waiter' },
    { icon: BarChart3, key: 'analytics' },
    { icon: Wallet, key: 'telebirr' },
    { icon: ShieldCheck, key: 'verifier' },
    { icon: Server, key: 'vps' },
    { icon: Sparkles, key: 'aesthetic' },
];

const PricingPage: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();
    

    return (
        <MarketingLayout>
            {/* ═══════════════  HERO  ═══════════════ */}
            <section className="relative min-h-[70vh] flex flex-col items-center justify-center pt-28 pb-20 overflow-hidden bg-black liquid-bg">
                <div className="absolute inset-0 bg-black/50 pointer-events-none" />
                <div className="absolute top-[20%] right-[15%] w-[500px] h-[500px] bg-brand-yellow/8 blur-[150px] rounded-full pointer-events-none animate-pulse-slow" />
                <div className="absolute bottom-[10%] left-[10%] w-[400px] h-[400px] bg-brand-green/5 blur-[120px] rounded-full pointer-events-none" />

                <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
                    <p className="mono-os text-brand-green text-xs font-black tracking-[0.5em] mb-10 animate-in fade-in slide-in-from-bottom-4 duration-1000">
                        {t('pricing.heroTag')}
                    </p>

                    <h1 className="text-6xl sm:text-8xl md:text-9xl font-black uppercase tracking-tighter leading-[0.85] mb-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 text-white">
                        {t('pricing.heroTitle1')} <br />
                        <span className="serif-ital text-brand-green lowercase">{t('pricing.heroTitle2')}</span>
                    </h1>

                    <p className="serif-ital text-xl md:text-2xl text-white/60 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
                        {t('pricing.heroDesc')}
                    </p>
                </div>

                <WaveDivider variant="strong" color="fill-brand-blue/30" />
            </section>

            {/* ═══════════════  ONE-TIME FEES  ═══════════════ */}
            <section className="relative py-32 bg-brand-blue/30 border-y border-white/5">
                <div className="max-w-6xl mx-auto px-6">
                    <div className="text-center mb-20">
                        <span className="mono-os text-brand-yellow text-[10px] font-black tracking-[0.5em] mb-6 block uppercase">
                            {t('pricing.oneTimeTag')}
                        </span>
                        <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-white leading-none">
                            {t('pricing.oneTimeTitle1')} <br />
                            <span className="serif-ital text-brand-green lowercase">{t('pricing.oneTimeTitle2')}</span>
                        </h2>
                    </div>

                    <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        {/* Data Migration Card */}
                        <div className="glass-panel rounded-[2.5rem] p-10 md:p-12 relative group hover:border-brand-green/30 transition-all duration-500 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-brand-green/[0.03] to-transparent pointer-events-none" />
                            <div className="relative z-10">
                                <div className="w-16 h-16 rounded-2xl bg-brand-green/10 border border-brand-green/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                                    <Camera className="w-8 h-8 text-brand-green" />
                                </div>
                                <h3 className="text-2xl font-black uppercase tracking-tight text-white mb-3">
                                    {t('pricing.migrationTitle')}
                                </h3>
                                <p className="serif-ital text-sm text-white/40 leading-relaxed mb-8">
                                    {t('pricing.migrationDesc')}
                                </p>
                                <div className="flex items-baseline gap-2">
                                    <span className="mono-os text-3xl font-black text-brand-green">ETB 20,000</span>
                                    <span className="mono-os text-[10px] font-black text-white/30 tracking-widest uppercase">{t('pricing.oneTimeLabel')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Staff Training Card */}
                        <div className="glass-panel rounded-[2.5rem] p-10 md:p-12 relative group hover:border-brand-yellow/30 transition-all duration-500 overflow-hidden">
                            <div className="absolute inset-0 bg-gradient-to-br from-brand-yellow/[0.03] to-transparent pointer-events-none" />
                            <div className="relative z-10">
                                <div className="w-16 h-16 rounded-2xl bg-brand-yellow/10 border border-brand-yellow/20 flex items-center justify-center mb-8 group-hover:scale-110 transition-transform duration-500">
                                    <GraduationCap className="w-8 h-8 text-brand-yellow" />
                                </div>
                                <h3 className="text-2xl font-black uppercase tracking-tight text-white mb-3">
                                    {t('pricing.trainingTitle')}
                                </h3>
                                <p className="serif-ital text-sm text-white/40 leading-relaxed mb-8">
                                    {t('pricing.trainingDesc')}
                                </p>
                                <div className="flex items-baseline gap-2">
                                    <span className="mono-os text-3xl font-black text-brand-yellow">ETB 15,000</span>
                                    <span className="mono-os text-[10px] font-black text-white/30 tracking-widest uppercase">{t('pricing.oneTimeLabel')}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════  SINGLE PACKAGE  ═══════════════ */}
            <section className="relative py-32 overflow-hidden liquid-bg">
                <div className="absolute inset-0 bg-black/40 pointer-events-none" />
                <WaveDivider position="top" color="fill-brand-blue/30" />

                <div className="max-w-6xl mx-auto px-6 relative z-10">
                    <div className="text-center mb-16">
                        <span className="mono-os text-brand-yellow text-[10px] font-black tracking-[0.5em] mb-6 block uppercase">
                            {t('pricing.saasTag')}
                        </span>
                        <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-white leading-none mb-6">
                            Everything You Need, <br />
                            <span className="serif-ital text-brand-yellow lowercase">One Simple Price</span>
                        </h2>
                        <p className="serif-ital text-lg text-white/40 max-w-xl mx-auto">
                            Full access to all Baro OS modules. Designed for precision and speed.
                        </p>
                    </div>

                    <div className="mx-auto flex max-w-5xl flex-col items-center gap-6 text-center">
                        <div className="glass-panel w-full sm:w-fit sm:min-w-[24rem] rounded-[2.5rem] p-10 md:p-12 relative group transition-all duration-500 overflow-hidden border border-brand-green/30">
                            {/* Glow effect */}
                            <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-brand-green/10 blur-[100px] rounded-full pointer-events-none" />

                            <div className="relative z-10 flex flex-col items-center">
                                <div className="flex justify-center items-baseline gap-2 mb-8">
                                    <span className="text-lg font-semibold text-white/50">ETB</span>
                                    <span className="text-6xl font-black text-white">5,500</span>
                                    <span className="mono-os text-[10px] font-black text-white/30 tracking-widest uppercase">
                                        / month
                                    </span>
                                </div>
                                
                                <div className="w-full my-6 text-left">
                                    {[
                                        ["Unlimited Staff Accounts", "Full Operations POS", "Advanced Kitchen Display (KDS)"],
                                        ["Live Table Tracking", "Purchase Order System", "Detailed Waste Analytics"],
                                        ["2 Free QR Code Plates", "Local Verifier Engine", "Dedicated VPS Hosting"],
                                    ].map((featureGroup, idx) => (
                                        <div key={idx}>
                                            <ul className="flex flex-col gap-4">
                                                {featureGroup.map((feature, i) => (
                                                    <li
                                                        key={i}
                                                        className="flex items-center justify-between gap-4 text-sm font-medium text-white/70"
                                                    >
                                                        {feature} <Check className="inline w-4 h-4 shrink-0 text-brand-green" />
                                                    </li>
                                                ))}
                                            </ul>
                                            {idx < 2 && <div className="w-full h-px bg-white/5 my-6" />}
                                        </div>
                                    ))}
                                </div>

                                <Button
                                    size="lg"
                                    onClick={() => navigate('/book-demo')}
                                    className="w-full h-16 mt-4 bg-brand-yellow hover:bg-white text-black font-black uppercase tracking-[0.2em] text-[10px] rounded-2xl shadow-xl shadow-brand-yellow/10 transition-all ripple-link"
                                >
                                    Start 7-Day Free Trial
                                </Button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* ═══════════════  WHAT'S INCLUDED  ═══════════════ */}
            <section className="relative py-32 bg-gradient-to-b from-black via-brand-blue/10 to-black overflow-hidden">
                <div className="absolute inset-0 uchok-pattern opacity-[0.03] pointer-events-none" />

                <div className="max-w-6xl mx-auto px-6 relative z-10">
                    <div className="text-center mb-20">
                        <span className="mono-os text-brand-yellow text-[10px] font-black tracking-[0.5em] mb-6 block uppercase">
                            {t('pricing.includesTag')}
                        </span>
                        <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-white leading-none">
                            {t('pricing.includesTitle1')} <br />
                            <span className="serif-ital text-brand-green lowercase">{t('pricing.includesTitle2')}</span>
                        </h2>
                    </div>

                    <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-6 max-w-5xl mx-auto">
                        {INCLUDED_FEATURES.map((feat, i) => (
                            <div
                                key={feat.key}
                                className="group flex flex-col items-center text-center p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-primary/20 transition-all duration-500 cursor-default"
                            >
                                <div className="w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <feat.icon className={`w-6 h-6 ${i % 2 === 0 ? 'text-brand-green' : 'text-brand-yellow'}`} />
                                </div>
                                <span className="mono-os text-[9px] font-black text-white/60 tracking-widest uppercase leading-relaxed">
                                    {t(`pricing.feat_${feat.key}`)}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ═══════════════  CTA  ═══════════════ */}
            <section className="relative py-48 overflow-hidden liquid-bg">
                <div className="absolute inset-0 bg-black/40 pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-brand-yellow/5 blur-[150px] rounded-full pointer-events-none" />

                <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
                    <h2 className="text-5xl md:text-8xl font-black uppercase tracking-tighter text-white mb-8 leading-none">
                        {t('pricing.ctaTitle1')} <br />
                        <span className="serif-ital text-brand-yellow lowercase">{t('pricing.ctaTitle2')}</span>
                    </h2>

                    <p className="serif-ital text-xl text-white/50 max-w-xl mx-auto mb-16">
                        {t('pricing.ctaDesc')}
                    </p>

                    <Button
                        size="lg"
                        onClick={() => navigate('/book-demo')}
                        className="px-16 h-20 bg-brand-yellow hover:bg-white text-black font-black uppercase tracking-[0.3em] text-[10px] rounded-full shadow-2xl shadow-brand-yellow/20 group transition-all ripple-link"
                    >
                        {t('pricing.ctaButton')}
                        <ArrowRight className="w-5 h-5 ml-6 group-hover:translate-x-3 transition-transform" />
                    </Button>

                    {/* Contact strip */}
                    <div className="mt-20 flex items-center justify-center gap-4 opacity-40 hover:opacity-100 transition-opacity duration-700">
                        <Mail className="w-4 h-4 text-brand-green" />
                        <span className="mono-os text-[10px] font-black text-white/60 tracking-widest">
                            withraminaisolution@gmail.com
                        </span>
                    </div>
                </div>
            </section>
        </MarketingLayout>
    );
};

export default PricingPage;
