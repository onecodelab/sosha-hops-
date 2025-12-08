import React from 'react';
import { useAuth } from '../AuthContext';
import { LogOut, Menu as MenuIcon, User, LayoutDashboard, Coffee, ChefHat, ClipboardList, Shield } from 'lucide-react';
import { Role } from '../types';
import { cn, Button } from './ui';
import { SoshaLogo } from './SoshaLogo';
import ThemeToggle from './ThemeToggle';

interface DashboardLayoutProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

const DashboardLayout: React.FC<DashboardLayoutProps> = ({ title, subtitle, actions, children }) => {
  const { user, profile, signOut } = useAuth();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = React.useState(false);

  const getRoleIcon = (role: Role) => {
    switch (role) {
      case 'owner': return <Shield className="w-5 h-5" />;
      case 'manager': return <LayoutDashboard className="w-5 h-5" />;
      case 'waiter': return <Coffee className="w-5 h-5" />;
      case 'kitchen': return <ChefHat className="w-5 h-5" />;
      default: return <User className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row transition-colors duration-300">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 border-b border-border bg-card">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 flex items-center justify-center">
             <SoshaLogo className="w-full h-full" />
          </div>
          <div className="text-foreground font-bold text-xl">Sosha OS</div>
        </div>
        <button onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)} className="text-muted hover:text-foreground">
          <MenuIcon />
        </button>
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out md:translate-x-0 md:static",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="h-full flex flex-col p-4">
          <div className="hidden md:flex items-center gap-3 mb-8 px-2">
            <div className="h-10 w-10 flex items-center justify-center">
               <SoshaLogo className="w-full h-full" />
            </div>
            <span className="font-bold text-xl text-foreground tracking-tight">Sosha OS</span>
          </div>

          <div className="flex-1 space-y-1">
            <div className="px-2 py-2 mb-4 bg-black/5 dark:bg-white/5 rounded-lg flex items-center gap-3 border border-border">
               <div className="p-2 bg-gray-200 dark:bg-gray-800 rounded-full text-foreground">
                  {profile && getRoleIcon(profile.role)}
               </div>
               <div className="overflow-hidden">
                 <p className="text-sm font-medium text-foreground truncate">{profile?.name || 'User'}</p>
                 <p className="text-xs text-muted capitalize">{profile?.role}</p>
               </div>
            </div>

            {/* In a real app, navigation links would go here. */}
          </div>

          <div className="border-t border-border pt-4">
             <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" onClick={signOut}>
               <LogOut className="mr-2 h-4 w-4" />
               Sign Out
             </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto h-screen bg-background transition-colors duration-300">
        <div className="container mx-auto max-w-7xl p-4 md:p-8 space-y-8">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">{title}</h1>
              {subtitle && <p className="text-muted mt-1">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-4">
              <ThemeToggle />
              {actions}
            </div>
          </header>
          {children}
        </div>
      </main>
      
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </div>
  );
};

export default DashboardLayout;