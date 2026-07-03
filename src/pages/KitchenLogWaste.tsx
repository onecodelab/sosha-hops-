import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useLayoutConfig } from '../contexts/LayoutContext';
import { Card, CardContent, CardHeader, CardTitle, Input, Button, cn, showToast } from '../components/ui';
import { Trash2, Search, AlertTriangle, Calendar, DollarSign, History, Check, X, Loader2, Info } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Ingredient, WasteCategory, WasteLog } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '../contexts/BranchContext';

const KitchenLogWaste: React.FC = () => {
   const { t } = useLanguage();
   const { user } = useAuth();
   const { activeBranchId } = useBranch();
   const queryClient = useQueryClient();

   // Form State
   const [searchTerm, setSearchTerm] = useState('');
   const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
   const [quantity, setQuantity] = useState<string>('');
   const [category, setCategory] = useState<WasteCategory>('spoiled');
   const [reason, setReason] = useState('');
   const [isDropdownOpen, setIsDropdownOpen] = useState(false);
   const [selectedUnitId, setSelectedUnitId] = useState<string>('');

   // Fetch All Units for Selection
   const { data: allUnits } = useQuery({
      queryKey: ['units'],
      queryFn: async () => {
         const { data, error } = await supabase.from('units').select('*').order('name');
         if (error) return [];
         return data;
      }
   });

   // Auto-select ingredient's base unit
   React.useEffect(() => {
      if (selectedIngredient) {
         setSelectedUnitId(selectedIngredient.unit_id || '');
      } else {
         setSelectedUnitId('');
      }
   }, [selectedIngredient]);

   // Fetch Ingredients
   const { data: ingredients } = useQuery({
      queryKey: ['kitchen-ingredients', activeBranchId],
      queryFn: async () => {
         const { data, error } = await supabase
            .from('ingredients')
            .select(`
          *,
          units(id, abbreviation),
          branch_inventory!inner(current_stock)
        `)
            .eq('is_active', true)
            .eq('branch_inventory.branch_id', activeBranchId)
            .order('name');
         if (error) return [];
         return data.map(item => ({
            ...item,
            current_stock: item.branch_inventory?.[0]?.current_stock || 0
         })) as Ingredient[];
      }
   });

   // Fetch Recent Waste Logs
   const { data: recentLogs, isLoading: logsLoading } = useQuery({
      queryKey: ['waste_logs', activeBranchId],
      queryFn: async () => {
         const { data, error } = await supabase
            .from('waste_logs')
            .select(`
          *,
          ingredient:ingredients(name, unit_id, weight_per_unit, units(abbreviation)),
          unit:units!waste_logs_unit_id_fkey(abbreviation)
        `)
            .eq('branch_id', activeBranchId)
            .order('created_at', { ascending: false })
            .limit(10);

         if (error) {
            console.warn("Waste logs table might be missing:", error);
            return [];
         }
         return data as WasteLog[];
      }
   });

   // Filter Ingredients for Dropdown
   const filteredIngredients = useMemo(() => {
      if (!ingredients) return [];
      if (!searchTerm) return ingredients;
      const lower = searchTerm.toLowerCase();
      return ingredients.filter(i =>
         i.name.toLowerCase().includes(lower) ||
         i.sku.toLowerCase().includes(lower)
      );
   }, [ingredients, searchTerm]);

   // Submit Mutation
   const { mutate: submitWaste, isPending } = useMutation({
      mutationFn: async () => {
         if (!selectedIngredient || !user) throw new Error("Missing required data");

         const qtyNum = parseFloat(quantity);
         if (isNaN(qtyNum) || qtyNum <= 0) throw new Error("Invalid quantity");

         // Client-side conversion check (prevent submission if obviously over)
         const selectedUnit = allUnits?.find(u => u.id === selectedUnitId);
         const baseUnit = selectedIngredient.units;
         let normalizedQty = qtyNum;

         if (selectedUnit && baseUnit && selectedUnit.id !== baseUnit.id) {
            if (selectedUnit.type === baseUnit.type) {
               normalizedQty = (qtyNum * selectedUnit.base_factor) / baseUnit.base_factor;
            } else if (selectedUnit.type === 'count' && (baseUnit.type === 'mass' || baseUnit.type === 'volume')) {
               normalizedQty = (qtyNum * (selectedIngredient.weight_per_unit || 1)) / baseUnit.base_factor;
            } else if ((selectedUnit.type === 'mass' || selectedUnit.type === 'volume') && baseUnit.type === 'count') {
               normalizedQty = (qtyNum * selectedUnit.base_factor) / (selectedIngredient.weight_per_unit || 1);
            }
         }

         if (normalizedQty > (selectedIngredient.current_stock || 0)) {
            throw new Error(`Cannot waste more than current stock (${selectedIngredient.current_stock} ${baseUnit?.abbreviation || 'units'} available)`);
         }

         const { error } = await supabase.rpc('submit_waste_report', {
            p_ingredient_id: selectedIngredient.id,
            p_quantity: qtyNum,
            p_reason: category,
            p_notes: reason,
            p_unit_id: selectedUnitId
         });

         if (error) throw error;
      },
      onSuccess: () => {
         showToast(t('waste.success'), 'success');
         queryClient.invalidateQueries({ queryKey: ['waste_logs'] });
         queryClient.invalidateQueries({ queryKey: ['kitchen-ingredients'] });

         // Reset Form
         setSelectedIngredient(null);
         setSearchTerm('');
         setQuantity('');
         setReason('');
         setCategory('spoiled');
      },
      onError: (err: any) => {
         showToast(err.message || "Failed to log waste", 'error');
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

   const isFormValid = selectedIngredient && quantity && parseFloat(quantity) > 0 && reason.length >= 10;

   const wasteCategories: WasteCategory[] = ['spoiled', 'burnt', 'dropped', 'expired', 'overproduction', 'other'];

   useLayoutConfig({
      title: t('waste.title'),
      subtitle: t('waste.subtitle')
   });

   return (
      <>
         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-in fade-in duration-500">

            {/* Left Column: Form */}
            <div className="lg:col-span-1 space-y-6">
               <Card className="bg-[#1A1A1A] border-gray-800 border-l-4 border-l-red-500">
                  <CardHeader>
                     <CardTitle className="flex items-center gap-2 text-white">
                        <Trash2 className="w-5 h-5 text-red-500" /> {t('waste.title')}
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-5">

                     {/* Ingredient Search */}
                     <div className="space-y-2 relative">
                        <label className="text-xs font-bold text-gray-500 uppercase">{t('waste.selectIngredient')}</label>
                        <div className="relative">
                           <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                           <Input
                              value={searchTerm}
                              onChange={(e) => { setSearchTerm(e.target.value); setIsDropdownOpen(true); if (selectedIngredient && e.target.value !== selectedIngredient.name) setSelectedIngredient(null); }}
                              onFocus={() => setIsDropdownOpen(true)}
                              placeholder={t('waste.searchIngredient')}
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

                     {/* Quantity & Unit */}
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <label className="text-xs font-bold text-gray-500 uppercase">{t('waste.quantity')}</label>
                           <Input
                              type="number"
                              value={quantity}
                              onChange={(e) => setQuantity(e.target.value)}
                              placeholder="0.00"
                              className="bg-black/20 border-gray-800"
                           />
                        </div>
                        <div className="space-y-2">
                           <label className="text-xs font-bold text-gray-500 uppercase">{t('stock.unit')}</label>
                           <select
                              value={selectedUnitId}
                              onChange={(e) => setSelectedUnitId(e.target.value)}
                              className="w-full h-11 bg-black/20 border border-gray-800 rounded-lg px-3 text-sm text-white outline-none focus:border-red-500/50 appearance-none"
                              disabled={!selectedIngredient}
                           >
                              <option value="" disabled>Unit...</option>
                              {allUnits?.map(u => (
                                 <option key={u.id} value={u.id} className="bg-[#222]">
                                    {u.abbreviation} ({u.name})
                                 </option>
                              ))}
                           </select>
                        </div>
                     </div>

                     {/* Conversion Info / Warning */}
                     {selectedIngredient && selectedUnitId && selectedUnitId !== selectedIngredient.unit_id && (
                        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg animate-in fade-in slide-in-from-top-1">
                           <p className="text-[10px] text-blue-400 font-bold uppercase tracking-widest flex items-center gap-2">
                              <Info className="w-3 h-3" /> Unit Conversion Active
                           </p>
                           <p className="text-[11px] text-gray-400 mt-1">
                              Logging in <b>{allUnits?.find(u => u.id === selectedUnitId)?.abbreviation}</b>.
                              Inventory is tracked in <b>{selectedIngredient.units?.abbreviation}</b>.
                              {allUnits?.find(u => u.id === selectedUnitId)?.type !== selectedIngredient.units?.type && !selectedIngredient.weight_per_unit && (
                                 <span className="block text-amber-500 mt-1 font-bold">
                                    ⚠️ Warning: Weight per unit not set for this ingredient. Conversion might be inaccurate.
                                 </span>
                              )}
                           </p>
                        </div>
                     )}

                     {/* Category */}
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">{t('waste.category')}</label>
                        <div className="grid grid-cols-2 gap-2">
                           {wasteCategories.map(cat => (
                              <button
                                 key={cat}
                                 onClick={() => setCategory(cat)}
                                 className={cn(
                                    "text-xs py-2 px-2 rounded-lg border transition-all text-center capitalize truncate",
                                    category === cat
                                       ? "bg-red-500/20 text-red-400 border-red-500/50 font-bold"
                                       : "bg-black/20 border-gray-800 text-gray-400 hover:bg-white/5"
                                 )}
                              >
                                 {t(`waste.categories.${cat}` as any)}
                              </button>
                           ))}
                        </div>
                     </div>

                     {/* Reason */}
                     <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">{t('waste.reason')} <span className="text-red-500">*</span></label>
                        <textarea
                           value={reason}
                           onChange={(e) => setReason(e.target.value)}
                           placeholder="Explain why this item was wasted..."
                           className="w-full h-24 bg-black/20 border border-gray-800 rounded-lg p-3 text-sm text-white focus:outline-none focus:border-red-500/50 resize-none"
                        />
                        <p className={cn("text-[10px] text-right", reason.length < 10 ? "text-red-400" : "text-green-500")}>
                           {reason.length}/10 chars
                        </p>
                     </div>

                     <Button
                        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-12"
                        disabled={!isFormValid || isPending}
                        onClick={() => submitWaste()}
                     >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Trash2 className="w-4 h-4 mr-2" />}
                        {t('waste.submit')}
                     </Button>

                  </CardContent>
               </Card>
            </div>

            {/* Right Column: History */}
            <div className="lg:col-span-2">
               <Card className="bg-[#1A1A1A] border-gray-800 h-full flex flex-col min-h-[500px]">
                  <CardHeader className="border-b border-gray-800 pb-4">
                     <CardTitle className="text-white flex items-center gap-2">
                        <History className="w-5 h-5 text-gray-400" /> {t('waste.recentLogs')}
                     </CardTitle>
                  </CardHeader>
                  <CardContent className="p-0 flex-1 overflow-auto custom-scrollbar">
                     <table className="w-full text-sm text-left">
                        <thead className="text-[10px] text-muted uppercase bg-muted/10 border-b border-border font-black tracking-widest sticky top-0 backdrop-blur-md z-10">
                           <tr>
                              <th className="px-4 md:px-6 py-4 whitespace-nowrap">{t('waste.date')}</th>
                              <th className="px-4 md:px-6 py-4 whitespace-nowrap">{t('stock.name')}</th>
                              <th className="px-4 md:px-6 py-4 whitespace-nowrap">{t('waste.quantity')}</th>
                              <th className="px-4 md:px-6 py-4 whitespace-nowrap">Inventory Impact</th>
                              <th className="px-4 md:px-6 py-4 whitespace-nowrap">{t('waste.category')}</th>
                              <th className="px-4 md:px-6 py-4 whitespace-nowrap">{t('waste.reason')}</th>
                              <th className="px-4 md:px-6 py-4 text-right whitespace-nowrap">{t('waste.cost')}</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-800">
                           {logsLoading && (
                              <tr><td colSpan={7} className="p-8 text-center text-gray-500">{t('common.loading')}</td></tr>
                           )}
                           {!logsLoading && (!recentLogs || recentLogs.length === 0) && (
                              <tr><td colSpan={7} className="p-8 text-center text-gray-500">{t('stock.empty')}</td></tr>
                           )}
                           {recentLogs?.map((log) => (
                              <tr key={log.id} className="hover:bg-primary/5 transition-colors border-b border-border/40">
                                 <td className="px-4 md:px-6 py-4 text-muted font-mono text-xs whitespace-nowrap">
                                    {new Date(log.created_at).toLocaleDateString()} <span className="text-muted/60">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                 </td>
                                 <td className="px-4 md:px-6 py-4 font-black text-foreground whitespace-nowrap">
                                    {log.ingredient?.name || 'Unknown'}
                                 </td>
                                 <td className="px-4 md:px-6 py-4 text-[#D1D5DB] whitespace-nowrap">
                                    <span className="text-red-400 font-bold">-{log.quantity}</span> <span className="text-xs text-muted">{log.unit?.abbreviation || log.unit_type}</span>
                                 </td>
                                 <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                                    {(() => {
                                       if (log.inventory_impact) {
                                          return <span className="text-orange-400 font-mono">-{log.inventory_impact} <span className="text-[10px]">{log.ingredient?.units?.abbreviation}</span></span>;
                                       }
                                       // Fallback calculation in frontend
                                       const ingredient = log.ingredient;
                                       if (!ingredient || !ingredient.units) return '-';

                                       const logUnitAbbr = log.unit?.abbreviation || log.unit_type;
                                       if (logUnitAbbr === ingredient.units.abbreviation) {
                                          return <span className="text-orange-400 font-mono">-{log.quantity} <span className="text-[10px]">{ingredient.units.abbreviation}</span></span>;
                                       }

                                       // Simple estimate if conversion logic is needed but impact column isn't populated yet
                                       return <span className="text-orange-400/50 font-mono italic">Calculating...</span>;
                                    })()}
                                 </td>
                                 <td className="px-4 md:px-6 py-4 whitespace-nowrap">
                                    <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest">
                                       {t(`waste.categories.${log.waste_reason}` as any)}
                                    </span>
                                 </td>
                                 <td className="px-4 md:px-6 py-4 text-muted text-xs max-w-[200px] truncate whitespace-nowrap" title={log.notes || log.reason}>
                                    {log.notes || log.reason}
                                 </td>
                                 <td className="px-4 md:px-6 py-4 text-right font-mono text-[#D1D5DB] whitespace-nowrap">
                                    ETB {(log.cost_snapshot || log.cost || 0).toLocaleString()}
                                 </td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                  </CardContent>
               </Card>
            </div>

         </div>
      </>
   );
};

export default KitchenLogWaste;
