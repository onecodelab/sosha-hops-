
import React, { useEffect, useState } from 'react';
import { Order } from '../types';
import { cn, Badge, Button, showToast } from './ui';
import { useAuth } from '../AuthContext';
import { Clock, MessageSquare, PlusCircle, CheckCircle2, Loader2, Flag, Receipt, FileText, User, Zap, Truck } from 'lucide-react';

import { orderService } from '../services/orderService';
import { BaroLeafyCard, BaroKitchenCard, BaroBillingCard } from './ElectricCard';

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

  // Detect newly-appended items by checking for the [NEW] prefix in special instructions
  const hasNewItems = (order.order_items || []).some((i: any) => i.special_instructions?.startsWith('[NEW]'));
  const isNewItem = (item: any) => item.special_instructions?.startsWith('[NEW]');

  const handleMarkServed = async () => {
    setIsActing(true);
    try {
      showToast(`Serving order ${order.order_number || order.id}...`, "warning");
      await orderService.markServed(order.id);
      showToast(`Order ${order.order_number || order.id} marked as served.`, "success");
      if (onAction) onAction('served', order.id);
    } catch (err: any) {
      console.error("Mark served error:", err);
      showToast(err.message, "error");
    } finally {
      setIsActing(false);
    }
  };

  const handleGenerateBill = async () => {
    setIsActing(true);
    try {
      await orderService.generateBill(order.id);
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
      await orderService.completeAndClearTable(order);
      showToast('Table cleared.', 'success');
      if (onAction) onAction('completed', order.id);
    } catch (err: any) {
      showToast(`Failed: ${err.message}`, 'error');
    } finally {
      setIsActing(false);
    }
  };

  const cardContent = (
    <div className={cn(
      "relative p-3 rounded-xl flex flex-col gap-2 transition-all duration-300 group",
      // Status-based Border/Glow
      order.status === 'pending' ? "bg-card border border-yellow-500/20 shadow-[0_0_15px_rgba(234,179,8,0.05)] hover:border-yellow-500/40" :
        (order.status === 'accepted' || order.status === 'preparing') ? "bg-card border border-orange-500/20 shadow-[0_0_15px_rgba(249,115,22,0.05)] hover:border-orange-500/40" :
          order.status === 'ready' ? "bg-card border border-green-500/20 shadow-[0_0_15px_rgba(34,197,94,0.05)] hover:border-green-500/40" :
            "bg-card border border-border hover:border-muted"
    )}>
      {/* Header */}
      <div className="flex justify-between items-start">
        <div className="min-w-0 flex-1">
          <span className="text-base font-black text-foreground tracking-tight">#{order.order_number?.slice(-4) || order.id.slice(0, 5)}</span>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-[9px] font-black text-muted px-1.5 py-0.5 bg-muted/10 rounded-md border border-border uppercase tracking-widest">
              T-{order.table_number}
            </span>
            {showTimer && <span className={cn("text-[9px] font-mono font-bold flex items-center", elapsed > 20 ? "text-red-500 animate-pulse" : "text-zinc-500")}>
              <Clock className="w-2.5 h-2.5 mr-1" />{elapsed}m
            </span>}
            {order.waiter?.full_name && order.waiter?.role === 'waiter' && (
              <span className="text-[9px] font-black text-primary/70 uppercase tracking-widest flex items-center gap-1 border-l border-border pl-2">
                <User className="w-2.5 h-2.5" /> {order.waiter.full_name}
              </span>
            )}
          </div>
        </div>
        <Badge className={cn("text-[8px] uppercase font-black px-2 py-1 tracking-widest border shadow-lg backdrop-blur-md", getStatusColor(order.status))}>
          {role === 'kitchen' && order.status === 'pending' ? 'INCOMING' :
            role === 'kitchen' && (order.status === 'accepted' || order.status === 'preparing') ? 'ACCEPTED' :
              role === 'kitchen' && order.status === 'ready' ? 'PREPARED' :
                order.status}
        </Badge>
        {order.source === 'chatbot' && (
          <Badge className="absolute -top-2 -right-2 bg-primary text-black border-2 border-background text-[8px] font-black px-2 py-1 shadow-xl flex items-center gap-1 animate-bounce">
            <MessageSquare className="w-3 h-3" /> BOT
          </Badge>
        )}
        {hasNewItems && (
          <Badge className="absolute -top-2 left-1/2 -translate-x-1/2 bg-cyan-500 text-black border-2 border-background text-[8px] font-black px-2.5 py-1 shadow-[0_0_20px_rgba(6,182,212,0.4)] flex items-center gap-1 animate-pulse z-20">
            <Zap className="w-3 h-3" /> UPDATED
          </Badge>
        )}
      </div>

      {/* Items List - Cleaner Look */}
      <div className="bg-muted/5 p-2 rounded-xl space-y-1.5 border border-border">
        {order.order_items?.map((item: any) => (
          <div key={item.id} className="flex flex-col border-b border-white/5 last:border-0 pb-2 last:pb-0">
            <div className="flex items-start gap-3 w-full">
              {/* Item Thumbnail */}
              <div className="w-8 h-8 rounded-lg bg-background/50 border border-border flex items-center justify-center overflow-hidden shrink-0 shadow-inner group-hover:border-primary/20 transition-colors">
                {item.menu_item?.image_url ? (
                  <img 
                    src={item.menu_item.image_url} 
                    alt={item.menu_item?.name} 
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover" 
                  />
                ) : (
                  <Receipt className="w-3 h-3 text-muted/50" />
                )}
              </div>

              <div className="flex flex-col flex-1 min-w-0">
                <div className="flex items-start gap-2 leading-tight">
                  <span className="text-primary font-black text-xs min-w-[20px] text-center bg-primary/10 border border-primary/20 rounded-md py-0.5">{item.quantity}x</span>
                  <span className="text-xs font-bold text-foreground/90 truncate pt-0.5">{item.menu_item?.name}</span>
                  {isNewItem(item) && (
                    <span className="text-[8px] font-black text-cyan-400 bg-cyan-500/15 border border-cyan-500/30 px-1.5 py-0.5 rounded-full uppercase tracking-wider animate-pulse shadow-[0_0_8px_rgba(6,182,212,0.3)] shrink-0 mt-0.5">
                      🆕 NEW
                    </span>
                  )}
                </div>

                {item.special_instructions && (
                  <div className="mt-1.5 flex items-start gap-1.5 p-1.5 bg-yellow-500/5 rounded-lg border border-yellow-500/10">
                    <MessageSquare className="w-3 h-3 text-yellow-500 shrink-0 mt-[2px]" />
                    <p className="text-[10px] text-yellow-200/90 italic leading-snug break-words pr-1">{item.special_instructions.replace('[NEW]', '').trim()}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Customer/Order Notes */}
      {order.customer_notes && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 p-2 rounded-lg">
          <p className="text-[9px] text-yellow-500 font-bold uppercase tracking-widest mb-0.5 flex items-center gap-1"><MessageSquare className="w-2.5 h-2.5" /> Note</p>
          <p className="text-xs text-yellow-200/80 italic">"{order.customer_notes}"</p>
        </div>
      )}

      {/* Buttons */}
      <div className="flex flex-col gap-2 mt-auto pt-1">
        {/* Kitchen Controls - Glossy Buttons */}
        {isKitchen && order.status === 'pending' && (
          <Button size="sm" onClick={() => onAction?.('accepted', order.id)} className="w-full bg-primary text-black h-8 rounded-lg font-black uppercase text-[10px] tracking-widest shadow-[0_0_15px_rgba(251,191,36,0.2)] hover:bg-white hover:scale-[1.02] transition-all">Accept Order</Button>
        )}
        {isKitchen && (order.status === 'accepted' || order.status === 'preparing') && (
          <Button size="sm" onClick={() => onAction?.('ready', order.id)} className="w-full bg-green-500 text-black h-8 rounded-lg font-black uppercase text-[10px] tracking-widest shadow-[0_0_15px_rgba(34,197,94,0.2)] hover:bg-green-400 hover:scale-[1.02] transition-all">Mark Prepared</Button>
        )}
        {isKitchen && order.status === 'ready' && (
          <Button size="sm" onClick={() => onAction?.('dispatch', order.id)} className="w-full bg-emerald-600 text-white h-8 rounded-lg font-black uppercase text-[10px] tracking-widest shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:bg-emerald-500 hover:scale-[1.02] transition-all">
            <Truck className="w-4 h-4 mr-2" /> Dispatch
          </Button>
        )}

        {/* Waiter Actions - Same Style */}
        {/* Action: Add Items */}
        {isWaiter && !['closed', 'cancelled', 'paid'].includes(order.status) && (
          <Button size="sm" onClick={() => onAction?.('append', order.id)} className="w-full bg-muted/10 text-muted font-black uppercase text-[10px] h-9 rounded-xl hover:bg-muted/20 hover:text-foreground border border-transparent hover:border-border">
            <PlusCircle className="w-3 h-3 mr-2" /> Add Items
          </Button>
        )}

        {/* Action: Mark Served */}
        {isWaiter && order.status === 'ready' && (
          <Button size="sm" onClick={handleMarkServed} disabled={isActing} className="bg-green-600 hover:bg-green-500 text-white w-full h-10 font-black uppercase text-[10px] shadow-lg rounded-xl tracking-widest">
            {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-2" />}
            Served
          </Button>
        )}

        {/* Action: Generate Bill */}
        {isWaiter && order.status === 'served' && order.payment_status === 'unpaid' && (
          <Button size="sm" onClick={() => onAction?.('pay', order.id)} disabled={isActing} className="bg-primary text-black w-full h-10 font-black uppercase text-[10px] shadow-lg rounded-xl tracking-widest">
            {isActing ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> : <FileText className="w-3.5 h-3.5 mr-2" />}
            Generate Bill
          </Button>
        )}

        {/* Action: Pay/Close */}
        {isWaiter && (
          (order.status === 'served' && order.payment_status === 'pending') ||
          ((order.status === 'paid' || (order.status === 'served' && order.payment_status === 'paid')) && !order.closed_at)
        ) && (
            <div className="flex gap-2">
              {order.payment_status === 'pending' && (
                <Button size="sm" onClick={() => onAction?.('pay', order.id)} className="bg-blue-600 hover:bg-blue-500 text-white flex-1 h-10 font-black uppercase text-[10px] shadow-lg rounded-xl tracking-widest">
                  <Receipt className="w-3.5 h-3.5 mr-2" /> Pay
                </Button>
              )}
              {((order.status === 'paid' || order.payment_status === 'paid') && !order.closed_at) && (
                <Button size="sm" onClick={() => onAction?.('completed', order.id)} disabled={isActing} className="bg-muted hover:bg-muted/80 text-foreground flex-1 h-10 font-black uppercase text-[10px] tracking-widest shadow-lg rounded-xl border border-border">
                  <Flag className="w-3.5 h-3.5 mr-2" /> Clear
                </Button>
              )}
            </div>
          )}
      </div>
    </div>
  );

  if (isWaiter) {
    if (order.status === 'ready') {
      return (
        <BaroLeafyCard color="#A3E635" badge="FRESH & READY" className="h-full">
          <div className="h-full">{cardContent}</div>
        </BaroLeafyCard>
      );
    }
    if (order.status === 'pending' || order.status === 'accepted' || order.status === 'preparing') {
      return (
        <BaroKitchenCard color="#F97316" badge="IN KITCHEN" className="h-full">
          <div className="h-full">{cardContent}</div>
        </BaroKitchenCard>
      );
    }
    if (order.status === 'served' || order.status === 'paid') {
      return (
        <BaroBillingCard color="#3B82F6" badge={order.payment_status === 'paid' ? 'PAID' : 'BILLING'} className="h-full">
          <div className="h-full">{cardContent}</div>
        </BaroBillingCard>
      );
    }
  }

  return cardContent;
};
