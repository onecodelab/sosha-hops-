
import React, { useEffect, useState } from 'react';
import { Order } from '../types';
import { cn, Badge, Button } from './ui';
import { Clock, Check, Bot, AlertTriangle, MessageSquare, PlusCircle } from 'lucide-react';

interface OrderCardProps {
  order: Order;
  role: 'waiter' | 'kitchen' | 'manager';
  onAction?: (action: string, orderId: string) => void;
  showTimer?: boolean;
}

export const OrderCard: React.FC<OrderCardProps> = ({ 
  order, role, onAction, showTimer = true 
}) => {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    // Calculate elapsed time every minute
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
      case 'accepted': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
      case 'preparing': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
      case 'ready': return 'bg-green-500/20 text-green-400 border-green-500/30 animate-pulse';
      case 'served': return 'bg-purple-600/20 text-purple-500 border-purple-500/30';
      case 'completed': return 'bg-gray-600/20 text-gray-500 border-gray-600/30';
      case 'paid': return 'bg-green-600/20 text-green-500 border-green-600/30';
      case 'cancelled': return 'bg-red-500/20 text-red-500 border-red-500/30';
      default: return 'bg-gray-800 text-gray-400';
    }
  };

  const getTimerColor = (mins: number) => {
    if (mins > 30) return "text-red-500 animate-pulse";
    if (mins > 15) return "text-yellow-500";
    return "text-gray-400";
  };

  const isKitchen = role === 'kitchen';
  const isWaiter = role === 'waiter';

  return (
    <div className={cn(
      "relative p-4 rounded-xl border flex flex-col gap-3 transition-all", 
      "bg-[#1A1A1A] border-gray-800 hover:border-gray-700"
    )}>
       {order.status === 'ready' && isWaiter && (
          <div className="absolute top-4 right-4 animate-bounce">
             <span className="flex h-3 w-3">
               <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
               <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
             </span>
          </div>
       )}
       
       {/* Header */}
       <div className="flex justify-between items-start">
          <div>
             <span className="text-sm font-bold text-white">
                {order.order_number || `Order #${order.id.slice(0,5)}`}
             </span>
             <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold text-gray-300 px-1.5 py-0.5 bg-gray-800 rounded border border-gray-700">
                    T-{order.table_number}
                </span>
                <span className="text-xs text-gray-400 font-mono flex items-center">
                   <Clock className="w-3 h-3 mr-1" />
                   {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                   {showTimer && <span className={cn("ml-1 font-bold", getTimerColor(elapsed))}>({elapsed}m)</span>}
                </span>
             </div>
          </div>
          <div className="flex items-center gap-2">
             <Badge className={cn("text-[10px] uppercase", getStatusColor(order.status))}>
                 {order.status}
             </Badge>
          </div>
       </div>

       {/* Items */}
       <div className="bg-black/20 p-2 rounded-lg text-sm text-gray-300 space-y-1">
          {order.order_items?.map((item: any) => (
             <div key={item.id} className="flex flex-col border-b border-gray-800/50 last:border-0 pb-1 last:pb-0 mb-1 last:mb-0">
                <div className="flex justify-between">
                    <span>
                        <span className="text-primary font-bold mr-2">{item.quantity}x</span> 
                        {item.menu_item?.name}
                    </span>
                    {!isKitchen && <span className="text-gray-600">ETB {item.price * item.quantity}</span>}
                </div>
                {item.special_instructions && (
                    <span className="text-[10px] text-yellow-500/80 italic ml-6">"{item.special_instructions}"</span>
                )}
             </div>
          ))}
          {order.customer_notes && (
             <div className="mt-2 pt-2 border-t border-gray-700/50 flex gap-2 text-xs text-yellow-500 font-medium">
                <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                <span>Note: {order.customer_notes}</span>
             </div>
          )}
       </div>

       {/* Actions */}
       <div className="flex justify-end gap-2 mt-auto pt-2">
          {/* Waiter Actions */}
          {isWaiter && order.status === 'ready' && (
             <Button size="sm" onClick={() => onAction?.('served', order.id)} className="bg-green-600 hover:bg-green-700 text-white w-full">
                <Check className="w-4 h-4 mr-2" /> Mark Served
             </Button>
          )}

          {isWaiter && ['pending', 'accepted', 'preparing', 'ready', 'served'].includes(order.status) && (
             <Button size="sm" onClick={() => onAction?.('append', order.id)} className="bg-primary text-black font-bold flex-1">
                <PlusCircle className="w-3 h-3 mr-2" /> Add Items
             </Button>
          )}

          {/* Kitchen Actions */}
          {isKitchen && order.status === 'pending' && (
             <Button size="sm" onClick={() => onAction?.('accepted', order.id)} className="w-full bg-primary text-black hover:bg-primary/90">
                Accept Order
             </Button>
          )}
          {isKitchen && (order.status === 'accepted' || order.status === 'preparing') && (
             <Button size="sm" onClick={() => onAction?.('ready', order.id)} className="w-full bg-green-600 hover:bg-green-700 text-white">
                Mark Ready
             </Button>
          )}

          {/* Status Text for Waiters (Only if no main action is available or as secondary) */}
          {isWaiter && ['pending', 'accepted', 'preparing'].includes(order.status) && (
             <p className="text-[10px] text-gray-500 italic py-1 text-center w-full block">
                {order.status === 'preparing' ? 'Kitchen is preparing...' : 'Waiting for kitchen...'}
             </p>
          )}
       </div>
    </div>
  );
};
