
import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from './ui';
import { useAuth } from '../AuthContext';
import { Menu, X, Settings2, Globe, Sparkles } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import { LanguageSwitcher } from './LanguageSwitcher';
import { useLanguage } from '../contexts/LanguageContext';

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
        <div className="min-h-screen bg-background flex flex-col transition-colors duration-1000 font-sans">
            {/* Navigation */}
            <nav className="sticky top-0 z-50 bg-black border-b border-white/5 h-20 flex items-center">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full">
                    <div className="flex justify-between items-center relative">
                        {/* Logo & Left Links */}
                        <div className="flex items-center gap-12">
                            <Link to="/" className="flex items-center gap-3 group liquid-core-logo">
                                <span className="text-2xl tracking-tighter flex items-center gap-1 group">
                                    <span className="serif-ital text-white group-hover:text-brand-yellow transition-all duration-500 lowercase">baro</span>
                                    <span className="mono-os text-brand-green bg-brand-green/10 px-2 py-0.5 rounded-full text-[10px] font-black border border-brand-green/20">os</span>
                                </span>
                            </Link>

                            <div className="hidden md:flex items-center gap-10">
                                {navLinks.map((l) => (
                                    <Link
                                        key={l.to}
                                        to={l.to}
                                        className="ripple-link mono-os text-[10px] font-black text-white/50 hover:text-white transition-colors py-2 px-1 uppercase"
                                    >
                                        {l.label}
                                    </Link>
                                ))}
                            </div>
                        </div>

                        {/* Central Protocol Hub - Centered Absolutely */}
                        <div className="hidden lg:flex items-center absolute left-1/2 -translate-x-1/2 h-20">
                            <div className="flex items-center gap-3 px-4 h-10 rounded-full bg-white/[0.03] border border-white/10 backdrop-blur-3xl shadow-[0_0_30px_rgba(255,184,0,0.05)] hover:border-primary/30 transition-all group relative">
                                {/* Subtle scanline effect */}
                                <div className="absolute inset-0 rounded-full overflow-hidden pointer-events-none">
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                </div>

                                <div className="flex items-center gap-2 border-r border-white/10 pr-4">
                                    <Settings2 className="w-4 h-4 text-primary animate-spin-slow-extra" />
                                    <span className="mono-os text-[9px] font-black text-white/60 uppercase tracking-widest hidden xl:inline">Protocol_Control</span>
                                </div>

                                <div className="flex items-center gap-5 h-full">
                                    <LanguageSwitcher />
                                    <div className="w-px h-4 bg-white/10" />
                                    <ThemeToggle />
                                </div>

                                <div className="ml-2 flex items-center justify-center">
                                    <Sparkles className="w-3.5 h-3.5 text-brand-green animate-pulse" />
                                </div>
                            </div>
                        </div>

                        {/* Right side Actions */}
                        <div className="flex items-center gap-4 h-20">
                            {user ? (
                                <Link to="/app">
                                    <Button variant="outline" className="mono-os text-[9px] font-black border-white/10 hover:border-primary/50 h-10 px-6 rounded-full group uppercase shadow-[0_0_15px_rgba(255,184,0,0.05)] hover:shadow-[0_0_20px_rgba(255,184,0,0.15)] transition-all">
                                        {t('marketingNav.dashboard')}
                                        <Sparkles className="w-3 h-3 ml-2 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                    </Button>
                                </Link>
                            ) : (
                                <div className="hidden md:flex items-center gap-3">
                                    <Link to="/onboarding" className="ripple-link">
                                        <Button variant="ghost" className="mono-os text-[9px] font-black tracking-widest px-5 h-10 text-brand-yellow/80 hover:text-brand-yellow hover:bg-brand-yellow/5 uppercase">
                                            Apply for Access
                                        </Button>
                                    </Link>
                                    <Link to="/login" className="ripple-link">
                                        <Button variant="ghost" className="mono-os text-[9px] font-black tracking-widest px-6 h-10 text-white/70 hover:text-white hover:bg-white/5 uppercase">
                                            {t('marketingNav.login')}
                                        </Button>
                                    </Link>
                                    <Link to="/book-demo">
                                        <Button className="bg-brand-yellow hover:bg-white text-black mono-os text-[9px] font-black px-8 h-10 rounded-full shadow-2xl shadow-brand-yellow/10 uppercase">
                                            {t('marketingNav.demo')}
                                        </Button>
                                    </Link>
                                </div>
                            )}

                            {/* Mobile hamburger */}
                            <button
                                className="md:hidden p-2 text-white/60 hover:text-white transition-colors"
                                onClick={() => setMobileOpen(!mobileOpen)}
                                aria-label="Toggle menu"
                            >
                                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Mobile dropdown */}
                {mobileOpen && (
                    <div className="absolute top-20 left-0 right-0 md:hidden border-t border-white/5 bg-black/95 backdrop-blur-3xl animate-in fade-in slide-in-from-top-2 duration-300 z-50">
                        <div className="px-6 py-8 space-y-6">
                            {navLinks.map((l) => (
                                <Link
                                    key={l.to}
                                    to={l.to}
                                    onClick={() => setMobileOpen(false)}
                                    className="block mono-os text-xs font-black text-white/60 hover:text-white transition-colors uppercase"
                                >
                                    {l.label}
                                </Link>
                            ))}
                            <div className="pt-6 space-y-6 border-t border-white/5">
                                <span className="mono-os text-[10px] font-black text-primary uppercase tracking-[0.3em] block">System_Protocol</span>
                                <div className="grid grid-cols-1 gap-4">
                                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                                        <span className="text-sm font-bold text-white flex items-center gap-3">
                                            <Globe className="w-4 h-4 text-brand-green" /> Language
                                        </span>
                                        <div className="scale-90 origin-right">
                                            <LanguageSwitcher />
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10">
                                        <span className="text-sm font-bold text-white flex items-center gap-3">
                                            <Settings2 className="w-4 h-4 text-primary" /> System Theme
                                        </span>
                                        <div className="scale-90 origin-right">
                                            <ThemeToggle />
                                        </div>
                                    </div>
                                </div>
                                {!user && (
                                    <div className="pt-6 space-y-4 border-t border-white/5">
                                        <Link
                                            to="/onboarding"
                                            onClick={() => setMobileOpen(false)}
                                            className="block mono-os text-xs font-black text-brand-yellow/80 hover:text-brand-yellow transition-colors uppercase"
                                        >
                                            New here? Apply for Access →
                                        </Link>
                                        <Link
                                            to="/login"
                                            onClick={() => setMobileOpen(false)}
                                            className="block mono-os text-xs font-black text-white/60 hover:text-white transition-colors uppercase"
                                        >
                                            {t('marketingNav.login')}
                                        </Link>
                                        <Link to="/book-demo" onClick={() => setMobileOpen(false)} className="block">
                                            <Button className="w-full bg-brand-yellow hover:bg-white text-black mono-os text-xs font-black h-14 rounded-2xl shadow-2xl shadow-brand-yellow/10 uppercase">
                                                {t('marketingNav.demo')}
                                            </Button>
                                        </Link>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </nav>

            {/* Main Content */}
            <main className="flex-1">
                {children}
            </main>

            {/* Footer */}
            <footer className="bg-black border-t border-white/5 pb-24 pt-32 relative overflow-hidden">
                {/* Delta Branching Representation */}
                <div className="absolute inset-x-0 bottom-0 h-96 uchok-pattern opacity-10 pointer-events-none" />
                <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-brand-blue/5 blur-[150px] rounded-full pointer-events-none translate-x-1/2 -translate-y-1/2" />

                <div className="max-w-7xl mx-auto px-6 relative z-10">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-16 mb-20">
                        <div className="flex flex-col items-center md:items-start gap-6">
                            <Link to="/" className="flex items-center gap-2 grayscale opacity-40 hover:grayscale-0 hover:opacity-100 transition-all duration-700">
                                <span className="text-2xl tracking-tighter">
                                    <span className="serif-ital text-white lowercase">baro</span>
                                    <span className="mono-os text-brand-green ml-2 text-xs">os</span>
                                </span>
                            </Link>
                            <p className="mono-os text-[10px] font-black text-white/20 tracking-[0.3em] uppercase">
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
                                    className="mono-os text-[9px] font-black text-white/40 hover:text-brand-green transition-colors tracking-widest uppercase"
                                >
                                    {link.label}
                                </Link>
                            ))}
                        </div>
                    </div>

                    <div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-10 border-t border-white/5">
                        <p className="mono-os text-[9px] font-black text-white/20 uppercase tracking-widest">
                            {t('footer.copyright')}
                        </p>
                        <div className="flex items-center gap-6 opacity-20 hover:opacity-100 transition-opacity">
                            <div className="w-4 h-4 bg-muted-foreground/20 rounded-full" />
                            <div className="w-4 h-4 bg-muted-foreground/20 rounded-full" />
                            <div className="w-4 h-4 bg-muted-foreground/20 rounded-full" />
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};
