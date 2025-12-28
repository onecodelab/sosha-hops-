
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { Dialog, Button, Input, cn, showToast } from './ui';
import { Info, BookOpen, Loader2, ListTree } from 'lucide-react';
import { MenuItem } from '../types';
import { RecipeEditor } from './RecipeEditor';

const CATEGORY_OPTIONS = ['BREAKFAST', 'MAIN', 'SALADS', 'SOUP', 'DRINKS', 'DESSERT', 'OTHER'];

interface MenuEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingItem?: MenuItem | null;
}

export const MenuEditorModal: React.FC<MenuEditorModalProps> = ({ 
  isOpen, onClose, onSuccess, editingItem 
}) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'recipe'>('basic');
  const [internalItem, setInternalItem] = useState<MenuItem | null>(null);
  
  // Track modal open state to handle initialization
  const wasOpen = useRef(false);

  // Basic Info State
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [imageUrl, setImageUrl] = useState('');
  const [isAvailable, setIsAvailable] = useState(true);

  // Initialize state when modal opens or editingItem changes
  useEffect(() => {
    if (isOpen) {
      // If modal just opened OR a different item was selected for editing
      if (!wasOpen.current || (editingItem && editingItem.id !== internalItem?.id)) {
        setActiveTab('basic');
        if (editingItem) {
          setInternalItem(editingItem);
          setName(editingItem.name);
          setCategory(editingItem.category || '');
          setPrice(editingItem.price);
          setImageUrl(editingItem.image_url || '');
          setIsAvailable(editingItem.is_available);
        } else {
          setInternalItem(null);
          setName('');
          setCategory('');
          setPrice(0);
          setImageUrl('');
          setIsAvailable(true);
        }
      }
      wasOpen.current = true;
    } else {
      wasOpen.current = false;
    }
  }, [isOpen, editingItem, internalItem?.id]);

  const handleSaveBasic = async () => {
    if (!name || price <= 0 || !category) {
      showToast("Please provide name, price, and category", "error");
      return;
    }

    setLoading(true);
    try {
      const normalizedCategory = category.trim() || 'Uncategorized';

      const payload = {
        name: name.trim(),
        category: normalizedCategory,
        price: parseFloat(price.toString()),
        image_url: imageUrl.trim() || null,
        is_available: isAvailable
      };

      if (internalItem) {
        const { error } = await supabase.from('menu_items').update(payload).eq('id', internalItem.id);
        if (error) throw error;
        showToast("Dish updated", "success");
      } else {
        const { data, error } = await supabase.from('menu_items').insert(payload).select().single();
        if (error) throw error;
        
        // Critical: Set internalItem to the newly created dish so the Recipe tab works
        const newItem = data as MenuItem;
        setInternalItem(newItem);
        showToast("Dish created! You can now map recipes.", "success");
        setActiveTab('recipe');
      }

      // Notify parent to refresh list, but our local internalItem preserves the ID
      onSuccess();
    } catch (err: any) {
      showToast(err.message || "Failed to save dish", "error");
    } finally {
      setLoading(false);
    }
  };

  const hasItem = !!internalItem;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={internalItem ? `Manage: ${internalItem.name}` : "Create New Dish"}>
      <div className="flex flex-col gap-6">
        
        {/* Navigation Tabs */}
        <div className="flex bg-black/40 p-1 rounded-xl border border-white/5">
           <button
             onClick={() => setActiveTab('basic')}
             className={cn(
               "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2",
               activeTab === 'basic' ? "bg-primary text-black shadow-lg shadow-primary/20" : "text-gray-500 hover:text-white"
             )}
           >
              <Info className="w-3.5 h-3.5" /> Basic Info
           </button>
           <button
             onClick={() => setActiveTab('recipe')}
             disabled={!hasItem}
             className={cn(
               "flex-1 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center justify-center gap-2",
               activeTab === 'recipe' ? "bg-primary text-black shadow-lg shadow-primary/20" : "text-gray-500 hover:text-white",
               !hasItem && "opacity-30 cursor-not-allowed grayscale"
             )}
           >
              <BookOpen className="w-3.5 h-3.5" /> Recipe Mapping
           </button>
        </div>

        <div className="min-h-[420px]">
          {activeTab === 'basic' ? (
            <div className="space-y-5 animate-in fade-in slide-in-from-bottom-2 duration-300">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Dish Identity</label>
                  <Input 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="e.g. Doro Wat" 
                    className="bg-black/40 border-gray-700 h-12" 
                  />
               </div>
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <<label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Catego</</label>
                    <<div className="relative">
                       <<select 
                          value={category} 
                          onChange={e => setCategory(e.target.value)}
                          className="w-full h-11 bg-black/40 border border-gray-700 rounded-lg px-3 text-sm text-white outline-none focus:border-primary/50 appearance-none"
                        >
                          < option value="" disabled>Select catego...</y.option>
                           {CATEGORY_OPTIONS.map(option => (
                            <eoption key={option} value={option}>{opti}</ctoption>
                           ))}
                      </ tselect>
                       <nListTree className="absolute right-3 top-3.5 w-4 h-4 text-gray-600</div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Price (ETB)</label>
                     <Input 
                       type="number" 
                       value={price} 
                       onChange={e => setPrice(parseFloat(e.target.value) || 0)} 
                       className="font-mono text-primary font-bold bg-black/40 border-gray-700" 
                     />
                  </div>
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Display Image URL</label>
                  <Input value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="https://..." className="bg-black/40 border-gray-700" />
               </div>
               <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <span className="text-sm font-bold text-gray-300">Available for Order</span>
                  <button 
                    onClick={() => setIsAvailable(!isAvailable)}
                    className={cn("w-12 h-6 rounded-full transition-all relative", isAvailable ? "bg-primary" : "bg-gray-700")}
                  >
                     <div className={cn("absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform", isAvailable ? "translate-x-6" : "translate-x-0")} />
                  </button>
               </div>
               
               <div className="pt-4 flex flex-col gap-3">
                  <Button onClick={handleSaveBasic} className="w-full bg-primary text-black font-black h-12 shadow-xl" isLoading={loading}>
                     {internalItem ? 'Save Changes' : 'Create & Continue to Recipe'}
                  </Button>
                  <Button variant="ghost" className="w-full text-gray-500" onClick={onClose}>Cancel</Button>
               </div>
            </div>
          ) : (
            internalItem && <RecipeEditor menuItem={internalItem} />
          )}
        </div>
      </div>
    </Dialog>
  );
};
