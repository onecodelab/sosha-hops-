import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MarketingLayout } from '../components/MarketingLayout';
import { Button } from '../components/ui';
import { WaveDivider } from '../components/WaveDivider';
import { useLanguage } from '../contexts/LanguageContext';
import {
    ArrowRight,
    CheckCircle2,
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
    const [billing, setBilling] = useState<'monthly' | 'annual'>('annual');

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

            {/* ═══════════════  SAAS SUBSCRIPTION  ═══════════════ */}
            <section className="relative py-32 overflow-hidden liquid-bg">
                <div className="absolute inset-0 bg-black/40 pointer-events-none" />
                <WaveDivider position="top" color="fill-brand-blue/30" />

                <div className="max-w-6xl mx-auto px-6 relative z-10">
                    <div className="text-center mb-16">
                        <span className="mono-os text-brand-yellow text-[10px] font-black tracking-[0.5em] mb-6 block uppercase">
                            {t('pricing.saasTag')}
                        </span>
                        <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tighter text-white leading-none mb-6">
                            {t('pricing.saasTitle1')} <br />
                            <span className="serif-ital text-brand-yellow lowercase">{t('pricing.saasTitle2')}</span>
                        </h2>
                        <p className="serif-ital text-lg text-white/40 max-w-xl mx-auto">
                            {t('pricing.saasDesc')}
                        </p>
                    </div>

                    {/* Billing Toggle */}
                    <div className="flex items-center justify-center gap-4 mb-16">
                        <button
                            onClick={() => setBilling('monthly')}
                            className={`mono-os text-[10px] font-black tracking-widest px-6 py-3 rounded-full transition-all uppercase ${billing === 'monthly'
                                    ? 'bg-white/10 text-white border border-white/20'
                                    : 'text-white/30 hover:text-white/60'
                                }`}
                        >
                            {t('pricing.monthlyLabel')}
                        </button>
                        <button
                            onClick={() => setBilling('annual')}
                            className={`mono-os text-[10px] font-black tracking-widest px-6 py-3 rounded-full transition-all uppercase flex items-center gap-2 ${billing === 'annual'
                                    ? 'bg-brand-green/20 text-brand-green border border-brand-green/30'
                                    : 'text-white/30 hover:text-white/60'
                                }`}
                        >
                            {t('pricing.annualLabel')}
                            <span className="bg-brand-green/30 text-brand-green px-2 py-0.5 rounded-full text-[8px] tracking-[0.2em]">
                                -15%
                            </span>
                        </button>
                    </div>

                    {/* Pricing Cards */}
                    <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
                        {/* Monthly Card */}
                        <div
                            className={`glass-panel rounded-[2.5rem] p-10 md:p-12 relative group transition-all duration-500 overflow-hidden cursor-pointer ${billing === 'monthly'
                                    ? 'border-white/20 scale-[1.02]'
                                    : 'border-white/5 opacity-60 hover:opacity-80'
                                }`}
                            onClick={() => setBilling('monthly')}
                        >
                            <div className="relative z-10">
                                <h3 className="mono-os text-[10px] font-black text-white/50 tracking-[0.3em] uppercase mb-6">
                                    {t('pricing.monthlyTitle')}
                                </h3>
                                <div className="flex items-baseline gap-2 mb-2">
                                    <span className="text-5xl font-black text-white">ETB 15,000</span>
                                </div>
                                <p className="mono-os text-[10px] font-black text-white/30 tracking-widest uppercase mb-8">
                                    {t('pricing.perMonth')}
                                </p>
                                <p className="serif-ital text-sm text-white/40 leading-relaxed">
                                    {t('pricing.monthlyDesc')}
                                </p>
                            </div>
                        </div>

                        {/* Annual Card — RECOMMENDED */}
                        <div
                            className={`relative rounded-[2.5rem] p-10 md:p-12 group transition-all duration-500 overflow-hidden cursor-pointer uchok-border ${billing === 'annual'
                                    ? 'scale-[1.02]'
                                    : 'opacity-60 hover:opacity-80'
                                }`}
                            style={{
                                background: 'rgba(20, 20, 20, 0.4)',
                                border: billing === 'annual' ? '1px solid rgba(114, 191, 68, 0.3)' : '1px solid rgba(255, 255, 255, 0.05)',
                                backdropFilter: 'blur(12px)',
                            }}
                            onClick={() => setBilling('annual')}
                        >
                            {/* Recommended Badge */}
                            <div className="absolute top-6 right-6 flex items-center gap-2 bg-brand-green/20 border border-brand-green/30 rounded-full px-4 py-1.5">
                                <Crown className="w-3.5 h-3.5 text-brand-green" />
                                <span className="mono-os text-[8px] font-black text-brand-green tracking-[0.2em] uppercase">
                                    {t('pricing.recommended')}
                                </span>
                            </div>

                            <div className="relative z-10">
                                <h3 className="mono-os text-[10px] font-black text-brand-green tracking-[0.3em] uppercase mb-6">
                                    {t('pricing.annualTitle')}
                                </h3>
                                <div className="flex items-baseline gap-3 mb-2">
                                    <span className="text-5xl font-black text-white">ETB 153,000</span>
                                </div>
                                <div className="flex items-center gap-3 mb-8">
                                    <p className="mono-os text-[10px] font-black text-white/30 tracking-widest uppercase">
                                        {t('pricing.perYear')}
                                    </p>
                                    <span className="mono-os text-[9px] font-black text-brand-green bg-brand-green/10 px-3 py-1 rounded-full border border-brand-green/20">
                                        {t('pricing.save')} ETB 27,000
                                    </span>
                                </div>
                                <p className="serif-ital text-sm text-white/40 leading-relaxed">
                                    {t('pricing.annualDesc')}
                                </p>
                            </div>

                            {/* Glow effect */}
                            <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-brand-green/10 blur-[100px] rounded-full pointer-events-none" />
                        </div>
                    </div>

                    {/* Subscription Note */}
                    <p className="text-center serif-ital text-sm text-white/30 mt-12 max-w-lg mx-auto">
                        {t('pricing.subscriptionNote')}
                    </p>
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
