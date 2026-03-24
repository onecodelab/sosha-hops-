
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
import { useAuth } from '../AuthContext';
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

    const NavItem = ({ icon: Icon, label, path, allowedRoles, badge }: any) => {
        const isActive = location.pathname === path;
        const itemRef = React.useRef<HTMLButtonElement>(null);

        React.useEffect(() => {
            if (isActive && itemRef.current) {
                itemRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
        }, [isActive]);

        return (
            <RoleGuard allowedRoles={allowedRoles} hideOnly>
                <div className="relative group/nav">
                    <button
                        ref={itemRef}
                        onClick={() => navigate(path)}
                        className={cn(
                            "w-full flex items-center transition-all duration-300 relative rounded-xl",
                            isCollapsed ? "justify-center h-12 mb-1" : "gap-3 px-3 py-2.5 mb-1",
                            isActive
                                ? "bg-primary/10 text-primary"
                                : "text-foreground/50 hover:text-foreground hover:bg-white/[0.05]"
                        )}
                    >
                        {/* Active Indicator Dot */}
                        {isActive && (
                            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-r-full" />
                        )}

                        <Icon className={cn("w-5 h-5 shrink-0 transition-transform duration-300", 
                            isActive ? "text-primary scale-110" : "text-foreground/40 group-hover/nav:text-white"
                        )} />
                        
                        {!isCollapsed && (
                            <div className="flex-1 flex items-center justify-between overflow-hidden">
                                <span className={cn(
                                    "text-[13px] font-medium tracking-tight text-left truncate",
                                    isActive ? "text-primary font-bold" : ""
                                )}>
                                    {label}
                                </span>
                                {badge && (
                                    <span className="text-[10px] font-bold bg-muted/20 text-muted px-1.5 py-0.5 rounded-md">
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
                    <div className="h-px flex-1 bg-primary/5 mx-3 group-hover/section:bg-primary/20 transition-colors" />
                </div>
            )}
            <div className="space-y-1">
                {children}
            </div>
        </div>
    );

    return (
        <aside
            className={cn(
                "hidden md:flex flex-col relative z-20 bg-[#0A0A0A]/80 backdrop-blur-3xl border-r border-primary/5 transition-all duration-500",
                isCollapsed ? "w-[72px]" : "w-64"
            )}
        >
            <div className={cn("flex items-center justify-center pt-3 pb-4", isCollapsed ? "" : "px-6")}>
                <div className="relative group cursor-pointer" onClick={() => navigate('/app')}>
                    <div className="absolute -inset-4 bg-primary/10 rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
                    <BaroLogo variant={isCollapsed ? "compact" : "full"} className="relative z-10" />
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
                                    ? "bg-white/[0.02] border-primary/10 hover:border-primary/30 hover:bg-white/[0.04]"
                                    : "bg-muted/5 border-border/10 cursor-default"
                            )}
                        >
                            <div className="flex items-center gap-2.5 overflow-hidden">
                                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 border border-primary/10">
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
                            <div className="absolute top-full left-0 right-0 mt-3 py-2 bg-[#121212] border border-primary/20 rounded-2xl shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-200 backdrop-blur-3xl">
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
                                                : "text-muted hover:text-foreground hover:bg-white/[0.05]"
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
                    <NavItem
                        icon={User}
                        label={t('nav.myStation')}
                        path="/app/waiter"
                        allowedRoles={['waiter', 'owner', 'admin']}
                    />
                    <NavItem
                        icon={Monitor}
                        label={t('nav.kds')}
                        path="/app/kitchen"
                        allowedRoles={['kitchen', 'owner', 'admin']}
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
                        "w-full flex items-center transition-all duration-300 rounded-xl text-red-400/60 hover:text-red-400 hover:bg-red-500/10",
                        isCollapsed ? "justify-center h-12" : "gap-3 px-3 py-2.5"
                    )}
                >
                    <LogOut className="w-5 h-5 shrink-0" />
                    {!isCollapsed && <span className="text-[13px] font-medium tracking-tight">Logout</span>}
                </button>
                
                {!isCollapsed && (
                    <div className="pt-4 px-3 flex items-center justify-between border-t border-white/[0.03] mt-4">
                        <span className="text-[10px] font-black text-muted/30 uppercase tracking-widest">Baro OS 1.2.4</span>
                        <div className="flex gap-1">
                            <div className="w-1 h-1 rounded-full bg-primary/20" />
                            <div className="w-1 h-1 rounded-full bg-primary/40" />
                            <div className="w-1 h-1 rounded-full bg-primary/60" />
                        </div>
                    </div>
                )}
            </div>

            {/* Collapse Toggle */}
            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-24 w-6 h-6 bg-[#0A0A0A] border border-primary/20 rounded-full flex items-center justify-center text-muted hover:text-primary transition-all shadow-2xl z-40 group overflow-hidden"
            >
                <div className="absolute inset-0 bg-primary/10 translate-y-full group-hover:translate-y-0 transition-transform" />
                {isCollapsed ? <ChevronRight className="w-3 h-3 relative z-10" /> : <ChevronLeft className="w-3 h-3 relative z-10" />}
            </button>
        </aside>
    );
};
