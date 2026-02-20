import React from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from './ui';
import { useAuth } from '../AuthContext';

interface MarketingLayoutProps {
    children: React.ReactNode;
}

export const MarketingLayout: React.FC<MarketingLayoutProps> = ({ children }) => {
    const { user } = useAuth();

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Navigation */}
            <nav className="sticky top-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between h-16 items-center">
                        <div className="flex items-center gap-8">
                            <Link to="/" className="flex items-center gap-2">
                                <span className="font-black text-xl uppercase tracking-tighter">
                                    Baro <span className="text-primary italic">OS</span>
                                </span>
                            </Link>
                            <div className="hidden md:flex items-center gap-6">
                                <Link to="/features" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest">Features</Link>
                                <Link to="/pricing" className="text-sm font-bold text-muted-foreground hover:text-primary transition-colors uppercase tracking-widest">Pricing</Link>
                            </div>
                        </div>

                        <div className="flex items-center gap-4">
                            {user ? (
                                <Link to="/app">
                                    <Button variant="outline" className="font-black uppercase tracking-widest text-[10px]">Go to App</Button>
                                </Link>
                            ) : (
                                <>
                                    <Link to="/login/owner">
                                        <Button variant="ghost" className="font-black uppercase tracking-widest text-[10px]">Login</Button>
                                    </Link>
                                    <Link to="/signup">
                                        <Button className="bg-primary hover:bg-primary/80 text-black font-black uppercase tracking-widest text-[10px] shadow-lg shadow-primary/20">Start Free Trial</Button>
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </nav>

            {/* Main Content */}
            <main className="flex-1">
                {children}
            </main>

            {/* Minimal Footer */}
            <footer className="bg-muted/5 border-t border-border py-12">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
                        © 2026 Baro OS. Built for Hospitality Excellence.
                    </p>
                </div>
            </footer>
        </div>
    );
};
