import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';
import { MenuItem, Order } from '../types';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, showToast, cn } from '../components/ui';
import { Building2, Smartphone, Wallet, Receipt, XCircle, Scan, QrCode, CheckCircle2 } from 'lucide-react';
import { SoshaLogo } from '../components/SoshaLogo';
import QRScanner from '../components/QRScanner';

// Bank Configuration with Default Accounts
const BANKS = [
  { id: 'cbe', name: 'CBE', icon: <Building2 className="w-4 h-4" />, defaultAccount: '56042704' },
  { id: 'abyssinia', name: 'Abyssinia', icon: <Building2 className="w-4 h-4" />, defaultAccount: '16408' },
  { id: 'telebirr', name: 'Telebirr', icon: <Smartphone className="w-4 h-4" />, defaultAccount: '' },
  { id: 'chapa', name: 'Chapa', icon: <Wallet className="w-4 h-4" />, defaultAccount: '' },
];

interface VerificationResult {
  success: boolean;
  payer: string;
  payerAccount: string;
  receiver: string;
  receiverAccount: string;
  amount: number;
  date: string;
  reference: string;
  reason: string;
}

const ManagerDashboard: React.FC = () => {
  const { profile } = useAuth();
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);
  const [searchInv, setSearchInv] = useState('');

  // Payment Verification State
  const [selectedBank, setSelectedBank] = useState(BANKS[0]);
  const [referenceNumber, setReferenceNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState(BANKS[0].defaultAccount);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<VerificationResult | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const { data: menu } = await supabase.from('menu').select('*').order('name');
    if (menu) setMenuItems(menu);

    const { data: orders } = await supabase
      .from('orders')
      .select('*, verified_by_user:profiles(name)')
      .order('created_at', { ascending: false })
      .limit(10);
    
    if (orders) setRecentOrders(orders as unknown as Order[]);
  };

  const toggleAvailability = async (id: string, current: boolean) => {
    await supabase.from('menu').update({ is_available: !current }).eq('id', id);
    setMenuItems(prev => prev.map(item => item.id === id ? { ...item, is_available: !current } : item));
    showToast(`Item marked as ${!current ? 'Available' : 'Unavailable'}`);
  };

  const handleBankChange = (bankId: string) => {
    const bank = BANKS.find(b => b.id === bankId) || BANKS[0];
    setSelectedBank(bank);
    setAccountNumber(bank.defaultAccount);
    setVerificationResult(null); // Reset result on bank change
  };

  const handleScan = (data: string) => {
    setReferenceNumber(data);
    setIsScannerOpen(false);
    showToast('Transaction ID scanned successfully');
  };

  const handleVerifyPayment = () => {
    if (!referenceNumber) {
      showToast('Please enter a Transaction ID / Reference', 'error');
      return;
    }

    setVerifying(true);
    setVerificationResult(null);

    // Simulate API Delay
    setTimeout(() => {
      // Mock Success Logic based on inputs
      const isSuccess = referenceNumber.length > 5; // Mock validation rule

      const mockResult: VerificationResult = {
        success: isSuccess,
        payer: isSuccess ? "Yesuf Ali Musa" : "Unknown",
        payerAccount: "1****3028",
        receiver: "Sosha Restaurant",
        receiverAccount: accountNumber ? `1****${accountNumber.slice(-4)}` : "1****2704",
        amount: 500 + Math.floor(Math.random() * 2000), // Random amount for demo
        date: new Date().toISOString(),
        reference: referenceNumber.toUpperCase(),
        reason: "Bill Payment via Mobile"
      };

      setVerificationResult(mockResult);
      setVerifying(false);
      
      if (isSuccess) {
        showToast('Payment Verified Successfully');
      } else {
        showToast('Transaction not found', 'error');
      }
    }, 1500);
  };

  const handleDone = () => {
    if (verificationResult && verificationResult.success) {
      const mockOrder: any = {
        id: `txn-${Date.now()}`,
        table_no: 'Mobile',
        status: 'paid',
        total_amount: verificationResult.amount,
        created_at: new Date().toISOString(),
        verified_by_user: { name: 'Mobile App' }
      };
      
      setRecentOrders(prev => [mockOrder, ...prev]);
      showToast('Transaction saved to history');
    }
    setVerificationResult(null);
    setReferenceNumber('');
  };

  const filteredItems = menuItems.filter(i => i.name.toLowerCase().includes(searchInv.toLowerCase()));

  return (
    <DashboardLayout title="Manager Dashboard" subtitle="Overview of operations">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Column: Inventory */}
        <Card className="h-full flex flex-col">
          <CardHeader>
            <CardTitle>Inventory Control</CardTitle>
            <div className="mt-2">
               <Input placeholder="Search item to toggle..." value={searchInv} onChange={e => setSearchInv(e.target.value)} />
            </div>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto max-h-[600px] space-y-2">
            {filteredItems.map(item => (
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-black/5 dark:bg-gray-900/30 hover:bg-black/10 dark:hover:bg-gray-900/50 transition-colors">
                <div className="flex items-center gap-3">
                   {item.image_url ? (
                     <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-md object-cover bg-gray-200 dark:bg-gray-800" />
                   ) : (
                     <div className="w-10 h-10 rounded-md bg-gray-200 dark:bg-gray-800 flex items-center justify-center text-xs text-muted">Img</div>
                   )}
                   <div>
                      <p className="font-medium text-sm text-foreground">{item.name}</p>
                      <p className="text-xs text-muted">ETB {item.price}</p>
                   </div>
                </div>
                <div className="flex items-center gap-3">
                   <button 
                     onClick={() => toggleAvailability(item.id, item.is_available)}
                     className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ease-in-out ${item.is_available ? 'bg-primary' : 'bg-gray-400 dark:bg-gray-700'}`}
                   >
                     <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${item.is_available ? 'translate-x-6' : ''}`} />
                   </button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Right Column: Payment & Activity */}
        <div className="space-y-6">
          
          {/* Payment Verification Card */}
          <Card className="overflow-hidden border-primary/20">
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <div className="p-1.5 bg-primary/20 rounded-md">
                   <Receipt className="w-5 h-5 text-primary" />
                </div>
                Payment Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Bank Selector (Tabbed Segmented Control) */}
              <div className="grid grid-cols-4 gap-2 bg-black/5 dark:bg-gray-900/50 p-1 rounded-xl border border-border">
                {BANKS.map(bank => (
                  <button
                    key={bank.id}
                    onClick={() => handleBankChange(bank.id)}
                    className={cn(
                      "flex flex-col items-center justify-center py-3 rounded-lg transition-all duration-200 text-xs font-medium gap-1.5 relative",
                      selectedBank.id === bank.id 
                        ? "bg-primary/10 border border-primary text-primary shadow-sm" 
                        : "text-muted hover:text-foreground hover:bg-black/5 dark:hover:bg-white/5"
                    )}
                  >
                    {bank.icon}
                    {bank.name}
                  </button>
                ))}
              </div>

              {/* Inputs */}
              <div className="space-y-5">
                <div className="space-y-2">
                   <label className="text-xs font-bold text-muted uppercase tracking-wide">Transaction ID / Reference</label>
                   <div className="relative group">
                     <Input 
                       placeholder="e.g. FT25333Q3RYH" 
                       className="bg-black/5 dark:bg-gray-950/50 border-border focus:border-primary/50 h-12 text-base tracking-wide pl-4 pr-32 font-medium"
                       value={referenceNumber} 
                       onChange={e => setReferenceNumber(e.target.value)} 
                     />
                     <div className="absolute right-1 top-1 bottom-1 flex items-center">
                       <Button 
                         variant="secondary" 
                         size="sm" 
                         className="h-full px-4 text-xs font-medium border-l border-border flex items-center gap-2"
                         onClick={() => setIsScannerOpen(true)}
                       >
                         <QrCode className="w-4 h-4 text-primary" />
                         Scan
                       </Button>
                     </div>
                   </div>
                   <p className="text-[10px] text-muted">Enter the reference number or upload receipt image (Coming soon)</p>
                </div>

                <div className="space-y-2">
                   <label className="text-xs font-bold text-muted uppercase tracking-wide">Account Number (Receiver)</label>
                   <div className={cn(
                     "relative rounded-lg border-2 p-4 transition-all duration-300",
                     selectedBank.defaultAccount
                       ? "bg-primary/5 border-primary/50 shadow-[inset_0_0_15px_rgba(33,123,244,0.05)]" 
                       : "bg-black/5 dark:bg-gray-950 border-border"
                   )}>
                     <div className="text-xl font-bold font-mono tracking-wider text-foreground">
                        {accountNumber || <span className="text-muted text-sm font-sans font-normal italic">Select a bank to view account</span>}
                     </div>
                     {selectedBank.defaultAccount && (
                        <p className="text-[10px] font-medium text-primary mt-1.5">
                          Default verification account for {selectedBank.name}
                        </p>
                     )}
                   </div>
                </div>
              </div>

              {/* Result Display */}
              {verificationResult && (
                <div className={cn(
                  "rounded-xl border p-4 space-y-3 animate-in fade-in zoom-in-95 duration-300 relative overflow-hidden mt-2",
                  verificationResult.success ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"
                )}>
                  <div className="absolute -top-4 -right-4 w-20 h-20 opacity-10">
                    <SoshaLogo className="w-full h-full" />
                  </div>

                  <div className="flex items-center justify-between border-b border-border pb-2 mb-2 relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 opacity-70">
                         <SoshaLogo className="w-full h-full" />
                      </div>
                      <span className="font-semibold text-sm text-muted">Verification Result</span>
                    </div>
                    <span className={cn("font-mono font-bold text-sm", verificationResult.success ? "text-green-500" : "text-red-500")}>
                      {verificationResult.success ? "true" : "false"}
                    </span>
                  </div>

                  {verificationResult.success ? (
                    <div className="space-y-1.5 text-xs relative z-10">
                      <div className="flex justify-between">
                        <span className="text-muted">Payer:</span>
                        <span className="text-foreground font-medium">{verificationResult.payer}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Payer Account:</span>
                        <span className="text-foreground font-mono">{verificationResult.payerAccount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Receiver:</span>
                        <span className="text-foreground font-medium">{verificationResult.receiver}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Receiver Account:</span>
                        <span className="text-foreground font-mono">{verificationResult.receiverAccount}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 my-1 border-t border-border">
                        <span className="text-muted">Amount:</span>
                        <span className="text-primary font-bold text-sm">ETB {verificationResult.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Date:</span>
                        <span className="text-muted">{new Date(verificationResult.date).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted">Reference:</span>
                        <span className="text-foreground font-mono">{verificationResult.reference}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-muted text-sm flex flex-col items-center">
                      <XCircle className="w-8 h-8 text-red-500 mb-2 opacity-50" />
                      Transaction details not found.
                    </div>
                  )}
                </div>
              )}

              {/* Verify / Done Button */}
              <Button 
                onClick={verificationResult ? handleDone : handleVerifyPayment} 
                className={cn(
                  "w-full h-12 text-sm font-bold tracking-wide shadow-lg transition-all mt-4",
                  verifying ? "opacity-80" : "hover:scale-[1.01]"
                )}
                disabled={verifying}
                style={{
                  background: verifying 
                    ? 'linear-gradient(90deg, #4c1d95 0%, #2e1065 100%)' 
                    : verificationResult?.success
                      ? 'linear-gradient(90deg, #10b981 0%, #059669 100%)' // Green for Done
                      : 'linear-gradient(90deg, #3b0764 0%, #581c87 100%)', // Dark purple gradient
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                {verifying 
                  ? 'Verifying...' 
                  : verificationResult?.success 
                    ? <><CheckCircle2 className="w-4 h-4 mr-2" /> Done</> 
                    : 'Verify'
                }
              </Button>

            </CardContent>
          </Card>

          {/* Activity Log */}
          <Card>
            <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
            <CardContent>
               {recentOrders.length === 0 ? <p className="text-muted text-sm">No activity yet.</p> : (
                 <div className="space-y-0">
                   {recentOrders.map((order, i) => (
                     <div key={order.id} className={`flex items-center justify-between text-sm py-3 ${i !== recentOrders.length -1 ? 'border-b border-border' : ''}`}>
                       <div className="flex items-center gap-3">
                         <div className={`w-2 h-2 rounded-full ${order.status === 'paid' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                         <div>
                            {order.table_no === 'Mobile' ? (
                                <p className="font-bold text-blue-500 dark:text-blue-400">Mobile Payment</p>
                            ) : (
                                <p className="font-bold text-foreground">Table {order.table_no}</p>
                            )}
                            <p className="text-xs text-muted capitalize">{order.status.replace('_', ' ')}</p>
                         </div>
                       </div>
                       <div className="text-right">
                         <div className="font-medium text-foreground">ETB {order.total_amount.toLocaleString()}</div>
                         <div className="text-xs text-muted">
                           {new Date(order.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                         </div>
                       </div>
                     </div>
                   ))}
                 </div>
               )}
            </CardContent>
          </Card>
        </div>
      </div>
      
      {/* Scanner Overlay */}
      {isScannerOpen && (
        <QRScanner 
          onScan={handleScan} 
          onClose={() => setIsScannerOpen(false)} 
        />
      )}
    </DashboardLayout>
  );
};

export default ManagerDashboard;