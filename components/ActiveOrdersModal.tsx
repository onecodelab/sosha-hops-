
import React from 'react';
import { Dialog, Badge, cn, Button } from './ui';
import { Order } from '../types';
import { Clock, User, MessageSquare, Utensils, ArrowRight } from 'lucide-react';

interface ActiveOrdersModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
}

export const ActiveOrdersModal: React.FC<ActiveOrdersModalProps> = ({ isOpen, onClose, orders }) => {
  const getStatusInfo = (status: string) => {
    switch (status) {
      case 'pending': return { color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20', label: 'Pending' };
      case 'accepted': return { color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', label: 'Accepted' };
      case 'preparing': return { color: 'text-orange-400 bg-orange-500/10 border-orange-500/20', label: 'Preparing' };
      case 'ready': return { color: 'text-green-400 bg-green-500/10 border-green-500/20 animate-pulse', label: 'Ready' };
      default: return { color: 'text-gray-400 bg-gray-500/10 border-gray-500/20', label: status };
    }
  };

  const getElapsedTime = (createdAt: string) => {
    const diff = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    return diff > 60 ? `${Math.floor(diff / 60)}h ${diff % 60}m` : `${diff}m`;
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Active Production Orders">
      <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2 custom-scrollbar">
        {orders.length === 0 ? (
          <div className="text-center py-12 text-muted italic">
            <Utensils className="w-12 h-12 mx-auto mb-4 opacity-10" />
            No active orders currently in production.
          </div>
        ) : (
          orders.map((order) => {
            const status = getStatusInfo(order.status);
            return (
              <div key={order.id} className="p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-lg border border-primary/20">
                      {order.table_number}
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white">Order #{order.order_number || order.id.slice(0, 5)}</h4>
                      <div className="flex items-center gap-2 text-[10px] text-gray-500 uppercase font-bold tracking-wider mt-0.5">
                         <Clock className="w-3 h-3" /> {getElapsedTime(order.created_at)} ago
                         <span>•</span>
                         <User className="w-3 h-3" /> {order.waiter?.full_name || 'System'}
                      </div>
                    </div>
                  </div>
                  <Badge className={cn("text-[10px] uppercase font-black px-2 py-1", status.color)}>
                    {status.label}
                  </Badge>
                </div>

                <div className="bg-black/20 rounded-xl p-3 space-y-1.5 mb-2">
                  {order.order_items?.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-xs">
                      <span className="text-gray-300 font-medium">
                        <span className="text-primary font-bold mr-2">{item.quantity}x</span>
                        {item.menu_item?.name}
                      </span>
                    </div>
                  ))}
                </div>

                {order.customer_notes && (
                  <div className="flex items-start gap-2 text-[10px] text-yellow-500/80 bg-yellow-500/5 p-2 rounded-lg border border-yellow-500/10">
                    <MessageSquare className="w-3 h-3 mt-0.5 shrink-0" />
                    <span className="italic">"{order.customer_notes}"</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
      <div className="pt-4 flex justify-end">
        <Button variant="outline" onClick={onClose}>Close View</Button>
      </div>
    </Dialog>
  );
};
