import React from 'react';
import { MarketingLayout } from '../components/MarketingLayout';
import { LayoutDashboard, ShoppingCart, Utensils, Users, BarChart3, Globe } from 'lucide-react';

const FeaturesPage: React.FC = () => {
    const features = [
        {
            title: 'Smart POS',
            description: 'Lightning fast ordering for waiters and self-service via QR codes.',
            icon: ShoppingCart
        },
        {
            title: 'Inventory OS',
            description: 'Real-time stock tracking with automated deduction and wastage logging.',
            icon: Utensils
        },
        {
            title: 'KDS & Kitchen',
            description: 'Powerful kitchen display system to sync chefs and servers seamlessly.',
            icon: LayoutDashboard
        },
        {
            title: 'Staff Intel',
            description: 'Track performance metrics and efficiency for every team member.',
            icon: Users
        },
        {
            title: 'Live Analytics',
            description: 'Heatmaps, revenue projections, and menu engineering dashboards.',
            icon: BarChart3
        },
        {
            title: 'Multi-Tenancy',
            description: 'Manage multiple branches and organizations from one master account.',
            icon: Globe
        }
    ];

    return (
        <MarketingLayout>
            <div className="py-24 bg-background">
                <div className="max-w-7xl mx-auto px-4">
                    <div className="text-center mb-24">
                        <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-6">
                            The <span className="text-primary italic">Hospitality</span> Stack
                        </h1>
                        <p className="text-muted-foreground max-w-2xl mx-auto font-bold uppercase tracking-widest text-xs">
                            Everything you need to run a modern restaurant, automated.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
                        {features.map((f) => (
                            <div key={f.title} className="group p-8 rounded-[2.5rem] bg-card border border-border hover:border-primary/30 transition-all hover:shadow-2xl hover:shadow-primary/5">
                                <div className="w-16 h-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                                    <f.icon className="w-8 h-8 text-primary" />
                                </div>
                                <h3 className="text-2xl font-black uppercase tracking-tighter mb-4">{f.title}</h3>
                                <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest leading-relaxed">
                                    {f.description}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </MarketingLayout>
    );
};

export default FeaturesPage;
