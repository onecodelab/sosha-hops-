
import React, { useEffect, useState } from 'react';
import { Order } from '../types';
import { cn, Badge, Button, showToast } from './ui';
import { supabase } from '../supabase';
import { useAuth } from '../AuthContext';
import { Clock, MessageSquare, PlusCircle, CheckCircle2, Loader2, Flag, Receipt, FileText } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  role: 'waiter' | 'kitchen' | 'manager';
  onAction?: (action: string, orderId: string) => void;
  showTimer?: boolean;
}

export const OrderCard: React.FC<OrderCardProps> = ({ 
  order, role, onAction, showTimer = true 
}) => {
  const { user } = useAuth();
  const [elapsed, setElapsed] = useState(0);
  const [isActing, setIsActing] = useState(false);

  useEffect(() => {
    const tick = () => {
      const start = new Date(order.created_at).getTime();
      const now = new Date().getTime();
      setElapsed(Math.floor((now - start) / 60000));
    };
    tick();
    const interval = setInterval(tick, 60000);
    return () => clearInterval(interval);
  }, [order.created_at]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30';
      case 'accepted':
      case 'preparing': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'ready': return 'bg-green-500/20 text-green-400 border-green-500/30 animate-pulse';
      case 'served': return 'bg-purple-600/20 text-purple-500 border-purple-500/30';
      case 'paid': return 'bg-blue-600/20 text-blue-400 border-blue-500/30';
      case 'closed': return 'bg-gray-600/20 text-gray-500 border-gray-600/30';
      default: return 'bg-gray-800 text-gray-400';
    }
  };

  const isKitchen = role === 'kitchen';
  const isWaiter = role === 'waiter';

  const handleMarkServed = async () => {
    setIsActing(true);
    try {
      const now = new Date().toISOString();
      const { error } = await supabase  
        .from('orders')  
        .update({  
          status: 'served',  
          last_updated: now,
          served_at: now
        })  
        .eq('id', order.id);

      if (error) throw error;
      // Note: Removed showToast here as dashboard will now show BillModal
      if (onAction) onAction('served', order.id);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsActing(false);
    }
  };

  const handleGenerateBill = async () => {
    setIsActing(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ 
          payment_status: 'pending',
          last_updated: new Date().toISOString() 
        })
        .eq('id', order.id);
      
      if (error) throw error;
      showToast("Bill generated. Ready for payment.", "success");
      if (onAction) onAction('bill_generated', order.id);
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsActing(false);
    }
  };

  const handleCompleteOrder = async () => {
    if (!confirm("Confirm guest has left and table is ready to be cleared?")) return;

    setIsActing(true);
    try {
      const now = new Date().toISOString();

      // Clear the table session
      if (order.table_id) {
        await supabase
          .from('table_sessions')
          .update({ is_active: false, closed_at: now })
          .eq('table_id', order.table_id)
          .eq('is_active', true);

        await supabase
          .from('tables')
          .update({
            status: 'available',
            current_order_id: null,
            current_session_id: null,
            last_updated: now,
          })
          .eq('id', order.table_id);
      }

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          completed_at: now,
          closed_at: now,
          status: 'closed',
          last_updated: now,
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      showToast('Table cleared.', 'success');
      if (onAction) onAction('completed', order.id);
    } catch (err: any) {
      showToast(`Failed: ${err.message}`, 'error');
    } finally {
      setIsActing(false);
    }
  };

  return (
    <div className={cn(
      "relative p-4 rounded-xl border flex flex-col gap-3 transition-all", 
      "bg-[#1A1A1A] border-gray-800 hover:border-gray-700 shadow-xl"
    )}>
       <div className="flex justify-between items-start">
          <div className="min-w-0 flex-1">
             <span className="text-sm font-bold text-white">#{order.order_number?.slice(-4) || order.id.slice(0,5)}</span>
             <div className="flex items-center gap-2 mt-1.5">
                <span className="text-[10px] font-black text-gray-300 px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700 uppercase tracking-tighter">
                    T-{order.table_number}
                </span>
                {showTimer && <span className="text-[10px] text-gray-500 font-mono font-bold flex items-center">
                   <Clock className="w-2.5 h-2.5 mr-1" />{elapsed}m
                </span>}
             </div>
          </div>
          <Badge className={cn("text-[9px] uppercase font-black", getStatusColor(order.status))}>
              {order.status}
          </Badge>
       </div>

       <div className="bg-black/20 p-2 rounded-lg text-sm text-gray-300 space-y-1">
          {order.order_items?.map((item: any) => (
             <div key={item.id} className="flex justify-between border-b border-gray-800/50 last:border-0 pb-1 mb-1">
                <span><span className="text-primary font-bold mr-2">{item.quantity}x</span>{item.menu_item?.name}</span>
                {!isKitchen && <span className="text-gray-600 font-mono text-[10px]">{(item.price * item.quantity).toLocaleString()}</span>}
             </div>
          ))}
       </div>

       <div className="flex flex-col gap-2 mt-auto pt-2">
          {/* Action: Add Items */}
          {isWaiter && !['closed', 'cancelled', 'paid'].includes(order.status) && (
             <Button size="sm" onClick={() => onAction?.('append', order.id)} className="w-full bg-white/5 text-gray-400 font-black uppercase text-[10px] h-10 rounded-xl hover:bg-white/10">
                <PlusCircle className="w-4 h-4 mr-2" /> Add More Items
             </Button>
          )}

          {/* Action: Mark Served */}
          {isWaiter && order.status === 'ready' && (
             <Button size="sm" onClick={handleMarkServed} disabled={isActing} className="bg-green-600 hover:bg-green-700 text-white w-full h-10 font-black uppercase text-[10px] shadow-lg">
                {isActing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />}
                Mark Served (Done)
             </Button>
          )}

          {/* Action: Generate Bill (Moves order to 'pending' payment status) */}
          {isWaiter && order.status === 'served' && order.payment_status === 'unpaid' && (
             <Button size="sm" onClick={() => onAction?.('pay', order.id)} disabled={isActing} className="bg-primary text-black w-full h-10 font-black uppercase text-[10px] shadow-lg">
                {isActing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <FileText className="w-4 h-4 mr-2" />}
                Generate Bill
             </Button>
          )}

          {/* Action: Process Payment */}
          {isWaiter && order.status === 'served' && order.payment_status === 'pending' && (
             <Button size="sm" onClick={() => onAction?.('pay', order.id)} className="bg-blue-600 hover:bg-blue-700 text-white w-full h-10 font-black uppercase text-[10px] shadow-lg">
                <Receipt className="w-4 h-4 mr-2" /> Process Payment
             </Button>
          )}

          {/* Action: Clear Table */}
          {isWaiter && (order.status === 'paid' || (order.status === 'served' && order.payment_status === 'paid')) && !order.closed_at && (
             <Button size="sm" onClick={() => onAction?.('completed', order.id)} disabled={isActing} className="bg-yellow-500 hover:bg-yellow-600 text-black w-full h-10 font-black uppercase text-[10px] tracking-widest shadow-lg">
                {isActing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Flag className="w-4 h-4 mr-2" />}
                Complete & Clear Table
             </Button>
          )}

          {/* Kitchen Controls */}
          {isKitchen && order.status === 'pending' && (
             <Button size="sm" onClick={() => onAction?.('accepted', order.id)} className="w-full bg-primary text-black h-9 font-bold">Accept</Button>
          )}
          {isKitchen && (order.status === 'accepted' || order.status === 'preparing') && (
             <Button size="sm" onClick={() => onAction?.('ready', order.id)} className="w-full bg-green-600 text-white h-9 font-bold">Ready</Button>
          )}
       </div>
    </div>
  );
};
