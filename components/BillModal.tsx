import React, { useState, useRef, useEffect } from 'react';
import { Dialog, Button, Input, showToast, cn } from './ui';
import { supabase } from '../supabase';
import { Order, PaymentMethod } from '../types';
import { useAuth } from '../AuthContext';
import {
  CheckCircle2, Printer, Smartphone, Loader2, X,
  ChevronRight, ArrowLeft, ShieldCheck, Landmark,
  Scan, Banknote, FileText, AlertCircle, Coins, QrCode
} from 'lucide-react';
import QRScanner from './QRScanner';
import { AnimatedTicket } from './AnimatedTicket';

interface BillModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSuccess: () => void;
}

// Security Best Practice: Use environment variables
// Fix: Property 'env' does not exist on type 'ImportMeta'. Using process.env to align with provided environment guidelines.
const BARO_API_KEY = (process.env as any).VITE_BARO_API_KEY || "baro_prod_key_8821";

const BANK_CONFIG: Record<string, { receiver: string, label: string, placeholder: string, color: string, icon: any, endpoint: string }> = {
  telebirr: {
    receiver: "",
    label: "Telebirr",
    placeholder: "10-char ID (e.g. CL...)",
    color: "text-purple-400 border-purple-500/30 bg-purple-500/5",
    icon: Smartphone,
    endpoint: "telebirr"
  },
  cbe: {
    receiver: "02293007",
    label: "CBE",
    placeholder: "FT Reference...",
    color: "text-blue-400 border-blue-500/30 bg-blue-500/5",
    icon: Landmark,
    endpoint: "cbe"
  },
  dashen: {
    receiver: "",
    label: "Dashen",
    placeholder: "Ref Number...",
    color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5",
    icon: Landmark,
    endpoint: "dashen"
  },
  abyssinia: {
    receiver: "16408",
    label: "Abyssinia",
    placeholder: "BoA Reference...",
    color: "text-zinc-400 border-zinc-500/30 bg-zinc-500/5",
    icon: Landmark,
    endpoint: "abyssinia"
  },
  cbebirr: {
    receiver: "",
    label: "CBE Birr",
    placeholder: "Receipt #",
    color: "text-orange-400 border-orange-500/30 bg-orange-500/5",
    icon: Coins,
    endpoint: "cbebirr"
  }
};

import { orderService } from '../services/orderService';

export const BillModal: React.FC<BillModalProps> = ({
  isOpen, onClose, order, onSuccess
}) => {
  const { user } = useAuth();

  const [view, setView] = useState<'bill' | 'payment' | 'success' | 'split'>('bill');
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
      if (rawData.startsWith('http')) {
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
        } else if (rawData.includes('dashen')) {
          extractedRef = params.get('ref') || params.get('id') || "";
          detectedBank = 'dashen';
        }
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
      extractedRef = rawData.trim();
    }

    extractedRef = extractedRef.replace(/[^a-zA-Z0-9]+$/, "");

    // Refinement: Strip receiver account suffix if detected (e.g. CBE/Abyssinia)
    const receiverNum = BANK_CONFIG[detectedBank]?.receiver;
    if (receiverNum && extractedRef.endsWith(receiverNum)) {
      extractedRef = extractedRef.slice(0, -receiverNum.length);
    }

    if (extractedRef) {
      setPaymentMethod(detectedBank);
      setRefNumber(extractedRef);
      showToast(`${BANK_CONFIG[detectedBank].label} Code Captured`, "success");
      verifyTransaction(extractedRef, detectedBank);
    }
  };

  const verifyTransaction = async (targetRef?: string, targetBank?: string) => {
    const ref = (targetRef || refNumber).trim();
    const bank = targetBank || paymentMethod;
    if (!ref || bank === 'cash' || !order) return;

    setIsVerifying(true);
    try {
      const config = BANK_CONFIG[bank];

      // Build payload for consolidated /verify-payment endpoint
      const payload: any = {
        payment_method: bank,
        reference: ref,
        expected_amount: order.total_amount,  // For secondary validation
        orderId: order.id,
        branchId: 'main-01'
      };

      // Add bank-specific parameters
      if (bank === 'cbe') {
        payload.accountSuffix = config.receiver;
      } else if (bank === 'abyssinia') {
        payload.suffix = config.receiver;
      } else if (bank === 'cbebirr') {
        payload.receiptNumber = ref;
        payload.phoneNumber = ''; // Can be extended if you add phone input
      }

      // Use consolidated verify-payment endpoint with secondary validation
      const VERIFIER_BASE_URL = (import.meta as any).env?.VITE_VERIFIER_URL || "http://srv1320791.hstgr.cloud:3002";
      const functionUrl = `${VERIFIER_BASE_URL}/verify-payment`;

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': 'test-key-123'
        },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      // Check both success (scrape worked) AND validated (secondary checks passed)
      if (response.ok && data.success && data.validated) {
        setIsVerified(true);
        const finalAmount = data.amount ? parseFloat(data.amount.toString()) : order.total_amount;
        const finalReceiptNo = data.receipt_reference || ref;

        if (data.amount) setAmountPaid(data.amount.toString());
        if (data.receipt_reference) setRefNumber(data.receipt_reference);

        showToast("Payment verified ✓", "success");

        // Auto-Trigger Logic: Process payment immediately without manual confirmation
        showToast("Processing automated checkout...", "warning");

        const tipAmount = Math.max(0, finalAmount - order.total_amount);

        await orderService.closeOrder(order, {
          method: bank,
          amountPaid: finalAmount,
          tipAmount: tipAmount,
          reference: finalReceiptNo
        });

        setView('success');
        onSuccess();
      } else {
        // Handle validation failure - display most critical reason
        let errorMessage = "Verification failed";

        if (data.validation?.failed_reasons?.length > 0) {
          // Show only the first (usually most important) mismatch to keep UI clean
          errorMessage = data.validation.failed_reasons[0];
        } else if (data.error) {
          errorMessage = data.error;
        } else if (data.message) {
          errorMessage = data.message;
        }

        throw new Error(errorMessage);
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
      const actualPaid = parseFloat(amountPaid) || order.total_amount;
      const tipAmount = Math.max(0, actualPaid - order.total_amount);

      await orderService.closeOrder(order, {
        method: paymentMethod,
        amountPaid: actualPaid,
        tipAmount: tipAmount,
        reference: refNumber
      });

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
            <div className="bg-white text-black p-6 rounded-2xl shadow-inner font-mono text-xs space-y-4 border-t-8 border-primary mx-1 relative overflow-hidden">
              <div className="text-center border-b border-dashed border-gray-300 pb-4">
                <h3 className="font-black text-lg tracking-tighter uppercase leading-none">Baro OS</h3>
                <p className="text-[9px] text-gray-400 mt-1">TIN: 0043819230</p>
                <p className="text-[9px] text-gray-400">Production Receipt</p>
              </div>

              <div className="flex justify-between font-black border-b border-gray-100 pb-2">
                <span>Table: T-{order.table_number}</span>
                <span>#{order.order_number?.slice(-4)}</span>
              </div>

              <div className="flex justify-between text-[9px] text-gray-500 mb-2">
                <span>Waiter: {order.waiter?.full_name || user?.user_metadata?.full_name || 'Staff'}</span>
                <span>{new Date().toLocaleTimeString()}</span>
              </div>

              <div className="space-y-1 py-2 max-h-40 overflow-y-auto custom-scrollbar border-b border-gray-100">
                {order.order_items?.map((item: any, i) => (
                  <div key={i} className="flex justify-between">
                    <span className="flex-1 truncate mr-2"><span className="font-bold">{item.quantity}x</span> {item.menu_item?.name}</span>
                    <span className="font-bold">{(item.price * item.quantity).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 pt-2">
                <div className="flex justify-between text-[10px] text-gray-600">
                  <span>Subtotal (Excl. VAT)</span>
                  <span>ETB {(order.total_amount / 1.15).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-[10px] text-gray-600">
                  <span>VAT (15%)</span>
                  <span>ETB {(order.total_amount - (order.total_amount / 1.15)).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between text-base font-black pt-2 border-t-2 border-dashed border-gray-300">
                  <span>TOTAL</span>
                  <span>ETB {order.total_amount.toLocaleString()}</span>
                </div>
              </div>

              {/* QR Verification Section */}
              <div className="flex flex-col items-center pt-6 opacity-80">
                <div className="w-20 h-20 bg-gray-50 border border-gray-200 rounded flex items-center justify-center mb-1">
                  <QrCode className="w-12 h-12 text-gray-300" />
                </div>
                <p className="text-[7px] text-gray-400 uppercase tracking-widest text-center">Scan to verify receipt<br />ORD-{order.id.slice(0, 8)}</p>
              </div>

              <div className="absolute top-0 right-0 w-16 h-16 pointer-events-none opacity-[0.03]">
                <ShieldCheck className="w-full h-full text-black rotate-12" />
              </div>
            </div>

            <div className="flex flex-col md:grid md:grid-cols-2 gap-3 mt-6">
              <Button onClick={handleGoToPayment} className="w-full h-14 bg-primary text-black font-black uppercase rounded-xl order-1 md:order-2 md:col-start-2">
                Pay All <ChevronRight className="ml-2 w-5 h-5" />
              </Button>
              <div className="grid grid-cols-2 gap-2 order-2 md:order-1 md:col-start-1">
                <Button variant="outline" onClick={() => window.print()} className="h-12 bg-white/5 border-white/10 rounded-xl font-bold">
                  <Printer className="w-4 h-4 mr-2" /> Print
                </Button>
                <Button onClick={() => setView('split')} className="h-12 bg-white/10 text-white font-black uppercase rounded-xl border border-white/10 hover:bg-white/20">
                  Split
                </Button>
              </div>
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

        {
          view === 'split' && (
            <SplitPaymentView
              order={order}
              onBack={() => setView('bill')}
              onSuccess={() => {
                setView('success');
                onSuccess();
              }}
            />
          )
        }

        {
          view === 'success' && (
            <div className="flex-1 flex flex-col items-center justify-center pt-2 space-y-8 animate-in fade-in duration-500">
              <AnimatedTicket
                ticketId={order.order_number || order.id.slice(0, 8)}
                amount={parseFloat(amountPaid) || order.total_amount}
                date={new Date()}
                staffName={order.waiter?.full_name || user?.user_metadata?.full_name || 'Staff'}
                paymentMethod={paymentMethod}
                reference={refNumber}
                barcodeValue={order.id.slice(0, 8).toUpperCase()}
              />

              <Button onClick={onClose} className="w-full bg-white/5 hover:bg-white/10 text-white font-black h-14 rounded-2xl text-[10px] uppercase tracking-[0.2em] border border-white/5 transition-all">
                Return to Station
              </Button>
            </div>
          )
        }
      </div >

      {
        isQRScannerOpen && (
          <QRScanner onScan={handleQRScan} onClose={() => setIsQRScannerOpen(false)} />
        )
      }
    </Dialog >
  );
};

function SplitPaymentView({ order, onBack, onSuccess }: {
  order: Order;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [amountToPay, setAmountToPay] = useState<string>('');
  const [method, setMethod] = useState<string>('cash');
  const [reference, setReference] = useState('');
  const [refInput, setRefInput] = useState('');

  // Derived state
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Math.max(0, order.total_amount - totalPaid);
  const isFullyPaid = remaining <= 0;

  // Fetch payments on mount
  useEffect(() => {
    fetchPayments();
  }, [order.id]);

  // Set default amount to remaining
  useEffect(() => {
    if (remaining > 0) {
      setAmountToPay(remaining.toString());
    }
  }, [remaining]);

  const fetchPayments = async () => {
    const { data } = await supabase
      .from('order_payments')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });

    if (data) setPayments(data);
  };

  const handleAddPayment = async () => {
    const amount = parseFloat(amountToPay);
    if (!amount || amount <= 0) return showToast("Invalid Amount", "error");
    if (method !== 'cash' && !refInput) return showToast("Reference required", "error");

    setIsLoading(true);
    try {
      await orderService.addPayment(order, {
        amount,
        method,
        reference: refInput
      });

      showToast("Payment Recorded", "success");
      setRefInput('');
      await fetchPayments();

      // Check if done
      const newTotal = totalPaid + amount; // optimistic
      if (newTotal >= order.total_amount) {
        onSuccess();
      }

    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4 animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between px-1">
        <button onClick={onBack} className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <div className="flex items-center gap-1.5 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-[9px] font-black text-purple-400 uppercase">Split Mode</span>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-[#0A0A0A] p-5 rounded-2xl border border-white/5 relative overflow-hidden">
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Total Bill</p>
            <div className="text-xl font-black text-zinc-400 font-mono">
              ETB {order.total_amount.toLocaleString()}
            </div>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Remaining</p>
            <div className={cn("text-3xl font-black font-mono tracking-tighter", remaining > 0 ? "text-white" : "text-green-500")}>
              ETB {remaining.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${Math.min(100, (totalPaid / order.total_amount) * 100)}%` }}
          />
        </div>
        <div className="flex justify-between mt-1 text-[8px] uppercase font-black text-zinc-600">
          <span>Paid: {totalPaid.toLocaleString()}</span>
          <span>{Math.round((totalPaid / order.total_amount) * 100)}%</span>
        </div>
      </div>

      {/* Payment List */}
      <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
        {payments.length === 0 && (
          <div className="text-center py-4 border border-dashed border-white/5 rounded-xl">
            <p className="text-[10px] text-zinc-600 uppercase font-bold">No payments yet</p>
          </div>
        )}
        {payments.map(p => (
          <div key={p.id} className="flex justify-between items-center p-3 bg-white/5 rounded-xl border border-white/5">
            <div className="flex items-center gap-3">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center",
                p.payment_method === 'cash' ? "bg-primary/10 text-primary" : "bg-blue-500/10 text-blue-400")}>
                {p.payment_method === 'cash' ? <Banknote className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
              </div>
              <div>
                <p className="text-[10px] font-black text-white uppercase">{p.payment_method}</p>
                <p className="text-[9px] font-mono text-zinc-500">{new Date(p.created_at).toLocaleTimeString()}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm font-black text-white font-mono">ETB {p.amount.toLocaleString()}</p>
              {p.reference && <p className="text-[8px] text-zinc-500 font-mono">{p.reference}</p>}
            </div>
          </div>
        ))}
      </div>

      {/* Input Section */}
      {!isFullyPaid && (
        <div className="space-y-3 bg-[#0A0A0A] p-4 rounded-2xl border border-white/5">
          <div className="flex gap-2 mb-2">
            {['cash', 'telebirr', 'cbe'].map(m => (
              <button
                key={m}
                onClick={() => { setMethod(m); setRefInput(''); }}
                className={cn(
                  "flex-1 py-2 rounded-lg text-[9px] font-black uppercase transition-all border",
                  method === m
                    ? "bg-white text-black border-white"
                    : "bg-black/40 text-zinc-500 border-white/5 hover:border-white/20"
                )}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1">Amount</label>
              <Input
                type="number"
                value={amountToPay}
                onChange={e => setAmountToPay(e.target.value)}
                className="bg-black/40 border-white/10 font-mono font-black text-white h-10"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[9px] font-black text-zinc-500 uppercase tracking-widest pl-1">Reference / ID</label>
              <Input
                value={refInput}
                onChange={e => setRefInput(e.target.value)}
                disabled={method === 'cash'}
                placeholder={method === 'cash' ? "Not Required" : "Trans ID..."}
                className="bg-black/40 border-white/10 font-mono text-xs h-10"
              />
            </div>
          </div>

          <Button
            onClick={handleAddPayment}
            isLoading={isLoading}
            className="w-full h-12 bg-primary text-black font-black uppercase rounded-xl mt-2"
          >
            Pay ETB {parseFloat(amountToPay || "0").toLocaleString()}
          </Button>
        </div>
      )}
    </div>
  );
};