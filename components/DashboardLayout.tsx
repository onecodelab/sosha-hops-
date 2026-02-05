import React, { useState } from 'react';
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
import SoshaMenubar from './SoshaMenubar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title, subtitle, actions, className }) => {
  const { profile, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isProfileActive, setIsProfileActive] = useState(false);
  const profileRef = React.useRef<HTMLButtonElement>(null);

  const handleLogout = async () => {
    await signOut();
    window.location.replace('/');
  };

  const role = profile?.role || 'owner';
  const mascotVariant: MascotVariant = (role as any) === 'admin' ? 'owner' : (role as MascotVariant);
  const displayName = profile?.full_name || profile?.name || profile?.email?.split('@')[0] || 'User';

  const MobileNavItem = ({ icon: Icon, label, path, allowedRoles }: any) => (
    <RoleGuard allowedRoles={allowedRoles} hideOnly>
      <button
        onClick={() => { navigate(path); setIsMobileMenuOpen(false); }}
        className={cn(
          "w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all",
          location.pathname === path ? "bg-primary text-black" : "text-gray-400"
        )}
      >
        <Icon className="w-6 h-6" />
        <span className="font-bold text-lg">{label}</span>
      </button>
    </RoleGuard>
  );

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden selection:bg-primary selection:text-black">
      <LeafBubbleBackground />
      <div className="fixed inset-0 z-0 transition-colors duration-500 pointer-events-none">
        <BackgroundMascots variant={mascotVariant} />
      </div>

      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        handleLogout={handleLogout}
      />

      {/* Mobile Header with refined Sosha style */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card/40 backdrop-blur-2xl border-b border-border z-[100] px-4 flex items-center justify-between overflow-hidden">
        {/* Subtle Header Glow */}
        <div className="absolute -top-10 left-10 w-32 h-32 bg-primary/20 blur-[100px] rounded-full pointer-events-none" />

        <span className="font-black text-xs uppercase tracking-widest text-foreground/90 drop-shadow-md">
          Sosha <span className="text-primary italic">OS</span>
        </span>

        {/* New compact Mobile Menu Bar using Base UI */}
        <div className="transform scale-90 origin-right">
          <SoshaMenubar />
        </div>
      </div>

      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        <Header
          title={title}
          subtitle={subtitle}
          profile={profile}
          displayName={displayName}
          role={role}
          isProfileActive={isProfileActive}
          setIsProfileActive={setIsProfileActive}
          profileRef={profileRef}
          handleLogout={handleLogout}
        />
        {actions && (
          <div className="flex-none px-8 py-4 bg-muted/10 border-b border-border">
            {actions}
          </div>
        )}

        <div className={cn("flex-1 overflow-y-auto p-4 md:p-6 relative custom-scrollbar", className)}>
          {children}
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: var(--border); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: var(--muted); }
      `}</style>
    </div>
  );
};
