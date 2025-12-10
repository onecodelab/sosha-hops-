import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { 
  LogOut, Menu, Search, Wallet,
  LayoutDashboard, ShoppingBag, 
  Users, Settings, 
  Table2, Armchair, ClipboardList, Utensils, Flame,
  ChevronDown, Bell, ChevronLeft, ChevronRight
} from 'lucide-react';
import { cn } from './ui';
import ThemeToggle from './ThemeToggle';
import { SoshaLogo } from './SoshaLogo';
import { Role } from '../types';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, title, subtitle, actions }) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Collapsible Sidebar State
  const [isCollapsed, setIsCollapsed] = useState(false);
  
  // Profile Dropdown State
  const [isProfileActive, setIsProfileActive] = useState(false);
  const profileRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleProfile = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileActive(false);
      }
    };
    document.addEventListener("click", handleProfile);
    return () => document.removeEventListener("click", handleProfile);
  }, []);

  // Menu Logic
  const getSidebarItems = (role: Role) => {
    switch (role) {
      case 'owner':
      case 'admin' as any: 
        return [
          { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
          { icon: Utensils, label: 'Menu', path: '/menu-analytics' },
          { icon: ShoppingBag, label: 'Inventory', path: '/inventory' },
          { icon: Users, label: 'Staff', path: '/staff-performance' },
          { icon: Table2, label: 'Tables', path: '/orders-tables' },
          { icon: Settings, label: 'Settings', path: '/settings' },
        ];
      case 'manager':
        return [
          { icon: LayoutDashboard, label: 'Dashboard', path: '/manager' },
          { icon: Users, label: 'Staff', path: '/staff-performance' },
          { icon: ClipboardList, label: 'Orders', path: '/orders-tables' },
          { icon: ShoppingBag, label: 'Inventory', path: '/inventory' },
        ];
      case 'waiter':
        return [
          { icon: LayoutDashboard, label: 'My Dashboard', path: '/waiter' },
          { icon: Armchair, label: 'Tables', path: '/waiter' },
          { icon: ClipboardList, label: 'Orders', path: '/waiter' },
          { icon: Utensils, label: 'Menu', path: '/waiter' },
        ];
      case 'kitchen':
        return [
          { icon: LayoutDashboard, label: 'KDS', path: '/kitchen' },
          { icon: Flame, label: 'Station Load', path: '/kitchen' },
        ];
      default:
        return [
           { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        ];
    }
  };

  const menuItems = getSidebarItems(profile?.role || 'owner');

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col md:flex-row font-sans transition-colors duration-300 selection:bg-primary selection:text-black">
      
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-[#111] border-b border-gray-800 z-50 sticky top-0">
        <div className="flex items-center gap-2">
           <div className="w-8 h-8"><SoshaLogo /></div>
           <span className="font-bold text-lg text-white">Sosha OS</span>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-gray-400 hover:text-white">
          <Menu />
        </button>
      </div>

      {/* Sidebar (Fixed Position) */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-40 bg-[#111] border-r border-gray-800 shadow-2xl shadow-black/50 transition-all duration-300 ease-in-out flex flex-col",
          // Mobile logic: Slide in/out
          isMobileMenuOpen ? "translate-x-0 w-72" : "-translate-x-full md:translate-x-0",
          // Desktop logic: Width based on collapse state
          !isMobileMenuOpen && (isCollapsed ? "md:w-[80px]" : "md:w-[260px]")
        )}
      >
        {/* Toggle Button (Desktop Only) */}
        <button 
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute -right-3 top-9 z-50 w-6 h-6 items-center justify-center bg-gray-800 border border-gray-700 text-gray-400 rounded-full hover:bg-gray-700 hover:text-white transition-colors shadow-lg"
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>

        <div className="flex flex-col h-full px-3">
            
            {/* 1. Logo Area */}
            <div className={cn("flex items-center py-8 transition-all duration-300", isCollapsed ? "justify-center" : "px-2 gap-3")}>
                 <div className="w-8 h-8 shrink-0 transition-transform duration-300 hover:scale-110">
                    <SoshaLogo />
                 </div>
                 <div className={cn("overflow-hidden transition-all duration-300", isCollapsed ? "w-0 opacity-0" : "w-auto opacity-100")}>
                    <span className="text-lg font-bold text-white tracking-tight whitespace-nowrap">Sosha OS</span>
                 </div>
            </div>

            {/* 2. User Profile (Top) */}
            <div className="mb-6 relative group">
                <div 
                  className={cn(
                    "flex items-center rounded-xl bg-gray-800/40 border border-gray-700/50 hover:border-gray-600 transition-all cursor-pointer overflow-hidden",
                    isCollapsed ? "justify-center p-2 bg-transparent border-transparent hover:bg-gray-800/50" : "p-3 gap-3"
                  )}
                  onClick={() => isCollapsed && setIsCollapsed(false)} 
                >
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20 text-primary font-bold text-sm overflow-hidden shrink-0">
                         <img 
                           src={`https://ui-avatars.com/api/?name=${profile?.name || 'User'}&background=FFB800&color=000`} 
                           alt="Avatar" 
                           className="w-full h-full object-cover opacity-90"
                         />
                    </div>
                    
                    <div className={cn("flex-1 min-w-0 transition-all duration-300", isCollapsed ? "w-0 opacity-0 hidden" : "w-auto opacity-100 block")}>
                        <span className="block text-gray-200 text-sm font-semibold truncate">{profile?.name || 'Ramin Naser'}</span>
                        <span className="block text-gray-500 text-xs truncate capitalize">{profile?.role || 'Owner'}</span>
                    </div>
                    
                    <button
                        ref={profileRef}
                        onClick={(e) => { e.stopPropagation(); if(!isCollapsed) setIsProfileActive(!isProfileActive); else setIsCollapsed(false); }}
                        className={cn("p-1 rounded-md text-gray-400 hover:text-white transition-all", isCollapsed ? "hidden" : "block")}
                        aria-expanded={isProfileActive}
                    >
                       <ChevronDown className={cn("w-4 h-4 transition-transform", isProfileActive && "rotate-180")} />
                    </button>
                </div>

                {isProfileActive && !isCollapsed && (
                    <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-[#1A1A1A] border border-gray-700 rounded-xl shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                         <div className="px-4 py-2 bg-black/20 text-xs text-gray-500">Account</div>
                         <button onClick={() => { setIsProfileActive(false); navigate('/settings'); }} className="w-full text-left px-4 py-2.5 text-sm text-gray-300 hover:bg-gray-800 hover:text-white transition-colors">Settings</button>
                         <div className="h-px bg-gray-800" />
                         <button onClick={() => { setIsProfileActive(false); signOut(); }} className="w-full text-left px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors">Sign Out</button>
                    </div>
                )}
            </div>

            {/* 3. Navigation */}
            <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar overflow-x-hidden">
                {!isCollapsed && (
                  <p className="px-3 text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 mt-2 animate-in fade-in duration-300">Menu</p>
                )}
                
                {menuItems.map((item, idx) => (
                    <button
                        key={idx}
                        onClick={() => { navigate(item.path); setIsMobileMenuOpen(false); }}
                        className={cn(
                            "w-full flex items-center transition-all duration-200 group relative",
                            isCollapsed ? "justify-center p-3 rounded-xl" : "gap-x-3 p-3 rounded-lg text-sm font-medium",
                            location.pathname === item.path
                                ? "bg-gray-800 text-white shadow-sm ring-1 ring-gray-700/50"
                                : "text-gray-400 hover:text-white hover:bg-gray-800/50"
                        )}
                        title={isCollapsed ? item.label : undefined}
                    >
                        {location.pathname === item.path && (
                          <div className={cn("absolute bg-primary rounded-full transition-all", isCollapsed ? "left-1 top-1/2 -translate-y-1/2 w-1 h-1" : "left-0 w-1 h-6 rounded-r-full")} />
                        )}
                        
                        <item.icon className={cn("w-5 h-5 transition-colors shrink-0", location.pathname === item.path ? "text-primary" : "text-gray-500 group-hover:text-primary/70")} />
                        
                        <span className={cn("whitespace-nowrap transition-all duration-300", isCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100")}>
                          {item.label}
                        </span>
                    </button>
                ))}
            </div>

            {/* 4. Footer Actions */}
            <div className="py-4 border-t border-gray-800 mt-auto space-y-1">
                <button 
                     className={cn(
                       "w-full flex items-center transition-all duration-200 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg",
                       isCollapsed ? "justify-center p-3" : "gap-x-3 p-3 text-sm font-medium"
                     )}
                     onClick={signOut}
                     title="Sign Out"
                >
                    <LogOut className="w-5 h-5 shrink-0" />
                    <span className={cn("whitespace-nowrap transition-all duration-300", isCollapsed ? "w-0 opacity-0 overflow-hidden" : "w-auto opacity-100")}>
                      Logout
                    </span>
                </button>
            </div>
        </div>
      </aside>

      {/* Main Content with Dynamic Margin */}
      <main 
        className={cn(
          "flex-1 h-screen overflow-y-auto bg-background transition-all duration-300 ease-in-out relative",
          // Apply margin only on Desktop (md), mobile is 0 (default)
          isCollapsed ? "md:ml-[80px]" : "md:ml-[260px]"
        )}
      >
        <div className="p-4 md:p-8 max-w-[1600px] mx-auto space-y-8">
          
          {/* Top Header */}
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-2">
            
            {/* Search Bar */}
            <div className="relative flex-1 max-w-md">
               <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-4 w-4 text-muted-foreground" />
               </div>
               <input 
                 type="text" 
                 placeholder="Search anything..." 
                 className="block w-full pl-11 pr-4 py-3 bg-card border border-border rounded-xl text-sm text-foreground shadow-sm focus:ring-2 focus:ring-primary/50 focus:border-primary/50 placeholder:text-muted-foreground/60 transition-all"
               />
            </div>

            {/* Right Side Actions */}
            <div className="flex items-center gap-4 md:gap-6 justify-end">
               <ThemeToggle />
               
               <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
                  <Bell className="w-5 h-5" />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
               </button>

               <div className="hidden md:flex items-center gap-3 bg-card border border-border px-4 py-2 rounded-full shadow-sm">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                     <Wallet className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] text-muted-foreground font-semibold uppercase">Revenue</span>
                     <span className="text-sm font-bold text-white">ETB 157,342</span>
                  </div>
               </div>
            </div>
          </header>

          {(title || subtitle) && (
            <div className="flex items-center justify-between animate-in fade-in-50 slide-in-from-bottom-2 duration-500">
              <div>
                <h1 className="text-2xl font-bold text-white">{title}</h1>
                {subtitle && <p className="text-muted-foreground text-sm mt-1">{subtitle}</p>}
              </div>
              {actions}
            </div>
          )}

          {children}
        </div>
      </main>
      
      {/* Mobile Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/80 md:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};