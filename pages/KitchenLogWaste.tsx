
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Input, Button, cn, showToast } from '../components/ui';
import { Trash2, Search, AlertTriangle, Calendar, DollarSign, History, Check, X, Loader2 } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Ingredient, WasteCategory, WasteLog } from '../types';
import { useAuth } from '../AuthContext';

const KitchenLogWaste: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Form State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedIngredient, setSelectedIngredient] = useState<Ingredient | null>(null);
  const [quantity, setQuantity] = useState<string>('');
  const [category, setCategory] = useState<WasteCategory>('spoiled');
  const [reason, setReason] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Fetch Ingredients
  const { data: ingredients } = useQuery({
    queryKey: ['kitchen-ingredients'],
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

  // Fetch Recent Waste Logs
  const { data: recentLogs, isLoading: logsLoading } = useQuery({
    queryKey: ['waste_logs'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waste_logs')
        .select(`
          *,
          ingredient:ingredients(name, unit_type)
        `)
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

      // Calculate cost
      const cost = (selectedIngredient.cost_per_unit || 0) * qtyNum;

      const { error } = await supabase
        .from('waste_logs')
        .insert({
          ingredient_id: selectedIngredient.id,
          quantity: qtyNum,
          waste_category: category,
          reason: reason,
          cost: cost,
          logged_by: user.id
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

  return (
    <DashboardLayout title={t('waste.title')} subtitle={t('waste.subtitle')}>
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
                          onChange={(e) => { setSearchTerm(e.target.value); setIsDropdownOpen(true); if(selectedIngredient && e.target.value !== selectedIngredient.name) setSelectedIngredient(null); }}
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
                                <span className="text-xs text-gray-400 bg-black/40 px-2 py-1 rounded">{(ing.current_stock || 0).toLocaleString()} {ing.unit_type}</span>
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
                       <div className="h-11 flex items-center px-3 bg-black/10 border border-gray-800 rounded-lg text-gray-400 text-sm">
                          {selectedIngredient?.unit_type || '-'}
                       </div>
                    </div>
                 </div>

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
                    <thead className="text-xs text-gray-500 uppercase bg-black/20 border-b border-gray-800 sticky top-0 backdrop-blur-md z-10">
                       <tr>
                          <th className="px-6 py-4">{t('waste.date')}</th>
                          <th className="px-6 py-4">{t('stock.name')}</th>
                          <th className="px-6 py-4">{t('waste.quantity')}</th>
                          <th className="px-6 py-4">{t('waste.category')}</th>
                          <th className="px-6 py-4">{t('waste.reason')}</th>
                          <th className="px-6 py-4 text-right">{t('waste.cost')}</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                       {logsLoading && (
                          <tr><td colSpan={6} className="p-8 text-center text-gray-500">{t('common.loading')}</td></tr>
                       )}
                       {!logsLoading && (!recentLogs || recentLogs.length === 0) && (
                          <tr><td colSpan={6} className="p-8 text-center text-gray-500">{t('stock.empty')}</td></tr>
                       )}
                       {recentLogs?.map((log) => (
                          <tr key={log.id} className="hover:bg-white/5 transition-colors">
                             <td className="px-6 py-4 text-gray-400 font-mono text-xs">
                                {new Date(log.created_at).toLocaleDateString()} <span className="text-gray-600">{new Date(log.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                             </td>
                             <td className="px-6 py-4 font-bold text-white">
                                {log.ingredient?.name || 'Unknown'}
                             </td>
                             <td className="px-6 py-4 text-gray-300">
                                <span className="text-red-400 font-bold">-{log.quantity}</span> <span className="text-xs text-gray-500">{log.ingredient?.unit_type}</span>
                             </td>
                             <td className="px-6 py-4">
                                <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-1 rounded text-xs capitalize">
                                   {t(`waste.categories.${log.waste_category}` as any)}
                                </span>
                             </td>
                             <td className="px-6 py-4 text-gray-400 text-xs max-w-[200px] truncate" title={log.reason}>
                                {log.reason}
                             </td>
                             <td className="px-6 py-4 text-right font-mono text-gray-300">
                                ETB {(log.cost || 0).toLocaleString()}
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

export default KitchenLogWaste;
