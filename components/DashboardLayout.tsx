import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Menu, X, LayoutDashboard, Monitor, BookOpen, ShoppingBag, Truck, Users, ClipboardList
} from 'lucide-react';
import { cn, Button } from './ui';
import { LeafBubbleBackground } from './LeafBubbleBackground';
import { BackgroundMascots, MascotVariant } from './BackgroundMascots';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { RoleGuard } from './RoleGuard';
import BaroMenubar from './BaroMenubar';
import { BaroLogo } from './BaroLogo';
import { useLayout } from '../contexts/LayoutContext';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string | React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  isSidebarCollapsed?: boolean;
  onSidebarCollapseChange?: (collapsed: boolean) => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title,
  subtitle,
  actions,
  className,
  isSidebarCollapsed: propsIsSidebarCollapsed,
  onSidebarCollapseChange: propsOnSidebarCollapseChange
}) => {
  const { profile, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { config } = useLayout();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isProfileActive, setIsProfileActive] = useState(false);
  const [localIsCollapsed, setLocalIsCollapsed] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  // Sync with context or props
  const isCollapsed = propsIsSidebarCollapsed !== undefined ? propsIsSidebarCollapsed : config.isSidebarCollapsed !== undefined ? config.isSidebarCollapsed : localIsCollapsed;
  const setIsCollapsed = (collapsed: boolean) => {
    if (propsOnSidebarCollapseChange) propsOnSidebarCollapseChange(collapsed);
    else if (config.onSidebarCollapseChange) config.onSidebarCollapseChange(collapsed);
    else setLocalIsCollapsed(collapsed);
  };

  const activeTitle = title || config.title;
  const activeSubtitle = subtitle || config.subtitle;
  const activeActions = actions || config.actions;
  const activeClassName = className || config.className;

  const handleLogout = async () => {
    await signOut();
    window.location.replace('/');
  };

  const role = profile?.role || 'owner';
  const mascotVariant: MascotVariant = (role as any) === 'admin' ? 'owner' : (role as MascotVariant);
  const displayName = profile?.full_name || profile?.name || profile?.email?.split('@')[0] || 'User';

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden selection:bg-primary selection:text-black">
      <LeafBubbleBackground />
      <div className="fixed inset-0 z-0 transition-colors duration-500 pointer-events-none">
        <BackgroundMascots variant={mascotVariant} />
      </div>

      {!config.fullScreen && (
        <Sidebar
          isCollapsed={isCollapsed}
          setIsCollapsed={setIsCollapsed}
          handleLogout={handleLogout}
        />
      )}

      {/* Mobile Header */}
      {!config.fullScreen && (
        <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-background/80 backdrop-blur-3xl border-b border-border/10 shadow-xl z-[100] px-4 flex items-center justify-between">
          
          <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-transparent pointer-events-none overflow-hidden rounded-b-xl" />
          
          {/* Logo — no scaling transforms */}
          <div className="relative z-10 flex items-center">
            <BaroLogo variant="full" />
          </div>

          <div className="relative z-10">
            <BaroMenubar />
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10 pt-16 md:pt-0">
        {!config.fullScreen && (
          <Header
            title={activeTitle}
            subtitle={activeSubtitle}
            profile={profile}
            displayName={displayName}
            role={role}
            isProfileActive={isProfileActive}
            setIsProfileActive={setIsProfileActive}
            profileRef={profileRef}
            handleLogout={handleLogout}
          />
        )}
        {!config.fullScreen && activeActions && (
          <div className="flex-none px-8 py-4 bg-muted/10 border-b border-primary/30">
            {activeActions}
          </div>
        )}

        <div className={cn("flex-1 overflow-y-auto p-4 md:p-6 relative custom-scrollbar", activeClassName)}>
          {children}
        </div>
      </main>

      <style>{`
          .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
          .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
          .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--primary); opacity: 0.3; border-radius: 10px; }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--primary); opacity: 0.5; }
        `}</style>
    </div>
  );
};
