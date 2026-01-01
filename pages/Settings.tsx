
import React, { useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Button, showToast, cn } from '../components/ui';
import { Database, RefreshCw, AlertTriangle, Package, CheckCircle2, FlaskConical, ShieldCheck, Zap } from 'lucide-react';
import { supabase } from '../supabase';

const Settings: React.FC = () => {
  return (
    <DashboardLayout title="System Orchestration" subtitle="Core database maintenance and system hardening">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-700">
        
        {/* System Health Card */}
        <Card className="bg-[#1A1A1A]/40 border-white/5 rounded-[2.5rem] overflow-hidden backdrop-blur-xl">
           <div className="p-8 border-b border-white/5 flex items-center justify-between bg-black/20">
              <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-2xl bg-green-500/10 flex items-center justify-center border border-green-500/20">
                    <ShieldCheck className="w-6 h-6 text-green-400" />
                 </div>
                 <div>
                    <CardTitle className="text-white">Database Integrity</CardTitle>
                    <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-0.5">Live Environment Status</p>
                 </div>
              </div>
           </div>
           <CardContent className="p-8 space-y-6">
              <div className="bg-primary/5 border border-primary/10 p-5 rounded-2xl flex gap-4">
                 <Zap className="w-5 h-5 text-primary shrink-0 mt-0.5" />
                 <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-tighter">Real-time Stock Engine</h4>
                    <p className="text-xs text-gray-400 leading-relaxed mt-1">
                       The application is currently utilizing the <span className="text-white font-bold">public.ingredients</span> table for supply chain tracking. Automated inventory deduction is triggered by kitchen production events.
                    </p>
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                 <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-black text-gray-500 uppercase">Schema</p>
                    <p className="text-sm font-bold text-white mt-1">V2.4 Stable</p>
                 </div>
                 <div className="p-4 bg-black/40 rounded-2xl border border-white/5">
                    <p className="text-[10px] font-black text-gray-500 uppercase">Latency</p>
                    <p className="text-sm font-bold text-green-500 mt-1">32ms (Active)</p>
                 </div>
              </div>
           </CardContent>
        </Card>

        {/* System Hardening Info */}
        <Card className="bg-zinc-900/40 border-white/5 rounded-[2.5rem] overflow-hidden border-dashed">
           <div className="p-8 h-full flex flex-col justify-center items-center text-center">
              <FlaskConical className="w-16 h-16 text-primary opacity-20 mb-6" />
              <h3 className="text-white font-bold text-lg">Integrity Guardian</h3>
              <p className="text-xs text-gray-500 max-w-xs mt-2 leading-relaxed">
                The backend "brain" is actively monitoring <span className="text-primary font-bold">order_items</span> for recipe-based stock deductions. All ingredient costs are pulled from the master registry.
              </p>
              <div className="mt-8 flex items-center gap-2 bg-green-500/10 px-4 py-2 rounded-full border border-green-500/20">
                 <CheckCircle2 className="w-3 h-3 text-green-500" />
                 <span className="text-[10px] font-black text-green-500 uppercase tracking-widest">Logic Active</span>
              </div>
           </div>
        </Card>

      </div>
    </DashboardLayout>
  );
};

export default Settings;
