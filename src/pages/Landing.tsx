import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { MarketingLayout } from '../components/MarketingLayout';
import { useLanguage } from '../contexts/LanguageContext';
import { Search, ArrowRight } from 'lucide-react';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [searchQuery, setSearchQuery] = React.useState('');

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/book-demo?venue=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      navigate('/book-demo');
    }
  };

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
        {/* Hero Section - Futuristic Tablet OS Screen Mockup */}
        <section className="relative py-8 md:py-16 px-4 sm:px-6 lg:px-8 max-w-[1440px] mx-auto min-h-[calc(100vh-64px)] flex items-center justify-center">
          {/* Subtle Ambient Glow behind display */}
          <div className="absolute inset-0 bg-gradient-to-tr from-emerald-500/10 via-teal-500/5 to-transparent blur-[120px] pointer-events-none" />
          
          {/* Tablet Stand Mount Accents (Left & Right Clamps) */}
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 w-3 h-32 bg-gradient-to-r from-[#202328] to-[#0f1115] rounded-l-md border-y border-l border-white/20 shadow-2xl hidden lg:block z-10" />
          <div className="absolute -right-1 top-1/2 -translate-y-1/2 w-3 h-32 bg-gradient-to-l from-[#202328] to-[#0f1115] rounded-r-md border-y border-r border-white/20 shadow-2xl hidden lg:block z-10" />

          {/* The Tablet / Display Frame */}
          <div className="relative w-full max-w-[1240px] bg-[#06080a] rounded-2xl sm:rounded-[24px] border border-white/15 shadow-[0_30px_100px_-20px_rgba(0,0,0,0.95),0_0_60px_rgba(16,185,129,0.18)] overflow-hidden flex flex-col text-left min-h-[580px] md:min-h-[640px] transition-all duration-500 z-20">
            
            {/* Top Internal Screen Navigation Bar */}
            <div className="flex items-center justify-between px-6 md:px-10 py-4 md:py-5 border-b border-white/[0.08] bg-[#080a0d]/90 backdrop-blur-md z-30 relative select-none">
              <div className="flex items-center gap-8">
                {/* Brand Logo inside display */}
                <div className="flex items-center gap-2.5 cursor-pointer" onClick={() => navigate('/')}>
                  <div className="w-5 h-5 rounded-[4px] bg-gradient-to-br from-emerald-400 to-green-600 shadow-[0_0_12px_rgba(52,211,153,0.6)] flex items-center justify-center">
                    <div className="w-2 h-2 bg-white rounded-[1px]" />
                  </div>
                  <span className="text-white font-bold tracking-tight text-lg">Baro<span className="text-emerald-400 font-light">OS</span></span>
                </div>

                {/* Internal Nav Links */}
                <div className="hidden lg:flex items-center gap-7">
                  {['Features', 'Operations', 'Kitchen', 'Security', 'Pricing'].map((item, idx) => (
                    <span
                      key={item}
                      onClick={() => navigate(idx === 4 ? '/pricing' : '/features')}
                      className="text-[13px] text-gray-400 hover:text-white transition-colors cursor-pointer font-normal"
                    >
                      {item}
                    </span>
                  ))}
                </div>
              </div>

              {/* Right Side Actions inside display */}
              <div className="flex items-center gap-4 text-[13px]">
                <span onClick={() => navigate('/features')} className="text-gray-400 hover:text-white transition-colors cursor-pointer hidden sm:block">Deals</span>
                <span onClick={() => navigate('/book-demo')} className="text-gray-400 hover:text-white transition-colors cursor-pointer hidden sm:block">Help</span>
                <button
                  onClick={() => navigate('/login')}
                  className="bg-white hover:bg-gray-100 text-[#080a0d] px-4 py-1.5 rounded-full font-semibold transition-all shadow-sm active:scale-95 ml-1"
                >
                  Sign In
                </button>
              </div>
            </div>

            {/* Main 2-Column Hero Content */}
            <div className="relative flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden bg-gradient-to-br from-[#06080a] via-[#090d10] to-[#050709]">
              
              {/* Left Column: Text & Search Input Bar */}
              <div className="lg:col-span-7 z-20 flex flex-col justify-center p-6 sm:p-10 lg:p-14 lg:pr-6">
                
                {/* Pill Tag */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[6px] bg-white/[0.06] border border-white/10 text-emerald-400 text-[11px] font-mono uppercase tracking-wider mb-6 w-fit shadow-inner">
                  <span>{t('marketing.heroTag') || 'BARO OS 2.0 • INTRODUCING AGENTIC HOSPITALITY'}</span>
                </div>

                {/* Main Headline */}
                <h1 className="text-[34px] sm:text-[46px] lg:text-[56px] xl:text-[62px] font-semibold text-white tracking-[-1.2px] lg:tracking-[-2px] leading-[1.08] mb-5 font-sans">
                  {t('marketing.heroTitle1') || 'Secure operations'} <br className="hidden sm:inline" />
                  <span className="text-white/95">{t('marketing.heroTitle2') || 'without the hassles'}</span>
                </h1>

                {/* Subtitle */}
                <p className="text-[14px] sm:text-[16px] text-gray-400/90 font-normal leading-[1.6] max-w-lg mb-8">
                  {t('marketing.heroDesc') || 'AI-powered hospitality management from $0.00 setup for the first year with full agentic oversight and 24/7 reliability.'} {t('marketing.heroAccent')}
                </p>

                {/* Interactive Search Input Box */}
                <form 
                  onSubmit={handleSearchSubmit}
                  className="flex items-center bg-[#11141a]/95 border border-white/15 rounded-xl p-1.5 max-w-lg shadow-[0_15px_35px_rgba(0,0,0,0.6)] focus-within:border-emerald-500/60 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all backdrop-blur-md"
                >
                  <div className="pl-3.5 pr-2 text-gray-400">
                    <Search className="w-4 h-4 text-emerald-400" />
                  </div>
                  <input 
                    type="text" 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Type the venue name you want..." 
                    className="bg-transparent text-white placeholder:text-gray-500 text-[14px] w-full focus:outline-none px-1 py-2 sm:py-2.5 font-normal"
                  />
                  <button 
                    type="submit"
                    className="bg-white hover:bg-gray-100 text-[#06080a] font-semibold px-4 sm:px-6 py-2.5 rounded-lg text-[13px] whitespace-nowrap transition-all shadow-md active:scale-95 flex items-center gap-1.5"
                  >
                    <span>Search Venue</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>

              </div>

              {/* Right Column: Glowing Emerald Light Leak & Matrix Data Stream */}
              <div className="lg:col-span-5 absolute inset-0 lg:relative z-10 overflow-hidden pointer-events-none lg:pointer-events-auto flex items-center justify-center">
                
                {/* Left fade gradient for smooth blending */}
                <div className="absolute inset-0 bg-gradient-to-r from-[#06080a] via-[#06080a]/85 lg:via-transparent to-transparent z-10" />
                
                {/* Glowing Light Bursts (The Green Data Stream Glow) */}
                <div className="absolute right-[-15%] top-[15%] w-[350px] sm:w-[500px] lg:w-[600px] h-[350px] sm:h-[500px] lg:h-[600px] bg-gradient-to-tr from-emerald-500/40 via-teal-400/25 to-transparent rounded-full blur-[80px] lg:blur-[100px] animate-pulse duration-1000" />
                <div className="absolute right-[10%] top-[30%] w-[200px] sm:w-[300px] h-[200px] sm:h-[300px] bg-gradient-to-r from-yellow-100/40 via-emerald-300/40 to-transparent rounded-full blur-[60px]" />
                <div className="absolute right-0 bottom-0 w-[400px] h-[400px] bg-gradient-to-tl from-emerald-600/30 via-transparent to-transparent rounded-full blur-[90px]" />

                {/* Vertical Laser / Ray Leak Effect */}
                <div className="absolute inset-0 bg-[linear-gradient(115deg,_transparent_30%,_rgba(16,185,129,0.15)_45%,_rgba(52,211,153,0.25)_50%,_rgba(16,185,129,0.1)_55%,_transparent_70%)] opacity-80" />

                {/* Animated Digital Matrix Code Columns */}
                <div className="absolute inset-0 flex justify-end items-center opacity-75 select-none pr-6 sm:pr-10 gap-3 sm:gap-6 font-mono text-[10px] sm:text-[11px] overflow-hidden z-0">
                  
                  {/* Column 1 */}
                  <div className="flex flex-col gap-2 text-emerald-400/35 animate-[translateY_25s_linear_infinite]">
                    <div>01001001</div>
                    <div className="text-emerald-200/95 font-bold drop-shadow-[0_0_8px_rgba(52,211,153,0.9)]">8820 1198</div>
                    <div>0019 8472</div>
                    <div>SYS_OK 200</div>
                    <div>99.98% OPS</div>
                    <div className="text-white font-semibold tracking-wider">ZERO CHAOS</div>
                    <div>4819 0021</div>
                    <div>11001010</div>
                    <div>POS_ACTIVE</div>
                    <div className="text-emerald-300 font-medium">8492 1102</div>
                    <div>01100100</div>
                    <div>7721 9901</div>
                  </div>

                  {/* Column 2 */}
                  <div className="flex flex-col gap-2.5 text-emerald-500/30 font-light pt-14 animate-[translateY_20s_linear_infinite_reverse]">
                    <div>4920 1102</div>
                    <div>01101011</div>
                    <div className="text-emerald-200 font-bold drop-shadow-[0_0_8px_rgba(52,211,153,0.8)]">REV $48,290</div>
                    <div>9901 2231</div>
                    <div>10100011</div>
                    <div className="text-white/90 font-medium">AI OVERSIGHT</div>
                    <div>3321 0019</div>
                    <div>00110011</div>
                    <div>TABLE_12_OK</div>
                    <div>8821 4490</div>
                    <div>11001101</div>
                  </div>

                  {/* Column 3 - Brightest Core */}
                  <div className="flex flex-col gap-1.5 text-emerald-400/45 pt-6 hidden sm:flex">
                    <div>00110100</div>
                    <div className="text-yellow-200 font-bold drop-shadow-[0_0_10px_rgba(253,224,71,0.9)] text-[12px]">ZERO SETUP</div>
                    <div>11001001</div>
                    <div>8492 0012</div>
                    <div className="text-emerald-100 font-bold tracking-wider">POS_LIVE_24/7</div>
                    <div>01010101</div>
                    <div>9920 1182</div>
                    <div>00101010</div>
                    <div>7482 9910</div>
                    <div className="text-emerald-300">10110001</div>
                  </div>

                  {/* Column 4 */}
                  <div className="flex flex-col gap-2 text-emerald-600/30 hidden lg:flex pt-24 animate-[translateY_30s_linear_infinite]">
                    <div>11010010</div>
                    <div>5541 0029</div>
                    <div>01110011</div>
                    <div>8829 1102</div>
                    <div className="text-emerald-300 font-semibold">MATRIX_LIVE</div>
                    <div>00110101</div>
                    <div>9918 2201</div>
                    <div>10101010</div>
                  </div>
                </div>

              </div>

            </div>

            {/* Bottom Right Glass Partner Bar */}
            <div className="absolute bottom-6 right-6 z-30 hidden md:flex items-center">
              <div className="bg-[#11141a]/90 backdrop-blur-md border border-white/10 rounded-xl p-1.5 flex items-center gap-1 shadow-2xl">
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg hover:bg-white/5 text-gray-300 text-[11px] font-mono tracking-wider transition-colors cursor-default">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.8)]" />
                  <span>BARO SPEED</span>
                </div>
                <div className="h-3 w-px bg-white/10" />
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg hover:bg-white/5 text-gray-300 text-[11px] font-mono tracking-wider transition-colors cursor-default">
                  <div className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.8)]" />
                  <span>AI OVERSIGHT</span>
                </div>
                <div className="h-3 w-px bg-white/10" />
                <div className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg hover:bg-white/5 text-gray-300 text-[11px] font-mono tracking-wider transition-colors cursor-default">
                  <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_6px_rgba(192,132,252,0.8)]" />
                  <span>ZERO CHAOS</span>
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
