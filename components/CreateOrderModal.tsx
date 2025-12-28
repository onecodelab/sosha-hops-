
import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, Button, Input, Badge, showToast, cn } from './ui';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { useMenu } from '../hooks/useMenu';
import { CartItem, Table as TableType } from '../types';
import { Search, Plus, Minus, ShoppingBag, Utensils, QrCode, Trash2, Armchair, Loader2, AlertCircle, ArrowLeft, ChevronRight, Hash } from 'lucide-react';
import QRScanner from './QRScanner';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: () => Promise<void> | void;
  initialTableNo?: string;
  appendOrderId?: string | null;
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({ 
  isOpen, onClose, onOrderCreated, initialTableNo = '', appendOrderId = null
}) => {
  const { user } = useAuth();
  const { menuItems, categories, loading: menuLoading } = useMenu(true);
  
  const [tableId, setTableId] = useState<string>('');
  const [tableNumber, setTableNumber] = useState(initialTableNo);
  const [tables, setTables] = useState<TableType[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [notes, setNotes] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const [activeMobileTab, setActiveMobileTab] = useState<'menu' | 'ticket'>('menu');
  const [existingOrderTotal, setExistingOrderTotal] = useState(0);

  const isAppendMode = !!appendOrderId;

  // 1. Fetch tables and set up real-time subscription
  useEffect(() => {
    if (isOpen) {
      fetchTables();
      
      const channel = supabase.channel('modal_table_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
          fetchTables();
        })
        .subscribe();

      setCart([]);
      setNotes('');
      setSearchTerm('');
      setSelectedCategory('All');
      setActiveMobileTab('menu');

      if (isAppendMode) {
        fetchExistingOrder();
      }

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [isOpen, appendOrderId]);

  const fetchExistingOrder = async () => {
    if (!appendOrderId) return;
    const { data, error } = await supabase
      .from('orders')
      .select('total_amount, table_id, table_number')
      .eq('id', appendOrderId)
      .single();
    
    if (!error && data) {
      setExistingOrderTotal(data.total_amount || 0);
      setTableId(data.table_id);
      setTableNumber(data.table_number);
    }
  };

  const fetchTables = async () => {
    const { data, error } = await supabase
      .from('tables')
      .select('*')
      .order('table_number', { ascending: true });
    
    if (!error && data) {
      setTables(data as TableType[]);
      
      if (initialTableNo && !tableId && !isAppendMode) {
        const t = data.find(tbl => tbl.table_number.toString() === initialTableNo);
        if (t && t.status === 'available') {
          setTableId(t.id);
          setTableNumber(t.table_number.toString());
        }
      }
    }
  };

  const availableTables = useMemo(() => tables.filter(t => t.status === 'available'), [tables]);
  const selectedTableData = useMemo(() => tables.find(t => t.id === tableId), [tables, tableId]);
  const newItemsTotal = useMemo(() => cart.reduce((acc, item) => acc + (item.price * item.quantity), 0), [cart]);
  const cartCount = useMemo(() => cart.reduce((acc, item) => acc + item.quantity, 0), [cart]);
  
  const isTableOccupied = !isAppendMode && selectedTableData && selectedTableData.status !== 'available';
  const isCartEmpty = cart.length === 0 || newItemsTotal <= 0;

  const getButtonLabel = () => {
    if (submitting) return "Processing...";
    if (!tableId) return "Select a table";
    if (isTableOccupied) return "Table is occupied";
    if (isCartEmpty) return "Add items to ticket";
    return isAppendMode ? "Update Kitchen Ticket" : "Commit to Kitchen";
  };

  const isButtonDisabled = submitting || !tableId || isTableOccupied || isCartEmpty;

  const handleTableChange = (id: string) => {
    if (isAppendMode) return;
    setTableId(id);
    const tbl = tables.find(t => t.id === id);
    if (tbl) {
      setTableNumber(tbl.table_number.toString());
      if (tbl.status !== 'available') {
        showToast(`Table ${tbl.table_number} is currently ${tbl.status}.`, 'warning');
      }
    }
  };

  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1 }];
    });
    
    setLastAddedId(item.id);
    setTimeout(() => setLastAddedId(null), 600);
    showToast(`Added ${item.name} ×1`, 'success');
  };

  const removeFromCart = (id: string) => {
    setCart(prev => prev.reduce((acc, item) => {
      if (item.id === id) {
        if (item.quantity > 1) return [...acc, { ...item, quantity: item.quantity - 1 }];
        return acc;
      }
      return [...acc, item];
    }, [] as CartItem[]));
  };

  const submitOrder = async () => {
    if (isButtonDisabled) return;
    setSubmitting(true);

    try {
      if (isAppendMode) {
        // --- APPEND LOGIC ---
        const { data: order, error: orderError } = await supabase
          .from('orders')
          .update({
            total_amount: existingOrderTotal + newItemsTotal,
            status: 'preparing', // Reset status so kitchen sees the update
            customer_notes: notes ? (notes.trim() ? notes.trim() : null) : null
          })
          .eq('id', appendOrderId)
          .select()
          .single();

        if (orderError) throw orderError;

        const itemsPayload = cart.map(i => ({
          order_id: appendOrderId,
          menu_item_id: i.id,
          quantity: i.quantity,
          price: i.price, 
          special_instructions: i.instructions || null
        }));

        const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);
        if (itemsError) throw itemsError;

        showToast(`Items added to Order #${appendOrderId.slice(0,5)}`, 'success');
      } else {
        // --- NEW ORDER LOGIC ---
        const { data: currentTable, error: checkError } = await supabase
          .from('tables')
          .select('status')
          .eq('id', tableId)
          .single();

        if (checkError || !currentTable) throw new Error("Could not verify table status.");
        if (currentTable.status !== 'available') {
          showToast(`Table ${tableNumber} was just occupied.`, 'error');
          await fetchTables();
          setSubmitting(false);
          return;
        }

        const { data: order, error: orderError } = await supabase
          .from('orders')
          .insert({
            table_id: tableId,
            table_number: tableNumber,
            waiter_id: user?.id,
            status: 'pending',
            order_type: 'dine-in',
            total_amount: newItemsTotal,
            customer_notes: notes.trim() || null
          })
          .select()
          .single();

        if (orderError || !order) throw orderError;

        const itemsPayload = cart.map(i => ({
          order_id: order.id,
          menu_item_id: i.id,
          quantity: i.quantity,
          price: i.price, 
          special_instructions: i.instructions || null
        }));

        const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);
        if (itemsError) throw itemsError;

        await supabase
          .from('tables')
          .update({ 
            status: 'occupied', 
            current_order_id: order.id,
            last_updated: new Date().toISOString()
          })
          .eq('id', tableId);

        showToast(`Order created and table marked occupied.`, 'success');
      }

      if (onOrderCreated) await onOrderCreated();
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast(err.message || 'Failed to process order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMenu = useMemo(() => {
    return menuItems.filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory =
        selectedCategory === 'All' || m.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [menuItems, searchTerm, selectedCategory]);

  if (!isOpen) return null;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={isAppendMode ? `Update Table ${tableNumber}` : "Initialize Table Service"}>
      <div className="flex flex-col h-[85vh] md:h-[75vh] w-full max-w-5xl mx-auto">
        
        {/* TAB NAVIGATION FOR MOBILE */}
        <div className="md:hidden flex gap-2 mb-4 flex-none">
           <button 
             onClick={() => setActiveMobileTab('menu')}
             className={cn(
               "flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all border",
               activeMobileTab === 'menu' ? "bg-white/10 text-white border-white/20" : "bg-transparent text-gray-500 border-transparent"
             )}
           >
             1. Add Items
           </button>
           <button 
             onClick={() => setActiveMobileTab('ticket')}
             className={cn(
               "flex-1 py-2 text-xs font-black uppercase tracking-widest rounded-xl transition-all border flex items-center justify-center gap-2",
               activeMobileTab === 'ticket' ? "bg-white/10 text-white border-white/20" : "bg-transparent text-gray-500 border-transparent"
             )}
           >
             2. Review Changes 
             <Badge className="h-4 min-w-4 p-0 px-1 bg-primary text-black border-none text-[8px] font-bold">{cartCount}</Badge>
           </button>
        </div>

        {/* TOP BAR */}
        <div className={cn(
           "grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 flex-none",
           activeMobileTab === 'ticket' && "hidden md:grid"
        )}>
           <div className="space-y-1">
             <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Table Assignment</label>
             <div className="flex gap-2">
               {isAppendMode ? (
                  <div className="flex-1 h-12 bg-primary/10 border border-primary/20 rounded-xl px-4 flex items-center gap-2 text-primary font-bold">
                     <Armchair className="w-4 h-4" /> Table {tableNumber} (Active Order)
                  </div>
               ) : (
                 <>
                  {tables.length > 0 && availableTables.length === 0 ? (
                    <div className="flex-1 flex items-center gap-2 px-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold h-12">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      No available tables
                    </div>
                  ) : (
                    <select 
                      className={cn(
                        "flex-1 h-12 bg-black/40 border rounded-xl px-4 text-white font-bold appearance-none focus:outline-none focus:ring-1 transition-all",
                        isTableOccupied ? "border-red-500 ring-red-500/20" : "border-white/10 focus:ring-primary/50"
                      )}
                      value={tableId}
                      onChange={(e) => handleTableChange(e.target.value)}
                      disabled={submitting}
                    >
                      <option value="">Choose Table...</option>
                      {availableTables.map(t => (
                        <option key={t.id} value={t.id} className="text-white bg-zinc-900">
                          🪑 Table {t.table_number}
                        </option>
                      ))}
                    </select>
                  )}
                  <Button variant="secondary" size="icon" className="h-12 w-12 shrink-0 bg-white/5 border border-white/5 hover:bg-white/10" onClick={() => setIsScannerOpen(true)} disabled={submitting}>
                    <QrCode className="w-5 h-5" />
                  </Button>
                 </>
               )}
             </div>
           </div>

           <div className="space-y-1">
             <label className="text-[10px] font-black text-muted uppercase tracking-[0.2em]">Search Menu</label>
             <div className="relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
               <Input 
                 value={searchTerm} 
                 onChange={(e) => setSearchTerm(e.target.value)} 
                 className="pl-10 h-12 bg-black/20 border-white/10 focus:border-primary/50"
                 placeholder="Search dishes or drinks..."
                 disabled={submitting}
               />
             </div>
           </div>
        </div>

        {/* CATEGORY TABS */}
        <div className={cn(
           "flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-none flex-none items-center",
           activeMobileTab === 'ticket' && "hidden md:flex"
        )}>
          <Button 
             size="sm" 
             variant={selectedCategory === 'All' ? 'primary' : 'outline'}
             onClick={() => setSelectedCategory('All')}
             className="rounded-full px-5 text-[10px] font-black uppercase tracking-wider h-8"
             disabled={submitting}
          >
             All
          </Button>
          {categories.map(cat => (
            </Button 
                key={cat.id}
                size="sm"
                variant={selectedCategory === cat.name ? 'primary' : 'outline'}
                onClick={() => setSelectedCategory(cat.name)}
                className="rounded-full px-5 whitespace-nowrap text-[10px] font-black uppercase tracking-wider h-8 border-white/10"
                disabled={submitting}
            black uppercase tracking-wider h-8 border-white/10"
                disabled={submitting}
             >
                {cat.name}
             </Button>
          ))}
        </div>

        {/* MAIN BODY */}
        <div className="flex-1 flex flex-col md:flex-row gap-6 overflow-hidden">
           
           {/* LEFT: MENU BROWSER */}
           <div className={cn(
              "w-full md:w-[55%] flex flex-col overflow-hidden bg-black/40 rounded-3xl border border-white/5 relative",
              activeMobileTab !== 'menu' && "hidden md:flex"
           )}>
              <div className="flex-1 overflow-y-auto p-4 custom-scrollbar pb-24">
                {menuLoading ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted gap-4">
                     <Loader2 className="w-8 h-8 animate-spin text-primary" />
                     <p className="text-xs font-bold uppercase tracking-widest text-center">Loading Fresh Menu...</p>
                  </div>
                ) : filteredMenu.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-muted gap-4 opacity-30">
                     <Utensils className="w-12 h-12" />
                     <p className="text-xs font-bold uppercase tracking-widest text-center">No items found</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {filteredMenu.map(item => {
                       const isAdded = lastAddedId === item.id;
                       return (
                        <div 
                          key={item.id} 
                          className={cn(
                            "flex items-center h-16 p-2 rounded-lg bg-zinc-900 border transition-all cursor-pointer group active:scale-95",
                            isAdded ? "border-primary ring-1 ring-primary/40 pulse-add" : "border-zinc-800 hover:border-zinc-700",
                            submitting && "opacity-50 pointer-events-none"
                          )} 
                          onClick={() => addToCart(item)}
                        >
                           <div className="h-12 w-12 rounded-md overflow-hidden bg-black/60 flex-shrink-0">
                              {item.image_url ? (
                                 <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                              ) : (
                                 <div className="w-full h-full flex items-center justify-center">
                                    <Armchair className="w-6 h-6 text-zinc-700" />
                                 </div>
                              )}
                           </div>
                           <div className="flex-grow ml-3 min-w-0">
                              <p className="text-sm font-bold text-gray-100 truncate group-hover:text-primary transition-colors">
                                {item.name}
                              </p>
                              <p className="text-xs text-yellow-500 font-medium mt-0.5">
                                ETB {item.price.toLocaleString()}
                              </p>
                           </div>
                           <div className="h-8 w-8 rounded-md bg-primary flex items-center justify-center shadow-lg shadow-primary/10 flex-shrink-0 transition-transform group-active:scale-90">
                              <Plus className="w-4 h-4 text-black" />
                           </div>
                        </div>
                       );
                    })}
                  </div>
                )}
              </div>

              {/* MOBILE ONLY: View Changes Bar */}
              <div className="md:hidden absolute bottom-4 left-4 right-4 z-10">
                 <button 
                   onClick={() => setActiveMobileTab('ticket')}
                   className="w-full h-14 bg-primary text-black rounded-2xl flex items-center justify-between px-6 shadow-2xl shadow-primary/20 active:scale-[0.98] transition-all"
                 >
                    <div className="flex items-center gap-3">
                       <div className="bg-black text-white text-[10px] font-black h-6 min-w-6 px-1 flex items-center justify-center rounded-lg">
                          {cartCount}
                       </div>
                       <span className="font-black text-xs uppercase tracking-widest">Review Changes</span>
                    </div>
                    <div className="flex items-center gap-2">
                       <span className="font-mono font-black text-sm">ETB {newItemsTotal.toLocaleString()}</span>
                       <ChevronRight className="w-5 h-5" />
                    </div>
                 </button>
              </div>
           </div>

           {/* RIGHT: TICKET PANEL */}
           <div className={cn(
              "w-full md:w-[45%] bg-[#0B0B0B] border border-white/5 rounded-3xl flex flex-col shadow-2xl overflow-hidden",
              activeMobileTab !== 'ticket' && "hidden md:flex"
           )}>
              <div className="p-4 border-b border-white/5 bg-white/[0.02] flex justify-between items-center">
                 <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setActiveMobileTab('menu')}
                      className="md:hidden h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center mr-1"
                    >
                       <ArrowLeft className="w-4 h-4 text-white" />
                    </button>
                    <h3 className="font-black flex items-center gap-2 text-white text-[10px] uppercase tracking-[0.2em]">
                       <ShoppingBag className="h-4 w-4 text-primary"/> {isAppendMode ? "Additional Items" : "Table Ticket"}
                    </h3>
                 </div>
                 <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] h-5 min-w-5 flex items-center justify-center font-black">{cart.length}</Badge>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-black/40">
                 {isAppendMode && (
                   <div className="p-3 bg-white/5 border border-white/5 rounded-2xl mb-4">
                      <div className="flex items-center gap-2 mb-1">
                         <Hash className="w-3 h-3 text-gray-500" />
                         <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Previous Total</span>
                      </div>
                      <span className="text-lg font-mono font-black text-gray-400">ETB {existingOrderTotal.toLocaleString()}</span>
                   </div>
                 )}

                 {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-muted gap-3 opacity-20 py-20">
                      <ShoppingBag className="w-12 h-12" />
                      <p className="text-[10px] font-black uppercase tracking-widest text-center">No new items selected</p>
                    </div>
                 ) : (
                    cart.map(item => (
                       <div key={item.id} className="flex flex-col bg-zinc-900/40 border border-white/5 rounded-2xl p-3 relative group">
                          <div className="flex justify-between items-start gap-2">
                             <div className="flex-1">
                                <p className="text-sm font-bold text-foreground leading-tight">{item.name}</p>
                                <p className="text-[10px] text-muted font-bold mt-1 uppercase tracking-wider">ETB {item.price}</p>
                             </div>
                             <span className="font-mono text-primary font-black text-sm bg-primary/10 px-2 py-0.5 rounded-lg">x{item.quantity}</span>
                          </div>
                          
                          <div className="flex justify-between items-center mt-3 pt-3 border-t border-white/5">
                             <span className="text-xs font-black text-white font-mono">ETB {(item.price * item.quantity).toLocaleString()}</span>
                             <div className="flex items-center gap-2">
                                <button onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }} className="w-8 h-8 flex items-center justify-center bg-red-500/10 hover:bg-red-500/20 rounded-xl text-red-500 transition-colors" disabled={submitting}>
                                   {item.quantity === 1 ? <Trash2 className="h-4 w-4"/> : <Minus className="h-4 w-4"/>}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); addToCart(item); }} className="w-8 h-8 flex items-center justify-center bg-green-500/10 hover:bg-green-500/20 rounded-xl text-green-500 transition-colors" disabled={submitting}>
                                   <Plus className="h-4 w-4"/>
                                </button>
                             </div>
                          </div>
                       </div>
                    ))
                 )}
              </div>
              
              <div className="p-5 bg-[#0e0e0e] border-t border-white/5 space-y-4 shadow-[0_-10px_30px_rgba(0,0,0,0.5)]">
                 <textarea 
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="New preparation notes..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-3 text-xs text-gray-300 h-14 transition-all resize-none focus:outline-none focus:border-primary/50 focus:bg-black/60 placeholder:text-gray-600 font-medium"
                    disabled={submitting}
                 />

                 <div className="space-y-3">
                    <div className="flex justify-between items-end">
                       <span className="text-muted text-[10px] font-black uppercase tracking-[0.2em]">{isAppendMode ? "New Addition" : "Total Amount"}</span>
                       <span className="text-2xl font-black text-primary font-mono tracking-tighter">ETB {newItemsTotal.toLocaleString()}</span>
                    </div>
                    {isAppendMode && (
                      <div className="flex justify-between items-center py-2 px-3 bg-white/5 rounded-xl">
                         <span className="text-[10px] text-gray-500 font-black uppercase tracking-widest">New Order Total</span>
                         <span className="text-sm font-bold text-white font-mono">ETB {(existingOrderTotal + newItemsTotal).toLocaleString()}</span>
                      </div>
                    )}
                    <Button 
                       className={cn(
                         "w-full font-black h-12 text-xs uppercase tracking-widest shadow-xl rounded-2xl transition-all",
                         isButtonDisabled ? "bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none" : "bg-primary text-black hover:bg-primary/90 shadow-primary/10"
                       )}
                       onClick={submitOrder} 
                       disabled={isButtonDisabled}
                       isLoading={submitting}
                    >
                       {getButtonLabel()}
                    </Button>
                 </div>
              </div>
           </div>
        </div>
      </div>
      
      {!isAppendMode && isScannerOpen && (
        <QRScanner 
          onScan={(data) => { 
            const t = tables.find(tbl => tbl.table_number.toString() === data);
            if (t) {
              if (t.status === 'available') {
                setTableId(t.id);
                setTableNumber(data);
                showToast(`Table ${data} verified!`);
              } else {
                showToast(`Table ${data} is currently ${t.status}.`, 'warning');
              }
            } else {
              showToast("Unrecognized Table QR", "error");
            }
            setIsScannerOpen(false); 
          }} 
          onClose={() => setIsScannerOpen(false)} 
        />
      )}

      <style>{`
        @keyframes pulse-yellow-glow {
          0% { box-shadow: 0 0 0 0 rgba(255, 184, 0, 0); }
          50% { box-shadow: 0 0 20px 0 rgba(255, 184, 0, 0.4); }
          100% { box-shadow: 0 0 0 0 rgba(255, 184, 0, 0); }
        }
        .pulse-add {
          animation: pulse-yellow-glow 0.6s ease-in-out;
        }
      `}</style>
    </Dialog>
  );
};
