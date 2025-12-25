
import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../supabase';
import { useMenu } from '../hooks/useMenu';
import { Card, CardContent, Badge, Button, Input, cn, showToast } from '../components/ui';
import { Search, Plus, Edit3, Trash2, Utensils, Info } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { MenuEditorModal } from '../components/MenuEditorModal';
import { MenuItem } from '../types';

const MenuManagement: React.FC = () => {
  const { t } = useLanguage();
  const { menuItems, categories, loading: menuLoading, refreshMenu } = useMenu(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);

  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategoryId === 'all' || item.category_id === selectedCategoryId;
      return matchesSearch && matchesCategory;
    });
  }, [menuItems, searchTerm, selectedCategoryId]);

  const handleDelete = async (e: React.MouseEvent, menuItemId: string) => {
    e.stopPropagation();
    if (!confirm('Delete this dish? This cannot be undone.')) return;
    
    try {
      const { error } = await supabase
        .from('menu')
        .delete()
        .eq('id', menuItemId);
      
      if (error) {
        throw error;
      }
      
      showToast('Dish deleted successfully!', 'success');
      refreshMenu();
    } catch (err: any) {
      console.error('Error deleting dish:', err);
      showToast('Error deleting dish: ' + (err.message || String(err)), 'error');
    }
  };

  const handleEditClick = (e: React.MouseEvent, item: MenuItem) => {
    e.stopPropagation();
    setEditingItem(item);
    setIsModalOpen(true);
  };

  const handleAddClick = () => {
    setEditingItem(null);
    setIsModalOpen(true);
  };

  return (
    <DashboardLayout 
      title={t('menu.title')} 
      subtitle={t('menu.subtitle')}
      actions={
        <Button onClick={handleAddClick} className="bg-primary text-black font-bold hover:bg-primary/90">
           <Plus className="w-4 h-4 mr-2" /> Add New Dish
        </Button>
      }
    >
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        
        {/* Controls */}
        <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
          <div className="flex bg-[#1A1A1A] p-1 rounded-xl border border-gray-800 w-full md:w-auto overflow-x-auto custom-scrollbar">
            <button
              onClick={() => setSelectedCategoryId('all')}
              className={cn(
                "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap",
                selectedCategoryId === 'all' ? "bg-primary text-black" : "text-gray-500 hover:text-white"
              )}
            >
              All Items
            </button>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategoryId(cat.id)}
                className={cn(
                  "px-4 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap",
                  selectedCategoryId === cat.id ? "bg-primary text-black" : "text-gray-500 hover:text-white"
                )}
              >
                {cat.name}
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
                   <img 
                    src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80'} 
                    alt={item.name} 
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                   />
                   <div className="absolute top-2 right-2">
                      <Badge className={cn("text-[8px] font-black uppercase", item.is_available ? "bg-green-500 text-black" : "bg-red-500 text-white")}>
                        {item.is_available ? 'Available' : 'Out of Stock'}
                      </Badge>
                   </div>
                   <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent opacity-60" />
                   <div className="absolute bottom-3 left-3">
                      <p className="text-[10px] font-black text-primary uppercase tracking-widest">{item.category_name}</p>
                   </div>
                </div>
                <CardContent className="p-4 flex-1 flex flex-col justify-between">
                   <div>
                      <h3 className="font-bold text-white mb-1 group-hover:text-primary transition-colors line-clamp-1">{item.name}</h3>
                      <p className="text-xl font-black text-white font-mono">ETB {item.price.toLocaleString()}</p>
                   </div>
                   <div className="pt-4 flex gap-2">
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex-1 bg-white/5 border-white/5 text-gray-400 hover:text-white"
                        onClick={(e) => handleEditClick(e, item)}
                      >
                         <Edit3 className="w-4 h-4 mr-2" /> {t('common.edit')}
                      </Button>
                      <button 
                        className="w-10 h-9 flex items-center justify-center rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20 transition-colors"
                        onClick={(e) => handleDelete(e, item.id)}
                      >
                         <Trash2 className="w-4 h-4" />
                      </button>
                   </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Unified Editor Modal */}
        <MenuEditorModal 
          isOpen={isModalOpen}
          editingItem={editingItem}
          onClose={() => { setIsModalOpen(false); setEditingItem(null); }}
          onSuccess={() => refreshMenu()}
        />

      </div>
    </DashboardLayout>
  );
};

export default MenuManagement;
