
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
          from { opacity: 0; transform: translateY(30px); }
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

        {/* Main Layout Container - pt-0 to start immediately at the top edge */}
        <div className="relative z-0 flex h-screen flex-col items-center pt-0 p-4 md:p-8 animate-in fade-in duration-1000 overflow-hidden">
           
           {/* Header Title - Tiny margin to sit very close to top edge */}
           <div className="mt-1 md:mt-2 text-center space-y-2 z-10 flex-none fade-in-up" style={{ animationDelay: '100ms' }}>
              <SoshaLogo3D animate size="sm" className="mb-1" />
              <div className="space-y-0.5">
                <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tighter">
                  {t('landing.title')}
                </h1>
                <p className="text-muted font-medium tracking-widest text-[10px] uppercase opacity-60">
                  {t('landing.subtitle')}
                </p>
              </div>
           </div>

           {/* Stack Selector - Reduced pt to close the gap between text and cards */}
           <div className="relative z-0 flex-1 flex items-start justify-center w-full pt-1 md:pt-2 fade-in-up" style={{ animationDelay: '300ms' }}>
              <RoleStackSelector roles={roles} />
           </div>
           
           {/* Footer */}
           <div className="mt-auto mb-6 md:mb-8 text-muted text-[10px] font-mono uppercase tracking-[0.3em] opacity-40 fade-in-up z-10 flex-none" style={{ animationDelay: '500ms' }}>
             {t('landing.poweredBy')}
           </div>
        </div>
      </SoshaBackground>
    </>
  );
};

export default Landing;
