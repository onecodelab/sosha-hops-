
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, showToast, cn } from '../components/ui';
import { Plus, Search, FileText, Trash2, Eye, Download, MoreVertical, Truck, PackageCheck } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { PurchaseOrder } from '../types';

const ManagerPurchaseOrders: React.FC = () => {
   const { t } = useLanguage();
   const navigate = useNavigate();
   const queryClient = useQueryClient();
   const [filterStatus, setFilterStatus] = useState<string>('all');
   const [searchTerm, setSearchTerm] = useState('');
   const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

   // Fetch POs
   const { data: purchaseOrders, isLoading } = useQuery({
      queryKey: ['purchase-orders'],
      queryFn: async () => {
         const { data, error } = await supabase
            .from('purchase_orders')
            .select(`
          *,
          supplier:suppliers(name),
          creator:users!created_by(full_name)
        `)
            .order('created_at', { ascending: false });

         if (error) {
            console.warn("PO list fetch error:", error);
            return [];
         }
         return data as PurchaseOrder[];
      }
   });

   // Filter Logic
   const filteredPOs = purchaseOrders?.filter(po => {
      const matchesSearch = po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
         po.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || po.status === filterStatus;
      return matchesSearch && matchesStatus;
   }) || [];

   // Delete Mutation (Drafts only)
   const { mutate: deletePO } = useMutation({
      mutationFn: async (id: string) => {
         const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
         if (error) throw error;
      },
      onSuccess: () => {
         showToast(t('po.deleteSuccess'), 'success');
         queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
         setActiveDropdown(null);
      },
      onError: (err: any) => showToast(err.message, 'error')
   });

   const handleDownload = () => {
      showToast("PDF download coming soon", 'success');
      setActiveDropdown(null);
   };

   const handleViewDetails = (id: string) => {
      showToast(`Navigating to details for ${id.slice(0, 8)}...`, 'success');
      // navigate(`/manager/po-details/${id}`); 
      setActiveDropdown(null);
   };

   const handleDelete = (id: string) => {
      if (confirm(t('common.confirm') + "?")) {
         deletePO(id);
      }
   };

   const getStatusBadge = (status: string) => {
      switch (status) {
         case 'received': return <Badge variant="success" className="bg-green-500/10 text-green-500 border-green-500/20">{t('po.tabs.received')}</Badge>;
         case 'partial_received': return <Badge variant="warning" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">{t('po.tabs.partial')}</Badge>;
         case 'sent': return <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">{t('po.tabs.sent')}</Badge>;
         default: return <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/20">{t('po.tabs.draft')}</Badge>;
      }
   };

   // Close dropdowns on outside click
   React.useEffect(() => {
      const handleClick = () => setActiveDropdown(null);
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
   }, []);

   return (
      <DashboardLayout title={t('po.listTitle')} subtitle={t('po.listSubtitle')}
         actions={
            <Button onClick={() => navigate('/manager/create-po')} className="bg-primary text-black font-bold hover:bg-primary/90">
               <Plus className="w-4 h-4 mr-2" /> {t('po.createButton')}
            </Button>
         }
      >
         <div className="space-y-6 animate-in fade-in duration-500">

            {/* Controls */}
            <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
               {/* Tabs */}
               <div className="flex bg-[#1A1A1A] p-1 rounded-lg border border-gray-800 w-full md:w-auto overflow-x-auto">
                  {['all', 'draft', 'sent', 'partial_received', 'received'].map(status => {
                     const count = purchaseOrders?.filter(po => status === 'all' || po.status === status).length || 0;
                     const labelKey = status === 'partial_received' ? 'partial' : status;
                     return (
                        <button
                           key={status}
                           onClick={() => setFilterStatus(status)}
                           className={cn(
                              "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap",
                              filterStatus === status
                                 ? "bg-white/10 text-white shadow-sm"
                                 : "text-gray-400 hover:text-white hover:bg-white/5"
                           )}
                        >
                           {t(`po.tabs.${labelKey}` as any)}
                           <span className={cn("text-xs px-1.5 py-0.5 rounded-full", filterStatus === status ? "bg-black/40 text-white" : "bg-black/20 text-gray-500")}>
                              {count}
                           </span>
                        </button>
                     );
                  })}
               </div>

               {/* Search */}
               <div className="relative w-full md:w-72">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                  <Input
                     placeholder={t('common.search')}
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="pl-9 bg-[#1A1A1A] border-gray-800 focus:border-primary/50"
                  />
               </div>
            </div>

            {/* Table */}
            <Card className="bg-[#1A1A1A] border-gray-800 min-h-[500px] flex flex-col">
               <CardHeader className="border-b border-gray-800 pb-3">
                  <CardTitle className="text-white flex items-center gap-2 text-base">
                     <Truck className="w-5 h-5 text-gray-400" /> {t('po.listTitle')}
                  </CardTitle>
               </CardHeader>
               <CardContent className="p-0 flex-1 overflow-x-auto">
                  <table className="w-full text-sm text-left">
                     <thead className="text-xs text-gray-500 uppercase bg-black/40 border-b border-gray-800">
                        <tr>
                           <th className="px-6 py-4">{t('po.table.poNumber')}</th>
                           <th className="px-6 py-4">{t('po.table.supplier')}</th>
                           <th className="px-6 py-4">{t('po.table.created')}</th>
                           <th className="px-6 py-4">{t('po.table.expected')}</th>
                           <th className="px-6 py-4 text-right">{t('po.table.amount')}</th>
                           <th className="px-6 py-4 text-center">{t('po.table.status')}</th>
                           <th className="px-6 py-4 text-right w-20">{t('po.table.actions')}</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-800">
                        {isLoading && (
                           <tr><td colSpan={7} className="p-8 text-center text-gray-500">{t('common.loading')}</td></tr>
                        )}
                        {!isLoading && filteredPOs.length === 0 && (
                           <tr><td colSpan={7} className="p-8 text-center text-gray-500">{t('po.empty')}</td></tr>
                        )}
                        {filteredPOs.map((po) => (
                           <tr key={po.id} className="hover:bg-white/5 transition-colors group">
                              <td className="px-6 py-4 font-mono font-bold text-white">{po.po_number}</td>
                              <td className="px-6 py-4 text-gray-300 font-medium">{po.supplier?.name || 'Unknown'}</td>
                              <td className="px-6 py-4 text-gray-400 text-xs">
                                 {new Date(po.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-gray-400 text-xs">
                                 {new Date(po.expected_delivery).toLocaleDateString()}
                              </td>
                              <td className="px-6 py-4 text-right font-mono text-primary font-bold">
                                 ETB {po.total_amount.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 text-center">
                                 {getStatusBadge(po.status)}
                              </td>
                              <td className="px-6 py-4 text-right relative">
                                 <button
                                    onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === po.id ? null : po.id); }}
                                    className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                                 >
                                    <MoreVertical className="w-4 h-4" />
                                 </button>

                                 {activeDropdown === po.id && (
                                    <div className="absolute right-8 top-8 w-48 bg-[#222] border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                       <div className="p-1">
                                          <button
                                             onClick={() => handleViewDetails(po.id)}
                                             className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded flex items-center gap-2"
                                          >
                                             <Eye className="w-4 h-4" /> {t('po.actions.view')}
                                          </button>
                                          <button
                                             onClick={handleDownload}
                                             className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded flex items-center gap-2"
                                          >
                                             <Download className="w-4 h-4" /> {t('po.actions.download')}
                                          </button>

                                          {po.status === 'sent' && (
                                             <button onClick={() => navigate('/manager/receive-goods')} className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-blue-500/10 rounded flex items-center gap-2">
                                                <PackageCheck className="w-4 h-4" /> {t('po.actions.receive')}
                                             </button>
                                          )}

                                          {po.status === 'draft' && (
                                             <button onClick={() => handleDelete(po.id)} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded flex items-center gap-2 border-t border-gray-700 mt-1">
                                                <Trash2 className="w-4 h-4" /> {t('po.actions.delete')}
                                             </button>
                                          )}
                                       </div>
                                    </div>
                                 )}
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </CardContent>
            </Card>

         </div>
      </DashboardLayout>
   );
};

export default ManagerPurchaseOrders;
