
import React, { useState, useEffect } from 'react';
import { useLayoutConfig } from '../contexts/LayoutContext';
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

   useLayoutConfig({
      title: "System Orchestration",
      subtitle: "Core database maintenance and branch configuration"
   });

   return (
      <>
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
                                    <div className="flex items-center justify-between flex-wrap gap-4">
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
               <Card className="bg-[#1A1A1A] border-gray-800 rounded-[2.5rem] overflow-hidden relative group/bank">
                  <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover/bank:opacity-100 transition-opacity duration-500 blur-3xl pointer-events-none" />
                  <div className="p-8 border-b border-gray-800 relative bg-black/20 backdrop-blur-sm">
                     <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-[0_0_20px_rgba(59,130,246,0.1)]">
                           <ShieldCheck className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                           <CardTitle className="text-white text-xl tracking-tight">Bank Configuration</CardTitle>
                           <p className="text-[10px] font-black text-blue-500/60 uppercase tracking-widest mt-0.5">Secure Transaction Verification</p>
                        </div>
                     </div>
                  </div>
                  <CardContent className="p-8 relative">
                     <BankSettingsSection isEditable={isOwnerOrAdmin} organizationId={profile?.organization_id} />
                  </CardContent>
               </Card>
            </div>

            {/* Full Width Customer AI Agent - More balanced layout */}
            <Card className="bg-[#1A1A1A] border-gray-800 rounded-[2.5rem] overflow-hidden group/bot relative">
               <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none group-hover:bg-primary/10 transition-all duration-700" />
               <div className="p-8 border-b border-gray-800 relative bg-black/20 backdrop-blur-sm">
                  <div className="flex items-center gap-4">
                     <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-[0_0_20px_rgba(255,193,7,0.1)]">
                        <Zap className="w-6 h-6 text-primary" />
                     </div>
                     <div>
                        <CardTitle className="text-white text-xl tracking-tight">Customer AI Agent</CardTitle>
                        <p className="text-[10px] font-black text-primary/60 uppercase tracking-widest mt-0.5">Full System Prompt Control</p>
                     </div>
                     {branches.length > 0 && (
                        <a
                           href={`/order-chat/${branches[0].id}/UNKNOWN`}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-full hover:bg-emerald-500/20 hover:scale-105 transition-all text-[10px] font-black uppercase tracking-widest"
                        >
                           <Sparkles className="w-3.5 h-3.5" />
                           Test Chatbot (Guest)
                        </a>
                     )}
                  </div>
               </div>
               <CardContent className="p-8">
                  <BotSettingsSection isEditable={isOwnerOrAdmin} organizationId={profile?.organization_id} />
               </CardContent>
            </Card>

            {/* Organization & Subscription Section */}
            {isOwnerOrAdmin && (
               <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
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
      </>
   );
};

const BankSettingsSection: React.FC<{ isEditable: boolean; organizationId?: string }> = ({ isEditable, organizationId }) => {
   const queryClient = useQueryClient();
   const [editingBank, setEditingBank] = useState<string | null>(null);
   const [newAccount, setNewAccount] = useState('');
   const [isAddingNew, setIsAddingNew] = useState(false);
   const [newBankKey, setNewBankKey] = useState('cbe');
   const [newBankAccount, setNewBankAccount] = useState('');

   const { data: bankSettings = [], isLoading } = useQuery({
      queryKey: ['bank_settings', organizationId],
      queryFn: async () => {
         if (!organizationId) return [];
         const { data, error } = await supabase
            .from('bank_settings')
            .select('*')
            .eq('organization_id', organizationId)
            .order('bank_key', { ascending: true });
         if (error) throw error;
         return data;
      },
      enabled: !!organizationId
   });

   const updateBankMutation = useMutation({
      mutationFn: async ({ bankKey, account }: { bankKey: string, account: string }) => {
         const { error } = await supabase
            .from('bank_settings')
            .update({ account_number: account })
            .eq('bank_key', bankKey)
            .eq('organization_id', organizationId);
         if (error) throw error;
      },
      onSuccess: () => {
         showToast("Bank setting updated!", "success");
         setEditingBank(null);
         queryClient.invalidateQueries({ queryKey: ['bank_settings'] });
      },
      onError: (err: any) => showToast(err.message, "error")
   });

   const createBankMutation = useMutation({
      mutationFn: async () => {
         if (!organizationId) throw new Error("Organization ID is missing");
         if (!newBankAccount) throw new Error("Account number is required");
         const { error } = await supabase
            .from('bank_settings')
            .insert({
               organization_id: organizationId,
               bank_key: newBankKey,
               account_number: newBankAccount,
               is_active: true
            });
         if (error) throw error;
      },
      onSuccess: () => {
         showToast("Bank added successfully!", "success");
         setIsAddingNew(false);
         setNewBankAccount('');
         queryClient.invalidateQueries({ queryKey: ['bank_settings'] });
      },
      onError: (err: any) => {
         if (err.code === '23505') {
            showToast("This bank is already configured for your organization.", "error");
         } else {
            showToast(err.message, "error");
         }
      }
   });

   const deleteBankMutation = useMutation({
      mutationFn: async (bankKey: string) => {
         const { error } = await supabase
            .from('bank_settings')
            .delete()
            .eq('bank_key', bankKey)
            .eq('organization_id', organizationId);
         if (error) throw error;
      },
      onSuccess: () => {
         showToast("Bank setting removed.", "success");
         queryClient.invalidateQueries({ queryKey: ['bank_settings'] });
      },
      onError: (err: any) => showToast(err.message, "error")
   });

   if (isLoading) return (
      <div className="flex flex-col items-center justify-center py-12 space-y-4">
         <div className="w-12 h-12 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
         <div className="text-zinc-600 text-[10px] font-black uppercase tracking-widest">Accessing Secured Protocols...</div>
      </div>
   );

   return (
      <div className="space-y-6">
         {isEditable && !isAddingNew && (
            <button
               onClick={() => setIsAddingNew(true)}
               className="w-full p-4 border border-blue-500/20 bg-blue-500/5 hover:bg-blue-500/10 rounded-2xl flex items-center justify-center gap-2 text-blue-400 text-[10px] font-black uppercase tracking-widest transition-all group"
            >
               <Plus className="w-4 h-4 group-hover:scale-110 transition-transform" /> Add New Bank Account
            </button>
         )}

         {isAddingNew && (
            <div className="p-6 bg-black/40 border border-blue-500/30 rounded-3xl space-y-4 animate-in slide-in-from-top-2 duration-300">
               <div className="flex items-center justify-between mb-2">
                  <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Configure Account</h4>
                  <button onClick={() => setIsAddingNew(false)} className="text-gray-500 hover:text-white transition-colors">
                     <X className="w-4 h-4" />
                  </button>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                     <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Bank Type</label>
                     <select
                        value={newBankKey}
                        onChange={e => setNewBankKey(e.target.value)}
                        className="w-full h-11 bg-black/60 border border-white/10 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-blue-500/50 appearance-none bg-no-repeat bg-[right_1rem_center]"
                        style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='white'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundSize: '1em' }}
                     >
                        <option value="cbe">Commercial Bank (CBE)</option>
                        <option value="telebirr">Telebirr</option>
                        <option value="abyssinia">Bank of Abyssinia</option>
                        <option value="dashen">Dashen Bank</option>
                        <option value="cbebirr">CBE Birr</option>
                        <option value="awash">Awash Bank</option>
                     </select>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Account / Suffix ID</label>
                     <input
                        value={newBankAccount}
                        onChange={e => setNewBankAccount(e.target.value)}
                        placeholder="Enter account number"
                        className="w-full h-11 bg-black/60 border border-white/10 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-blue-500/50 font-mono"
                     />
                  </div>
               </div>
               <Button
                  onClick={() => createBankMutation.mutate()}
                  disabled={createBankMutation.isPending}
                  className="w-full bg-blue-500 hover:bg-blue-600 text-white font-black uppercase tracking-widest h-12 rounded-xl text-[10px]"
               >
                  {createBankMutation.isPending ? 'Provisioning...' : 'Authorize Bank Entry'}
               </Button>
            </div>
         )}

         {bankSettings.length === 0 && !isAddingNew ? (
            <div className="flex flex-col items-center justify-center py-12 text-center bg-black/20 rounded-[2rem] border border-white/5 border-dashed">
               <div className="w-16 h-16 rounded-3xl bg-white/5 flex items-center justify-center border border-white/10 mb-4 opacity-20">
                  <ShieldCheck className="w-8 h-8 text-white" />
               </div>
               <h5 className="text-sm font-bold text-gray-400 uppercase tracking-tight">No Bank Profiles Found</h5>
               <p className="text-[10px] text-gray-600 font-black uppercase tracking-widest mt-1 max-w-[200px]">Bank-level transaction verification is currently offline</p>
            </div>
         ) : (
            <div className="space-y-4">
               {bankSettings.map((bank: any) => (
                  <div key={bank.bank_key} className="relative group overflow-hidden">
                     <div className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                     <div className="relative p-5 bg-black/40 border border-white/5 rounded-3xl flex items-center justify-between hover:border-blue-500/30 hover:scale-[1.01] transition-all duration-300">
                        <div className="flex items-center gap-5 flex-1">
                           <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500 shadow-lg",
                              bank.bank_key === 'cbe' ? "bg-blue-600/20 border-blue-500/30 text-blue-400 group-hover:shadow-blue-500/20" :
                                 bank.bank_key === 'telebirr' ? "bg-purple-600/20 border-purple-500/30 text-purple-400 group-hover:shadow-purple-500/20" :
                                    "bg-zinc-800/20 border-zinc-700/30 text-zinc-400")}>
                              <CreditCard className="w-6 h-6" />
                           </div>
                           <div className="flex-1">
                              <div className="flex items-center gap-2">
                                 <p className="text-sm font-black text-white uppercase tracking-tighter italic">{bank.bank_key}</p>
                                 <span className="px-2 py-0.5 bg-white/5 rounded-full text-[8px] font-black text-gray-500 uppercase tracking-widest border border-white/5">Authenticated</span>
                              </div>
                              {editingBank === bank.bank_key ? (
                                 <div className="mt-3 relative">
                                    <input
                                       value={newAccount}
                                       onChange={e => setNewAccount(e.target.value)}
                                       className="bg-black/60 border border-white/10 rounded-xl px-4 py-2 text-sm text-primary font-mono w-full focus:border-primary/50 outline-none ring-1 ring-white/5"
                                       placeholder="Enter Account or Suffix ID"
                                       autoFocus
                                    />
                                 </div>
                              ) : (
                                 <div className="mt-1 flex items-center gap-2">
                                    <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest">Entry:</span>
                                    <span className="text-xs text-white font-mono bg-white/5 px-2 py-0.5 rounded-lg border border-white/5">
                                       {bank.account_number || 'NULL_REFERENCE'}
                                    </span>
                                 </div>
                              )}
                           </div>
                        </div>

                        {isEditable && (
                           <div className="ml-4 shrink-0 flex items-center gap-1">
                              {editingBank === bank.bank_key ? (
                                 <div className="flex items-center gap-2">
                                    <button
                                       onClick={() => updateBankMutation.mutate({ bankKey: bank.bank_key, account: newAccount })}
                                       disabled={updateBankMutation.isPending}
                                       className="p-3 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-2xl transition-all border border-green-500/30"
                                    >
                                       <Check className="w-4 h-4" />
                                    </button>
                                    <button
                                       onClick={() => setEditingBank(null)}
                                       className="p-3 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-2xl transition-all border border-red-500/30"
                                    >
                                       <X className="w-4 h-4" />
                                    </button>
                                 </div>
                              ) : (
                                 <>
                                    <button
                                       onClick={() => {
                                          setEditingBank(bank.bank_key);
                                          setNewAccount(bank.account_number);
                                       }}
                                       className="p-3 bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white rounded-2xl transition-all border border-white/10 opacity-0 group-hover:opacity-100 backdrop-blur-md"
                                    >
                                       <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                       onClick={() => {
                                          if (confirm(`Remove ${bank.bank_key} configuration?`)) {
                                             deleteBankMutation.mutate(bank.bank_key);
                                          }
                                       }}
                                       disabled={deleteBankMutation.isPending}
                                       className="p-3 bg-red-500/5 hover:bg-red-500/20 text-red-500/40 hover:text-red-500 rounded-2xl transition-all border border-red-500/10 opacity-0 group-hover:opacity-100 backdrop-blur-md"
                                    >
                                       <Trash2 className="w-4 h-4" />
                                    </button>
                                 </>
                              )}
                           </div>
                        )}
                     </div>
                  </div>
               ))}
            </div>
         )}
      </div>
   );
};

const BotSettingsSection: React.FC<{ isEditable: boolean; organizationId?: string }> = ({ isEditable, organizationId }) => {
   const queryClient = useQueryClient();
   const [isSaving, setIsSaving] = useState(false);
   const [systemPrompt, setSystemPrompt] = useState('');
   const [charCount, setCharCount] = useState(0);

   const DEFAULT_PROMPT = `You are a smart, friendly restaurant assistant. You help customers browse the menu, place orders, track their food, and handle payments.

## YOUR RULES
1. ALWAYS use the 'get_menu' tool when a customer asks about food, menu, or what's available. NEVER guess menu items.
2. Check the CONTEXT below for the 'Table Number'. If it is 'Unknown', you MUST ask the customer for their table number before placing an order. If it is already known, do not ask; proceed with the known table number.
3. When a customer shares their name, phone, or mentions any food preference or allergy, IMMEDIATELY call 'update_customer_profile' to remember it.
4. If they want to add more items to an existing order, use 'update_order' instead of 'place_order'.
5. When asked for the bill or how to pay, call 'get_branch_info' to get payment methods, then 'get_order_status' to get the total.
6. When they share a payment reference number, call 'verify_payment'.
7. Be warm, helpful, and concise. Use emojis sparingly but naturally.
8. Format menu items clearly with names and prices.
9. Always confirm the order before placing it.`;

   // Load existing prompt from organizations table
   const { data: orgData, isLoading } = useQuery({
      queryKey: ['chatbot_system_prompt', organizationId],
      queryFn: async () => {
         if (!organizationId) return null;
         const { data, error } = await supabase
            .from('organizations')
            .select('chatbot_system_prompt')
            .eq('id', organizationId)
            .single();
         if (error) throw error;
         return data;
      },
      enabled: !!organizationId
   });

   // Initialize state when data arrives
   useEffect(() => {
      if (orgData) {
         const prompt = orgData.chatbot_system_prompt || '';
         setSystemPrompt(prompt);
         setCharCount(prompt.length);
      }
   }, [orgData]);

   const saveMutation = useMutation({
      mutationFn: async () => {
         if (!organizationId) throw new Error("Organization ID is missing.");
         setIsSaving(true);
         const { error } = await supabase
            .from('organizations')
            .update({ chatbot_system_prompt: systemPrompt })
            .eq('id', organizationId);
         if (error) throw error;
      },
      onSuccess: () => {
         showToast("System Prompt saved! Your chatbot will use this immediately.", "success");
         queryClient.invalidateQueries({ queryKey: ['chatbot_system_prompt'] });
      },
      onError: (err: any) => showToast(err.message, "error"),
      onSettled: () => setIsSaving(false)
   });

   if (isLoading) return <div className="text-center py-4 text-zinc-600 animate-pulse text-[10px] font-black uppercase tracking-widest">Loading AI Configuration...</div>;

   return (
      <div className="space-y-6">
         {/* Info Banner */}
         <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
            <p className="text-[10px] text-primary/80 font-bold uppercase tracking-widest mb-1">Full Control Mode</p>
            <p className="text-xs text-gray-400 leading-relaxed">
               This is the <span className="text-white font-bold">complete instruction set</span> your customer chatbot follows. 
               Edit it to change how the bot behaves, what it says, and how it uses tools like menu search, ordering, and payments.
            </p>
         </div>

         {/* System Prompt Editor */}
         <div className="space-y-2">
            <div className="flex justify-between items-center">
               <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">System Prompt</label>
               <div className="flex items-center gap-3">
                  <span className="text-[9px] text-gray-600 font-mono">{charCount} chars</span>
                  {systemPrompt !== DEFAULT_PROMPT && (
                     <button
                        onClick={() => {
                           setSystemPrompt(DEFAULT_PROMPT);
                           setCharCount(DEFAULT_PROMPT.length);
                        }}
                        className="text-[9px] text-primary/60 hover:text-primary font-bold uppercase tracking-wider transition-colors"
                     >
                        Reset to Default
                     </button>
                  )}
               </div>
            </div>
            <textarea
               value={systemPrompt}
               onChange={e => {
                  setSystemPrompt(e.target.value);
                  setCharCount(e.target.value.length);
               }}
               disabled={!isEditable}
               rows={16}
               placeholder={DEFAULT_PROMPT}
               className="w-full bg-black/60 border border-white/10 rounded-2xl p-5 text-xs text-gray-200 focus:outline-none focus:border-primary/40 focus:shadow-[0_0_30px_rgba(255,184,0,0.05)] resize-y font-mono leading-relaxed min-h-[300px] transition-all"
            />
         </div>

         {/* Available Tools Reference */}
         <div className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-3">Available Tools (Reference)</p>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
               {['get_menu', 'place_order', 'update_order', 'get_order_status', 'verify_payment', 'get_branch_info', 'update_customer_profile'].map(tool => (
                  <div key={tool} className="px-3 py-2 bg-black/40 border border-white/5 rounded-xl">
                     <code className="text-[10px] text-emerald-400 font-mono">{tool}</code>
                  </div>
               ))}
            </div>
            <p className="text-[9px] text-gray-600 mt-3 leading-relaxed">
               These tools are automatically available to the chatbot. Reference them in your prompt to control when and how the bot uses them.
            </p>
         </div>

         {isEditable && (
            <Button
               onClick={() => saveMutation.mutate()}
               disabled={isSaving}
               className="w-full bg-primary text-black font-black uppercase tracking-tighter h-12 rounded-xl"
            >
               <RefreshCw className={cn("w-4 h-4 mr-2", isSaving && "animate-spin")} />
               {isSaving ? 'Deploying...' : 'Deploy System Prompt'}
            </Button>
         )}
      </div>
   );
};


export default Settings;
