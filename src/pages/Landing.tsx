import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { MarketingLayout } from '../components/MarketingLayout';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  ArrowRight, 
  CheckCircle2, 
  ShieldCheck, 
  TrendingUp, 
  Clock, 
  Utensils, 
  QrCode, 
  Sparkles,
  Smartphone
} from 'lucide-react';

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

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  React.useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1));
      const errorCode = params.get('error_code');
      if (errorCode === 'otp_expired') {
        navigate('/login');
        return;
      }
    }

    if (user) {
      navigate('/app');
    }
  }, [user, navigate]);

  const cards = [
    { 
      tag: t('marketing.badge1') || 'ALL-IN-ONE', 
      title: t('marketing.feat1Title') || 'Fast Orders', 
      desc: t('marketing.feat1Desc') || 'Take and track orders instantly, from any table, without paper or confusion.',
      icon: Smartphone,
      swatchClass: 'bg-[#84e7a5]/20 text-[#02492a]'
    },
    { 
      tag: 'ALL 9 BANKS & WALLETS', 
      title: t('marketing.feat3Title') || 'Stop Fake Receipts', 
      desc: 'Instant verification ensures every customer receipt from CBE, Telebirr, Dashen, BOA, M-PESA & more is 100% genuine.',
      icon: ShieldCheck,
      swatchClass: 'bg-[#fbbd41]/30 text-[#0c0d0e]'
    },
    { 
      tag: 'KITCHEN KDS', 
      title: t('marketing.feat2Title') || 'Kitchen in Sync', 
      desc: t('marketing.feat2Desc') || 'The kitchen sees every order the moment it is placed — no tickets, no shouting.',
      icon: Utensils,
      swatchClass: 'bg-[#3bd3fd]/20 text-[#004d61]'
    },
    { 
      tag: 'REPORTS', 
      title: t('marketing.feat4Title') || 'Smart Reports', 
      desc: t('marketing.feat4Desc') || 'Know your best sellers, your busiest hours, and your real profit — every day.',
      icon: TrendingUp,
      swatchClass: 'bg-[#c1b0ff]/30 text-[#32037d]'
    },
    { 
      tag: 'PHASE 01', 
      title: t('marketing.seq1Title') || '1. Easy Setup', 
      desc: t('marketing.seq1Desc') || 'Get your restaurant on Baro OS in minutes. Add your menu, your tables, your team.',
      icon: Clock,
      swatchClass: 'bg-[#dad4c8]/40 text-[#0c0d0e]'
    },
    { 
      tag: 'PHASE 02', 
      title: t('marketing.seq2Title') || '2. Take Orders', 
      desc: t('marketing.seq2Desc') || 'Start taking orders. Everything flows — kitchen, inventory, and billing — in perfect sync.',
      icon: QrCode,
      swatchClass: 'bg-[#84e7a5]/20 text-[#02492a]'
    },
  ];

  return (
    <MarketingLayout>
      <div className="bg-[#faf9f7] text-[#0c0d0e] overflow-x-hidden">
        {/* HERO SECTION — CLAY WARM CREAM ARTISANAL CANVAS */}
        <section className="relative py-16 md:py-24 px-6 max-w-5xl mx-auto text-center">
          <div className="space-y-8">
            {/* Artisanal Clay Pill Tag */}
            <div className="inline-flex items-center gap-2 px-4.5 py-2 rounded-full bg-[#fbbd41] text-[#0c0d0e] border-2 border-[#0c0d0e] shadow-[-3px_3px_0px_#0c0d0e] text-xs sm:text-sm font-black font-mono tracking-wide">
              <Sparkles className="w-4 h-4 text-[#078a52]" />
              <span>{t('marketing.heroTag') || '🇪T #1 ETHIOPIAN RESTAURANT OS • ZERO PAPER TICKETS'}</span>
            </div>

            {/* Clay Headline with dramatic compression */}
            <h1 className="text-4xl sm:text-6xl lg:text-7xl font-bold text-[#0c0d0e] tracking-tight leading-[1.08] max-w-4xl mx-auto">
              {t('marketing.heroTitle1') || 'Manage Your Restaurant,'}{' '}
              <span className="bg-[#84e7a5] px-3 py-1 rounded-2xl inline-block mt-2 sm:mt-0 shadow-xs">
                {t('marketing.heroTitle2') || 'Not Paperwork'}
              </span>
            </h1>

            {/* Subtitle */}
            <p className="text-lg sm:text-xl text-[#55534e] font-normal leading-relaxed max-w-2xl mx-auto">
              All-in-one POS, kitchen display, stock control, and <span className="text-[#0c0d0e] font-bold">100% receipt verification across all Ethiopian banks & wallets</span>.{' '}
              <span className="text-[#0c0d0e] font-semibold">Simple, fast, and reliable.</span>
            </p>

            {/* Clay Playful Interactive Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
              <button 
                onClick={() => navigate('/book-demo')}
                className="clay-btn-primary text-base px-8 py-4 w-full sm:w-auto"
              >
                <span>{t('marketing.deltaCta') || 'Book a Free Demo'}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
              <button 
                onClick={() => navigate('/features')}
                className="clay-btn-outline text-base px-8 py-4 w-full sm:w-auto"
              >
                <span>{t('marketing.ctaProtocol') || 'See How It Works'}</span>
              </button>
            </div>

            {/* Trust Pills with Dashed Border Container */}
            <div className="p-4 rounded-2xl border border-dashed border-[#dad4c8] bg-white/60 max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#0c0d0e]">
                <CheckCircle2 className="w-4 h-4 text-[#078a52] shrink-0" />
                <span>All-in-One POS & KDS</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#0c0d0e]">
                <ShieldCheck className="w-4 h-4 text-[#078a52] shrink-0" />
                <span>All 9 Banks & Wallets</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#0c0d0e]">
                <TrendingUp className="w-4 h-4 text-[#078a52] shrink-0" />
                <span>24/7 Reliability</span>
              </div>
            </div>
          </div>
        </section>

        {/* CLAY NAMED SWATCH SECTION 1 — MATCHA GREEN STORY (ALL-BANK RECEIPT VERIFICATION) */}
        <section className="bg-[#84e7a5] text-[#02492a] py-20 border-y border-[#078a52]/20">
          <div className="max-w-7xl mx-auto px-6">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              
              <div className="lg:col-span-6 space-y-5">
                <span className="font-mono text-xs font-bold uppercase tracking-widest bg-[#078a52] text-white px-3 py-1 rounded-full">
                  SWATCH STORY • MATCHA
                </span>
                
                <h2 className="text-3xl sm:text-5xl font-extrabold text-[#02492a] tracking-tight leading-tight">
                  {t('marketing.fraudTitle') || 'Stop Screenshot Payment Fraud Across ALL Ethiopian Banks & Wallets'}
                </h2>

                <p className="text-base sm:text-lg text-[#02492a]/90 font-normal leading-relaxed">
                  {t('marketing.fraudDesc') || 'Our verification engine checks every receipt presented by customers before any order leaves your counter. Whether customers pay via bank transfer or mobile wallet, Baro OS instantly verifies genuine transactions and catches fake receipts.'}
                </p>

                <div className="p-4 rounded-2xl bg-white/40 border border-[#078a52]/30 text-sm font-semibold text-[#02492a]">
                  {t('marketing.fraudBanner') || '⚡ 100% Automatic Protection — Zero Fake Receipts. Zero Revenue Loss.'}
                </div>
              </div>

              {/* ALL 9 BANKS & WALLETS VERIFICATION CARD */}
              <div className="lg:col-span-6">
                <div className="bg-white text-[#0c0d0e] rounded-[32px] p-7 border-2 border-[#02492a] shadow-[0_8px_0px_#02492a] hover:-translate-y-2 transition-transform duration-300">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#dad4c8]">
                    <span className="font-mono text-xs font-bold uppercase text-[#078a52] flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4" /> {t('marketing.fraudCardBadge') || 'ALL 9 PAYMENT PROVIDERS VERIFIED'}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-[#84e7a5] text-[#02492a] font-mono text-[10px] font-bold">
                      {t('marketing.fraudCardTag') || 'LIVE AUDIT ENGINE'}
                    </span>
                  </div>

                  <h3 className="text-xl sm:text-2xl font-bold mb-3 text-[#0c0d0e]">
                    {t('marketing.fraudCardTitle') || 'Universal Ethiopian Receipt Verifier'}
                  </h3>

                  <p className="text-xs sm:text-sm text-[#55534e] mb-5 leading-relaxed">
                    {t('marketing.fraudCardDesc') || 'We verify transaction IDs & reference numbers across every major bank and mobile money platform in Ethiopia:'}
                  </p>

                  {/* Complete 9-Bank Brand Badge Matrix */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-6">
                    {ETHIOPIAN_PAYMENT_CHANNELS.map((chan) => (
                      <div
                        key={chan.name}
                        className={`${chan.bg} ${chan.text} px-3 py-2.5 rounded-xl flex items-center justify-between shadow-xs border border-black/10`}
                      >
                        <div className="flex flex-col">
                          <span className="text-xs font-bold leading-tight">{chan.short}</span>
                          <span className="text-[9px] opacity-80 leading-tight">{chan.name}</span>
                        </div>
                        <span className="text-xs font-black ml-1.5">✓</span>
                      </div>
                    ))}
                  </div>

                  <div className="p-3.5 rounded-xl bg-[#faf9f7] border border-[#dad4c8] flex items-center justify-between font-mono text-xs">
                    <span className="text-[#55534e]">{t('marketing.fraudCardAudit') || 'Cross-Bank Verification Audit:'}</span>
                    <span className="font-bold text-[#078a52]">{t('marketing.fraudCardStatus') || '✓ 100% PROTECTED'}</span>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>

        {/* CORE VALUE CARDS — ARTISANAL CLAY CARDS GRID */}
        <section className="py-24 px-6 max-w-7xl mx-auto">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="font-mono text-xs font-bold uppercase tracking-widest text-[#078a52] block mb-3">
              CRAFTED FOR ETHIOPIAN RESTAURANTS
            </span>
            <h2 className="text-3xl sm:text-5xl font-bold text-[#0c0d0e] tracking-tight mb-4">
              {t('marketing.streamTitle1') || 'Everything'} {t('marketing.streamTitle2') || 'Connected'}
            </h2>
            <p className="text-lg text-[#55534e]">
              {t('marketing.showcaseDesc') || 'Every order, every item, every staff action — one clear view. No more guessing what is happening on the floor.'}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {cards.map((card, idx) => {
              const IconComp = card.icon;
              return (
                <div 
                  key={idx} 
                  className="clay-card p-8 flex flex-col justify-between"
                >
                  <div>
                    <div className="flex items-center justify-between mb-6">
                      <span className={`font-mono text-xs font-bold px-3 py-1 rounded-full uppercase ${card.swatchClass}`}>
                        {card.tag}
                      </span>
                      <div className="w-11 h-11 rounded-2xl bg-[#faf9f7] border border-[#dad4c8] flex items-center justify-center text-[#0c0d0e]">
                        <IconComp className="w-5 h-5" />
                      </div>
                    </div>
                    <h3 className="text-2xl font-bold text-[#0c0d0e] mb-3">
                      {card.title}
                    </h3>
                    <p className="text-sm leading-relaxed text-[#55534e]">
                      {card.desc}
                    </p>
                  </div>
                  
                  <div className="pt-6 mt-6 border-t border-dashed border-[#dad4c8] flex items-center justify-between text-xs font-mono text-[#55534e]">
                    <span>Baro OS Protocol</span>
                    <span className="font-bold text-[#078a52]">READY</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* CLAY NAMED SWATCH SECTION 2 — LEMON GOLD STORY (GROWTH & DEMO) */}
        <section className="bg-[#fbbd41] text-[#0c0d0e] py-20 border-t border-[#dad4c8]">
          <div className="max-w-4xl mx-auto px-6 text-center space-y-6">
            <span className="font-mono text-xs font-bold uppercase tracking-widest bg-[#0c0d0e] text-white px-3 py-1 rounded-full inline-block">
              SWATCH STORY • LEMON GOLD
            </span>
            <h2 className="text-4xl sm:text-6xl font-bold tracking-tight">
              {t('marketing.deltaTitle1') || 'Get Started'} {t('marketing.deltaTitle2') || 'With Baro OS'}
            </h2>
            <p className="text-lg text-[#0c0d0e]/80 max-w-2xl mx-auto leading-relaxed">
              {t('marketing.deltaDesc') || 'Join forward-thinking Ethiopian restaurants running smoother and safer with Baro OS.'}
            </p>
            <div className="pt-4">
              <button 
                onClick={() => navigate('/book-demo')}
                className="clay-btn-primary text-lg px-10 py-5"
              >
                <span>{t('marketing.deltaCta') || 'Book a Free Demo'}</span>
                <ArrowRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </section>
      </div>
    </MarketingLayout>
  );
};

export default Landing;
