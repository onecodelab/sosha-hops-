
import React, { useState } from 'react';
import { Dialog, Button, Input, showToast, cn } from './ui';
import { supabase } from '../supabase';
import { Mail, User, Send, DollarSign, Calendar, MapPin } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { useBranch } from '../contexts/BranchContext';

interface InviteStaffModalProps {
   isOpen: boolean;
   onClose: () => void;
   onSuccess: () => void;
}

export const InviteStaffModal: React.FC<InviteStaffModalProps> = ({ isOpen, onClose, onSuccess }) => {
   const { user, profile } = useAuth();
   const { branches, activeBranchId } = useBranch();
   const [email, setEmail] = useState('');
   const [fullName, setFullName] = useState('');
   const [role, setRole] = useState('waiter');
   const [selectedBranchId, setSelectedBranchId] = useState<string>(activeBranchId || '');
   const [loading, setLoading] = useState(false);

   // Compensation fields
   const [baseSalary, setBaseSalary] = useState('');
   const [payPeriod, setPayPeriod] = useState<'monthly' | 'weekly' | 'hourly'>('monthly');

   const handleInvite = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!email || !fullName) return;

      setLoading(true);
      try {
         const newUserId = crypto.randomUUID();

         const { error } = await supabase
            .from('profiles')
            .insert({
               id: newUserId,
               email: email,
               full_name: fullName,
               role: role,
               is_online: false,
               created_by: user?.id || null,
               invitation_pending: true,
               home_branch_id: selectedBranchId || activeBranchId,
               // New compensation fields
               base_salary: baseSalary ? parseFloat(baseSalary) : null,
               pay_period: payPeriod,
               is_salary_approved: profile?.role === 'owner' // Auto-approve if owner is creating
            });

         if (error) throw error;

         showToast(
            `Invitation created for ${fullName}! Base salary set to ${baseSalary || 'None'}.`,
            "success"
         );

         onSuccess();
         onClose();
         setEmail('');
         setFullName('');
         setRole('waiter');
         setBaseSalary('');

      } catch (err: any) {
         console.error('Invite error:', err);
         showToast(err.message || 'Failed to create invitation', 'error');
      } finally {
         setLoading(false);
      }
   };

   return (
      <Dialog isOpen={isOpen} onClose={onClose} title="Invite New Staff">
         <div className="p-1">
            <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-lg mb-6 flex gap-3">
               <div className="p-2 bg-blue-500/20 rounded-full h-fit">
                  <Send className="w-4 h-4 text-blue-400" />
               </div>
               <div>
                  <h4 className="text-sm font-bold text-white">Create Invitation</h4>
                  <p className="text-xs text-gray-400 mt-1">
                     This creates a pending profile. Staff can sign up manually with this email to activate.
                  </p>
               </div>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
               <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <label className="text-xs font-bold text-gray-500 uppercase">Full Name</label>
                     <div className="relative">
                        <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" className="pl-9" required />
                     </div>
                  </div>

                  <div className="space-y-2">
                     <label className="text-xs font-bold text-gray-500 uppercase">Email Address</label>
                     <div className="relative">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@baro.os" className="pl-9" required />
                     </div>
                  </div>
               </div>

               <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Role</label>
                  <div className="grid grid-cols-3 gap-2">
                     {['waiter', 'kitchen', 'manager'].map((r) => (
                        <button
                           key={r}
                           type="button"
                           onClick={() => setRole(r)}
                           className={cn(
                              "py-2 px-3 rounded-lg border text-sm font-bold capitalize transition-all",
                              role === r ? "bg-primary text-black border-primary" : "bg-black/20 border-gray-700 text-gray-400 hover:border-gray-500"
                           )}
                        >
                           {r}
                        </button>
                     ))}
                  </div>
               </div>

               <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-500 uppercase">Home Branch</label>
                  <div className="relative">
                     <MapPin className="absolute left-3 top-3 h-4 w-4 text-gray-500 pointer-events-none" />
                     <select
                        value={selectedBranchId}
                        onChange={(e) => setSelectedBranchId(e.target.value)}
                        className="w-full h-11 bg-black/20 border border-gray-700 rounded-lg px-9 text-sm text-white focus:outline-none appearance-none"
                        required
                     >
                        <option value="">Select a Branch</option>
                        {branches.map(b => (
                           <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                     </select>
                  </div>
               </div>

               {/* Compensation Section */}
               <div className="pt-4 border-t border-white/5 space-y-4">
                  <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Compensation</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Base Salary</label>
                        <div className="relative">
                           <DollarSign className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                           <Input type="number" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} placeholder="0.00" className="pl-9" />
                        </div>
                     </div>
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Pay Period</label>
                        <div className="relative">
                           <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                           <select
                              value={payPeriod}
                              onChange={(e) => setPayPeriod(e.target.value as any)}
                              className="w-full h-11 bg-black/20 border border-gray-700 rounded-lg px-9 text-sm text-white focus:outline-none appearance-none"
                           >
                              <option value="monthly">Monthly</option>
                              <option value="weekly">Weekly</option>
                              <option value="hourly">Hourly</option>
                           </select>
                        </div>
                     </div>
                  </div>
               </div>

               <div className="pt-4 flex justify-end gap-3">
                  <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
                  <Button type="submit" isLoading={loading} className="bg-primary text-black font-bold">
                     {loading ? 'Creating...' : 'Create Invite'}
                  </Button>
               </div>
            </form>
         </div>
      </Dialog>
   );
};
