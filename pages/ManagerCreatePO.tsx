
import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Input, Button, cn, showToast } from '../components/ui';
import { Truck, Calendar, Plus, Trash2, Save, Send, ShoppingBag, DollarSign, Package } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../AuthContext';
import { Ingredient, Supplier } from '../types';

interface POItemRow {
   id: string; // Temp local ID
   ingredientId: string;
   qty: number;
   unit: string;
   price: number;
}

const ManagerCreatePO: React.FC = () => {
   const { t } = useLanguage();
   const { user } = useAuth();
   const queryClient = useQueryClient();
   const location = useLocation();
   const navigate = useNavigate();
   const editingPO = location.state?.editPO as any; // Using any to avoid strict type checks for now

   // State
   const [supplierId, setSupplierId] = useState(editingPO?.supplier_id || '');
   const [deliveryDate, setDeliveryDate] = useState(() => {
      if (editingPO?.expected_delivery) return editingPO.expected_delivery.split('T')[0];
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return d.toISOString().split('T')[0];
   });
   const [items, setItems] = useState<POItemRow[]>(() => {
      if (editingPO?.items) {
         return editingPO.items.map((i: any) => ({
            id: crypto.randomUUID(),
            ingredientId: i.ingredient_id || '',
            qty: i.ordered_quantity,
            unit: i.ingredient?.unit_type || '-',
            price: i.unit_price || 0
         }));
      }
      return [{ id: crypto.randomUUID(), ingredientId: '', qty: 1, unit: '-', price: 0 }];
   });

   const { data: suppliers } = useQuery({
      queryKey: ['suppliers'],
      queryFn: async () => {
         const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .eq('is_active', true);
         if (error) {
            console.warn("Suppliers fetch error:", error);
            return [];
         }
         return data as Supplier[];
      }
   });

   // Fetch Ingredients
   const { data: ingredients } = useQuery({
      queryKey: ['ingredients-all'],
      queryFn: async () => {
         const { data, error } = await supabase
            .from('ingredients')
            .select('*')
            .eq('is_active', true)
            .order('name');
         if (error) return [];
         return data as Ingredient[];
      }
   });

   // Filter Ingredients by Supplier (Optional logic based on requirements)
   const filteredIngredients = ingredients?.filter(ing =>
      !supplierId || !ing.supplier_id || ing.supplier_id === supplierId
   ) || [];

   // Actions
   const addItem = () => {
      setItems([...items, { id: crypto.randomUUID(), ingredientId: '', qty: 1, unit: '-', price: 0 }]);
   };

   const removeItem = (id: string) => {
      if (items.length > 1) {
         setItems(items.filter(i => i.id !== id));
      }
   };

   const updateItem = (id: string, field: keyof POItemRow, value: any) => {
      setItems(items.map(row => {
         if (row.id === id) {
            const updated = { ...row, [field]: value };
            // Auto-fill defaults when ingredient changes
            if (field === 'ingredientId') {
               const ing = ingredients?.find(i => i.id === value);
               if (ing) {
                  updated.unit = ing.unit_type;
                  updated.price = ing.cost_per_unit || 0;
               }
            }
            return updated;
         }
         return row;
      }));
   };

   // Calculations
   const totalAmount = items.reduce((sum, item) => sum + (item.qty * item.price), 0);

   // Submit Mutation
   const { mutate: createPO, isPending } = useMutation({
      mutationFn: async (isDraft: boolean) => {
         if (!user || !supplierId) throw new Error("Missing supplier or user");

         const validItems = items.filter(i => i.ingredientId && i.qty > 0);
         if (validItems.length === 0) throw new Error("Please add at least one valid item");

         let poId = editingPO?.id;

         if (poId) {
            // UDPATE existing PO
            const { error: updateError } = await supabase
               .from('purchase_orders')
               .update({
                  supplier_id: supplierId,
                  expected_delivery: deliveryDate,
                  total_amount: totalAmount,
                  status: isDraft ? 'draft' : 'pending_approval'
               })
               .eq('id', poId);

            if (updateError) throw updateError;

            // Delete old items and re-insert (simplest for now)
            await supabase.from('purchase_order_items').delete().eq('po_id', poId);
         } else {
            // CREATE new PO
            const seq = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            const po_number = `PO-${new Date().getFullYear()}-${seq}`;

            const { data: po, error: poError } = await supabase
               .from('purchase_orders')
               .insert({
                  po_number,
                  supplier_id: supplierId,
                  expected_delivery: deliveryDate,
                  total_amount: totalAmount,
                  status: isDraft ? 'draft' : 'pending',
                  created_by: user.id
               })
               .select()
               .single();

            if (poError) throw poError;
            poId = po.id;
         }

         // Insert Items
         const poItems = validItems.map(row => ({
            po_id: poId,
            ingredient_id: row.ingredientId,
            ordered_quantity: row.qty,
            unit_price: row.price
         }));

         const { error: itemsError } = await supabase.from('purchase_order_items').insert(poItems);
         if (itemsError) throw itemsError;

         // Log the action
         await supabase.from('po_activity_log').insert({
            po_id: poId,
            action_type: poId ? (isDraft ? 'created' : 'submitted') : (isDraft ? 'created' : 'submitted'), // Simplified log type for now
            performed_by: user.id,
            notes: isDraft ? 'Draft saved' : 'Submitted for Owner approval'
         });
      },
      onSuccess: () => {
         showToast(t('po.success'), 'success');
         if (editingPO) {
            navigate('/pending-po');
         } else {
            // Reset
            setSupplierId('');
            setItems([{ id: crypto.randomUUID(), ingredientId: '', qty: 1, unit: '-', price: 0 }]);
         }
      },
      onError: (err: any) => showToast(err.message, 'error')
   });

   return (
      <DashboardLayout title={t('po.title')} subtitle={t('po.subtitle')}>
         <div className="space-y-6 animate-in fade-in duration-500 pb-20">

            {/* Header Section */}
            <Card className="bg-[#1A1A1A] border-gray-800">
               <CardHeader>
                  <CardTitle className="text-white flex items-center gap-2">
                     <Truck className="w-5 h-5 text-blue-500" /> Order Details
                  </CardTitle>
               </CardHeader>
               <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">{t('po.supplier')}</label>
                        <select
                           className="w-full h-12 bg-black/20 border border-gray-800 rounded-lg text-sm px-3 text-white focus:outline-none focus:border-blue-500/50 appearance-none"
                           value={supplierId}
                           onChange={(e) => setSupplierId(e.target.value)}
                        >
                           <option value="">{t('po.selectSupplier')}</option>
                           {suppliers?.map(s => (
                              <option key={s.id} value={s.id}>{s.name}</option>
                           ))}
                        </select>
                     </div>
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">{t('po.deliveryDate')}</label>
                        <div className="relative">
                           <Calendar className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
                           <Input
                              type="date"
                              value={deliveryDate}
                              onChange={(e) => setDeliveryDate(e.target.value)}
                              className="pl-10 bg-black/20 border-gray-800 h-12"
                           />
                        </div>
                     </div>
                  </div>
               </CardContent>
            </Card>

            {/* Items Section */}
            <Card className="bg-[#1A1A1A] border-gray-800 overflow-hidden">
               <CardHeader className="bg-black/20 border-b border-gray-800 flex flex-row items-center justify-between py-4">
                  <CardTitle className="text-white flex items-center gap-2">
                     <ShoppingBag className="w-5 h-5 text-primary" /> {t('po.items')}
                  </CardTitle>
                  <Button size="sm" variant="outline" onClick={addItem} className="border-gray-700 hover:bg-gray-800">
                     <Plus className="w-4 h-4 mr-2" /> {t('po.addItem')}
                  </Button>
               </CardHeader>
               <div className="overflow-x-auto">
                  <table className="w-full text-sm text-left">
                     <thead className="text-xs text-gray-500 uppercase bg-black/20 border-b border-gray-800">
                        <tr>
                           <th className="px-6 py-4 w-1/3">{t('po.ingredient')}</th>
                           <th className="px-6 py-4 w-24">{t('po.qty')}</th>
                           <th className="px-6 py-4 w-20">{t('stock.unit')}</th>
                           <th className="px-6 py-4 w-32">{t('po.unitPrice')}</th>
                           <th className="px-6 py-4 w-32 text-right">{t('po.subtotal')}</th>
                           <th className="px-6 py-4 w-16"></th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-gray-800">
                        {items.map((row, index) => (
                           <tr key={row.id} className="hover:bg-white/5 transition-colors">
                              <td className="px-6 py-3">
                                 <select
                                    className="w-full h-10 bg-black/20 border border-gray-700 rounded px-2 text-white focus:outline-none focus:border-primary/50 text-sm"
                                    value={row.ingredientId}
                                    onChange={(e) => updateItem(row.id, 'ingredientId', e.target.value)}
                                 >
                                    <option value="">{t('po.selectIngredient')}</option>
                                    {filteredIngredients.map(ing => (
                                       <option key={ing.id} value={ing.id}>{ing.name}</option>
                                    ))}
                                 </select>
                              </td>
                              <td className="px-6 py-3">
                                 <Input
                                    type="number"
                                    className="h-10 bg-black/20 border-gray-700"
                                    value={row.qty}
                                    onChange={(e) => updateItem(row.id, 'qty', parseFloat(e.target.value) || 0)}
                                    min="1"
                                 />
                              </td>
                              <td className="px-6 py-3 text-gray-400 font-medium">
                                 {row.unit}
                              </td>
                              <td className="px-6 py-3">
                                 <div className="relative">
                                    <span className="absolute left-2 top-2.5 text-gray-500 text-xs">$</span>
                                    <Input
                                       type="number"
                                       className="h-10 pl-5 bg-black/20 border-gray-700"
                                       value={row.price}
                                       onChange={(e) => updateItem(row.id, 'price', parseFloat(e.target.value) || 0)}
                                       min="0"
                                    />
                                 </div>
                              </td>
                              <td className="px-6 py-3 text-right font-mono text-white font-bold">
                                 {(row.qty * row.price).toLocaleString()}
                              </td>
                              <td className="px-6 py-3 text-center">
                                 {items.length > 1 && (
                                    <button onClick={() => removeItem(row.id)} className="text-gray-500 hover:text-red-500 transition-colors">
                                       <Trash2 className="w-4 h-4" />
                                    </button>
                                 )}
                              </td>
                           </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
            </Card>

            {/* Footer Actions */}
            <div className="fixed bottom-0 left-0 md:left-[280px] right-0 p-4 bg-[#111] border-t border-gray-800 z-40 flex flex-col md:flex-row justify-between items-center gap-4 shadow-2xl">
               <div className="flex flex-col md:flex-row items-center gap-2 md:gap-6">
                  <span className="text-gray-400 uppercase text-xs font-bold tracking-wider">{t('po.total')}</span>
                  <span className="text-2xl md:text-3xl font-bold text-primary font-mono">ETB {totalAmount.toLocaleString()}</span>
               </div>

               <div className="flex gap-3 w-full md:w-auto flex-shrink-0">
                  <Button
                     variant="outline"
                     className="flex-1 md:flex-none border-gray-600 text-gray-300 hover:text-white hover:bg-gray-800"
                     onClick={() => createPO(true)}
                     disabled={isPending || !supplierId}
                  >
                     <Save className="w-4 h-4 mr-2" /> Save Draft
                  </Button>
                  <Button
                     className="flex-1 md:flex-none bg-yellow-600 hover:bg-yellow-700 text-white font-bold"
                     onClick={() => createPO(false)}
                     disabled={isPending || !supplierId}
                  >
                     <Send className="w-4 h-4 mr-2" /> Submit for Approval
                  </Button>
               </div>
            </div>

         </div>
      </DashboardLayout>
   );
};

export default ManagerCreatePO;
