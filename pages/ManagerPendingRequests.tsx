
import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge, cn, showToast } from '../components/ui';
import { Truck, Check, X, Clock, AlertCircle } from 'lucide-react';
import { useAuth } from '../AuthContext';
import { PurchaseRequest, Urgency } from '../types';

const ManagerPendingRequests: React.FC = () => {
   const { user } = useAuth();
   const queryClient = useQueryClient();

   const { data: requests, isLoading } = useQuery({
      queryKey: ['pending-purchase-requests'],
      queryFn: async () => {
         const { data, error } = await supabase
            .from('purchase_requests')
            // Fixed: unit_type -> unittype to match types.ts
            .select(`*, ingredient:ingredients(name, unit_id, units(abbreviation)), requester:profiles!created_by(full_name, email)`)
            .eq('status', 'pending')
            .order('created_at', { ascending: false });
         if (error) throw error;
         return data as (PurchaseRequest & { requester: any })[];
      }
   });

   const { mutate: updateStatus, isPending } = useMutation({
      mutationFn: async ({ id, status }: { id: string, status: 'approved' | 'rejected' }) => {
         const { error } = await supabase
            .from('purchase_requests')
            .update({
               status,
               approved_by: user?.id,
               approved_at: new Date().toISOString()
            })
            .eq('id', id);
         if (error) throw error;
      },
      onSuccess: (_, variables) => {
         showToast(`Request ${variables.status}`, 'success');
         queryClient.invalidateQueries({ queryKey: ['pending-purchase-requests'] });
      },
      onError: (err: any) => showToast(err.message, 'error')
   });

   return (
      <DashboardLayout title="Supply Chain Oversight" subtitle="Approve or reject replenishment requests">
         <Card className="bg-[#1A1A1A] border-gray-800 animate-in fade-in duration-500 overflow-hidden">
            <CardHeader className="bg-black/20 border-b border-gray-800 flex flex-row items-center justify-between py-4">
               <CardTitle className="text-white flex items-center gap-2">
                  <Truck className="w-5 h-5 text-blue-500" /> Pending Requests
                  <Badge className="bg-blue-600 ml-2">{requests?.length || 0}</Badge>
               </CardTitle>
            </CardHeader>
            <CardContent className="p-0 overflow-auto">
               <table className="w-full text-sm text-left">
                  <thead className="text-[10px] text-gray-500 uppercase bg-black/40 border-b border-gray-800 font-black tracking-widest">
                     <tr>
                        <th className="px-6 py-4">Ingredient</th>
                        <th className="px-6 py-4">Request Detail</th>
                        <th className="px-6 py-4">Urgency</th>
                        <th className="px-6 py-4">Requester</th>
                        <th className="px-6 py-4 text-right">Audit Action</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-800">
                     {requests?.length === 0 && !isLoading && (
                        <tr><td colSpan={5} className="p-20 text-center text-gray-500">
                           <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-10" />
                           No pending supply requests
                        </td></tr>
                     )}
                     {requests?.map((req) => (
                        <tr key={req.id} className="hover:bg-white/[0.02] transition-colors group">
                           <td className="px-6 py-4 font-bold text-white">{req.ingredient?.name}</td>
                           <td className="px-6 py-4">
                              <p className="text-gray-200 font-bold">{req.quantity} {req.ingredient?.units?.abbreviation || req.unit}</p>
                              <p className="text-xs text-gray-500 italic mt-0.5 line-clamp-1">"{req.reason}"</p>
                           </td>
                           <td className="px-6 py-4">
                              <Badge className={cn("text-[9px] uppercase font-black",
                                 req.urgency === 'critical' ? "bg-red-500/10 text-red-500" :
                                    req.urgency === 'high' ? "bg-orange-500/10 text-orange-500" : "bg-zinc-800 text-gray-400"
                              )}>
                                 {req.urgency}
                              </Badge>
                           </td>
                           <td className="px-6 py-4">
                              <div className="flex flex-col">
                                 <span className="text-white font-bold">{req.requester?.full_name || 'Staff'}</span>
                                 <span className="text-[10px] text-gray-600 font-mono">{new Date(req.created_at).toLocaleDateString()}</span>
                              </div>
                           </td>
                           <td className="px-6 py-4 text-right">
                              <div className="flex justify-end gap-2">
                                 <Button size="sm" onClick={() => updateStatus({ id: req.id, status: 'approved' })} disabled={isPending} className="bg-green-600 hover:bg-green-700 text-white font-bold h-9">
                                    <Check className="w-4 h-4 mr-1.5" /> Approve
                                 </Button>
                                 <Button size="sm" variant="destructive" onClick={() => updateStatus({ id: req.id, status: 'rejected' })} disabled={isPending} className="bg-red-500/10 text-red-500 border-red-500/20 h-9">
                                    <X className="w-4 h-4 mr-1.5" /> Reject
                                 </Button>
                              </div>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </CardContent>
         </Card>
      </DashboardLayout>
   );
};

export default ManagerPendingRequests;
