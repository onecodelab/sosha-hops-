
import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../supabase';
import { useMenu } from '../hooks/useMenu';
import { Card, CardContent, Badge, Button, Input, cn, showToast, Dialog } from '../components/ui';
import { Search, Plus, Edit3, Trash2, Utensils, Info, BookOpen, Loader2, ChefHat } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { MenuDish } from '../types';
import { RecipeEditor } from '../components/RecipeEditor';

const MenuManagement: React.FC = () => {
  const { menuItems, categories, loading: menuLoading, refreshMenu } = useMenu(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDish, setSelectedDish] = useState<MenuDish | null>(null);

  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menuItems, searchTerm, selectedCategory]);

  return (
    <DashboardLayout 
      title="Menu Architect" 
      subtitle="Refine dish pricing and coordinate ingredient specifications"
    >
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">
        
        {/* Navigation & Controls */}
        <div className="flex flex-col md:flex-row justify-between gap-6 items-center bg-card/40 p-3 rounded-[1.5rem] border border-white/5 backdrop-blur-md">
          <div className="flex bg-black/60 p-1 rounded-xl border border-white/10 w-full md:w-auto overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                "px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap",
                selectedCategory === 'all' ? "bg-primary text-black" : "text-gray-500 hover:text-white"
              )}
            >
              All Dishes
            </button>
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={cn(
                  "px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap",
                  selectedCategory === cat ? "bg-primary text-black" : "text-gray-500 hover:text-white"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-80">
            <Search className="absolute left-4 top-3.5 h-4 w-4 text-gray-500" />
            <Input 
              placeholder="Search catalog..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-12 bg-black/20 border-white/10 h-12 rounded-2xl"
            />
          </div>
        </div>

        {/* Catalog Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
          {menuLoading ? (
            <div className="col-span-full py-40 flex flex-col items-center justify-center text-primary gap-4">
              <Loader2 className="w-12 h-12 animate-spin" />
              <p className="font-bold uppercase tracking-widest text-[10px]">Syncing Catalog Data...</p>
            </div>
          ) : filteredItems.map(item => (
            <Card key={item.id} className="bg-card/40 border-white/5 hover:border-primary/20 transition-all group overflow-hidden flex flex-col h-full rounded-[2rem] shadow-2xl">
              <div className="h-44 overflow-hidden relative">
                 <img 
                   src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80'} 
                   className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                 />
                 <div className="absolute top-4 right-4 z-10">
                    <Badge className={cn(
                      "text-[9px] font-black uppercase px-2 py-1 rounded-md border",
                      item.recipe_id ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                    )}>
                      {item.recipe_id ? 'Recipe Set' : 'No Spec'}
                    </Badge>
                 </div>
                 <div className="absolute inset-0 bg-gradient-to-t from-[#0A0A0A] to-transparent opacity-90" />
                 <div className="absolute bottom-4 left-4">
                    <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">{item.category}</p>
                    <h3 className="font-bold text-white text-lg truncate w-full">{item.name}</h3>
                 </div>
              </div>
              <CardContent className="p-5 flex-1 flex flex-col justify-between">
                 <div>
                    <div className="flex items-baseline gap-1">
                       <span className="text-2xl font-black text-white font-mono tracking-tighter">ETB {item.price.toLocaleString()}</span>
                    </div>
                 </div>
                 <Button 
                   variant="secondary" 
                   className="w-full mt-6 bg-white/5 border-white/10 hover:bg-white/10 hover:text-white rounded-xl h-12 font-bold text-xs uppercase tracking-widest group"
                   onClick={() => setSelectedDish(item)}
                 >
                    <ChefHat className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" /> Recipe Architect
                 </Button>
              </CardContent>
            </Card>
          ))}
          {!menuLoading && filteredItems.length === 0 && (
             <div className="col-span-full py-40 text-center text-gray-600">
                <Utensils className="w-12 h-12 mx-auto mb-4 opacity-10" />
                <p className="font-bold text-sm">No items found matching your filters.</p>
             </div>
          )}
        </div>
      </div>

      <Dialog isOpen={!!selectedDish} onClose={() => setSelectedDish(null)} title="Menu Specification Architect">
         {selectedDish && (
           <RecipeEditor 
             dish={selectedDish} 
             onSaved={() => { refreshMenu(); setSelectedDish(null); }} 
           />
         )}
      </Dialog>
    </DashboardLayout>
  );
};

export default MenuManagement;
