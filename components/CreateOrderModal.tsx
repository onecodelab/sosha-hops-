
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dialog, Button, Input, Badge, showToast, cn } from './ui';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { useMenu } from '../hooks/useMenu';
import { MenuDish, Table } from '../types';
import { 
  Search, Plus, Minus, ShoppingBag, Utensils, 
  Trash2, Loader2, ChevronRight, QrCode, 
  MessageSquare, Zap, X, Armchair, AlertCircle, Users
} from 'lucide-react';

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

  // 1. Initial Load
  useEffect(() => {
    if (isOpen) {
      fetchTables();
      setCart([]);
      setCustomerNotes('');
      setTableId(initialTableId || '');
      setTableNumber(initialTableNo || '');
      setGuestCount(1);
      setInternalAppendId(appendOrderId);
    }
  }, [isOpen, initialTableId, initialTableNo, appendOrderId]);

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
        }
      }
    }
  }, [isOpen, tables, tableNumber]);

  const fetchTables = async () => {
    const { data } = await supabase.from('tables').select('*').order('table_number', { ascending: true });
    if (data) setTables(data as Table[]);
  };

  const handleTableChange = (id: string) => {
    const tbl = tables.find(t => t.id === id);
    if (tbl) {
      setTableId(id);
      setTableNumber(tbl.table_number);
      setGuestCount(tbl.capacity_min || 1);
      if (tbl.status === 'occupied' && tbl.current_order_id) {
        setInternalAppendId(tbl.current_order_id);
      } else {
        setInternalAppendId(null);
      }
    } else {
      setTableId('');
      setTableNumber('');
      setInternalAppendId(null);
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
      let activeTableId = tableId;

      if (!activeTableId && tableNumber) {
        const { data: matchedTable } = await supabase
          .from('tables')
          .select('id, status, current_order_id')
          .eq('table_number', tableNumber)
          .maybeSingle();
        if (matchedTable) {
           activeTableId = matchedTable.id;
           if (matchedTable.status === 'occupied' && matchedTable.current_order_id && !internalAppendId) {
              setInternalAppendId(matchedTable.current_order_id);
           }
        }
      }

      if (!activeTableId) throw new Error("Table identification failed.");

      let finalOrderId = internalAppendId;

      if (!finalOrderId) {
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

        // 3. Link Table
        await supabase.from('tables').update({ 
          status: 'occupied', 
          current_order_id: finalOrderId,
          current_session_id: sessionData.id,
          last_updated: now
        }).eq('id', activeTableId);
      } else {
        // --- APPEND TO EXISTING BILL ---
        const { data: existingOrder } = await supabase
          .from('orders')
          .select('total_amount, status')
          .eq('id', finalOrderId)
          .single();

        if (existingOrder) {
          // If already in production (accepted/preparing), don't reset to 'pending'
          // unless you want to re-notify the kitchen that new items are added.
          // Keeping existing status is cleaner for production flow.
          await supabase.from('orders').update({
            total_amount: (existingOrder.total_amount || 0) + totalAmount,
            last_updated: now
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

      showToast(`Added to Table ${tableNumber}`, "success");
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
    <Dialog isOpen={isOpen} onClose={onClose} title={internalAppendId ? `Add to Bill: T-${tableNumber}` : `New Order: T-${tableNumber}`} maxWidth="max-w-6xl">
      <div className="flex h-[80vh] bg-[#050505] overflow-hidden -m-6 md:-m-0 rounded-b-[2rem]">
        <div className="flex-1 flex flex-col border-r border-white/5 overflow-hidden">
          <div className="p-6 space-y-6">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="lg:w-1/3 space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Table</label>
                <select 
                  disabled={!!initialTableId || !!internalAppendId}
                  className={cn(
                    "w-full h-12 border rounded-xl px-4 text-white font-black appearance-none outline-none transition-colors bg-white/[0.03] border-white/10",
                    internalAppendId && "opacity-50"
                  )}
                  value={tableId}
                  onChange={e => handleTableChange(e.target.value)}
                >
                  <option value="">Select Table...</option>
                  {tables.map(t => (
                    <option key={t.id} value={t.id} className="bg-[#0A0A0A]">Table {t.table_number} {t.status === 'occupied' ? '(Occupied)' : ''}</option>
                  ))}
                </select>
              </div>
              
              <div className="lg:w-2/3 space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Quick Search</label>
                <div className="relative">
                  <Search className="absolute left-4 top-3.5 h-4 w-4 text-zinc-600" />
                  <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="pl-10 h-12 bg-white/[0.03] border-white/10 rounded-xl" placeholder="Pick food item..." />
                </div>
              </div>
            </div>
            
            <div className="flex gap-2 overflow-x-auto no-scrollbar">
              <button onClick={() => setSelectedCategory('All')} className={cn("px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all", selectedCategory === 'All' ? "bg-primary text-black border-primary" : "bg-white/[0.02] text-zinc-500 border-white/5")}>ALL</button>
              {categories.map(cat => (
                <button key={cat} onClick={() => setSelectedCategory(cat)} className={cn("px-6 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap", selectedCategory === cat ? "bg-primary text-black border-primary" : "bg-white/[0.02] text-zinc-500 border-white/5")}>{cat}</button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 pt-0 space-y-3 custom-scrollbar">
            {menuLoading ? <Loader2 className="w-8 h-8 animate-spin mx-auto mt-20 text-primary" /> : filteredMenu.map(dish => (
                <div key={dish.id} className="p-4 bg-white/[0.02] border border-white/5 rounded-2xl flex items-center justify-between group hover:bg-white/[0.04] transition-all">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center overflow-hidden">
                      {dish.image_url ? <img src={dish.image_url} className="w-full h-full object-cover opacity-60 group-hover:opacity-100" /> : <Utensils className="w-5 h-5 text-zinc-800" />}
                    </div>
                    <div><h4 className="text-sm font-black text-white">{dish.name}</h4><p className="text-xs font-bold text-primary/80">ETB {dish.price.toLocaleString()}</p></div>
                  </div>
                  <button onClick={() => addToCart(dish)} className="w-10 h-10 rounded-xl bg-primary text-black flex items-center justify-center shadow-lg active:scale-90 transition-transform"><Plus className="w-5 h-5 stroke-[3px]" /></button>
                </div>
            ))}
          </div>
        </div>

        <div className="w-[360px] flex flex-col bg-zinc-950 border-l border-white/5">
          <div className="p-6 border-b border-white/10 flex items-center justify-between">
            <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white flex items-center gap-2"><ShoppingBag className="w-4 h-4 text-primary" /> Current Ticket</h3>
            <div className="w-7 h-7 rounded-full bg-primary text-black flex items-center justify-center text-[10px] font-black">{cart.reduce((sum, i) => sum + i.quantity, 0)}</div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
            {cart.length === 0 && <div className="h-full flex items-center justify-center text-zinc-700 text-xs font-bold uppercase tracking-widest italic opacity-40">Empty</div>}
            {cart.map(item => (
                <div key={item.dish.id} className="p-3 bg-white/[0.03] border border-white/5 rounded-xl flex items-center justify-between gap-4">
                  <div className="min-w-0 flex-1"><p className="text-xs font-bold text-white truncate">{item.dish.name}</p><p className="text-[10px] font-mono text-zinc-500">ETB {(item.dish.price * item.quantity).toLocaleString()}</p></div>
                  <div className="flex items-center gap-2 bg-black/40 p-1 rounded-lg border border-white/5"><button onClick={() => removeFromCart(item.dish.id)} className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white"><Minus className="w-3 h-3" /></button><span className="text-xs font-black w-4 text-center text-white">{item.quantity}</span><button onClick={() => addToCart(item.dish)} className="w-6 h-6 flex items-center justify-center text-zinc-400 hover:text-white"><Plus className="w-3 h-3" /></button></div>
                </div>
            ))}
          </div>

          <div className="p-6 space-y-5 bg-black/40 border-t border-white/10">
            {internalAppendId && (
               <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3">
                  <AlertCircle className="text-red-500 w-5 h-5 shrink-0" />
                  <p className="text-[10px] font-black text-red-400 uppercase leading-relaxed tracking-tighter">Table In-Use: Items will be added to active bill.</p>
               </div>
            )}
            <div className="space-y-4">
              <div className="flex justify-between items-end"><span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Added Total</span><span className="text-2xl font-black text-primary font-mono tracking-tighter">ETB {totalAmount.toLocaleString()}</span></div>
              <Button onClick={submitOrder} disabled={submitting || cart.length === 0} className={cn("w-full h-16 rounded-2xl font-black uppercase text-xs shadow-2xl transition-all", cart.length > 0 ? "bg-primary text-black" : "bg-zinc-900 text-zinc-700")}>
                {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <>{internalAppendId ? 'Add to Existing Bill' : 'Confirm New Order'} <Plus className="ml-2 w-4 h-4" /></>}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </Dialog>
  );
};
