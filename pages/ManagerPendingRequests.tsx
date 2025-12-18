
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, cn, showToast, Dialog, Input } from '../components/ui';
import { Truck, Check, X, Clock, AlertCircle, MessageSquare } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../AuthContext';
import { RestockRequest, Urgency } from '../types';

const ManagerPendingRequests: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  // Fetch Pending Requests
  const { data: pendingRequests, isLoading } = useQuery({
    queryKey: ['pending-restock-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('restock_requests')
        .select(`
          *,
          ingredient:ingredients(name, unit_type),
          requester:users!requested_by(email, full_name)
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
        
      if (error) throw error;
      return data as RestockRequest[];
    }
  });

  // Approve Mutation
  const { mutate: approveRequest, isPending: isApproving } = useMutation({
    mutationFn: async (id: string) => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await supabase
        .from('restock_requests')
        .update({
          status: 'approved',
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      showToast(t('restock.manager.approvedToast'), 'success');
      queryClient.invalidateQueries({ queryKey: ['pending-restock-requests'] });
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  // Reject Mutation
  const { mutate: rejectRequest, isPending: isRejecting } = useMutation({
    mutationFn: async () => {
      if (!user || !rejectId) throw new Error("Missing data");
      
      // We'll append rejection note to the existing reason for simple auditing since schema is fixed
      const request = pendingRequests?.find(r => r.id === rejectId);
      const updatedReason = request 
        ? `${request.reason || ''} [REJECTED: ${rejectReason}]`.trim() 
        : rejectReason;

      const { error } = await supabase
        .from('restock_requests')
        .update({
          status: 'rejected',
          reason: updatedReason, 
          reviewed_by: user.id,
          reviewed_at: new Date().toISOString()
        })
        .eq('id', rejectId);
      if (error) throw error;
    },
    onSuccess: () => {
      showToast(t('restock.manager.rejectedToast'), 'success');
      queryClient.invalidateQueries({ queryKey: ['pending-restock-requests'] });
      setRejectId(null);
      setRejectReason('');
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  const getUrgencyBadge = (u: Urgency) => {
    switch (u) {
      case 'critical': return <Badge variant="destructive" className="animate-pulse">{t('restock.urgencyLevels.critical')}</Badge>;
      case 'medium': return <Badge className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">{t('restock.urgencyLevels.medium')}</Badge>;
      default: return <Badge variant="outline">{t('restock.urgencyLevels.low')}</Badge>;
    }
  };

  const getTimeAgo = (dateStr: string) => {
    const minutes = Math.floor((new Date().getTime() - new Date(dateStr).getTime()) / 60000);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <DashboardLayout title={t('restock.manager.pendingTitle')} subtitle="Review inventory requests">
      <Card className="bg-[#1A1A1A] border-gray-800 animate-in fade-in duration-500">
        <CardHeader>
           <CardTitle className="text-white flex items-center gap-2">
              <Truck className="w-5 h-5 text-blue-500" /> {t('nav.pendingRequests')}
              <Badge className="bg-blue-600 ml-2">{pendingRequests?.length || 0}</Badge>
           </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-auto">
           <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-black/20 border-b border-gray-800 sticky top-0 backdrop-blur-md z-10">
                 <tr>
                    <th className="px-6 py-4">{t('restock.ingredient')}</th>
                    <th className="px-6 py-4">{t('restock.quantity')}</th>
                    <th className="px-6 py-4">{t('restock.reason')}</th>
                    <th className="px-6 py-4">{t('restock.urgency')}</th>
                    <th className="px-6 py-4">{t('restock.manager.requestedBy')}</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                 {isLoading && (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-500">{t('common.loading')}</td></tr>
                 )}
                 {!isLoading && (!pendingRequests || pendingRequests.length === 0) && (
                    <tr><td colSpan={6} className="p-8 text-center text-gray-500">
                       <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-20" />
                       {t('restock.manager.emptyPending')}
                    </td></tr>
                 )}
                 {pendingRequests?.map((req) => (
                    <tr key={req.id} className="hover:bg-white/5 transition-colors group">
                       <td className="px-6 py-4 font-bold text-white">
                          {req.ingredient?.name || 'Unknown'}
                       </td>
                       <td className="px-6 py-4 text-gray-300">
                          {req.requested_quantity} <span className="text-xs text-gray-500">{req.ingredient?.unit_type}</span>
                       </td>
                       <td className="px-6 py-4 text-gray-400 max-w-[200px] truncate" title={req.reason}>
                          {req.reason}
                       </td>
                       <td className="px-6 py-4">
                          {getUrgencyBadge(req.urgency)}
                       </td>
                       <td className="px-6 py-4">
                          <div className="flex flex-col">
                             <span className="text-white font-medium">{req.requester?.full_name || 'Staff'}</span>
                             <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {getTimeAgo(req.created_at)}
                             </span>
                          </div>
                       </td>
                       <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-2">
                             <Button 
                                size="sm" 
                                className="bg-green-600 hover:bg-green-700 text-white w-24"
                                onClick={() => approveRequest(req.id)}
                                disabled={isApproving}
                             >
                                <Check className="w-4 h-4 mr-1" /> {t('restock.manager.approve')}
                             </Button>
                             <Button 
                                size="sm" 
                                variant="destructive"
                                className="w-24 bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20"
                                onClick={() => setRejectId(req.id)}
                                disabled={isRejecting}
                             >
                                <X className="w-4 h-4 mr-1" /> {t('restock.manager.reject')}
                             </Button>
                          </div>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </CardContent>
      </Card>

      {/* Reject Modal */}
      <Dialog isOpen={!!rejectId} onClose={() => setRejectId(null)} title={t('restock.manager.confirmReject')}>
         <div className="space-y-4 pt-2">
            <p className="text-gray-400 text-sm">
               Please provide a reason for rejecting this request. This will be visible to the kitchen staff.
            </p>
            <div className="space-y-2">
               <label className="text-xs font-bold text-gray-500 uppercase">{t('restock.manager.rejectionReason')}</label>
               <div className="relative">
                  <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                  <Input 
                     value={rejectReason}
                     onChange={(e) => setRejectReason(e.target.value)}
                     placeholder="e.g. Current stock is sufficient..."
                     className="pl-9"
                     autoFocus
                  />
               </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
               <Button variant="ghost" onClick={() => setRejectId(null)}>{t('common.cancel')}</Button>
               <Button 
                  variant="destructive" 
                  onClick={() => rejectRequest()}
                  disabled={!rejectReason.trim() || isRejecting}
               >
                  {isRejecting ? 'Rejecting...' : t('restock.manager.reject')}
               </Button>
            </div>
         </div>
      </Dialog>
    </DashboardLayout>
  );
};

export default ManagerPendingRequests;
