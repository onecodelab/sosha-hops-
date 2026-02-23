
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Input, Button, Badge, cn, showToast } from '../components/ui';
import { Truck, Search, ShoppingBag, Send, Loader2, X, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../AuthContext';
import { useBranch } from '../contexts/BranchContext';
import { Ingredient, RestockRequest, Urgency } from '../types';

const KitchenRestockRequests: React.FC = () => {
   const { t } = useLanguage();
   const { user, organizationId } = useAuth();
   const queryClient = useQueryClient();

   // Form State
   const [searchTerm, setSearchTerm] = useState('');
   const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
   const [quantity, setQuantity] = useState('');
   const [reason, setReason] = useState('');
   const [urgency, setUrgency] = useState<Urgency>('medium');
   const [isDropdownOpen, setIsDropdownOpen] = useState(false);

   // Fetch Ingredients for dropdown
   const { activeBranchId } = useBranch();
   const { data: ingredients } = useQuery({
      queryKey: ['kitchen-ingredients', activeBranchId],
      queryFn: async () => {
         if (!activeBranchId) return [];
         const { data, error } = await supabase
            .from('ingredients')
            .select(`
               *,
               branch_inventory!inner(branch_id, current_stock)
            `)
            .eq('is_active', true)
            .eq('branch_inventory.branch_id', activeBranchId)
            .order('name');

         if (error) {
            console.error("Ingredients fetch error:", error);
            return [];
         }

         // Map the data to override base current_stock with the branch_inventory stock
         return data.map((item: any) => ({
            ...item,
            current_stock: item.branch_inventory[0]?.current_stock || 0
         })) as Ingredient[];
      }
   });

   // Fetch My Requests
   const { data: myRequests, isLoading: requestsLoading } = useQuery({
      queryKey: ['my-restock-requests'],
      queryFn: async () => {
         if (!user) return [];
         const { data, error } = await supabase
            .from('restock_requests')
            .select(`
          *,
          ingredient:ingredients(name, unit_id, unit_type, units(abbreviation)),
          reviewer:profiles!reviewed_by(full_name, email)
        `)
            .eq('requested_by', user.id)
            .order('created_at', { ascending: false });

         if (error) {
            console.warn("Restock requests fetch error (table might be missing):", error);
            return [];
         }
         return data as RestockRequest[];
      }
   });

   // Filter Ingredients
   const filteredIngredients = useMemo(() => {
      if (!ingredients) return [];
      if (!searchTerm) return ingredients;
      const lower = searchTerm.toLowerCase();
      return ingredients.filter(i =>
         i.name.toLowerCase().includes(lower) ||
         i.sku.toLowerCase().includes(lower)
      );
   }, [ingredients, searchTerm]);

   // Create Request Mutation
   const { mutate: createRequest, isPending } = useMutation({
      mutationFn: async () => {
         if (!selectedIngredient || !user) throw new Error("Missing required fields");
         const qtyNum = parseFloat(quantity);
         if (isNaN(qtyNum) || qtyNum <= 0) throw new Error("Invalid quantity");

         const { error } = await supabase
            .from('restock_requests')
            .insert({
               ingredient_id: selectedIngredient.id,
               requested_quantity: qtyNum,
               reason: reason,
               urgency: urgency,
               requested_by: user.id,
               status: 'pending',
               organization_id: organizationId
            });

         if (error) throw error;
      },
      onSuccess: () => {
         showToast(t('restock.success'), 'success');
         queryClient.invalidateQueries({ queryKey: ['my-restock-requests'] });

         // Reset Form
         setSelectedIngredient(null);
         setSearchTerm('');
         setQuantity('');
         setReason('');
         setUrgency('medium');
      },
      onError: (err: any) => {
         showToast(err.message || "Failed to submit request", 'error');
      }
   });

   const handleSelectIngredient = (ing: Ingredient) => {
      setSelectedIngredient(ing);
      setSearchTerm(ing.name);
      setIsDropdownOpen(false);
   };

   const clearSelection = () => {
      setSelectedIngredient(null);
      setSearchTerm('');
      setIsDropdownOpen(true);
   };

   const getStatusBadge = (status: string) => {
      switch (status) {
         case 'approved': return <Badge variant="success" className="bg-green-500/10 text-green-500 border-green-500/20">{t('restock.statuses.approved')}</Badge>;
         case 'rejected': return <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20">{t('restock.statuses.rejected')}</Badge>;
         case 'ordered': return <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">{t('restock.statuses.ordered')}</Badge>;
         default: return <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/20">{t('restock.statuses.pending')}</Badge>;
      }
   };

   const getUrgencyColor = (u: Urgency) => {
      if (u === 'critical') return "text-red-500 font-bold border-red-500/30 bg-red-500/10";
      if (u === 'medium') return "text-yellow-500 border-yellow-500/30 bg-yellow-500/10";
      return "text-green-500 border-green-500/30 bg-green-500/10";
   };

   return (
      <DashboardLayout title={t('restock.title')} subtitle={t('restock.subtitle')}>
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">

            {/* Left Column: Create Request Form */}
            <div className="lg:col-span-1 space-y-6">
               <Card className="bg-[#1A1A1A] border-gray-800 border-l-4 border-l-blue-500 h-fit">
                  <CardHeader>
                     <CardTitle className="flex items-center gap-2 text-white">
                        <ShoppingBag className="w-5 h-5 text-blue-500" /> {t('restock.createTitle')}
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">

                     {/* Ingredient Search */}
                     <div className="space-y-2 relative">
                        <label className="text-xs font-bold text-gray-500 uppercase">{t('restock.ingredient')}</label>
                        <div className="relative">
                           <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                           <Input
                              value={searchTerm}
                              onChange={(e) => { setSearchTerm(e.target.value); setIsDropdownOpen(true); if (selectedIngredient && e.target.value !== selectedIngredient.name) setSelectedIngredient(null); }}
                              onFocus={() => setIsDropdownOpen(true)}
                              placeholder={t('restock.searchPlaceholder')}
                              className="pl-9 bg-black/20 border-gray-800"
                           />
                           {selectedIngredient && (
                              <button onClick={clearSelection} className="absolute right-3 top-3 text-gray-500 hover:text-white">
                                 <X className="w-4 h-4" />
                              </button>
                           )}
                        </div>

                        {/* Dropdown Results */}
                        {isDropdownOpen && filteredIngredients.length > 0 && !selectedIngredient && (
                           <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#222] border border-gray-700 rounded-lg shadow-xl max-h-60 overflow-y-auto custom-scrollbar">
                              {filteredIngredients.map(ing => (
                                 <button
                                    key={ing.id}
                                    onClick={() => handleSelectIngredient(ing)}
                                    className="w-full text-left px-4 py-3 hover:bg-white/10 border-b border-gray-800/50 last:border-0 transition-colors flex justify-between items-center group"
                                 >
                                    <div>
                                       <p className="font-bold text-sm text-white group-hover:text-primary">{ing.name}</p>
                                       <p className="text-xs text-gray-500 font-mono">{ing.sku}</p>
                                    </div>
                                    <span className="text-xs text-gray-400 bg-black/40 px-2 py-1 rounded">{(ing.current_stock || 0).toLocaleString()} {ing.units?.abbreviation || ing.unit_type}</span>
                                 </button>
                              ))}
                           </div>
                        )}
                     </div>

                     {/* Quantity & Urgency */}
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-xs font-bold text-gray-500 uppercase">{t('restock.quantity')}</label>
                           <div className="relative">
                              <Input
                                 type="number"
                                 value={quantity}
                                 onChange={(e) => setQuantity(e.target.value)}
                                 placeholder="0.00"
                                 className="bg-black/20 border-gray-800 pr-12"
                              />
                              <span className="absolute right-3 top-3 text-xs text-gray-500 font-bold">
                                 {selectedIngredient?.units?.abbreviation || selectedIngredient?.unit_type || ''}
                              </span>
                           </div>
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-bold text-gray-500 uppercase">{t('restock.urgency')}</label>
                           <select
                              className="w-full h-11 bg-black/20 border border-gray-800 rounded-lg text-sm px-3 text-white focus:outline-none focus:border-blue-500/50 appearance-none"
                              value={urgency}
                              onChange={(e) => setUrgency(e.target.value as Urgency)}
                           >
                              <option value="low">{t('restock.urgencyLevels.low')}</option>
                              <option value="medium">{t('restock.urgencyLevels.medium')}</option>
                              <option value="critical">{t('restock.urgencyLevels.critical')}</option>
                           </select>
                        </div>
                     </div>

                     {/* Reason */}
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">{t('restock.reason')}</label>
                        <textarea
                           value={reason}
                           onChange={(e) => setReason(e.target.value)}
                           placeholder={t('restock.placeholders.reason')}
                           className="w-full h-24 bg-black/20 border border-gray-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-blue-500/50 resize-none"
                        />
                     </div>

                     <Button
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold h-12"
                        disabled={!selectedIngredient || !quantity || isPending}
                        onClick={() => createRequest()}
                     >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                        {t('restock.submit')}
                     </Button>

                  </CardContent>
               </Card>
            </div>

            {/* Right Column: My Requests Table */}
            <div className="lg:col-span-2">
               <Card className="bg-[#1A1A1A] border-gray-800 h-full flex flex-col min-h-[500px]">
                  <CardHeader className="border-b border-gray-800 pb-4">
                     <CardTitle className="text-white flex items-center gap-2">
                        <Truck className="w-5 h-5 text-gray-400" /> {t('restock.myRequestsTitle')}
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 overflow-auto custom-scrollbar">
                     <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-black/20 border-b border-gray-800 sticky top-0 backdrop-blur-md z-10">
                           <tr>
                              <th className="px-6 py-4">{t('restock.ingredient')}</th>
                              <th className="px-6 py-4">{t('restock.quantity')}</th>
                              <th className="px-6 py-4">{t('restock.urgency')}</th>
                              <th className="px-6 py-4">{t('restock.status')}</th>
                              <th className="px-6 py-4">{t('restock.created')}</th>
                              <th className="px-6 py-4 text-right">{t('restock.reviewedBy')}</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                           {requestsLoading && (
                              <tr><td colSpan={6} className="p-8 text-center text-gray-500">{t('common.loading')}</td></tr>
                           )}
                           {!requestsLoading && (!myRequests || myRequests.length === 0) && (
                              <tr><td colSpan={6} className="p-8 text-center text-gray-500">No requests found.</td></tr>
                           )}
                           {myRequests?.map((req) => (
                              <tr key={req.id} className="hover:bg-white/5 transition-colors">
                                 <td className="px-6 py-4">
                                    <span className="font-bold text-white block">{req.ingredient?.name || 'Unknown'}</span>
                                    <span className="text-xs text-gray-500 truncate block max-w-[150px]">{req.reason}</span>
                                 </td>
                                 <td className="px-6 py-4 text-gray-300">
                                    {req.requested_quantity}
                                    <span className="text-xs text-gray-500">{req.ingredient?.units?.abbreviation || req.ingredient?.unit_type}</span>
                                 </td>
                                 <td className="px-6 py-4">
                                    <span className={cn("text-xs px-2 py-1 rounded border capitalize", getUrgencyColor(req.urgency))}>
                                       {t(`restock.urgencyLevels.${req.urgency}` as any)}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4">
                                    {getStatusBadge(req.status)}
                                 </td>
                                 <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                                    {new Date(req.created_at).toLocaleDateString()}
                                 </td>
                                 <td className="px-6 py-4 text-right text-gray-400">
                                    {req.reviewed_by ? (
                                       <div className="flex items-center justify-end gap-1 text-xs">
                                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                                          {req.reviewer?.full_name || 'Manager'}
                                       </div>
                                    ) : (
                                       <span className="text-gray-600">-</span>
                                    )}
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </CardContent>
               </Card>
            </div>

         </div>
      </DashboardLayout>
   );
};

export default KitchenRestockRequests;
