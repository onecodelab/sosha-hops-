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
import { RoleGuard } from './RoleGuard';

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
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary selection:text-black">
      <LeafBubbleBackground />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-background via-background to-transparent transition-colors duration-500 pointer-events-none">
        <BackgroundMascots variant={mascotVariant} />
      </div>

      <Sidebar
        isCollapsed={isCollapsed}
        setIsCollapsed={setIsCollapsed}
        handleLogout={handleLogout}
      />

      {/* Mobile Nav Trigger */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card/80 backdrop-blur-xl border-b border-border z-[100] px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-bold text-sm tracking-tighter">Sosha OS</span>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </Button>
      </div>

      {/* Mobile Sidebar */}
      {isMobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[90] bg-background">
          <div className="flex flex-col h-full pt-20 px-6">
            <nav className="flex-1 space-y-2 overflow-y-auto">
              <MobileNavItem icon={LayoutDashboard} label={t('nav.dashboard')} path="/admin" allowedRoles={['owner', 'admin']} />
              <MobileNavItem icon={LayoutDashboard} label={t('nav.opsDashboard')} path="/manager" allowedRoles={['manager']} />
              <MobileNavItem icon={LayoutDashboard} label={t('nav.myStation')} path="/waiter" allowedRoles={['waiter']} />
              <MobileNavItem icon={Monitor} label="Floor Status" path="/tables" allowedRoles={['waiter', 'manager', 'admin', 'owner']} />
              <MobileNavItem icon={BookOpen} label={t('nav.menuManagement')} path="/admin/menu" allowedRoles={['owner', 'admin', 'manager']} />
              <MobileNavItem icon={ShoppingBag} label={t('nav.inventory')} path="/inventory" allowedRoles={['manager', 'admin', 'owner']} />
              <MobileNavItem icon={Users} label={t('nav.staffPerf')} path="/admin/staff-performance" allowedRoles={['owner', 'admin']} />
              <MobileNavItem icon={ClipboardList} label={t('nav.settings')} path="/settings" allowedRoles={['admin', 'owner']} />
            </nav>
            <div className="pb-10 space-y-4">
              <Button variant="destructive" className="w-full h-14 rounded-2xl text-lg font-bold" onClick={handleLogout}>
                {t('common.logout')}
              </Button>
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10 pt-16 md:pt-0">
        {actions && (
          <div className="flex-none px-8 py-4 bg-black/10 border-b border-white/5">
            {actions}
          </div>
        )}

        <div className={cn("flex-1 overflow-y-auto p-8 relative custom-scrollbar", className)}>
          {children}
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
};
