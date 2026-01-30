
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
   ingredient?: { name: string; unit_type: string };
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

   // Fetch Suppliers
   const { data: suppliers } = useQuery({
      queryKey: ['suppliers'],
      queryFn: async () => {
         const { data, error } = await supabase.from('suppliers').select('*');
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
           items:purchase_order_items(*, ingredient:ingredients(name, unit_type, current_stock, par_min)),
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
         if (!user || !supplierId) throw new Error("Missing supplier or user");

         const validItems = items.filter(i => i.ingredientId && i.qty > 0);
         if (validItems.length === 0) throw new Error("Please add at least one valid item");

         let poId = editingPOData?.id;

         if (poId) {
            const { error: updateError } = await supabase
               .from('purchase_orders')
               .update({
                  supplier_id: supplierId,
                  expected_delivery: deliveryDate,
                  total_amount: items.reduce((sum, item) => sum + (item.qty * item.price), 0),
                  status: isDraft ? 'draft' : (isOwnerOrAdmin ? 'sent' : 'pending_approval')
               })
               .eq('id', poId);

            if (updateError) throw updateError;
            await supabase.from('purchase_order_items').delete().eq('po_id', poId);
         } else {
            const seq = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
            const po_number = `PO-${new Date().getFullYear()}-${seq}`;

            const { data: po, error: poError } = await supabase
               .from('purchase_orders')
               .insert({
                  po_number,
                  supplier_id: supplierId,
                  branch_id: activeBranchId,
                  expected_delivery: deliveryDate,
                  total_amount: items.reduce((sum, item) => sum + (item.qty * item.price), 0),
                  status: isDraft ? 'draft' : (isOwnerOrAdmin ? 'sent' : 'pending'),
                  created_by: user.id
               })
               .select()
               .single();

            if (poError) throw poError;
            poId = po.id;
         }

         const poItems = validItems.map(row => ({
            po_id: poId,
            ingredient_id: row.ingredientId,
            ordered_quantity: row.qty,
            unit_price: row.price
         }));

         const { error: itemsError } = await supabase.from('purchase_order_items').insert(poItems);
         if (itemsError) throw itemsError;

         await supabase.from('po_activity_log').insert({
            po_id: poId,
            action_type: isDraft ? 'created' : (isOwnerOrAdmin ? 'sent' : 'submitted'),
            performed_by: user.id,
            notes: notes || (isDraft ? 'Draft saved' : (isOwnerOrAdmin ? 'PO sent to supplier' : 'Submitted for Owner approval'))
         });
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

         const allComplete = receiveItems.every(i => (i.received_quantity + i.previously_received) >= i.ordered_quantity);

         // 1. Create GRN
         const seq = Math.floor(Math.random() * 10000);
         const grnNumber = `GRN-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;

         const { data: grn, error: grnError } = await supabase
            .from('goods_received_notes')
            .insert({
               po_id: selectedPOForReceive.id,
               grn_number: grnNumber,
               received_date: receivedDate,
               invoice_number: invoiceNumber,
               received_by: user.id,
               status: allComplete ? 'complete' : 'partial'
            })
            .select()
            .single();

         if (grnError) throw grnError;

         // 2. Insert GRN Items
         const grnItemsPayload = receiveItems.map(item => ({
            grn_id: grn.id,
            ingredient_id: item.ingredient_id,
            ordered_quantity: item.ordered_quantity,
            received_quantity: item.received_quantity
         }));

         const { error: itemsError } = await supabase.from('grn_items').insert(grnItemsPayload);
         if (itemsError) throw itemsError;

         // 3. Update Inventory (Transactions)
         const transactions = receiveItems.map(item => ({
            branch_id: activeBranchId,
            ingredient_id: item.ingredient_id,
            transaction_type: 'purchase',
            quantity: item.received_quantity,
            reference_type: 'grn',
            reference_id: grn.id,
            performed_by: user.id
         }));

         const { error: transError } = await supabase.from('inventory_transactions').insert(transactions);
         if (transError) {
            console.warn("Transaction log failed, updating stock directly", transError);
            for (const item of receiveItems) {
               await supabase.rpc('increment_stock', {
                  row_id: item.ingredient_id,
                  quantity: item.received_quantity
               });
            }
         }

         // 4. Update PO Status
         const { error: poError } = await supabase
            .from('purchase_orders')
            .update({
               status: allComplete ? 'verified' : 'partial_received',
               received_date: receivedDate
            })
            .eq('id', selectedPOForReceive.id);

         if (poError) throw poError;
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
                  updated.unit = ing.unit_type;
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
         unit: i.ingredient?.unit_type || '-',
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
                  {/* Form Section - SOSHA STYLE */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                     {/* LEFT: Order Details */}
                     <div className="md:col-span-1 space-y-6">
                        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
                           <div className="absolute inset-0 bg-gradient-to-br from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                           <h3 className="flex items-center gap-2 text-sm font-black text-blue-400 uppercase tracking-widest mb-6">
                              <Truck className="w-4 h-4" /> Order Details
                           </h3>

                           <div className="space-y-5">
                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">{t('po.supplier')}</label>
                                 <div className="relative">
                                    <select
                                       className="w-full h-12 bg-black/20 border border-white/10 rounded-xl px-4 text-sm font-bold text-white focus:outline-none focus:border-blue-500/50 focus:bg-white/5 appearance-none hover:border-white/20 transition-all cursor-pointer z-10 relative"
                                       value={supplierId}
                                       onChange={(e) => setSupplierId(e.target.value)}
                                    >
                                       <option value="" className="bg-black text-gray-500">{t('po.selectSupplier')}</option>
                                       {suppliers?.map(s => (
                                          <option key={s.id} value={s.id} className="bg-zinc-900">{s.name}</option>
                                       ))}
                                    </select>
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
                                       <ArrowRight className="w-3 h-3 text-white/20" />
                                    </div>
                                 </div>
                              </div>

                              <div className="space-y-2">
                                 <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest pl-1">{t('po.deliveryDate')}</label>
                                 <div className="relative group/date">
                                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500 group-hover/date:text-blue-400 transition-colors" />
                                    <Input
                                       type="date"
                                       value={deliveryDate}
                                       onChange={(e) => setDeliveryDate(e.target.value)}
                                       className="pl-12 h-12 bg-black/20 border-white/10 rounded-xl text-white font-bold focus:border-blue-500/50 focus:bg-white/5"
                                    />
                                 </div>
                              </div>
                           </div>
                        </div>

                        {/* Summary Card */}
                        <div className="bg-gradient-to-br from-amber-500/10 to-black/40 border border-amber-500/20 rounded-3xl p-6 text-center">
                           <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1">Total Estimated Cost</p>
                           <h2 className="text-4xl font-black text-white tracking-tight drop-shadow-[0_0_15px_rgba(245,158,11,0.3)]">
                              <span className="text-lg align-top opacity-50 mr-1">$</span>
                              {totalAmount.toLocaleString()}
                           </h2>
                        </div>
                     </div>

                     {/* RIGHT: Items Table */}
                     <div className="md:col-span-2">
                        <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-2xl flex flex-col h-full min-h-[500px]">
                           <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
                              <h3 className="flex items-center gap-2 text-sm font-black text-amber-400 uppercase tracking-widest">
                                 <ShoppingBag className="w-4 h-4" /> Order Items
                              </h3>
                              <Button
                                 size="sm"
                                 onClick={addItem}
                                 className="bg-white/5 text-white hover:bg-white/10 border border-white/5 rounded-xl font-bold text-xs h-9 px-4 backdrop-blur-md"
                              >
                                 <Plus className="w-3.5 h-3.5 mr-2" /> Add Item
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

                  {/* Footer Actions - FLOATING GLASS */}
                  <div className="fixed bottom-6 left-1/2 -translate-x-1/2 md:translate-x-0 md:left-auto md:right-6 w-[95%] md:w-auto p-2 bg-black/80 backdrop-blur-2xl border border-white/10 rounded-2xl z-[100] shadow-[0_10px_40px_rgba(0,0,0,0.5)] animate-in slide-in-from-bottom-10 fade-in duration-500 flex items-center justify-between gap-6 pr-3">
                     <div className="hidden md:flex flex-col pl-4">
                        <span className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Total Amount</span>
                        <div className="text-xl font-black text-white font-mono leading-none flex items-start gap-1">
                           <span className="text-xs text-amber-500 mt-1">$</span>
                           {totalAmount.toLocaleString()}
                        </div>
                     </div>

                     <div className="flex items-center gap-2 w-full md:w-auto">
                        <Button
                           variant="ghost"
                           className="text-gray-400 hover:text-white hover:bg-white/10 rounded-xl"
                           onClick={() => createPO({ isDraft: true })}
                           disabled={isSaving || !supplierId}
                        >
                           <Save className="w-4 h-4 mr-2" /> Save Draft
                        </Button>
                        <Button
                           className="bg-amber-500 hover:bg-amber-400 text-black font-black rounded-xl px-6 shadow-[0_0_20px_rgba(245,158,11,0.3)] transition-all hover:scale-105"
                           onClick={() => {
                              if (isOwnerOrAdmin) createPO({ isDraft: false });
                              else handleActionWithNote(editingPOData?.id || 'new', 'submission');
                           }}
                           disabled={isSaving || !supplierId}
                        >
                           {isOwnerOrAdmin ? (
                              <>
                                 <Send className="w-4 h-4 mr-2" /> Send Order
                              </>
                           ) : (
                              <>
                                 <CheckCircle2 className="w-4 h-4 mr-2" /> Submit
                              </>
                           )}
                        </Button>
                     </div>
                  </div>
               </div>
            ) : (
               <>
                  {/* Controls */}
                  <div className="flex flex-col md:flex-row justify-between gap-4 items-center">
                     {/* Tabs */}
                     <div className="flex bg-[#1A1A1A] p-1 rounded-lg border border-gray-800 w-full md:w-auto overflow-x-auto">
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
                              all: 'All',
                              draft: 'Draft',
                              sent: 'Sent',
                              partial: 'Partial / Approved',
                              received: 'Received'
                           };

                           return (
                              <button
                                 key={status}
                                 onClick={() => setFilterStatus(status)}
                                 className={cn(
                                    "px-4 py-2 text-sm font-medium rounded-md transition-all flex items-center gap-2 whitespace-nowrap",
                                    filterStatus === status
                                       ? "bg-white/10 text-white shadow-sm"
                                       : "text-gray-400 hover:text-white hover:bg-white/5"
                                 )}
                              >
                                 {labels[status]}
                                 <span className={cn("text-xs px-1.5 py-0.5 rounded-full", filterStatus === status ? "bg-black/40 text-white" : "bg-black/20 text-gray-500")}>
                                    {count}
                                 </span>
                              </button>
                           );
                        })}
                     </div>

                     {/* Search */}
                     <div className="relative w-full md:w-72">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-500" />
                        <Input
                           placeholder={t('common.search')}
                           value={searchTerm}
                           onChange={(e) => setSearchTerm(e.target.value)}
                           className="pl-9 bg-[#1A1A1A] border-gray-800 focus:border-primary/50"
                        />
                     </div>
                  </div>

                  {/* Table */}
                  <Card className="bg-[#1A1A1A] border-gray-800 min-h-[500px] flex flex-col">
                     <CardHeader className="border-b border-gray-800 pb-3">
                        <CardTitle className="text-white flex items-center gap-2 text-base">
                           <Truck className="w-5 h-5 text-gray-400" /> {t('po.listTitle')}
                        </CardTitle>
                     </CardHeader>
                     <CardContent className="p-0 flex-1 overflow-x-auto">
                        <table className="w-full text-sm text-left">
                           <thead className="text-xs text-gray-500 uppercase bg-black/40 border-b border-gray-800">
                              <tr>
                                 <th className="px-6 py-4">{t('po.table.poNumber')}</th>
                                 <th className="px-6 py-4">{t('po.table.supplier')}</th>
                                 <th className="px-6 py-4">Created By</th>
                                 <th className="px-6 py-4">{t('po.table.created')}</th>
                                 <th className="px-6 py-4">{t('po.table.expected')}</th>
                                 <th className="px-6 py-4 text-right">{t('po.table.amount')}</th>
                                 <th className="px-6 py-4 text-center">{t('po.table.status')}</th>
                                 <th className="px-6 py-4 text-right w-20">{t('po.table.actions')}</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-800">
                              {isLoading && (
                                 <tr><td colSpan={7} className="p-8 text-center text-gray-500">{t('common.loading')}</td></tr>
                              )}
                              {!isLoading && filteredPOs.length === 0 && (
                                 <tr><td colSpan={7} className="p-8 text-center text-gray-500">{t('po.empty')}</td></tr>
                              )}
                              {filteredPOs.map((po) => (
                                 <tr key={po.id} className="hover:bg-white/5 transition-colors group">
                                    <td className="px-6 py-4 font-mono font-bold text-white">{po.po_number}</td>
                                    <td className="px-6 py-4 text-gray-300 font-medium">{po.supplier?.name || 'Unknown'}</td>
                                    <td className="px-6 py-4 text-gray-400 text-xs italic">{po.creator?.full_name || 'System'}</td>
                                    <td className="px-6 py-4 text-gray-400 text-xs">
                                       {new Date(po.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-gray-400 text-xs">
                                       {new Date(po.expected_delivery).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4 text-right font-mono text-primary font-bold">
                                       ETB {po.total_amount.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                       <div className="flex flex-col items-center gap-1">
                                          {getStatusBadge(po.status)}
                                          {po.activity_log && po.activity_log.length > 0 && po.activity_log[po.activity_log.length - 1].notes && (
                                             <div className="max-w-[150px] truncate text-[10px] text-gray-400 italic" title={po.activity_log[po.activity_log.length - 1].notes}>
                                                "{po.activity_log[po.activity_log.length - 1].notes}"
                                             </div>
                                          )}
                                       </div>
                                    </td>
                                    <td className="px-6 py-4 text-right relative">
                                       <button
                                          onClick={(e) => { e.stopPropagation(); setActiveDropdown(activeDropdown === po.id ? null : po.id); }}
                                          className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
                                       >
                                          <MoreVertical className="w-4 h-4" />
                                       </button>

                                       {activeDropdown === po.id && (
                                          <div className="absolute right-8 top-8 w-48 bg-[#222] border border-gray-700 rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-100">
                                             <div className="p-1">
                                                <button
                                                   onClick={() => handleViewDetails(po)}
                                                   className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded flex items-center gap-2"
                                                >
                                                   <Eye className="w-4 h-4" /> {t('po.actions.view')}
                                                </button>
                                                <button
                                                   onClick={handleDownload}
                                                   className="w-full text-left px-3 py-2 text-sm text-gray-300 hover:bg-white/10 hover:text-white rounded flex items-center gap-2"
                                                >
                                                   <Download className="w-4 h-4" /> {t('po.actions.download')}
                                                </button>

                                                {(po.status === 'draft' || po.status === 'needs_revision') && (
                                                   <button
                                                      onClick={() => handleEdit(po)}
                                                      className="w-full text-left px-3 py-2 text-sm text-yellow-400 hover:bg-yellow-500/10 rounded flex items-center gap-2"
                                                   >
                                                      <Plus className="w-4 h-4" /> {t('po.actions.edit')}
                                                   </button>
                                                )}

                                                {/* Owner Approval Actions */}
                                                {isOwnerOrAdmin && (po.status === 'pending_approval' || po.status === 'pending') && (
                                                   <>
                                                      <button
                                                         onClick={() => handleActionWithNote(po.id, 'approval')}
                                                         className="w-full text-left px-3 py-2 text-sm text-emerald-400 hover:bg-emerald-500/10 rounded flex items-center gap-2 border-t border-gray-700 mt-1"
                                                      >
                                                         <CheckCircle className="w-4 h-4" /> Approve Only
                                                      </button>
                                                      <button
                                                         onClick={() => { approveAndSendPO(po.id); setActiveDropdown(null); }}
                                                         className="w-full text-left px-3 py-2 text-sm text-green-400 hover:bg-green-500/10 rounded flex items-center gap-2"
                                                      >
                                                         <Send className="w-4 h-4" /> Approve & Send
                                                      </button>
                                                      <button
                                                         onClick={() => handleActionWithNote(po.id, 'revision')}
                                                         className="w-full text-left px-3 py-2 text-sm text-orange-400 hover:bg-orange-500/10 rounded flex items-center gap-2"
                                                      >
                                                         <RotateCcw className="w-4 h-4" /> Send Back (Revision)
                                                      </button>
                                                   </>
                                                )}

                                                {po.status === 'approved' && (
                                                   <button
                                                      onClick={() => { sendPO(po.id); setActiveDropdown(null); }}
                                                      className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-blue-500/10 rounded flex items-center gap-2"
                                                   >
                                                      <Send className="w-4 h-4" /> Send to Supplier
                                                   </button>
                                                )}

                                                {(po.status === 'sent' || po.status === 'partial_received') && (
                                                   <button onClick={() => openReceiveModal(po)} className="w-full text-left px-3 py-2 text-sm text-blue-400 hover:bg-blue-500/10 rounded flex items-center gap-2">
                                                      <PackageCheck className="w-4 h-4" /> {t('po.actions.receive')}
                                                   </button>
                                                )}

                                                {po.status === 'draft' && (
                                                   <button onClick={() => handleDelete(po.id)} className="w-full text-left px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded flex items-center gap-2 border-t border-gray-700 mt-1">
                                                      <Trash2 className="w-4 h-4" /> {t('po.actions.delete')}
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
                     </CardContent>
                  </Card>

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
                     className="space-y-6 max-h-[85vh] overflow-y-auto pr-2 custom-scrollbar p-1"
                  >
                     {/* Header with High-Contrast Highlight */}
                     <div className="flex items-center justify-between mb-8">
                        <div className="bg-[#FFCC00] px-3 py-1 inline-block -skew-x-2">
                           <h2 className="text-black font-black text-xl italic uppercase tracking-tighter">
                              {t('grn.receiveModalTitle')}
                           </h2>
                        </div>
                        <button
                           onClick={() => setIsReceiveModalOpen(false)}
                           className="p-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors"
                        >
                           <XCircle className="w-6 h-6" />
                        </button>
                     </div>

                     {/* PO Info Cards */}
                     <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-black/40 rounded-xl border border-gray-800/50 backdrop-blur-md relative overflow-hidden group">
                           <div className="bg-[#FFCC00] px-2 py-0.5 inline-block text-[10px] font-black text-black uppercase mb-2">
                              {t('grn.poNumber')}
                           </div>
                           <p className="text-white font-mono text-lg font-bold group-hover:text-[#FFCC00] transition-colors">
                              {selectedPOForReceive?.po_number}
                           </p>
                        </div>
                        <div className="p-4 bg-black/40 rounded-xl border border-gray-800/50 backdrop-blur-md group">
                           <div className="bg-[#FFCC00] px-2 py-0.5 inline-block text-[10px] font-black text-black uppercase mb-2">
                              {t('stock.supplier')}
                           </div>
                           <p className="text-white text-lg font-bold group-hover:text-[#FFCC00] transition-colors">
                              {selectedPOForReceive?.supplier?.name}
                           </p>
                        </div>
                     </div>

                     {/* Date & Invoice Inputs */}
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6 bg-white/5 rounded-2xl border border-white/10">
                        <div className="space-y-3">
                           <div className="bg-[#FFCC00] px-2 py-0.5 inline-block text-[10px] font-black text-black uppercase">
                              {t('grn.receivedDate')}
                           </div>
                           <div className="relative group">
                              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#FFCC00] pointer-events-none" />
                              <Input
                                 type="date"
                                 value={receivedDate}
                                 onChange={(e) => setReceivedDate(e.target.value)}
                                 className="pl-11 h-12 bg-black/40 border-gray-800 focus:border-[#FFCC00] focus:ring-1 focus:ring-[#FFCC00] text-white rounded-xl transition-all"
                              />
                           </div>
                        </div>
                        <div className="space-y-3">
                           <div className="bg-[#FFCC00] px-2 py-0.5 inline-block text-[10px] font-black text-black uppercase">
                              {t('grn.invoiceNumber')}
                           </div>
                           <div className="relative group">
                              <FileText className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-[#FFCC00] pointer-events-none" />
                              <Input
                                 type="text"
                                 value={invoiceNumber}
                                 onChange={(e) => setInvoiceNumber(e.target.value)}
                                 placeholder="e.g. INV-0092"
                                 className="pl-11 h-12 bg-black/40 border-gray-800 focus:border-[#FFCC00] focus:ring-1 focus:ring-[#FFCC00] text-white rounded-xl transition-all"
                              />
                           </div>
                        </div>
                     </div>

                     {/* Items Section Header */}
                     <div className="flex items-center justify-between px-2">
                        <div className="flex items-center gap-2">
                           <Package className="w-5 h-5 text-[#FFCC00]" />
                           <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest italic font-mono">
                              GRN.ITEMS
                           </h3>
                        </div>
                        <Button
                           size="sm"
                           variant="ghost"
                           onClick={matchAllQuantities}
                           className="text-[10px] font-bold text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 flex items-center gap-1.5 transition-all"
                        >
                           <CheckCircle2 className="w-3.5 h-3.5" />
                           {t('grn.matchAll') || 'Match Order Quantities'}
                        </Button>
                     </div>

                     {/* Items Table */}
                     <div className="border border-gray-800/50 rounded-2xl overflow-hidden bg-black/20 backdrop-blur-sm">
                        <table className="w-full text-sm text-left">
                           <thead className="text-[10px] font-black text-gray-500 uppercase bg-black/60 border-b border-gray-800 tracking-wider font-mono">
                              <tr>
                                 <th className="px-6 py-4 italic font-bold">INGREDIENT</th>
                                 <th className="px-4 py-4 w-24 text-center italic font-bold">ORDERED</th>
                                 <th className="px-4 py-4 w-24 text-center italic font-bold text-gray-400">PREV</th>
                                 <th className="px-4 py-4 w-28 text-center italic font-bold">RECEIVING</th>
                                 <th className="px-6 py-4 w-32 text-right italic font-bold uppercase">STATUS</th>
                              </tr>
                           </thead>
                           <tbody className="divide-y divide-gray-800">
                              {receiveItems.map((item, idx) => {
                                 const status = getMatchStatus(item.ordered_quantity, item.received_quantity, item.previously_received);
                                 return (
                                    <motion.tr
                                       key={item.id}
                                       initial={{ opacity: 0, x: -10 }}
                                       animate={{ opacity: 1, x: 0 }}
                                       transition={{ delay: idx * 0.05 }}
                                       className="hover:bg-white/5 transition-colors group"
                                    >
                                       <td className="px-6 py-5">
                                          <p className="font-black text-gray-100 uppercase italic tracking-tight group-hover:text-[#FFCC00] transition-colors">{item.ingredient?.name}</p>
                                          <p className="text-[10px] text-gray-500 font-mono mt-0.5">{item.ingredient?.unit_type}</p>
                                       </td>
                                       <td className="px-4 py-5 text-center text-gray-400 font-mono text-base">
                                          {item.ordered_quantity}
                                       </td>
                                       <td className="px-4 py-5 text-center text-gray-500 font-mono text-sm">
                                          {item.previously_received}
                                       </td>
                                       <td className="px-4 py-5">
                                          <div className="relative group/input flex justify-center">
                                             <Input
                                                type="text"
                                                inputMode="decimal"
                                                className="h-10 w-24 bg-black/60 border-gray-800 group-hover/input:border-[#FFCC00]/50 focus:border-[#FFCC00] text-center font-bold text-white transition-all rounded-lg"
                                                value={qtyBuffer[item.id] || ""}
                                                onChange={(e) => updateReceivedQty(item.id, e.target.value)}
                                             />
                                          </div>
                                       </td>
                                       <td className="px-6 py-5 text-right">
                                          <Badge className={cn(
                                             "px-3 py-1 font-black text-[10px] tracking-widest uppercase italic border-0 shadow-lg",
                                             status.label === t('grn.complete') || status.label === 'Complete'
                                                ? "bg-emerald-500/10 text-emerald-500 shadow-emerald-500/5 ring-1 ring-emerald-500/20"
                                                : status.label === t('grn.over') || status.label === 'Over'
                                                   ? "bg-orange-500/10 text-orange-500 ring-1 ring-orange-500/20"
                                                   : "bg-yellow-500/10 text-yellow-500 ring-1 ring-yellow-500/20"
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
                     <div className="flex items-center justify-end gap-6 pt-4">
                        <button
                           onClick={() => setIsReceiveModalOpen(false)}
                           disabled={isConfirmingReceipt}
                           className="text-white font-black text-sm uppercase tracking-widest hover:text-[#FFCC00] transition-colors disabled:opacity-50"
                        >
                           {t('common.cancel')}
                        </button>
                        <Button
                           className="h-14 px-10 bg-[#FFCC00] hover:bg-[#E6B800] active:scale-95 text-black font-black uppercase italic tracking-tighter text-lg rounded-2xl shadow-[0_0_20px_rgba(255,204,0,0.3)] transition-all flex items-center gap-3 disabled:opacity-50"
                           onClick={() => confirmReceipt()}
                           disabled={isConfirmingReceipt || !invoiceNumber}
                        >
                           {isConfirmingReceipt ? (
                              <div className="w-5 h-5 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                           ) : (
                              <>
                                 <CheckCircle2 className="w-6 h-6" />
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
                     className="p-8 space-y-6"
                  >
                     <div className="flex items-center gap-4 mb-2">
                        <div className="bg-[#FFCC00] px-3 py-1 inline-block -skew-x-2">
                           <h2 className="text-black font-black text-xl italic uppercase tracking-tighter">
                              {noteModalData.title}
                           </h2>
                        </div>
                     </div>

                     <div className="space-y-4">
                        <p className="text-gray-400 text-sm font-medium uppercase tracking-wider">
                           Add a message or reason for this action:
                        </p>
                        <textarea
                           autoFocus
                           value={noteText}
                           onChange={(e) => setNoteText(e.target.value)}
                           placeholder={noteModalData.action === 'revision' ? "e.g. We already have 10kg of onions. Please verify stock." : "Add a note..."}
                           className="w-full h-32 bg-black/40 border border-gray-800 focus:border-[#FFCC00] focus:ring-1 focus:ring-[#FFCC00] text-white rounded-2xl p-4 transition-all resize-none custom-scrollbar"
                        />
                     </div>

                     <div className="flex gap-4 pt-2">
                        <Button
                           variant="outline"
                           onClick={() => setNoteModalData(null)}
                           className="flex-1 h-14 border-gray-700 hover:bg-white/5 text-gray-300 text-lg font-bold rounded-2xl"
                        >
                           Cancel
                        </Button>
                        <Button
                           onClick={submitNoteAction}
                           className="flex-1 h-14 bg-[#FFCC00] hover:bg-[#E6B800] text-black text-lg font-black uppercase italic rounded-2xl shadow-xl shadow-[#FFCC00]/10"
                        >
                           Confirm
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
                     className="space-y-6 max-h-[90vh] overflow-y-auto pr-2 custom-scrollbar p-1"
                  >
                     {/* Header */}
                     <div className="flex items-center justify-between mb-2">
                        <div className="bg-[#FFCC00] px-3 py-1 inline-block -skew-x-2">
                           <h2 className="text-black font-black text-xl italic uppercase tracking-tighter">
                              ORDER.DETAILS
                           </h2>
                        </div>
                        <button
                           onClick={() => setIsDetailsModalOpen(false)}
                           className="p-2 hover:bg-white/10 rounded-full text-gray-400 transition-colors"
                        >
                           <XCircle className="w-6 h-6" />
                        </button>
                     </div>

                     {/* Top Info Bar */}
                     <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="p-4 bg-black/40 rounded-xl border border-gray-800/50 backdrop-blur-md">
                           <div className="text-[10px] font-black text-gray-500 uppercase mb-1">PO NUMBER</div>
                           <p className="text-white font-mono font-bold">{selectedPODetails.po_number}</p>
                        </div>
                        <div className="p-4 bg-black/40 rounded-xl border border-gray-800/50 backdrop-blur-md">
                           <div className="text-[10px] font-black text-gray-500 uppercase mb-1">STATUS</div>
                           <div>{getStatusBadge(selectedPODetails.status)}</div>
                        </div>
                        <div className="p-4 bg-black/40 rounded-xl border border-gray-800/50 backdrop-blur-md col-span-2">
                           <div className="text-[10px] font-black text-gray-500 uppercase mb-1">SUPPLIER</div>
                           <p className="text-white font-bold">{selectedPODetails.supplier?.name}</p>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Details Column */}
                        <div className="md:col-span-2 space-y-6">
                           {/* Items Table */}
                           <div className="bg-white/5 rounded-2xl border border-white/10 overflow-hidden">
                              <div className="px-6 py-4 bg-black/40 border-b border-white/5 flex items-center gap-2">
                                 <Package className="w-4 h-4 text-[#FFCC00]" />
                                 <h3 className="text-xs font-black text-white uppercase tracking-widest italic font-mono">ORDERED.ITEMS</h3>
                              </div>
                              <table className="w-full text-sm text-left">
                                 <thead className="text-[10px] font-black text-gray-500 uppercase bg-black/20 border-b border-gray-800 font-mono">
                                    <tr>
                                       <th className="px-6 py-4">ITEM</th>
                                       <th className="px-4 py-4 text-center">QTY</th>
                                       <th className="px-4 py-4 text-right">UNIT PRICE</th>
                                       <th className="px-6 py-4 text-right">SUBTOTAL</th>
                                    </tr>
                                 </thead>
                                 <tbody className="divide-y divide-gray-800">
                                    {selectedPODetails.items?.map((item) => (
                                       <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                          <td className="px-6 py-4">
                                             <p className="font-bold text-gray-100 uppercase italic">{item.ingredient?.name}</p>
                                             <p className="text-[10px] text-gray-500 font-mono">{item.ingredient?.unit_type}</p>
                                          </td>
                                          <td className="px-4 py-4 text-center text-gray-300 font-mono text-base">
                                             {item.ordered_quantity}
                                          </td>
                                          <td className="px-4 py-4 text-right text-gray-400 font-mono">
                                             ETB {item.unit_price.toLocaleString()}
                                          </td>
                                          <td className="px-6 py-4 text-right text-primary font-bold font-mono">
                                             ETB {(item.ordered_quantity * item.unit_price).toLocaleString()}
                                          </td>
                                       </tr>
                                    ))}
                                 </tbody>
                                 <tfoot className="bg-black/40 font-mono">
                                    <tr>
                                       <td colSpan={3} className="px-6 py-4 text-right text-[10px] font-black text-gray-500 uppercase">{t('po.total')}</td>
                                       <td className="px-6 py-4 text-right text-lg font-black text-primary italic">ETB {selectedPODetails.total_amount.toLocaleString()}</td>
                                    </tr>
                                 </tfoot>
                              </table>
                           </div>

                           {/* Shipments / GRNs if any */}
                           {selectedPODetails.grns && selectedPODetails.grns.length > 0 && (
                              <div className="bg-emerald-500/5 rounded-2xl border border-emerald-500/10 overflow-hidden">
                                 <div className="px-6 py-4 bg-emerald-500/10 border-b border-emerald-500/10 flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                       <Truck className="w-4 h-4 text-emerald-400" />
                                       <h3 className="text-xs font-black text-emerald-400 uppercase tracking-widest italic font-mono">SHIPMENT.HISTORY</h3>
                                    </div>
                                    <Badge variant="success" className="bg-emerald-500/20 text-emerald-400 border-none">{selectedPODetails.grns.length} SHIPMENTS</Badge>
                                 </div>
                                 <div className="divide-y divide-emerald-500/10">
                                    {selectedPODetails.grns.map((grn) => (
                                       <div key={grn.id} className="px-6 py-4 flex items-center justify-between group hover:bg-emerald-500/5 transition-colors">
                                          <div>
                                             <p className="text-xs font-mono font-bold text-gray-300 group-hover:text-emerald-400">{grn.grn_number}</p>
                                             <p className="text-[10px] text-gray-500">{new Date(grn.received_date).toLocaleDateString()}</p>
                                          </div>
                                          <div className="text-right">
                                             <p className="text-[10px] font-black text-gray-500 uppercase">INVOICE</p>
                                             <p className="text-xs font-mono text-gray-400">{grn.invoice_number}</p>
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           )}
                        </div>

                        {/* Activity Sidebar */}
                        <div className="space-y-6">
                           <div className="bg-black/40 rounded-2xl border border-gray-800/50 p-6 backdrop-blur-md">
                              <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest italic font-mono mb-6 border-b border-gray-800 pb-4">ACTIVITY.FEED</h3>
                              <div className="space-y-8 relative">
                                 {/* Timeline Line */}
                                 <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-gray-800" />

                                 {selectedPODetails.activity_log?.slice().reverse().map((log, idx) => (
                                    <div key={log.id} className="relative pl-8">
                                       <div className={cn(
                                          "absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center ring-4 ring-[#1A1A1A] z-10",
                                          idx === 0 ? "bg-[#FFCC00] text-black" : "bg-gray-800 text-gray-400"
                                       )}>
                                          <CheckCircle2 className="w-3.5 h-3.5" />
                                       </div>
                                       <div className="space-y-1">
                                          <div className="flex items-center justify-between">
                                             <span className="text-[10px] font-black text-white uppercase tracking-tighter italic">{log.action_type}</span>
                                             <span className="text-[10px] text-gray-600 font-mono">{new Date(log.created_at).toLocaleDateString()}</span>
                                          </div>
                                          <p className="text-[11px] text-gray-400 italic">By {log.performer?.full_name || 'System'}</p>
                                          {log.notes && (
                                             <div className="mt-2 p-3 bg-white/5 rounded-lg border border-white/5 text-[11px] text-gray-300 italic ring-1 ring-inset ring-white/5">
                                                "{log.notes}"
                                             </div>
                                          )}
                                       </div>
                                    </div>
                                 ))}
                              </div>
                           </div>

                           <div className="p-4 bg-[#FFCC00]/5 rounded-xl border border-[#FFCC00]/10 border-dashed">
                              <p className="text-[10px] font-black text-[#FFCC00] uppercase italic mb-1">Created By</p>
                              <p className="text-xs text-gray-400 font-bold">{selectedPODetails.creator?.full_name}</p>
                              <p className="text-[10px] text-gray-600 font-mono mt-0.5">{new Date(selectedPODetails.created_at).toLocaleString()}</p>
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
                     className="p-8 space-y-8 text-center"
                  >
                     <div className="mx-auto w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-4">
                        <AlertCircle className="w-10 h-10 text-red-500 animate-pulse" />
                     </div>

                     <div className="space-y-3">
                        <div className="bg-red-500 px-3 py-1 inline-block -skew-x-2">
                           <h2 className="text-black font-black text-2xl italic uppercase tracking-tighter">
                              {t('common.delete')}?
                           </h2>
                        </div>
                        <p className="text-gray-400 text-lg">
                           Are you sure you want to delete this purchase order? This action cannot be undone.
                        </p>
                     </div>

                     <div className="flex gap-4 pt-4">
                        <Button
                           variant="outline"
                           onClick={() => setDeleteConfirmationPOId(null)}
                           className="flex-1 h-14 border-gray-700 hover:bg-white/5 text-gray-300 text-lg font-bold rounded-2xl"
                        >
                           {t('common.cancel')}
                        </Button>
                        <Button
                           onClick={confirmDelete}
                           className="flex-1 h-14 bg-red-600 hover:bg-red-700 text-white text-lg font-black uppercase italic rounded-2xl shadow-xl shadow-red-600/20"
                        >
                           {t('common.delete')}
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
