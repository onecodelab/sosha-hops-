
import React, { useState } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Button, showToast, cn } from '../components/ui';
import { Database, RefreshCw, AlertTriangle, Package, CheckCircle2, FlaskConical, ShieldCheck, Zap, Plus, MapPin, Building2, Trash2, Edit2, X, Check, CreditCard, Sparkles } from 'lucide-react';
import { supabase } from '../supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../AuthContext';
import { Branch } from '../types';

const Settings: React.FC = () => {
   const { profile } = useAuth();
   const queryClient = useQueryClient();
   const [newBranchName, setNewBranchName] = useState('');
   const [newBranchLocation, setNewBranchLocation] = useState('');
   const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
   const [editName, setEditName] = useState('');
   const [editLocation, setEditLocation] = useState('');
   const [isSubmitting, setIsSubmitting] = useState(false);

   // Fetch Organization Data
   const { data: org, isLoading: orgLoading } = useQuery({
      queryKey: ['organization', profile?.organization_id],
      queryFn: async () => {
         if (!profile?.organization_id) return null;
         const { data, error } = await supabase
            .from('organizations')
            .select('*')
            .eq('id', profile.organization_id)
            .single();
         if (error) throw error;
         return data;
      },
      enabled: !!profile?.organization_id
   });

   // Fetch Branches
   const { data: branches = [], isLoading: branchesLoading } = useQuery({
      queryKey: ['branches'],
      queryFn: async () => {
         const { data, error } = await supabase.from('branches').select('*').order('created_at', { ascending: true });
         if (error) throw error;
         return data as Branch[];
      }
   });

   // Create Branch Mutation
   const createBranchMutation = useMutation({
      mutationFn: async () => {
         if (!newBranchName) throw new Error("Branch name is required");
         const { error } = await supabase.from('branches').insert({
            name: newBranchName,
            location: newBranchLocation,
            is_active: true,
            organization_id: profile?.organization_id
         });
         if (error) throw error;
      },
      onSuccess: () => {
         showToast("Branch created successfully!", "success");
         setNewBranchName('');
         setNewBranchLocation('');
         queryClient.invalidateQueries({ queryKey: ['branches'] });
      },
      onError: (err: any) => showToast(err.message, "error")
   });

   // Update Branch Mutation
   const updateBranchMutation = useMutation({
      mutationFn: async (branch: { id: string, name: string, location: string }) => {
         const { error } = await supabase.from('branches').update({
            name: branch.name,
            location: branch.location
         }).eq('id', branch.id).eq('organization_id', profile?.organization_id);
         if (error) throw error;
      },
      onSuccess: () => {
         showToast("Branch updated successfully!", "success");
         setEditingBranchId(null);
         queryClient.invalidateQueries({ queryKey: ['branches'] });
      },
      onError: (err: any) => showToast(err.message, "error")
   });

   // Delete Branch Mutation
   const deleteBranchMutation = useMutation({
      mutationFn: async (id: string) => {
         if (id === '00000000-0000-0000-0000-000000000000') {
            throw new Error("Cannot delete the Primary HQ branch.");
         }
         const { error } = await supabase.from('branches').delete().eq('id', id).eq('organization_id', profile?.organization_id);
         if (error) throw error;
      },
      onSuccess: () => {
         showToast("Branch deleted successfully!", "success");
         queryClient.invalidateQueries({ queryKey: ['branches'] });
      },
      onError: (err: any) => {
         if (err.code === '23503') {
            showToast("Cannot delete branch: It has associated records (orders/staff/inventory).", "error");
         } else {
            showToast(err.message, "error");
         }
      }
   });

   const isOwnerOrAdmin = profile?.role === 'owner' || profile?.role === 'admin';

   return (
      <DashboardLayout title="System Orchestration" subtitle="Core database maintenance and branch configuration">
         <div className="space-y-8 animate-in fade-in duration-700">

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {/* Branch Management Card */}
               <Card className="bg-[#1A1A1A] border-gray-800 rounded-[2.5rem] overflow-hidden">
                  <div className="p-8 border-b border-gray-800 flex items-center justify-between">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                           <Building2 className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                           <CardTitle className="text-white">Branch Management</CardTitle>
                           <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-0.5">Scale your empire</p>
                        </div>
                     </div>
                  </div>
                  <CardContent className="p-8 space-y-6">
                     {isOwnerOrAdmin && (
                        <div className="bg-[#252525] border border-gray-700 p-6 rounded-3xl space-y-4">
                           <h4 className="text-xs font-black text-primary uppercase tracking-widest mb-2">New Branch Entry</h4>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                 <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Location Name</label>
                                 <input
                                    value={newBranchName}
                                    onChange={e => setNewBranchName(e.target.value)}
                                    placeholder="e.g. Downtown Branch"
                                    className="w-full h-11 bg-black/40 border border-white/5 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-primary/50"
                                 />
                              </div>
                              <div className="space-y-1">
                                 <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Area / City</label>
                                 <input
                                    value={newBranchLocation}
                                    onChange={e => setNewBranchLocation(e.target.value)}
                                    placeholder="e.g. Addis Ababa"
                                    className="w-full h-11 bg-black/40 border border-white/5 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-primary/50"
                                 />
                              </div>
                           </div>
                           <Button
                              onClick={() => createBranchMutation.mutate()}
                              disabled={createBranchMutation.isPending}
                              className="w-full bg-primary text-black font-black uppercase tracking-tighter h-12 rounded-xl"
                           >
                              <Plus className="w-4 h-4 mr-2" /> Launch New Branch
                           </Button>
                        </div>
                     )}

                     <div className="space-y-3">
                        <h4 className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Active Network</h4>
                        {branchesLoading ? (
                           <div className="p-8 text-center text-gray-600 animate-pulse uppercase text-[10px] font-black tracking-widest">Scanning network...</div>
                        ) : branches.map((b: Branch) => (
                           <div key={b.id} className="p-4 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-primary/20 transition-all">
                              <div className="flex-1">
                                 {editingBranchId === b.id ? (
                                    <div className="flex flex-col md:flex-row gap-2">
                                       <input
                                          value={editName}
                                          onChange={e => setEditName(e.target.value)}
                                          className="bg-black/60 border border-white/10 rounded-lg px-3 py-1 text-sm text-white focus:border-primary/50 outline-none w-full md:w-1/2"
                                          placeholder="Name"
                                       />
                                       <input
                                          value={editLocation}
                                          onChange={e => setEditLocation(e.target.value)}
                                          className="bg-black/60 border border-white/10 rounded-lg px-3 py-1 text-sm text-white focus:border-primary/50 outline-none w-full md:w-1/2"
                                          placeholder="Location"
                                       />
                                    </div>
                                 ) : (
                                    <div className="flex items-center gap-4">
                                       <div className="w-10 h-10 rounded-xl bg-white/5 flex items-center justify-center border border-white/10 group-hover:bg-primary/10 group-hover:border-primary/20 transition-all">
                                          <MapPin className="w-5 h-5 text-gray-500 group-hover:text-primary" />
                                       </div>
                                       <div>
                                          <p className="text-sm font-bold text-white uppercase tracking-tight">{b.name}</p>
                                          <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">{b.location || 'Unknown Location'}</p>
                                       </div>
                                    </div>
                                 )}
                              </div>

                              <div className="flex items-center gap-2 ml-4">
                                 {editingBranchId === b.id ? (
                                    <>
                                       <button
                                          onClick={() => updateBranchMutation.mutate({ id: b.id, name: editName, location: editLocation })}
                                          disabled={updateBranchMutation.isPending}
                                          className="p-2 hover:bg-green-500/10 text-green-500 rounded-lg transition-colors disabled:opacity-50"
                                       >
                                          <Check className="w-4 h-4" />
                                       </button>
                                       <button
                                          onClick={() => setEditingBranchId(null)}
                                          className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                                       >
                                          <X className="w-4 h-4" />
                                       </button>
                                    </>
                                 ) : (
                                    <>
                                       {b.id === '00000000-0000-0000-0000-000000000000' ? (
                                          <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[8px] font-black uppercase border border-primary/20">Primary HQ</span>
                                       ) : isOwnerOrAdmin && (
                                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                             <button
                                                onClick={() => {
                                                   setEditingBranchId(b.id);
                                                   setEditName(b.name);
                                                   setEditLocation(b.location || '');
                                                }}
                                                className="p-2 hover:bg-white/5 text-gray-400 hover:text-white rounded-lg transition-colors"
                                             >
                                                <Edit2 className="w-3.5 h-3.5" />
                                             </button>
                                             <button
                                                onClick={() => {
                                                   if (confirm(`Are you sure you want to delete "${b.name}"? This action cannot be undone and will fail if the branch has active orders or staff.`)) {
                                                      deleteBranchMutation.mutate(b.id);
                                                   }
                                                }}
                                                disabled={deleteBranchMutation.isPending}
                                                className="p-2 hover:bg-red-500/10 text-gray-400 hover:text-red-500 rounded-lg transition-colors disabled:opacity-50"
                                             >
                                                <Trash2 className="w-3.5 h-3.5" />
                                             </button>
                                          </div>
                                       )}
                                    </>
                                 )}
                              </div>
                           </div>
                        ))}
                     </div>
                  </CardContent>
               </Card>

               {/* Bank Configuration Card */}
               <Card className="bg-[#1A1A1A] border-gray-800 rounded-[2.5rem] overflow-hidden">
                  <div className="p-8 border-b border-gray-800">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20">
                           <ShieldCheck className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                           <CardTitle className="text-white">Bank Configuration</CardTitle>
                           <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-0.5">Verifier Suffix Management</p>
                        </div>
                     </div>
                  </div>
                  <CardContent className="p-8">
                     <BankSettingsSection isEditable={isOwnerOrAdmin} />
                  </CardContent>
               </Card>

               {/* Bot Settings Card */}
               <Card className="bg-[#1A1A1A] border-gray-800 rounded-[2.5rem] overflow-hidden">
                  <div className="p-8 border-b border-gray-800">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                           <Zap className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                           <CardTitle className="text-white">AI Bot Configuration</CardTitle>
                           <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mt-0.5">WhatsApp Chatbot Personality</p>
                        </div>
                     </div>
                  </div>
                  <CardContent className="p-8">
                     <BotSettingsSection isEditable={isOwnerOrAdmin} organizationId={profile?.organization_id} />
                  </CardContent>
               </Card>
            </div>

            {/* Organization & Subscription Section */}
            {isOwnerOrAdmin && (
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <Card className="bg-[#1A1A1A] border-gray-800 rounded-[2.5rem] overflow-hidden">
                     <div className="p-8 border-b border-gray-800">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20">
                              <Building2 className="w-6 h-6 text-primary" />
                           </div>
                           <div>
                              <CardTitle className="text-white">Organization Profile</CardTitle>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Your Business Identity</p>
                           </div>
                        </div>
                     </div>
                     <CardContent className="p-8 space-y-4">
                        <div className="space-y-1">
                           <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Business Name</label>
                           <div className="p-4 bg-black/40 border border-white/5 rounded-2xl text-white font-bold uppercase tracking-tight">
                              {orgLoading ? '...' : org?.name}
                           </div>
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Organization ID</label>
                           <div className="p-4 bg-black/20 border border-white/5 rounded-2xl text-gray-500 font-mono text-[10px] break-all">
                              {profile?.organization_id}
                           </div>
                        </div>
                     </CardContent>
                  </Card>

                  <Card className="bg-[#1A1A1A] border-gray-800 rounded-[2.5rem] overflow-hidden relative">
                     <div className="absolute top-4 right-4 animate-pulse">
                        <div className="px-2 py-1 rounded-full bg-primary/20 border border-primary/30 text-[8px] font-black text-primary uppercase tracking-widest">Live</div>
                     </div>
                     <div className="p-8 border-b border-gray-800">
                        <div className="flex items-center gap-4">
                           <div className="w-12 h-12 rounded-2xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20">
                              <Zap className="w-6 h-6 text-purple-400" />
                           </div>
                           <div>
                              <CardTitle className="text-white">Subscription Plan</CardTitle>
                              <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-0.5">Manage your capabilities</p>
                           </div>
                        </div>
                     </div>
                     <CardContent className="p-8 space-y-6">
                        <div className="flex items-center justify-between p-6 bg-gradient-to-br from-purple-500/10 to-primary/5 border border-purple-500/20 rounded-3xl">
                           <div>
                              <p className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-1">Current Plan</p>
                              <h4 className="text-3xl font-black text-white uppercase tracking-tighter italic">
                                 {orgLoading ? '...' : (org?.plan || 'Free Tier')}
                              </h4>
                           </div>
                           <Sparkles className="w-10 h-10 text-primary opacity-20" />
                        </div>

                        <div className="space-y-3">
                           <div className="flex items-center gap-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                              <CheckCircle2 className="w-4 h-4 text-primary" /> Multi-branch operations enabled
                           </div>
                           <div className="flex items-center gap-3 text-[10px] font-black text-gray-400 uppercase tracking-widest">
                              <CheckCircle2 className="w-4 h-4 text-primary" /> Real-time verification queue active
                           </div>
                        </div>

                        <Button
                           variant="outline"
                           onClick={() => showToast("Stripe Portal integration coming soon!", "warning")}
                           className="w-full h-14 border-white/10 hover:bg-white/5 font-black uppercase tracking-widest text-[11px] rounded-2xl flex items-center gap-3"
                        >
                           <CreditCard className="w-5 h-5 text-gray-500" /> Manage Billing & Invoices
                        </Button>
                     </CardContent>
                  </Card>
               </div>
            )}

            {/* Info Card */}
            <Card className="bg-[#1A1A1A] border-gray-800 rounded-[2.5rem] overflow-hidden">
               <div className="p-12 flex flex-col justify-center items-center text-center">
                  <Building2 className="w-16 h-16 text-primary opacity-20 mb-6" />
                  <h3 className="text-white font-bold text-lg">Centralized Logic / Isolated Execution</h3>
                  <p className="text-xs text-gray-500 max-w-lg mt-2 leading-relaxed">
                     Global definitions for <span className="text-white font-bold">Ingredients</span> and <span className="text-white font-bold">Recipes</span> are shared across all branches. Operational data such as stock levels, orders, and staff are strictly isolated within each branch environment.
                  </p>
               </div>
            </Card>

         </div>
      </DashboardLayout>
   );
};

const BankSettingsSection: React.FC<{ isEditable: boolean }> = ({ isEditable }) => {
   const queryClient = useQueryClient();
   const [editingBank, setEditingBank] = useState<string | null>(null);
   const [newAccount, setNewAccount] = useState('');

   const { data: bankSettings = [], isLoading } = useQuery({
      queryKey: ['bank_settings'],
      queryFn: async () => {
         const { data, error } = await supabase.from('bank_settings').select('*').order('bank_key', { ascending: true });
         if (error) throw error;
         return data;
      }
   });

   const updateBankMutation = useMutation({
      mutationFn: async ({ bankKey, account }: { bankKey: string, account: string }) => {
         const { error } = await supabase.from('bank_settings').update({ account_number: account }).eq('bank_key', bankKey);
         if (error) throw error;
      },
      onSuccess: () => {
         showToast("Bank setting updated!", "success");
         setEditingBank(null);
         queryClient.invalidateQueries({ queryKey: ['bank_settings'] });
      },
      onError: (err: any) => showToast(err.message, "error")
   });

   if (isLoading) return <div className="text-center py-4 text-zinc-600 animate-pulse text-[10px] font-black uppercase tracking-widest">Fetching profiles...</div>;

   return (
      <div className="space-y-4">
         {bankSettings.map((bank: any) => (
            <div key={bank.bank_key} className="p-4 bg-black/40 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-primary/20 transition-all">
               <div className="flex items-center gap-4 flex-1">
                  <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center border transition-all",
                     bank.bank_key === 'cbe' ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                        bank.bank_key === 'telebirr' ? "bg-purple-500/10 border-purple-500/20 text-purple-400" :
                           "bg-white/5 border-white/10 text-zinc-400")}>
                     <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                     <p className="text-sm font-bold text-white uppercase tracking-tight">{bank.bank_key}</p>
                     {editingBank === bank.bank_key ? (
                        <input
                           value={newAccount}
                           onChange={e => setNewAccount(e.target.value)}
                           className="bg-black/60 border border-white/10 rounded-lg px-3 py-1 text-xs text-primary font-mono mt-1 w-full focus:border-primary/50 outline-none"
                           placeholder="Account/Suffix ID"
                           autoFocus
                        />
                     ) : (
                        <p className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest mt-0.5">
                           Value: <span className="text-zinc-300">{bank.account_number || 'NOT SET'}</span>
                        </p>
                     )}
                  </div>
               </div>

               {isEditable && (
                  <div className="ml-4">
                     {editingBank === bank.bank_key ? (
                        <div className="flex items-center gap-1">
                           <button
                              onClick={() => updateBankMutation.mutate({ bankKey: bank.bank_key, account: newAccount })}
                              disabled={updateBankMutation.isPending}
                              className="p-2 hover:bg-green-500/10 text-green-500 rounded-lg transition-colors"
                           >
                              <Check className="w-4 h-4" />
                           </button>
                           <button
                              onClick={() => setEditingBank(null)}
                              className="p-2 hover:bg-red-500/10 text-red-500 rounded-lg transition-colors"
                           >
                              <X className="w-4 h-4" />
                           </button>
                        </div>
                     ) : (
                        <button
                           onClick={() => {
                              setEditingBank(bank.bank_key);
                              setNewAccount(bank.account_number);
                           }}
                           className="p-2 hover:bg-white/5 text-zinc-500 hover:text-white rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                        >
                           <Edit2 className="w-3.5 h-3.5" />
                        </button>
                     )}
                  </div>
               )}
            </div>
         ))}
      </div>
   );
};

const BotSettingsSection: React.FC<{ isEditable: boolean; organizationId?: string }> = ({ isEditable, organizationId }) => {
   const queryClient = useQueryClient();
   const [isSaving, setIsSaving] = useState(false);
   const [formData, setFormData] = useState({
      bot_name: 'Selam',
      tone: 'friendly and casual',
      default_language: 'auto',
      system_prompt: ''
   });

   const { data: botSettings, isLoading } = useQuery({
      queryKey: ['bot_settings', organizationId],
      queryFn: async () => {
         if (!organizationId) return null;
         const { data, error } = await supabase
            .from('bot_settings')
            .select('*')
            .eq('organization_id', organizationId)
            .maybeSingle();
         if (error) throw error;
         if (data) {
            setFormData({
               bot_name: data.bot_name,
               tone: data.tone,
               default_language: data.default_language,
               system_prompt: data.system_prompt || ''
            });
         }
         return data;
      },
      enabled: !!organizationId
   });

   const saveMutation = useMutation({
      mutationFn: async () => {
         if (!organizationId) throw new Error("Organization ID is missing");
         setIsSaving(true);
         const { error } = await supabase
            .from('bot_settings')
            .upsert({
               organization_id: organizationId,
               ...formData,
               updated_at: new Date().toISOString()
            }, { onConflict: 'organization_id' });

         if (error) throw error;
      },
      onSuccess: () => {
         showToast("Bot settings saved successfully!", "success");
         queryClient.invalidateQueries({ queryKey: ['bot_settings'] });
      },
      onError: (err: any) => showToast(err.message, "error"),
      onSettled: () => setIsSaving(false)
   });

   if (isLoading) return <div className="text-center py-4 text-zinc-600 animate-pulse text-[10px] font-black uppercase tracking-widest">Initialising AI...</div>;

   return (
      <div className="space-y-6">
         <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Bot Identity Name</label>
               <input
                  value={formData.bot_name}
                  onChange={e => setFormData({ ...formData, bot_name: e.target.value })}
                  disabled={!isEditable}
                  placeholder="e.g. Selam"
                  className="w-full h-11 bg-black/40 border border-white/5 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-primary/50"
               />
            </div>
            <div className="space-y-1">
               <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Tone & Personality</label>
               <select
                  value={formData.tone}
                  onChange={e => setFormData({ ...formData, tone: e.target.value as any })}
                  disabled={!isEditable}
                  className="w-full h-11 bg-black/40 border border-white/5 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-primary/50 appearance-none bg-no-repeat bg-[right_1rem_center]"
                  style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundSize: '1em' }}
               >
                  <option value="friendly and casual">Friendly & Casual</option>
                  <option value="professional">Professional</option>
                  <option value="fun and witty">Fun & Witty</option>
               </select>
            </div>
         </div>

         <div className="space-y-1">
            <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Default Communication Language</label>
            <select
               value={formData.default_language}
               onChange={e => setFormData({ ...formData, default_language: e.target.value as any })}
               disabled={!isEditable}
               className="w-full h-11 bg-black/40 border border-white/5 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-primary/50 appearance-none bg-no-repeat bg-[right_1rem_center]"
               style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundSize: '1em' }}
            >
               <option value="auto">Auto-Detect (Amharic/English)</option>
               <option value="english">English Only</option>
               <option value="amharic">Amharic (አማርኛ)</option>
            </select>
         </div>

         <div className="space-y-1">
            <div className="flex justify-between items-center mb-1">
               <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">System Instructions / Prompt</label>
               <span className="text-[8px] font-black text-primary/40 uppercase tracking-tighter italic">Deep Intelligence Override</span>
            </div>
            <textarea
               value={formData.system_prompt}
               onChange={e => setFormData({ ...formData, system_prompt: e.target.value })}
               disabled={!isEditable}
               rows={4}
               placeholder="Describe how the bot should behave, restaurant rules, etc..."
               className="w-full bg-black/40 border border-white/5 rounded-2xl p-4 text-xs text-zinc-300 focus:outline-none focus:border-primary/50 resize-none font-mono"
            />
         </div>

         {isEditable && (
            <Button
               onClick={() => saveMutation.mutate()}
               disabled={isSaving}
               className="w-full bg-primary text-black font-black uppercase tracking-tighter h-12 rounded-xl"
            >
               <RefreshCw className={cn("w-4 h-4 mr-2", isSaving && "animate-spin")} />
               {isSaving ? 'Encrypting Logic...' : 'Synchronize Bot Settings'}
            </Button>
         )}
      </div>
   );
};

export default Settings;
