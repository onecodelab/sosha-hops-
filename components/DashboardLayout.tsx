
import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LogOut, Menu, Search, Wallet,
  LayoutDashboard, ShoppingBag, 
  Users, 
  Table2, ClipboardList, Utensils,
  ChevronDown, Bell, ChevronLeft, ChevronRight, Trash2, Truck, PlusCircle, PackageCheck, FileText
} from 'lucide-react';
import { cn } from './ui';
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
  }, [profile, t]); // Add t to dependency

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
          { icon: Utensils, label: t('nav.menuAnalytics'), path: '/menu-analytics' },
          { icon: ShoppingBag, label: t('nav.inventory'), path: '/inventory' },
          { icon: Truck, label: t('nav.pendingRequests'), path: '/manager/pending-requests' },
          { icon: Users, label: t('nav.staffPerf'), path: '/admin/staff-performance' },
          { icon: Table2, label: t('nav.tableMap'), path: '/admin/table-map' },
          { icon: ClipboardList, label: t('nav.settings'), path: '/settings' },
        ];
      case 'manager':
        return [
          { icon: LayoutDashboard, label: t('nav.opsDashboard'), path: '/manager' },
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
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row font-sans overflow-hidden selection:bg-primary selection:text-black transition-colors duration-500">
      
      {/* Global Background */}
      <div className="fixed inset-0 z-0 bg-background transition-colors duration-500">
         <LeafBubbleBackground />
         <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]" />
         <BackgroundMascots variant={mascotVariant} />
      </div>

      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-card/80 backdrop-blur-md border-b border-border z-50 sticky top-0">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8"><SoshaLogo /></div>
           <span className="font-bold text-lg text-foreground tracking-tight">Sosha OS</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-muted hover:text-foreground">
          <Menu />
        </button>
      </div>

      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-40 bg-card/95 border-r border-border shadow-[20px_0_40px_rgba(0,0,0,0.5)] backdrop-blur-md transition-all duration-300 ease-in-out flex flex-col",
          isMobileMenuOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0",
          !isMobileMenuOpen && (isCollapsed ? "md:w-[88px]" : "md:w-[280px]")
        )}
      >
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute -right-3 top-10 z-50 w-6 h-6 items-center justify-center bg-card border border-border text-muted rounded-full hover:bg-primary hover:text-black hover:border-primary transition-all shadow-lg"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className="flex flex-col h-full px-4 py-6">
            
            {/* Logo Area */}
            <div className={cn("flex items-center mb-10 transition-all duration-300", isCollapsed ? "justify-center" : "px-2 gap-3")}>
                 <div className="w-10 h-10 shrink-0 transition-transform duration-300 hover:scale-110 drop-shadow-[0_0_15px_rgba(255,184,0,0.3)]">
                    <SoshaLogo />
                 </div>
                 <div className={cn("overflow-hidden transition-all duration-300", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
                    <span className="text-xl font-bold text-foreground tracking-tighter">Sosha OS</span>
                 </div>
            </div>

            {/* User Profile */}
            <div className="mb-8 relative group">
                <div 
                  className={cn(
                    "flex items-center rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 transition-all cursor-pointer overflow-hidden",
                    isCollapsed ? "justify-center p-2 bg-transparent border-transparent hover:bg-white/5" : "p-3 gap-3"
                  )}
                  onClick={() => isCollapsed && setIsCollapsed(false)} 
                >
                    <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 text-primary font-bold text-sm overflow-hidden shrink-0">
                         <img 
                           src={`https://ui-avatars.com/api/?name=${displayName}&background=FFB800&color=000`} 
                           alt="Avatar" 
                           className="w-full h-full object-cover opacity-90"
                         />
                    </div>
                    
                    <div className={cn("flex-1 min-w-0 transition-all duration-300", isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100 block")}>
                        <span className="block text-foreground text-sm font-bold truncate">{displayName}</span>
                        <span className="block text-muted text-xs truncate capitalize">{t(`roles.${role}`)}</span>
                    </div>
                    
                    <button
                        type="button"
                        ref={profileRef}
                        onClick={(e) => { e.stopPropagation(); if(!isCollapsed) setIsProfileActive(!isProfileActive); else setIsCollapsed(false); }}
                        className={cn("p-1 rounded-md text-muted hover:text-foreground transition-all", isCollapsed ? "hidden" : "block")}
                    >
                       <ChevronDown className={cn("w-4 h-4 transition-transform", isProfileActive && "rotate-180")} />
                    </button>
                </div>

                {/* Profile Dropdown */}
                {isProfileActive && !isCollapsed && (
                    <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-card border border-border rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                         <button 
                            type="button"
                            onClick={handleLogout} 
                            className="w-full text-left px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors flex items-center gap-2"
                         >
                            <LogOut className="w-4 h-4" /> {t('common.logout')}
                         </button>
                    </div>
                )}
            </div>

            {/* Navigation */}
            <div className="flex-1 overflow-y-auto space-y-1.5 custom-scrollbar overflow-x-hidden">
                {menuItems.map((item, idx) => {
                    const isActive = location.pathname === item.path;
                    return (
                      <button
                          key={idx}
                          onClick={() => { navigate(item.path); setIsMobileMenuOpen(false); }}
                          className={cn(
                              "w-full flex items-center transition-all duration-300 group relative",
                              isCollapsed ? "justify-center p-3 rounded-xl" : "gap-x-3 px-4 py-3 rounded-xl text-sm font-medium",
                              isActive
                                  ? "bg-primary text-black shadow-[0_0_20px_rgba(255,184,0,0.3)] font-bold"
                                  : "text-muted hover:text-foreground hover:bg-white/5"
                          )}
                          title={isCollapsed ? item.label : undefined}
                      >
                          <item.icon className={cn("w-5 h-5 transition-colors shrink-0", isActive ? "text-black" : "text-gray-500 group-hover:text-foreground")} />
                          <span className={cn("whitespace-nowrap transition-all duration-300", isCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100")}>
                            {item.label}
                          </span>
                      </button>
                    )
                })}
            </div>

            {/* Footer */}
            {!isCollapsed && (
              <div className="pt-6 mt-auto">
                 <div className="p-4 rounded-2xl bg-gradient-to-br from-white/5 to-transparent border border-white/5">
                    <p className="text-xs text-muted mb-2">{t('common.needHelp')}</p>
                    <button className="text-xs text-primary hover:underline">{t('common.contactSupport')}</button>
                 </div>
              </div>
            )}
        </div>
      </aside>

      {/* Main Content */}
      <main 
        className={cn(
          "flex-1 h-screen overflow-y-auto transition-all duration-300 ease-in-out relative z-10",
          isCollapsed ? "md:ml-[88px]" : "md:ml-[280px]"
        )}
      >
        <div className="p-4 md:p-8 lg:p-10 max-w-[1600px] mx-auto space-y-10 min-h-[calc(100vh-2rem)]">
          
          {/* Top Bar */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="relative flex-1 max-w-md hidden md:block">
               <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-muted" />
               </div>
               <input 
                 type="text" 
                 placeholder={t('common.search')} 
                 className="block w-full pl-11 pr-4 py-2.5 bg-card/50 backdrop-blur-md border border-white/10 rounded-full text-sm text-foreground shadow-sm focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted transition-all hover:bg-card/80 hover:border-white/20"
               />
            </div>

            <div className="flex items-center gap-4 md:gap-6 justify-end w-full md:w-auto">
               <LanguageSwitcher />
               <ThemeToggle />
               
               <button className="relative p-2.5 bg-card/50 border border-white/10 rounded-full text-muted hover:text-foreground hover:bg-white/5 transition-all group">
                  <Bell className="w-5 h-5 group-hover:animate-swing" />
                  <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
               </button>

               {/* Stats Pill - Dynamic */}
               <div className="hidden md:flex items-center gap-3 bg-card/80 border border-white/10 px-4 py-1.5 rounded-full shadow-lg backdrop-blur-md">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-yellow-600 flex items-center justify-center shadow-[0_0_10px_rgba(255,184,0,0.4)]">
                     <Wallet className="w-4 h-4 text-black" />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] text-muted font-bold uppercase tracking-wider">{headerStats.label}</span>
                     <span className="text-sm font-bold text-foreground">ETB {headerStats.value.toLocaleString()}</span>
                  </div>
               </div>
            </div>
          </header>

          {/* Page Title Area */}
          {(title || subtitle) && (
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 animate-in fade-in slide-in-from-bottom-2 duration-700">
              <div>
                <h1 className="text-4xl font-bold text-foreground tracking-tight drop-shadow-lg">{title}</h1>
                {subtitle && <p className="text-muted text-base mt-2 font-medium">{subtitle}</p>}
              </div>
              {actions}
            </div>
          )}

          {children}
        </div>
      </main>
      
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/80 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};
