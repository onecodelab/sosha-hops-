import React from 'react';
import { useLayoutConfig } from '../contexts/LayoutContext';
import { Truck } from 'lucide-react';

const DriverDashboard: React.FC = () => {
    useLayoutConfig({
        title: "Dispatch Hub",
        subtitle: "Driver operations portal"
    });

    return (
        <>
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 animate-in fade-in duration-700">
                <div className="relative">
                    <div className="absolute inset-0 bg-primary/10 blur-[60px] rounded-full" />
                    <div className="relative p-8 bg-primary/5 rounded-[2rem] border border-primary/10">
                        <Truck className="w-16 h-16 text-primary/40" />
                    </div>
                </div>
                <div className="text-center space-y-2">
                    <h2 className="text-2xl font-black tracking-tight text-foreground">Driver dashboard coming soon.</h2>
                    <p className="text-muted text-sm font-medium">This module is currently under development.</p>
                </div>
            </div>
        </>
    );
};

export default DriverDashboard;
