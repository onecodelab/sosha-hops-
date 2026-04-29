import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from './ui';
import { useAuth } from '../AuthContext';
import { Menu, X, Settings2, Globe, Sparkles } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
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
        { label: t('marketingNav.features'), to: '/features' },
        { label: t('marketingNav.pricing'), to: '/pricing' },
        { label: t('marketingNav.demo'), to: '/book-demo' },
    ];

    return (
        <div className="min-h-screen bg-background flex flex-col font-sans text-foreground transition-colors duration-500">
            {/* Navigation */}
            <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-foreground/10 h-16 flex items-center transition-colors duration-500">
                <div className="max-w-[1440px] mx-auto px-4 sm:px-8 w-full">
                    <div className="flex justify-between items-center relative">
                        {/* Logo & Left Links */}
                        <div className="flex items-center gap-12">
                            <Link to="/" className="flex items-center gap-3">
                                <BaroLogo className="scale-100" />
                            </Link>

                            <div className="hidden md:flex items-center gap-8">
                                {navLinks.map((l) => (
                                    <Link
                                        key={l.to}
                                        to={l.to}
                                        className="text-foreground/70 hover:text-[#0052ef] text-[16px] font-normal transition-colors"
                                    >
                                        {l.label}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Central Protocol Hub (Simplified for Sanity style) */}
                        <div className="hidden lg:flex items-center absolute left-1/2 -translate-x-1/2">
                            <div className="flex items-center gap-4 bg-foreground/5 px-4 py-1.5 rounded-[3px] border border-foreground/10">
                                <LanguageSwitcher />
                                <div className="w-px h-4 bg-foreground/10" />
                                <ThemeToggle />
                            </div>
                        </div>

                        {/* Right side Actions */}
                        <div className="flex items-center gap-2 sm:gap-4">
                            {user ? (
                                <Link to="/app">
                                    <button className="bg-foreground/5 text-foreground/70 hover:bg-[#0052ef] hover:text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full font-medium text-[13px] sm:text-[15px] transition-colors border border-foreground/10">
                                        {t('marketingNav.dashboard')}
                                    </button>
                                </Link>
                            ) : (
                                <>
                                    <Link to="/login" className="flex items-center">
                                        <button className="text-foreground/70 hover:text-[#0052ef] px-3 sm:px-4 py-2 font-medium text-[14px] sm:text-[15px] transition-colors">
                                            {t('marketingNav.login')}
                                        </button>
                                    </Link>
                                    <div className="hidden md:flex items-center gap-3">
                                        <Link to="/book-demo">
                                            <button className="bg-[#f36458] text-white hover:bg-[#0052ef] px-5 py-2 rounded-full font-medium text-[15px] transition-colors">
                                                {t('marketingNav.demo')}
                                            </button>
                                        </Link>
                                    </div>
                                </>
                            )}

                            {/* Mobile hamburger */}
                            <button
                                className="md:hidden p-2 text-foreground/70 hover:text-[#0052ef] transition-colors"
                                onClick={() => setMobileOpen(!mobileOpen)}
                                aria-label="Toggle menu"
                            >
                                {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile dropdown */}
                {mobileOpen && (
                    <div className="absolute top-16 left-0 right-0 md:hidden border-t border-foreground/10 bg-background z-50">
                        <div className="px-6 py-8 space-y-6">
                            {navLinks.map((l) => (
                                <Link
                                    key={l.to}
                                    to={l.to}
                                    onClick={() => setMobileOpen(false)}
                                    className="block text-foreground/70 hover:text-[#0052ef] text-[16px] transition-colors"
                                >
                                    {l.label}
                                </Link>
                            ))}
                            <div className="pt-6 space-y-6 border-t border-foreground/10">
                                <div className="flex items-center gap-4">
                                    <LanguageSwitcher />
                                    <ThemeToggle />
                                </div>
                                {!user && (
                                    <div className="pt-6 space-y-4 border-t border-foreground/10 flex flex-col">
                                        <Link
                                            to="/login"
                                            onClick={() => setMobileOpen(false)}
                                            className="block text-foreground/70 hover:text-[#0052ef] text-[16px] transition-colors"
                                        >
                                            {t('marketingNav.login')}
                                        </Link>
                                        <Link to="/book-demo" onClick={() => setMobileOpen(false)} className="block">
                                            <button className="w-full bg-[#f36458] hover:bg-[#0052ef] text-white font-medium text-[16px] py-3 rounded-full transition-colors">
                                                {t('marketingNav.demo')}
                                            </button>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {/* Main Content */}
            <main className="flex-1 bg-background transition-colors duration-500">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-background border-t border-foreground/10 pt-24 pb-12 transition-colors duration-500">
                <div className="max-w-[1440px] mx-auto px-8">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-12 mb-16">
                        <div className="flex flex-col items-center md:items-start gap-6">
                            <Link to="/" className="flex items-center gap-2 grayscale hover:grayscale-0 transition-all duration-300">
                                <BaroLogo className="scale-90" />
                            </Link>
                            <p className="font-mono text-[13px] text-foreground/50 uppercase">
                                {t('footer.tagline')}
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-6">
                            {[
                                { key: 'privacy', label: t('footer.privacy') },
                                { key: 'terms', label: t('footer.terms') },
                                { key: 'architecture', label: t('footer.architecture') },
                                { key: 'status', label: t('footer.status') }
                            ].map((link) => (
                                <Link
                                    key={link.key}
                                    to="#"
                                    className="text-[15px] text-foreground/70 hover:text-[#0052ef] transition-colors"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-8 border-t border-foreground/10">
                        <p className="text-[13px] text-foreground/50">
                            {t('footer.copyright')}
                        </p>
                    </div>
                </div>
            </footer>
        </div>
    );
};

