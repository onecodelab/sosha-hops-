
import React, { useState, useRef } from 'react';
import { Dialog, Button, Input, showToast, cn } from './ui';
import { supabase } from '../supabase';
import { Order, PaymentMethod } from '../types';
import { useAuth } from '../AuthContext';
import { 
  CheckCircle2, Printer, CreditCard, Banknote, 
  Smartphone, Loader2, X, Receipt, Calculator, 
  ChevronRight, ArrowLeft, Camera, ShieldCheck, AlertCircle, Sparkles
} from 'lucide-react';

interface BillModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSuccess: () => void;
}

// Master Configuration for Verifier
const MASTER_ACCOUNTS = {
  cbe: "1000356042704",
  abyssinia: "1338816408"
};

const VERIFIER_BASE_URL = "https://verify.leul.et/api";

export const BillModal: React.FC<BillModalProps> = ({ 
  isOpen, onClose, order, onSuccess 
}) => {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [view, setView] = useState<'bill' | 'payment' | 'success'>('bill');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [refNumber, setRefNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  // Sync amount paid when moving to payment view
  const handleGoToPayment = () => {
    if (order) {
      setAmountPaid(order.total_amount.toString());
      setView('payment');
    }
  };

  const handleProcessPayment = async (verifiedAmount?: number, verifiedRef?: string) => {
    if (!order || !user) return;
    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      const totalToPay = order.total_amount;
      const actualPaid = verifiedAmount || parseFloat(amountPaid) || totalToPay;
      const tipAmount = Math.max(0, actualPaid - totalToPay);

      // CRITICAL: Update table_sessions and physical table FIRST to release atomic locks
      // This prevents the unique_active_session_per_table error if the waiter immediately
      // tries to open a new order for the same table.
      if (order.table_id) {
        // 1. Flip session to inactive
        const { error: sessionError } = await supabase
          .from('table_sessions')
          .update({ 
            is_active: false, 
            closed_at: now,
            session_revenue: totalToPay 
          })
          .eq('table_id', order.table_id)
          .eq('is_active', true);

        if (sessionError) console.warn("Session close failed:", sessionError);

        // 2. Clear physical table registry
        await supabase
          .from('tables')
          .update({
            status: 'available',
            current_order_id: null,
            current_session_id: null,
            last_updated: now
          })
          .eq('id', order.table_id);
      }

      // 3. Log Tip if applicable
      if (tipAmount > 0) {
        await supabase.from('tips_log').insert({
          order_id: order.id,
          waiter_id: order.waiter_id,
          amount: tipAmount,
          tip_type: paymentMethod === 'cash' ? 'cash' : 'digital'
        });
      }

      // 4. Update Order to 'paid' and 'closed'
      // This triggers the DB function for ingredient deduction (e.g. Test Beef)
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          status: 'paid',
          payment_status: 'paid',
          payment_method: paymentMethod,
          amount_paid: actualPaid,
          tip_amount: tipAmount,
          transaction_reference: verifiedRef || refNumber || null,
          paid_at: now,
          closed_at: now,
          last_updated: now
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      setView('success');
      onSuccess();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleScanReceipt = () => {
    fileInputRef.current?.click();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !order) return;

    setIsVerifying(true);
    const formData = new FormData();
    formData.append('image', file);

    try {
      // API call to the Verifier engine
      const response = await fetch(`${VERIFIER_BASE_URL}/verify-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.API_KEY}`
        },
        body: formData
      });

      const data = await response.json();

      if (data.verified) {
        const destAccount = data.destination_account?.toString();
        const isValidMerchant = 
          destAccount === MASTER_ACCOUNTS.cbe || 
          destAccount === MASTER_ACCOUNTS.abyssinia;

        if (isValidMerchant) {
          showToast("AI Verification Successful: Destination Confirmed.", "success");
          
          // Auto-select method
          const method: PaymentMethod = destAccount === MASTER_ACCOUNTS.cbe ? 'cbe' : 'abyssinia';
          setPaymentMethod(method);
          setRefNumber(data.reference_number || '');
          setAmountPaid(data.amount?.toString() || order.total_amount.toString());
          
          // Finalize instantly if valid
          await handleProcessPayment(data.amount, data.reference_number);
        } else {
          showToast("Verification Failed: Receipt belongs to a different merchant.", "error");
        }
      } else {
        showToast(data.message || "OCR failed to verify the receipt. Check clarity.", "error");
      }
    } catch (err: any) {
      showToast("Verifier API unreachable. Switch to manual confirmation.", "error");
      console.error(err);
    } finally {
      setIsVerifying(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handlePrint = () => {
    showToast("Connecting to Thermal Printer...", "success");
    window.print();
  };

  if (!order) return null;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={view === 'payment' ? "Checkout" : "Order Bill"} maxWidth="max-w-md">
      <div className="min-h-[450px] flex flex-col p-2">
        {view === 'bill' && (
          <div className="flex-1 flex flex-col animate-in fade-in zoom-in-95 duration-300">
            {/* Thermal Style Bill View */}
            <div className="bg-white text-black p-6 rounded-xl shadow-inner font-mono text-sm space-y-4 border-t-8 border-primary">
               <div className="text-center border-b border-dashed border-gray-300 pb-4">
                  <h3 className="font-black text-lg tracking-tighter uppercase">Sosha Hoops</h3>
                  <p className="text-[10px] text-gray-500">Bole, Addis Ababa</p>
                  <p className="text-[10px] text-gray-500 mt-1">{new Date(order.created_at).toLocaleString()}</p>
               </div>
               
               <div className="flex justify-between font-black border-b border-gray-100 pb-2 uppercase tracking-tighter text-xs">
                  <span>Table: T-{order.table_number}</span>
                  <span>#{order.order_number?.slice(-4)}</span>
               </div>

               <div className="space-y-2 py-2">
                  {order.order_items?.map((item: any, i) => (
                    <div key={i} className="flex justify-between">
                       <span className="flex-1">
                          <span className="font-bold mr-2">{item.quantity}x</span>
                          {item.menu_item?.name}
                       </span>
                       <span className="font-bold">{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
               </div>

               <div className="border-t-2 border-dashed border-gray-300 pt-4 space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                     <span>Subtotal</span>
                     <span>ETB {order.total_amount.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-base font-black pt-2">
                     <span>TOTAL</span>
                     <span>ETB {order.total_amount.toLocaleString()}</span>
                  </div>
               </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-8">
               <Button variant="outline" onClick={handlePrint} className="h-12 bg-white/5 border-white/10 rounded-xl font-bold">
                  <Printer className="w-4 h-4 mr-2" /> Print
               </Button>
               <Button onClick={handleGoToPayment} className="h-12 bg-primary text-black font-black uppercase rounded-xl">
                  Pay Now <ChevronRight className="ml-2 w-4 h-4" />
               </Button>
            </div>
            <Button variant="ghost" onClick={onClose} className="mt-2 text-zinc-500 font-bold hover:text-white uppercase text-[10px]">
               Keep Active
            </Button>
          </div>
        )}

        {view === 'payment' && (
          <div className="space-y-6 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between">
               <button onClick={() => setView('bill')} className="flex items-center gap-2 text-zinc-500 hover:text-white text-xs font-bold transition-colors">
                  <ArrowLeft className="w-4 h-4" /> Back
               </button>
               <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1.5 rounded-full border border-primary/20">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[10px] font-black text-primary uppercase">Verifier Active</span>
               </div>
            </div>

            <div className="bg-black/40 p-5 rounded-2xl border border-white/5 text-center">
               <p className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Amount Due</p>
               <h3 className="text-4xl font-black text-primary font-mono mt-1">ETB {order.total_amount.toLocaleString()}</h3>
            </div>

            {/* Premium Camera Action */}
            <div className="space-y-3">
               <input 
                 type="file" 
                 ref={fileInputRef} 
                 onChange={handleFileUpload} 
                 accept="image/*" 
                 capture="environment" 
                 className="hidden" 
               />
               <button 
                 disabled={isVerifying}
                 onClick={handleScanReceipt}
                 className="w-full group relative flex items-center justify-center gap-3 p-4 rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-700 border border-blue-400/30 overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl shadow-blue-900/20"
               >
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  {isVerifying ? (
                    <Loader2 className="w-5 h-5 animate-spin text-white" />
                  ) : (
                    <div className="relative">
                        <Camera className="w-5 h-5 text-white" />
                        <Sparkles className="absolute -top-2 -right-2 w-3 h-3 text-yellow-300 animate-pulse" />
                    </div>
                  )}
                  <span className="font-black text-white uppercase tracking-widest text-xs">
                    {isVerifying ? 'Verifying Transaction...' : 'Scan Digital Receipt'}
                  </span>
               </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
               {(['cash', 'cbe', 'abyssinia', 'telebirr'] as PaymentMethod[]).map((m) => (
                  <button 
                    key={m}
                    onClick={() => setPaymentMethod(m)} 
                    className={cn(
                      "p-3 rounded-xl border flex items-center justify-between transition-all", 
                      paymentMethod === m ? "bg-primary/10 border-primary text-primary" : "bg-white/5 border-white/5 text-zinc-400"
                    )}
                  >
                    <div className="flex items-center gap-3">
                       {m === 'cash' ? <Banknote className="w-5 h-5" /> : m === 'cbe' || m === 'abyssinia' ? <CreditCard className="w-5 h-5" /> : <Smartphone className="w-5 h-5" />}
                       <span className="font-bold uppercase text-[10px] tracking-widest">{m === 'abyssinia' ? 'Abyssinia' : m}</span>
                    </div>
                    {paymentMethod === m && <CheckCircle2 className="w-4 h-4" />}
                  </button>
               ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Collected</label>
                  <Input type="number" value={amountPaid} onChange={e => setAmountPaid(e.target.value)} className="bg-black/60 border-white/10 font-mono font-bold h-12" />
               </div>
               <div className="space-y-2">
                  <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest ml-1">Ref Number</label>
                  <Input placeholder="Manual ID..." value={refNumber} onChange={e => setRefNumber(e.target.value)} className="bg-black/60 border-white/10 font-mono h-12" />
               </div>
            </div>

            <Button onClick={() => handleProcessPayment()} isLoading={isSubmitting} className="w-full h-14 bg-primary text-black font-black uppercase tracking-widest rounded-2xl shadow-xl mt-2">
               Verify & Finalize
            </Button>
          </div>
        )}

        {view === 'success' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-6 space-y-4 animate-in zoom-in duration-300">
             <div className="w-24 h-24 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_40px_rgba(34,197,94,0.4)]">
                <CheckCircle2 className="w-12 h-12 text-white" />
             </div>
             <div className="space-y-2">
                <h3 className="text-2xl font-black text-white uppercase tracking-tighter">Transaction Clear</h3>
                <p className="text-zinc-500 text-sm leading-relaxed">Bill verified. Table released. Stock updated for production.</p>
             </div>
             <Button onClick={onClose} className="w-full bg-white/10 hover:bg-white/20 text-white font-black h-14 rounded-2xl mt-6 uppercase tracking-widest text-xs">
                Back to Station
             </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
};
