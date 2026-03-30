
import React, { useState, useEffect, useRef } from 'react';
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

// Small helper to resolve a table_id from a branch for the Test Chatbot link
const TestChatbotLink: React.FC<{ branchId: string }> = ({ branchId }) => {
   const { data: tableId } = useQuery({
      queryKey: ['first_table', branchId],
      queryFn: async () => {
         const { data } = await supabase
            .from('tables')
            .select('id')
            .eq('branch_id', branchId)
            .limit(1)
            .maybeSingle();
         return data?.id || null;
      },
      enabled: !!branchId
   });

   if (!tableId) return (
      <span className="flex items-center gap-2 px-6 py-3 bg-muted/10 border border-border text-muted rounded-full text-[10px] font-black uppercase tracking-widest shadow-sm opacity-50 cursor-not-allowed">
         <Sparkles className="w-3.5 h-3.5" />
         No Tables Found
      </span>
   );

   return (
      <a
         href={`/order-chat/${tableId}`}
         target="_blank"
         rel="noopener noreferrer"
         className="flex items-center gap-2 px-6 py-3 bg-muted/10 border border-border text-foreground rounded-full hover:bg-primary/10 hover:border-primary/40 hover:scale-105 transition-all text-[10px] font-black uppercase tracking-widest shadow-sm"
      >
         <Sparkles className="w-3.5 h-3.5 text-primary" />
         Test Chatbot
      </a>
   );
};
   const [newBranchName, setNewBranchName] = useState('');
   const [newBranchLocation, setNewBranchLocation] = useState('');
   const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
   const [editName, setEditName] = useState('');
   const [editLocation, setEditLocation] = useState('');
   const [isSubmitting, setIsSubmitting] = useState(false);
   const isOwnerOrAdmin = profile?.role === 'owner' || profile?.role === 'admin';

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

   const { data: guestChatToken } = useQuery({
      queryKey: ['guest_chat_token', branches[0]?.id],
      queryFn: async () => {
         if (!branches[0]?.id) return null;
         const { data, error } = await supabase.rpc('generate_branch_token', { p_branch_id: branches[0].id });
         if (error) throw error;
         return data as string | null;
      },
      enabled: isOwnerOrAdmin && branches.length > 0
   });

   const guestChatHref = branches.length > 0 && guestChatToken
      ? `/order-chat/${branches[0].id}/UNKNOWN?token=${encodeURIComponent(guestChatToken)}`
      : null;

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

   useLayoutConfig({
      title: "System Orchestration",
      subtitle: "Core database maintenance and branch configuration"
   });

   return (
      <>
         <div className="space-y-8 animate-in fade-in duration-700">

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
               {/* Branch Management Card */}
               <Card className="bg-card backdrop-blur-xl border border-border rounded-[2.5rem] overflow-hidden shadow-2xl">
                  <div className="p-8 border-b border-border flex items-center justify-between bg-muted/5">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                           <Building2 className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                           <CardTitle className="text-foreground text-xl tracking-tight">Branch Management</CardTitle>
                           <p className="text-[10px] font-black text-muted uppercase tracking-widest mt-0.5">Scale your empire</p>
                        </div>
                     </div>
                  </div>
                  <CardContent className="p-8 space-y-8">
                     {isOwnerOrAdmin && (
                        <div className="bg-muted/5 border border-border p-8 rounded-[2rem] space-y-6 shadow-inner">
                           <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4">New Branch Entry</h4>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 opacity-60">Location Name</label>
                                 <input
                                    value={newBranchName}
                                    onChange={e => setNewBranchName(e.target.value)}
                                    placeholder="e.g. Downtown Branch"
                                    className="w-full h-12 bg-card border border-border rounded-xl px-4 text-sm text-foreground focus:outline-none focus:border-primary/50 shadow-sm transition-all"
                                 />
                              </div>
                              <div className="space-y-1">
                                 <label className="text-[10px] font-bold text-gray-500 uppercase ml-1">Area / City</label>
                                 <input
                                    value={newBranchLocation}
                                    onChange={e => setNewBranchLocation(e.target.value)}
                                    placeholder="e.g. Addis Ababa"
                                    className="w-full h-12 bg-card border border-border rounded-xl px-4 text-sm text-foreground focus:outline-none focus:border-primary/50 shadow-sm transition-all"
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

                     <div className="space-y-4">
                        <h4 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] ml-1 opacity-60">Active Network</h4>
                        {branchesLoading ? (
                           <div className="p-8 text-center text-muted animate-pulse uppercase text-[10px] font-black tracking-widest">Scanning network...</div>
                        ) : branches.map((b: Branch) => (
                           <div key={b.id} className="p-5 bg-muted/5 border border-border rounded-2xl flex items-center justify-between group hover:bg-muted/10 hover:border-primary/40 transition-all duration-300">
                              <div className="flex-1">
                                 {editingBranchId === b.id ? (
                                    <div className="flex flex-col md:flex-row gap-2">
                                        <input
                                           value={editName}
                                           onChange={e => setEditName(e.target.value)}
                                           className="bg-card border border-border rounded-lg px-4 py-2 text-sm text-foreground focus:border-primary/50 outline-none w-full md:w-1/2 shadow-sm"
                                           placeholder="Name"
                                        />
                                        <input
                                           value={editLocation}
                                           onChange={e => setEditLocation(e.target.value)}
                                           className="bg-card border border-border rounded-lg px-4 py-2 text-sm text-foreground focus:border-primary/50 outline-none w-full md:w-1/2 shadow-sm"
                                           placeholder="Location"
                                        />
                                    </div>
                                 ) : (
                                    <div className="flex items-center justify-between flex-wrap gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-muted/10 flex items-center justify-center border border-border group-hover:bg-primary/20 group-hover:border-primary/40 transition-all duration-500 shadow-inner">
                                           <MapPin className="w-5 h-5 text-muted group-hover:text-primary transition-colors" />
                                        </div>
                                        <div>
                                           <p className="text-base font-black text-foreground uppercase tracking-tight italic">{b.name}</p>
                                           <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-0.5 opacity-60">{b.location || 'Unknown Location'}</p>
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
                                                 className="p-2.5 hover:bg-primary/10 text-muted hover:text-primary rounded-xl transition-all"
                                              >
                                                 <Edit2 className="w-4 h-4" />
                                              </button>
                                              <button
                                                 onClick={() => {
                                                    if (confirm(`Are you sure you want to delete "${b.name}"? This action cannot be undone and will fail if the branch has active orders or staff.`)) {
                                                       deleteBranchMutation.mutate(b.id);
                                                    }
                                                 }}
                                                 disabled={deleteBranchMutation.isPending}
                                                 className="p-2.5 hover:bg-red-500/10 text-muted hover:text-red-500 rounded-xl transition-all disabled:opacity-50"
                                              >
                                                 <Trash2 className="w-4 h-4" />
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
               <Card className="bg-card backdrop-blur-xl border border-border rounded-[2.5rem] overflow-hidden relative group/bank shadow-2xl">
                  <div className="absolute inset-0 bg-blue-500/5 opacity-0 group-hover/bank:opacity-100 transition-opacity duration-500 blur-3xl pointer-events-none" />
                  <div className="p-8 border-b border-border relative bg-muted/5">
                     <div className="flex items-center justify-between flex-wrap gap-4 relative z-10">
                        <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center border border-blue-500/20 shadow-inner">
                           <ShieldCheck className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                           <CardTitle className="text-foreground text-xl tracking-tight">Bank Configuration</CardTitle>
                           <p className="text-[10px] font-black text-blue-500/60 uppercase tracking-widest mt-0.5">Secure Transaction Verification</p>
                        </div>
                     </div>
                  </div>
                  <CardContent className="p-8 relative">
                     <BankSettingsSection isEditable={isOwnerOrAdmin} organizationId={profile?.organization_id} />
                  </CardContent>
               </Card>
            </div>

            {/* AI Agent Configuration - Fixed stretchiness by using a max-width or grid container */}
            <Card className="bg-card backdrop-blur-xl border border-border rounded-[2.5rem] overflow-hidden group/bot relative shadow-2xl">
               <div className="absolute top-0 right-0 w-96 h-96 bg-primary/5 rounded-full blur-[100px] pointer-events-none opacity-50 transition-all duration-700" />
               <div className="p-8 border-b border-border relative bg-muted/5">
                  <div className="flex items-center justify-between flex-wrap gap-6 relative z-10">
                     <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                           <Zap className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                           <CardTitle className="text-foreground text-xl tracking-tight">Customer AI Agent</CardTitle>
                           <p className="text-[10px] font-black text-primary/60 uppercase tracking-[0.2em] mt-0.5">Full System Prompt Control</p>
                        </div>
                     </div>
                     {branches.length > 0 && (
                        <TestChatbotLink branchId={branches[0].id} />
                     )}
                  </div>
               </div>
               <CardContent className="p-8 relative z-10">
                  <BotSettingsSection isEditable={isOwnerOrAdmin} organizationId={profile?.organization_id} />
               </CardContent>
            </Card>

            {/* Organization & Subscription Section */}
            {isOwnerOrAdmin && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                   <Card className="bg-card backdrop-blur-xl border border-border rounded-[2.5rem] overflow-hidden shadow-2xl">
                      <div className="p-8 border-b border-border bg-muted/5">
                         <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center border border-primary/20 shadow-inner">
                               <Building2 className="w-6 h-6 text-primary" />
                            </div>
                            <div>
                               <CardTitle className="text-foreground text-xl tracking-tight">Organization Profile</CardTitle>
                               <p className="text-[10px] font-black text-muted uppercase tracking-widest mt-0.5 opacity-60">Your Business Identity</p>
                            </div>
                         </div>
                      </div>
                      <CardContent className="p-8 space-y-6">
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 opacity-60">Business Name</label>
                            <div className="p-5 bg-muted/5 border border-border rounded-2xl text-foreground font-black uppercase tracking-tight italic text-lg shadow-inner">
                               {orgLoading ? '...' : org?.name}
                            </div>
                         </div>
                         <div className="space-y-2">
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 opacity-60">Organization ID</label>
                            <div className="p-5 bg-muted/5 border border-border rounded-2xl text-muted font-mono text-[10px] break-all shadow-inner opacity-50">
                               {profile?.organization_id}
                            </div>
                         </div>
                      </CardContent>
                   </Card>
 
                </div>
            )}

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
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 opacity-60">Bank Type</label>
                      <select
                         value={newBankKey}
                         onChange={e => setNewBankKey(e.target.value)}
                         className="w-full h-12 bg-card border border-border rounded-xl px-4 text-sm text-foreground focus:outline-none focus:border-blue-500/50 appearance-none bg-no-repeat bg-[right_1rem_center] shadow-sm transition-all"
                         style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='currentColor'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundSize: '1em' }}
                      >
                        <option value="cbe">Commercial Bank (CBE)</option>
                        <option value="telebirr">Telebirr</option>
                        <option value="abyssinia">Bank of Abyssinia</option>
                        <option value="dashen">Dashen Bank</option>
                        <option value="cbebirr">CBE Birr</option>
                        <option value="awash">Awash Bank</option>
                     </select>
                   </div>
                   <div className="space-y-2">
                      <label className="text-[10px] font-black text-muted uppercase tracking-widest ml-1 opacity-60">Account / Suffix ID</label>
                      <input
                         value={newBankAccount}
                         onChange={e => setNewBankAccount(e.target.value)}
                         placeholder="Enter account number"
                         className="w-full h-12 bg-card border border-border rounded-xl px-4 text-sm text-foreground focus:outline-none focus:border-blue-500/50 font-mono shadow-sm transition-all"
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
             <div className="flex flex-col items-center justify-center py-16 text-center bg-muted/5 rounded-[2.5rem] border border-border border-dashed">
                <div className="w-20 h-20 rounded-[2rem] bg-muted/10 flex items-center justify-center border border-border mb-6 opacity-20 shadow-inner">
                   <ShieldCheck className="w-10 h-10 text-muted" />
                </div>
                <h5 className="text-base font-black text-muted uppercase tracking-widest italic">No Bank Profiles Found</h5>
                <p className="text-[10px] text-muted font-black uppercase tracking-[0.2em] mt-2 max-w-[250px] opacity-40 leading-relaxed">Bank-level transaction verification is currently offline</p>
             </div>
         ) : (
            <div className="space-y-4">
               {bankSettings.map((bank: any) => (
                   <div key={bank.bank_key} className="relative group overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                      <div className="relative p-6 bg-muted/5 border border-border rounded-[2rem] flex items-center justify-between hover:bg-muted/10 hover:border-blue-500/40 hover:scale-[1.01] transition-all duration-500 shadow-sm group-hover:shadow-lg">
                        <div className="flex items-center gap-5 flex-1">
                           <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center border transition-all duration-500 shadow-lg",
                              bank.bank_key === 'cbe' ? "bg-blue-600/20 border-blue-500/30 text-blue-400 group-hover:shadow-blue-500/20" :
                                 bank.bank_key === 'telebirr' ? "bg-purple-600/20 border-purple-500/30 text-purple-400 group-hover:shadow-purple-500/20" :
                                    "bg-zinc-800/20 border-zinc-700/30 text-zinc-400")}>
                              <CreditCard className="w-6 h-6" />
                           </div>
                           <div className="flex-1">
                               <div className="flex items-center gap-3">
                                  <p className="text-base font-black text-foreground uppercase tracking-tighter italic">{bank.bank_key}</p>
                                  <span className="px-3 py-1 bg-muted/10 rounded-full text-[9px] font-black text-muted uppercase tracking-[0.2em] border border-border opacity-60">Authenticated</span>
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
                                  <div className="mt-2 flex items-center gap-2">
                                     <span className="text-[10px] text-muted font-black uppercase tracking-widest opacity-40">Entry:</span>
                                     <span className="text-sm text-foreground font-mono bg-muted/10 px-3 py-1 rounded-xl border border-border shadow-inner">
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
   const [logoUrl, setLogoUrl] = useState('');
   const [charCount, setCharCount] = useState(0);
   const [isUploading, setIsUploading] = useState(false);
   const fileInputRef = useRef<HTMLInputElement>(null);

   const DEFAULT_PROMPT = `You are Baro, a professional and efficient restaurant assistant. 🍽️

## YOUR CORE RULES
1. **VISUAL MENU ONLY**: ALWAYS use the 'get_menu' tool to show items. NEVER list items, descriptions, or prices in plain text.
2. **SMART TABLE RECOGNITION**: Check the "Table (Claimed)" in the current context. If it says "Unknown", you must ask the customer for their table number. If it is already known, simply confirm and proceed.
3. **ACCURATE ORDERING**: 
   - Use 'place_order' for new orders.
   - Use 'update_order' to add items to an existing order (Check "Active Order ID" in context).
   - ALWAYS confirm the full list of items and special instructions (notes) before finalizing any order.
4. **PAYMENT & ASSISTANCE**: Help customers with their bill using 'get_branch_info' and 'get_order_status'. Verify payments immediately using 'verify_payment'.
5. **CUSTOMER CARE**: Use 'update_customer_profile' whenever you learn a customer's name, contact info, or food preferences/allergies.

## TONE & VOICE
- Professional, helpful, and welcoming.
- Responses should be concise (max 3 sentences).
- Use clear formatting and occasional friendly emojis. ✨`;

   // Load existing prompt from organizations table
   const { data: orgData, isLoading } = useQuery({
      queryKey: ['chatbot_system_prompt', organizationId],
      queryFn: async () => {
         if (!organizationId) return null;
         const { data, error } = await supabase
            .from('organizations')
            .select('chatbot_system_prompt, chatbot_logo_url')
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
         setLogoUrl(orgData.chatbot_logo_url || '');
      }
   }, [orgData]);

   const saveMutation = useMutation({
      mutationFn: async () => {
         if (!organizationId) throw new Error("Organization ID is missing.");
         setIsSaving(true);
         const { error } = await supabase
            .from('organizations')
            .update({ 
                chatbot_system_prompt: systemPrompt,
                chatbot_logo_url: logoUrl
            })
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

   const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
       const file = e.target.files?.[0];
       if (!file) return;

       if (!file.type.startsWith('image/')) {
           showToast("Please upload a valid image file", "error");
           return;
       }

       if (file.size > 2 * 1024 * 1024) {
           showToast("Image must be smaller than 2MB", "error");
           return;
       }

       setIsUploading(true);
       try {
           const fileExt = file.name.split('.').pop();
           const fileName = `chatbot_logo_${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
           const filePath = `organization-assets/${fileName}`;

           const { error: uploadError } = await supabase.storage
               .from('menu-images') // Using existing public bucket
               .upload(filePath, file);

           if (uploadError) throw uploadError;

           const { data: { publicUrl } } = supabase.storage
               .from('menu-images')
               .getPublicUrl(filePath);

           setLogoUrl(publicUrl);
           showToast("Logo uploaded securely! Click Deploy to save.", "success");
       } catch (err: any) {
           showToast(err.message || "Upload failed", "error");
       } finally {
           setIsUploading(false);
           if (fileInputRef.current) fileInputRef.current.value = '';
       }
   };

   if (isLoading) return <div className="text-center py-4 text-zinc-600 animate-pulse text-[10px] font-black uppercase tracking-widest">Loading AI Configuration...</div>;

   return (
      <div className="space-y-6">
          {/* Info Banner */}
          <div className="p-6 bg-primary/5 border border-primary/20 rounded-[2rem] shadow-inner relative overflow-hidden">
             <div className="absolute -top-10 -left-10 w-32 h-32 bg-primary/20 blur-[60px] rounded-full pointer-events-none" />
             <div className="relative z-10">
                <p className="text-[10px] text-primary/80 font-black uppercase tracking-[0.2em] mb-2 px-1">Full Control Mode</p>
                <p className="text-xs text-muted font-bold uppercase tracking-widest leading-relaxed opacity-60 px-1">
                   This is the <span className="text-foreground">complete instruction set</span> your customer chatbot follows. 
                   Edit it to change how the bot behaves, what it says, and how it uses tools like menu search, ordering, and payments.
                </p>
             </div>
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
                className="w-full bg-card border border-border rounded-[2rem] p-8 text-sm text-foreground focus:outline-none focus:border-primary/40 shadow-inner resize-y font-mono leading-relaxed min-h-[350px] transition-all"
             />

             <div className="mt-8 space-y-2">
                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Chatbot Avatar Image URL</label>
                <div className="flex items-center gap-4">
                    <div className="w-16 h-16 rounded-2xl bg-muted/10 border border-border flex items-center justify-center shrink-0 shadow-inner overflow-hidden relative group">
                        {logoUrl ? (
                            <img src={logoUrl} alt="Chatbot Avatar" className="w-full h-full object-cover" />
                        ) : (
                            <Zap className="w-6 h-6 text-muted/50" />
                        )}
                        {isEditable && (
                           <button 
                               onClick={() => fileInputRef.current?.click()}
                               disabled={isUploading}
                               className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[8px] font-black text-white tracking-widest uppercase cursor-pointer backdrop-blur-sm"
                           >
                               {isUploading ? '...' : 'UPLOAD'}
                           </button>
                        )}
                    </div>
                    <div className="flex-1 flex gap-2">
                        <input
                            value={logoUrl}
                            onChange={e => setLogoUrl(e.target.value)}
                            disabled={!isEditable}
                            placeholder="e.g. /ai-avatar.png or https://imgur.com/your-image.png"
                            className="flex-1 w-full bg-card border border-border rounded-xl px-4 h-12 text-sm text-foreground focus:outline-none focus:border-primary/40 shadow-sm transition-all"
                        />
                        {isEditable && (
                           <Button
                               variant="outline"
                               onClick={() => fileInputRef.current?.click()}
                               disabled={isUploading}
                               className="h-12 border-border hover:bg-muted/10 uppercase font-black text-[10px] tracking-widest rounded-xl px-6 shrink-0"
                           >
                               {isUploading ? 'Uploading...' : 'Browse'}
                           </Button>
                        )}
                        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                    </div>
                </div>
                <p className="text-[9px] text-gray-500 mt-1 ml-1 leading-relaxed max-w-lg">
                    Provide a transparent PNG or simple image URL to replace the default AI core/sparkles with your own custom branded mascot in the Customer App.
                </p>
             </div>
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
