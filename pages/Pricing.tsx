import React from 'react';
import { MarketingLayout } from '../components/MarketingLayout';
import { Button, Card, CardContent } from '../components/ui';
import { Check } from 'lucide-react';

const PricingPage: React.FC = () => {
    const tiers = [
        {
            name: 'Starter',
            price: '0',
            description: 'Perfect for small cafes and new businesses.',
            features: ['Up to 500 orders/mo', 'Basic Inventory', 'Digital Menu', '1 Branch']
        },
        {
            name: 'Pro',
            price: '49',
            description: 'Full power for high-volume restaurants.',
            features: ['Unlimited Orders', 'Kitchen KDS', 'Advanced Analytics', 'Staff Performance', 'Priority Support'],
            highlight: true
        },
        {
            name: 'Enterprise',
            price: 'Custom',
            description: 'For chains and large hotels.',
            features: ['Multi-branch Sync', 'Custom Integrations', 'Dedicated Account Manager', 'White-labeling']
        }
    ];

    return (
        <MarketingLayout>
            <div className="py-24 bg-background">
                <div className="max-w-7xl mx-auto px-4 text-center">
                    <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-6">
                        Simple <span className="text-primary italic">Pricing</span>
                    </h1>
                    <p className="text-muted-foreground max-w-2xl mx-auto mb-16 font-bold uppercase tracking-widest text-xs">
                        Start small, scale to the moon. No hidden fees.
                    </p>

                    <div className="grid md:grid-cols-3 gap-8">
                        {tiers.map((tier) => (
                            <Card key={tier.name} className={`bg-card border-border overflow-hidden relative ${tier.highlight ? 'ring-2 ring-primary' : ''}`}>
                                {tier.highlight && (
                                    <div className="bg-primary text-black text-[10px] font-black py-1 uppercase tracking-[0.2em] absolute top-0 left-0 right-0">Most Popular</div>
                                )}
                                <CardContent className="p-8 flex flex-col h-full pt-12">
                                    <h3 className="text-2xl font-black uppercase tracking-tighter mb-2">{tier.name}</h3>
                                    <div className="flex items-baseline gap-1 mb-4">
                                        <span className="text-4xl font-black">${tier.price}</span>
                                        {tier.price !== 'Custom' && <span className="text-muted-foreground font-bold">/mo</span>}
                                    </div>
                                    <p className="text-xs text-muted-foreground font-bold mb-8 uppercase tracking-widest leading-relaxed">{tier.description}</p>

                                    <ul className="space-y-4 mb-12 flex-1 text-left">
                                        {tier.features.map(f => (
                                            <li key={f} className="flex items-center gap-3 text-[10px] font-black uppercase tracking-widest">
                                                <Check className="w-4 h-4 text-primary shrink-0" />
                                                {f}
                                            </li>
                                        ))}
                                    </ul>

                                    <Button className={`w-full font-black uppercase tracking-widest text-[10px] h-12 rounded-xl  ${tier.highlight ? 'bg-primary text-black' : 'bg-muted/10 border border-border'}`}>
                                        Get Started Now
                                    </Button>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                </div>
            </div>
        </MarketingLayout>
    );
};

export default PricingPage;
