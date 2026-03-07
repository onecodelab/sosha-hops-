
import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Dialog, Button, Input, showToast, cn } from './ui';
import { supabase } from '../supabase';
import { Order, PaymentMethod } from '../types';
import { useAuth } from '../AuthContext';
import { CheckCircle2, CreditCard, Banknote, Smartphone, Loader2, ArrowLeft, ChevronRight, Calculator } from 'lucide-react';
import { AnimatedTicket } from './AnimatedTicket';

interface PaymentVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onPaymentSuccess: () => void;
}

import { orderService } from '../services/orderService';

export const PaymentVerificationModal: React.FC<PaymentVerificationModalProps> = ({
  isOpen, onClose, orders, onPaymentSuccess
}) => {
  const { user, profile } = useAuth();
  const [stage, setStage] = useState<'method' | 'processing' | 'success'>('method');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [refNumber, setRefNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: bankSettings = [] } = useQuery({
    queryKey: ['bank_settings', profile?.organization_id],
    queryFn: async () => {
      if (!profile?.organization_id) return [];
      const { data, error } = await supabase
        .from('bank_settings')
        .select('*')
        .eq('organization_id', profile.organization_id);
      if (error) throw error;
      return data;
    },
    enabled: !!profile?.organization_id,
    staleTime: 1000 * 60 * 5
  });

  const getDynamicReceiver = (bank: string) => {
    const setting = bankSettings.find((s: any) => s.bank_key === bank);
    return setting?.account_number || "";
  };

  useEffect(() => {
    if (isOpen && orders.length > 0) {
      setStage('method');
      setSelectedOrder(orders[0]); // Default to first order if not passed
      setAmountPaid(orders[0]?.total_amount.toString() || '');
      setRefNumber('');
    }
  }, [isOpen, orders]);

  const handleProcessPayment = async () => {
    if (!selectedOrder || !user) return;
    setIsSubmitting(true);

    try {
      const actualPaid = parseFloat(amountPaid) || selectedOrder.total_amount;
      const tipAmount = Math.max(0, actualPaid - selectedOrder.total_amount);

      await orderService.closeOrder(selectedOrder, {
        method: paymentMethod as string,
        amountPaid: actualPaid,
        tipAmount: tipAmount,
        reference: refNumber
      });

      setStage('success');
      onPaymentSuccess();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Process Checkout">
      <div className="min-h-[400px] flex flex-col">
        {stage === 'method' && (
          <div className="space-y-6">
            <div className="bg-black/40 p-5 rounded-2xl border border-white/5">
              <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Ticket Total</p>
              <h3 className="text-3xl font-black text-primary font-mono mt-1">ETB {selectedOrder?.total_amount.toLocaleString()}</h3>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Payment Method</label>
              <div className="grid grid-cols-1 gap-2">
                <button onClick={() => setPaymentMethod('cash')} className={cn("p-4 rounded-xl border flex items-center justify-between transition-all", paymentMethod === 'cash' ? "bg-primary/10 border-primary text-primary" : "bg-white/5 border-white/5 text-zinc-400")}>
                  <div className="flex items-center gap-3"><Banknote className="w-5 h-5" /> <span className="font-bold">Physical Cash</span></div>
                  {paymentMethod === 'cash' && <CheckCircle2 className="w-4 h-4" />}
                </button>
                <button onClick={() => setPaymentMethod('cbe')} className={cn("p-4 rounded-xl border flex items-center justify-between transition-all", paymentMethod === 'cbe' ? "bg-blue-500/10 border-blue-500 text-blue-400" : "bg-white/5 border-white/5 text-zinc-400")}>
                  <div className="flex items-center gap-3"><CreditCard className="w-5 h-5" /> <span className="font-bold">Bank Transfer (CBE)</span></div>
                  {paymentMethod === 'cbe' && <CheckCircle2 className="w-4 h-4" />}
                </button>
                <button onClick={() => setPaymentMethod('telebirr')} className={cn("p-4 rounded-xl border flex items-center justify-between transition-all", paymentMethod === 'telebirr' ? "bg-purple-500/10 border-purple-500 text-purple-400" : "bg-white/5 border-white/5 text-zinc-400")}>
                  <div className="flex items-center gap-3"><Smartphone className="w-5 h-5" /> <span className="font-bold">Telebirr</span></div>
                  {paymentMethod === 'telebirr' && <CheckCircle2 className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Amount Collected</label>
                <Input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} className="bg-black/60 border-white/10 font-mono font-bold" />
              </div>
              {paymentMethod !== 'cash' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Ref Number</label>
                  <Input placeholder="TXN ID..." value={refNumber} onChange={e => setRefNumber(e.target.value)} className="bg-black/60 border-white/10 font-mono" />
                </div>
              )}
            </div>

            {paymentMethod === 'cbe' && (
              <div className="p-3 bg-blue-500/5 border border-blue-500/10 rounded-xl text-center">
                <p className="text-[9px] text-blue-400 font-black uppercase">CBE Account: {getDynamicReceiver('cbe')}</p>
              </div>
            )}

            <Button onClick={handleProcessPayment} isLoading={isSubmitting} className="w-full h-14 bg-primary text-black font-black uppercase tracking-widest rounded-2xl shadow-xl mt-4">
              Confirm & Verify Payment
            </Button>
          </div>
        )}

        {stage === 'success' && selectedOrder && (
          <div className="flex-1 flex flex-col items-center justify-center pt-2 space-y-8 animate-in fade-in duration-500">
            <AnimatedTicket
              ticketId={selectedOrder.order_number || selectedOrder.id.slice(0, 8)}
              amount={parseFloat(amountPaid) || selectedOrder.total_amount}
              date={new Date()}
              staffName={user?.user_metadata?.full_name || 'Staff'}
              paymentMethod={paymentMethod}
              reference={refNumber}
              barcodeValue={selectedOrder.id.slice(0, 8).toUpperCase()}
            />

            <Button onClick={onClose} className="w-full bg-white/5 hover:bg-white/10 text-white font-black h-14 rounded-2xl text-[10px] uppercase tracking-[0.2em] border border-white/5 transition-all">
              Return to Station
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
};

export const FloatingPaymentButton: React.FC<{ count: number, onClick: () => void }> = ({ count, onClick }) => {
  if (count === 0) return null;
  return (
    <button onClick={onClick} className="fixed bottom-6 right-6 z-50 flex items-center gap-3 pl-5 pr-2 py-3 bg-primary hover:bg-yellow-400 text-black font-black rounded-full shadow-2xl transition-all hover:scale-105 active:scale-95 border border-black/10">
      <span className="text-[11px] uppercase tracking-widest">Process Bills</span>
      <div className="flex items-center justify-center w-9 h-9 bg-black text-white text-[10px] font-black rounded-full shadow-lg border border-white/20">{count}</div>
    </button>
  );
};
