import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Menu, X, ArrowRight, LogIn } from 'lucide-react';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '../contexts/LanguageContext';
import { BaroLogo } from './BaroLogo';

interface MarketingLayoutProps {
    children: React.ReactNode;
}

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children }) => {
    const { user } = useAuth();
    const { t } = useLanguage();
    const [mobileOpen, setMobileOpen] = useState(false);

    const navLinks = [
        { label: t('marketingNav.features') || 'Features', to: '/features' },
        { label: t('marketingNav.pricing') || 'Pricing', to: '/pricing' },
        { label: t('marketingNav.demo') || 'Book Demo', to: '/book-demo' },
    ];

    return (
        <div className="min-h-screen bg-[#faf9f7] text-[#0c0d0e] flex flex-col font-sans selection:bg-[#84e7a5] selection:text-[#02492a]">
            {/* Navigation — Clay artisanal warm header */}
            <header className="sticky top-0 z-50 bg-[#faf9f7]/95 backdrop-blur-md border-b border-[#dad4c8] h-20 flex items-center">
                <div className="max-w-7xl mx-auto px-6 w-full flex items-center justify-between">
                    {/* Brand Logo & Links */}
                    <div className="flex items-center gap-10">
                        <Link to="/" className="flex items-center" aria-label="Baro OS Home">
                            <BaroLogo className="scale-100" />
                        </Link>

                        <nav className="hidden md:flex items-center gap-7">
                            {navLinks.map((l) => (
                                <Link
                                    key={l.to}
                                    to={l.to}
                                    className="text-[#55534e] hover:text-[#0c0d0e] font-medium text-[15px] transition-colors"
                                >
                                    {l.label}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    {/* Actions & Language Switcher */}
                    <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="hidden sm:block">
                            <LanguageSwitcher />
                        </div>

                        {user ? (
                            <Link to="/app">
                                <button className="clay-btn-outline text-xs sm:text-sm px-3.5 sm:px-4 py-2">
                                    <span>{t('marketingNav.dashboard') || 'Dashboard'}</span>
                                </button>
                            </Link>
                        ) : (
                            <>
                                {/* PINNED MOBILE SIGN IN BUTTON */}
                                <Link
                                    to="/login"
                                    className="flex items-center gap-1.5 font-bold text-xs sm:text-sm text-[#0c0d0e] px-3.5 py-2 rounded-full border-2 border-[#0c0d0e] bg-white shadow-[-3px_3px_0px_#0c0d0e] hover:bg-[#84e7a5]/20 transition-all"
                                >
                                    <LogIn className="w-3.5 h-3.5 text-[#078a52]" />
                                    <span>{t('marketingNav.login') || 'Sign In'}</span>
                                </Link>

                                {/* DESKTOP BOOK DEMO BUTTON */}
                                <Link to="/book-demo" className="hidden md:block">
                                    <button className="clay-btn-primary text-sm px-5 py-2.5">
                                        <span>{t('marketingNav.demo') || 'Book Demo'}</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </button>
                                </Link>
                            </>
                        )}

                        {/* Mobile Menu Button */}
                        <button
                            className="md:hidden p-2 text-[#0c0d0e] bg-white hover:bg-[#faf9f7] rounded-xl border-2 border-[#0c0d0e] transition-colors shadow-[-2px_2px_0px_#0c0d0e]"
                            onClick={() => setMobileOpen(!mobileOpen)}
                            aria-label="Toggle menu"
                        >
                            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Mobile Dropdown Menu */}
                {mobileOpen && (
                    <div className="absolute top-20 left-0 right-0 md:hidden bg-[#faf9f7] border-b-2 border-[#0c0d0e] p-6 shadow-2xl space-y-5 z-50">
                        {/* Navigation Links */}
                        <div className="space-y-3">
                            {navLinks.map((l) => (
                                <Link
                                    key={l.to}
                                    to={l.to}
                                    onClick={() => setMobileOpen(false)}
                                    className="block font-bold text-lg text-[#0c0d0e] py-2 border-b border-[#dad4c8]/60"
                                >
                                    {l.label}
                                </Link>
                            ))}
                        </div>

                        {/* Language Selector Row */}
                        <div className="pt-2 flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-[#55534e] uppercase">
                                SELECT LANGUAGE:
                            </span>
                            <LanguageSwitcher />
                        </div>

                        {/* Mobile Action Buttons (Login & Book Demo) */}
                        {!user ? (
                            <div className="space-y-3 pt-2">
                                <Link
                                    to="/login"
                                    onClick={() => setMobileOpen(false)}
                                    className="w-full flex items-center justify-center gap-2 font-bold text-base text-[#0c0d0e] py-3.5 px-4 rounded-2xl border-2 border-[#0c0d0e] bg-white shadow-[-4px_4px_0px_#0c0d0e] hover:translate-x-0.5 hover:-translate-y-0.5 transition-transform"
                                >
                                    <LogIn className="w-5 h-5 text-[#078a52]" />
                                    <span>{t('marketingNav.login') || 'Sign In to Baro OS'}</span>
                                </Link>

                                <Link
                                    to="/book-demo"
                                    onClick={() => setMobileOpen(false)}
                                    className="w-full block"
                                >
                                    <button className="clay-btn-primary w-full justify-center py-3.5 text-base">
                                        <span>{t('marketingNav.demo') || 'Book a Free Demo'}</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </button>
                                </Link>
                            </div>
                        ) : (
                            <div className="pt-2">
                                <Link
                                    to="/app"
                                    onClick={() => setMobileOpen(false)}
                                    className="w-full block"
                                >
                                    <button className="clay-btn-primary w-full justify-center py-3.5 text-base">
                                        <span>{t('marketingNav.dashboard') || 'Go to Dashboard'}</span>
                                        <ArrowRight className="w-5 h-5" />
                                    </button>
                                </Link>
                            </div>
                        )}
                    </div>
                )}
            </header>

            {/* Main Content */}
            <main className="flex-1">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-[#faf9f7] border-t border-[#dad4c8] py-12 px-6">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#55534e]">
                    <div className="flex items-center gap-2">
                        <BaroLogo className="scale-75" />
                        <span className="font-bold text-[#0c0d0e]">Baro OS</span>
                        <span>• Ethiopian Restaurant Operations</span>
                    </div>
                    <div className="flex items-center gap-6">
                        <Link to="/features" className="hover:text-[#0c0d0e]">{t('marketingNav.features') || 'Features'}</Link>
                        <Link to="/pricing" className="hover:text-[#0c0d0e]">{t('marketingNav.pricing') || 'Pricing'}</Link>
                        <Link to="/login" className="hover:text-[#0c0d0e] font-semibold text-[#078a52]">
                            {t('marketingNav.login') || 'Sign In'}
                        </Link>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default MarketingLayout;
