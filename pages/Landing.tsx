
import React from 'react';
import { ShieldCheck, ClipboardList, Coffee, Flame } from 'lucide-react';
import { BaroLogo3D } from '../components/BaroLogo3D';
import { BaroBackground } from '../components/BaroBackground';
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

      <BaroBackground variant="landing">

        {/* Language Toggle */}
        <div className="fixed top-0 left-0 right-0 p-6 z-50 flex justify-end pointer-events-none">
          <div className="pointer-events-auto">
            <LanguageSwitcher />
          </div>
        </div>

        {/* Main Layout Container - Tightened spacing */}
        <div className="relative z-0 flex h-screen flex-col items-center justify-center p-4 md:p-8 animate-in fade-in duration-1000 overflow-hidden">

          {/* Header Title - Centralized for Baro focus */}
          <div className="text-center space-y-4 z-10 flex-none fade-in-up" style={{ animationDelay: '100ms' }}>
            <div className="scale-75 md:scale-100 origin-center">
              <BaroLogo3D animate size="md" />
            </div>
            <div className="space-y-2 mt-4">
              <h1 className="text-4xl md:text-6xl font-black text-foreground tracking-tighter leading-none italic uppercase">
                {t('landing.title')}
              </h1>
              <p className="text-primary font-bold tracking-[0.6em] text-[10px] uppercase opacity-60">
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
      </BaroBackground>
    </>
  );
};

export default Landing;
