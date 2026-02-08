import * as React from 'react';
import { useNavigate } from 'react-router-dom';
import { Menubar } from '@base-ui/react/menubar';
import { Menu } from '@base-ui/react/menu';
import { ChevronRight, LayoutDashboard, Monitor, ShoppingBag, BookOpen, Users, LogOut, Settings, User } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useBranch } from '../contexts/BranchContext';
import { RoleGuard } from './RoleGuard';

export default function BaroMenubar() {
    const navigate = useNavigate();
    const { signOut } = useAuth();

    const handleNav = (path: string) => {
        navigate(path);
    };

    const handleLogout = async () => {
        await signOut();
        window.location.replace('/');
    };

    return (
        <Menubar className="flex rounded-xl border border-white/5 bg-black/40 backdrop-blur-2xl p-1 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
            {/* APPS MENU */}
            <Menu.Root>
                <Menu.Trigger className="h-9 rounded-lg px-4 text-sm font-black uppercase tracking-wider text-gray-400 outline-none select-none hover:bg-white/5 data-[popup-open]:bg-white/10 data-[popup-open]:text-white transition-all">
                    Apps
                </Menu.Trigger>
                <Menu.Portal>
                    <Menu.Positioner className="outline-none z-[100]" sideOffset={8}>
                        <Menu.Popup className="origin-[var(--transform-origin)] rounded-xl bg-[#0A0A0A] border border-white/10 py-1.5 text-white shadow-2xl shadow-black/80 outline-none min-w-[160px] animate-in fade-in zoom-in-95 duration-200">

                            <RoleGuard allowedRoles={['owner', 'admin']} hideOnly>
                                <Menu.Item onClick={() => handleNav('/admin')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5 text-sm font-bold outline-none select-none hover:bg-white/5 data-[highlighted]:bg-white/5">
                                    <div className="flex items-center gap-3">
                                        <LayoutDashboard className="w-4 h-4 text-primary" />
                                        <span>Admin Home</span>
                                    </div>
                                </Menu.Item>
                            </RoleGuard>

                            <RoleGuard allowedRoles={['manager']} hideOnly>
                                <Menu.Item onClick={() => handleNav('/manager')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5 text-sm font-bold outline-none select-none hover:bg-white/5 data-[highlighted]:bg-white/5">
                                    <div className="flex items-center gap-3">
                                        <LayoutDashboard className="w-4 h-4 text-primary" />
                                        <span>Ops Dashboard</span>
                                    </div>
                                </Menu.Item>
                            </RoleGuard>

                            <RoleGuard allowedRoles={['owner', 'admin', 'waiter', 'manager']} hideOnly>
                                <Menu.Item onClick={() => handleNav('/tables')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5 text-sm font-bold outline-none select-none hover:bg-white/5 data-[highlighted]:bg-white/5">
                                    <div className="flex items-center gap-3">
                                        <Monitor className="w-4 h-4 text-blue-400" />
                                        <span>Floor Map</span>
                                    </div>
                                </Menu.Item>
                            </RoleGuard>

                            <RoleGuard allowedRoles={['waiter']} hideOnly>
                                <Menu.Item onClick={() => handleNav('/waiter')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5 text-sm font-bold outline-none select-none hover:bg-white/5 data-[highlighted]:bg-white/5">
                                    <div className="flex items-center gap-3">
                                        <User className="w-4 h-4 text-amber-500" />
                                        <span>Waiter Station</span>
                                    </div>
                                </Menu.Item>
                            </RoleGuard>
                        </Menu.Popup>
                    </Menu.Positioner>
                </Menu.Portal>
            </Menu.Root>

            {/* MANAGE MENU */}
            <Menu.Root>
                <Menu.Trigger className="h-9 rounded-lg px-4 text-sm font-black uppercase tracking-wider text-gray-400 outline-none select-none hover:bg-white/5 data-[popup-open]:bg-white/10 data-[popup-open]:text-white transition-all">
                    Manage
                </Menu.Trigger>
                <Menu.Portal>
                    <Menu.Positioner className="outline-none z-[100]" sideOffset={8}>
                        <Menu.Popup className="origin-[var(--transform-origin)] rounded-xl bg-[#0A0A0A] border border-white/10 py-1.5 text-white shadow-2xl shadow-black/80 outline-none min-w-[160px] animate-in fade-in zoom-in-95 duration-200">

                            <RoleGuard allowedRoles={['owner', 'admin', 'manager']} hideOnly>
                                <Menu.Item onClick={() => handleNav('/admin/menu')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5 text-sm font-bold outline-none select-none hover:bg-white/5 data-[highlighted]:bg-white/5">
                                    <div className="flex items-center gap-3">
                                        <BookOpen className="w-4 h-4 text-orange-400" />
                                        <span>Menu Keys</span>
                                    </div>
                                </Menu.Item>
                            </RoleGuard>

                            <RoleGuard allowedRoles={['manager', 'admin', 'owner']} hideOnly>
                                <Menu.Item onClick={() => handleNav('/inventory')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5 text-sm font-bold outline-none select-none hover:bg-white/5 data-[highlighted]:bg-white/5">
                                    <div className="flex items-center gap-3">
                                        <ShoppingBag className="w-4 h-4 text-purple-400" />
                                        <span>Inventory</span>
                                    </div>
                                </Menu.Item>
                            </RoleGuard>

                            <RoleGuard allowedRoles={['owner', 'admin']} hideOnly>
                                <Menu.Item onClick={() => handleNav('/admin/staff-performance')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5 text-sm font-bold outline-none select-none hover:bg-white/5 data-[highlighted]:bg-white/5">
                                    <div className="flex items-center gap-3">
                                        <Users className="w-4 h-4 text-green-400" />
                                        <span>Staff Perf.</span>
                                    </div>
                                </Menu.Item>
                            </RoleGuard>

                        </Menu.Popup>
                    </Menu.Positioner>
                </Menu.Portal>
            </Menu.Root>

            {/* SYSTEM MENU */}
            <Menu.Root>
                <Menu.Trigger className="h-9 rounded-lg px-4 text-sm font-black uppercase tracking-wider text-gray-400 outline-none select-none hover:bg-white/5 data-[popup-open]:bg-white/10 data-[popup-open]:text-white transition-all">
                    System
                </Menu.Trigger>
                <Menu.Portal>
                    <Menu.Positioner className="outline-none z-[100]" sideOffset={8}>
                        <Menu.Popup className="origin-[var(--transform-origin)] rounded-xl bg-[#0A0A0A] border border-white/10 py-1.5 text-white shadow-2xl shadow-black/80 outline-none min-w-[160px] animate-in fade-in zoom-in-95 duration-200">

                            <RoleGuard allowedRoles={['admin', 'owner']} hideOnly>
                                <Menu.Item onClick={() => handleNav('/settings')} className="flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5 text-sm font-bold outline-none select-none hover:bg-white/5 data-[highlighted]:bg-white/5">
                                    <div className="flex items-center gap-3">
                                        <Settings className="w-4 h-4 text-gray-400" />
                                        <span>Settings</span>
                                    </div>
                                </Menu.Item>
                            </RoleGuard>

                            <Menu.Separator className="mx-4 my-1.5 h-px bg-white/10" />

                            <Menu.Item
                                onClick={handleLogout}
                                className="flex cursor-pointer items-center justify-between gap-4 px-4 py-2.5 text-sm font-bold outline-none select-none hover:bg-red-500/10 hover:text-red-500 data-[highlighted]:bg-red-500/10"
                            >
                                <div className="flex items-center gap-3">
                                    <LogOut className="w-4 h-4" />
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
