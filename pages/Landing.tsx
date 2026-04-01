
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { MarketingLayout } from '../components/MarketingLayout';
import { Button, cn, showToast } from '../components/ui';
import { WaveDivider } from '../components/WaveDivider';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Cpu,
  Waves,
  BarChart3,
  ArrowRight,
  Layers,
  Zap,
  ShieldCheck,
  MousePointer2
} from 'lucide-react';

const EpicDashboardShowcase: React.FC<{ t: (path: string) => string }> = ({ t }) => {
  const highlights = [
    { title: t('marketing.feat1Title'), desc: t('marketing.feat1Desc'), icon: MousePointer2, color: 'text-brand-yellow' },
    { title: t('marketing.feat2Title'), desc: t('marketing.feat2Desc'), icon: Zap, color: 'text-brand-green' },
    { title: t('marketing.feat3Title'), desc: t('marketing.feat3Desc'), icon: Layers, color: 'text-brand-yellow' },
  ];

  return (
    <div className="relative w-full py-24 overflow-hidden group">
      {/* Background River Flow Layers */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-0 w-full h-[500px] -translate-y-1/2 opacity-20 blur-[100px] bg-brand-green/20 animate-pulse-slow" />
        <svg viewBox="0 0 1200 600" className="absolute top-0 left-0 w-full h-full opacity-10">
          <path
            d="M-200,300 Q200,100 600,300 T1400,300"
            fill="none"
            stroke="var(--primary)"
            strokeWidth="80"
            className="animate-[river-flow_15s_linear_infinite]"
          />
          <path
            d="M-200,400 Q200,200 600,400 T1400,400"
            fill="none"
            stroke="var(--brand-green)"
            strokeWidth="60"
            className="animate-[river-flow_10s_linear_infinite_reverse]"
          />
        </svg>
      </div>

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <div className="flex flex-col lg:flex-row items-center gap-16">
          {/* Text Content */}
          <div className="w-full lg:w-1/3">
            <span className="mono-os text-brand-yellow text-xs font-black mb-6 block tracking-[0.5em]">{t('marketing.showcaseTag')}</span>
            <h2 className="text-5xl md:text-6xl font-black uppercase tracking-tighter text-white mb-8 leading-none">
              {t('marketing.showcaseTitle1')} <br />
              <span className="serif-ital text-brand-green lowercase">{t('marketing.showcaseTitle2')}</span>
            </h2>
            <p className="serif-ital text-lg text-white/50 mb-12 max-w-sm">
              {t('marketing.showcaseDesc')}
            </p>
            <div className="space-y-6">
              {highlights.map((h, i) => (
                <div key={i} className="flex items-center gap-6 p-6 rounded-2xl bg-white/[0.02] border border-white/5 hover:border-primary/30 transition-all cursor-default group/item">
                  <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center ${h.color} group-hover/item:scale-110 transition-transform`}>
                    <h.icon className="w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-black text-white text-sm uppercase tracking-widest">{h.title}</h4>
                    <p className="text-[10px] text-white/40 font-bold uppercase">{h.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Epic Dashboard Visual */}
          <div className="w-full lg:w-2/3 perspective-[2500px] h-[600px] flex items-center justify-center relative">
            <div
              className="relative w-full h-[500px] transition-all duration-1000 group-hover:scale-105"
              style={{
                transform: 'rotateX(20deg) rotateZ(-10deg) rotateY(10deg)',
                transformStyle: 'preserve-3d'
              }}
            >
              {/* Main Dashboard Frame */}
              <div className="absolute inset-0 bg-[#0A0A0A] rounded-[2.5rem] border border-white/10 shadow-[0_50px_100px_rgba(0,0,0,0.8)] overflow-hidden flex backdrop-blur-3xl">
                {/* Sidebar Preview */}
                <div className="w-16 md:w-20 border-r border-white/5 flex flex-col items-center py-6 gap-6 shrink-0">
                  <div className="w-8 h-8 rounded-full bg-brand-green/20 border border-brand-green/30" />
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className={cn("w-6 h-6 rounded-lg bg-white/5 border border-white/5", i === 1 && "bg-primary/20 border-primary/30")} />
                  ))}
                </div>

                {/* Main Content Area */}
                <div className="flex-1 flex flex-col p-6 gap-6 overflow-hidden">
                  <div className="flex justify-between items-center mb-2">
                    <div className="h-8 w-48 bg-white/5 rounded-full" />
                    <div className="flex gap-4">
                      <div className="h-10 w-10 rounded-xl bg-white/5 border border-white/10" />
                      <div className="h-10 w-32 rounded-full bg-primary/20 border border-primary/40 shadow-[0_0_15px_rgba(255,184,0,0.2)]" />
                    </div>
                  </div>

                  <div className="grid grid-cols-4 gap-4">
                    {[
                      { label: 'Proposals', val: '0', color: 'text-primary' },
                      { label: 'Audit', val: '43', color: 'text-white' },
                      { label: 'Savings', val: 'ETB 14k', color: 'text-primary' },
                      { label: 'Reliability', val: '99.2%', color: 'text-purple-400' }
                    ].map((metric, i) => (
                      <div key={i} className="p-4 rounded-2xl bg-white/[0.03] border border-white/5 flex flex-col">
                        <span className="text-[8px] font-black text-white/30 uppercase tracking-widest">{metric.label}</span>
                        <span className={cn("text-lg font-black mt-1", metric.color)}>{metric.val}</span>
                      </div>
                    ))}
                  </div>

                  <div className="flex-1 rounded-2xl bg-white/[0.02] border border-white/5 p-4 flex flex-col gap-3 min-h-0">
                    <div className="flex justify-between border-b border-white/5 pb-2">
                      <div className="h-3 w-16 bg-white/10 rounded" />
                      <div className="h-3 w-16 bg-white/10 rounded" />
                      <div className="h-3 w-16 bg-white/10 rounded" />
                    </div>
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="flex justify-between items-center group/row">
                        <div className="h-2 w-12 bg-white/5 rounded" />
                        <div className="flex items-center gap-2">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                          <div className="h-2 w-8 bg-white/5 rounded" />
                        </div>
                        <div className="h-4 w-20 bg-white/5 rounded-full border border-white/5" />
                        <div className="h-2 w-8 bg-primary/30 rounded" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Floating Accents */}
              <div
                className="absolute -top-10 -right-4 p-6 rounded-3xl bg-brand-green/20 backdrop-blur-xl border border-brand-green/40 shadow-2xl"
                style={{ transform: 'translateZ(100px)' }}
              >
                <Zap className="w-8 h-8 text-brand-green animate-pulse" />
              </div>
              <div
                className="absolute -bottom-10 -left-4 p-8 rounded-full bg-primary/10 backdrop-blur-2xl border border-primary/20 shadow-[0_0_40px_rgba(255,184,0,0.15)]"
                style={{ transform: 'translateZ(150px)' }}
              >
                <BarChart3 className="w-10 h-10 text-primary animate-bounce-slow" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();

  // Auto-redirect to dashboard if already logged in OR handle errors
  React.useEffect(() => {
    // Check for error fragment from Supabase (Magic Link failure)
    const hash = window.location.hash;
    if (hash.includes('error=')) {
      const params = new URLSearchParams(hash.substring(1));
      const errorCode = params.get('error_code');
      if (errorCode === 'otp_expired') {
        showToast("Authentication Error: The link has expired or was already used.", "error");
        navigate('/login');
        return;
      }
    }

    if (user) {
      navigate('/app');
    }
  }, [user, navigate]);

  const sequence = [
    { num: '01', title: t('marketing.seq1Title'), desc: t('marketing.seq1Desc'), icon: Cpu },
    { num: '02', title: t('marketing.seq2Title'), desc: t('marketing.seq2Desc'), icon: Waves },
    { num: '03', title: t('marketing.seq3Title'), desc: t('marketing.seq3Desc'), icon: BarChart3 },
  ];

  return (
    <MarketingLayout>
      {/* 🌋 PHASE I: THE SOURCE (Hero) */}
      <section className="relative min-h-screen flex flex-col items-center justify-center pt-20 overflow-hidden bg-black liquid-bg">
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
        <div className="absolute top-[10%] left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brand-green/30 to-transparent blur-[2px] pointer-events-none" />
        <div className="absolute top-[30%] right-[10%] w-[500px] h-[500px] bg-brand-yellow/10 blur-[150px] rounded-full pointer-events-none animate-pulse-slow mix-blend-screen" />

        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <p className="mono-os text-brand-green text-xs font-black tracking-[0.5em] mb-12 animate-in fade-in slide-in-from-bottom-4 duration-1000">
            {t('marketing.heroTag')}
          </p>

          <h1 className="text-7xl sm:text-9xl md:text-[10rem] font-black uppercase tracking-tighter leading-[0.8] mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200 text-white text-glow-primary">
            {t('marketing.heroTitle1')} <br />
            <span className="serif-ital text-brand-green lowercase">{t('marketing.heroTitle2')}</span>
          </h1>

          <p className="serif-ital text-2xl md:text-3xl text-white/90 max-w-2xl mx-auto mb-16 leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
            {t('marketing.heroDesc')}{' '}
            <span className="mono-os text-brand-yellow text-sm tracking-[0.2em] font-black underline decoration-brand-green/30 underline-offset-8">{t('marketing.heroAccent')}</span>.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-8 animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-700">
            <Button
              size="lg"
              onClick={() => navigate('/book-demo')}
              className="px-16 h-20 bg-brand-yellow hover:bg-white text-black font-black uppercase tracking-widest text-xs rounded-full shadow-[0_20px_60px_rgba(255,184,0,0.2)] flex items-center gap-4 group transition-all ripple-link"
            >
              {t('marketing.ctaStart')}
              <Waves className="w-5 h-5 group-hover:scale-125 transition-transform" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/features')}
              className="px-16 h-20 border-white/20 hover:border-brand-green text-white font-black uppercase tracking-widest text-xs rounded-full hover:bg-brand-green/10 transition-all font-mono ripple-link"
            >
              {t('marketing.ctaProtocol')}
            </Button>
          </div>
        </div>

        <WaveDivider variant="strong" color="fill-brand-blue/30" />
      </section>

      {/* 🚣 PHASE II: THE STREAM (OPERATIONS) */}
      <section className="relative py-48 bg-brand-blue/30 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row items-end justify-between gap-12 mb-32">
            <div className="max-w-2xl">
              <span className="mono-os text-brand-yellow text-xs font-black mb-6 block">{t('marketing.streamTag')}</span>
              <h2 className="text-6xl md:text-8xl font-black uppercase tracking-tighter text-white leading-[0.9]">
                {t('marketing.streamTitle1')} <br />
                <span className="serif-ital text-brand-green lowercase">{t('marketing.streamTitle2')}</span>
              </h2>
            </div>
            <p className="serif-ital text-xl text-white/50 max-w-sm mb-4">
              {t('marketing.streamQuote')}
            </p>
          </div>

          <EpicDashboardShowcase t={t} />
        </div>
      </section>

      {/* 🧭 THE JOURNEY SEQUENCE */}
      <section className="relative pt-32 pb-24 md:pt-48 md:pb-32 overflow-hidden liquid-bg">
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />
        <WaveDivider position="top" color="fill-brand-blue/30" />

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center mb-40">
            <h2 className="text-5xl md:text-7xl font-black uppercase tracking-tighter text-white">
              {t('marketing.journeyTitle1')} <br />
              <span className="serif-ital text-brand-yellow lowercase">{t('marketing.journeyTitle2')}</span>
            </h2>
          </div>

          <div className="grid md:grid-cols-3 gap-24 relative">
            <div className="hidden md:block absolute top-[48px] left-[15%] right-[15%] h-[1px] bg-gradient-to-r from-transparent via-brand-green/20 to-transparent" />

            {sequence.map((s) => (
              <div key={s.num} className="relative group text-center">
                <div className="mono-os text-8xl md:text-9xl font-black text-white/[0.02] absolute -top-16 left-1/2 -translate-x-1/2 pointer-events-none group-hover:text-brand-green/5 transition-colors duration-1000">
                  {s.num}
                </div>
                <div className="w-24 h-24 rounded-full bg-brand-green/5 border border-brand-green/10 flex items-center justify-center mx-auto mb-10 group-hover:scale-110 group-hover:bg-brand-green/20 transition-all duration-700">
                  <s.icon className="w-10 h-10 text-brand-green" />
                </div>
                <h3 className="text-3xl font-black uppercase tracking-tighter mb-4 text-white">
                  {s.title}
                </h3>
                <p className="serif-ital text-sm text-white/50 leading-relaxed max-w-[240px] mx-auto">
                  {s.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 🗺️ PHASE III: THE DELTA (INTELLIGENCE) */}
      <section className="relative py-64 overflow-hidden bg-gradient-to-b from-black via-brand-blue/20 to-black">
        <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")` }} />

        <div className="max-w-5xl mx-auto px-6 text-center relative z-10">
          <span className="mono-os text-brand-yellow text-xs font-black mb-8 block tracking-[0.8em]">{t('marketing.deltaTag')}</span>
          <h2 className="text-7xl md:text-[10rem] font-black uppercase tracking-tighter mb-16 text-white leading-none">
            {t('marketing.deltaTitle1')} <br />
            <span className="serif-ital text-brand-green lowercase">{t('marketing.deltaTitle2')}</span>
          </h2>

          <p className="serif-ital text-2xl md:text-3xl text-white/60 max-w-3xl mx-auto mb-20 leading-relaxed">
            {t('marketing.deltaDesc')}
          </p>

          <Button
            size="lg"
            onClick={() => navigate('/book-demo')}
            className="px-20 h-24 bg-brand-yellow hover:bg-white text-black font-black uppercase tracking-[0.3em] text-[10px] rounded-full shadow-2xl shadow-brand-yellow/20 group transition-all"
          >
            {t('marketing.deltaCta')}
            <ArrowRight className="w-5 h-5 ml-6 group-hover:translate-x-4 transition-transform" />
          </Button>

          <div className="mt-32 flex flex-wrap justify-center gap-x-20 gap-y-12">
            {[
              { label: t('marketing.badge1'), icon: ShieldCheck },
              { label: t('marketing.badge2'), icon: Zap },
              { label: t('marketing.badge3'), icon: BarChart3 }
            ].map(item => (
              <div key={item.label} className="flex items-center gap-4 group cursor-default">
                <item.icon className="w-5 h-5 text-brand-green group-hover:scale-125 transition-transform" />
                <span className="mono-os text-[10px] text-white/40 font-black">{item.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Landing;
