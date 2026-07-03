
import React from 'react';
import { ChevronDown, Bell } from 'lucide-react';
import { cn, Button, Badge } from './ui';
import ThemeToggle from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { RoleGuard } from './RoleGuard';
import { useLanguage } from '../contexts/LanguageContext';
import { LogOut, Users } from 'lucide-react';

interface HeaderProps {
    title?: string;
    subtitle?: string;
    headerStats?: { label: string; value: number };
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
        <header className="flex-none h-16 md:h-20 lg:h-24 flex items-center justify-between px-4 md:px-8 border-b border-primary/5 bg-background/80 backdrop-blur-xl transition-all duration-500 relative z-30 shadow-sm">
            <div className="flex flex-col flex-1 overflow-hidden pr-2">
                <h2 className="text-lg md:text-xl lg:text-2xl font-black tracking-tight text-foreground truncate">{title || t('nav.overview')}</h2>
                {subtitle && <p className="hidden lg:block text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none mt-1 truncate">{subtitle}</p>}
            </div>

            <div className="flex items-center gap-6">

                {/* Revenue Widget - Managed with RoleGuard */}
                {headerStats && (
                    <RoleGuard allowedRoles={['owner', 'admin', 'manager']} hideOnly>
                        <div className="hidden lg:flex items-center gap-8 mr-4">
                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-black text-muted-foreground uppercase tracking-widest">{headerStats.label}</span>
                                <span className="text-xl font-black text-foreground font-mono tracking-tighter">{t('adminDashboard.etb')} {headerStats.value.toLocaleString()}</span>
                            </div>
                        </div>
                    </RoleGuard>
                )}

                <div className="flex items-center gap-2 md:gap-3">
                    <ThemeToggle />
                    <LanguageSwitcher />

                    <div className="h-8 w-px bg-primary/10 mx-1 hidden sm:block" />

                    {/* Profile Dropdown */}
                    <div className="relative">
                        <button
                            ref={profileRef}
                            onClick={() => setIsProfileActive(!isProfileActive)}
                            className="flex items-center gap-2 p-1 rounded-full bg-primary/5 border border-primary/20 hover:bg-primary/10 hover:border-primary/30 transition-all group shrink-0"
                        >
                            <div className="w-10 h-10 rounded-full overflow-hidden bg-primary shadow-[0_0_20px_rgba(255,184,0,0.3)] border-2 border-primary/30 shrink-0">
                                {profile?.avatar_url ? (
                                    <img src={profile.avatar_url} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-black font-black text-lg bg-primary">
                                        {displayName.charAt(0).toUpperCase()}
                                    </div>
                                )}
                            </div>
                            <div className="hidden md:flex flex-col items-start leading-tight pr-2 overflow-hidden">
                                <span className="text-sm font-bold text-primary truncate max-w-[100px]">{displayName}</span>
                                <span className="text-[9px] font-black text-primary/60 uppercase tracking-widest">{role}</span>
                            </div>
                            <ChevronDown className={cn("hidden md:block w-4 h-4 text-primary/60 transition-transform duration-300", isProfileActive && "rotate-180")} />
                        </button>

                        {isProfileActive && (
                            <div className="absolute top-full right-0 mt-3 w-64 bg-card border border-primary/20 rounded-3xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-300">
                                <div className="p-5 bg-gradient-to-br from-primary to-primary/80 text-black">
                                    <p className="font-black text-xl tracking-tighter truncate">{displayName}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <Badge className="bg-primary/10 text-black border-primary/10 text-[8px] font-black uppercase">{role}</Badge>
                                        <span className="w-1 h-1 rounded-full bg-primary/10" />
                                        <span className="text-[9px] font-bold uppercase opacity-60 tracking-widest">{t('common.activeStation')}</span>
                                    </div>
                                </div>
                                <div className="p-2">
                                    <button className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-foreground hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-3">
                                        <Users className="w-4 h-4" /> {t('common.myProfile')}
                                    </button>
                                    <button className="w-full text-left px-4 py-3 rounded-xl text-sm font-bold text-foreground hover:bg-primary/10 hover:text-primary transition-colors flex items-center gap-3">
                                        <Bell className="w-4 h-4" /> {t('common.notifications')}
                                    </button>
                                    <div className="h-px bg-primary/20 my-2 mx-2" />
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
