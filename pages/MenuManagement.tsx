
import React, { useState, useMemo } from 'react';
import { DashboardLayout } from '../components/DashboardLayout';
import { supabase } from '../supabase';
import { useMenu } from '../hooks/useMenu';
import { Card, CardContent, Badge, Button, Input, cn, showToast, Dialog } from '../components/ui';
import { Search, Plus, Edit3, Trash2, Utensils, Info, BookOpen, Loader2, ChefHat } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { MenuDish } from '../types';
import { useAuth } from '../AuthContext';
import { RecipeEditor } from '../components/RecipeEditor';
import { MenuEditorModal } from '../components/MenuEditorModal';

const MenuManagement: React.FC = () => {
  const { menuItems, categories, loading: menuLoading, refreshMenu } = useMenu(false);
  const { profile: user } = useAuth();
  const isPrivileged = user?.role === 'owner' || user?.role === 'admin';
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDish, setSelectedDish] = useState<MenuDish | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuDish | null>(null);

  const filteredItems = useMemo(() => {
    return menuItems.filter(item => {
      // Visibility rule: Staff (non-owners/admins) should never see unavailable items
      const isPrivileged = user?.role === 'owner' || user?.role === 'admin';
      if (!isPrivileged && !item.is_available) return false;

      const matchesSearch = (item.name || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menuItems, searchTerm, selectedCategory, user?.role]);

  return (
    <DashboardLayout
      title="Menu Architect"
      subtitle="Refine dish pricing and coordinate ingredient specifications"
    >
      <div className="space-y-6 animate-in fade-in duration-500 pb-20">

        {/* Navigation & Controls */}
        <div className="flex flex-col md:flex-row justify-between gap-6 items-center bg-card p-3 rounded-[1.5rem] border border-primary/20 shadow-xl">
          <div className="flex bg-muted/10 p-1 rounded-xl border border-primary/20 w-full md:w-auto overflow-x-auto no-scrollbar">
            <button
              onClick={() => setSelectedCategory('all')}
              className={cn(
                "px-5 py-2 text-[10px] font-black uppercase tracking-widest rounded-lg transition-all whitespace-nowrap",
                selectedCategory === 'all' ? "bg-primary text-black" : "text-muted hover:text-foreground"
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
                  selectedCategory === cat ? "bg-primary text-black" : "text-muted hover:text-foreground"
                )}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <Search className="absolute left-4 top-3.5 h-4 w-4 text-muted" />
              <Input
                placeholder="Search catalog..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 bg-muted/5 border-primary/20 h-12 rounded-2xl"
              />
            </div>
            {isPrivileged && (
              <Button
                onClick={() => { setEditingItem(null); setIsEditorOpen(true); }}
                className="bg-primary hover:bg-primary/80 text-black font-black uppercase tracking-widest text-[10px] h-12 px-6 rounded-2xl flex items-center gap-2 shrink-0 shadow-lg shadow-primary/20"
              >
                <Plus className="w-4 h-4" /> Add New Item
              </Button>
            )}
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
            <Card key={item.id} className="bg-card border-primary/20 hover:border-primary/50 transition-all group overflow-hidden flex flex-col h-full rounded-[2rem] shadow-lg hover:shadow-2xl hover:shadow-primary/5">
              <div className="h-44 overflow-hidden relative">
                <img
                  src={item.image_url || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=300&q=80'}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute top-4 right-4 z-10 flex flex-col items-end gap-2">
                  <Badge className={cn(
                    "text-[9px] font-black uppercase px-2 py-1 rounded-md border",
                    item.recipe_id ? "bg-green-500/10 text-green-400 border-green-500/20" : "bg-red-500/10 text-red-400 border-red-500/20"
                  )}>
                    {item.recipe_id ? 'Recipe Set' : 'No Spec'}
                  </Badge>
                  {!item.is_available && (
                    <Badge className="bg-red-500 text-white border-red-600 text-[8px] font-black uppercase shadow-lg shadow-red-500/20">
                      Out of Stock
                    </Badge>
                  )}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-90" />
                <div className="absolute bottom-4 left-4 right-12">
                  <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">{item.category}</p>
                  <h3 className="font-bold text-white text-lg truncate w-full">{item.name}</h3>
                </div>

                {/* Action Buttons */}
                {isPrivileged && (
                  <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                    <button
                      onClick={() => { setEditingItem(item); setIsEditorOpen(true); }}
                      className="p-2 bg-black/60 hover:bg-black/80 text-white rounded-lg border border-white/10 backdrop-blur-md transition-all active:scale-95"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={async () => {
                        if (confirm(`PERMANENT DELETE: Are you sure you want to wipe "${item.name}" and ALL its history? This action cannot be undone.`)) {
                          try {
                            let edgeSuccess = false;
                            try {
                              const { error, data: result } = await supabase.functions.invoke('manage-menu', {
                                body: {
                                  action: 'delete',
                                  target_id: item.id,
                                }
                              });
                              if (!error && !(result && result.error)) {
                                edgeSuccess = true;
                              } else {
                                console.warn("Edge Function failed, falling back to direct RPC:", error || result?.error);
                              }
                            } catch (e) {
                              console.warn("Edge Function unreachable, falling back to direct RPC:", e);
                            }

                            // Fallback: Direct RPC call to the Deep Wipe Protocol
                            if (!edgeSuccess) {
                              const { error: rpcErr } = await supabase.rpc('permanently_delete_menu_item', {
                                target_id: item.id
                              });
                              if (rpcErr) throw rpcErr;
                            }

                            refreshMenu();
                            showToast("Menu Item Purged from Project", "success");
                          } catch (err: any) {
                            showToast(err.message, "error");
                          }
                        }
                      }}
                      className="p-2 bg-red-500/20 hover:bg-red-500/40 text-red-500 rounded-lg border border-red-500/20 backdrop-blur-md transition-all active:scale-95"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
              <CardContent className="p-5 flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-black text-foreground font-mono tracking-tighter">ETB {item.price.toLocaleString()}</span>

                    {/* Real Margin & Cost Logic */}
                    <div className="flex flex-col items-end">
                      {item.cost_per_plate !== undefined && item.cost_per_plate > 0 ? (
                        <>
                          <Badge className={cn(
                            "text-[8px] font-black uppercase border",
                            ((item.price - item.cost_per_plate) / item.price) > 0.4
                              ? "bg-green-500/10 text-green-500 border-green-500/20"
                              : "bg-yellow-500/10 text-yellow-500 border-yellow-500/20"
                          )}>
                            {(((item.price - item.cost_per_plate) / item.price) * 100).toFixed(0)}% Margin
                          </Badge>
                          <span className="text-[8px] text-muted mt-1 uppercase font-bold tracking-tighter">
                            Cost: ETB {item.cost_per_plate.toFixed(2)}
                          </span>
                        </>
                      ) : (
                        <span className="text-[8px] text-red-500/50 uppercase font-black tracking-tighter italic">Cost Unknown</span>
                      )}
                    </div>
                  </div>
                </div>
                {isPrivileged && (
                  <Button
                    variant="secondary"
                    className="w-full mt-6 bg-muted/10 border-primary/20 hover:bg-muted/20 hover:text-foreground rounded-xl h-12 font-bold text-xs uppercase tracking-widest group"
                    onClick={() => setSelectedDish(item)}
                  >
                    <ChefHat className="w-4 h-4 mr-2 group-hover:rotate-12 transition-transform" /> Recipe Architect
                  </Button>
                )}
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

      <MenuEditorModal
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
        onSuccess={() => { refreshMenu(); setIsEditorOpen(false); }}
        editingItem={editingItem}
      />
    </DashboardLayout >
  );
};

export default MenuManagement;
