import React, { useState } from 'react';
import { Dialog, Button, Input, showToast, cn } from './ui';
import { supabase } from '../supabase';
import { Mail, User, Send } from 'lucide-react';
import { useAuth } from '../AuthContext';

interface InviteStaffModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const InviteStaffModal: React.FC<InviteStaffModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('waiter');
  const [loading, setLoading] = useState(false);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !fullName) return;
    
    setLoading(true);
    try {
      // Generate a UUID for the invited user
      const newUserId = crypto.randomUUID();
      
      // Insert directly into profiles table (no auth user creation)
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: newUserId,
          email: email,
          full_name: fullName,
          role: role,
          phone: null, // Optional field
          is_online: false,
          created_by: user?.id || null,
          invitation_pending: true
        });

      if (error) {
        console.error('Insert error:', error);
        throw error;
      }
      
      // Success message
      showToast(
        `Invitation created for ${fullName}! They can sign up with ${email} and will be assigned the ${role} role.`, 
        "success"
      );
      
      onSuccess();
      onClose();
      setEmail('');
      setFullName('');
      setRole('waiter');

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
                   This creates a pending profile. The staff member must sign up manually with this email address to activate their account.
                </p>
             </div>
          </div>

          <form onSubmit={handleInvite} className="space-y-4">
             <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Full Name</label>
                <div className="relative">
                   <User className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                   <Input 
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="e.g. John Doe"
                      className="pl-9"
                      required
                   />
                </div>
             </div>

             <div className="space-y-2">
                <label className="text-xs font-bold text-gray-500 uppercase">Email Address</label>
                <div className="relative">
                   <Mail className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                   <Input 
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="staff@sosha.os"
                      className="pl-9"
                      required
                   />
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
                            role === r 
                               ? "bg-primary text-black border-primary" 
                               : "bg-black/20 border-gray-700 text-gray-400 hover:border-gray-500"
                         )}
                      >
                         {r}
                      </button>
                   ))}
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