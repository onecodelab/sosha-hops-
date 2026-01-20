
import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
    LogOut, LayoutDashboard, ShoppingBag, Users,
    ClipboardList, Utensils, ChevronLeft, ChevronRight,
    Trash2, Truck, PlusCircle, PackageCheck, FileText, Monitor, BookOpen, TrendingUp
} from 'lucide-react';
import { cn } from './ui';
import { SoshaLogo } from './SoshaLogo';
import { RoleGuard } from './RoleGuard';
import { useLanguage } from '../contexts/LanguageContext';

interface SidebarProps {
    isCollapsed: boolean;
    setIsCollapsed: (value: boolean) => void;
    handleLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isCollapsed, setIsCollapsed, handleLogout }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { t } = useLanguage();

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
                            : "text-muted hover:text-foreground hover:bg-white/5"
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
                    icon={LayoutDashboard}
                    label={t('nav.kds')}
                    path="/kitchen"
                    allowedRoles={['kitchen']}
                />

                {/* Kitchen Display (Management Access) */}
                <NavItem
                    icon={Monitor}
                    label="Kitchen Board"
                    path="/kitchen"
                    allowedRoles={['manager', 'admin']}
                />

                {/* Floor/Waiter Station */}
                <NavItem
                    icon={Monitor}
                    label="FLOOR LIVE MAP"
                    path="/tables"
                    allowedRoles={['waiter', 'manager', 'admin', 'owner']}
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
                    icon={ShoppingBag}
                    label={t('nav.stock')}
                    path="/kitchen/stock"
                    allowedRoles={['kitchen']}
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

                {/* Supply Chain */}
                <NavItem
                    icon={Truck}
                    label={t('nav.pendingRequests')}
                    path="/manager/pending-requests"
                    allowedRoles={['manager', 'owner', 'admin']}
                />
                <NavItem
                    icon={PlusCircle}
                    label={t('nav.createPO')}
                    path="/manager/create-po"
                    allowedRoles={['manager']}
                />
                <NavItem
                    icon={FileText}
                    label={t('nav.purchaseOrders')}
                    path="/manager/purchase-orders"
                    allowedRoles={['manager']}
                />
                <NavItem
                    icon={PackageCheck}
                    label={t('nav.receiveGoods')}
                    path="/manager/receive-goods"
                    allowedRoles={['manager']}
                />
                <NavItem
                    icon={ClipboardList}
                    label={t('nav.orders')}
                    path="/orders-tables"
                    allowedRoles={['manager']}
                />

                {/* Staff/Performance */}
                <NavItem
                    icon={Users}
                    label={t('nav.staffPerf')}
                    path="/admin/staff-performance"
                    allowedRoles={['owner', 'admin']}
                />
                <NavItem
                    icon={Users}
                    label={t('nav.staff')}
                    path="/staff-performance"
                    allowedRoles={['manager']}
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
