import React, { useState, useRef, useEffect } from 'react';
import { Dialog, Button, Input, showToast, cn } from './ui';
import { supabase } from '../supabase';
import { Order, PaymentMethod } from '../types';
import { useAuth } from '../AuthContext';
import {
  CheckCircle2, Printer, Smartphone, Loader2, X,
  ChevronRight, ArrowLeft, ShieldCheck, Landmark,
  Scan, Banknote, FileText, AlertCircle, Coins, QrCode, Heart
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { orderService } from '../services/orderService';
import QRScanner from './QRScanner';
import { AnimatedTicket } from './AnimatedTicket';
import { usePaymentVerification } from '../hooks/usePaymentVerification';

interface BillModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onSuccess: () => void;
}

// Security Best Practice: Use environment variables
// Fix: Property 'env' does not exist on type 'ImportMeta'. Using process.env to align with provided environment guidelines.
const BARO_API_KEY = import.meta.env.VITE_BARO_API_KEY || "baro_prod_key_8821";

const BANK_CONFIG: Record<string, { label: string, placeholder: string, color: string, icon: any, endpoint: string }> = {
  telebirr: {
    label: "Telebirr",
    placeholder: "10-char ID (e.g. CL...)",
    color: "text-purple-400 border-purple-500/30 bg-purple-500/5",
    icon: Smartphone,
    endpoint: "telebirr"
  },
  cbe: {
    label: "CBE",
    placeholder: "FT Reference...",
    color: "text-blue-400 border-blue-500/30 bg-blue-500/5",
    icon: Landmark,
    endpoint: "cbe"
  },
  dashen: {
    label: "Dashen",
    placeholder: "Ref Number...",
    color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/5",
    icon: Landmark,
    endpoint: "dashen"
  },
  abyssinia: {
    label: "Abyssinia",
    placeholder: "BoA Reference...",
    color: "text-zinc-400 border-zinc-500/30 bg-zinc-500/5",
    icon: Landmark,
    endpoint: "abyssinia"
  },
  cbebirr: {
    label: "CBE Birr",
    placeholder: "Receipt #",
    color: "text-orange-400 border-orange-500/30 bg-orange-500/5",
    icon: Coins,
    endpoint: "cbebirr"
  }
};


export const BillModal: React.FC<BillModalProps> = ({
  isOpen, onClose, order, onSuccess
}) => {
  const { user, profile } = useAuth();

  const [view, setView] = useState<'bill' | 'payment' | 'receipt' | 'success' | 'split'>('bill');
  const [paymentMethod, setPaymentMethod] = useState<string>('cash');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [refNumber, setRefNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  // Replaced local verifying state with hook state
  const { startVerification, job, isVerifying, error: jobError, reset: resetJob } = usePaymentVerification();
  const [isVerified, setIsVerified] = useState(false);
  const [isQRScannerOpen, setIsQRScannerOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setView('bill');
      setRefNumber('');
      setAmountPaid('');
      setPaymentMethod('cash');
      setIsVerified(false);
      resetJob();
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
        // Priority check for CBE (FT + digits)
        const cbeMatch = rawData.match(/(FT[A-Z0-9]{10})/i);
        const teleMatch = rawData.match(/(?:receipt\/|transaction\/)?([A-Z0-9]{10})/i);

        if (cbeMatch) {
          extractedRef = cbeMatch[1].toUpperCase();
          detectedBank = 'cbe';
        } else if (teleMatch) {
          extractedRef = teleMatch[1];
          detectedBank = 'telebirr';
        } else {
          extractedRef = rawData.trim();
        }
      }
    } catch (e) {
      extractedRef = rawData.trim();
    }

    // Standardize CBE to 12 chars if it starts with FT
    if (extractedRef.toUpperCase().startsWith('FT') && extractedRef.length > 12) {
      extractedRef = extractedRef.slice(0, 12).toUpperCase();
      detectedBank = 'cbe';
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

  // Fetch the organization name for the receipt header
  const { data: orgData } = useQuery({
    queryKey: ['organization_info'],
    queryFn: async () => {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return null;
      const { data: prof } = await supabase.from('profiles').select('organization_id').eq('id', authUser.id).maybeSingle();
      if (!prof?.organization_id) return null;
      const { data: org } = await supabase.from('organizations').select('name').eq('id', prof.organization_id).maybeSingle();
      return org;
    },
    staleTime: 1000 * 60 * 30
  });
  const restaurantName = orgData?.name || 'My Restaurant';

  // Fetch branch/location name
  const { data: branchData } = useQuery({
    queryKey: ['branch_info', order?.branch_id],
    queryFn: async () => {
      if (!order?.branch_id) return null;
      const { data } = await supabase.from('branches').select('name').eq('id', order.branch_id).maybeSingle();
      return data;
    },
    enabled: !!order?.branch_id,
    staleTime: 1000 * 60 * 30
  });
  const locationName = branchData?.name || 'Main Branch';

  const getDynamicReceiver = (bank: string) => {
    const setting = bankSettings.find((s: any) => s.bank_key === bank);
    return setting?.account_number || "";
  };

  const verifyTransaction = async (targetRef?: string, targetBank?: string) => {
    const ref = (targetRef || refNumber).trim();
    const bank = targetBank || paymentMethod;
    if (!ref || bank === 'cash' || !order) return;

    // Pre-check: Don't even start verification if we already have this ID in our system
    // This prevents redundant API calls and gives immediate feedback
    const { data: existingPay } = await supabase
      .from('order_payments')
      .select('order_id')
      .eq('reference', ref)
      .maybeSingle();

    if (existingPay && existingPay.order_id !== order.id) {
      showToast("Fraud Alert: This transaction reference has already been used!", "error");
      return;
    }

    const { data: existingOrder } = await supabase
      .from('orders')
      .select('id')
      .eq('transaction_reference', ref)
      .maybeSingle();

    if (existingOrder && existingOrder.id !== order.id) {
      showToast("Fraud Alert: This transaction reference has already been used!", "error");
      return;
    }

    // Reset previous job state
    resetJob();

    const config = BANK_CONFIG[bank];
    const additional_data: any = {};

    // Add bank-specific parameters
    if (bank === 'cbe') {
      additional_data.accountSuffix = getDynamicReceiver('cbe');
      additional_data.expected_receiver = getDynamicReceiver('cbe');
    } else if (bank === 'abyssinia') {
      additional_data.suffix = getDynamicReceiver('abyssinia');
      additional_data.expected_receiver = getDynamicReceiver('abyssinia');
    } else if (bank === 'cbebirr') {
      additional_data.receiptNumber = ref;
      additional_data.phoneNumber = ''; // Would need input for this if required
    }

    startVerification({
      payment_method: bank,
      reference: ref,
      expected_amount: order.total_amount,
      amount: undefined, // Will be filled by verifier if successful
      additional_data
    });
  };

  // Effect to handle Job Updates
  useEffect(() => {
    if (!job) return;

    if (job.status === 'completed' && job.result_data) {
      const data = job.result_data;

      // Audit is handled by backend or we can do it here if needed, 
      // but for now let's keep frontend audit log for redundancy
      if (data.success) {
        orderService.logPaymentAudit({
          orderId: order!.id,
          reference: data.receipt_reference || refNumber,
          method: paymentMethod,
          amount: data.amount,
          status: data.validated ? 'success' : 'failed',
          details: data.validation
        });
      }

      if (data.success && data.validated) {
        setIsVerified(true);
        const finalAmount = data.amount ? parseFloat(data.amount) : order!.total_amount;

        if (data.amount) setAmountPaid(data.amount.toString());
        if (data.receipt_reference) setRefNumber(data.receipt_reference);

        showToast("Payment verified ✓", "success");

        // Tip Logic
        const overpayment = finalAmount - order!.total_amount;
        if (overpayment > order!.total_amount * 0.05) {
          showToast("Overpayment detected. Please confirm tip.", "warning");
          setView('payment');
        } else {
          showToast("Processing automated checkout...", "warning");
          // Auto close
          orderService.closeOrder(order!, {
            method: paymentMethod,
            amountPaid: finalAmount,
            tipAmount: Math.max(0, overpayment),
            reference: data.receipt_reference || refNumber
          }).then(() => {
            setView('receipt');
          });
        }
      } else {
        // Validation Failed
        showToast(data.error || "Validation Failed", "error");
        setIsVerified(false);
      }
    } else if (job.status === 'failed') {
      showToast(job.last_error || "Verification Service Failed", "error");
      setIsVerified(false);
    }
  }, [job]);

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

      setView('receipt');
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
            <div className="bg-white text-black p-5 rounded-lg shadow-inner mx-1 w-full max-w-[320px] mx-auto" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
              {/* TIN */}
              <div className="text-center mb-1">
                <p className="text-[10px] tracking-wider font-mono">TIN: 0043819230</p>
              </div>
              <p className="text-center text-[9px] text-gray-400 mb-1 font-mono">- - - - - - - - - - - - - - - - - - - -</p>

              {/* Business Name */}
              <div className="text-center mb-1">
                <h3 className="font-black text-sm uppercase tracking-tight leading-tight font-mono">{restaurantName}</h3>
                <p className="text-[9px] text-gray-600 leading-tight font-mono">Location: {locationName}</p>
              </div>

              {/* FS No & Date */}
              <div className="flex justify-between text-[9px] text-gray-600 mt-1 font-mono">
                <span>FS No.{order.order_number || order.id.slice(0, 7)}</span>
                <span>{new Date(order.created_at).toLocaleDateString('en-GB')}</span>
                <span>{new Date(order.created_at).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
              </div>

              <p className="text-center text-[9px] text-gray-400 my-1 font-mono">- - - - - - - - - - - - - - - - - - - -</p>

              {/* Invoice Type */}
              <div className="text-center mb-2">
                <p className="font-black text-xs uppercase tracking-widest font-mono">CASH INVOICE</p>
              </div>

              {/* Customer / Invoice / Operator */}
              <div className="space-y-0.5 text-[10px] mb-2 font-mono">
                <p>Customer: <span className="font-bold uppercase">Walk-in</span></p>
                <p>Invoice: <span className="font-bold">ORD-{order.order_number || order.id.slice(0, 8)}</span></p>
                <p>Operator: <span className="font-bold uppercase">{order.waiter?.full_name || profile?.full_name || user?.user_metadata?.full_name || 'Staff'}</span></p>
                <p>Table: <span className="font-bold">T-{order.table_number || 'N/A'}</span></p>
              </div>

              <p className="text-center text-[9px] text-gray-400 my-1 font-mono">- - - - - - - - - - - - - - - - - - - -</p>

              {/* Items Header */}
              <div className="flex text-[9px] font-black uppercase tracking-wider text-gray-500 mb-1 font-mono">
                <span className="flex-1">Description</span>
                <span className="w-8 text-center">Qty</span>
                <span className="w-16 text-right">Price</span>
                <span className="w-20 text-right">Amount</span>
              </div>

              {/* Items */}
              <div className="space-y-1 mb-2 max-h-40 overflow-y-auto custom-scrollbar font-mono">
                {order.order_items?.map((item: any, i: number) => (
                  <div key={i} className="flex text-[10px]">
                    <span className="flex-1 truncate pr-1 uppercase">{item.menu_item?.name || 'Item'}</span>
                    <span className="w-8 text-center">{item.quantity}</span>
                    <span className="w-16 text-right">{(item.price || 0).toLocaleString()}</span>
                    <span className="w-20 text-right font-bold">{((item.price || 0) * (item.quantity || 1)).toLocaleString()}</span>
                  </div>
                ))}
              </div>

              <p className="text-center text-[9px] text-gray-400 my-1 font-mono">- - - - - - - - - - - - - - - - - - - -</p>

              {/* Tax Breakdown */}
              <div className="space-y-1 text-[10px] font-mono">
                <div className="flex justify-between">
                  <span>TXBL 1</span>
                  <span className="font-bold">*{(order.total_amount / 1.15).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex justify-between">
                  <span>TAX1 15%</span>
                  <span className="font-bold">*{(order.total_amount - order.total_amount / 1.15).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
              </div>

              <p className="text-center text-[9px] text-gray-400 my-2 font-mono">- - - - - - - - - - - - - - - - - - - -</p>

              {/* TOTAL */}
              <div className="flex justify-between text-sm font-black font-mono">
                <span>TOTAL</span>
                <span>*{order.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
              </div>

              <p className="text-center text-[9px] text-gray-400 my-2 font-mono">- - - - - - - - - - - - - - - - - - - -</p>

              {/* Item Count */}
              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span>ITEM#</span>
                <span className="font-bold">{order.order_items?.reduce((sum: number, item: any) => sum + (item.quantity || 1), 0) || 0}</span>
              </div>

              <p className="text-center text-[9px] text-gray-400 my-2 font-mono">- - - - - - - - - - - - - - - - - - - -</p>

              {/* ERCA Footer */}
              <div className="text-center space-y-1 mt-2 font-mono">
                <span className="font-black text-[11px] tracking-wide">ERCA</span>
                <p className="text-[9px] text-gray-500">FG{order.id.slice(0, 8).toUpperCase()}</p>
                <p className="text-[9px] text-gray-400 mt-2 tracking-wider">Powered by Baro OS</p>
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

              {/* Tip Confirmation Card */}
              {isVerified && (parseFloat(amountPaid) > order.total_amount) && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-4 animate-in zoom-in-95 duration-300">
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[10px] font-black text-green-400 uppercase tracking-widest">Tip Analysis</span>
                    <Heart className="w-3.5 h-3.5 text-green-400 fill-green-400/20" />
                  </div>
                  <div className="space-y-1.5 grayscale-[0.5]">
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500 font-bold">Total Bill:</span>
                      <span className="text-white font-mono">ETB {order.total_amount}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-zinc-500 font-bold">Paid via Bank:</span>
                      <span className="text-green-400 font-mono">ETB {amountPaid}</span>
                    </div>
                    <div className="h-px bg-white/5 my-1" />
                    <div className="flex justify-between text-sm">
                      <span className="text-white font-black uppercase tracking-tighter">Tip for Staff:</span>
                      <span className="text-green-400 font-black font-mono">ETB {(parseFloat(amountPaid) - order.total_amount).toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              )}
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
              profile={profile}
              onBack={() => setView('bill')}
              onSuccess={() => {
                setView('success');
                onSuccess();
              }}
            />
          )
        }

        {
          view === 'receipt' && (
            <div className="animate-in fade-in zoom-in-95 duration-300 flex flex-col items-center">
              <div className="bg-white text-black p-5 rounded-lg shadow-inner mx-1 w-full max-w-[320px] mx-auto mt-4" style={{ fontFamily: "'Courier New', Courier, monospace" }}>
                {/* TIN */}
                <div className="text-center mb-1">
                  <p className="text-[10px] tracking-wider font-mono">TIN: 0043819230</p>
                </div>
                <p className="text-center text-[9px] text-gray-400 mb-1 font-mono">- - - - - - - - - - - - - - - - - - - -</p>

                {/* Business Name */}
                <div className="text-center mb-1">
                  <h3 className="font-black text-sm uppercase tracking-tight leading-tight font-mono">{restaurantName}</h3>
                  <p className="text-[9px] text-gray-600 leading-tight font-mono">Location: {locationName}</p>
                </div>

                {/* FS No & Date */}
                <div className="flex justify-between text-[9px] text-gray-600 mt-1 font-mono">
                  <span>FS No.{order.order_number || order.id.slice(0, 7)}</span>
                  <span>{new Date().toLocaleDateString('en-GB')}</span>
                  <span>{new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                </div>

                <p className="text-center text-[9px] text-gray-400 my-1 font-mono">- - - - - - - - - - - - - - - - - - - -</p>

                {/* Invoice Type */}
                <div className="text-center mb-2">
                  <p className="font-black text-xs uppercase tracking-widest font-mono bg-green-100 py-1 rounded inline-block px-2">PAID INVOICE</p>
                </div>

                {/* Customer / Invoice / Operator */}
                <div className="space-y-0.5 text-[10px] mb-2 font-mono">
                  <p>Customer: <span className="font-bold uppercase">{isVerified && refNumber ? 'Verified Payer' : 'Walk-in'}</span></p>
                  <p>Invoice: <span className="font-bold">ORD-{order.order_number || order.id.slice(0, 8)}</span></p>
                  <p>Operator: <span className="font-bold uppercase">{order.waiter?.full_name || profile?.full_name || user?.user_metadata?.full_name || 'Staff'}</span></p>
                  <p>Table: <span className="font-bold">T-{order.table_number || 'N/A'}</span></p>
                </div>

                <p className="text-center text-[9px] text-gray-400 my-1 font-mono">- - - - - - - - - - - - - - - - - - - -</p>

                {/* Items Header */}
                <div className="flex text-[9px] font-black uppercase tracking-wider text-gray-500 mb-1 font-mono">
                  <span className="flex-1">Description</span>
                  <span className="w-8 text-center">Qty</span>
                  <span className="w-16 text-right">Price</span>
                  <span className="w-20 text-right">Amount</span>
                </div>

                {/* Items */}
                <div className="space-y-1 mb-2 max-h-40 overflow-y-auto custom-scrollbar font-mono">
                  {order.order_items?.map((item: any, i: number) => (
                    <div key={i} className="flex text-[10px]">
                      <span className="flex-1 truncate pr-1 uppercase">{item.menu_item?.name || 'Item'}</span>
                      <span className="w-8 text-center">{item.quantity}</span>
                      <span className="w-16 text-right">{(item.price || 0).toLocaleString()}</span>
                      <span className="w-20 text-right font-bold">{((item.price || 0) * (item.quantity || 1)).toLocaleString()}</span>
                    </div>
                  ))}
                </div>

                <p className="text-center text-[9px] text-gray-400 my-1 font-mono">- - - - - - - - - - - - - - - - - - - -</p>

                {/* Tax Breakdown */}
                <div className="space-y-1 text-[10px] font-mono">
                  <div className="flex justify-between">
                    <span>TXBL 1</span>
                    <span className="font-bold">*{(order.total_amount / 1.15).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>TAX1 15%</span>
                    <span className="font-bold">*{(order.total_amount - order.total_amount / 1.15).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <p className="text-center text-[9px] text-gray-400 my-2 font-mono">- - - - - - - - - - - - - - - - - - - -</p>

                {/* TOTAL */}
                <div className="flex justify-between text-sm font-black font-mono">
                  <span>TOTAL PAID</span>
                  <span>*{order.total_amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>

                <p className="text-center text-[9px] text-gray-400 my-2 font-mono">- - - - - - - - - - - - - - - - - - - -</p>

                {/* ERCA Footer */}
                <div className="text-center space-y-1 mt-2 font-mono">
                  <span className="font-black text-[11px] tracking-wide">ERCA</span>
                  <p className="text-[9px] text-gray-500">FG{order.id.slice(0, 8).toUpperCase()}</p>
                  <p className="text-[9px] text-gray-400 mt-2 tracking-wider">Powered by Baro OS</p>
                </div>
              </div>

              <div className="flex flex-col md:grid md:grid-cols-2 gap-3 mt-6 w-full max-w-[320px]">
                <Button onClick={() => window.print()} className="w-full h-14 bg-white/10 text-white font-black uppercase rounded-xl border border-white/10 hover:bg-white/20 order-2 md:order-1">
                  <Printer className="w-5 h-5 mr-2" /> Print
                </Button>
                <Button onClick={() => { setView('success'); onSuccess(); }} className="w-full h-14 bg-primary text-black font-black uppercase rounded-xl order-1 md:order-2">
                  Continue <ChevronRight className="ml-2 w-5 h-5" />
                </Button>
              </div>
            </div>
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

function SplitPaymentView({ order, profile, onBack, onSuccess }: {
  order: Order;
  profile: any;
  onBack: () => void;
  onSuccess: () => void;
}) {
  const [payments, setPayments] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'setup' | 'paying'>('setup');
  const [numCustomers, setNumCustomers] = useState<number>(2);

  // Per-person payment state
  const [activePersonIndex, setActivePersonIndex] = useState<number>(0);
  const [method, setMethod] = useState<string>('cash');
  const [refInput, setRefInput] = useState('');
  const [amountToPay, setAmountToPay] = useState<string>('');

  // Fetch bank settings
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

  const activeBanks = bankSettings.filter((b: any) => b.is_active);

  // Derived state
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const remaining = Math.max(0, order.total_amount - totalPaid);
  const isFullyPaid = remaining <= 0;
  const perPersonShare = Math.ceil(order.total_amount / numCustomers);

  // Track which "persons" have been paid
  const personPayments = Array.from({ length: numCustomers }, (_, i) => {
    return payments.filter(p => p.person_index === i);
  });
  const personPaidAmounts = personPayments.map(pp => pp.reduce((s, p) => s + Number(p.amount), 0));

  useEffect(() => { fetchPayments(); }, [order.id]);

  useEffect(() => {
    if (step === 'paying') {
      // Find first unpaid person
      const firstUnpaid = personPaidAmounts.findIndex(amt => amt < perPersonShare);
      if (firstUnpaid >= 0) {
        setActivePersonIndex(firstUnpaid);
        const personRemaining = Math.max(0, perPersonShare - personPaidAmounts[firstUnpaid]);
        setAmountToPay(personRemaining.toString());
      }
    }
  }, [step, payments.length]);

  const fetchPayments = async () => {
    const { data } = await supabase
      .from('order_payments')
      .select('*')
      .eq('order_id', order.id)
      .order('created_at', { ascending: true });
    if (data) setPayments(data);
  };

  const handleStartSplit = () => {
    if (numCustomers < 2) return showToast("Min 2 customers", "error");
    setStep('paying');
    setAmountToPay(perPersonShare.toString());
  };

  const handleAddPayment = async () => {
    const amount = parseFloat(amountToPay);
    if (!amount || amount <= 0) return showToast("Invalid amount", "error");
    if (method !== 'cash' && !refInput) return showToast("Reference required", "error");

    setIsLoading(true);
    try {
      await orderService.addPayment(order, {
        amount,
        method,
        reference: refInput || undefined
      });

      showToast(`Person ${activePersonIndex + 1} payment recorded`, "success");
      setRefInput('');
      setMethod('cash');
      await fetchPayments();

      // Check if fully paid
      const newTotal = totalPaid + amount;
      if (newTotal >= order.total_amount) {
        onSuccess();
      }
    } catch (err: any) {
      showToast(err.message, "error");
    } finally {
      setIsLoading(false);
    }
  };

  const getBankLabel = (key: string) => {
    const map: Record<string, string> = {
      cbe: 'CBE', telebirr: 'Telebirr', abyssinia: 'Abyssinia',
      dashen: 'Dashen', cbebirr: 'CBE Birr'
    };
    return map[key] || key;
  };

  const getBankColor = (key: string) => {
    const map: Record<string, string> = {
      cbe: 'text-blue-400 border-blue-500/30 bg-blue-500/10',
      telebirr: 'text-purple-400 border-purple-500/30 bg-purple-500/10',
      abyssinia: 'text-zinc-300 border-zinc-500/30 bg-zinc-500/10',
      dashen: 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10',
      cbebirr: 'text-orange-400 border-orange-500/30 bg-orange-500/10'
    };
    return map[key] || 'text-gray-400 border-gray-500/30 bg-gray-500/10';
  };

  // --- STEP 1: Setup ---
  if (step === 'setup') {
    return (
      <div className="space-y-5 animate-in fade-in duration-300">
        <div className="flex items-center justify-between px-1">
          <button onClick={onBack} className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="flex items-center gap-1.5 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
            <span className="text-[9px] font-black text-purple-400 uppercase">Split Mode</span>
          </div>
        </div>

        <div className="bg-[#0A0A0A] p-6 rounded-2xl border border-white/5 text-center">
          <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-1">Total Bill</p>
          <h3 className="text-3xl font-black text-white font-mono tracking-tighter">
            ETB {order.total_amount.toLocaleString()}
          </h3>
        </div>

        <div className="bg-[#0A0A0A] p-5 rounded-2xl border border-white/5 space-y-4">
          <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">How many people?</label>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setNumCustomers(Math.max(2, numCustomers - 1))}
              className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-white font-black text-xl hover:bg-white/10 transition-all"
            >-</button>
            <div className="flex-1 text-center">
              <span className="text-4xl font-black text-primary font-mono">{numCustomers}</span>
              <p className="text-[9px] text-zinc-600 font-bold uppercase mt-1">Customers</p>
            </div>
            <button
              onClick={() => setNumCustomers(Math.min(10, numCustomers + 1))}
              className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 text-white font-black text-xl hover:bg-white/10 transition-all"
            >+</button>
          </div>

          <div className="bg-primary/5 border border-primary/20 rounded-xl p-3 text-center">
            <p className="text-[9px] text-zinc-500 font-bold uppercase">Each person pays</p>
            <p className="text-xl font-black text-primary font-mono mt-1">
              ETB {perPersonShare.toLocaleString()}
            </p>
          </div>
        </div>

        <Button onClick={handleStartSplit} className="w-full h-14 bg-primary text-black font-black uppercase rounded-xl tracking-widest">
          Start Collecting <ChevronRight className="ml-2 w-5 h-5" />
        </Button>
      </div>
    );
  }

  // --- STEP 2: Per-Person Payment ---
  return (
    <div className="space-y-4 animate-in slide-in-from-right duration-300">
      <div className="flex items-center justify-between px-1">
        <button onClick={() => setStep('setup')} className="flex items-center gap-1.5 text-zinc-500 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back
        </button>
        <div className="flex items-center gap-1.5 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20">
          <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />
          <span className="text-[9px] font-black text-purple-400 uppercase">Split Mode</span>
        </div>
      </div>

      {/* Progress */}
      <div className="bg-[#0A0A0A] p-4 rounded-2xl border border-white/5">
        <div className="flex justify-between items-end mb-2">
          <div>
            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Total Bill</p>
            <div className="text-lg font-black text-zinc-400 font-mono">ETB {order.total_amount.toLocaleString()}</div>
          </div>
          <div className="text-right">
            <p className="text-[9px] font-black text-zinc-600 uppercase tracking-widest">Remaining</p>
            <div className={cn("text-2xl font-black font-mono tracking-tighter", remaining > 0 ? "text-white" : "text-green-500")}>
              ETB {remaining.toLocaleString()}
            </div>
          </div>
        </div>
        <div className="h-1.5 w-full bg-zinc-800 rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all duration-500" style={{ width: `${Math.min(100, (totalPaid / order.total_amount) * 100)}%` }} />
        </div>
        <div className="flex justify-between mt-1 text-[8px] uppercase font-black text-zinc-600">
          <span>Paid: {totalPaid.toLocaleString()}</span>
          <span>{Math.round((totalPaid / order.total_amount) * 100)}%</span>
        </div>
      </div>

      {/* Person Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
        {Array.from({ length: numCustomers }, (_, i) => {
          const paid = personPaidAmounts[i] || 0;
          const isPaid = paid >= perPersonShare;
          return (
            <button
              key={i}
              onClick={() => {
                if (!isPaid) {
                  setActivePersonIndex(i);
                  setAmountToPay(Math.max(0, perPersonShare - paid).toString());
                  setMethod('cash');
                  setRefInput('');
                }
              }}
              className={cn(
                "flex-shrink-0 px-3 py-2 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all",
                isPaid
                  ? "bg-green-500/10 border-green-500/30 text-green-400"
                  : activePersonIndex === i
                    ? "bg-primary/10 border-primary text-primary"
                    : "bg-black/40 border-white/5 text-zinc-500 hover:border-white/20"
              )}
            >
              {isPaid ? <CheckCircle2 className="w-3 h-3 inline mr-1" /> : null}
              Person {i + 1}
            </button>
          );
        })}
      </div>

      {/* Active Person Payment Form */}
      {!isFullyPaid && (
        <div className="space-y-3 bg-[#0A0A0A] p-4 rounded-2xl border border-white/5">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-primary uppercase tracking-widest">
              Person {activePersonIndex + 1}  ETB {perPersonShare.toLocaleString()}
            </span>
            {personPaidAmounts[activePersonIndex] > 0 && (
              <span className="text-[9px] font-mono text-zinc-500">
                Paid: {personPaidAmounts[activePersonIndex].toLocaleString()}
              </span>
            )}
          </div>

          {/* Bank Options - Dynamic from bank_settings */}
          <div className="grid grid-cols-3 gap-1.5">
            <button
              onClick={() => { setMethod('cash'); setRefInput(''); }}
              className={cn(
                "py-2 rounded-lg text-[8px] font-black uppercase transition-all border",
                method === 'cash' ? "bg-primary/10 border-primary text-primary" : "bg-black/40 text-zinc-500 border-white/5 hover:border-white/20"
              )}
            >Cash</button>
            {activeBanks.map((bank: any) => (
              <button
                key={bank.bank_key}
                onClick={() => { setMethod(bank.bank_key); setRefInput(''); }}
                className={cn(
                  "py-2 rounded-lg text-[8px] font-black uppercase transition-all border",
                  method === bank.bank_key ? getBankColor(bank.bank_key) : "bg-black/40 text-zinc-500 border-white/5 hover:border-white/20"
                )}
              >{getBankLabel(bank.bank_key)}</button>
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
                placeholder={method === 'cash' ? 'Not Required' : 'Trans ID...'}
                className="bg-black/40 border-white/10 font-mono text-xs h-10"
              />
            </div>
          </div>

          <Button
            onClick={handleAddPayment}
            isLoading={isLoading}
            className="w-full h-12 bg-primary text-black font-black uppercase rounded-xl mt-1"
          >
            Pay ETB {parseFloat(amountToPay || "0").toLocaleString()}
          </Button>
        </div>
      )}

      {/* Payment History */}
      {payments.length > 0 && (
        <div className="space-y-1.5 max-h-[120px] overflow-y-auto custom-scrollbar pr-1">
          {payments.map(p => (
            <div key={p.id} className="flex justify-between items-center p-2.5 bg-white/5 rounded-xl border border-white/5">
              <div className="flex items-center gap-2.5">
                <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center",
                  p.payment_method === 'cash' ? "bg-primary/10 text-primary" : "bg-blue-500/10 text-blue-400")}>
                  {p.payment_method === 'cash' ? <Banknote className="w-3.5 h-3.5" /> : <Smartphone className="w-3.5 h-3.5" />}
                </div>
                <div>
                  <p className="text-[9px] font-black text-white uppercase">{getBankLabel(p.payment_method)}</p>
                  <p className="text-[8px] font-mono text-zinc-500">{new Date(p.created_at).toLocaleTimeString()}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs font-black text-white font-mono">ETB {Number(p.amount).toLocaleString()}</p>
                {p.reference && <p className="text-[7px] text-zinc-500 font-mono">{p.reference}</p>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Fully Paid Success */}
      {isFullyPaid && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-2xl p-5 text-center animate-in zoom-in-95 duration-300">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto mb-2" />
          <p className="text-sm font-black text-green-400 uppercase tracking-widest">Fully Paid</p>
          {totalPaid > order.total_amount && (
            <div className="mt-3 pt-3 border-t border-green-500/20">
              <p className="text-[9px] text-zinc-500 uppercase font-bold">Tip for Staff</p>
              <p className="text-lg font-black text-green-400 font-mono">ETB {(totalPaid - order.total_amount).toLocaleString()}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
