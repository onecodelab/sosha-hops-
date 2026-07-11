
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LogOut, LayoutDashboard, ShoppingBag, Users,
    ClipboardList, Utensils, ChevronLeft, ChevronRight,
    Trash2, Truck, PlusCircle, PackageCheck, FileText, Monitor, BookOpen, TrendingUp, Clock, ShoppingCart, Zap, DollarSign, ShieldAlert, Building, Bike
} from 'lucide-react';
import { cn } from './ui';
import { BaroLogo } from './BaroLogo';
import { RoleGuard } from './RoleGuard';
import { useLanguage } from '../contexts/LanguageContext';
import { useRoleAccess } from '../hooks/useRoleAccess';
import { useBranch } from '../contexts/BranchContext';
import { useAuth } from '@/contexts/AuthContext';
import { MapPin, ChevronDown, Home, Library, Settings as SettingsIcon, Package, Target, User } from 'lucide-react';

interface SidebarProps {
    isCollapsed: boolean;
    setIsCollapsed: (value: boolean) => void;
    handleLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, setIsCollapsed, handleLogout }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useLanguage();
    const { isOwnerOrAdmin } = useRoleAccess();
    const { profile } = useAuth();
    const { activeBranch, branches, switchBranch, isLoading: branchesLoading } = useBranch();
    const [isBranchSelectorOpen, setIsBranchSelectorOpen] = React.useState(false);

    const isSpecialRole = profile?.role === 'waiter' || profile?.role === 'kitchen';

    const NavItem = ({ icon: Icon, label, path, allowedRoles, badge }: any) => {
        const isActive = location.pathname === path;
        const itemRef = React.useRef<HTMLButtonElement>(null);

        React.useEffect(() => {
            if (isActive && itemRef.current) {
                itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, [isActive]);

        const buttonClasses = isSpecialRole
            ? cn(
                "w-full flex items-center transition-all duration-300 relative",
                isCollapsed ? "justify-center h-12 mb-2" : "gap-4 px-4 py-3 rounded-2xl mb-1",
                isActive
                    ? "bg-primary text-black shadow-lg shadow-primary/20"
                    : "text-muted hover:text-foreground hover:bg-foreground/5"
            )
            : cn(
                "w-full flex items-center transition-all duration-300 relative rounded-xl",
                isCollapsed ? "justify-center h-12 mb-1" : "gap-3 px-3 py-2.5 mb-1",
                isActive
                    ? "bg-primary/10 text-primary font-bold"
                    : "text-muted hover:text-foreground hover:bg-foreground/5"
            );

        return (
            <RoleGuard allowedRoles={allowedRoles} hideOnly>
                <div className="relative group/nav">
                    <button
                        ref={itemRef}
                        onClick={() => navigate(path)}
                        className={buttonClasses}
                    >
                        {!isSpecialRole && isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-r-full" />
                        )}

                        <Icon className={cn("w-5 h-5 shrink-0 transition-transform duration-300", 
                            isSpecialRole && isActive ? "text-black" : 
                            isActive ? "text-primary scale-110" : "text-muted group-hover/nav:text-foreground"
                        )} />
                        
                        {!isCollapsed && (
                            <div className="flex-1 flex items-center justify-between overflow-hidden">
                                <span className={cn(
                                    isSpecialRole ? "text-sm font-bold tracking-tight text-left truncate" : "text-[13px] font-medium tracking-tight text-left truncate",
                                    isActive ? (isSpecialRole ? "text-black" : "text-primary font-bold") : ""
                                )}>
                                    {label}
                                </span>
                                {badge && (
                                    <span className={cn(
                                        "text-[10px] font-bold px-1.5 py-0.5 rounded-md",
                                        isSpecialRole && isActive ? "bg-black/20 text-black" : "bg-muted/10 text-muted"
                                    )}>
                                        {badge}
                                    </span>
                                )}
                            </div>
                        )}
                    </button>

                    {/* Tooltip for collapsed mode */}
                    {isCollapsed && (
                        <div className="absolute left-[calc(100%+12px)] top-1/2 -translate-y-1/2 px-3 py-1.5 bg-card border border-primary/20 rounded-lg text-xs font-bold text-foreground opacity-0 pointer-events-none group-hover/nav:opacity-100 transition-all duration-200 shadow-2xl z-[100] whitespace-nowrap">
                            {label}
                            {/* Arrow */}
                            <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-card border-l border-b border-primary/20 rotate-45" />
                        </div>
                    )}
                </div>
            </RoleGuard>
        );
    };

    const NavSection = ({ label, children }: { label: string, children: React.ReactNode }) => (
        <div className="mb-6 last:mb-2">
            {!isCollapsed && (
                <div className="px-3 mb-2 flex items-center justify-between group/section cursor-pointer">
                    <span className="text-[10px] font-black text-muted/60 uppercase tracking-[0.2em] group-hover/section:text-primary transition-colors">{label}</span>
                    <div className="h-px flex-1 bg-primary/10 mx-3 group-hover/section:bg-primary/20 transition-colors" />
                </div>
            )}
            <div className="space-y-1">
                {children}
            </div>
        </div>
    );

    if (isSpecialRole) {
        return (
            <aside
                className={cn(
                    "hidden md:flex flex-col relative z-20 bg-card border-r border-primary/5 transition-[width,background-color,border-color] duration-500 ease-in-out",
                    isCollapsed ? "w-20" : "w-72"
                )}
            >
                <div className="flex-none flex flex-col justify-center px-6 h-16 md:h-20 lg:h-24 border-b border-primary/5 transition-colors duration-500">
                    {!isCollapsed ? (
                        <div className="flex flex-col gap-1 animate-in fade-in duration-500">
                            <div className="h-10 w-full max-w-[140px] cursor-pointer" onClick={() => navigate('/')}>
                                <BaroLogo />
                            </div>
                            <div className="flex items-center gap-2">
                                <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                <span className="text-[10px] font-black uppercase text-muted tracking-[0.3em]">Master Unit</span>
                            </div>
                        </div>
                    ) : (
                        <div className="h-10 w-full flex items-center justify-center">
                            <BaroLogo className="w-8 h-8" variant="compact" />
                        </div>
                    )}
                </div>

                {/* Legacy Branch Display for Waiter/Kitchen */}
                {!isCollapsed && (
                    <div className="p-5 animate-in slide-in-from-left duration-500 delay-150">
                        <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex items-center gap-4 group hover:bg-primary/10 transition-all cursor-default">
                            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center border border-primary/20 shrink-0">
                                <MapPin className="w-5 h-5 text-primary" />
                            </div>
                            <div className="flex flex-col leading-tight overflow-hidden text-left">
                                <span className="text-[9px] font-black text-muted uppercase tracking-[0.2em] mb-1">Active Branch</span>
                                <span className="text-sm font-bold text-foreground truncate w-full italic">
                                    {activeBranch?.name || "Bole Micheal"}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                <nav className="flex-1 px-4 space-y-2 py-4 overflow-y-auto no-scrollbar">
                    {profile?.role === 'waiter' ? (
                        <>
                            <NavItem icon={LayoutDashboard} label="My Station" path="/app/waiter" allowedRoles={['waiter']} />
                            <NavItem icon={ShoppingCart} label="My Order Transaction" path="/app/waiter/orders" allowedRoles={['waiter']} />
                            <NavItem icon={DollarSign} label="My Tips & Gratuity" path="/app/waiter/tips" allowedRoles={['waiter']} />
                            <NavItem icon={Monitor} label="Floor Live Map" path="/app/tables" allowedRoles={['waiter']} />
                        </>
                    ) : (
                        <>
                            <NavItem icon={Monitor} label="Kitchen Display" path="/app/kitchen" allowedRoles={['kitchen']} />
                            <NavItem icon={Package} label="Kitchen Stock" path="/app/kitchen/stock" allowedRoles={['kitchen']} />
                            <NavItem icon={Trash2} label="Kitchen Waste" path="/app/kitchen/waste" allowedRoles={['kitchen']} />
                            <NavItem icon={Truck} label="Restock" path="/app/kitchen/restock" allowedRoles={['kitchen']} />
                        </>
                    )}
                </nav>

                <div className="p-4 border-t border-primary/20">
                    <button
                        onClick={handleLogout}
                        className={cn(
                            "w-full flex items-center gap-4 px-4 py-3 rounded-2xl text-muted hover:text-red-500 hover:bg-red-500/10 transition-all duration-300 group",
                            isCollapsed && "justify-center"
                        )}
                    >
                        <LogOut className="w-5 h-5 group-hover:scale-110 transition-transform" />
                        {!isCollapsed && <span className="font-bold text-sm tracking-tight uppercase tracking-widest">Sign Out</span>}
                    </button>
                </div>

                <button
                    onClick={() => setIsCollapsed(!isCollapsed)}
                    className="absolute -right-3 h-16 md:h-20 lg:h-24 flex items-center justify-center z-[60]"
                >
                    <div className="w-6 h-6 bg-card border border-primary/20 rounded-full flex items-center justify-center text-muted hover:text-primary transition-all shadow-sm">
                        {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                    </div>
                </button>
            </aside>
        );
    }

    return (
        <aside
            className={cn(
                "hidden md:flex flex-col relative z-20 bg-card border-r border-primary/5 transition-[width,background-color,border-color] duration-500 ease-in-out",
                isCollapsed ? "w-[72px]" : "w-64"
            )}
        >
            <div className={cn("flex-none h-16 md:h-20 lg:h-24 flex items-center border-b border-primary/5 transition-colors duration-500", isCollapsed ? "justify-center" : "px-6")}>
                <div className="relative group cursor-pointer" onClick={() => navigate('/app')}>
                    <BaroLogo iconOnly className="relative z-10 w-12 h-12" />
                </div>
            </div>

            {/* Branch Selector Section */}
            {!isCollapsed && (
                <div className="px-4 mb-4">
                    <div className="relative">
                        <button
                            onClick={() => isOwnerOrAdmin && setIsBranchSelectorOpen(!isBranchSelectorOpen)}
                            className={cn(
                                "w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border transition-all duration-300",
                                isOwnerOrAdmin
                                    ? "bg-primary/5 border-primary/10 hover:border-primary/20 hover:bg-primary/10"
                                    : "bg-primary/5 border-primary/5 cursor-default"
                            )}
                        >
                            <div className="flex items-center gap-2.5 overflow-hidden">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/5">
                                    <MapPin className={cn("w-4 h-4", isOwnerOrAdmin ? "text-primary" : "text-muted")} />
                                </div>
                                <div className="flex flex-col items-start leading-tight overflow-hidden text-left">
                                    <span className="text-[10px] font-black text-muted/50 uppercase tracking-widest mb-0.5">Branch</span>
                                    <span className="text-[13px] font-bold text-foreground truncate w-full">
                                        {branchesLoading ? "Loading..." : (activeBranch?.name || "System Global")}
                                    </span>
                                </div>
                            </div>
                            {isOwnerOrAdmin && (
                                <ChevronDown className={cn("w-3.5 h-3.5 text-muted/50 transition-transform duration-300", isBranchSelectorOpen && "rotate-180")} />
                            )}
                        </button>

                        {isBranchSelectorOpen && isOwnerOrAdmin && (
                            <div className="absolute top-full left-0 right-0 mt-3 py-2 bg-card border border-primary/10 rounded-2xl shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-200 backdrop-blur-3xl">
                                {branches.map((branch) => (
                                    <button
                                        key={branch.id}
                                        onClick={() => {
                                            switchBranch(branch.id);
                                            setIsBranchSelectorOpen(false);
                                        }}
                                        className={cn(
                                            "w-full text-left px-4 py-2.5 text-[13px] font-medium transition-colors",
                                            activeBranch?.id === branch.id
                                                ? "text-primary bg-primary/10"
                                                : "text-muted hover:text-foreground hover:bg-primary/5"
                                        )}
                                    >
                                        {branch.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <nav className="flex-1 px-4 py-2 overflow-y-auto no-scrollbar">
                <NavSection label="Core">
                    <NavItem
                        icon={LayoutDashboard}
                        label={t('nav.adminHome')}
                        path="/app/admin"
                        allowedRoles={['owner', 'admin']}
                    />
                </NavSection>

                <NavSection label="Operations">
                    <NavItem
                        icon={ClipboardList}
                        label={t('nav.orders')}
                        path="/app/orders-tables"
                        allowedRoles={['owner', 'admin']}
                    />
                    <NavItem
                        icon={MapPin}
                        label={t('nav.floorLiveMap')}
                        path="/app/tables"
                        allowedRoles={['owner', 'admin', 'waiter', 'manager']}
                    />
                </NavSection>

                <NavSection label="Management">
                    <NavItem
                        icon={Package}
                        label={t('nav.inventory')}
                        path="/app/inventory"
                        allowedRoles={['manager', 'admin', 'owner']}
                    />
                    <NavItem
                        icon={BookOpen}
                        label={t('nav.menuManagement')}
                        path="/app/admin/menu"
                        allowedRoles={['owner', 'admin', 'manager']}
                    />
                    <NavItem
                        icon={ClipboardList}
                        label={t('nav.transactions') || "Transactions"}
                        path="/app/menu-transactions"
                        allowedRoles={['owner', 'admin', 'manager']}
                    />
                    <NavItem
                        icon={Users}
                        label={t('nav.staffPerf')}
                        path="/app/admin/staff-performance"
                        allowedRoles={['owner', 'admin']}
                    />
                </NavSection>

                <NavSection label="Tools">
                    <NavItem
                        icon={TrendingUp}
                        label={t('nav.menuAnalytics')}
                        path="/app/menu-analytics"
                        allowedRoles={['owner', 'admin']}
                    />
                    <NavItem
                        icon={DollarSign}
                        label={t('nav.tipsAudit')}
                        path="/app/admin/tips"
                        allowedRoles={['owner', 'admin']}
                    />
                    <NavItem
                        icon={Building}
                        label="Logistics Hub"
                        path="/app/supplier/dashboard"
                        allowedRoles={['supplier']}
                    />
                </NavSection>

                <RoleGuard allowedRoles={['super_admin']} hideOnly>
                    <NavSection label="System">
                        <NavItem
                            icon={ShieldAlert}
                            label="Platform Admin"
                            path="/app/baro-admin"
                        />
                    </NavSection>
                </RoleGuard>
            </nav>

            <div className="p-4 space-y-1">
                <NavItem
                    icon={SettingsIcon}
                    label={t('nav.settings')}
                    path="/app/settings"
                    allowedRoles={['admin', 'owner']}
                />
                <button
                    onClick={handleLogout}
                    className={cn(
                        "w-full flex items-center transition-all duration-300 rounded-xl text-muted hover:text-red-500 hover:bg-red-500/10",
                        isCollapsed ? "justify-center h-12" : "gap-3 px-3 py-2.5"
                    )}
                >
                    <LogOut className="w-5 h-5 shrink-0" />
                    {!isCollapsed && <span className="text-[13px] font-medium tracking-tight">{t('nav.logout') || "Sign Out"}</span>}
                </button>
                
                {!isCollapsed && (
                    <div className="pt-4 px-3 flex items-center justify-between border-t border-primary/5 mt-4">
                        <span className="text-[10px] font-black text-muted/30 uppercase tracking-widest">Baro OS 1.2.4</span>
                        <div className="flex gap-1">
                            <div className="w-1 h-1 rounded-full bg-primary/20" />
                            <div className="w-1 h-1 rounded-full bg-primary/40" />
                            <div className="w-1 h-1 rounded-full bg-primary/60" />
                        </div>
                    </div>
                )}
            </div>

            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 h-16 md:h-20 lg:h-24 flex items-center justify-center z-[60] group overflow-hidden"
            >
                <div className="w-6 h-6 bg-card border border-primary/10 rounded-full flex items-center justify-center text-muted hover:text-primary transition-all shadow-sm relative z-10">
                    <div className="absolute inset-0 bg-primary/10 translate-y-full group-hover:translate-y-0 transition-transform -z-1" />
                    {isCollapsed ? <ChevronRight className="w-3 h-3" /> : <ChevronLeft className="w-3 h-3" />}
                </div>
            </button>
        </aside>
    );
};
