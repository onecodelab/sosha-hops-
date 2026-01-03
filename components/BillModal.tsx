
import React, { useState, useRef, useEffect } from 'react';
import { Dialog, Button, Input, showToast, cn } from './ui';
import { supabase } from '../supabase';
import { Order, PaymentMethod } from '../types';
import { useAuth } from '../AuthContext';
import { 
  CheckCircle2, Printer, Smartphone, Loader2, X, 
  ChevronRight, ArrowLeft, ShieldCheck, Landmark,
  Scan, Banknote, FileText, AlertCircle, Coins
} from 'lucide-react';
import QRScanner from './QRScanner';

interface BillModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSuccess: () => void;
}

// In a production app, this key would be fetched from the database or an environment variable.
const SOSHA_API_KEY = "sosha_prod_key_8821";

const BANK_CONFIG: Record<string, { receiver: string, label: string, placeholder: string, color: string, icon: any, endpoint: string }> = {
  telebirr: { 
    receiver: "", 
    label: "Telebirr", 
    placeholder: "10-char ID (e.g. CL...)", 
    color: "text-purple-400 border-purple-500/30 bg-purple-500/5",
    icon: Smartphone,
    endpoint: "verify/telebirr"
  },
  cbe: { 
    receiver: "56042704", 
    label: "CBE", 
    placeholder: "FT Reference...", 
    color: "text-blue-400 border-blue-500/30 bg-blue-500/5",
    icon: Landmark,
    endpoint: "verify/cbe"
  },
  dashen: { 
    receiver: "", 
    label: "Dashen", 
    placeholder: "Ref Number...", 
    color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5",
    icon: Landmark,
    endpoint: "verify/dashen"
  },
  abyssinia: { 
    receiver: "16408", 
    label: "Abyssinia", 
    placeholder: "BoA Reference...", 
    color: "text-zinc-400 border-zinc-500/30 bg-zinc-500/5",
    icon: Landmark,
    endpoint: "verify/abyssinia"
  },
  cbebirr: { 
    receiver: "", 
    label: "CBE Birr", 
    placeholder: "Receipt #", 
    color: "text-orange-400 border-orange-500/30 bg-orange-500/5",
    icon: Coins,
    endpoint: "verify/cbebirr"
  }
};

export const BillModal: React.FC<BillModalProps> = ({ 
  isOpen, onClose, order, onSuccess 
}) => {
  const { user } = useAuth();
  
  const [view, setView] = useState<'bill' | 'payment' | 'success'>('bill');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [refNumber, setRefNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setView('bill');
      setRefNumber('');
      setAmountPaid('');
      setPaymentMethod('cash');
      setIsVerified(false);
    }
  }, [isOpen]);

  const handleGoToPayment = () => {
    if (order) {
      setAmountPaid(order.total_amount.toString());
      setView('payment');
    }
  };

  const handleQRScan = (rawData: string) => {
    setIsQRScannerOpen(false);
    let extractedRef = "";
    let extractedReceiver = "";
    let detectedBank = 'telebirr';

    try {
      const url = new URL(rawData);
      const params = url.searchParams;

      if (rawData.includes('bankofabyssinia.com')) {
        extractedRef = params.get('trx') || "";
        extractedReceiver = params.get('acc') || "";
        detectedBank = 'abyssinia';
      } else if (rawData.includes('cbe.com.et')) {
        extractedRef = params.get('id') || "";
        extractedReceiver = params.get('receiver') || params.get('acc') || "";
        detectedBank = 'cbe';
        
        const cbeSuffix = BANK_CONFIG.cbe.receiver;
        if (extractedRef && extractedRef.includes(cbeSuffix)) {
           extractedRef = extractedRef.split(cbeSuffix)[0];
        }
      } else if (rawData.includes('dashen')) {
        extractedRef = params.get('ref') || params.get('id') || "";
        detectedBank = 'dashen';
      } else {
        const teleMatch = rawData.match(/(?:receipt\/|transaction\/)?([A-Z0-9]{10})/i);
        if (teleMatch) {
          extractedRef = teleMatch[1];
          detectedBank = 'telebirr';
        } else {
          extractedRef = rawData.trim();
        }
      }
    } catch (e) {
      const match = rawData.match(/([A-Z0-9]{10})/i);
      extractedRef = match ? match[1] : rawData.trim();
    }

    extractedRef = extractedRef.replace(/[^a-zA-Z0-9]+$/, "");

    const config = BANK_CONFIG[detectedBank];
    if (config?.receiver && extractedReceiver && !extractedReceiver.endsWith(config.receiver)) {
        showToast(`Receiver Mismatch: Receipt for ...${extractedReceiver.slice(-4)}`, "error");
        return;
    }

    if (extractedRef) {
      setPaymentMethod(detectedBank);
      setRefNumber(extractedRef);
      showToast(`${BANK_CONFIG[detectedBank].label} Code Captured`, "success");
      verifyTransaction(extractedRef, detectedBank);
    } else {
      showToast("Scan unsuccessful. Please enter manually.", "warning");
    }
  };

  const verifyTransaction = async (targetRef?: string, targetBank?: string) => {
    const ref = (targetRef || refNumber).trim();
    const bank = targetBank || paymentMethod;
    if (!ref || bank === 'cash' || !order) return;

    setIsVerifying(true);
    try {
      const config = BANK_CONFIG[bank];
      
      // Prepare Payload based on Bank Type
      let payload: any = { reference: ref, orderId: order.id, branchId: 'main-01', manualOverride: false };
      
      if (bank === 'cbe') {
        payload.accountSuffix = config.receiver;
      } else if (bank === 'abyssinia') {
        payload.suffix = config.receiver;
      } else if (bank === 'cbebirr') {
        payload = { receiptNumber: ref, phoneNumber: '', manualOverride: false };
      }

      // We use manual fetch to target the specific sub-path on the Edge Function
      const { data: { publicUrl } } = supabase.storage.from('dummy').getPublicUrl('');
      const baseUrl = publicUrl.split('/storage')[0];
      const functionUrl = `${baseUrl}/functions/v1/sosha-verifier/${config.endpoint}`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': SOSHA_API_KEY,
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setIsVerified(true);
        if (data.amount) setAmountPaid(data.amount.toString());
        if (data.receiptNo) setRefNumber(data.receiptNo);
        showToast("Bank record confirmed", "success");
      } else {
        throw new Error(data.message || "Transaction not found on bank servers.");
      }
    } catch (err: any) {
      console.error("Verification Fail:", err);
      showToast(err.message || "Verifier Offline", "error");
      setIsVerified(false);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleProcessPayment = async () => {
    if (!order || !user) return;
    setIsSubmitting(true);

    try {
      const now = new Date().toISOString();
      const actualPaid = parseFloat(amountPaid) || order.total_amount;
      const tipAmount = Math.max(0, actualPaid - order.total_amount);

      if (order.table_id) {
        await supabase.from('table_sessions').update({ is_active: false, closed_at: now, session_revenue: order.total_amount }).eq('table_id', order.table_id).eq('is_active', true);
        await supabase.from('tables').update({ status: 'available', current_order_id: null, current_session_id: null, last_updated: now }).eq('id', order.table_id);
      }

      const { error } = await supabase.from('orders').update({
        status: 'paid',
        payment_status: 'paid',
        payment_method: paymentMethod,
        amount_paid: actualPaid,
        tip_amount: tipAmount,
        transaction_reference: refNumber || null,
        paid_at: now,
        closed_at: now,
        last_updated: now
      }).eq('id', order.id);

      if (error) throw error;
      setView('success');
      onSuccess();
    } catch (err: any) {
      showToast(err.message, 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!order) return null;

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title={view === 'payment' ? "Checkout" : "Order Summary"} maxWidth="max-w-md">
      <div className="flex flex-col p-1 min-h-[500px]">
        {view === 'bill' && (
          <div className="animate-in fade-in zoom-in-95 duration-300">
            <div className="bg-white text-black p-6 rounded-2xl shadow-inner font-mono text-xs space-y-4 border-t-8 border-primary mx-1">
               <div className="text-center border-b border-dashed border-gray-300 pb-4">
                  <h3 className="font-black text-lg tracking-tighter uppercase leading-none">Sosha OS</h3>
                  <p className="text-[9px] text-gray-400 mt-1">Production Receipt</p>
               </div>
               <div className="flex justify-between font-black border-b border-gray-100 pb-2">
                  <span>Table: T-{order.table_number}</span>
                  <span>#{order.order_number?.slice(-4)}</span>
               </div>
               <div className="space-y-1 py-2 max-h-40 overflow-y-auto custom-scrollbar">
                  {order.order_items?.map((item: any, i) => (
                    <div key={i} className="flex justify-between">
                       <span className="flex-1 truncate mr-2"><span className="font-bold">{item.quantity}x</span> {item.menu_item?.name}</span>
                       <span className="font-bold">{(item.price * item.quantity).toLocaleString()}</span>
                    </div>
                  ))}
               </div>
               <div className="border-t-2 border-dashed border-gray-300 pt-4">
                  <div className="flex justify-between text-base font-black">
                     <span>TOTAL</span>
                     <span>ETB {order.total_amount.toLocaleString()}</span>
                  </div>
               </div>
            </div>
            <div className="grid grid-cols-2 gap-3 mt-6">
               <Button variant="outline" onClick={() => window.print()} className="h-12 bg-white/5 border-white/10 rounded-xl font-bold">
                  <Printer className="w-4 h-4 mr-2" /> Print
               </Button>
               <Button onClick={handleGoToPayment} className="h-12 bg-primary text-black font-black uppercase rounded-xl">
                  Next <ChevronRight className="ml-2 w-4 h-4" />
               </Button>
            </div>
          </div>
        )}

        {view === 'payment' && (
          <div className="space-y-5 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between px-1">
               <button onClick={() => setView('bill')} className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">
                  <ArrowLeft className="w-3.5 h-3.5" /> Back
               </button>
               <div className="flex items-center gap-1.5 bg-primary/10 px-3 py-1 rounded-full border border-primary/20">
                  <ShieldCheck className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[9px] font-black text-primary uppercase">Secure Edge</span>
               </div>
            </div>

            <div className="bg-[#0A0A0A] p-5 rounded-2xl border border-white/5 text-center relative overflow-hidden">
               <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Amount to Collect</p>
               <h3 className="text-3xl font-black text-white font-mono mt-1 tracking-tighter">
                  ETB {order.total_amount.toLocaleString()}
               </h3>
            </div>

            <div className="grid grid-cols-2 gap-2">
               <button onClick={() => { setPaymentMethod('cash'); setIsVerified(false); setRefNumber(''); }} className={cn("p-2.5 rounded-xl border flex items-center gap-2 transition-all", paymentMethod === 'cash' ? "bg-primary/10 border-primary text-primary" : "bg-black/40 border-white/5 text-zinc-500")}>
                  <Banknote className="w-3.5 h-3.5" />
                  <span className="font-black uppercase text-[9px]">Cash</span>
               </button>
               {Object.entries(BANK_CONFIG).map(([key, config]) => (
                  <button key={key} onClick={() => { setPaymentMethod(key); setRefNumber(''); setIsVerified(false); }} className={cn("p-2.5 rounded-xl border flex items-center gap-2 transition-all", paymentMethod === key ? `${config.color}` : "bg-black/40 border-white/5 text-zinc-500")}>
                    <config.icon className="w-3.5 h-3.5" />
                    <span className="font-black uppercase text-[9px]">{config.label}</span>
                  </button>
               ))}
            </div>

            <div className="space-y-3 bg-[#0A0A0A] p-4 rounded-2xl border border-white/5 relative">
               <div className="space-y-1.5">
                  <div className="flex justify-between items-center ml-1">
                    <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest">Transaction ID</label>
                    {paymentMethod !== 'cash' && (
                       <button onClick={() => setIsQRScannerOpen(true)} className="text-[9px] font-black text-primary uppercase flex items-center gap-1 hover:opacity-80">
                          <Scan className="w-3 h-3" /> Scan Receipt
                       </button>
                    )}
                  </div>
                  <div className="relative">
                    <Input 
                        placeholder={(BANK_CONFIG as any)[paymentMethod]?.placeholder || "Manual ID..."} 
                        value={refNumber} 
                        onChange={e => { setRefNumber(e.target.value); setIsVerified(false); }} 
                        className={cn(
                            "bg-black/40 border-white/10 font-mono text-white h-10 text-xs rounded-lg transition-all",
                            isVerified && "border-green-500/50 text-green-400 bg-green-500/5"
                        )}
                        disabled={paymentMethod === 'cash'}
                    />
                    {isVerified && <CheckCircle2 className="absolute right-3 top-2.5 w-4 h-4 text-green-500" />}
                  </div>
               </div>

               {(BANK_CONFIG as any)[paymentMethod]?.receiver && (
                  <div className={cn("p-2 rounded-lg flex items-center justify-between border transition-all", isVerified ? "bg-green-500/5 border-green-500/20" : "bg-primary/5 border-primary/20")}>
                     <div className="flex items-center gap-2">
                        <ShieldCheck className={cn("w-3.5 h-3.5", isVerified ? "text-green-500" : "text-primary")} />
                        <span className="text-[8px] text-zinc-400 font-black uppercase">To Account:</span>
                     </div>
                     <span className="text-[10px] text-primary font-mono font-black tracking-widest">
                        ...{(BANK_CONFIG as any)[paymentMethod].receiver}
                     </span>
                  </div>
               )}

               <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ml-1">Collection (ETB)</label>
                  <Input 
                    type="number" 
                    value={amountPaid} 
                    onChange={e => { setAmountPaid(e.target.value); setIsVerified(false); }} 
                    className={cn(
                      "bg-black/40 border-white/10 font-mono font-black h-11 text-lg rounded-lg transition-colors",
                      isVerified ? "text-green-400" : "text-primary"
                    )}
                  />
               </div>
            </div>

            <Button 
              onClick={isVerified || paymentMethod === 'cash' ? handleProcessPayment : () => verifyTransaction()} 
              isLoading={isSubmitting || isVerifying} 
              className={cn(
                  "w-full h-14 font-black uppercase tracking-[0.2em] rounded-2xl shadow-xl transition-all",
                  isVerified ? "bg-green-600 text-white shadow-green-500/20" : "bg-primary text-black"
              )}
            >
               {isVerifying ? (
                 <span className="flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Verifying...</span>
               ) : (
                 paymentMethod === 'cash' ? 'Finalize Order' : (isVerified ? 'Confirm & Close' : 'Verify & Link')
               )}
            </Button>
          </div>
        )}

        {view === 'success' && (
          <div className="flex-1 flex flex-col items-center justify-center text-center py-8 space-y-6 animate-in zoom-in duration-300">
             <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(34,197,94,0.4)]">
                <CheckCircle2 className="w-10 h-10 text-white" />
             </div>
             <div>
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Paid & Cleared</h3>
                <p className="text-zinc-500 text-xs mt-1">Transaction verified. Table is now free.</p>
             </div>
             <Button onClick={onClose} className="w-full bg-white/10 hover:bg-white/20 text-white font-black h-12 rounded-xl text-[10px] uppercase tracking-widest">
                Return to Station
             </Button>
          </div>
        )}
      </div>

      {isQRScannerOpen && (
        <QRScanner onScan={handleQRScan} onClose={() => setIsQRScannerOpen(false)} />
      )}
    </Dialog>
  );
};
