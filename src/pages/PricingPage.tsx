import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MarketingLayout } from '../components/MarketingLayout';
import { useLanguage } from '../contexts/LanguageContext';
import {
    ArrowRight,
    Check,
    Camera,
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
    Mail,
} from 'lucide-react';

const INCLUDED_FEATURES = [
    { icon: Layers, key: 'inventory', title: 'Inventory Control' },
    { icon: Utensils, key: 'recipe', title: 'Recipe & Ingredient Cost' },
    { icon: ClipboardList, key: 'po', title: 'Purchase Orders' },
    { icon: Monitor, key: 'kds', title: 'Kitchen Display (KDS)' },
    { icon: Users, key: 'waiter', title: 'Waiter POS App' },
    { icon: BarChart3, key: 'analytics', title: 'Daily Revenue Reports' },
    { icon: Wallet, key: 'telebirr', title: 'All 9 Banks & Wallets Audit' },
    { icon: ShieldCheck, key: 'verifier', title: 'Universal Receipt Verification' },
    { icon: Server, key: 'vps', title: 'VPS Cloud Hosting' },
    { icon: Sparkles, key: 'aesthetic', title: '24/7 Reliability' },
];

const PricingPage: React.FC = () => {
    const navigate = useNavigate();
    const { t } = useLanguage();

    const packageFeatures = [
        t('pricing.feat_unlimitedStaff') || 'Unlimited Staff Accounts',
        t('pricing.feat_fullPOS') || 'Full Operations POS System',
        t('pricing.feat_kds') || 'Kitchen Display System (KDS)',
        t('pricing.feat_liveTracking') || 'Live Table Tracking',
        t('pricing.feat_po') || 'Purchase Order System',
        t('pricing.feat_wasteAnalytics') || 'Waste & Loss Analytics',
        t('pricing.feat_qrPlates') || 'QR Code Menu Ordering',
        t('pricing.feat_verifier') || 'Fake Receipt Detection Engine',
        t('pricing.feat_vps') || 'Dedicated VPS Hosting'
    ];

    return (
        <MarketingLayout>
            <div className="bg-[#faf9f7] text-[#0c0d0e] py-16 md:py-24">
                {/* HERO SECTION */}
                <section className="max-w-4xl mx-auto px-6 text-center mb-16">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest bg-[#84e7a5] text-[#02492a] px-3 py-1.5 rounded-full inline-block mb-4">
                        {t('pricing.heroTag') || 'TRANSPARENT PRICING'}
                    </span>

                    <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-[#0c0d0e] mb-6">
                        {t('pricing.heroTitle1') || 'Transparent'}{' '}
                        <span className="text-[#078a52]">{t('pricing.heroTitle2') || 'Investment'}</span>
                    </h1>

                    <p className="text-base md:text-xl text-[#55534e] max-w-2xl mx-auto leading-relaxed">
                        {t('pricing.heroDesc') || 'No hidden fees. Designed for growth, accountability, and operational clarity.'}
                    </p>
                </section>

                {/* PRICING GRID */}
                <section className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch mb-20">
                    
                    {/* ONE-TIME SETUP CARD */}
                    <div className="lg:col-span-5 flex">
                        <div className="clay-card p-8 sm:p-10 w-full flex flex-col justify-between bg-white">
                            <div>
                                <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#078a52] block mb-3">
                                    {t('pricing.oneTimeTag') || 'ONE-TIME SETUP'}
                                </span>
                                <h3 className="text-2xl sm:text-3xl font-bold text-[#0c0d0e] mb-4">
                                    {t('pricing.oneTimeTitle1') || 'Data Preparation &'} {t('pricing.oneTimeTitle2') || 'Configuration'}
                                </h3>
                                <p className="text-sm text-[#55534e] leading-relaxed mb-6">
                                    {t('pricing.migrationDesc') || 'We properly organize your menu items, recipes, tables, staff profiles, and starting inventory into the system.'}
                                </p>
                            </div>

                            <div className="pt-6 border-t border-[#dad4c8] flex items-baseline justify-between">
                                <div>
                                    <span className="text-3xl font-bold text-[#0c0d0e]">ETB 20,000</span>
                                    <span className="text-xs font-mono text-[#55534e] block">ONE-TIME FEE</span>
                                </div>
                                <span className="text-xs bg-[#84e7a5]/30 text-[#02492a] font-mono font-bold px-3 py-1.5 rounded-full">
                                    FULL ONBOARDING
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* MONTHLY SAAS CARD WITH CLAY HARD OFFSET SHADOW */}
                    <div className="lg:col-span-7 flex">
                        <div className="bg-white border-2 border-[#0c0d0e] rounded-[32px] p-8 sm:p-12 w-full shadow-[-8px_8px_0px_#0c0d0e] flex flex-col justify-between">
                            <div>
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-8 border-b border-[#dad4c8]">
                                    <div>
                                        <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#078a52] block mb-1">
                                            {t('pricing.monthlyTitle') || 'MONTHLY SAAS PLAN'}
                                        </span>
                                        <h3 className="text-2xl sm:text-3xl font-bold text-[#0c0d0e]">
                                            Complete Restaurant OS
                                        </h3>
                                    </div>
                                    <div className="flex items-baseline gap-1.5">
                                        <span className="text-sm font-bold text-[#55534e]">ETB</span>
                                        <span className="text-4xl sm:text-5xl font-bold text-[#0c0d0e]">5,500</span>
                                        <span className="text-xs text-[#55534e]">/ month</span>
                                    </div>
                                </div>

                                <div className="py-8">
                                    <p className="font-mono text-xs font-bold text-[#55534e] uppercase tracking-wider mb-5">
                                        {t('pricing.subscriptionNote') || 'INCLUDED IN YOUR SUBSCRIPTION:'}
                                    </p>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {packageFeatures.map((feature, idx) => (
                                            <div
                                                key={idx}
                                                className="flex items-center gap-3 text-sm text-[#0c0d0e]"
                                            >
                                                <div className="w-5 h-5 rounded-full bg-[#84e7a5] text-[#02492a] flex items-center justify-center shrink-0">
                                                    <Check className="w-3.5 h-3.5" />
                                                </div>
                                                <span className="font-medium">{feature}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={() => navigate('/book-demo')}
                                className="clay-btn-primary w-full py-4 text-base"
                            >
                                <span>{t('pricing.ctaButton') || 'Book a Free Demo'}</span>
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </section>

                {/* INCLUDED MODULES GRID */}
                <section className="max-w-6xl mx-auto px-6 py-12">
                    <div className="text-center mb-12">
                        <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#078a52] block mb-2">
                            ALL MODULES INCLUDED
                        </span>
                        <h2 className="text-2xl sm:text-4xl font-bold text-[#0c0d0e]">
                            Everything Included at One Clear Price
                        </h2>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                        {INCLUDED_FEATURES.map((feat) => {
                            const Icon = feat.icon;
                            return (
                                <div
                                    key={feat.key}
                                    className="clay-card p-5 text-center flex flex-col items-center justify-center bg-white"
                                >
                                    <div className="w-10 h-10 rounded-xl bg-[#faf9f7] border border-[#dad4c8] flex items-center justify-center mb-3 text-[#078a52]">
                                        <Icon className="w-5 h-5" />
                                    </div>
                                    <span className="text-xs font-bold text-[#0c0d0e] leading-snug">
                                        {feat.title}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* BOTTOM CONTACT SECTION */}
                <section className="max-w-4xl mx-auto px-6 mt-16 text-center">
                    <div className="p-12 rounded-[40px] bg-[#3bd3fd] text-[#004d61] border-2 border-[#0c0d0e] shadow-[-6px_6px_0px_#0c0d0e]">
                        <h2 className="text-3xl sm:text-4xl font-bold text-[#0c0d0e] mb-4">
                            Have Questions About Setup?
                        </h2>
                        <p className="text-base text-[#0c0d0e]/80 max-w-lg mx-auto mb-8 font-medium">
                            Talk directly with our team in Addis Ababa. We will answer any questions about Telebirr integration and menu onboarding.
                        </p>
                        <div className="flex flex-wrap items-center justify-center gap-6">
                            <button
                                onClick={() => navigate('/book-demo')}
                                className="clay-btn-primary text-sm px-8 py-3.5"
                            >
                                <span>Book a Demo</span>
                            </button>
                            <a
                                href="mailto:flow@baroos.com"
                                className="font-mono text-sm font-bold text-[#0c0d0e] underline"
                            >
                                flow@baroos.com
                            </a>
                        </div>
                    </div>
                </section>
            </div>
        </MarketingLayout>
    );
};

export default PricingPage;
