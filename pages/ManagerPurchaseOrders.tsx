
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, Badge, Dialog, showToast, cn } from '../components/ui';
import { Plus, Search, FileText, Trash2, Eye, Download, MoreVertical, Truck, PackageCheck, Calendar, ShoppingBag, DollarSign, Package, Save, Send, CheckCircle, XCircle, RotateCcw, AlertCircle, CheckCircle2, ArrowRight, PlusCircle } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useNavigate } from 'react-router-dom';
import { PurchaseOrder, Ingredient, Supplier } from '../types';
import { useAuth } from '../AuthContext';
import { useRoleAccess } from '../hooks/useRoleAccess';
import { usePendingPO } from '../hooks/usePendingPO';
import { useBranch } from '../contexts/BranchContext';

interface POItemRow {
   id: string; // Temp local ID
   ingredientId: string;
   qty: number;
   unit: string;
   price: number;
}

interface ReceiveItem {
   id: string;
   po_id: string;
   ingredient_id: string;
   ordered_quantity: number;
   unit_price: number;
   received_quantity: number;
   previously_received: number;
   ingredient?: { name: string; unit_type: string; unit_id: string; units?: { abbreviation: string } };
}

const ManagerPurchaseOrders: React.FC = () => {
   const { t } = useLanguage();
   const { user } = useAuth();
   const { isOwnerOrAdmin } = useRoleAccess();
   const navigate = useNavigate();
   const queryClient = useQueryClient();
   const { activeBranchId } = useBranch();
   const { approvePO, approveAndSendPO, requestRevision, sendPO, submitForApproval } = usePendingPO();
   const [filterStatus, setFilterStatus] = useState<string>('all');
   const [searchTerm, setSearchTerm] = useState('');
   const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
   const [showForm, setShowForm] = useState(false);
   const [editingPOData, setEditingPOData] = useState<any>(null);

   // Form State
   const [supplierId, setSupplierId] = useState('');
   const [deliveryDate, setDeliveryDate] = useState(() => {
      const d = new Date();
      d.setDate(d.getDate() + 3);
      return d.toISOString().split('T')[0];
   });
   const [items, setItems] = useState<POItemRow[]>([{ id: crypto.randomUUID(), ingredientId: '', qty: 1, unit: '-', price: 0 }]);

   // Receiving State
   const [selectedPOForReceive, setSelectedPOForReceive] = useState<PurchaseOrder | null>(null);
   const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);
   const [invoiceNumber, setInvoiceNumber] = useState('');
   const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
   const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
   const [qtyBuffer, setQtyBuffer] = useState<Record<string, string>>({});
   const [deleteConfirmationPOId, setDeleteConfirmationPOId] = useState<string | null>(null);
   const [noteModalData, setNoteModalData] = useState<{ poId: string, action: 'revision' | 'submission' | 'approval', title: string } | null>(null);
   const [noteText, setNoteText] = useState('');
   const [selectedPODetails, setSelectedPODetails] = useState<PurchaseOrder | null>(null);
   const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

   const { data: suppliers } = useQuery({
      queryKey: ['suppliers'],
      queryFn: async () => {
         const { data, error } = await supabase
            .from('suppliers')
            .select('*')
            .eq('is_active', true);
         if (error) return [];
         return data as Supplier[];
      }
   });

   // Fetch Ingredients
   // Fetch Ingredients (with branch stock)
   const { data: ingredients } = useQuery({
      queryKey: ['ingredients-all', activeBranchId],
      queryFn: async () => {
         if (!activeBranchId) return [];
         const { data, error } = await supabase
            .from('ingredients')
            .select(`
                *,
                units(id, abbreviation),
                branch_inventory!left(current_stock, par_min, par_max)
             `)
            .eq('is_active', true)
            .eq('branch_inventory.branch_id', activeBranchId)
            .order('name');

         if (error) return [];

         return (data || []).map(item => {
            const bStock = Array.isArray(item.branch_inventory) ? item.branch_inventory[0] : item.branch_inventory;
            return {
               ...item,
               current_stock: bStock?.current_stock ?? 0,
               par_min: bStock?.par_min ?? 0,
               par_max: bStock?.par_max ?? 0,
            };
         }) as Ingredient[];
      },
      enabled: !!activeBranchId
   });

   // Fetch POs
   // Fetch POs
   const { data: purchaseOrders, isLoading } = useQuery({
      queryKey: ['purchase-orders', activeBranchId],
      queryFn: async () => {
         if (!activeBranchId) return [];
         const { data, error } = await supabase
            .from('purchase_orders')
            .select(`
          *,
           supplier:suppliers(name),
           creator:profiles!created_by(full_name),
           items:purchase_order_items(*, ingredient:ingredients(name, unit_type, unit_id, units(abbreviation), current_stock, par_min)),
           activity_log:po_activity_log(*, performer:profiles(full_name)),
            grns:goods_received_notes(*, items:grn_items(*))
        `)
            .eq('branch_id', activeBranchId)
            .order('created_at', { ascending: false });

         if (error) {
            console.warn("PO list fetch error:", error);
            return [];
         }
         return data as PurchaseOrder[];
      },
      enabled: !!activeBranchId
   });

   // Filter Logic
   const visiblePOs = purchaseOrders?.filter(po => {
      if (!isOwnerOrAdmin) {
         // Manager: Strictly only their own POs
         return po.created_by === user?.id;
      } else {
         // Owner: Their own POs + everything from others EXCEPT drafts
         const isMine = po.created_by === user?.id;
         const isOthersDraft = po.status === 'draft' && !isMine;
         return !isOthersDraft;
      }
   }) || [];

   const filteredPOs = visiblePOs.filter(po => {
      const matchesSearch = po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
         po.supplier?.name?.toLowerCase().includes(searchTerm.toLowerCase());

      let matchesStatus = false;
      if (filterStatus === 'all') matchesStatus = true;
      else if (filterStatus === 'draft') matchesStatus = po.status === 'draft';
      else if (filterStatus === 'sent') matchesStatus = po.status === 'sent';
      else if (filterStatus === 'received') matchesStatus = ['received', 'verified'].includes(po.status);
      else if (filterStatus === 'partial') matchesStatus = ['partial_received', 'approved', 'pending_approval', 'pending'].includes(po.status);

      return matchesSearch && matchesStatus;
   });

   // Create/Update Mutation
   const { mutate: createPO, isPending: isSaving } = useMutation({
      mutationFn: async ({ isDraft, notes }: { isDraft: boolean, notes?: string }) => {
         if (!user || !activeBranchId) throw new Error("Missing auth/branch");
         const validItems = items.filter(i => i.ingredientId && i.qty > 0);
         if (!isDraft && (validItems.length === 0 || !supplierId)) {
            throw new Error("Missing items or supplier");
         }

         const poItems = validItems.map(row => ({
            ingredient_id: row.ingredientId,
            quantity: row.qty,
            unit_price: row.price
         }));

         const { data: result, error: rpcError } = await supabase.rpc('submit_purchase_order', {
            p_supplier_id: supplierId,
            p_branch_id: activeBranchId,
            p_items: poItems,
            p_expected_delivery: deliveryDate,
            p_is_draft: isDraft,
            p_po_id: editingPOData?.id || null
         });

         if (rpcError) throw rpcError;
         if (!result?.success) throw new Error(result?.error || "PO Submission failed");
      },
      onSuccess: () => {
         showToast(t('po.success'), 'success');
         queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
         setShowForm(false);
         setEditingPOData(null);
         setSupplierId('');
         setItems([{ id: crypto.randomUUID(), ingredientId: '', qty: 1, unit: '-', price: 0 }]);
      },
      onError: (err: any) => showToast(err.message, 'error')
   });

   // Delete Mutation (Drafts only)
   const { mutate: deletePO } = useMutation({
      mutationFn: async (id: string) => {
         const { error } = await supabase.from('purchase_orders').delete().eq('id', id);
         if (error) throw error;
      },
      onSuccess: () => {
         showToast(t('po.deleteSuccess'), 'success');
         queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
         setActiveDropdown(null);
      },
      onError: (err: any) => showToast(err.message, 'error')
   });

   // Submit GRN Mutation
   const { mutate: confirmReceipt, isPending: isConfirmingReceipt } = useMutation({
      mutationFn: async () => {
         if (!user || !selectedPOForReceive) throw new Error("Missing data");
         if (!invoiceNumber) throw new Error("Invoice number is required");

         const itemsToReceive = receiveItems.map(item => ({
            ingredient_id: item.ingredient_id,
            received_quantity: item.received_quantity
         }));

         const { data: result, error: rpcError } = await supabase.rpc('receive_purchase_order', {
            p_po_id: selectedPOForReceive.id,
            p_invoice_number: invoiceNumber,
            p_received_date: receivedDate,
            p_items: itemsToReceive
         });

         if (rpcError) throw rpcError;
         if (!result?.success) throw new Error(result?.error || "Receipt recording failed");
      },
      onSuccess: () => {
         showToast(t('grn.success'), 'success');
         setIsReceiveModalOpen(false);
         queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
      },
      onError: (err: any) => showToast(err.message, 'error')
   });

   const handleDownload = () => {
      showToast("PDF download coming soon", 'success');
      setActiveDropdown(null);
   };

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
            if (field === 'ingredientId') {
               const ing = ingredients?.find(i => i.id === value);
               if (ing) {
                  updated.unit = ing.units?.abbreviation || ing.unit_type;
                  updated.price = ing.cost_per_unit || 0;
               }
            }
            return updated;
         }
         return row;
      }));
   };

   const handleEdit = (po: any) => {
      setEditingPOData(po);
      setSupplierId(po.supplier_id);
      setDeliveryDate(po.expected_delivery.split('T')[0]);
      setItems(po.items.map((i: any) => ({
         id: crypto.randomUUID(),
         ingredientId: i.ingredient_id,
         qty: i.ordered_quantity,
         unit: i.ingredient?.units?.abbreviation || i.ingredient?.unit_type || '-',
         price: i.unit_price || 0
      })));
      setShowForm(true);
      setActiveDropdown(null);
   };

   const handleCreateNew = () => {
      setEditingPOData(null);
      setSupplierId('');
      setDeliveryDate(() => {
         const d = new Date();
         d.setDate(d.getDate() + 3);
         return d.toISOString().split('T')[0];
      });
      setItems([{ id: crypto.randomUUID(), ingredientId: '', qty: 1, unit: '-', price: 0 }]);
      setShowForm(true);
   };

   const filteredIngredients = ingredients?.filter(ing =>
      !supplierId || !ing.supplier_id || ing.supplier_id === supplierId
   ) || [];

   const totalAmount = items.reduce((sum, item) => sum + (item.qty * item.price), 0);

   const handleViewDetails = (po: PurchaseOrder) => {
      setSelectedPODetails(po);
      setIsDetailsModalOpen(true);
      setActiveDropdown(null);
   };

   const handleDelete = (id: string) => {
      setDeleteConfirmationPOId(id);
      setActiveDropdown(null);
   };

   const handleActionWithNote = (poId: string, action: 'revision' | 'submission' | 'approval') => {
      let title = '';
      if (action === 'revision') title = 'Request Revision';
      else if (action === 'submission') title = 'Submit for Approval';
      else if (action === 'approval') title = 'Approve PO';

      setNoteModalData({ poId, action, title });
      setNoteText('');
      setActiveDropdown(null);
   };

   const submitNoteAction = async () => {
      if (!noteModalData) return;
      const { poId, action } = noteModalData;

      try {
         if (action === 'revision') {
            await requestRevision(poId, noteText);
         } else if (action === 'submission') {
            // Check if we are in the form or list
            if (showForm) {
               createPO({ isDraft: false, notes: noteText });
               setShowForm(false);
            } else {
               await submitForApproval(poId, noteText);
            }
         } else if (action === 'approval') {
            await approvePO(poId, noteText);
         }
         setNoteModalData(null);
      } catch (err: any) {
         showToast(err.message, 'error');
      }
   };

   const confirmDelete = () => {
      if (deleteConfirmationPOId) {
         deletePO(deleteConfirmationPOId);
         setDeleteConfirmationPOId(null);
      }
   };

   const openReceiveModal = (po: PurchaseOrder) => {
      setSelectedPOForReceive(po);
      // Calculate previously received totals from all past GRNs
      const items = po.items?.map(item => {
         const prevReceived = (po.grns || []).reduce((sum: number, grn: any) => {
            const grnItem = grn.items?.find((gi: any) => gi.ingredient_id === item.ingredient_id);
            return sum + (grnItem?.received_quantity || 0);
         }, 0);

         return {
            ...item,
            received_quantity: 0,
            previously_received: prevReceived
         };
      }) || [];
      setReceiveItems(items as ReceiveItem[]);

      // Initialize qty buffer
      const buffer: Record<string, string> = {};
      items.forEach(item => { buffer[item.id] = "0"; });
      setQtyBuffer(buffer);

      setInvoiceNumber('');
      setReceivedDate(new Date().toISOString().split('T')[0]);
      setIsReceiveModalOpen(true);
      setActiveDropdown(null);
   };

   const matchAllQuantities = () => {
      const buffer: Record<string, string> = {};
      setReceiveItems(prev => prev.map(item => {
         buffer[item.id] = item.ordered_quantity.toString();
         return {
            ...item,
            received_quantity: item.ordered_quantity
         };
      }));
      setQtyBuffer(buffer);
   };

   const updateReceivedQty = (itemId: string, value: string) => {
      setQtyBuffer(prev => ({ ...prev, [itemId]: value }));
      const qty = parseFloat(value) || 0; // Still parse to float for internal logic
      setReceiveItems(prev => prev.map(item =>
         item.id === itemId ? { ...item, received_quantity: qty } : item
      ));
   };

   const getMatchStatus = (ordered: number, received: number, previous: number = 0) => {
      const total = received + previous;
      if (total >= ordered) return { label: t('grn.complete'), color: 'bg-green-500/10 text-green-500 border-green-500/20' };
      return { label: t('grn.partial'), color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' };
   };

   const getStatusBadge = (status: string) => {
      switch (status) {
         case 'received':
         case 'verified':
            return <Badge variant="success" className="bg-green-500/10 text-green-500 border-green-500/20">{status === 'verified' ? 'Verified' : t('po.tabs.received')}</Badge>;
         case 'partial_received': return <Badge variant="warning" className="bg-yellow-500/10 text-yellow-500 border-yellow-500/20">{t('po.tabs.partial')}</Badge>;
         case 'sent': return <Badge variant="secondary" className="bg-blue-500/10 text-blue-400 border-blue-500/20">{t('po.tabs.sent')}</Badge>;
         case 'approved': return <Badge variant="success" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20">Approved</Badge>;
         case 'pending_approval':
         case 'pending':
            return <Badge variant="warning" className="bg-orange-500/10 text-orange-500 border-orange-500/20">Pending Review</Badge>;
         case 'needs_revision': return <Badge variant="warning" className="bg-red-500/10 text-red-400 border-red-500/20">Needs Revision</Badge>;
         default: return <Badge variant="outline" className="bg-gray-500/10 text-gray-400 border-gray-500/20">{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
      }
   };

   // Close dropdowns on outside click
   React.useEffect(() => {
      const handleClick = () => setActiveDropdown(null);
      window.addEventListener('click', handleClick);
      return () => window.removeEventListener('click', handleClick);
   }, []);

   return (
      <DashboardLayout title={t('po.listTitle')} subtitle={t('po.listSubtitle')}
         actions={
            !showForm ? (
               <Button onClick={handleCreateNew} className="bg-primary text-black font-bold hover:bg-primary/90">
                  <Plus className="w-4 h-4 mr-2" /> {t('po.createButton')}
               </Button>
            ) : (
               <Button variant="outline" onClick={() => setShowForm(false)} className="border-gray-700 hover:bg-gray-800">
                  Cancel
               </Button>
            )
         }
      >
         <div className="space-y-6 animate-in fade-in duration-500">
            {showForm ? (
               <div className="space-y-6 pb-20">
                  {/* Form Section */}
                  {/* Form Section - BARO STYLE */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     {/* LEFT: Order Details */}
                     <div className="md:col-span-1 space-y-6">
                        <div className="md:col-span-1 space-y-8">
                           <div className="bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
                              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                              <h3 className="flex items-center gap-3 text-[10px] font-black text-primary uppercase tracking-[0.2em] mb-8">
                                 <Truck className="w-4 h-4" strokeWidth={3} /> Procurement Protocol
                              </h3>

                              <div className="space-y-6">
                                 <div className="space-y-2.5">
                                    <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] pl-1 opacity-60">Strategic Partner (Supplier)</label>
                                    <div className="relative group/select">
                                       <select
                                          className="w-full h-14 bg-muted/10 border border-border rounded-2xl px-5 text-sm font-black text-foreground focus:outline-none focus:border-primary/50 focus:bg-muted/5 appearance-none hover:border-border/60 transition-all cursor-pointer z-10 relative shadow-inner"
                                          value={supplierId}
                                          onChange={(e) => setSupplierId(e.target.value)}
                                       >
                                          <option value="" className="bg-background text-muted">{t('po.selectSupplier')}</option>
                                          {suppliers?.map(s => (
                                             <option key={s.id} value={s.id} className="bg-background text-foreground font-bold">{s.name}</option>
                                          ))}
                                       </select>
                                       <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-muted group-hover/select:text-primary transition-colors">
                                          <PlusCircle className="w-4 h-4 opacity-40" />
                                       </div>
                                    </div>
                                 </div>

                                 <div className="space-y-2.5">
                                    <label className="text-[9px] font-black text-muted uppercase tracking-[0.2em] pl-1 opacity-60">Expected Delivery Node</label>
                                    <div className="relative group/date">
                                       <Calendar className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted group-hover/date:text-primary transition-colors" strokeWidth={3} />
                                       <Input
                                          type="date"
                                          value={deliveryDate}
                                          onChange={(e) => setDeliveryDate(e.target.value)}
                                          className="pl-14 h-14 bg-muted/10 border-border rounded-2xl text-foreground font-black focus:border-primary/50 focus:bg-muted/5 text-sm shadow-inner"
                                       />
                                    </div>
                                 </div>
                              </div>
                           </div>

                           {/* Summary Card */}
                           <div className="bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] p-8 text-center relative overflow-hidden group shadow-2xl">
                              <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent pointer-events-none opacity-40" />
                              <p className="text-[10px] font-black text-muted uppercase tracking-[0.3em] mb-2 relative z-10 opacity-60">Active Commitment Val.</p>
                              <h2 className="text-5xl font-black text-foreground tracking-tighter relative z-10">
                                 <span className="text-xs font-black mr-1 opacity-40 align-top mt-2 inline-block">ETB</span>
                                 {totalAmount.toLocaleString()}
                              </h2>
                           </div>
                        </div>
                     </div>

                     {/* RIGHT: Items Table */}
                     <div className="md:col-span-2">
                        <div className="bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col h-full min-h-[550px] group">
                           <div className="p-8 border-b border-border flex items-center justify-between bg-muted/5">
                              <h3 className="flex items-center gap-3 text-[10px] font-black text-foreground uppercase tracking-[0.2em]">
                                 <ShoppingBag className="w-4 h-4 text-primary" strokeWidth={3} /> Manifest Nodes (Items)
                              </h3>
                              <Button
                                 size="sm"
                                 onClick={addItem}
                                 className="bg-muted/10 text-foreground hover:bg-muted/20 border border-border rounded-xl font-black text-[10px] uppercase tracking-widest h-10 px-6 backdrop-blur-md shadow-sm transition-all hover:scale-105"
                              >
                                 <Plus className="w-4 h-4 mr-2" strokeWidth={3} /> Inject Item
                              </Button>
                           </div>

                           <div className="flex-1 overflow-x-auto">
                              <table className="w-full text-left border-collapse">
                                 <thead className="bg-black/20 text-[9px] font-black uppercase text-gray-500 tracking-wider">
                                    <tr>
                                       <th className="px-6 py-4 w-[35%]">Ingredient</th>
                                       <th className="px-4 py-4 w-[15%] text-center">Stock</th>
                                       <th className="px-4 py-4 w-[15%] text-center">Qty</th>
                                       <th className="px-4 py-4 w-[15%]">Price</th>
                                       <th className="px-6 py-4 w-[15%] text-right">Total</th>
                                       <th className="px-4 py-4 w-[5%]"></th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-white/5">
                                    {items.map((row) => (
                                       <tr key={row.id} className="group hover:bg-white/5 transition-colors">
                                          <td className="px-6 py-3">
                                             <div className="relative">
                                                <select
                                                   className="w-full bg-transparent border-b border-transparent group-hover:border-white/20 text-sm font-bold text-white focus:outline-none focus:border-primary py-2 appearance-none cursor-pointer"
                                                   value={row.ingredientId}
                                                   onChange={(e) => updateItem(row.id, 'ingredientId', e.target.value)}
                                                >
                                                   <option value="" className="bg-black text-gray-500">Select Item...</option>
                                                   {filteredIngredients.map(ing => (
                                                      <option key={ing.id} value={ing.id} className="bg-zinc-900">{ing.name}</option>
                                                   ))}
                                                </select>
                                                {!row.ingredientId && <div className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-red-500 text-[10px] font-bold">REQUIRED</div>}
                                             </div>
                                             {row.ingredientId && <div className="text-[10px] text-gray-500 mt-1 pl-1">{row.unit}</div>}
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                             {row.ingredientId ? (
                                                <div className="flex flex-col items-center">
                                                   <span className={cn(
                                                      "text-xs font-black px-2 py-0.5 rounded-full",
                                                      (ingredients?.find(i => i.id === row.ingredientId)?.current_stock || 0) < (ingredients?.find(i => i.id === row.ingredientId)?.par_min || 0)
                                                         ? "bg-red-500/20 text-red-500"
                                                         : "bg-emerald-500/20 text-emerald-500"
                                                   )}>
                                                      {ingredients?.find(i => i.id === row.ingredientId)?.current_stock}
                                                   </span>
                                                   <span className="text-[9px] text-gray-600 mt-1">Min: {ingredients?.find(i => i.id === row.ingredientId)?.par_min}</span>
                                                </div>
                                             ) : <span className="text-gray-700">-</span>}
                                          </td>
                                          <td className="px-4 py-3">
                                             <div className="bg-black/20 rounded-lg border border-white/5 flex items-center justify-center p-1 group-hover:border-white/10 transition-colors">
                                                <input
                                                   type="number"
                                                   className="w-16 bg-transparent text-center text-sm font-bold text-white focus:outline-none p-1"
                                                   value={row.qty}
                                                   onChange={(e) => updateItem(row.id, 'qty', parseFloat(e.target.value) || 0)}
                                                   min="1"
                                                />
                                             </div>
                                          </td>
                                          <td className="px-4 py-3">
                                             <div className="relative">
                                                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-gray-500 text-xs">$</span>
                                                <input
                                                   type="number"
                                                   className="w-full bg-transparent border-b border-transparent group-hover:border-white/20 pl-3 text-sm font-medium text-gray-300 focus:outline-none focus:border-primary py-2 text-right"
                                                   value={row.price}
                                                   onChange={(e) => updateItem(row.id, 'price', parseFloat(e.target.value) || 0)}
                                                   min="0"
                                                />
                                             </div>
                                          </td>
                                          <td className="px-6 py-3 text-right">
                                             <span className="font-mono text-white font-black tracking-tight">
                                                {(row.qty * row.price).toLocaleString()}
                                             </span>
                                          </td>
                                          <td className="px-4 py-3 text-center">
                                             <button
                                                onClick={() => removeItem(row.id)}
                                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-red-500/20 text-gray-600 hover:text-red-500 transition-all opacity-0 group-hover:opacity-100"
                                                disabled={items.length <= 1}
                                             >
                                                <Trash2 className="w-4 h-4" />
                                             </button>
                                          </td>
                                       </tr>
                                    ))}
                                    {/* Add Item Row Trigger */}
                                    <tr onClick={addItem} className="cursor-pointer hover:bg-white/5 border-t border-dashed border-white/10 opacity-50 hover:opacity-100 transition-all">
                                       <td colSpan={6} className="py-4 text-center">
                                          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center justify-center gap-2">
                                             <PlusCircle className="w-4 h-4" /> Add Another Item
                                          </span>
                                       </td>
                                    </tr>
                                 </tbody>
                              </table>
                           </div>
                        </div>
                     </div>
                  </div>

                  {/* Footer Actions - PREMIUM FLOATING GLASS */}
                  <div className="fixed bottom-10 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-10 w-[90%] md:w-auto p-3 bg-card/80 backdrop-blur-3xl border border-border rounded-[2rem] z-[100] shadow-[0_20px_60px_rgba(0,0,0,0.15)] animate-in slide-in-from-bottom-20 fade-in duration-700 flex items-center justify-between gap-10 pr-4">
                     <div className="hidden md:flex flex-col pl-6">
                        <span className="text-[9px] font-black text-muted uppercase tracking-[0.3em] opacity-60">Commitment Total</span>
                        <div className="text-2xl font-black text-foreground font-mono tracking-tighter leading-none flex items-start gap-1">
                           <span className="text-xs text-primary mt-1 opacity-60">ETB</span>
                           {totalAmount.toLocaleString()}
                        </div>
                     </div>

                     <div className="flex items-center gap-3 w-full md:w-auto">
                        <Button
                           variant="ghost"
                           className="text-muted hover:text-foreground hover:bg-muted/10 rounded-2xl h-14 px-8 text-[10px] font-black uppercase tracking-widest transition-all"
                           onClick={() => createPO({ isDraft: true })}
                           disabled={isSaving || !supplierId}
                        >
                           <Save className="w-5 h-5 mr-3" strokeWidth={3} /> Save Draft
                        </Button>
                        <Button
                           className="bg-foreground text-background hover:bg-foreground/90 font-black rounded-2xl px-10 h-14 text-[10px] uppercase tracking-[0.2em] shadow-xl shadow-foreground/10 transition-all hover:scale-105 active:scale-95 group overflow-hidden relative"
                           onClick={() => {
                              if (isOwnerOrAdmin) createPO({ isDraft: false });
                              else handleActionWithNote(editingPOData?.id || 'new', 'submission');
                           }}
                           disabled={isSaving || !supplierId}
                        >
                           <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/20 to-primary/0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                           {isOwnerOrAdmin ? (
                              <>
                                 <Send className="w-5 h-5 mr-3" strokeWidth={3} /> Finalize & Dispatch
                              </>
                           ) : (
                              <>
                                 <CheckCircle2 className="w-5 h-5 mr-3" strokeWidth={3} /> Submit for Review
                              </>
                           )}
                        </Button>
                     </div>
                  </div>
               </div>
            ) : (
               <>
                  {/* Controls */}
                  <div className="flex flex-col md:flex-row justify-between gap-6 items-center">
                     {/* Tabs */}
                     <div className="flex bg-muted/10 p-1.5 rounded-[1.5rem] border border-border w-full md:w-auto overflow-x-auto custom-scrollbar backdrop-blur-md">
                        {['all', 'draft', 'sent', 'partial', 'received'].map(status => {
                           const count = visiblePOs.filter(po => {
                              if (status === 'all') return true;
                              if (status === 'draft') return po.status === 'draft';
                              if (status === 'sent') return po.status === 'sent';
                              if (status === 'received') return ['received', 'verified'].includes(po.status);
                              if (status === 'partial') return ['partial_received', 'approved', 'pending_approval', 'pending'].includes(po.status);
                              return false;
                           }).length;

                           const labels: Record<string, string> = {
                              all: 'Total Manifest',
                              draft: 'Drafts',
                              sent: 'Dispatched',
                              partial: 'In Transit / Pending',
                              received: 'Settled'
                           };

                           return (
                              <button
                                 key={status}
                                 onClick={() => setFilterStatus(status)}
                                 className={cn(
                                    "px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-[1.1rem] transition-all flex items-center gap-3 whitespace-nowrap",
                                    filterStatus === status
                                       ? "bg-primary text-black shadow-lg shadow-primary/20"
                                       : "text-muted hover:text-foreground hover:bg-muted/10 opacity-60 hover:opacity-100"
                                 )}
                              >
                                 {labels[status]}
                                 <span className={cn("text-[9px] px-2 py-0.5 rounded-full font-black", filterStatus === status ? "bg-black/20 text-black" : "bg-muted/20 text-muted")}>
                                    {count}
                                 </span>
                              </button>
                           );
                        })}
                     </div>

                     {/* Search */}
                     <div className="relative w-full md:w-80 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted group-hover:text-primary transition-colors" strokeWidth={3} />
                        <Input
                           placeholder={t('common.search')}
                           value={searchTerm}
                           onChange={(e) => setSearchTerm(e.target.value)}
                           className="pl-12 h-12 bg-muted/10 border-border focus:border-primary/50 text-foreground font-black rounded-xl"
                        />
                     </div>
                  </div>

                  {/* Table */}
                  <div className="bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] min-h-[550px] flex flex-col shadow-2xl group overflow-hidden">
                     <div className="p-8 border-b border-border bg-muted/5">
                        <h3 className="text-foreground flex items-center gap-3 text-[10px] font-black uppercase tracking-[0.2em]">
                           <Truck className="w-4 h-4 text-primary" strokeWidth={3} /> Active Procurement Streams
                        </h3>
                     </div>
                     <div className="p-0 flex-1 overflow-x-auto">
                        <table className="w-full text-sm text-left border-collapse">
                           <thead className="text-[10px] font-black text-muted uppercase bg-muted/5 border-b border-border tracking-widest">
                              <tr>
                                 <th className="px-8 py-5">Ident. (PO#)</th>
                                 <th className="px-8 py-5">Strategic Partner</th>
                                 <th className="px-8 py-5">Lead Node</th>
                                 <th className="px-8 py-5">Initiated</th>
                                 <th className="px-8 py-5">Deadline</th>
                                 <th className="px-8 py-5 text-right">Commitment</th>
                                 <th className="px-8 py-5 text-center">Status</th>
                                 <th className="px-8 py-5 text-right w-20">Control</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-border">
                              {isLoading && (
                                 <tr><td colSpan={7} className="p-8 text-center text-gray-500">{t('common.loading')}</td></tr>
                              )}
                              {!isLoading && filteredPOs.length === 0 && (
                                 <tr><td colSpan={7} className="p-8 text-center text-gray-500">{t('po.empty')}</td></tr>
                              )}
                              {filteredPOs.map((po) => (
                                 <tr key={po.id} className="hover:bg-muted/5 transition-colors group">
                                    <td className="px-8 py-5 font-mono font-black text-foreground">{po.po_number}</td>
                                    <td className="px-8 py-5 text-foreground font-black text-[11px] uppercase tracking-tight">{po.supplier?.name || 'Unknown'}</td>
                                    <td className="px-8 py-5 text-muted text-[10px] font-black uppercase tracking-widest opacity-60">{po.creator?.full_name || 'System'}</td>
                                    <td className="px-8 py-5 text-muted text-[10px] font-black font-mono">
                                       {new Date(po.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-8 py-5 text-muted text-[10px] font-black font-mono">
                                       {new Date(po.expected_delivery).toLocaleDateString()}
                                    </td>
                                    <td className="px-8 py-5 text-right font-mono text-foreground font-black tracking-tighter text-base">
                                       <span className="text-[10px] mr-1 opacity-40">ETB</span>
                                       {po.total_amount.toLocaleString()}
                                    </td>
                                    <td className="px-8 py-5 text-center">
                                       <div className="flex flex-col items-center gap-1.5">
                                          {getStatusBadge(po.status)}
                                          {po.activity_log && po.activity_log.length > 0 && po.activity_log[po.activity_log.length - 1].notes && (
                                             <div className="max-w-[150px] truncate text-[8px] text-muted font-black uppercase tracking-widest opacity-40 italic" title={po.activity_log[po.activity_log.length - 1].notes}>
                                                "{po.activity_log[po.activity_log.length - 1].notes}"
                                             </div>
                                          )}
                                       </div>
                                    </td>
                                    <td className="px-8 py-5 text-right relative">
                                       <button
                                          onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === po.id ? null : po.id); }}
                                          className="p-3 hover:bg-muted/20 rounded-xl text-muted hover:text-foreground transition-all duration-300"
                                       >
                                          <MoreVertical className="w-4 h-4" strokeWidth={3} />
                                       </button>

                                       {activeDropdown === po.id && (
                                          <div className="absolute right-8 top-12 w-56 bg-card border border-border rounded-2xl shadow-3xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200 backdrop-blur-3xl shadow-2xl">
                                             <div className="p-1.5 space-y-1">
                                                <button
                                                   onClick={() => handleViewDetails(po)}
                                                   className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted hover:bg-muted/10 hover:text-foreground rounded-xl flex items-center gap-3 transition-colors"
                                                >
                                                   <Eye className="w-4 h-4" strokeWidth={3} /> {t('po.actions.view')}
                                                </button>
                                                <button
                                                   onClick={handleDownload}
                                                   className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-muted hover:bg-muted/10 hover:text-foreground rounded-xl flex items-center gap-3 transition-colors"
                                                >
                                                   <Download className="w-4 h-4" strokeWidth={3} /> {t('po.actions.download')}
                                                </button>

                                                {(po.status === 'draft' || po.status === 'needs_revision') && (
                                                   <button
                                                      onClick={() => handleEdit(po)}
                                                      className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-primary hover:bg-primary/10 rounded-xl flex items-center gap-3 transition-colors"
                                                   >
                                                      <Plus className="w-4 h-4" strokeWidth={3} /> {t('po.actions.edit')}
                                                   </button>
                                                )}

                                                {/* Owner Approval Actions */}
                                                {isOwnerOrAdmin && (po.status === 'pending_approval' || po.status === 'pending') && (
                                                   <div className="pt-1.5 mt-1.5 border-t border-border space-y-1">
                                                      <button
                                                         onClick={() => handleActionWithNote(po.id, 'approval')}
                                                         className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-emerald-500 hover:bg-emerald-500/10 rounded-xl flex items-center gap-3 transition-colors"
                                                      >
                                                         <CheckCircle className="w-4 h-4" strokeWidth={3} /> Approve Only
                                                      </button>
                                                      <button
                                                         onClick={() => { approveAndSendPO(po.id); setActiveDropdown(null); }}
                                                         className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-green-500 hover:bg-green-500/10 rounded-xl flex items-center gap-3 transition-colors"
                                                      >
                                                         <Send className="w-4 h-4" strokeWidth={3} /> Dispatch Node
                                                      </button>
                                                      <button
                                                         onClick={() => handleActionWithNote(po.id, 'revision')}
                                                         className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-orange-500 hover:bg-orange-500/10 rounded-xl flex items-center gap-3 transition-colors"
                                                      >
                                                         <RotateCcw className="w-4 h-4" strokeWidth={3} /> Request Revision
                                                      </button>
                                                   </div>
                                                )}

                                                {po.status === 'approved' && (
                                                   <button
                                                      onClick={() => { sendPO(po.id); setActiveDropdown(null); }}
                                                      className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:bg-blue-500/10 rounded-xl flex items-center gap-3 transition-colors"
                                                   >
                                                      <Send className="w-4 h-4" strokeWidth={3} /> Dispatch to Partner
                                                   </button>
                                                )}

                                                {(po.status === 'sent' || po.status === 'partial_received') && (
                                                   <button onClick={() => openReceiveModal(po)} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-blue-500 hover:bg-blue-500/10 rounded-xl flex items-center gap-3 transition-colors">
                                                      <PackageCheck className="w-4 h-4" strokeWidth={3} /> Confirm Receipt
                                                   </button>
                                                )}

                                                {po.status === 'draft' && (
                                                   <button onClick={() => handleDelete(po.id)} className="w-full text-left px-4 py-3 text-[10px] font-black uppercase tracking-widest text-red-500 hover:bg-red-500/10 rounded-xl flex items-center gap-3 border-t border-border mt-1.5 transition-colors">
                                                      <Trash2 className="w-4 h-4" strokeWidth={3} /> Terminate Draft
                                                   </button>
                                                )}
                                             </div>
                                          </div>
                                       )}
                                    </td>
                                 </tr>
                              ))}
                           </tbody>
                        </table>
                     </div>
                  </div>
               </>
            )}
         </div>

         {/* Receive Modal */}
         <AnimatePresence>
            {isReceiveModalOpen && (
               <Dialog isOpen={isReceiveModalOpen} onClose={() => setIsReceiveModalOpen(false)} showTitle={false}>
                  <motion.div
                     initial={{ opacity: 0, scale: 0.95, y: 20 }}
                     animate={{ opacity: 1, scale: 1, y: 0 }}
                     exit={{ opacity: 0, scale: 0.95, y: 20 }}
                     className="space-y-8 max-h-[85vh] overflow-y-auto pr-2 custom-scrollbar p-2"
                  >
                     {/* Header with High-Contrast Highlight */}
                     <div className="flex items-center justify-between mb-2">
                        <div className="bg-primary px-4 py-2 rounded-xl -skew-x-6 shadow-xl shadow-primary/20">
                           <h2 className="text-black font-black text-xl italic uppercase tracking-tighter">
                              {t('grn.receiveModalTitle')}
                           </h2>
                        </div>
                        <button
                           onClick={() => setIsReceiveModalOpen(false)}
                           className="p-3 hover:bg-muted/10 rounded-2xl text-muted hover:text-foreground transition-all"
                        >
                           <XCircle className="w-6 h-6" strokeWidth={3} />
                        </button>
                     </div>

                     {/* PO Info Cards */}
                     <div className="grid grid-cols-2 gap-6">
                        <div className="p-6 bg-card/40 rounded-3xl border border-border backdrop-blur-xl relative overflow-hidden group shadow-xl">
                           <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                           <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-3 opacity-60">
                              {t('grn.poNumber')}
                           </div>
                           <p className="text-foreground font-mono text-2xl font-black group-hover:text-primary transition-colors">
                              {selectedPOForReceive?.po_number}
                           </p>
                        </div>
                        <div className="p-6 bg-card/40 rounded-3xl border border-border backdrop-blur-xl relative overflow-hidden group shadow-xl">
                           <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent pointer-events-none" />
                           <div className="text-[10px] font-black text-muted uppercase tracking-widest mb-3 opacity-60">
                              {t('stock.supplier')}
                           </div>
                           <p className="text-foreground text-2xl font-black group-hover:text-primary transition-colors truncate">
                              {selectedPOForReceive?.supplier?.name}
                           </p>
                        </div>
                     </div>

                     {/* Date & Invoice Inputs */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-8 bg-muted/5 rounded-[2.5rem] border border-border shadow-inner">
                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1 opacity-60">
                              {t('grn.receivedDate')}
                           </label>
                           <div className="relative group">
                              <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary pointer-events-none transition-transform group-focus-within:scale-110" strokeWidth={3} />
                              <Input
                                 type="date"
                                 value={receivedDate}
                                 onChange={(e) => setReceivedDate(e.target.value)}
                                 className="pl-12 h-14 bg-card border-border focus:border-primary/50 text-foreground font-black rounded-2xl transition-all shadow-sm"
                              />
                           </div>
                        </div>
                        <div className="space-y-3">
                           <label className="text-[10px] font-black text-muted uppercase tracking-widest pl-1 opacity-60">
                              {t('grn.invoiceNumber')}
                           </label>
                           <div className="relative group">
                              <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-primary pointer-events-none transition-transform group-focus-within:scale-110" strokeWidth={3} />
                              <Input
                                 type="text"
                                 value={invoiceNumber}
                                 onChange={(e) => setInvoiceNumber(e.target.value)}
                                 placeholder="e.g. INV-0092"
                                 className="pl-12 h-14 bg-card border-border focus:border-primary/50 text-foreground font-black rounded-2xl transition-all shadow-sm"
                              />
                           </div>
                        </div>
                     </div>

                     {/* Items Section Header */}
                     <div className="flex items-center justify-between px-4">
                        <div className="flex items-center gap-3">
                           <Package className="w-5 h-5 text-primary" strokeWidth={3} />
                           <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.2em] italic font-mono">
                              GRN.MANIFEST_EXECUTION
                           </h3>
                        </div>
                        <Button
                           size="sm"
                           variant="ghost"
                           onClick={matchAllQuantities}
                           className="text-[10px] font-black text-primary hover:text-primary hover:bg-primary/10 flex items-center gap-2 transition-all p-0 h-auto"
                        >
                           <CheckCircle2 className="w-4 h-4" strokeWidth={3} />
                           SYNC QUANTITIES
                        </Button>
                     </div>

                     {/* Items Table */}
                     <div className="bg-card/40 backdrop-blur-xl border border-border rounded-[2.5rem] overflow-hidden shadow-2xl">
                        <table className="w-full text-sm text-left">
                           <thead className="text-[10px] font-black text-muted uppercase bg-muted/5 border-b border-border tracking-widest font-mono">
                              <tr>
                                 <th className="px-8 py-5">NODE_IDENT</th>
                                 <th className="px-5 py-5 w-24 text-center">ORDERED</th>
                                 <th className="px-5 py-5 w-24 text-center text-muted opacity-40">SETTLED</th>
                                 <th className="px-5 py-5 w-32 text-center">RECEIVING</th>
                                 <th className="px-8 py-5 w-32 text-right">STATUS</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-border">
                              {receiveItems.map((item, idx) => {
                                 const status = getMatchStatus(item.ordered_quantity, item.received_quantity, item.previously_received);
                                 return (
                                    <motion.tr
                                       key={item.id}
                                       initial={{ opacity: 0, x: -10 }}
                                       animate={{ opacity: 1, x: 0 }}
                                       transition={{ delay: idx * 0.05 }}
                                       className="hover:bg-muted/5 transition-colors group"
                                    >
                                       <td className="px-8 py-5">
                                          <p className="font-black text-foreground uppercase italic tracking-tight group-hover:text-primary transition-colors">{item.ingredient?.name}</p>
                                          <p className="text-[9px] text-muted font-black uppercase tracking-widest mt-1 opacity-60">{item.ingredient?.units?.abbreviation || item.ingredient?.unit_type}</p>
                                       </td>
                                       <td className="px-5 py-5 text-center text-foreground font-mono font-black text-base opacity-40">
                                          {item.ordered_quantity}
                                       </td>
                                       <td className="px-5 py-5 text-center text-muted font-mono font-black italic">
                                          {item.previously_received}
                                       </td>
                                       <td className="px-5 py-5">
                                          <div className="relative group/input flex justify-center">
                                             <Input
                                                type="text"
                                                inputMode="decimal"
                                                className="h-12 w-28 bg-muted/10 border-border group-hover/input:border-primary/40 focus:border-primary text-center font-black text-foreground transition-all rounded-xl shadow-inner"
                                                value={qtyBuffer[item.id] || ""}
                                                onChange={(e) => updateReceivedQty(item.id, e.target.value)}
                                             />
                                          </div>
                                       </td>
                                       <td className="px-8 py-5 text-right">
                                          <Badge className={cn(
                                             "px-4 py-1.5 font-black text-[9px] tracking-widest uppercase italic border-0 shadow-lg",
                                             status.label === t('grn.complete') || status.label === 'Complete'
                                                ? "bg-emerald-500/10 text-emerald-500 shadow-emerald-500/5 ring-1 ring-emerald-500/20"
                                                : status.label === t('grn.over') || status.label === 'Over'
                                                   ? "bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20"
                                                   : "bg-primary/10 text-primary ring-1 ring-primary/20 shadow-primary/5"
                                          )}>
                                             {status.label}
                                          </Badge>
                                       </td>
                                    </motion.tr>
                                 );
                              })}
                           </tbody>
                        </table>
                     </div>

                     {/* Action Buttons */}
                     <div className="flex items-center justify-end gap-8 pt-4">
                        <button
                           onClick={() => setIsReceiveModalOpen(false)}
                           disabled={isConfirmingReceipt}
                           className="text-muted font-black text-[10px] uppercase tracking-widest hover:text-foreground transition-colors disabled:opacity-50"
                        >
                           {t('common.cancel')}
                        </button>
                        <Button
                           className="h-16 px-12 bg-primary hover:bg-primary/90 active:scale-95 text-black font-black uppercase italic tracking-tighter text-lg rounded-[2rem] shadow-2xl shadow-primary/30 transition-all flex items-center gap-4 disabled:opacity-50"
                           onClick={() => confirmReceipt()}
                           disabled={isConfirmingReceipt || !invoiceNumber}
                        >
                           {isConfirmingReceipt ? (
                              <div className="w-6 h-6 border-3 border-black/30 border-t-black rounded-full animate-spin" />
                           ) : (
                              <>
                                 <CheckCircle2 className="w-6 h-6" strokeWidth={3} />
                                 {t('grn.confirm')}
                              </>
                           )}
                        </Button>
                     </div>
                  </motion.div>
               </Dialog>
            )}
         </AnimatePresence>
         {/* Action Note Modal */}
         <AnimatePresence>
            {noteModalData && (
               <Dialog isOpen={!!noteModalData} onClose={() => setNoteModalData(null)} showTitle={false}>
                  <motion.div
                     initial={{ opacity: 0, scale: 0.95, y: 20 }}
                     animate={{ opacity: 1, scale: 1, y: 0 }}
                     exit={{ opacity: 0, scale: 0.95, y: 20 }}
                     className="p-10 space-y-8"
                  >
                     <div className="flex items-center gap-4 mb-2">
                        <div className="bg-primary px-4 py-2 rounded-xl -skew-x-6 shadow-xl shadow-primary/20">
                           <h2 className="text-black font-black text-xl italic uppercase tracking-tighter">
                              {noteModalData.title}
                           </h2>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <p className="text-muted text-[10px] font-black uppercase tracking-[0.2em] pl-1 opacity-60">
                           TRANSACTIONAL CONTEXT / REASONING:
                        </p>
                        <textarea
                           autoFocus
                           value={noteText}
                           onChange={(e) => setNoteText(e.target.value)}
                           placeholder={noteModalData.action === 'revision' ? "e.g. Audit mismatch detected in node 04. Verify physical inventory." : "Add a transactional note..."}
                           className="w-full h-40 bg-muted/5 border border-border focus:border-primary/50 focus:ring-1 focus:ring-primary/20 text-foreground font-medium rounded-[1.5rem] p-6 transition-all resize-none custom-scrollbar shadow-inner text-sm"
                        />
                     </div>

                     <div className="flex gap-4 pt-4">
                        <Button
                           variant="ghost"
                           onClick={() => setNoteModalData(null)}
                           className="flex-1 h-16 border border-border text-muted hover:text-foreground hover:bg-muted/10 text-xs font-black uppercase tracking-widest rounded-2xl transition-all"
                        >
                           Abort Action
                        </Button>
                        <Button
                           onClick={submitNoteAction}
                           className="flex-1 h-16 bg-primary hover:bg-primary/90 text-black text-xs font-black uppercase italic tracking-widest rounded-2xl shadow-2xl shadow-primary/20 transition-all hover:scale-[1.02] active:scale-95"
                        >
                           Confirm Execution
                        </Button>
                     </div>
                  </motion.div>
               </Dialog>
            )}
         </AnimatePresence>

         {/* PO Details Modal */}
         <AnimatePresence>
            {isDetailsModalOpen && selectedPODetails && (
               <Dialog isOpen={isDetailsModalOpen} onClose={() => setIsDetailsModalOpen(false)} showTitle={false}>
                  <motion.div
                     initial={{ opacity: 0, scale: 0.95, y: 20 }}
                     animate={{ opacity: 1, scale: 1, y: 0 }}
                     exit={{ opacity: 0, scale: 0.95, y: 20 }}
                     className="space-y-10 max-h-[90vh] overflow-y-auto pr-2 custom-scrollbar p-2"
                  >
                     {/* Header */}
                     <div className="flex items-center justify-between mb-2">
                        <div className="bg-primary px-4 py-2 rounded-xl -skew-x-6 shadow-xl shadow-primary/20">
                           <h2 className="text-black font-black text-xl italic uppercase tracking-tighter">
                              ORDER.MANIFEST.EXTRACT
                           </h2>
                        </div>
                        <button
                           onClick={() => setIsDetailsModalOpen(false)}
                           className="p-3 hover:bg-muted/10 rounded-2xl text-muted hover:text-foreground transition-all"
                        >
                           <XCircle className="w-6 h-6" strokeWidth={3} />
                        </button>
                     </div>

                     {/* Top Info Bar */}
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                        <div className="p-6 bg-card/40 rounded-3xl border border-border backdrop-blur-xl relative overflow-hidden group shadow-xl">
                           <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-2 opacity-60">DESCRIPTOR</div>
                           <p className="text-foreground font-mono font-black text-lg">{selectedPODetails.po_number}</p>
                        </div>
                        <div className="p-6 bg-card/40 rounded-3xl border border-border backdrop-blur-xl relative overflow-hidden group shadow-xl">
                           <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-2 opacity-60">PROTOCOL_STATE</div>
                           <div>{getStatusBadge(selectedPODetails.status)}</div>
                        </div>
                        <div className="p-6 bg-card/40 rounded-3xl border border-border backdrop-blur-xl relative overflow-hidden group shadow-xl col-span-2">
                           <div className="text-[9px] font-black text-muted uppercase tracking-widest mb-2 opacity-60">STRATEGIC_PARTNER</div>
                           <p className="text-foreground font-black text-lg uppercase tracking-tight">{selectedPODetails.supplier?.name}</p>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Details Column */}
                        <div className="md:col-span-2 space-y-8">
                           {/* Items Table */}
                           <div className="bg-card/60 backdrop-blur-xl border border-border rounded-[2.5rem] overflow-hidden shadow-2xl">
                              <div className="px-8 py-6 border-b border-border bg-muted/5 flex items-center gap-3">
                                 <ShoppingBag className="w-4 h-4 text-primary" strokeWidth={3} />
                                 <h3 className="text-[10px] font-black text-foreground uppercase tracking-[0.2em] italic font-mono">MANIFEST.CONTENT</h3>
                              </div>
                              <table className="w-full text-sm text-left">
                                 <thead className="text-[9px] font-black text-muted uppercase bg-muted/5 border-b border-border tracking-widest font-mono">
                                    <tr>
                                       <th className="px-8 py-4">ITEM_NODE</th>
                                       <th className="px-5 py-4 text-center">VOLUME</th>
                                       <th className="px-5 py-4 text-right">UNIT_VAL</th>
                                       <th className="px-8 py-4 text-right">EXTENSION</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-border">
                                    {selectedPODetails.items?.map((item) => (
                                       <tr key={item.id} className="hover:bg-muted/5 transition-colors group">
                                          <td className="px-8 py-5">
                                             <p className="font-black text-foreground uppercase italic tracking-tight group-hover:text-primary transition-colors">{item.ingredient?.name}</p>
                                             <p className="text-[9px] text-muted font-black uppercase tracking-widest mt-1 opacity-60">{item.ingredient?.units?.abbreviation || item.ingredient?.unit_type}</p>
                                          </td>
                                          <td className="px-5 py-5 text-center text-foreground font-mono font-black text-base opacity-40">
                                             {item.ordered_quantity}
                                          </td>
                                          <td className="px-5 py-5 text-right text-muted font-mono font-black text-xs">
                                             <span className="text-[8px] mr-1 opacity-30">ETB</span>
                                             {item.unit_price.toLocaleString()}
                                          </td>
                                          <td className="px-8 py-5 text-right text-foreground font-black font-mono">
                                             <span className="text-[9px] mr-1 opacity-30">ETB</span>
                                             {(item.ordered_quantity * item.unit_price).toLocaleString()}
                                          </td>
                                       </tr>
                                    ))}
                                 </tbody>
                                 <tfoot className="bg-muted/10 font-mono">
                                    <tr>
                                       <td colSpan={3} className="px-8 py-6 text-right text-[10px] font-black text-muted uppercase tracking-widest opacity-60">TOTAL COMMITMENT</td>
                                       <td className="px-8 py-6 text-right text-xl font-black text-foreground italic tracking-tighter"><span className="text-xs mr-1 opacity-30 NOT-italic">ETB</span>{selectedPODetails.total_amount.toLocaleString()}</td>
                                    </tr>
                                 </tfoot>
                              </table>
                           </div>

                           {/* Shipments / GRNs if any */}
                           {selectedPODetails.grns && selectedPODetails.grns.length > 0 && (
                              <div className="bg-emerald-500/5 rounded-[2.5rem] border border-emerald-500/10 overflow-hidden shadow-xl">
                                 <div className="px-8 py-6 bg-emerald-500/10 border-b border-emerald-500/10 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                       <Truck className="w-4 h-4 text-emerald-500" strokeWidth={3} />
                                       <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.2em] italic font-mono">SHIPMENT.LOGS</h3>
                                    </div>
                                    <Badge className="bg-emerald-500/20 text-emerald-500 border-none font-black text-[9px] tracking-widest">{selectedPODetails.grns.length} VECTORS</Badge>
                                 </div>
                                 <div className="divide-y divide-emerald-500/10">
                                    {selectedPODetails.grns.map((grn) => (
                                       <div key={grn.id} className="px-8 py-5 flex items-center justify-between group hover:bg-emerald-500/5 transition-colors">
                                          <div>
                                             <p className="text-xs font-mono font-black text-foreground group-hover:text-emerald-500 transition-colors uppercase">{grn.grn_number}</p>
                                             <p className="text-[9px] text-muted font-black uppercase tracking-widest opacity-60 mt-1">{new Date(grn.received_date).toLocaleDateString()}</p>
                                          </div>
                                          <div className="text-right">
                                             <p className="text-[9px] font-black text-muted uppercase tracking-widest opacity-40 mb-1">TXNV_AUTH</p>
                                             <p className="text-xs font-mono text-foreground opacity-60 font-black">{grn.invoice_number}</p>
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           )}
                        </div>

                        {/* Activity Sidebar */}
                        <div className="space-y-8">
                           <div className="bg-card/40 rounded-[2.5rem] border border-border p-8 backdrop-blur-xl shadow-2xl relative overflow-hidden">
                              <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-r from-primary/0 via-primary/10 to-primary/0" />
                              <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.3em] italic font-mono mb-10 pb-5 border-b border-border">EVENT.LIFECYCLE</h3>
                              <div className="space-y-10 relative">
                                 {/* Timeline Line */}
                                 <div className="absolute left-[13px] top-3 bottom-3 w-[2px] bg-border opacity-60" />

                                 {selectedPODetails.activity_log?.slice().reverse().map((log, idx) => (
                                    <div key={log.id} className="relative pl-10 group/log">
                                       <div className={cn(
                                          "absolute left-0 top-1 w-7 h-7 rounded-lg flex items-center justify-center ring-4 ring-card z-10 transition-all duration-500 group-hover/log:scale-110",
                                          idx === 0 ? "bg-primary text-black shadow-lg shadow-primary/30" : "bg-muted/10 text-muted"
                                       )}>
                                          <CheckCircle2 className="w-4 h-4" strokeWidth={3} />
                                       </div>
                                       <div className="space-y-2">
                                          <div className="flex items-center justify-between">
                                             <span className="text-[10px] font-black text-foreground uppercase tracking-widest italic">{log.action_type}</span>
                                             <span className="text-[9px] text-muted font-black font-mono opacity-40">{new Date(log.created_at).toLocaleDateString()}</span>
                                          </div>
                                          <p className="text-[10px] text-muted font-black uppercase tracking-tight opacity-60">Auth: {log.performer?.full_name || 'System'}</p>
                                          {log.notes && (
                                             <div className="mt-3 p-4 bg-muted/5 rounded-2xl border border-border text-[10px] text-foreground font-medium italic relative overflow-hidden">
                                                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary/20" />
                                                "{log.notes}"
                                             </div>
                                          )}
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </div>

                           <div className="p-6 bg-primary/5 rounded-3xl border border-primary/10 border-dashed group hover:bg-primary/10 transition-colors">
                              <p className="text-[9px] font-black text-primary uppercase tracking-[0.3em] italic mb-2">ORIGIN_NODE</p>
                              <p className="text-xs text-foreground font-black uppercase">{selectedPODetails.creator?.full_name}</p>
                              <p className="text-[9px] text-muted font-mono mt-1 font-black opacity-40">{new Date(selectedPODetails.created_at).toLocaleString()}</p>
                           </div>
                        </div>
                     </div>
                  </motion.div>
               </Dialog>
            )}
         </AnimatePresence>
         {/* Deletion Confirmation Modal */}
         <AnimatePresence>
            {deleteConfirmationPOId && (
               <Dialog isOpen={!!deleteConfirmationPOId} onClose={() => setDeleteConfirmationPOId(null)} showTitle={false}>
                  <motion.div
                     initial={{ opacity: 0, scale: 0.95, y: 20 }}
                     animate={{ opacity: 1, scale: 1, y: 0 }}
                     exit={{ opacity: 0, scale: 0.95, y: 20 }}
                     className="p-12 space-y-10 text-center"
                  >
                     <div className="mx-auto w-24 h-24 bg-red-500/10 rounded-[2rem] flex items-center justify-center mb-4 relative group">
                        <div className="absolute inset-0 bg-red-500/20 blur-2xl opacity-0 group-hover:opacity-100 transition-opacity" />
                        <AlertCircle className="w-12 h-12 text-red-500 animate-pulse relative z-10" strokeWidth={3} />
                     </div>

                     <div className="space-y-4">
                        <div className="bg-red-500 px-5 py-2 rounded-xl -skew-x-6 inline-block shadow-xl shadow-red-500/20">
                           <h2 className="text-white font-black text-2xl italic uppercase tracking-tighter">
                              {t('common.delete')}?
                           </h2>
                        </div>
                        <p className="text-muted text-lg font-medium max-w-sm mx-auto">
                           Are you sure you want to terminate this procurement draft? This action is irreversible.
                        </p>
                     </div>

                     <div className="flex gap-4 pt-6">
                        <Button
                           variant="ghost"
                           onClick={() => setDeleteConfirmationPOId(null)}
                           className="flex-1 h-16 border border-border text-muted hover:text-foreground hover:bg-muted/10 text-xs font-black uppercase tracking-widest rounded-2xl transition-all"
                        >
                           Abort
                        </Button>
                        <Button
                           onClick={confirmDelete}
                           className="flex-1 h-16 bg-red-600 hover:bg-red-700 text-white text-xs font-black uppercase italic tracking-widest rounded-2xl shadow-2xl shadow-red-600/30 transition-all hover:scale-[1.02] active:scale-95"
                        >
                           Terminate Draft
                        </Button>
                     </div>
                  </motion.div>
               </Dialog>
            )}
         </AnimatePresence>
      </DashboardLayout>
   );
};

export default ManagerPurchaseOrders;
