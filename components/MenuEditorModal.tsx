
import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabase';
import { Dialog, Button, Input, cn, showToast, Badge } from './ui';
import { Info, BookOpen, Loader2, ListTree, Lock, Upload, Image as ImageIcon, X, RefreshCw, Edit3 } from 'lucide-react';
import { MenuItem, Category } from '../types';
import { RecipeEditor } from './RecipeEditor';
import { RoleGuard } from './RoleGuard';
import { useRoleAccess } from '../hooks/useRoleAccess';
import { useAuth } from '../AuthContext';
import { useBranch } from '../contexts/BranchContext';
import { calculateIngredientCost } from '../lib/menuEconomics';

interface MenuEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingItem?: MenuItem | null;
  refreshParent?: () => void;
}

export const MenuEditorModal: React.FC<MenuEditorModalProps> = ({
  isOpen, onClose, onSuccess, editingItem
}) => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'basic' | 'recipe'>('basic');
  const [internalItem, setInternalItem] = useState<MenuItem | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const { profile: userProfile } = useAuth();
  const { activeBranchId } = useBranch();

  // Track modal open state to handle initialization
  const wasOpen = useRef(false);

  // Basic Info State
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [imageUrl, setImageUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAvailable, setIsAvailable] = useState(true);
  const [recipeCost, setRecipeCost] = useState(0);

  // Semantic Tagging State
  const [dietaryTags, setDietaryTags] = useState<string>('');
  const [spiceLevel, setSpiceLevel] = useState<string>('None');
  const [portionSize, setPortionSize] = useState<string>('Standard');

  // Manual Category State
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [isEditingCategory, setIsEditingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // Initialize state when modal opens or editingItem changes
  useEffect(() => {
    if (isOpen) {
      fetchCategories();

      // If modal just opened OR a different item was selected for editing
      if (!wasOpen.current || (editingItem && editingItem.id !== internalItem?.id)) {
        setActiveTab('basic');
        if (editingItem) {
          setInternalItem(editingItem);
          setName(editingItem.name);
          setCategoryId(editingItem.category_id || '');
          setPrice(editingItem.price);
          setImageUrl(editingItem.image_url || '');
          setIsAvailable(editingItem.is_available);
          setDietaryTags((editingItem.dietary_tags || []).join(', '));
          setSpiceLevel(editingItem.spice_level || 'None');
          setPortionSize(editingItem.portion_size || 'Standard');
          fetchRecipeCost(editingItem.id);
        } else {
          setInternalItem(null);
          setName('');
          setCategoryId('');
          setPrice(0);
          setImageUrl('');
          setIsAvailable(true);
          setRecipeCost(0);
          setDietaryTags('');
          setSpiceLevel('None');
          setPortionSize('Standard');
          setIsAddingCategory(false);
          setIsEditingCategory(false);
          setNewCategoryName('');
        }
      }
      wasOpen.current = true;
    } else {
      wasOpen.current = false;
    }
  }, [isOpen, editingItem]);

  const fetchRecipeCost = async (itemId: string) => {
    try {
      // 1. Fetch Units Registry for Precise Calculation
      const { data: units } = await supabase.from('units').select('*');
      
      // 2. Fetch Recipe
      const { data: recipe } = await supabase.from('recipes').select('id').eq('menu_item_id', itemId).maybeSingle();
      if (!recipe) return;

      // 3. Fetch Detailed Ingredients for HEALING
      const { data: ingredients } = await supabase
        .from('recipe_ingredients')
        .select('*, ingredient:ingredients(cost_per_unit, weight_per_unit, unit_id, unit_type, units(*))')
        .eq('recipe_id', recipe.id);

      if (ingredients) {
        // Apply Universal Healer logic
        const cost = ingredients.reduce((sum: number, m: any) =>
          sum + calculateIngredientCost(m, units || []), 0
        );
        setRecipeCost(cost);
      }
    } catch (err) {
      console.error("Cost fetch error:", err);
    }
  };

  const fetchCategories = async () => {
    const { data } = await supabase.from('categories').select('*').order('name');
    if (data) setCategories(data);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      showToast("Please upload an image file", "error");
      return;
    }

    // Validate size (e.g., 2MB limit)
    if (file.size > 2 * 1024 * 1024) {
      showToast("Image must be smaller than 2MB", "error");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `menu-items/${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('menu-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get Public URL
      const { data: { publicUrl } } = supabase.storage
        .from('menu-images')
        .getPublicUrl(filePath);

      setImageUrl(publicUrl);
      showToast("Image uploaded successfully", "success");
    } catch (err: any) {
      showToast(err.message || "Upload failed", "error");
    } finally {
      setUploading(false);
    }
  };

  const handleSaveBasic = async () => {
    // Validation
    if (!name || price <= 0) {
      showToast("Please provide name and price", "error");
      return;
    }

    if (!isAddingCategory && !categoryId) {
      showToast("Please select a category", "error");
      return;
    }

    if (isAddingCategory && !newCategoryName.trim()) {
      showToast("Please enter a category name", "error");
      return;
    }

    setLoading(true);

    try {
      let finalCategoryId = categoryId;
      let finalCategoryName = '';

      // 1. Resolve Category
      if (isAddingCategory && !isEditingCategory) {
        // CASE: Creating New Category
        const trimmedCat = newCategoryName.trim();
        const existing = categories.find(c => c.name.toLowerCase() === trimmedCat.toLowerCase());

        if (existing) {
          finalCategoryId = existing.id;
          finalCategoryName = existing.name;
        } else {
          const { data: newCat, error: catErr } = await supabase
            .from('categories')
            .insert({
              name: trimmedCat,
              organization_id: userProfile?.organization_id
            })
            .select()
            .single();

          if (catErr) throw catErr;
          finalCategoryId = newCat.id;
          finalCategoryName = newCat.name;
          fetchCategories();
        }
      } else if (isEditingCategory && categoryId) {
        // CASE: Renaming Existing Category
        const trimmedCat = newCategoryName.trim();
        const existing = categories.find(c => c.id === categoryId);

        if (existing && existing.name !== trimmedCat) {
          // Update Category Entry
          const { error: catErr } = await supabase
            .from('categories')
            .update({ name: trimmedCat })
            .eq('id', categoryId);
          if (catErr) throw catErr;

          // Cascade Update Menu Table (for consistency)
          await supabase
            .from('menu')
            .update({ category: trimmedCat })
            .eq('category_id', categoryId);

          finalCategoryName = trimmedCat;
          finalCategoryId = categoryId;
          fetchCategories();
        } else {
          finalCategoryId = categoryId;
          finalCategoryName = existing?.name || '';
        }
      } else if (isEditingCategory && !categoryId) {
        // CASE: Renaming a category that was just a string (no ID yet)
        // We convert it into a real category record
        const trimmedCat = newCategoryName.trim();
        const { data: newCat, error: catErr } = await supabase
          .from('categories')
          .insert({
            name: trimmedCat,
            organization_id: userProfile?.organization_id
          })
          .select()
          .single();

        if (catErr) throw catErr;
        finalCategoryId = newCat.id;
        finalCategoryName = newCat.name;
        fetchCategories();
      } else {
        // CASE: Using Selected Category
        const selected = categories.find(c => c.id === categoryId);
        finalCategoryId = categoryId;
        finalCategoryName = selected?.name || 'Uncategorized';
      }

      const payload: any = {
        name: name.trim(),
        category: finalCategoryName,
        category_id: finalCategoryId || null,
        price: parseFloat(price.toString()),
        image_url: imageUrl.trim() || null,
        status: isAvailable ? 'available' : 'unavailable',
        dietary_tags: dietaryTags.split(',').map(s => s.trim()).filter(Boolean),
        spice_level: spiceLevel,
        portion_size: portionSize,
        ...(internalItem?.id ? { id: internalItem.id } : { branch_id: activeBranchId || null }),
        ...(internalItem?.id ? {} : { organization_id: userProfile?.organization_id })
      };

      console.log("Saving Menu Item Payload:", payload);

      setLoading(true);
      try {
        let bffResult: any = null;
        let bffErr: any = null;

        // ATTEMPT 1: Edge Function (BFF)
        try {
          const response = await supabase.functions.invoke('manage-menu', {
            body: {
              action: 'upsert',
              item: payload,
            }
          });
          bffResult = response.data;
          bffErr = response.error;
        } catch (invokeErr: any) {
          console.warn("Edge Function unreachable, will attempt fallback:", invokeErr);
          bffErr = invokeErr;
        }

        let finalItem = null;

        if (!bffErr && bffResult && !bffResult.error) {
          finalItem = bffResult.data || bffResult;
          console.log("Edge Function Success:", finalItem);
        } else {
          // ATTEMPT 2: Direct Database Fallback (RLS-aware)
          console.warn("Edge Function failed, attempting direct DB fallback...", bffErr || bffResult?.error);

          const orgId = userProfile?.organization_id;
          if (!orgId) {
            throw new Error("Missing Organization Identity. Please refresh your session.");
          }

          const dbPayload = {
            ...payload,
            organization_id: orgId
          };

          const { data: dbData, error: dbErr } = await supabase
            .from('menu')
            .upsert(dbPayload)
            .select()
            .single();

          if (dbErr) {
            console.error("Direct DB Fallback Failed:", dbErr);
            throw new Error(dbErr.message || "Both Edge Function and DB fallback failed.");
          }

          finalItem = dbData;
          console.log("Direct DB Fallback Success:", finalItem);
        }

        if (internalItem) {
          showToast("Dish updated", "success");
        } else {
          if (finalItem && finalItem.id) {
            setInternalItem(finalItem);
          }
          showToast("Dish created! You can now map recipes.", "success");
          setActiveTab('recipe');
        }

        onSuccess();
      } catch (err: any) {
        throw err;
      }
    } catch (err: any) {
      console.error("HandleSaveBasic Caught Error:", err);
      showToast(err.message || "Failed to save dish", "error");
    } finally {
      setLoading(false);
    }
  };

  const hasItem = !!internalItem;

  const marginPercent = price > 0 ? ((price - recipeCost) / price) * 100 : 0;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={internalItem ? `Manage: ${internalItem.name}` : "Create New Dish"}>
      <div className="flex flex-col gap-6">

        {/* Navigation Tabs */}
        <div className="flex bg-black/40 p-1 rounded-xl border border-primary/10">
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
                  className="bg-black/40 border-primary/20 h-10 md:h-12 text-sm md:text-base"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between ml-1">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Category</label>
                    <div className="flex items-center gap-3">
                      {!isAddingCategory && (categoryId || (editingItem && editingItem.category)) && (
                        <button
                          type="button"
                          onClick={() => {
                            const current = categories.find(c => c.id === categoryId || c.name === editingItem?.category);
                            if (current) {
                              setNewCategoryName(current.name);
                              setCategoryId(current.id); // Ensure ID is set if it was string-only
                              setIsAddingCategory(true);
                              setIsEditingCategory(true);
                            } else if (editingItem?.category) {
                              setNewCategoryName(editingItem.category);
                              setIsAddingCategory(true);
                              setIsEditingCategory(true);
                            }
                          }}
                          className="flex items-center gap-1.5 text-[9px] font-black text-gray-400 hover:text-primary uppercase tracking-widest transition-all group/edit"
                        >
                          <Edit3 className="w-3 h-3 group-hover/edit:scale-110 transition-transform" />
                          <span>Edit</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          if (isAddingCategory) {
                             setIsAddingCategory(false);
                             setIsEditingCategory(false);
                             setNewCategoryName('');
                          } else {
                             setIsAddingCategory(true);
                             setIsEditingCategory(false);
                             setNewCategoryName('');
                          }
                        }}
                        className="text-[9px] font-black text-primary hover:text-primary/80 uppercase tracking-tighter transition-colors"
                      >
                        {isAddingCategory ? 'Select Existing' : '+ New Category'}
                      </button>
                    </div>
                  </div>
                  {isAddingCategory ? (
                    <div className="relative animate-in zoom-in-95 duration-200">
                      <Input
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                        placeholder={isEditingCategory ? "Rename category..." : "Type category name..."}
                        className="bg-black/40 border-primary/30 h-10 md:h-11 pr-10 text-sm"
                        autoFocus
                      />
                      <BookOpen className="absolute right-3 top-3.5 w-4 h-4 text-primary opacity-40" />
                    </div>
                  ) : (
                    <div className="relative">
                      <select
                        value={categoryId}
                        onChange={e => setCategoryId(e.target.value)}
                        className="w-full h-10 md:h-11 bg-black/40 border border-primary/15 rounded-lg px-3 text-xs md:text-sm text-white outline-none focus:border-primary/50 appearance-none transition-all"
                      >
                        <option value="" disabled>Select category...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <ListTree className="absolute right-3 top-3.5 w-4 h-4 text-gray-600 pointer-events-none" />
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Price (ETB)</label>
                    {recipeCost > 0 && (
                      <div className="flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-500">
                        <span className="text-[9px] text-gray-600 font-bold uppercase">Margin:</span>
                        <Badge className={cn(
                          "text-[9px] font-black h-4 px-1.5",
                          marginPercent > 40 ? "bg-green-500/10 text-green-500 border-green-500/20" :
                            marginPercent > 20 ? "bg-yellow-500/10 text-yellow-500 border-yellow-500/20" :
                              "bg-red-500/10 text-red-500 border-red-500/20"
                        )}>
                          {marginPercent.toFixed(0)}%
                        </Badge>
                      </div>
                    )}
                  </div>
                  <RoleGuard
                    allowedRoles={['owner', 'admin']}
                    fallback={
                      <div className="flex items-center gap-2 h-11 px-3 bg-black/60 border border-primary/15 rounded-lg">
                        <Lock className="w-4 h-4 text-gray-600" />
                        <span className="font-mono text-primary font-bold">ETB {price.toLocaleString()}</span>
                        <span className="text-[9px] text-gray-600 uppercase">(View Only)</span>
                      </div>
                    }
                  >
                    <div className="relative group">
                      <Input
                        type="number"
                        value={price}
                        onChange={e => setPrice(parseFloat(e.target.value) || 0)}
                        className="font-mono text-primary font-bold bg-black/40 border-primary/20 h-10 md:h-11 text-sm md:text-base transition-all group-focus-within:border-primary/40"
                      />
                      {recipeCost > 0 && (
                        <div className="absolute right-3 top-2.5 text-[8px] font-black text-gray-600 uppercase">
                          Cost: ETB {recipeCost.toFixed(0)}
                        </div>
                      )}
                    </div>
                  </RoleGuard>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between ml-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Dish Aesthetics</label>
                  {imageUrl && (
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/10 text-[9px] h-5">
                      Live Preview
                    </Badge>
                  )}
                </div>

                <div className={cn(
                  "relative group overflow-hidden rounded-[1.5rem] border-2 border-dashed transition-all duration-500 bg-black/40 h-32 md:h-40 flex flex-col items-center justify-center",
                   imageUrl ? "border-primary/20 bg-primary/5" : "border-primary/20 hover:border-primary/30"
                )}>
                  {imageUrl ? (
                    <>
                      <img src={imageUrl} alt="Dish Preview" className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                        <div className="flex gap-2">
                          <Button
                            onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                            className="bg-white text-black hover:bg-primary hover:text-black font-black uppercase text-[10px] h-9 px-4 rounded-xl shadow-xl transition-all"
                            disabled={uploading}
                          >
                            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <ImageIcon className="w-3.5 h-3.5 mr-2" />}
                            Swap Photo
                          </Button>
                          <Button
                            onClick={(e) => { e.stopPropagation(); setImageUrl(''); }}
                            variant="ghost"
                            className="bg-red-500/20 text-red-500 hover:bg-red-500 hover:text-white font-black uppercase text-[10px] h-9 px-3 rounded-xl border border-red-500/20"
                          >
                            <X className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                        <p className="text-[9px] font-bold text-white/60 uppercase tracking-widest">Supports JPG, PNG, WEBP (Max 2MB)</p>
                      </div>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full h-full flex flex-col items-center justify-center gap-4 group/btn"
                      disabled={uploading}
                    >
                      <div className="w-14 h-14 rounded-2xl bg-primary/5 border border-primary/10 flex items-center justify-center transition-all group-hover/btn:scale-110 group-hover/btn:border-primary/40 group-hover/btn:bg-primary/5">
                        {uploading ? (
                          <Loader2 className="w-7 h-7 animate-spin text-primary" />
                        ) : (
                          <Upload className="w-7 h-7 text-gray-500 group-hover:text-primary transition-colors" />
                        )}
                      </div>
                      <div className="text-center space-y-1">
                        <span className="block text-[11px] font-black text-gray-400 uppercase tracking-widest group-hover:text-white transition-colors">
                          {uploading ? 'Processing File...' : 'Upload Dish Photo'}
                        </span>
                        <span className="block text-[9px] text-gray-600 font-bold">Standard format (16:9 recommended)</span>
                      </div>
                    </button>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>
              <div className="pt-4 border-t border-primary/10">
                <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-4 block">Semantic Agent Tags</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Dietary Tags (Comma sep)</label>
                    <Input
                      value={dietaryTags}
                      onChange={e => setDietaryTags(e.target.value)}
                      placeholder="Vegan, Gluten-Free, Halal"
                      className="bg-black/40 border-primary/20 h-10 text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Spice Level</label>
                    <div className="relative">
                        <select
                          value={spiceLevel}
                          onChange={e => setSpiceLevel(e.target.value)}
                          className="w-full h-10 bg-black/60 border border-primary/20 rounded-lg px-3 text-xs text-white outline-none focus:border-primary/50 appearance-none"
                        >
                          <option value="None" className="bg-[#0A0A0A] text-white">None</option>
                          <option value="Mild" className="bg-[#0A0A0A] text-white">Mild</option>
                          <option value="Medium" className="bg-[#0A0A0A] text-white">Medium</option>
                          <option value="Hot" className="bg-[#0A0A0A] text-white">Hot</option>
                          <option value="Extra Hot" className="bg-[#0A0A0A] text-white">Extra Hot (Volcano)</option>
                        </select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Meal Size</label>
                    <div className="relative">
                        <select
                          value={portionSize}
                          onChange={e => setPortionSize(e.target.value)}
                          className="w-full h-10 bg-black/60 border border-primary/20 rounded-lg px-3 text-xs text-white outline-none focus:border-primary/50 appearance-none"
                        >
                          <option value="1 Person" className="bg-[#0A0A0A] text-white">1 Person</option>
                          <option value="2 People" className="bg-[#0A0A0A] text-white">2 People</option>
                          <option value="3 People" className="bg-[#0A0A0A] text-white">3 People</option>
                          <option value="4 People" className="bg-[#0A0A0A] text-white">4 People</option>
                          <option value="Sharing" className="bg-[#0A0A0A] text-white">Sharing / Group (5+ People)</option>
                          <option value="Bite" className="bg-[#0A0A0A] text-white">Bite Size / Snack</option>
                        </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-4 bg-primary/5 rounded-2xl border border-primary/10">
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
            // Fixed: passed correct prop 'dish' and added missing 'onSaved' callback
            internalItem && <RecipeEditor dish={internalItem} onSaved={onSuccess} />
          )}
        </div>
      </div>
    </Dialog>
  );
};
