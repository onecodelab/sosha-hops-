
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, ClipboardList, Coffee, Flame, ArrowRight, LucideIcon } from 'lucide-react';
import { SoshaLogo3D } from '../components/SoshaLogo3D';
import { SoshaBackground } from '../components/SoshaBackground';
import { useLanguage } from '../contexts/LanguageContext';
import { cn } from '../components/ui';
import { LanguageSwitcher } from '../components/LanguageSwitcher';

// --- Types ---
interface RoleConfig {
  id: string;
  label: string;
  subLabel: string;
  tagline: string;
  icon: LucideIcon;
  color: string;
  gradient: string;
  shadow: string;
}

// --- 3D Avatar Component ---
const RoleAvatar: React.FC<{ config: RoleConfig }> = ({ config }) => {
  const Icon = config.icon;
  
  const colorStyles: Record<string, string> = {
    yellow: "from-yellow-400/20 to-yellow-600/5 border-yellow-500/30 text-yellow-400 group-hover:from-yellow-400/30",
    purple: "from-purple-400/20 to-purple-600/5 border-purple-500/30 text-purple-400 group-hover:from-purple-400/30",
    orange: "from-orange-400/20 to-orange-600/5 border-orange-500/30 text-orange-400 group-hover:from-orange-400/30",
    red: "from-red-400/20 to-red-600/5 border-red-500/30 text-red-400 group-hover:from-red-400/30",
  };

  const glowStyles: Record<string, string> = {
    yellow: "bg-yellow-500",
    purple: "bg-purple-500",
    orange: "bg-orange-500",
    red: "bg-red-500",
  };

  return (
    <div className="relative w-32 h-32 mx-auto mb-6 transition-transform duration-500 group-hover:scale-110 group-hover:-translate-y-2 perspective-1000">
      {/* Back Glow Blob */}
      <div className={cn(
        "absolute inset-0 rounded-full blur-[40px] opacity-0 group-hover:opacity-40 transition-opacity duration-500",
        glowStyles[config.color]
      )} />

      {/* Main 3D Card Shape */}
      <div className={cn(
        "relative w-full h-full rounded-[2rem] border backdrop-blur-md shadow-2xl flex items-center justify-center overflow-hidden transition-all duration-300",
        "bg-gradient-to-br",
        colorStyles[config.color]
      )}>
        <div className="absolute top-0 inset-x-0 h-1/2 bg-gradient-to-b from-white/10 to-transparent opacity-50" />
        <div className="absolute inset-0 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] rounded-[2rem]" />
        <div className="relative z-10 filter drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]">
           <Icon className="w-14 h-14" strokeWidth={1.5} />
        </div>
        <div className="absolute bottom-3 w-8 h-1 rounded-full bg-black/30 backdrop-blur-sm" />
      </div>
    </div>
  );
};

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const roles: RoleConfig[] = [
    { 
      id: 'owner', 
      label: t('landing.roles.owner.label'), 
      subLabel: t('landing.roles.owner.sub'), 
      tagline: t('landing.roles.owner.tag'),
      icon: ShieldCheck, color: 'yellow', gradient: 'from-yellow-500 to-amber-700', shadow: 'shadow-yellow-500/25'
    },
    { 
      id: 'manager', 
      label: t('landing.roles.manager.label'), 
      subLabel: t('landing.roles.manager.sub'), 
      tagline: t('landing.roles.manager.tag'),
      icon: ClipboardList, color: 'purple', gradient: 'from-purple-500 to-indigo-700', shadow: 'shadow-purple-500/25'
    },
    { 
      id: 'waiter', 
      label: t('landing.roles.waiter.label'), 
      subLabel: t('landing.roles.waiter.sub'), 
      tagline: t('landing.roles.waiter.tag'),
      icon: Coffee, color: 'orange', gradient: 'from-orange-500 to-red-700', shadow: 'shadow-orange-500/25'
    },
    { 
      id: 'kitchen', 
      label: t('landing.roles.kitchen.label'), 
      subLabel: t('landing.roles.kitchen.sub'), 
      tagline: t('landing.roles.kitchen.tag'),
      icon: Flame, color: 'red', gradient: 'from-red-500 to-rose-700', shadow: 'shadow-red-500/25'
    },
  ];

  const borderHoverStyles: Record<string, string> = {
    yellow: "hover:border-yellow-500/50 hover:shadow-[0_0_30px_rgba(234,179,8,0.15)]",
    purple: "hover:border-purple-500/50 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]",
    orange: "hover:border-orange-500/50 hover:shadow-[0_0_30px_rgba(249,115,22,0.15)]",
    red: "hover:border-red-500/50 hover:shadow-[0_0_30px_rgba(239,68,68,0.15)]",
  };

  const pillStyles: Record<string, string> = {
    yellow: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
    purple: "bg-purple-500/10 text-purple-500 border-purple-500/20",
    orange: "bg-orange-500/10 text-orange-500 border-orange-500/20",
    red: "bg-red-500/10 text-red-500 border-red-500/20",
  };

  return (
    <>
      <style>{`
        .fade-in-up {
          animation: fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .perspective-1000 { perspective: 1000px; }
      `}</style>

      <SoshaBackground variant="landing">
        
        {/* Language Toggle Fixed */}
        <div className="absolute top-6 right-6 z-50">
           <LanguageSwitcher />
        </div>

        {/* Main Content */}
        <div 
          className="flex-1 flex flex-col items-center justify-center p-4 md:p-8 animate-in fade-in duration-700"
        >
           {/* Header */}
           <div className="text-center space-y-8 mb-16 fade-in-up" style={{ animationDelay: '0ms' }}>
              <SoshaLogo3D animate size="lg" />
              <div className="space-y-3">
                <h1 className="text-5xl md:text-6xl font-bold text-white tracking-tighter">
                  {t('landing.title')}
                </h1>
                <p className="text-gray-400 font-medium tracking-wide text-sm uppercase">
                  {t('landing.subtitle')}
                </p>
              </div>
           </div>

           {/* Roles Grid */}
           <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 w-full max-w-7xl px-4 fade-in-up" style={{ animationDelay: '200ms' }}>
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => navigate(`/login/${role.id}`)}
                  className={cn(
                    "group relative flex flex-col items-center text-center p-8 rounded-[2rem]",
                    "bg-[#0A0A0A] border border-white/5",
                    "transition-all duration-300 ease-out",
                    borderHoverStyles[role.color]
                  )}
                >
                  <RoleAvatar config={role} />
                  <div className="space-y-3 mt-2 relative z-10 w-full">
                    <div>
                      <h3 className="text-xl font-bold text-white group-hover:text-white transition-colors">
                        {role.label}
                      </h3>
                      <p className="text-sm text-gray-500 group-hover:text-gray-400 transition-colors mt-1">
                        {role.subLabel}
                      </p>
                    </div>
                    <div className="flex justify-center pt-2">
                       <span className={cn(
                         "text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full border transition-all",
                         pillStyles[role.color]
                       )}>
                         {role.tagline}
                       </span>
                    </div>
                  </div>
                  <div className="absolute bottom-6 opacity-0 group-hover:opacity-100 transform translate-y-2 group-hover:translate-y-0 transition-all duration-300">
                     <ArrowRight className={cn("w-5 h-5", `text-${role.color}-500`)} />
                  </div>
                </button>
              ))}
           </div>
           
           <div className="fixed bottom-8 text-gray-600 text-xs font-mono uppercase tracking-widest fade-in-up" style={{ animationDelay: '400ms' }}>
             {t('landing.poweredBy')}
           </div>
        </div>
      </SoshaBackground>
    </>
  );
};

export default Landing;
