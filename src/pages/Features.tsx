import React from 'react';
import { MarketingLayout } from '../components/MarketingLayout';
import { useLanguage } from '../contexts/LanguageContext';
import {
    Smartphone,
    Utensils,
    ShieldCheck,
    BarChart3,
    CheckCircle2,
    Layers,
    ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const ETHIOPIAN_PAYMENT_CHANNELS = [
  { name: 'Commercial Bank of Ethiopia', short: 'CBE', bg: 'bg-[#4A154B]', text: 'text-white' },
  { name: 'Telebirr', short: 'Telebirr', bg: 'bg-[#0084C6]', text: 'text-white' },
  { name: 'Dashen Bank', short: 'Dashen', bg: 'bg-[#183462]', text: 'text-white' },
  { name: 'Bank of Abyssinia', short: 'BOA', bg: 'bg-[#F2A900]', text: 'text-[#0c0d0e]' },
  { name: 'CBE Birr', short: 'CBE Birr', bg: 'bg-[#7A1C30]', text: 'text-white' },
  { name: 'Awash Bank', short: 'Awash', bg: 'bg-[#004B87]', text: 'text-white' },
  { name: 'MPESA', short: 'M-PESA', bg: 'bg-[#43B02A]', text: 'text-white' },
  { name: 'Siinqee Bank', short: 'Siinqee', bg: 'bg-[#007A3D]', text: 'text-white' },
  { name: 'Kaafi Ebirr', short: 'Kaafi Ebirr', bg: 'bg-[#E35205]', text: 'text-white' }
];

export const FeaturesPage: React.FC = () => {
    const { t } = useLanguage();
    const navigate = useNavigate();

    const featureCategories = [
        {
            swatchName: 'SWATCH • MATCHA GREEN',
            swatchBg: 'bg-[#84e7a5]',
            swatchText: 'text-[#02492a]',
            badge: t('features.cat1Badge') || 'ORDER & PAYMENT',
            title: t('features.cat1Title') || 'Fast POS & Table Orders',
            desc: t('features.cat1Desc') || 'Take orders directly at tables or counter with instant kitchen synchronization.',
            icon: Smartphone,
            items: [
                t('features.cat1Item1') || 'Direct table ordering via Waiter POS',
                t('features.cat1Item2') || 'Split bills and table transfers in 1 tap',
                t('features.cat1Item3') || 'Instant receipt printing & digital sharing'
            ]
        },
        {
            swatchName: 'SWATCH • SLUSHIE CYAN',
            swatchBg: 'bg-[#3bd3fd]',
            swatchText: 'text-[#004d61]',
            badge: t('features.cat2Badge') || 'KITCHEN MANAGEMENT',
            title: t('features.cat2Title') || 'Kitchen Display System (KDS)',
            desc: t('features.cat2Desc') || 'Direct digital orders sent instantly to kitchen screens. Zero paper tickets.',
            icon: Utensils,
            items: [
                t('features.cat2Item1') || 'Real-time order prep display screen',
                t('features.cat2Item2') || 'Visual alerts for delayed tickets',
                t('features.cat2Item3') || 'Seamless waiter notification when ready'
            ]
        },
        {
            swatchName: 'SWATCH • LEMON GOLD',
            swatchBg: 'bg-[#fbbd41]',
            swatchText: 'text-[#0c0d0e]',
            badge: t('features.cat_receipt_f3') || 'ALL 9 BANKS VERIFIED',
            title: t('features.card3Title') || 'Universal Receipt Verification',
            desc: t('features.cat_receipt_desc') || 'Stop fake payment screenshots. Instant verification across all 9 Ethiopian banks & wallets.',
            icon: ShieldCheck,
            isUniversalVerification: true,
            items: [
                t('features.cat_receipt_f1') || 'Instant check across all 9 providers',
                t('features.cat_receipt_f2') || 'Automatic screenshot fraud detection',
                t('features.cat_receipt_f4') || 'Zero cashier reconciliation errors'
            ]
        },
        {
            swatchName: 'SWATCH • UBE PURPLE',
            swatchBg: 'bg-[#c1b0ff]',
            swatchText: 'text-[#32037d]',
            badge: t('features.cat4Badge') || 'REPORTS & DATA',
            title: t('features.cat4Title') || 'Daily Sales & Profit Analytics',
            desc: t('features.cat4Desc') || 'Clear daily reports showing exact revenue, top-selling dishes, and real profit.',
            icon: BarChart3,
            items: [
                t('features.cat4Item1') || 'Live daily and monthly revenue dashboards',
                t('features.cat4Item2') || 'Item-by-item profit breakdown',
                t('features.cat4Item3') || 'Exportable financial summaries'
            ]
        },
        {
            swatchName: 'SWATCH • POMEGRANATE PINK',
            swatchBg: 'bg-[#fc7981]',
            swatchText: 'text-[#0c0d0e]',
            badge: t('features.cat5Badge') || 'BUSINESS CONTROL',
            title: t('features.cat5Title') || 'Inventory & Staff Management',
            desc: t('features.cat5Desc') || 'Track your stock and ingredients automatically with every dish sold.',
            icon: Layers,
            items: [
                t('features.cat5Item1') || 'Recipe-based automatic stock deduction',
                t('features.cat5Item2') || 'Staff shift logs and performance tracking',
                t('features.cat5Item3') || 'Supplier purchase order automation'
            ]
        }
    ];

    return (
        <MarketingLayout>
            <div className="bg-[#faf9f7] text-[#0c0d0e] py-16 md:py-24">
                {/* Header */}
                <div className="max-w-4xl mx-auto px-6 text-center mb-20">
                    <span className="font-mono text-xs font-bold uppercase tracking-widest bg-[#84e7a5] text-[#02492a] px-3 py-1.5 rounded-full inline-block mb-4">
                        {t('features.heroTag') || 'ALL FEATURES INCLUDED'}
                    </span>
                    <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-[#0c0d0e] mb-6">
                        {t('features.heroTitle1') || 'Built for Speed,'}{' '}
                        <span className="text-[#078a52]">{t('features.heroTitle2') || 'Clarity & Protection'}</span>
                    </h1>
                    <p className="text-lg text-[#55534e] max-w-2xl mx-auto leading-relaxed font-medium">
                        {t('features.heroDesc')}
                    </p>
                </div>

                {/* Alternating Clay Features List */}
                <div className="max-w-7xl mx-auto px-6 space-y-16">
                    {featureCategories.map((cat, idx) => {
                        const Icon = cat.icon;
                        return (
                            <div
                                key={idx}
                                className="clay-card p-8 sm:p-12 overflow-hidden relative"
                            >
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
                                    {/* Left Text */}
                                    <div className="lg:col-span-7 space-y-5">
                                        <div className="flex items-center gap-3">
                                            <span className={`font-mono text-xs font-bold px-3 py-1 rounded-full ${cat.swatchBg} ${cat.swatchText}`}>
                                                {cat.swatchName}
                                            </span>
                                            <span className="font-mono text-xs font-semibold text-[#55534e]">
                                                {cat.badge}
                                            </span>
                                        </div>

                                        <h2 className="text-3xl sm:text-4xl font-extrabold text-[#0c0d0e] leading-tight">
                                            {cat.title}
                                        </h2>

                                        <p className="text-base sm:text-lg text-[#55534e] leading-relaxed">
                                            {cat.desc}
                                        </p>

                                        <div className="space-y-3 pt-3">
                                            {cat.items.map((item, itemIdx) => (
                                                <div key={itemIdx} className="flex items-center gap-3">
                                                    <div className="w-5 h-5 rounded-full bg-[#84e7a5]/30 text-[#078a52] flex items-center justify-center shrink-0">
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                    </div>
                                                    <span className="text-sm font-medium text-[#0c0d0e]">
                                                        {item}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Right Artisanal Preview Card */}
                                    <div className="lg:col-span-5">
                                        {cat.isUniversalVerification ? (
                                          <div className="bg-white border-2 border-[#0c0d0e] rounded-[28px] p-6 sm:p-7 shadow-[-6px_6px_0px_#0c0d0e] space-y-4">
                                            <div className="flex items-center justify-between pb-3 border-b border-[#dad4c8]">
                                              <span className="font-mono text-xs font-bold text-[#078a52] flex items-center gap-1.5">
                                                <ShieldCheck className="w-4 h-4" /> ALL 9 PROVIDERS VERIFIED
                                              </span>
                                              <span className="px-2.5 py-0.5 rounded-full bg-[#84e7a5] text-[#02492a] font-mono text-[10px] font-bold">
                                                100% COVERAGE
                                              </span>
                                            </div>

                                            <h4 className="text-base font-bold text-[#0c0d0e]">
                                              Universal Ethiopian Payment Audit Matrix
                                            </h4>

                                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                              {ETHIOPIAN_PAYMENT_CHANNELS.map((chan) => (
                                                <div
                                                  key={chan.name}
                                                  className={`${chan.bg} ${chan.text} px-2.5 py-2 rounded-xl flex items-center justify-between text-xs font-bold shadow-xs`}
                                                >
                                                  <span>{chan.short}</span>
                                                  <span>✓</span>
                                                </div>
                                              ))}
                                            </div>

                                            <div className="p-3 rounded-xl bg-[#faf9f7] border border-[#dad4c8] flex items-center justify-between font-mono text-xs">
                                              <span>Verification Status:</span>
                                              <span className="font-bold text-[#078a52]">✓ GENUINE RECEIPT</span>
                                            </div>
                                          </div>
                                        ) : (
                                          <div className="bg-[#faf9f7] border border-dashed border-[#dad4c8] rounded-[28px] p-6 sm:p-8 space-y-4 hover:border-solid hover:border-[#0c0d0e] transition-all">
                                              <div className="flex items-center justify-between">
                                                  <div className="w-12 h-12 rounded-2xl bg-white border border-[#dad4c8] flex items-center justify-center text-[#0c0d0e]">
                                                      <Icon className="w-6 h-6" />
                                                  </div>
                                                  <span className="font-mono text-xs font-bold text-[#078a52] bg-[#84e7a5]/30 px-3 py-1 rounded-full">
                                                      SYSTEM LIVE
                                                  </span>
                                              </div>
                                              <h4 className="text-lg font-bold text-[#0c0d0e]">
                                                  {cat.title}
                                              </h4>
                                              <p className="text-xs font-mono text-[#55534e]">
                                                  Zero paperwork • Instant sync across waiter POS & kitchen screen
                                              </p>
                                          </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Bottom CTA Section */}
                <div className="max-w-5xl mx-auto px-6 mt-24">
                    <div className="bg-[#fbbd41] text-[#0c0d0e] rounded-[40px] p-10 sm:p-16 text-center space-y-6 border-2 border-[#0c0d0e] shadow-[-8px_8px_0px_#0c0d0e]">
                        <h2 className="text-3xl sm:text-5xl font-bold tracking-tight">
                            {t('features.bottomCtaTitle') || 'Ready to Modernize Your Restaurant?'}
                        </h2>
                        <p className="text-lg max-w-xl mx-auto font-normal">
                            {t('features.bottomCtaDesc') || 'Schedule a free demo and let our team get your restaurant running with zero paper tickets and full payment verification within 2 weeks.'}
                        </p>
                        <div className="pt-4">
                            <button
                                onClick={() => navigate('/book-demo')}
                                className="clay-btn-primary text-base px-10 py-4"
                            >
                                <span>{t('features.ctaButton') || 'Book a Free Demo'}</span>
                                <ArrowRight className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </MarketingLayout>
    );
};

export default FeaturesPage;
