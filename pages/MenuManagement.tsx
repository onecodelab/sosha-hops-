
import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../supabase';
import { useMenu } from '../hooks/useMenu';
import { Card, CardContent, CardHeader, CardTitle, Badge, Button, Input, cn, showToast, Dialog } from '../components/ui';
import { Search, Plus, Edit3, Trash2, Utensils, Info, Check, X, ChefHat } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { RecipeEditor } from '../components/RecipeEditor';
import { MenuItem } from '../types';

const MenuManagement: React.FC = () => {
  const { t } = useLanguage();
  const { menuItems, categories, loading: menuLoading, refreshMenu } = useMenu(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [activeTab, setActiveTab] = useState<'basic' | 'recipe'>('basic');

  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menuItems, searchTerm, selectedCategory]);

  const handleUpdateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;

    try {
      const { error } = await supabase
        .from('menu')
        .update({
          name: editingItem.name,
          price: editingItem.price,
          category: editingItem.category,
          is_available: editingItem.is_available
        })
        .eq('id', editingItem.id);

      if (error) throw error;
      showToast("Menu item updated successfully!", "success");
      refreshMenu();
      setEditingItem(null);
    } catch (err: any) {
      showToast(err.message, "error");
    }
  };

  return (
    <DashboardLayout title={t('menu.title')} subtitle={t('menu.subtitle')}>
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        
        {/* Controls */}
        <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
          <div className="flex bg-[#1A1A1A] p-1 rounded-xl border border-gray-800 w-full md:w-auto overflow-x-auto">
            <button
              onClick={() => setSelectedCategory('All')}
              className={cn(
                "px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap",
                selectedCategory === 'All' ? "bg-primary text-black" : "text-gray-400 hover:text-white"
              )}
            >
              All Items
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-4 py-2 text-xs font-bold rounded-lg transition-all whitespace-nowrap",
                  selectedCategory === cat ? "bg-primary text-black" : "text-gray-400 hover:text-white"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
            <Input 
              placeholder="Search dishes..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-[#111] border-gray-800 focus:border-primary/50 h-10"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {menuLoading ? (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-primary gap-4">
              <Utensils className="w-12 h-12 animate-bounce" />
              <p className="font-bold uppercase tracking-widest text-xs">Syncing Catalog...</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="col-span-full py-20 text-center text-gray-500">
               <Info className="w-12 h-12 mx-auto mb-4 opacity-20" />
               <p>No menu items found.</p>
            </div>
          ) : (
            filteredItems.map(item => (
              <Card key={item.id} className="bg-[#1A1A1A] border-gray-800 hover:border-primary/30 transition-all group overflow-hidden flex flex-col">
                <div className="h-40 overflow-hidden relative">
                   <img src={item.image_url} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                   <div className="absolute top-2 right-2">
                      <Badge className={cn("text-[8px] font-black uppercase", item.is_available ? "bg-green-500 text-black" : "bg-red-500 text-white")}>
                        {item.is_available ? 'Available' : 'Out of Stock'}
                      </Badge>
                   </div>
                   <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-60" />
                   <div className="absolute bottom-3 left-3">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">{item.category}</p>
                   </div>
                </div>
                <CardContent className="p-4 flex-1 flex flex-col justify-between">
                   <div>
                      <h3 className="font-bold text-white mb-1 group-hover:text-primary transition-colors">{item.name}</h3>
                      <p className="text-xl font-black text-white font-mono">ETB {item.price.toLocaleString()}</p>
                   </div>
                   <div className="pt-4 flex gap-2">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex-1 bg-white/5 border-white/5 text-gray-400 hover:text-white"
                        onClick={() => { setEditingItem(item); setActiveTab('basic'); }}
                      >
                         <Edit3 className="w-4 h-4 mr-2" /> {t('common.edit')}
                      </Button>
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="bg-primary/10 text-primary border-primary/20 hover:bg-primary/20"
                        onClick={() => { setEditingItem(item); setActiveTab('recipe'); }}
                      >
                         <ChefHat className="w-4 h-4" />
                      </Button>
                   </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Editor Modal */}
        <Dialog 
          isOpen={!!editingItem} 
          onClose={() => setEditingItem(null)} 
          title={activeTab === 'recipe' ? `${t('menu.recipe')}: ${editingItem?.name}` : t('menu.editItem')}
        >
           <div className="space-y-6">
              {/* Tabs */}
              <div className="flex bg-black/40 p-1 rounded-xl border border-gray-800">
                 <button 
                   onClick={() => setActiveTab('basic')}
                   className={cn(
                     "flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all",
                     activeTab === 'basic' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                   )}
                 >
                    {t('menu.basicInfo')}
                 </button>
                 <button 
                   onClick={() => setActiveTab('recipe')}
                   className={cn(
                     "flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all",
                     activeTab === 'recipe' ? "bg-white/10 text-white" : "text-gray-500 hover:text-gray-300"
                   )}
                 >
                    {t('menu.recipe')}
                 </button>
              </div>

              {activeTab === 'basic' && editingItem ? (
                 <form onSubmit={handleUpdateItem} className="space-y-4 pt-2">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('menu.itemName')}</label>
                       <Input 
                         value={editingItem.name} 
                         onChange={e => setEditingItem({...editingItem, name: e.target.value})}
                         className="bg-black/20 border-gray-800"
                       />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('menu.price')} (ETB)</label>
                          <Input 
                            type="number"
                            value={editingItem.price} 
                            onChange={e => setEditingItem({...editingItem, price: parseFloat(e.target.value) || 0})}
                            className="bg-black/20 border-gray-800 font-mono text-primary font-bold"
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{t('menu.category')}</label>
                          <Input 
                            value={editingItem.category} 
                            onChange={e => setEditingItem({...editingItem, category: e.target.value})}
                            className="bg-black/20 border-gray-800"
                          />
                       </div>
                    </div>
                    <div className="flex items-center gap-3 p-4 bg-black/20 border border-gray-800 rounded-xl">
                       <button 
                         type="button"
                         onClick={() => setEditingItem({...editingItem, is_available: !editingItem.is_available})}
                         className={cn(
                           "w-12 h-6 rounded-full transition-all relative",
                           editingItem.is_available ? "bg-green-600" : "bg-gray-700"
                         )}
                       >
                          <div className={cn(
                            "absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform",
                            editingItem.is_available ? "translate-x-6" : "translate-x-0"
                          )} />
                       </button>
                       <span className="text-sm font-bold text-gray-300">{t('menu.available')}</span>
                    </div>
                    <div className="pt-4 flex gap-3">
                       <Button type="button" variant="ghost" className="flex-1" onClick={() => setEditingItem(null)}>Cancel</Button>
                       <Button type="submit" className="flex-1 bg-primary text-black font-black">Save Changes</Button>
                    </div>
                 </form>
              ) : (
                 <RecipeEditor menuItem={editingItem!} />
              )}
           </div>
        </Dialog>

      </div>
    </DashboardLayout>
  );
};

export default MenuManagement;
