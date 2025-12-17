
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
          animation: fadeInUp 0.8s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(40px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <SoshaBackground variant="landing">
        
        {/* Language Toggle - Fixed Header (z-50) to stay above stack */}
        <div className="fixed top-0 left-0 right-0 p-6 z-50 flex justify-end pointer-events-none">
           <div className="pointer-events-auto">
              <LanguageSwitcher />
           </div>
        </div>

        {/* Main Layout Container */}
        <div className="relative z-0 flex min-h-[calc(100vh-20px)] flex-col items-center justify-between p-4 md:p-8 animate-in fade-in duration-700 overflow-hidden">
           
           {/* Header Title - z-10 - Reduced top margin */}
           <div className="mt-4 md:mt-8 text-center space-y-4 z-10 flex-none fade-in-up" style={{ animationDelay: '0ms' }}>
              <SoshaLogo3D animate size="sm" className="mb-4" />
              <div className="space-y-2">
                <h1 className="text-4xl md:text-5xl font-bold text-foreground tracking-tighter">
                  {t('landing.title')}
                </h1>
                <p className="text-muted font-medium tracking-wide text-xs uppercase">
                  {t('landing.subtitle')}
                </p>
              </div>
           </div>

           {/* Centered Stack - items-start to pull higher, with padding */}
           <div className="relative z-0 flex-1 flex items-start justify-center w-full fade-in-up py-4 pt-10 md:pt-14" style={{ animationDelay: '200ms' }}>
              <RoleStackSelector roles={roles} />
           </div>
           
           {/* Footer - z-10 */}
           <div className="mb-6 md:mb-8 text-muted text-[10px] font-mono uppercase tracking-widest fade-in-up z-10 flex-none" style={{ animationDelay: '400ms' }}>
             {t('landing.poweredBy')}
           </div>
        </div>
      </SoshaBackground>
    </>
  );
};

export default Landing;
