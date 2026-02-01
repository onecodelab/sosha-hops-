
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, Button, Input, Badge, showToast, cn, Card } from './ui';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { useBranch } from '../contexts/BranchContext';
import { useMenu } from '../hooks/useMenu';
import { MenuDish, Table, Order } from '../types';
import {
  Search, Plus, Minus, ShoppingBag, Utensils,
  Trash2, Loader2, ChevronRight, QrCode, ClipboardList,
  MessageSquare, Zap, X, Armchair, AlertCircle, Users, FileText
} from 'lucide-react';
import { orderService } from '../services/orderService';
import { useInventoryMapping } from '../hooks/useInventoryMapping';
import { useRedisStock } from '../hooks/useRedisStock';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: () => Promise<void> | void;
  initialTableId?: string;
  initialTableNo?: string;
  appendOrderId?: string | null;
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({
  isOpen, onClose, onOrderCreated, initialTableId = '', initialTableNo = '', appendOrderId = null
}) => {
  const { user, profile } = useAuth();
  const { activeBranchId } = useBranch();
  const { menuItems, categories, loading: menuLoading } = useMenu(true);

  const [tableId, setTableId] = useState<string>(initialTableId);
  const [tableNumber, setTableNumber] = useState(initialTableNo);
  const [tables, setTables] = useState<Table[]>([]);
  const [cart, setCart] = useState<{ dish: MenuDish; quantity: number; notes: string }[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [customerNotes, setCustomerNotes] = useState('');
  const [guestCount, setGuestCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [internalAppendId, setInternalAppendId] = useState<string | null>(appendOrderId);
  const [activeOrderSummary, setActiveOrderSummary] = useState<Order | null>(null);

  // 0. Redis Real-time Guard Layer
  const { mapping: inventoryMapping } = useInventoryMapping();
  const allIngredientIds = useMemo(() => Array.from(new Set(Object.values(inventoryMapping).flat())), [inventoryMapping]);
  const { stockMap } = useRedisStock(allIngredientIds);

  const performSqlFallback = async (activeTableId: string, payload: any) => {
    const now = new Date().toISOString();
    let finalOrderId = appendOrderId;

    if (!finalOrderId) {
      // 1. Start NEW session
      const { data: sessionData, error: sessionErr } = await supabase
        .from('table_sessions')
        .insert({
          table_id: activeTableId,
          waiter_id: user?.id,
          is_active: true,
          seated_at: now
        })
        .select()
        .single();

      if (sessionErr) throw sessionErr;

      // 2. Create NEW order
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          order_number: payload.order_details.order_number,
          table_id: activeTableId,
          table_number: payload.order_details.table_number,
          waiter_id: user?.id,
          status: 'pending',
          payment_status: 'unpaid',
          total_amount: payload.order_details.total_amount,
          source: 'dine_in',
          customer_notes: payload.order_details.customer_notes,
          created_at: now,
          created_by_id: user?.id,
          created_by_name: payload.order_details.created_by_name,
          branch_id: payload.branch_id
        })
        .select()
        .single();

      if (orderErr) throw orderErr;
      finalOrderId = order.id;

      // 3. Link Table
      await supabase.from('tables').update({
        current_session_id: sessionData.id
      }).eq('id', activeTableId);
    } else {
      // Update existing order for Append
      const { data: existingOrder } = await supabase.from('orders').select('total_amount').eq('id', finalOrderId).single();
      if (existingOrder) {
        await supabase.from('orders').update({
          total_amount: (existingOrder.total_amount || 0) + payload.order_details.total_amount,
          status: 'pending'
        }).eq('id', finalOrderId);
      }
    }

    // 4. Record Items
    const itemsPayload = payload.items.map((i: any) => ({
      order_id: finalOrderId,
      menu_item_id: i.menu_item_id,
      quantity: i.quantity,
      price: i.price,
      special_instructions: i.notes
    }));

    const { error: itemsErr } = await supabase.from('order_items').insert(itemsPayload);
    if (itemsErr) throw itemsErr;
  };

  // 1. Initial Load
  useEffect(() => {
    if (isOpen) {
      fetchTables();
      setCart([]);
      setCustomerNotes('');
      setTableId(initialTableId || '');
      setTableNumber(initialTableNo || '');
      setGuestCount(1);
      setInternalAppendId(appendOrderId || null); // Explicitly null if undefined
      setActiveOrderSummary(null);
    }
  }, [isOpen, initialTableId, initialTableNo, appendOrderId]);

  // Handle Order Summary fetching if starting with a table
  useEffect(() => {
    if (isOpen && initialTableId && !activeOrderSummary) {
      fetchOrderSummary(initialTableId);
    }
  }, [isOpen, initialTableId]);

  const fetchOrderSummary = async (id: string) => {
    try {
      const summary = await orderService.fetchTableOrderSummary(id);
      setActiveOrderSummary(summary);
    } catch (err) {
      console.warn("Failed to fetch order summary", err);
    }
  };

  // 2. Recovery Logic: Detect occupied tables automatically
  useEffect(() => {
    if (isOpen && tables.length > 0 && tableNumber) {
      const found = tables.find(t => t.table_number.toString() === tableNumber.toString());
      if (found && (!tableId || tableId !== found.id)) {
        setTableId(found.id);
        if (guestCount === 1) setGuestCount(found.capacity_min || 1);

        // Always try to append if the table is already occupied
        if (found.status === 'occupied' && found.current_order_id && !internalAppendId) {
          setInternalAppendId(found.current_order_id);
          fetchOrderSummary(found.id);
        }
      }
    }
  }, [isOpen, tables, tableNumber]);

  const fetchTables = async () => {
    let query = supabase.from('tables').select('*').order('table_number', { ascending: true });

    // Filter by active branch
    if (activeBranchId) {
      query = query.eq('branch_id', activeBranchId);
    }

    const { data } = await query;
    if (data) setTables(data as Table[]);
  };

  const handleTableChange = async (id: string) => {
    const tbl = tables.find(t => t.id === id);
    if (tbl) {
      setTableId(id);
      setTableNumber(tbl.table_number);
      setGuestCount(tbl.capacity_min || 1);
      if (tbl.status === 'occupied' && tbl.current_order_id) {
        setInternalAppendId(tbl.current_order_id);
        fetchOrderSummary(id);
      } else {
        setInternalAppendId(null);
        setActiveOrderSummary(null);
      }
    } else {
      setTableId('');
      setTableNumber('');
      setInternalAppendId(null);
      setActiveOrderSummary(null);
    }
  };

  const updateItemNote = (dishId: string, notes: string) => {
    setCart(prev => prev.map(item => item.dish.id === dishId ? { ...item, notes } : item));
  };

  const addToCart = (dish: MenuDish) => {
    setCart(prev => {
      const existing = prev.find(i => i.dish.id === dish.id);
      if (existing) return prev.map(i => i.dish.id === dish.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { dish, quantity: 1, notes: '' }];
    });
  };

  const removeFromCart = (dishId: string) => {
    setCart(prev => prev.reduce((acc, item) => {
      if (item.dish.id === dishId) {
        if (item.quantity > 1) return [...acc, { ...item, quantity: item.quantity - 1 }];
        return acc;
      }
      return [...acc, item];
    }, [] as typeof cart));
  };

  const totalAmount = cart.reduce((sum, item) => sum + (item.dish.price * item.quantity), 0);

  const generateOrderNumber = () => {
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    return `ORD-${dateStr}-${randomSuffix}`;
  };

  const submitOrder = async () => {
    if ((!tableId && !tableNumber) || cart.length === 0 || submitting) return;


    setSubmitting(true);
    try {
      const now = new Date().toISOString();
      let finalOrderId = internalAppendId;

      // 1. Identify Table and Check Status (if we don't already have an order ID)
      let activeTableId = tableId;
      if (!finalOrderId && !activeTableId && tableNumber) {
        const { data: matchedTable } = await supabase
          .from('tables')
          .select('id, status, current_order_id')
          .eq('table_number', tableNumber)
          .maybeSingle();

        if (matchedTable) {
          activeTableId = matchedTable.id;
        }
      }

      if (!activeTableId) throw new Error("Table identification failed.");

      // 2. Prep Payload for Edge Function (The Guard)
      const payload = {
        branch_id: activeBranchId,
        user_id: user?.id,
        items: cart.map(item => ({
          menu_item_id: item.dish.id,
          quantity: item.quantity,
          price: item.dish.price,
          notes: item.notes
        })),
        order_details: {
          table_id: activeTableId,
          table_number: tableNumber,
          total_amount: totalAmount,
          customer_notes: customerNotes,
          created_by_name: profile?.full_name || 'Staff',
          order_number: generateOrderNumber()
        }
      };

      // 3. SECURE SUBMISSION via Edge Function
      try {
        const { data: result, error: rpcErr } = await supabase.functions.invoke('place-order', {
          body: payload
        });

        if (rpcErr || (result && result.error)) {
          // If Edge Function is explicitly rejecting (Out of Stock), throw it to the user
          if (rpcErr?.message?.includes('Out of Stock') || result?.error?.includes('Out of Stock')) {
            throw new Error(rpcErr?.message || result?.error);
          }
          // For other errors (Not Found/Deployment), we fallback to SQL
          console.warn("Edge Function unavailable, falling back to direct SQL...", rpcErr || result?.error);
          await performSqlFallback(activeTableId, payload);
        }
      } catch (invokeErr) {
        console.warn("Edge Function call failed, performing SQL fallback:", invokeErr);
        await performSqlFallback(activeTableId, payload);
      }

      showToast(internalAppendId ? `Appended to Table ${tableNumber}` : `New Order for Table ${tableNumber}`, "success");
      if (onOrderCreated) await onOrderCreated();
      onClose();
    } catch (err: any) {
      showToast(err.message || "Order Failed", 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMenu = menuItems.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) &&
    (selectedCategory === 'All' || item.category === selectedCategory)
  );

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={internalAppendId ? `Add to Bill: T-${tableNumber}` : (tableNumber ? `New Order: T-${tableNumber}` : "New Order Entry")} maxWidth="max-w-6xl">
      <div className="flex flex-col md:flex-row h-[75vh] md:h-[80vh] bg-[#09090b] text-white overflow-hidden rounded-b-3xl md:rounded-3xl relative">

        {/* LEFT PANEL: Tables & Menu */}
        <div className="flex-1 flex flex-col border-r border-white/5 bg-black/20 overflow-hidden relative">

          {/* Top Section: Table Selector + Search */}
          <div className="shrink-0 p-4 space-y-4 border-b border-white/5 bg-black/40 backdrop-blur-xl z-20">
            <div className="flex flex-col gap-3">
              {/* Table Selector */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Armchair className="w-3 h-3" /> {tableId ? `Assigned: Table ${tableNumber}` : 'Select Table'}
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-20 md:max-h-24 overflow-y-auto custom-scrollbar p-1">
                  {(!initialTableId && !internalAppendId) ? (
                    tables.map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleTableChange(t.id)}
                        className={cn(
                          "px-2.5 h-7 md:px-3 md:h-8 rounded-lg text-[9px] font-black uppercase transition-all border shrink-0 flex items-center justify-center min-w-[2.5rem] md:min-w-[3rem]",
                          tableId === t.id
                            ? "bg-primary text-black border-primary shadow-[0_0_15px_rgba(251,191,36,0.2)]"
                            : "bg-white/[0.03] text-zinc-400 border-white/5 hover:border-white/20 hover:text-white",
                          t.status === 'occupied' && tableId !== t.id && "bg-red-500/5 text-red-500/50 border-red-500/10"
                        )}
                      >
                        {t.table_number}
                        {t.status === 'occupied' && <div className="ml-1 w-1 h-1 rounded-full bg-red-500" />}
                      </button>
                    ))
                  ) : (
                    <div className="h-8 md:h-9 px-3 md:px-4 bg-primary/10 border border-primary/20 rounded-lg flex items-center">
                      <Armchair className="w-3 h-3 md:w-3.5 md:h-3.5 text-primary mr-2" />
                      <span className="text-[10px] md:text-xs font-black text-white">Table {tableNumber}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Search & Categories */}
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-600" />
                  <Input
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="pl-9 h-9 text-xs bg-white/[0.05] border-white/10 rounded-xl focus:bg-white/[0.1] text-white placeholder:text-zinc-600"
                    placeholder="Search menu..."
                  />
                </div>
                <div className="flex gap-1.5 overflow-x-auto no-scrollbar max-w-[50%]">
                  <button onClick={() => setSelectedCategory('All')} className={cn("px-3 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all", selectedCategory === 'All' ? "bg-white text-black border-white" : "bg-transparent text-zinc-500 border-white/10 hover:border-white/30")}>ALL</button>
                  {categories.map(cat => (
                    <button key={cat} onClick={() => setSelectedCategory(cat)} className={cn("px-3 h-9 rounded-lg text-[9px] font-black uppercase tracking-widest border transition-all whitespace-nowrap", selectedCategory === cat ? "bg-white text-black border-white" : "bg-transparent text-zinc-500 border-white/10 hover:border-white/30")}>{cat}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Menu List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar pb-32 md:pb-4">
            {menuLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto mt-10 text-primary" /> : filteredMenu.map(dish => {
              const neededIngredients = inventoryMapping[dish.id] || [];
              const redisAvailable = neededIngredients.every(ingId => (stockMap[ingId] ?? 1) > 0);
              const isActuallyAvailable = dish.is_available && redisAvailable;

              return (
                <div key={dish.id} onClick={() => isActuallyAvailable && addToCart(dish)} className={cn("group p-3 border rounded-2xl flex items-center justify-between transition-all cursor-pointer active:scale-[0.98]", !isActuallyAvailable ? "bg-red-900/10 border-red-900/20 opacity-60 grayscale" : "bg-white/[0.03] border-white/5 hover:bg-white/[0.08] hover:border-white/10")}>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center overflow-hidden shrink-0 relative">
                      {dish.image_url ? <img src={dish.image_url} className="w-full h-full object-cover" /> : <Utensils className="w-5 h-5 text-zinc-700" />}
                    </div>
                    <div className="flex flex-col">
                      <h4 className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                        {dish.name}
                      </h4>
                      <p className="text-[10px] font-black text-zinc-500 uppercase tracking-wider mt-0.5">ETB {dish.price.toLocaleString()}</p>
                    </div>
                  </div>
                  <button
                    disabled={!isActuallyAvailable}
                    className={cn("w-8 h-8 rounded-full flex items-center justify-center transition-all", !isActuallyAvailable ? "hidden" : "bg-white/10 text-white group-hover:bg-primary group-hover:text-black")}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
            {filteredMenu.length === 0 && <div className="text-center py-20 text-[10px] uppercase tracking-widest text-zinc-700">No items found</div>}
          </div>
        </div>

        {/* RIGHT PANEL: CART / TICKET (Hidden on mobile until items added, then becomes a drawer/overlay) */}
        <div className={cn("md:w-96 flex flex-col bg-[#111] md:bg-black/40 border-t md:border-t-0 md:border-l border-white/10 z-30 transition-all duration-300 absolute md:relative inset-x-0 bottom-0 max-h-[60vh] md:max-h-full shadow-2xl md:shadow-none rounded-t-3xl md:rounded-none", cart.length === 0 ? "translate-y-full md:translate-y-0 opacity-0 md:opacity-100 pointer-events-none md:pointer-events-auto" : "translate-y-0 opacity-100")}>
          {/* Mobile Drawer Handle */}
          <div className="md:hidden w-12 h-1 bg-white/20 rounded-full mx-auto mt-3 mb-1" />

          <div className="p-4 md:p-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary" /> Current Order
            </h3>
            <Badge variant="glass" className="bg-primary/20 text-primary border-primary/20">{cart.reduce((s, i) => s + i.quantity, 0)} Items</Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-black/20">
            {cart.map((item, idx) => (
              <div key={idx} className="flex flex-col gap-2 p-3 bg-white/[0.03] border border-white/5 rounded-xl shadow-inner">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-white">{item.dish.name}</p>
                    <p className="text-[10px] text-zinc-500 font-mono mt-0.5">ETB {item.dish.price * item.quantity}</p>
                  </div>
                  <div className="flex items-center gap-3 bg-black/40 rounded-lg p-1 border border-white/5">
                    <button onClick={() => removeFromCart(item.dish.id)} className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded-md text-zinc-400"><Minus className="w-3 h-3" /></button>
                    <span className="text-xs font-bold text-white min-w-[16px] text-center">{item.quantity}</span>
                    <button onClick={() => addToCart(item.dish)} className="w-6 h-6 flex items-center justify-center hover:bg-white/10 rounded-md text-white"><Plus className="w-3 h-3" /></button>
                  </div>
                </div>

                {/* Per-Item Note Input */}
                <div className="relative group">
                  <MessageSquare className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600 group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    placeholder="Add item instructions..."
                    value={item.notes}
                    onChange={(e) => updateItemNote(item.dish.id, e.target.value)}
                    className="w-full h-8 pl-8 pr-3 bg-black/40 border border-white/5 rounded-lg text-[10px] text-white placeholder:text-zinc-700 focus:outline-none focus:border-primary/30 transition-all font-medium"
                  />
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 border-t border-white/5 bg-black/40 backdrop-blur-xl">
            <div className="flex justify-between items-end mb-4 px-2">
              <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Total Estimated</span>
              <span className="text-2xl font-black text-white tracking-tighter">
                <small className="text-sm text-zinc-500 mr-1 font-normal">ETB</small>
                {totalAmount.toLocaleString()}
              </span>
            </div>
            <Button onClick={submitOrder} disabled={submitting} className={cn("w-full h-12 md:h-14 rounded-2xl font-black uppercase text-[10px] md:text-xs shadow-[0_0_20px_rgba(251,191,36,0.2)] transition-all flex items-center justify-between px-6 group", submitting ? "bg-zinc-800 text-zinc-600" : "bg-primary text-black hover:bg-white hover:scale-[1.02]")}>
              <span>{submitting ? 'Sending...' : (internalAppendId ? 'Update Order' : 'Place Order')}</span>
              {!submitting && <ChevronRight className="w-4 h-4 md:w-5 md:h-5 opacity-50 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
