
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LogOut, LayoutDashboard, ShoppingBag, Users,
    ClipboardList, Utensils, ChevronLeft, ChevronRight,
    Trash2, Truck, PlusCircle, PackageCheck, FileText, Monitor, BookOpen, TrendingUp, Clock, ShoppingCart
} from 'lucide-react';
import { cn } from './ui';
import { BaroLogo } from './BaroLogo';
import { RoleGuard } from './RoleGuard';
import { useLanguage } from '../contexts/LanguageContext';
import { useRoleAccess } from '../hooks/useRoleAccess';
import { useBranch } from '../contexts/BranchContext';
import { useAuth } from '../AuthContext';
import { MapPin, ChevronDown } from 'lucide-react';

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

    const NavItem = ({ icon: Icon, label, path, allowedRoles }: any) => {
        const isActive = location.pathname === path;
        return (
            <RoleGuard allowedRoles={allowedRoles} hideOnly>
                <button
                    onClick={() => navigate(path)}
                    className={cn(
                        "w-full flex items-center gap-4 px-4 py-3 rounded-2xl transition-all duration-300 group",
                        isActive
                            ? "bg-primary text-black shadow-lg shadow-primary/20"
                            : "text-muted hover:text-foreground hover:bg-muted/10"
                    )}
                >
                    <Icon className={cn("w-5 h-5", isActive ? "text-black" : "text-muted group-hover:text-primary")} />
                    {!isCollapsed && <span className="font-bold text-sm tracking-tight">{label}</span>}
                </button>
            </RoleGuard>
        );
    };

    return (
        <aside
            className={cn(
                "hidden md:flex flex-col relative z-20 bg-card/60 backdrop-blur-3xl border-r border-border transition-all duration-500",
                isCollapsed ? "w-20" : "w-72"
            )}
        >
            <div className="flex flex-col p-6 h-32 border-b border-border/50">
                {!isCollapsed ? (
                    <div className="flex flex-col gap-4 animate-in fade-in duration-500">
                        <div className="h-12 w-full max-w-[160px]">
                            <BaroLogo />
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                            <span className="text-[10px] font-black uppercase text-muted-foreground tracking-[0.3em]">Master Unit</span>
                        </div>
                    </div>
                ) : (
                    <div className="h-10 w-full flex items-center justify-center">
                        <BaroLogo className="w-8 h-8" />
                    </div>
                )}
            </div>

            {/* Branch Selector Section */}
            {!isCollapsed && (
                <div className="px-5 mb-4 animate-in slide-in-from-left duration-500 delay-150">
                    <div className="relative">
                        <button
                            onClick={() => isOwnerOrAdmin && setIsBranchSelectorOpen(!isBranchSelectorOpen)}
                            className={cn(
                                "w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl border transition-all duration-300",
                                isOwnerOrAdmin
                                    ? "bg-primary/5 border-primary/20 hover:bg-primary/10 group"
                                    : "bg-muted/5 border-border cursor-default"
                            )}
                        >
                            <div className="flex items-center gap-3 overflow-hidden">
                                <MapPin className={cn("w-4 h-4 shrink-0", isOwnerOrAdmin ? "text-primary" : "text-gray-500")} />
                                <div className="flex flex-col items-start leading-none overflow-hidden text-left">
                                    <span className="text-[9px] font-black text-muted uppercase tracking-widest mb-0.5">Active Branch</span>
                                    <span className="text-sm font-bold text-foreground truncate w-full">
                                        {branchesLoading ? "Loading..." : (activeBranch?.name || "System Global")}
                                    </span>
                                </div>
                            </div>
                            {isOwnerOrAdmin && (
                                <ChevronDown className={cn("w-4 h-4 text-gray-500 transition-transform", isBranchSelectorOpen && "rotate-180")} />
                            )}
                        </button>

                        {isBranchSelectorOpen && isOwnerOrAdmin && (
                            <div className="absolute top-full left-0 right-0 mt-2 py-2 bg-card border border-border rounded-2xl shadow-2xl z-[100] animate-in fade-in zoom-in-95 duration-200">
                                {branches.map((branch) => (
                                    <button
                                        key={branch.id}
                                        onClick={() => {
                                            switchBranch(branch.id);
                                            setIsBranchSelectorOpen(false);
                                        }}
                                        className={cn(
                                            "w-full text-left px-4 py-2 text-sm font-bold transition-colors",
                                            activeBranch?.id === branch.id
                                                ? "text-primary bg-primary/10"
                                                : "text-muted hover:text-foreground hover:bg-muted/10"
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

            <nav className="flex-1 px-4 space-y-2 py-4 overflow-y-auto custom-scrollbar">
                {/* Dashboard/Ops */}
                <NavItem
                    icon={LayoutDashboard}
                    label="ADMIN HOME"
                    path="/admin"
                    allowedRoles={['owner', 'admin']}
                />
                <NavItem
                    icon={LayoutDashboard}
                    label={t('nav.opsDashboard')}
                    path="/manager"
                    allowedRoles={['manager']}
                />
                <NavItem
                    icon={LayoutDashboard}
                    label={t('nav.myStation')}
                    path="/waiter"
                    allowedRoles={['waiter']}
                />
                <NavItem
                    icon={ShoppingCart}
                    label="My Order Transaction"
                    path="/waiter/orders"
                    allowedRoles={['waiter']}
                />
                <NavItem
                    icon={LayoutDashboard}
                    label={t('nav.kds')}
                    path="/kitchen"
                    allowedRoles={['kitchen']}
                />

                {/* Kitchen Display - Manager only */}
                <NavItem
                    icon={Monitor}
                    label="Kitchen Board"
                    path="/kitchen"
                    allowedRoles={['manager']}
                />

                {/* Floor Live Map - Owner/Admin manage the floor */}
                <NavItem
                    icon={Monitor}
                    label="Floor Live Map"
                    path="/tables"
                    allowedRoles={['owner', 'admin', 'waiter', 'manager']}
                />

                {/* Menu Management & Analytics */}
                <NavItem
                    icon={BookOpen}
                    label={t('nav.menuManagement')}
                    path="/admin/menu"
                    allowedRoles={['owner', 'admin', 'manager']}
                />
                <NavItem
                    icon={Utensils}
                    label={t('nav.menuAnalytics')}
                    path="/menu-analytics"
                    allowedRoles={['owner', 'admin']}
                />

                {/* Inventory/Stock */}
                <NavItem
                    icon={ShoppingBag}
                    label={t('nav.inventory')}
                    path="/inventory"
                    allowedRoles={['manager', 'admin', 'owner']}
                />
                <NavItem
                    icon={Trash2}
                    label="Waste Analytics"
                    path="/admin/waste"
                    allowedRoles={['manager', 'admin', 'owner']}
                />

                <NavItem
                    icon={Trash2}
                    label={t('nav.waste')}
                    path="/kitchen/waste"
                    allowedRoles={['kitchen']}
                />
                <NavItem
                    icon={Truck}
                    label={t('nav.restock')}
                    path="/kitchen/restock"
                    allowedRoles={['kitchen']}
                />

                <NavItem
                    icon={ShoppingCart}
                    label={t('nav.purchaseOrders')}
                    path="/po/list"
                    allowedRoles={['owner', 'admin', 'manager']}
                />

                {/* Orders - Owner/Admin only */}
                <NavItem
                    icon={ClipboardList}
                    label={t('nav.orders')}
                    path="/orders-tables"
                    allowedRoles={['owner', 'admin']}
                />

                {/* Staff/Performance */}
                <NavItem
                    icon={Users}
                    label={t('nav.staffPerf')}
                    path="/admin/staff-performance"
                    allowedRoles={['owner', 'admin']}
                />

                {/* Settings */}
                <NavItem
                    icon={ClipboardList}
                    label={t('nav.settings')}
                    path="/settings"
                    allowedRoles={['admin', 'owner']}
                />
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

            <button
                onClick={() => setIsCollapsed(!isCollapsed)}
                className="absolute -right-3 top-24 w-6 h-6 bg-card border border-border rounded-full flex items-center justify-center text-muted hover:text-primary transition-colors shadow-lg z-30"
            >
                {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
        </aside>
    );
};
