
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LogOut, Menu, Search, Wallet,
  LayoutDashboard, ShoppingBag, 
  Users, 
  Table2, ClipboardList, Utensils,
  ChevronDown, Bell, ChevronLeft, ChevronRight, Trash2, Truck, PlusCircle, PackageCheck, FileText, Monitor, BookOpen, X
} from 'lucide-react';
// Added Button to imports from ./ui
import { cn, Button } from './ui';
import ThemeToggle from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { LeafBubbleBackground } from './LeafBubbleBackground';
import { SoshaLogo } from './SoshaLogo';
import { Role } from '../types';
import { BackgroundMascots, MascotVariant } from './BackgroundMascots';
import { supabase } from '../supabase';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title, subtitle, actions }) => {
  const { profile, signOut } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isProfileActive, setIsProfileActive] = useState(false);
  const profileRef = useRef<HTMLButtonElement>(null);

  // Dynamic Header Stats
  const [headerStats, setHeaderStats] = useState({ label: 'Revenue', value: 0 });

  useEffect(() => {
    if (!profile) return;

    const fetchStats = async () => {
        const today = new Date().toISOString().split('T')[0];
        let label = t('common.revenue');
        // Base query: today's non-cancelled orders
        let query = supabase.from('orders')
           .select('total_amount')
           .gte('created_at', `${today}T00:00:00`)
           .neq('status', 'cancelled');

        // Personalize for Waiter
        if (profile.role === 'waiter') {
            label = t('nav.myStation');
            query = query.eq('waiter_id', profile.id);
        }
        
        const { data } = await query;
        const total = data?.reduce((acc, order) => acc + (order.total_amount || 0), 0) || 0;
        setHeaderStats({ label, value: total });
    };

    fetchStats();

    // Subscribe to updates so the number changes in real-time
    const sub = supabase.channel('header_stats_update')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => fetchStats())
        .subscribe();
        
    return () => { supabase.removeChannel(sub); };
  }, [profile, t]);

  useEffect(() => {
    const handleProfile = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileActive(false);
      }
    };
    document.addEventListener("click", handleProfile);
    return () => document.removeEventListener("click", handleProfile);
  }, []);

  const handleLogout = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    await signOut();
    window.location.replace('/');
  };

  const getSidebarItems = (role: Role) => {
    switch (role) {
      case 'owner':
      case 'admin' as any: 
        return [
          { icon: LayoutDashboard, label: t('nav.dashboard'), path: '/admin' },
          { icon: Monitor, label: 'Floor Status', path: '/tables' },
          { icon: BookOpen, label: t('nav.menuManagement'), path: '/admin/menu' },
          { icon: Utensils, label: t('nav.menuAnalytics'), path: '/menu-analytics' },
          { icon: ShoppingBag, label: t('nav.inventory'), path: '/inventory' },
          { icon: Truck, label: t('nav.pendingRequests'), path: '/manager/pending-requests' },
          { icon: Users, label: t('nav.staffPerf'), path: '/admin/staff-performance' },
          { icon: ClipboardList, label: t('nav.settings'), path: '/settings' },
        ];
      case 'manager':
        return [
          { icon: LayoutDashboard, label: t('nav.opsDashboard'), path: '/manager' },
          { icon: Monitor, label: 'Floor Status', path: '/tables' },
          { icon: Users, label: t('nav.staff'), path: '/staff-performance' },
          { icon: ClipboardList, label: t('nav.orders'), path: '/orders-tables' },
          { icon: PlusCircle, label: t('nav.createPO'), path: '/manager/create-po' },
          { icon: FileText, label: t('nav.purchaseOrders'), path: '/manager/purchase-orders' },
          { icon: PackageCheck, label: t('nav.receiveGoods'), path: '/manager/receive-goods' },
          { icon: Truck, label: t('nav.pendingRequests'), path: '/manager/pending-requests' },
          { icon: ShoppingBag, label: t('nav.inventory'), path: '/inventory' },
        ];
      case 'waiter':
        return [
          { icon: LayoutDashboard, label: t('nav.myStation'), path: '/waiter' },
          { icon: Monitor, label: 'Floor Status', path: '/tables' },
        ];
      case 'kitchen':
        return [
          { icon: LayoutDashboard, label: t('nav.kds'), path: '/kitchen' },
          { icon: ShoppingBag, label: t('nav.stock'), path: '/kitchen/stock' },
          { icon: Truck, label: t('nav.restock'), path: '/kitchen/restock' },
          { icon: Trash2, label: t('nav.waste'), path: '/kitchen/waste' },
        ];
      default:
        return [
           { icon: LayoutDashboard, label: t('nav.dashboard'), path: '/' },
        ];
    }
  };

  const role = profile?.role || 'owner';
  const menuItems = getSidebarItems(role);

  // Determine Mascot Variant based on role
  let mascotVariant: MascotVariant = 'owner';
  if (role === 'manager') mascotVariant = 'manager';
  if (role === 'waiter') mascotVariant = 'waiter';
  if (role === 'kitchen') mascotVariant = 'kitchen';

  // Helper for Display Name
  const displayName = profile?.full_name || profile?.name || profile?.email?.split('@')[0] || 'User';

  return (
    <div className="flex h-screen bg-background overflow-hidden selection:bg-primary selection:text-black">
      {/* Background */}
      <LeafBubbleBackground />
      <div className="fixed inset-0 z-0 bg-gradient-to-b from-background via-background to-transparent transition-colors duration-500 pointer-events-none">
         <BackgroundMascots variant={mascotVariant} />
      </div>

      {/* Sidebar - Desktop */}
      <aside 
        className={cn(
          "hidden md:flex flex-col relative z-20 bg-card/60 backdrop-blur-3xl border-r border-border transition-all duration-500",
          isCollapsed ? "w-20" : "w-72"
        )}
      >
        <div className="flex items-center justify-between p-6 h-24">
          {!isCollapsed && (
             <div className="flex items-center gap-3 animate-in fade-in duration-500">
               <SoshaLogo className="w-10 h-10" />
               <div>
                  <h1 className="text-xl font-bold tracking-tighter text-foreground leading-none">Sosha OS</h1>
                  <span className="text-[9px] font-black uppercase text-primary tracking-[0.3em]">Master Unit</span>
               </div>
             </div>
          )}
          {isCollapsed && <SoshaLogo className="w-10 h-10 mx-auto" />}
        </div>

        <nav className="flex-1 px-4 space-y-2 py-4 overflow-y-auto custom-scrollbar">
          {menuItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={cn(
                  "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group",
                  isActive 
                    ? "bg-primary text-black shadow-lg shadow-primary/20" 
                    : "text-muted hover:text-foreground hover:bg-white/5"
                )}
              >
                <item.icon className={cn("w-5 h-5", isActive ? "text-black" : "text-muted group-hover:text-primary")} />
                {!isCollapsed && <span className="font-bold text-sm tracking-tight">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-red-400 hover:bg-red-500/10 transition-all duration-300 group"
          >
            <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
            {!isCollapsed && <span className="font-bold text-sm">{t('common.logout')}</span>}
          </button>
        </div>

        {/* Collapse Button */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-24 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center text-muted hover:text-primary transition-colors shadow-lg z-30"
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </aside>

      {/* Mobile Nav Trigger */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-card/80 backdrop-blur-xl border-b border-border z-[100] px-4 flex items-center justify-between">
         <div className="flex items-center gap-2">
            <SoshaLogo className="w-8 h-8" />
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
                <nav className="flex-1 space-y-4">
                    {menuItems.map((item) => (
                        <button
                          key={item.path}
                          onClick={() => { navigate(item.path); setIsMobileMenuOpen(false); }}
                          className={cn(
                            "w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all",
                            location.pathname === item.path ? "bg-primary text-black" : "text-gray-400"
                          )}
                        >
                           <item.icon className="w-6 h-6" />
                           <span className="font-bold text-lg">{item.label}</span>
                        </button>
                    ))}
                </nav>
                <div className="pb-10 space-y-4">
                   <div className="flex justify-between p-4 bg-white/5 rounded-2xl">
                      <ThemeToggle />
                      <LanguageSwitcher />
                   </div>
                   <Button variant="destructive" className="w-full h-14 rounded-2xl text-lg font-bold" onClick={handleLogout}>
                      {t('common.logout')}
                   </Button>
                </div>
            </div>
         </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative z-10 pt-16 md:pt-0">
        
        {/* Header Navigation */}
        <header className="flex-none h-24 flex items-center justify-between px-8 border-b border-white/5 bg-card/40 backdrop-blur-md">
          <div className="flex flex-col">
            <h2 className="text-2xl font-bold tracking-tight text-white">{title || t('nav.overview')}</h2>
            {subtitle && <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">{subtitle}</p>}
          </div>

          <div className="flex items-center gap-6">
            
            {/* Header Metrics */}
            <div className="hidden lg:flex items-center gap-8 mr-4">
               <div className="flex flex-col items-end">
                  <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{headerStats.label}</span>
                  <span className="text-xl font-black text-white font-mono tracking-tighter">ETB {headerStats.value.toLocaleString()}</span>
               </div>
            </div>

            <div className="flex items-center gap-3">
              <ThemeToggle />
              <LanguageSwitcher />
              
              <div className="h-10 w-px bg-border mx-2 hidden sm:block" />

              {/* Profile Dropdown */}
              <div className="relative">
                <button 
                  ref={profileRef}
                  onClick={() => setIsProfileActive(!isProfileActive)}
                  className="flex items-center gap-3 pl-2 pr-4 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                >
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-primary shadow-[0_0_15px_rgba(255,184,0,0.3)] border-2 border-primary/20">
                     {profile?.avatar_url ? (
                       <img src={profile.avatar_url} className="w-full h-full object-cover" />
                     ) : (
                       <div className="w-full h-full flex items-center justify-center text-black font-black text-lg bg-primary">
                          {displayName.charAt(0).toUpperCase()}
                       </div>
                     )}
                  </div>
                  <div className="hidden sm:flex flex-col items-start leading-tight">
                    <span className="text-sm font-bold text-white group-hover:text-primary transition-colors">{displayName}</span>
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">{role}</span>
                  </div>
                  <ChevronDown className={cn("w-4 h-4 text-gray-600 transition-transform duration-300", isProfileActive && "rotate-180")} />
                </button>

                {isProfileActive && (
                  <div className="absolute top-full right-0 mt-3 w-64 bg-card border border-border rounded-3xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                     <div className="p-4 bg-primary text-black">
                        <p className="font-black text-lg tracking-tight truncate">{displayName}</p>
                        <p className="text-[10px] font-bold uppercase opacity-60 tracking-widest">{role}</p>
                     </div>
                     <div className="p-2">
                        <button className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-gray-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3">
                           <Users className="w-4 h-4" /> My Profile
                        </button>
                        <button className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-gray-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3">
                           <Bell className="w-4 h-4" /> Notifications
                        </button>
                        <div className="h-px bg-border my-2 mx-2" />
                        <button 
                          onClick={handleLogout}
                          className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-3"
                        >
                           <LogOut className="w-4 h-4" /> {t('common.logout')}
                        </button>
                     </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content Header Actions */}
        {actions && (
          <div className="flex-none px-8 py-4 bg-black/10 border-b border-white/5">
             {actions}
          </div>
        )}

        {/* Page Container */}
        <div className="flex-1 overflow-y-auto p-8 relative custom-scrollbar">
          {children}
        </div>
      </main>

      <style>{`
        .scrollbar-none::-webkit-scrollbar { display: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.05); border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
};
