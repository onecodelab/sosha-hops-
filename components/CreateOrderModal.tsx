
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, Button, Input, Badge, showToast, cn } from './ui';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { useMenu } from '../hooks/useMenu';
import { MenuDish, Table, Order } from '../types';
import {
  Search, Plus, Minus, ShoppingBag, Utensils,
  Trash2, Loader2, ChevronRight, QrCode,
  MessageSquare, Zap, X, Armchair, AlertCircle, Users, FileText
} from 'lucide-react';
import { orderService } from '../services/orderService';

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
    const { data } = await supabase.from('tables').select('*').order('table_number', { ascending: true });
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

          // Auto-detect existing active order if we're not already appending
          if (matchedTable.status === 'occupied' && matchedTable.current_order_id) {
            const summary = await orderService.fetchTableOrderSummary(matchedTable.id);

            // If we found a valid active order, Ask to Append
            if (summary && summary.status !== 'paid' && !summary.closed_at) {
              if (confirm(`Table ${tableNumber} is OCCUPIED. Add items to existing bill (ETB ${summary.total_amount?.toLocaleString()})?`)) {
                finalOrderId = summary.id;
                setInternalAppendId(finalOrderId); // Sync state
              } else {
                // If user says NO, we stop. We don't support "Double Orders" on one table yet.
                setSubmitting(false);
                return;
              }
            }
          }
        }
      }

      if (!activeTableId) throw new Error("Table identification failed.");

      if (!activeTableId) throw new Error("Table identification failed.");

      // Remove "let finalOrderId = internalAppendId;" here if it was redeclared.
      // We already declared it at the top of the function.

      if (!finalOrderId) {
        // --- NEW ORDER (No existing ID found/confirmed) ---

        // 0. Proactively clear any "ghost" sessions for this table
        try {
          await orderService.forceClearTable(activeTableId);
        } catch (clearErr) {
          console.warn("Table cleanup pre-order failed (non-critical):", clearErr);
        }

        // 1. Start NEW session
        const { data: sessionData, error: sessionErr } = await supabase
          .from('table_sessions')
          .insert({
            table_id: activeTableId,
            waiter_id: user?.id,
            is_active: true,
            seated_at: now,
            guest_count: guestCount
          })
          .select()
          .single();

        if (sessionErr) throw sessionErr;

        // 2. Create NEW order
        const { data: order, error: orderErr } = await supabase
          .from('orders')
          .insert({
            order_number: generateOrderNumber(),
            table_id: activeTableId,
            table_number: tableNumber,
            waiter_id: user?.id,
            status: 'pending',
            payment_status: 'unpaid',
            total_amount: totalAmount,
            source: 'dine_in',
            customer_notes: customerNotes,
            created_at: now,
            created_by_id: user?.id,
            created_by_name: profile?.full_name || 'Staff'
          })
          .select()
          .single();

        if (orderErr) throw orderErr;
        finalOrderId = order.id;

        // 3. Link Table (Trigger will handle status, but we set session)
        await supabase.from('tables').update({
          // status: 'occupied', // Trigger handles this now
          // current_order_id: finalOrderId, // Trigger handles this now
          current_session_id: sessionData.id
          // Removed last_updated since column does not exist
        }).eq('id', activeTableId);
      } else {
        // --- APPEND TO EXISTING BILL ---
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('total_amount, status')
          .eq('id', finalOrderId)
          .single();

        if (existingOrder) {
          await supabase.from('orders').update({
            total_amount: (existingOrder.total_amount || 0) + totalAmount,
            last_updated: now,
            status: 'pending' // Re-activate order for kitchen visibility
          }).eq('id', finalOrderId);
        }
      }

      // 4. Record Items
      const itemsPayload = cart.map(item => ({
        order_id: finalOrderId,
        menu_item_id: item.dish.id,
        quantity: item.quantity,
        price: item.dish.price,
        special_instructions: item.notes
      }));

      await supabase.from('order_items').insert(itemsPayload);

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
    <Dialog isOpen={isOpen} onClose={onClose} title={internalAppendId ? `Add to Bill: T-${tableNumber}` : (tableNumber ? `New Order: T-${tableNumber}` : "New Order Entry")} maxWidth="max-w-5xl">
      <div className="flex h-[75vh] bg-[#09090b] overflow-hidden -m-6 md:-m-0 rounded-b-[2rem]">
        {/* LEFT PANEL: Tables & Menu */}
        <div className="flex-1 flex flex-col border-r border-white/5 overflow-hidden">

          {/* Top Section: Table Selector + Search */}
          <div className="p-4 space-y-4 border-b border-white/5 bg-black/20">
            <div className="flex flex-col gap-3">
              {/* Table Selector */}
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1 flex items-center gap-2">
                  <Armchair className="w-3 h-3" /> {tableId ? `Assigned: Table ${tableNumber}` : 'Select Table'}
                </label>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto custom-scrollbar p-1">
                  {(!initialTableId && !internalAppendId) ? (
                    tables.map(t => (
                      <button
                        key={t.id}
                        onClick={() => handleTableChange(t.id)}
                        className={cn(
                          "px-3 h-8 rounded-lg text-[9px] font-black uppercase transition-all border shrink-0 flex items-center justify-center min-w-[3rem]",
                          tableId === t.id
                            ? "bg-primary text-black border-primary shadow-[0_0_15px_rgba(251,191,36,0.2)]"
                            : "bg-white/[0.03] text-zinc-400 border-white/5 hover:border-white/20 hover:text-white",
                          t.status === 'occupied' && tableId !== t.id && "bg-red-500/5 text-red-500/50 border-red-500/10"
                        )}
                      >
                        {t.table_number}
                        {t.status === 'occupied' && <div className="ml-1.5 w-1 h-1 rounded-full bg-red-500" />}
                      </button>
                    ))
                  ) : (
                    <div className="h-9 px-4 bg-primary/10 border border-primary/20 rounded-lg flex items-center">
                      <Armchair className="w-3.5 h-3.5 text-primary mr-2" />
                      <span className="text-xs font-black text-white">Table {tableNumber}</span>
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
                    className="pl-9 h-9 text-xs bg-white/[0.03] border-white/10 rounded-lg focus:bg-white/[0.05]"
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
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar bg-gradient-to-b from-transparent to-black/40">
            {menuLoading ? <Loader2 className="w-6 h-6 animate-spin mx-auto mt-10 text-primary" /> : filteredMenu.map(dish => (
              <div key={dish.id} className="group p-2 pr-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between hover:bg-white/[0.05] hover:border-white/10 transition-all">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-zinc-900 border border-white/5 flex items-center justify-center overflow-hidden shrink-0">
                    {dish.image_url ? <img src={dish.image_url} className="w-full h-full object-cover opacity-70 group-hover:opacity-100 transition-opacity" /> : <Utensils className="w-4 h-4 text-zinc-700" />}
                  </div>
                  <div className="flex flex-col">
                    <h4 className="text-xs font-bold text-zinc-100 leading-tight group-hover:text-primary transition-colors">{dish.name}</h4>
                    <p className="text-[10px] font-mono font-medium text-zinc-500">ETB {dish.price.toLocaleString()}</p>
                  </div>
                </div>
                <button
                  onClick={() => addToCart(dish)}
                  className="w-8 h-8 rounded-lg bg-white/5 text-zinc-400 group-hover:bg-primary group-hover:text-black flex items-center justify-center transition-all"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            ))}
            {filteredMenu.length === 0 && <div className="text-center py-20 text-[10px] uppercase tracking-widest text-zinc-700">No items found</div>}
          </div>
        </div>

        {/* RIGHT PANEL: Cart & Summary */}
        <div className="w-[320px] flex flex-col bg-[#050505] border-l border-white/5 relative z-10 shadow-2xl">
          <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20">
            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 flex items-center gap-2">Ticket</h3>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-[9px] h-5 px-2">{cart.reduce((sum, i) => sum + i.quantity, 0)} Items</Badge>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
            {cart.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-30 gap-3">
                <ShoppingBag className="w-8 h-8 text-zinc-500" />
                <span className="text-[10px] uppercase tracking-widest font-black text-zinc-600">Cart Empty</span>
              </div>
            )}
            {cart.map(item => (
              <div key={item.dish.id} className="p-2.5 bg-zinc-900/50 border border-white/5 rounded-lg flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <span className="text-[11px] font-bold text-zinc-200 leading-tight line-clamp-2 w-[70%]">{item.dish.name}</span>
                  <span className="text-[10px] font-mono text-zinc-500">{(item.dish.price * item.quantity).toLocaleString()}</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1 bg-black rounded-md border border-white/5 p-0.5">
                    <button onClick={() => removeFromCart(item.dish.id)} className="w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-white"><Minus className="w-3 h-3" /></button>
                    <span className="text-[10px] font-mono w-4 text-center text-zinc-300">{item.quantity}</span>
                    <button onClick={() => addToCart(item.dish)} className="w-5 h-5 flex items-center justify-center text-zinc-500 hover:text-white"><Plus className="w-3 h-3" /></button>
                  </div>
                  {/* Notes logic could go here */}
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 bg-black border-t border-white/10 space-y-3">
            {internalAppendId && (
              <div className="bg-orange-500/10 border border-orange-500/20 px-3 py-2 rounded-lg flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-orange-500 animate-pulse" />
                <p className="text-[9px] font-bold text-orange-400 uppercase tracking-wide">Appending to Active Bill</p>
              </div>
            )}

            <div className="space-y-1">
              <div className="flex justify-between items-end">
                <span className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Total</span>
                <span className="text-xl font-black text-white font-mono tracking-tighter">ETB {totalAmount.toLocaleString()}</span>
              </div>
            </div>

            <Button onClick={submitOrder} disabled={submitting || cart.length === 0} className={cn("w-full h-12 rounded-xl font-black uppercase text-[10px] shadow-lg transition-all flex items-center justify-between px-4 group", cart.length > 0 ? "bg-primary text-black hover:bg-primary/90" : "bg-zinc-900 text-zinc-600")}>
              <span>{submitting ? 'Processing...' : (internalAppendId ? 'Update Bill' : 'Place Order')}</span>
              {!submitting && <ChevronRight className="w-4 h-4 opacity-50 group-hover:translate-x-1 transition-transform" />}
            </Button>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
