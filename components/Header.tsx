
import React from 'react';
import { ChevronDown, Bell } from 'lucide-react';
import { cn, Button } from './ui';
import ThemeToggle from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { RoleGuard } from './RoleGuard';
import { useLanguage } from '../contexts/LanguageContext';
import { LogOut, Users } from 'lucide-react';

interface HeaderProps {
    title?: string;
    subtitle?: string;
    headerStats: { label: string; value: number };
    profile: any;
    displayName: string;
    role: string;
    isProfileActive: boolean;
    setIsProfileActive: (value: boolean) => void;
    profileRef: React.RefObject<HTMLButtonElement>;
    handleLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
    title, subtitle, headerStats, profile, displayName, role, isProfileActive, setIsProfileActive, profileRef, handleLogout
}) => {
    const { t } = useLanguage();

    return (
        <header className="flex-none h-24 flex items-center justify-between px-8 border-b border-white/5 bg-card/40 backdrop-blur-md">
            <div className="flex flex-col">
                <h2 className="text-2xl font-bold tracking-tight text-white">{title || t('nav.overview')}</h2>
                {subtitle && <p className="text-xs font-medium text-gray-500 uppercase tracking-widest">{subtitle}</p>}
            </div>

            <div className="flex items-center gap-6">

                {/* Revenue Widget - Managed with RoleGuard */}
                <RoleGuard allowedRoles={['owner', 'admin', 'manager']} hideOnly>
                    <div className="hidden lg:flex items-center gap-8 mr-4">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{headerStats.label}</span>
                            <span className="text-xl font-black text-white font-mono tracking-tighter">ETB {headerStats.value.toLocaleString()}</span>
                        </div>
                    </div>
                </RoleGuard>

                <div className="flex items-center gap-3">
                    <ThemeToggle />
                    <LanguageSwitcher />

                    <div className="h-10 w-px bg-border mx-2 hidden sm:block" />

                    {/* Profile Dropdown */}
                    <div className="relative">
                        <button
                            ref={profileRef}
                            onClick={() => setIsProfileActive(!isProfileActive)}
                            className="flex items-center gap-3 pl-2 pr-4 py-1.5 rounded-full bg-white/5 border border-white/10 hover:bg-white/10 transition-all group"
                        >
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-primary shadow-[0_0_15px_rgba(255,184,0,0.3)] border-2 border-primary/20">
                                {profile?.avatar_url ? (
                                    <img src={profile.avatar_url} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-black font-black text-lg bg-primary">
                                        {displayName.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="hidden sm:flex flex-col items-start leading-tight">
                                <span className="text-sm font-bold text-white group-hover:text-primary transition-colors">{displayName}</span>
                                <span className="text-[9px] font-black text-gray-500 uppercase tracking-wider">{role}</span>
                            </div>
                            <ChevronDown className={cn("w-4 h-4 text-gray-600 transition-transform duration-300", isProfileActive && "rotate-180")} />
                        </button>

                        {isProfileActive && (
                            <div className="absolute top-full right-0 mt-3 w-64 bg-card border border-border rounded-3xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="p-4 bg-primary text-black">
                                    <p className="font-black text-lg tracking-tight truncate">{displayName}</p>
                                    <p className="text-[10px] font-bold uppercase opacity-60 tracking-widest">{role}</p>
                                </div>
                                <div className="p-2">
                                    <button className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-gray-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3">
                                        <Users className="w-4 h-4" /> My Profile
                                    </button>
                                    <button className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-gray-300 hover:bg-white/5 hover:text-white transition-colors flex items-center gap-3">
                                        <Bell className="w-4 h-4" /> Notifications
                                    </button>
                                    <div className="h-px bg-border my-2 mx-2" />
                                    <button
                                        onClick={handleLogout}
                                        className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-3"
                                    >
                                        <LogOut className="w-4 h-4" /> {t('common.logout')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};
