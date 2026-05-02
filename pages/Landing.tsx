import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { MarketingLayout } from '../components/MarketingLayout';
import { useLanguage } from '../contexts/LanguageContext';

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
    { tag: 'OPERATIONS', title: t('marketing.feat1Title'), desc: t('marketing.feat1Desc') },
    { tag: 'SPEED', title: t('marketing.feat2Title'), desc: t('marketing.feat2Desc') },
    { tag: 'ARCHITECTURE', title: t('marketing.feat3Title'), desc: t('marketing.feat3Desc') },
    { tag: 'PHASE 01', title: t('marketing.seq1Title'), desc: t('marketing.seq1Desc') },
    { tag: 'PHASE 02', title: t('marketing.seq2Title'), desc: t('marketing.seq2Desc') },
    { tag: 'PHASE 03', title: t('marketing.seq3Title'), desc: t('marketing.seq3Desc') },
  ];

  return (
    <MarketingLayout>
      <div className="bg-background min-h-screen text-foreground overflow-x-hidden transition-colors duration-500">
        {/* Hero Section */}
        <section className="relative pt-[32px] md:pt-[80px] pb-[24px] md:pb-[32px] px-4 md:px-8 max-w-[1440px] mx-auto flex flex-col items-center text-center min-h-[calc(100vh-64px)] justify-center">
          <div className="flex flex-col items-center z-10 relative w-full">
            <p className="text-foreground/70 text-[11px] md:text-[14px] mb-2 md:mb-4 max-w-2xl font-mono uppercase tracking-widest">
              {t('marketing.heroTag')}
            </p>
            <h1 className="text-[44px] sm:text-[56px] md:text-[88px] leading-[1.05] md:leading-[1.0] tracking-[-1.5px] md:tracking-[-3.5px] font-normal text-foreground mb-4 md:mb-6 max-w-5xl mx-auto">
              {t('marketing.heroTitle1')} {t('marketing.heroTitle2')}
            </h1>
            <p className="text-[14px] md:text-[18px] text-foreground/70 max-w-xl leading-[1.4] md:leading-[1.5] mb-6 md:mb-8 px-4">
              {t('marketing.heroDesc')} {t('marketing.heroAccent')}
            </p>
            
            <div className="flex flex-col sm:flex-row items-center gap-3 md:gap-4 w-full sm:w-auto px-6">
              <button 
                onClick={() => navigate('/book-demo')}
                className="bg-[#f36458] text-white hover:bg-[#0052ef] w-full sm:w-auto px-6 py-3 md:px-8 md:py-3.5 rounded-[99999px] font-medium text-[14px] md:text-[15px] transition-colors"
              >
                {t('marketing.ctaStart')}
              </button>
              <button 
                onClick={() => navigate('/features')}
                className="bg-background text-foreground/70 border border-foreground/10 hover:bg-[#0052ef] hover:text-white w-full sm:w-auto px-6 py-3 md:px-8 md:py-3.5 rounded-[99999px] font-medium text-[14px] md:text-[15px] transition-colors"
              >
                {t('marketing.ctaProtocol')}
              </button>
            </div>
          </div>

          {/* Raycast-style Dashboard Mockup */}
          <div className="mt-8 md:mt-12 w-full max-w-[1000px] mx-auto relative group z-20">
            {/* Warm glow behind the dashboard - Desktop only or simplified */}
            <div className="absolute inset-0 bg-[#d7c9af] opacity-[0.04] blur-[80px] pointer-events-none rounded-full hidden md:block" />
            
            {/* The Dashboard Card */}
            <div 
              className="relative w-full bg-card rounded-[8px] md:rounded-[10px] border border-foreground/10 overflow-hidden text-left shadow-2xl"
            >
              {/* Header / Search Area */}
              <div className="flex items-center gap-2 md:gap-3 px-3 md:px-5 py-2 md:py-3.5 border-b border-foreground/10 bg-card">
                <div className="flex gap-1.5 md:gap-2">
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#FF6363] border border-[#FF6363]/30 shadow-[0_0_8px_rgba(255,99,99,0.4)]" />
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#ffbc33] border border-[#ffbc33]/30" />
                  <div className="w-2.5 h-2.5 md:w-3 md:h-3 rounded-full bg-[#5fc992] border border-[#5fc992]/30" />
                </div>
                <div className="ml-2 md:ml-4 flex-1 flex items-center">
                  <div className="h-4 md:h-5 w-32 md:w-48 bg-foreground/5 rounded-[4px] border border-foreground/5 shadow-[inset_0_1px_2px_rgba(0,0,0,0.1)]" />
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex h-[200px] sm:h-[260px] md:h-[400px]">
                {/* Sidebar - Hidden on mobile */}
                <div className="hidden md:flex w-56 border-r border-foreground/5 p-3 flex-col gap-1 bg-foreground/5">
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-foreground/50 uppercase tracking-widest mt-1">Favorites</div>
                  {[1, 2, 3].map(i => (
                    <div key={i} className={`flex items-center gap-3 px-3 py-1.5 rounded-[6px] hover:bg-foreground/5 cursor-default transition-colors ${i === 1 ? 'bg-foreground/5' : ''}`}>
                      <div className="w-3.5 h-3.5 bg-foreground/10 rounded-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] flex items-center justify-center">
                        <div className="w-1.5 h-1.5 rounded-[1px] bg-foreground/40" />
                      </div>
                      <div className={`h-2.5 w-20 rounded-[2px] ${i === 1 ? 'bg-foreground/90' : 'bg-foreground/40'}`} />
                    </div>
                  ))}
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-foreground/50 uppercase tracking-widest mt-4">Extensions</div>
                  {[4, 5, 6, 7].map(i => (
                    <div key={i} className="flex items-center gap-3 px-3 py-1.5 rounded-[6px] hover:bg-foreground/5 cursor-default transition-colors">
                      <div className="w-3.5 h-3.5 bg-foreground/5 rounded-[3px]" />
                      <div className="h-2.5 w-24 bg-foreground/40 rounded-[2px]" />
                    </div>
                  ))}
                </div>

                {/* Main Panel */}
                <div className="flex-1 p-3 md:p-6 flex flex-col gap-3 md:gap-5 bg-card">
                  {/* Dashboard Metrics */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 md:gap-3">
                    {[
                      { val: '24.5k', color: 'bg-[#55b3ff]' },
                      { val: '99.9%', color: 'bg-[#5fc992]' },
                      { val: '43', color: 'bg-[#ffbc33]', hiddenMobile: true },
                      { val: '12m', color: 'bg-foreground/80', hiddenMobile: true }
                    ].map((metric, i) => (
                      <div key={i} className={`p-2.5 md:p-4 rounded-[6px] bg-foreground/[0.015] border border-foreground/[0.03] shadow-sm ${metric.hiddenMobile ? 'hidden md:block' : 'block'}`}>
                        <div className="text-[9px] md:text-[11px] font-medium text-foreground/50 mb-1.5 md:mb-2 uppercase tracking-wider">Metric {i + 1}</div>
                        <div className="text-[16px] md:text-[20px] font-bold text-foreground mb-1.5 md:mb-2 font-mono tracking-tight">{metric.val}</div>
                        <div className={`h-[2px] md:h-[3px] w-8 md:w-12 ${metric.color} rounded-full opacity-80`} />
                      </div>
                    ))}
                  </div>

                  {/* List View / Data Table */}
                  <div className="flex-1 rounded-[6px] bg-foreground/[0.01] border border-foreground/[0.03] p-2 md:p-3 flex flex-col overflow-hidden">
                    <div className="flex justify-between pb-2 md:pb-3 border-b border-foreground/[0.03] px-1 md:px-2">
                      <div className="h-1.5 md:h-2 w-12 md:w-16 bg-foreground/30 rounded-[2px]" />
                      <div className="h-1.5 md:h-2 w-10 md:w-12 bg-foreground/30 rounded-[2px]" />
                      <div className="h-1.5 md:h-2 w-16 md:w-20 bg-foreground/30 rounded-[2px] hidden md:block" />
                    </div>
                    <div className="flex-1 overflow-hidden flex flex-col gap-[2px] mt-1 md:mt-2">
                      {[1, 2, 3, 4].map(i => (
                        <div key={i} className="flex justify-between items-center py-1.5 md:py-2.5 group/row hover:bg-foreground/[0.02] px-1 md:px-2 rounded-[4px] transition-colors border border-transparent hover:border-foreground/[0.03]">
                          <div className="flex items-center gap-2 md:gap-3">
                            <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#5fc992] shadow-[0_0_6px_rgba(95,201,146,0.4)]" />
                            <div className="h-2 md:h-2.5 w-20 md:w-32 bg-foreground/90 rounded-[2px]" />
                          </div>
                          <div className="h-2 md:h-2.5 w-12 md:w-16 bg-foreground/40 rounded-[2px]" />
                          <div className="hidden md:flex items-center justify-center h-5 px-2.5 bg-foreground/[0.04] rounded-[3px] border border-foreground/[0.06] shadow-sm">
                            <div className="h-1.5 w-8 bg-foreground/30 rounded-full" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Unified Card Grid Section */}

        <section className="py-[64px] md:py-[120px] px-8 max-w-[1440px] mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cards.map((card, idx) => (
              <div 
                key={idx} 
                className="bg-card border border-foreground/10 rounded-[6px] p-[32px] flex flex-col hover:border-foreground/40 transition-colors group cursor-default"
              >
                <span className="font-mono text-[13px] text-foreground/50 uppercase mb-8 group-hover:text-[#0052ef] transition-colors">
                  {card.tag}
                </span>
                <h3 className="text-[24px] font-normal leading-[1.24] tracking-[-0.24px] text-foreground mb-4">
                  {card.title}
                </h3>
                <p className="text-[15px] leading-[1.5] text-foreground/70">
                  {card.desc}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA Section */}
        <section className="py-[120px] px-8 max-w-[1440px] mx-auto text-center border-t border-foreground/10">
          <h2 className="text-[48px] md:text-[72px] leading-[1.05] tracking-[-1.68px] md:tracking-[-2.88px] font-normal text-foreground mb-8">
            {t('marketing.deltaTitle1')} {t('marketing.deltaTitle2')}
          </h2>
          <p className="text-[18px] text-foreground/70 leading-[1.5] max-w-2xl mx-auto mb-10">
            {t('marketing.deltaDesc')}
          </p>
          <button 
            onClick={() => navigate('/book-demo')}
            className="bg-[#f36458] text-white hover:bg-[#0052ef] px-8 py-4 rounded-[99999px] font-normal text-[16px] transition-colors"
          >
            {t('marketing.deltaCta')}
          </button>
        </section>
      </div>
    </MarketingLayout>
  );
};

export default Landing;
