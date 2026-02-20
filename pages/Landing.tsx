import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui';
import { MarketingLayout } from '../components/MarketingLayout';
import { ArrowRight, ChefHat, BarChart3, ShieldCheck } from 'lucide-react';

const Landing: React.FC = () => {
  const navigate = useNavigate();

  return (
    <MarketingLayout>
      {/* Hero Section */}
      <section className="relative pt-20 pb-32 overflow-hidden">
        {/* Glow Effects */}
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-primary/20 blur-[150px] rounded-full" />
        <div className="absolute top-1/2 -right-24 w-64 h-64 bg-primary/10 blur-[120px] rounded-full" />

        <div className="max-w-7xl mx-auto px-4 relative z-10 text-center">
          <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full border border-primary/20 bg-primary/5 mb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Now in Open Beta</span>
          </div>

          <h1 className="text-6xl md:text-8xl lg:text-9xl font-black uppercase tracking-tighter leading-[0.8] mb-12 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
            Automate <br />
            <span className="text-primary italic">Hospitality</span>
          </h1>

          <p className="text-sm md:text-lg text-muted-foreground font-bold uppercase tracking-widest max-w-2xl mx-auto mb-12 leading-relaxed animate-in fade-in slide-in-from-bottom-12 duration-1000 delay-500">
            The all-in-one operating system for restaurants, bars, and cafes. <br className="hidden md:block" />
            Inventory, POS, and Analytics synced in real-time.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 animate-in fade-in slide-in-from-bottom-16 duration-1000 delay-700">
            <Button
              size="lg"
              onClick={() => navigate('/signup')}
              className="px-12 h-16 bg-primary hover:bg-primary/80 text-black font-black uppercase tracking-widest text-xs rounded-2xl shadow-2xl shadow-primary/20 flex items-center gap-3 group"
            >
              Start Free Trial <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => navigate('/features')}
              className="px-12 h-16 border-border hover:bg-muted font-black uppercase tracking-widest text-xs rounded-2xl"
            >
              View Features
            </Button>
          </div>
        </div>
      </section>

      {/* Social Proof Placeholder */}
      <section className="py-20 border-y border-border bg-muted/5">
        <div className="max-w-7xl mx-auto px-4 flex flex-col items-center">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-muted-foreground mb-12">Powering businesses worldwide</p>
          <div className="flex flex-wrap justify-center gap-16 grayscale opacity-30">
            {/* Logo placeholders */}
            {['LUXE', 'KRAFT', 'URBAN', 'BISTRO', 'NOMAD'].map(name => (
              <span key={name} className="text-2xl font-black italic tracking-tighter">{name}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Value Props */}
      <section className="py-32">
        <div className="max-w-7xl mx-auto px-4 grid md:grid-cols-3 gap-12">
          <div className="space-y-6">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
              <BarChart3 className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tighter">Real-time Intel</h3>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest leading-relaxed">
              Every order deductions from stock instantly. No more end-of-day math.
            </p>
          </div>
          <div className="space-y-6">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
              <ChefHat className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tighter">Kitchen Sync</h3>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest leading-relaxed">
              Direct line from waiter to chef. KDS screens remove paper errors.
            </p>
          </div>
          <div className="space-y-6">
            <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-primary" />
            </div>
            <h3 className="text-2xl font-black uppercase tracking-tighter">Secure SaaS</h3>
            <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest leading-relaxed">
              Multi-tenant isolation ensured by Supabase RLS and Edge Functions.
            </p>
          </div>
        </div>
      </section>
    </MarketingLayout>
  );
};

export default Landing;
