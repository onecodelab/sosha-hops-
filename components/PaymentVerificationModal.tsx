
import React, { useState, useEffect } from 'react';
import { Dialog, Button, Input, Badge, showToast, cn, Card } from './ui';
import { supabase } from '../supabase';
import { Order, PaymentMethod } from '../types';
import { useAuth } from '../AuthContext';
import {
  CheckCircle2, CreditCard, Banknote, Smartphone,
  Loader2, ChevronRight, X, Receipt, Upload, ArrowLeft, Copy, Bot
} from 'lucide-react';

interface PaymentVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: Order[];
  onPaymentSuccess: () => void;
}

type PaymentStage = 'select-order' | 'select-method' | 'process-cash' | 'process-chapa' | 'process-bank' | 'success';

export const PaymentVerificationModal: React.FC<PaymentVerificationModalProps> = ({ 
  isOpen, onClose, orders, onPaymentSuccess 
}) => {
  const { user, profile } = useAuth();
  const [stage, setStage] = useState<PaymentStage>('select-order');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [bankTab, setBankTab] = useState<'cbe' | 'abyssinia'>('cbe');
  
  const [refNumber, setRefNumber] = useState('');
  const [accountDigits, setAccountDigits] = useState('');

  useEffect(() => {
    if (isOpen) {
      setStage('select-order');
      setSelectedOrder(null);
      setRefNumber('');
      setAccountDigits('');
    }
  }, [isOpen]);

  const handleOrderSelect = async (order: Order) => {
    if (!order.waiter_id) {
        setIsLoading(true);
        try {
            const { data, error } = await supabase
                .from('orders')
                .update({ 
                  waiter_id: user?.id,
                  order_handler_name: profile?.full_name || profile?.email || 'Staff'
                })
                .eq('id', order.id)
                .is('waiter_id', null)
                .select()
                .single();

            if (error || !data) {
                showToast("Order was already claimed by another waiter.", 'error');
                setIsLoading(false);
                return;
            }
            order.waiter_id = user?.id as string; 
            showToast("Order claimed successfully!");
        } catch (err: any) {
            showToast("Failed to claim order.", 'error');
            setIsLoading(false);
            return;
        }
        setIsLoading(false);
    }
    setSelectedOrder(order);
    setStage('select-method');
  };

  const processPayment = async (method: PaymentMethod, details: any = {}) => {
    if (!selectedOrder) return;
    setIsLoading(true);

    try {
      await new Promise(resolve => setTimeout(resolve, 1500));

      if (method === 'cbe' || method === 'abyssinia') {
        if (refNumber.length < 4 || accountDigits.length < 4) {
          throw new Error("Invalid reference or account number.");
        }
      }

      const { error } = await supabase
        .from('orders')
        .update({
          status: 'paid',
          payment_status: 'paid',
          payment_method: method,
          payment_handler_name: profile?.full_name || profile?.email || 'Staff',
          paid_at: new Date().toISOString()
        })
        .eq('id', selectedOrder.id);

      if (error) throw error;

      setStage('success');
      onPaymentSuccess();
      showToast('Payment verified successfully!', 'success');
      
    } catch (err: any) {
      showToast(err.message || 'Payment verification failed', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const renderOrderList = () => (
    <div className="space-y-3 relative">
      {isLoading && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10 rounded-xl">
             <div className="flex flex-col items-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-2" />
                <span className="text-white text-sm font-bold">Processing...</span>
             </div>
        </div>
      )}
      
      {orders.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
          <p>All served orders are paid.</p>
        </div>
      ) : (
        orders.map(order => (
          <div key={order.id} className={cn("p-4 border rounded-xl transition-all flex justify-between items-center group", !order.waiter_id ? "bg-purple-900/10 border-purple-500/30 hover:bg-purple-900/20" : "bg-black/20 border-gray-800 hover:bg-white/5")}>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Badge variant="outline" className="text-white bg-gray-800 border-gray-700">Table {order.table_number}</Badge>
                {!order.waiter_id && (
                    <Badge variant="secondary" className="bg-purple-500 text-white border-purple-400 text-[10px] animate-pulse">
                        <Bot className="w-3 h-3 mr-1" /> Unclaimed
                    </Badge>
                )}
                <span className="text-xs text-gray-500 font-mono">#{order.order_number || order.id.slice(0,6)}</span>
              </div>
              <div className="text-xs text-gray-400">
                 {order.order_items?.length || 0} items • Served {order.served_at ? new Date(order.served_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : 'N/A'}
              </div>
            </div>
            <div className="text-right flex items-center gap-4">
              <span className="text-lg font-bold text-primary font-mono">ETB {order.total_amount.toLocaleString()}</span>
              <Button size="sm" onClick={() => handleOrderSelect(order)} className={cn(!order.waiter_id && "bg-purple-600 hover:bg-purple-700")}>
                {!order.waiter_id ? "Claim & Pay" : "Select"} <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  const renderMethodSelect = () => (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4 text-sm text-gray-400">
         <button onClick={() => setStage('select-order')} className="hover:text-white flex items-center"><ArrowLeft className="w-4 h-4 mr-1"/> Back</button>
         <span>/ Order #{selectedOrder?.order_number || selectedOrder?.id.slice(0,6)}</span>
      </div>
      
      <div className="grid grid-cols-1 gap-3">
        <button 
          onClick={() => setStage('process-cash')}
          className="p-4 bg-[#1A1A1A] border border-gray-800 rounded-xl hover:border-green-500/50 hover:bg-green-500/5 transition-all text-left flex items-center gap-4 group"
        >
          <div className="p-3 bg-green-500/10 rounded-full text-green-500 group-hover:bg-green-500 group-hover:text-black transition-colors">
            <Banknote className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-white">Cash Payment</h3>
            <p className="text-xs text-gray-500">Immediate verification</p>
          </div>
          <ChevronRight className="w-5 h-5 ml-auto text-gray-600" />
        </button>

        <button 
          onClick={() => setStage('process-chapa')}
          className="p-4 bg-[#1A1A1A] border border-gray-800 rounded-xl hover:border-blue-500/50 hover:bg-blue-500/5 transition-all text-left flex items-center gap-4 group"
        >
          <div className="p-3 bg-blue-500/10 rounded-full text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-colors">
            <Smartphone className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-white">Telebirr / Chapa</h3>
            <p className="text-xs text-gray-500">Scan QR Code</p>
          </div>
          <ChevronRight className="w-5 h-5 ml-auto text-gray-600" />
        </button>

        <button 
          onClick={() => setStage('process-bank')}
          className="p-4 bg-[#1A1A1A] border border-gray-800 rounded-xl hover:border-purple-500/50 hover:bg-purple-500/5 transition-all text-left flex items-center gap-4 group"
        >
          <div className="p-3 bg-purple-500/10 rounded-full text-purple-500 group-hover:bg-purple-500 group-hover:text-white transition-colors">
            <CreditCard className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-white">Bank Transfer</h3>
            <p className="text-xs text-gray-500">CBE or Abyssinia</p>
          </div>
          <ChevronRight className="w-5 h-5 ml-auto text-gray-600" />
        </button>
      </div>
    </div>
  );

  const renderCashConfirm = () => (
    <div className="text-center py-6 space-y-6">
       <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Banknote className="w-10 h-10 text-green-500" />
       </div>
       <div>
         <h3 className="text-xl font-bold text-white">Confirm Cash Payment</h3>
         <p className="text-gray-400 mt-2">
            Mark Order <span className="text-white font-mono">#{selectedOrder?.order_number || selectedOrder?.id.slice(0,6)}</span> (Table {selectedOrder?.table_number}) as paid?
         </p>
         <div className="text-3xl font-bold text-primary mt-4 font-mono">
            ETB {selectedOrder?.total_amount.toLocaleString()}
         </div>
       </div>
       <div className="flex gap-3 justify-center pt-4">
         <Button variant="outline" onClick={() => setStage('select-method')} disabled={isLoading}>Cancel</Button>
         <Button 
            className="bg-green-600 hover:bg-green-700 w-40" 
            onClick={() => processPayment('cash')}
            isLoading={isLoading}
         >
            Confirm Paid
         </Button>
       </div>
    </div>
  );

  const renderChapaProcess = () => (
    <div className="text-center py-4 space-y-6">
       <div className="bg-white p-4 rounded-xl w-48 h-48 mx-auto relative overflow-hidden">
          <div className="absolute inset-0 bg-[url('https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=SoshaPayment')] bg-contain bg-center bg-no-repeat" />
          <div className="absolute inset-0 flex items-center justify-center bg-white/90" style={{display: isLoading ? 'flex' : 'none'}}>
             <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
       </div>
       <div>
         <h3 className="text-lg font-bold text-white">Scan to Pay</h3>
         <p className="text-xs text-gray-400 mt-1">Ask customer to scan with Telebirr or CBE Birr</p>
         <div className="text-2xl font-bold text-primary mt-2 font-mono">
            ETB {selectedOrder?.total_amount.toLocaleString()}
         </div>
       </div>
       
       <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20 text-xs text-blue-300 flex items-center justify-center gap-2 animate-pulse">
          <Loader2 className="w-3 h-3 animate-spin" /> Waiting for confirmation...
       </div>

       <Button variant="ghost" size="sm" onClick={() => setStage('select-method')} className="text-gray-500">Cancel</Button>
       
       <div className="pt-4 border-t border-gray-800">
         <button onClick={() => processPayment('chapa')} className="text-xs text-gray-600 hover:text-white underline">
            Simulate Webhook Success
         </button>
       </div>
    </div>
  );

  const renderBankForm = () => (
    <div className="space-y-6">
       <div className="flex gap-2 p-1 bg-black/40 rounded-lg border border-gray-800">
          <button 
             className={cn("flex-1 py-2 text-sm font-bold rounded-md transition-all", bankTab === 'cbe' ? "bg-[#8A2BE2] text-white shadow-lg" : "text-gray-500 hover:text-white")}
             onClick={() => setBankTab('cbe')}
          >
             CBE
          </button>
          <button 
             className={cn("flex-1 py-2 text-sm font-bold rounded-md transition-all", bankTab === 'abyssinia' ? "bg-[#FCD34D] text-black shadow-lg" : "text-gray-500 hover:text-white")}
             onClick={() => setBankTab('abyssinia')}
          >
             Abyssinia
          </button>
       </div>

       <div className="space-y-4">
          <div className="p-3 bg-black/20 rounded-lg border border-gray-800 flex justify-between items-center">
             <span className="text-sm text-gray-400">Amount Due</span>
             <span className="text-xl font-bold text-white font-mono">ETB {selectedOrder?.total_amount.toLocaleString()}</span>
          </div>

          <div className="space-y-2">
             <label className="text-xs font-bold text-gray-500 uppercase">Transaction Reference</label>
             <div className="flex gap-2">
                <Input 
                   value={refNumber}
                   onChange={(e) => setRefNumber(e.target.value)}
                   placeholder="e.g. FT2305..."
                   className="font-mono uppercase"
                />
                <Button variant="secondary" className="px-3"><Upload className="w-4 h-4" /></Button>
             </div>
          </div>

          <div className="space-y-2">
             <label className="text-xs font-bold text-gray-500 uppercase">Sender Account (Last 4-8 Digits)</label>
             <Input 
                value={accountDigits}
                onChange={(e) => setAccountDigits(e.target.value)}
                placeholder="e.g. 8832"
                type="number"
                className="font-mono"
             />
          </div>
       </div>

       <div className="flex gap-3 pt-4">
          <Button variant="outline" className="flex-1" onClick={() => setStage('select-method')}>Back</Button>
          <Button 
             className={cn("flex-1 font-bold", bankTab === 'cbe' ? "bg-[#8A2BE2] hover:bg-[#7a25c9]" : "bg-[#FCD34D] text-black hover:bg-[#e6bf43]")}
             onClick={() => processPayment(bankTab)}
             isLoading={isLoading}
             disabled={!refNumber || !accountDigits}
          >
             Verify Transfer
          </Button>
       </div>
    </div>
  );

  const renderSuccess = () => (
    <div className="text-center py-8 animate-in zoom-in duration-300">
       <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(34,197,94,0.4)]">
          <CheckCircle2 className="w-12 h-12 text-white" />
       </div>
       <h3 className="text-2xl font-bold text-white mb-2">Payment Verified!</h3>
       <p className="text-gray-400 mb-6">Digital receipt has been generated.</p>
       
       <div className="max-w-xs mx-auto bg-white text-black p-4 rounded-lg shadow-lg mb-6 relative font-mono text-sm leading-relaxed">
          <div className="text-center border-b border-dashed border-gray-300 pb-2 mb-2">
             <div className="font-bold uppercase">Sosha OS Receipt</div>
             <div className="text-xs text-gray-500">{new Date().toLocaleString()}</div>
          </div>
          <div className="flex justify-between font-bold text-lg mb-2">
             <span>TOTAL</span>
             <span>{selectedOrder?.total_amount.toLocaleString()}</span>
          </div>
          <div className="text-xs text-gray-500 text-center uppercase">Paid via {selectedOrder?.payment_method || 'Cash'}</div>
          <div className="absolute -bottom-2 left-0 right-0 h-2 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyMCAxMCIgcHJlc2VydmVBc3BlY3RSYXRpbz0ibm9uZSI+PHBhdGggZD0iTTAgMTBMMTAgMEwyMCAxMEgwWiIgZmlsbD0id2hpdGUiLz48L3N2Zz4=')] bg-repeat-x bg-[length:10px_10px]" />
       </div>

       <div className="flex gap-3 justify-center">
          <Button variant="secondary" onClick={onClose}>Done</Button>
          <Button onClick={() => setStage('select-order')}>Verify Another</Button>
       </div>
    </div>
  );

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Payment Verification">
      <div className="min-h-[400px]">
        {stage === 'select-order' && renderOrderList()}
        {stage === 'select-method' && renderMethodSelect()}
        {stage === 'process-cash' && renderCashConfirm()}
        {stage === 'process-chapa' && renderChapaProcess()}
        {stage === 'process-bank' && renderBankForm()}
        {stage === 'success' && renderSuccess()}
      </div>
    </Dialog>
  );
};

export const FloatingPaymentButton: React.FC<{ count: number, onClick: () => void }> = ({ count, onClick }) => {
  if (count === 0) return null;
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 right-6 z-50 flex items-center gap-3 pl-4 pr-2 py-3 bg-primary hover:bg-primary-hover text-black font-bold rounded-full shadow-[0_4px_20px_rgba(255,184,0,0.4)] transition-all hover:scale-105 group"
    >
      <span className="text-sm mr-1 hidden group-hover:inline-block transition-all">Verify Payments</span>
      <Receipt className="w-5 h-5" />
      <span className="flex items-center justify-center w-6 h-6 bg-black text-white text-xs rounded-full animate-pulse">
        {count}
      </span>
    </button>
  );
};
