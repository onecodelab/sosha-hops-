
import React from 'react';
import { ShieldCheck, ClipboardList, Coffee, Flame } from 'lucide-react';
import { SoshaLogo3D } from '../components/SoshaLogo3D';
import { SoshaBackground } from '../components/SoshaBackground';
import { useLanguage } from '../contexts/LanguageContext';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { RoleStackSelector, RoleCard } from '../components/RoleStackSelector';

const Landing: React.FC = () => {
  const { t } = useLanguage();

  const roles: RoleCard[] = [
    { 
      id: 'owner', 
      name: t('landing.roles.owner.label'), 
      subtitle: t('landing.roles.owner.sub'), 
      tagline: t('landing.roles.owner.tag'),
      icon: ShieldCheck, 
      color: 'yellow'
    },
    { 
      id: 'manager', 
      name: t('landing.roles.manager.label'), 
      subtitle: t('landing.roles.manager.sub'), 
      tagline: t('landing.roles.manager.tag'),
      icon: ClipboardList, 
      color: 'purple'
    },
    { 
      id: 'waiter', 
      name: t('landing.roles.waiter.label'), 
      subtitle: t('landing.roles.waiter.sub'), 
      tagline: t('landing.roles.waiter.tag'),
      icon: Coffee, 
      color: 'orange'
    },
    { 
      id: 'kitchen', 
      name: t('landing.roles.kitchen.label'), 
      subtitle: t('landing.roles.kitchen.sub'), 
      tagline: t('landing.roles.kitchen.tag'),
      icon: Flame, 
      color: 'red'
    },
  ];

  return (
    <>
      <style>{`
        .fade-in-up {
          animation: fadeInUp 1s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <SoshaBackground variant="landing">
        
        {/* Language Toggle */}
        <div className="fixed top-0 left-0 right-0 p-6 z-50 flex justify-end pointer-events-none">
           <div className="pointer-events-auto">
              <LanguageSwitcher />
           </div>
        </div>

        {/* Main Layout Container - Tightened spacing */}
        <div className="relative z-0 flex h-screen flex-col items-center justify-start pt-4 md:pt-6 p-4 md:p-8 animate-in fade-in duration-1000 overflow-hidden">
           
           {/* Header Title - Pulled to top */}
           <div className="text-center space-y-1 z-10 flex-none fade-in-up" style={{ animationDelay: '100ms' }}>
              <div className="scale-75 md:scale-90 origin-center mb-1">
                <SoshaLogo3D animate size="sm" />
              </div>
              <div className="space-y-0">
                <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tighter leading-none">
                  {t('landing.title')}
                </h1>
                <p className="text-muted font-bold tracking-[0.4em] text-[9px] uppercase opacity-40 mt-2">
                  {t('landing.subtitle')}
                </p>
              </div>
           </div>

           {/* Stack Selector - No flex-1, margin-top controlled */}
           <div className="relative z-0 flex items-start justify-center w-full mt-2 md:mt-4 fade-in-up" style={{ animationDelay: '300ms' }}>
              <RoleStackSelector roles={roles} />
           </div>
           
           {/* Fixed Footer */}
           <div className="fixed bottom-8 left-0 right-0 text-center text-muted text-[9px] font-mono uppercase tracking-[0.4em] opacity-30 pointer-events-none">
             {t('landing.poweredBy')}
           </div>
        </div>
      </SoshaBackground>
    </>
  );
};

export default Landing;
