
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Input, Button, Badge, cn } from '../components/ui';
import { Search, Filter, ArrowUpDown, Package, AlertTriangle, CheckCircle2, AlertOctagon, RefreshCw, ShoppingBag } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { Ingredient } from '../types';

type SortField = 'name' | 'current_stock';
type SortOrder = 'asc' | 'desc';

const KitchenStockView: React.FC = () => {
  const { t } = useLanguage();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Fetch ingredients
  /** Added explicit type to useQuery to fix unknown issues **/
  const { data: ingredients, isLoading, refetch } = useQuery<Ingredient[]>({
    queryKey: ['kitchen-stock'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ingredients')
        .select(`
          *,
          supplier:suppliers(name)
        `)
        .eq('is_active', true);
        
      if (error) {
        // Fallback for demo if table doesn't exist yet
        console.warn("Ingredients fetch error (table might not exist yet):", error);
        return [];
      }
      return data as Ingredient[];
    }
  });

  // Extract unique categories
  /** Added explicit type to useMemo to fix unknown issues **/
  const categories = useMemo<string[]>(() => {
    if (!ingredients) return ['All'];
    // Fix: Explicitly type the Set as string to ensure return type is string[]
    const cats = new Set<string>(ingredients.map(i => i.category).filter(Boolean));
    return ['All', ...Array.from(cats).sort()];
  }, [ingredients]);

  // Filter and Sort Logic
  const processedData = useMemo(() => {
    if (!ingredients) return [];

    let result = [...ingredients];

    // Filter
    if (searchTerm) {
      const lowerSearch = searchTerm.toLowerCase();
      result = result.filter(i => 
        i.name.toLowerCase().includes(lowerSearch) || 
        i.sku.toLowerCase().includes(lowerSearch)
      );
    }

    if (categoryFilter !== 'All') {
      result = result.filter(i => i.category === categoryFilter);
    }

    // Sort
    result.sort((a, b) => {
      const valA = a[sortField];
      const valB = b[sortField];
      
      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  }, [ingredients, searchTerm, categoryFilter, sortField, sortOrder]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const getStatusBadge = (item: Ingredient) => {
    if (item.current_stock < (item.par_min * 0.5)) {
      return (
        <Badge variant="destructive" className="bg-red-500/10 text-red-500 border-red-500/20 flex items-center gap-1 w-fit">
          <AlertOctagon className="w-3 h-3" /> {t('stock.statusCritical')}
        </Badge>
      );
    } else if (item.current_stock < item.par_min) {
      return (
        <Badge variant="warning" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20 flex items-center gap-1 w-fit">
          <AlertTriangle className="w-3 h-3" /> {t('stock.statusLow')}
        </Badge>
      );
    }
    return (
      <Badge variant="success" className="bg-green-500/10 text-green-500 border-green-500/20 flex items-center gap-1 w-fit">
        <CheckCircle2 className="w-3 h-3" /> {t('stock.statusOk')}
      </Badge>
    );
  };

  return (
    <DashboardLayout title={t('nav.stock')} subtitle="Manage kitchen inventory and supplies">
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Controls */}
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-end">
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto flex-1">
            <div className="relative w-full md:w-72">
               <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
               <Input 
                 placeholder={t('stock.searchPlaceholder')} 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="pl-9 bg-black/20 border-gray-800"
               />
            </div>
            
            <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0">
               <Filter className="w-4 h-4 text-gray-500" />
               <select 
                 className="bg-black/20 border border-gray-800 rounded-lg text-sm px-3 py-2 text-white focus:outline-none focus:border-primary/50"
                 value={categoryFilter}
                 onChange={(e) => setCategoryFilter(e.target.value)}
               >
                 {categories.map(cat => (
                   /** cat is now correctly typed as string **/
                   <option key={cat} value={cat}>{cat === 'All' ? t('stock.allCategories') : cat}</option>
                 ))}
               </select>
            </div>
          </div>

          <Button variant="outline" onClick={() => refetch()} className="border-gray-800 hover:bg-white/5">
             <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} /> {t('common.retry')}
          </Button>
        </div>

        {/* Inventory Table */}
        <Card className="bg-[#1A1A1A] border-gray-800 min-h-[500px] flex flex-col">
           <CardHeader className="border-b border-gray-800 pb-3">
              <CardTitle className="text-white flex items-center gap-2 text-base">
                 <Package className="w-5 h-5 text-primary" /> {t('nav.inventory')}
                 <span className="text-xs font-normal text-gray-500 ml-2">
                    {processedData.length} items
                 </span>
              </CardTitle>
           </CardHeader>
           <CardContent className="p-0 flex-1 overflow-x-auto">
              <table className="w-full text-sm text-left">
                 <thead className="text-xs text-gray-500 uppercase bg-black/40 border-b border-gray-800">
                    <tr>
                       <th className="px-6 py-4 font-bold">{t('stock.sku')}</th>
                       <th className="px-6 py-4">
                          <button onClick={() => toggleSort('name')} className="flex items-center gap-1 hover:text-white font-bold">
                             {t('stock.name')} <ArrowUpDown className="w-3 h-3" />
                          </button>
                       </th>
                       <th className="px-6 py-4 font-bold">{t('stock.category')}</th>
                       <th className="px-6 py-4">
                          <button onClick={() => toggleSort('current_stock')} className="flex items-center gap-1 hover:text-white font-bold">
                             {t('stock.currentStock')} <ArrowUpDown className="w-3 h-3" />
                          </button>
                       </th>
                       <th className="px-6 py-4 font-bold">{t('stock.unit')}</th>
                       <th className="px-6 py-4 font-bold">{t('stock.status')}</th>
                       <th className="px-6 py-4 font-bold">{t('stock.supplier')}</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-800">
                    {isLoading && (
                       <tr><td colSpan={7} className="p-8 text-center text-gray-500">{t('common.loading')}</td></tr>
                    )}
                    {!isLoading && processedData.length === 0 && (
                       <tr><td colSpan={7} className="p-8 text-center text-gray-500">
                          <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-20" />
                          {t('stock.empty')}
                       </td></tr>
                    )}
                    {processedData.map((item) => (
                       <tr key={item.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 font-mono text-gray-400">{item.sku}</td>
                          <td className="px-6 py-4 font-bold text-white">{item.name}</td>
                          <td className="px-6 py-4 text-gray-300">
                             <span className="bg-gray-800 px-2 py-1 rounded text-xs border border-gray-700">{item.category}</span>
                          </td>
                          <td className="px-6 py-4 text-white font-mono text-base">{item.current_stock}</td>
                          <td className="px-6 py-4 text-gray-400">{item.unit_type}</td>
                          <td className="px-6 py-4">
                             {getStatusBadge(item)}
                          </td>
                          <td className="px-6 py-4 text-blue-400">{item.supplier?.name || '-'}</td>
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

export default KitchenStockView;
