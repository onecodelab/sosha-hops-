import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Menubar } from '@base-ui/react/menubar';
import { Menu } from '@base-ui/react/menu';
import { ChevronRight, LayoutDashboard, Monitor, ShoppingBag, BookOpen, Users, LogOut, Settings, User, DollarSign, Database, Trash2, RefreshCw, ClipboardList } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useBranch } from '../contexts/BranchContext';
import { RoleGuard } from './RoleGuard';

export default function BaroMenubar() {
    const navigate = useNavigate();
    const { signOut, profile } = useAuth();
    const { activeBranchId, branches } = useBranch();

    const handleNav = (path: string) => {
        navigate(path);
    };

    const handleLogout = async () => {
        await signOut();
        window.location.replace('/');
    };

    const isWaiter = profile?.role === 'waiter';
    const activeBranch = branches.find(b => b.id === activeBranchId);

    return (
        <Menubar className="flex rounded-xl border border-primary/20 bg-primary/5 backdrop-blur-2xl p-1 shadow-lg shadow-black/20">
            <Menu.Root>
                <Menu.Trigger className="h-9 rounded-lg px-4 text-sm font-black uppercase tracking-wider text-muted-foreground outline-none select-none hover:bg-foreground/5 data-[popup-open]:bg-foreground/10 data-[popup-open]:text-primary transition-all">
                    Menu
                </Menu.Trigger>
                <Menu.Portal>
                    <Menu.Positioner className="outline-none z-[100]" sideOffset={8}>
                        <Menu.Popup className="origin-[var(--transform-origin)] rounded-xl bg-card border border-primary/20 py-1.5 text-foreground shadow-2xl shadow-black/30 outline-none w-[240px] max-h-[80vh] overflow-y-auto custom-scrollbar animate-in fade-in zoom-in-95 duration-200">
                            
                            <div className="px-4 py-3 mb-1 bg-black/20">
                                <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Active Branch</p>
                                <p className="text-sm font-black text-primary uppercase tracking-tighter truncate mt-0.5">{activeBranch ? activeBranch.name : 'Unknown Branch'}</p>
                            </div>

                            {/* ROLE: WAITER-SPECIFIC TABS */}
                            <RoleGuard allowedRoles={['waiter']} hideOnly>
                                <div className="px-4 pt-4 pb-2 border-t border-primary/10">
                                    <p className="text-[8px] font-black text-primary/60 uppercase tracking-widest">Station Tools</p>
                                </div>
                                <Menu.Item onClick={() => handleNav('/app/waiter')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-xs font-bold outline-none select-none hover:bg-primary/10 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary transition-colors">
                                    <div className="flex items-center gap-3">
                                        <User className="w-4 h-4 text-amber-500 shrink-0" />
                                        <span className="uppercase tracking-widest truncate">My Station</span>
                                    </div>
                                </Menu.Item>
                                <Menu.Item onClick={() => handleNav('/app/waiter/orders')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-xs font-bold outline-none select-none hover:bg-primary/10 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary transition-colors">
                                    <div className="flex items-center gap-3">
                                        <ShoppingBag className="w-4 h-4 text-purple-400 shrink-0" />
                                        <span className="uppercase tracking-widest truncate">My Transactions</span>
                                    </div>
                                </Menu.Item>
                                <Menu.Item onClick={() => handleNav('/app/waiter/tips')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-xs font-bold outline-none select-none hover:bg-primary/10 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary transition-colors">
                                    <div className="flex items-center gap-3">
                                        <DollarSign className="w-4 h-4 text-emerald-400 shrink-0" />
                                        <span className="uppercase tracking-widest truncate">My Tips</span>
                                    </div>
                                </Menu.Item>
                            </RoleGuard>

                            {/* ROLE: KITCHEN APPS */}
                            <RoleGuard allowedRoles={['kitchen']} hideOnly>
                                <div className="px-4 pt-4 pb-2 border-t border-primary/10">
                                    <p className="text-[8px] font-black text-primary/60 uppercase tracking-widest">Kitchen Tools</p>
                                </div>
                                <Menu.Item onClick={() => handleNav('/app/kitchen')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-xs font-bold outline-none select-none hover:bg-primary/10 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Monitor className="w-4 h-4 text-emerald-500 shrink-0" />
                                        <span className="uppercase tracking-widest truncate">Kitchen Display</span>
                                    </div>
                                </Menu.Item>
                                <Menu.Item onClick={() => handleNav('/app/kitchen/stock')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-xs font-bold outline-none select-none hover:bg-primary/10 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Database className="w-4 h-4 text-blue-400 shrink-0" />
                                        <span className="uppercase tracking-widest truncate">Kitchen Stock</span>
                                    </div>
                                </Menu.Item>
                                <Menu.Item onClick={() => handleNav('/app/kitchen/waste')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-xs font-bold outline-none select-none hover:bg-primary/10 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Trash2 className="w-4 h-4 text-orange-400 shrink-0" />
                                        <span className="uppercase tracking-widest truncate">Kitchen Waste</span>
                                    </div>
                                </Menu.Item>
                                <Menu.Item onClick={() => handleNav('/app/kitchen/restock')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-xs font-bold outline-none select-none hover:bg-primary/10 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary transition-colors">
                                    <div className="flex items-center gap-3">
                                        <RefreshCw className="w-4 h-4 text-purple-400 shrink-0" />
                                        <span className="uppercase tracking-widest truncate">Restock Requests</span>
                                    </div>
                                </Menu.Item>
                            </RoleGuard>

                            {/* ROLE: ADMIN/MANAGER APPS */}
                            <RoleGuard allowedRoles={['owner', 'admin', 'manager']} hideOnly>
                                <div className="px-4 pt-4 pb-2 border-t border-primary/10">
                                    <p className="text-[8px] font-black text-primary/60 uppercase tracking-widest">Core Apps</p>
                                </div>
                                <RoleGuard allowedRoles={['owner', 'admin']} hideOnly>
                                    <Menu.Item onClick={() => handleNav('/app/admin')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-xs font-bold outline-none select-none hover:bg-primary/10 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary transition-colors">
                                        <div className="flex items-center gap-3">
                                            <LayoutDashboard className="w-4 h-4 text-primary shrink-0" />
                                            <span className="uppercase tracking-widest truncate">Admin Home</span>
                                        </div>
                                    </Menu.Item>
                                </RoleGuard>
                                <RoleGuard allowedRoles={['manager']} hideOnly>
                                    <Menu.Item onClick={() => handleNav('/app/manager')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-xs font-bold outline-none select-none hover:bg-primary/10 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary transition-colors">
                                        <div className="flex items-center gap-3">
                                            <LayoutDashboard className="w-4 h-4 text-primary shrink-0" />
                                            <span className="uppercase tracking-widest truncate">Ops Dashboard</span>
                                        </div>
                                    </Menu.Item>
                                </RoleGuard>
                            </RoleGuard>

                            {/* SHARED MAP */}
                            <RoleGuard allowedRoles={['owner', 'admin', 'waiter', 'manager']} hideOnly>
                                { !isWaiter && (
                                    <div className="px-4 pt-4 pb-2">
                                       <p className="text-[8px] font-black text-primary/60 uppercase tracking-widest">Floor</p>
                                    </div>
                                )}
                                <Menu.Item onClick={() => handleNav('/app/tables')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-xs font-bold outline-none select-none hover:bg-primary/10 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Monitor className="w-4 h-4 text-blue-400 shrink-0" />
                                        <span className="uppercase tracking-widest truncate">Floor Live Map</span>
                                    </div>
                                </Menu.Item>
                            </RoleGuard>

                            {/* MANAGE TOOLS */}
                            <RoleGuard allowedRoles={['owner', 'admin', 'manager']} hideOnly>
                                <div className="px-4 pt-4 pb-2 border-t border-primary/10 mt-2">
                                    <p className="text-[8px] font-black text-primary/60 uppercase tracking-widest">Manage</p>
                                </div>
                                
                                <RoleGuard allowedRoles={['owner', 'admin', 'manager']} hideOnly>
                                    <Menu.Item onClick={() => handleNav('/app/admin/menu')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-xs font-bold outline-none select-none hover:bg-primary/10 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary transition-colors">
                                        <div className="flex items-center gap-3">
                                            <BookOpen className="w-4 h-4 text-orange-400 shrink-0" />
                                            <span className="uppercase tracking-widest truncate">Menu Keys</span>
                                        </div>
                                    </Menu.Item>
                                </RoleGuard>

                                <RoleGuard allowedRoles={['manager', 'admin', 'owner']} hideOnly>
                                    <Menu.Item onClick={() => handleNav('/app/inventory')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-xs font-bold outline-none select-none hover:bg-primary/10 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary transition-colors">
                                        <div className="flex items-center gap-3">
                                            <ShoppingBag className="w-4 h-4 text-purple-400 shrink-0" />
                                            <span className="uppercase tracking-widest truncate">Inventory</span>
                                        </div>
                                    </Menu.Item>
                                </RoleGuard>

                                <RoleGuard allowedRoles={['owner', 'admin', 'manager']} hideOnly>
                                    <Menu.Item onClick={() => handleNav('/app/menu-transactions')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-xs font-bold outline-none select-none hover:bg-primary/10 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary transition-colors">
                                        <div className="flex items-center gap-3">
                                            <ClipboardList className="w-4 h-4 text-amber-400 shrink-0" />
                                            <span className="uppercase tracking-widest truncate">Transactions</span>
                                        </div>
                                    </Menu.Item>
                                </RoleGuard>

                                <RoleGuard allowedRoles={['owner', 'admin']} hideOnly>
                                    <Menu.Item onClick={() => handleNav('/app/admin/staff-performance')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-xs font-bold outline-none select-none hover:bg-primary/10 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary transition-colors">
                                        <div className="flex items-center gap-3">
                                            <Users className="w-4 h-4 text-green-400 shrink-0" />
                                            <span className="uppercase tracking-widest truncate">Staff Perf.</span>
                                        </div>
                                    </Menu.Item>
                                </RoleGuard>
                            </RoleGuard>

                            {/* SYSTEM */}
                            <div className="px-4 pt-4 pb-2 border-t border-primary/10 mt-2">
                                <p className="text-[8px] font-black text-primary/60 uppercase tracking-widest">System</p>
                            </div>
                            
                            <RoleGuard allowedRoles={['admin', 'owner']} hideOnly>
                                <Menu.Item onClick={() => handleNav('/app/settings')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-xs font-bold outline-none select-none hover:bg-primary/10 data-[highlighted]:bg-primary/10 data-[highlighted]:text-primary transition-colors">
                                    <div className="flex items-center gap-3">
                                        <Settings className="w-4 h-4 text-gray-400 shrink-0" />
                                        <span className="uppercase tracking-widest truncate">Settings</span>
                                    </div>
                                </Menu.Item>
                            </RoleGuard>

                            <Menu.Item
                                onClick={handleLogout}
                                className="flex cursor-pointer items-center justify-between gap-4 px-4 py-3 text-xs font-bold outline-none select-none hover:bg-red-500/10 hover:text-red-500 data-[highlighted]:bg-red-500/10 data-[highlighted]:text-red-500 transition-colors uppercase tracking-widest mt-1 mb-2"
                            >
                                <div className="flex items-center gap-3">
                                    <LogOut className="w-4 h-4 text-red-500 shrink-0" />
                                    <span>Logout</span>
                                </div>
                            </Menu.Item>

                        </Menu.Popup>
                    </Menu.Positioner>
                </Menu.Portal>
            </Menu.Root>
        </Menubar>
    );
}
