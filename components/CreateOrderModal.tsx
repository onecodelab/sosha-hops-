import React, { useState } from 'react';
import { Dialog, Button, Input, showToast, cn } from './ui';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { useMenu } from '../hooks/useMenu';
import { CartItem } from '../types';
import { Search, Plus, Minus, ShoppingBag, Utensils, QrCode, Trash2 } from 'lucide-react';
import QRScanner from './QRScanner';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOrderCreated: () => void;
  initialTableNo?: string;
}

export const CreateOrderModal: React.FC<CreateOrderModalProps> = ({ 
  isOpen, onClose, onOrderCreated, initialTableNo = '' 
}) => {
  const { user } = useAuth();
  const { menuItems, categories, loading: menuLoading } = useMenu(true);
  
  const [tableNumber, setTableNumber] = useState(initialTableNo);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [notes, setNotes] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Reset state when modal opens
  React.useEffect(() => {
    if (isOpen) {
      setTableNumber(initialTableNo);
      setCart([]);
      setNotes('');
      setSearchTerm('');
      setSelectedCategory('All');
    }
  }, [isOpen, initialTableNo]);

  // Cart Management
  const addToCart = (item: any) => {
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) return prev.map(i => i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { ...item, quantity: 1 }];
    });
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

  // Submit Logic
  const submitOrder = async () => {
    if (!tableNumber || cart.length === 0) {
      showToast('Please select a table and at least one item.', 'warning');
      return;
    }
    
    setSubmitting(true);
    try {
      const cartTotal = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);
      
      const { data: order, error } = await supabase
        .from('orders')
        .insert({
          table_number: tableNumber,
          waiter_id: user?.id,
          status: 'pending',
          order_type: 'dine-in', // Defaulting to dine-in for now
          total_amount: cartTotal,
          customer_notes: notes.trim() || null
        })
        .select()
        .single();

      if (error || !order) throw error;

      const itemsPayload = cart.map(i => ({
        order_id: order.id,
        menu_item_id: i.id,
        quantity: i.quantity,
        price: i.price,
        special_instructions: i.instructions || null
      }));

      const { error: itemsError } = await supabase.from('order_items').insert(itemsPayload);
      if (itemsError) throw itemsError;

      showToast(`Order for Table ${tableNumber} sent to kitchen!`, 'success');
      onOrderCreated();
      onClose();
    } catch (err: any) {
      console.error(err);
      showToast('Failed to create order: ' + err.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  // Filter Menu
  const filteredMenu = menuItems.filter(m => {
    const matchesSearch = m.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  if (!isOpen) return null;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="New Order">
      <div className="flex flex-col h-[75vh]">
        {/* Top Controls: Table & Search */}
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
           <div className="w-full sm:w-1/3">
             <label className="text-xs font-bold text-gray-500 mb-1 block uppercase">Table No.</label>
             <div className="flex gap-2">
               <Input 
                 type="text" 
                 value={tableNumber} 
                 onChange={(e) => setTableNumber(e.target.value)} 
                 placeholder="#"
                 className="text-lg font-bold h-12 bg-black/20"
               />
               <Button variant="secondary" size="icon" className="h-12 w-12 shrink-0" onClick={() => setIsScannerOpen(true)}>
                 <QrCode className="w-5 h-5" />
               </Button>
             </div>
           </div>
           <div className="flex-1">
             <label className="text-xs font-bold text-gray-500 mb-1 block uppercase">Search Menu</label>
             <div className="relative">
               <Search className="absolute left-3 top-3.5 h-4 w-4 text-gray-500" />
               <Input 
                 value={searchTerm} 
                 onChange={(e) => setSearchTerm(e.target.value)} 
                 className="pl-9 h-12 bg-black/20"
                 placeholder="Search items..."
               />
             </div>
           </div>
        </div>

        {/* Categories */}
        <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-none flex-shrink-0">
          <Button 
             size="sm" 
             variant={selectedCategory === 'All' ? 'primary' : 'outline'}
             onClick={() => setSelectedCategory('All')}
             className="rounded-full px-4"
          >
             All
          </Button>
          {categories.map(cat => (
             <Button 
                key={cat}
                size="sm"
                variant={selectedCategory === cat ? 'primary' : 'outline'}
                onClick={() => setSelectedCategory(cat)}
                className="rounded-full px-4 whitespace-nowrap"
             >
                {cat}
             </Button>
          ))}
        </div>

        {/* Main Split: Menu & Cart */}
        <div className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden">
           {/* Menu List */}
           <div className="flex-1 overflow-y-auto pr-2 space-y-2 custom-scrollbar">
              {menuLoading && <p className="text-center text-gray-500 mt-4">Loading menu...</p>}
              {!menuLoading && filteredMenu.length === 0 && (
                 <div className="text-center text-gray-500 mt-10">
                    <Utensils className="w-10 h-10 mx-auto opacity-20 mb-2" />
                    <p>No items found</p>
                 </div>
              )}
              {filteredMenu.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 rounded-xl bg-gray-900/50 border border-gray-800 hover:border-gray-600 transition-colors cursor-pointer group" onClick={() => addToCart(item)}>
                     <div className="flex items-center gap-3">
                         <div className="h-10 w-10 rounded-lg bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-500 border border-gray-700 overflow-hidden shrink-0">
                           {item.image_url ? (
                              <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" />
                           ) : (
                              item.name.slice(0,2).toUpperCase()
                           )}
                         </div>
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-gray-200 truncate">{item.name}</p>
                          <p className="text-xs text-gray-500">ETB {item.price}</p>
                        </div>
                     </div>
                     <Button size="sm" variant="ghost" className="text-primary opacity-0 group-hover:opacity-100"><Plus className="h-4 w-4"/></Button>
                  </div>
                ))
              }
           </div>

           {/* Cart Summary - RESTRUCTURED */}
           <div className="w-full md:w-1/3 bg-[#0A0A0A] border border-gray-800 rounded-xl flex flex-col shadow-xl overflow-hidden h-[400px] md:h-auto">
              
              {/* Header */}
              <div className="p-3 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
                 <h3 className="font-bold flex items-center gap-2 text-white text-sm uppercase tracking-wide">
                    <ShoppingBag className="h-4 w-4 text-primary"/> Current Order
                 </h3>
                 <span className="text-xs text-gray-500">{cart.length} Items</span>
              </div>

              {/* Scrollable Items */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar bg-black/20">
                 {cart.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-gray-600 gap-2 opacity-50">
                      <ShoppingBag className="w-10 h-10" />
                      <p className="text-xs font-medium">Cart is empty</p>
                    </div>
                 ) : (
                    cart.map(item => (
                       <div key={item.id} className="flex flex-col bg-[#151515] border border-gray-800 rounded-lg p-2 relative group">
                          <div className="flex justify-between items-start">
                             <div className="pr-6">
                                <p className="text-sm font-medium text-gray-200 line-clamp-2">{item.name}</p>
                                <p className="text-xs text-gray-500 mt-0.5">ETB {item.price}</p>
                             </div>
                             <span className="font-mono text-white font-bold text-sm">x{item.quantity}</span>
                          </div>
                          
                          <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-800/50">
                             <span className="text-xs font-bold text-primary">ETB {item.price * item.quantity}</span>
                             <div className="flex items-center gap-1">
                                <button onClick={(e) => { e.stopPropagation(); removeFromCart(item.id); }} className="w-6 h-6 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded text-red-400 transition-colors">
                                   {item.quantity === 1 ? <Trash2 className="h-3 w-3"/> : <Minus className="h-3 w-3"/>}
                                </button>
                                <button onClick={(e) => { e.stopPropagation(); addToCart(item); }} className="w-6 h-6 flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded text-green-400 transition-colors">
                                   <Plus className="h-3 w-3"/>
                                </button>
                             </div>
                          </div>
                       </div>
                    ))
                 )}
              </div>
              
              {/* Fixed Footer */}
              <div className="p-3 bg-[#111] border-t border-gray-800 space-y-3 z-10 shadow-[0_-5px_15px_rgba(0,0,0,0.3)]">
                 <div>
                    <textarea 
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add notes..."
                        className="w-full bg-black/40 border border-gray-800 rounded-lg p-2 text-xs text-gray-300 h-10 min-h-[40px] focus:h-16 transition-all resize-none focus:outline-none focus:border-gray-600 focus:bg-black/60 placeholder:text-gray-600"
                    />
                 </div>

                 <div className="space-y-2">
                    <div className="flex justify-between items-end">
                       <span className="text-gray-400 text-xs font-bold uppercase">Total</span>
                       <span className="text-xl font-bold text-primary font-mono">ETB {cart.reduce((a,b) => a + (b.price*b.quantity), 0).toLocaleString()}</span>
                    </div>
                    <Button 
                       className="w-full bg-primary text-black font-bold hover:bg-primary/90 h-10 text-sm shadow-lg shadow-primary/10" 
                       onClick={submitOrder} 
                       disabled={cart.length === 0 || !tableNumber || submitting}
                       isLoading={submitting}
                    >
                       Send to Kitchen
                    </Button>
                 </div>
              </div>
           </div>
        </div>
      </div>
      
      {/* QR Scanner Overlay */}
      {isScannerOpen && (
        <QRScanner 
          onScan={(data) => { setTableNumber(data); setIsScannerOpen(false); showToast(`Table ${data} scanned!`); }} 
          onClose={() => setIsScannerOpen(false)} 
        />
      )}
    </Dialog>
  );
};