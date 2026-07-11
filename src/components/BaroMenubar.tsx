import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Menubar } from '@base-ui/react/menubar';
import { Menu } from '@base-ui/react/menu';
import { LayoutDashboard, Monitor, ShoppingBag, BookOpen, Users, LogOut, Settings, User, DollarSign, Database, Trash2, RefreshCw, ClipboardList, Menu as MenuIcon } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
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
        <Menubar className="flex">
            <Menu.Root>
                <Menu.Trigger className="h-10 rounded-xl px-4 bg-[#fbbd41] hover:bg-[#fbbd41]/90 text-[#0c0d0e] border-2 border-[#0c0d0e] shadow-[-3px_3px_0px_#0c0d0e] hover:shadow-[-1px_1px_0px_#0c0d0e] hover:translate-x-0.5 hover:translate-y-0.5 active:translate-x-1 active:translate-y-1 active:shadow-none transition-all text-xs font-black uppercase tracking-wider flex items-center gap-2 outline-none select-none">
                    <MenuIcon className="w-4 h-4 text-[#0c0d0e]" />
                    <span>MENU</span>
                </Menu.Trigger>

                <Menu.Portal>
                    <Menu.Positioner className="outline-none z-[100]" sideOffset={8}>
                        <Menu.Popup className="origin-[var(--transform-origin)] rounded-[24px] bg-white border-2 border-[#0c0d0e] p-2 text-[#0c0d0e] shadow-[-8px_8px_0px_#0c0d0e] outline-none w-[230px] max-h-[80vh] overflow-y-auto animate-in fade-in zoom-in-95 duration-150">
                            
                            {/* Active Branch Header */}
                            <div className="px-3.5 py-2.5 mb-1.5 rounded-xl bg-[#faf9f7] border border-[#dad4c8]">
                                <p className="text-[9px] font-black text-[#55534e] uppercase tracking-widest">Active Branch</p>
                                <p className="text-xs font-black text-[#078a52] uppercase tracking-tight truncate mt-0.5">
                                    {activeBranch ? activeBranch.name : 'Main Branch'}
                                </p>
                            </div>

                            {/* ROLE: WAITER-SPECIFIC TABS */}
                            <RoleGuard allowedRoles={['waiter']} hideOnly>
                                <div className="px-3 pt-2 pb-1">
                                    <p className="text-[9px] font-black text-[#55534e] uppercase tracking-wider">Station</p>
                                </div>
                                <Menu.Item onClick={() => handleNav('/app/waiter')} className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0c0d0e] outline-none select-none hover:bg-[#fbbd41] hover:text-[#0c0d0e] data-[highlighted]:bg-[#fbbd41] data-[highlighted]:text-[#0c0d0e] transition-colors">
                                    <User className="w-4 h-4 text-[#078a52] shrink-0" />
                                    <span>Station</span>
                                </Menu.Item>
                                <Menu.Item onClick={() => handleNav('/app/waiter/orders')} className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0c0d0e] outline-none select-none hover:bg-[#fbbd41] hover:text-[#0c0d0e] data-[highlighted]:bg-[#fbbd41] data-[highlighted]:text-[#0c0d0e] transition-colors">
                                    <ShoppingBag className="w-4 h-4 text-[#078a52] shrink-0" />
                                    <span>My Orders</span>
                                </Menu.Item>
                                <Menu.Item onClick={() => handleNav('/app/waiter/tips')} className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0c0d0e] outline-none select-none hover:bg-[#fbbd41] hover:text-[#0c0d0e] data-[highlighted]:bg-[#fbbd41] data-[highlighted]:text-[#0c0d0e] transition-colors">
                                    <DollarSign className="w-4 h-4 text-[#078a52] shrink-0" />
                                    <span>My Tips</span>
                                </Menu.Item>
                            </RoleGuard>

                            {/* ROLE: KITCHEN APPS */}
                            <RoleGuard allowedRoles={['kitchen']} hideOnly>
                                <div className="px-3 pt-2 pb-1">
                                    <p className="text-[9px] font-black text-[#55534e] uppercase tracking-wider">Kitchen</p>
                                </div>
                                <Menu.Item onClick={() => handleNav('/app/kitchen')} className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0c0d0e] outline-none select-none hover:bg-[#fbbd41] hover:text-[#0c0d0e] data-[highlighted]:bg-[#fbbd41] data-[highlighted]:text-[#0c0d0e] transition-colors">
                                    <Monitor className="w-4 h-4 text-[#078a52] shrink-0" />
                                    <span>Display</span>
                                </Menu.Item>
                                <Menu.Item onClick={() => handleNav('/app/kitchen/stock')} className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0c0d0e] outline-none select-none hover:bg-[#fbbd41] hover:text-[#0c0d0e] data-[highlighted]:bg-[#fbbd41] data-[highlighted]:text-[#0c0d0e] transition-colors">
                                    <Database className="w-4 h-4 text-[#078a52] shrink-0" />
                                    <span>Stock</span>
                                </Menu.Item>
                                <Menu.Item onClick={() => handleNav('/app/kitchen/waste')} className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0c0d0e] outline-none select-none hover:bg-[#fbbd41] hover:text-[#0c0d0e] data-[highlighted]:bg-[#fbbd41] data-[highlighted]:text-[#0c0d0e] transition-colors">
                                    <Trash2 className="w-4 h-4 text-[#078a52] shrink-0" />
                                    <span>Waste</span>
                                </Menu.Item>
                                <Menu.Item onClick={() => handleNav('/app/kitchen/restock')} className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0c0d0e] outline-none select-none hover:bg-[#fbbd41] hover:text-[#0c0d0e] data-[highlighted]:bg-[#fbbd41] data-[highlighted]:text-[#0c0d0e] transition-colors">
                                    <RefreshCw className="w-4 h-4 text-[#078a52] shrink-0" />
                                    <span>Restock</span>
                                </Menu.Item>
                            </RoleGuard>

                            {/* ROLE: ADMIN/MANAGER APPS */}
                            <RoleGuard allowedRoles={['owner', 'admin', 'manager']} hideOnly>
                                <div className="px-3 pt-2 pb-1">
                                    <p className="text-[9px] font-black text-[#55534e] uppercase tracking-wider">Home</p>
                                </div>
                                <RoleGuard allowedRoles={['owner', 'admin']} hideOnly>
                                    <Menu.Item onClick={() => handleNav('/app/admin')} className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0c0d0e] outline-none select-none hover:bg-[#fbbd41] hover:text-[#0c0d0e] data-[highlighted]:bg-[#fbbd41] data-[highlighted]:text-[#0c0d0e] transition-colors">
                                        <LayoutDashboard className="w-4 h-4 text-[#078a52] shrink-0" />
                                        <span>Home</span>
                                    </Menu.Item>
                                </RoleGuard>
                                <RoleGuard allowedRoles={['manager']} hideOnly>
                                    <Menu.Item onClick={() => handleNav('/app/manager')} className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0c0d0e] outline-none select-none hover:bg-[#fbbd41] hover:text-[#0c0d0e] data-[highlighted]:bg-[#fbbd41] data-[highlighted]:text-[#0c0d0e] transition-colors">
                                        <LayoutDashboard className="w-4 h-4 text-[#078a52] shrink-0" />
                                        <span>Operations</span>
                                    </Menu.Item>
                                </RoleGuard>
                            </RoleGuard>

                            {/* SHARED MAP */}
                            <RoleGuard allowedRoles={['owner', 'admin', 'waiter', 'manager']} hideOnly>
                                {!isWaiter && (
                                    <div className="px-3 pt-2 pb-1 border-t border-dashed border-[#dad4c8] mt-1.5">
                                        <p className="text-[9px] font-black text-[#55534e] uppercase tracking-wider">Floor</p>
                                    </div>
                                )}
                                <Menu.Item onClick={() => handleNav('/app/tables')} className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0c0d0e] outline-none select-none hover:bg-[#fbbd41] hover:text-[#0c0d0e] data-[highlighted]:bg-[#fbbd41] data-[highlighted]:text-[#0c0d0e] transition-colors">
                                    <Monitor className="w-4 h-4 text-[#078a52] shrink-0" />
                                    <span>Tables</span>
                                </Menu.Item>
                            </RoleGuard>

                            {/* MANAGE TOOLS */}
                            <RoleGuard allowedRoles={['owner', 'admin', 'manager']} hideOnly>
                                <div className="px-3 pt-2 pb-1 border-t border-dashed border-[#dad4c8] mt-1.5">
                                    <p className="text-[9px] font-black text-[#55534e] uppercase tracking-wider">Manage</p>
                                </div>
                                
                                <RoleGuard allowedRoles={['owner', 'admin', 'manager']} hideOnly>
                                    <Menu.Item onClick={() => handleNav('/app/admin/menu')} className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0c0d0e] outline-none select-none hover:bg-[#fbbd41] hover:text-[#0c0d0e] data-[highlighted]:bg-[#fbbd41] data-[highlighted]:text-[#0c0d0e] transition-colors">
                                        <BookOpen className="w-4 h-4 text-[#078a52] shrink-0" />
                                        <span>Menu</span>
                                    </Menu.Item>
                                </RoleGuard>

                                <RoleGuard allowedRoles={['manager', 'admin', 'owner']} hideOnly>
                                    <Menu.Item onClick={() => handleNav('/app/inventory')} className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0c0d0e] outline-none select-none hover:bg-[#fbbd41] hover:text-[#0c0d0e] data-[highlighted]:bg-[#fbbd41] data-[highlighted]:text-[#0c0d0e] transition-colors">
                                        <ShoppingBag className="w-4 h-4 text-[#078a52] shrink-0" />
                                        <span>Stock</span>
                                    </Menu.Item>
                                </RoleGuard>

                                <RoleGuard allowedRoles={['owner', 'admin', 'manager']} hideOnly>
                                    <Menu.Item onClick={() => handleNav('/app/menu-transactions')} className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0c0d0e] outline-none select-none hover:bg-[#fbbd41] hover:text-[#0c0d0e] data-[highlighted]:bg-[#fbbd41] data-[highlighted]:text-[#0c0d0e] transition-colors">
                                        <ClipboardList className="w-4 h-4 text-[#078a52] shrink-0" />
                                        <span>Orders</span>
                                    </Menu.Item>
                                </RoleGuard>

                                <RoleGuard allowedRoles={['owner', 'admin']} hideOnly>
                                    <Menu.Item onClick={() => handleNav('/app/admin/staff-performance')} className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0c0d0e] outline-none select-none hover:bg-[#fbbd41] hover:text-[#0c0d0e] data-[highlighted]:bg-[#fbbd41] data-[highlighted]:text-[#0c0d0e] transition-colors">
                                        <Users className="w-4 h-4 text-[#078a52] shrink-0" />
                                        <span>Staff</span>
                                    </Menu.Item>
                                </RoleGuard>
                            </RoleGuard>

                            {/* ACCOUNT / SETTINGS */}
                            <div className="px-3 pt-2 pb-1 border-t border-dashed border-[#dad4c8] mt-1.5">
                                <p className="text-[9px] font-black text-[#55534e] uppercase tracking-wider">Account</p>
                            </div>
                            
                            <RoleGuard allowedRoles={['admin', 'owner']} hideOnly>
                                <Menu.Item onClick={() => handleNav('/app/settings')} className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#0c0d0e] outline-none select-none hover:bg-[#fbbd41] hover:text-[#0c0d0e] data-[highlighted]:bg-[#fbbd41] data-[highlighted]:text-[#0c0d0e] transition-colors">
                                    <Settings className="w-4 h-4 text-[#078a52] shrink-0" />
                                    <span>Settings</span>
                                </Menu.Item>
                            </RoleGuard>

                            <Menu.Item
                                onClick={handleLogout}
                                className="flex cursor-pointer items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-bold text-[#e11d48] outline-none select-none hover:bg-[#e11d48]/10 data-[highlighted]:bg-[#e11d48]/10 transition-colors mt-1"
                            >
                                <LogOut className="w-4 h-4 text-[#e11d48] shrink-0" />
                                <span>Sign Out</span>
                            </Menu.Item>

                        </Menu.Popup>
                    </Menu.Positioner>
                </Menu.Portal>
            </Menu.Root>
        </Menubar>
    );
}
