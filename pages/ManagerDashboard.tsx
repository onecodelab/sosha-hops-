import React, { useEffect, useState } from 'react';
import DashboardLayout from '../components/DashboardLayout';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabase';
import { MenuItem, Order } from '../types';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, showToast, cn } from '../components/ui';
import { Building2, Smartphone, Wallet, Receipt, XCircle } from 'lucide-react';

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
              <div key={item.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-gray-900/30 hover:bg-gray-900/50 transition-colors">
                <div className="flex items-center gap-3">
                   {item.image_url ? (
                     <img src={item.image_url} alt={item.name} className="w-10 h-10 rounded-md object-cover bg-gray-800" />
                   ) : (
                     <div className="w-10 h-10 rounded-md bg-gray-800 flex items-center justify-center text-xs text-gray-500">Img</div>
                   )}
                   <div>
                      <p className="font-medium text-sm text-white">{item.name}</p>
                      <p className="text-xs text-gray-400">ETB {item.price}</p>
                   </div>
                </div>
                <div className="flex items-center gap-3">
                   <button 
                     onClick={() => toggleAvailability(item.id, item.is_available)}
                     className={`w-12 h-6 rounded-full p-1 transition-all duration-300 ease-in-out ${item.is_available ? 'bg-primary' : 'bg-gray-700'}`}
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
                <Receipt className="w-5 h-5 text-primary" />
                Payment Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              
              {/* Bank Selector */}
              <div className="grid grid-cols-4 gap-2">
                {BANKS.map(bank => (
                  <button
                    key={bank.id}
                    onClick={() => handleBankChange(bank.id)}
                    className={cn(
                      "flex flex-col items-center justify-center p-2 rounded-lg border transition-all text-xs font-medium gap-1",
                      selectedBank.id === bank.id 
                        ? "bg-primary/20 border-primary text-primary shadow-[0_0_10px_rgba(33,123,244,0.2)]" 
                        : "bg-gray-900/50 border-gray-800 text-gray-400 hover:bg-gray-800 hover:border-gray-700"
                    )}
                  >
                    {bank.icon}
                    {bank.name}
                  </button>
                ))}
              </div>

              {/* Inputs */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                   <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Transaction ID / Reference</label>
                   <Input 
                     placeholder="e.g. FT25333Q3RYH" 
                     className="bg-gray-950 border-gray-800 focus:border-primary/50 text-lg tracking-wider"
                     value={referenceNumber} 
                     onChange={e => setReferenceNumber(e.target.value)} 
                   />
                   <p className="text-[10px] text-gray-500">Enter the reference number or upload receipt image (Coming soon)</p>
                </div>

                <div className="space-y-1.5">
                   <label className="text-xs font-medium text-gray-400 uppercase tracking-wide">Account Number (Receiver)</label>
                   <Input 
                     placeholder={selectedBank.defaultAccount ? "Locked" : "Enter Account #"}
                     className="bg-gray-950 border-gray-800 font-mono"
                     value={accountNumber} 
                     onChange={e => setAccountNumber(e.target.value)}
                   />
                   {selectedBank.defaultAccount && (
                     <p className="text-[10px] text-primary/70">Default verification account for {selectedBank.name}</p>
                   )}
                </div>
              </div>

              {/* Result Display */}
              {verificationResult && (
                <div className={cn(
                  "rounded-xl border p-4 space-y-3 animate-in fade-in zoom-in-95 duration-300",
                  verificationResult.success ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"
                )}>
                  <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
                    <span className="font-semibold text-sm text-gray-300">Verification Result</span>
                    <span className={cn("font-mono font-bold text-sm", verificationResult.success ? "text-green-400" : "text-red-400")}>
                      {verificationResult.success ? "true" : "false"}
                    </span>
                  </div>

                  {verificationResult.success ? (
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Payer:</span>
                        <span className="text-white font-medium">{verificationResult.payer}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Payer Account:</span>
                        <span className="text-white font-mono">{verificationResult.payerAccount}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Receiver:</span>
                        <span className="text-white font-medium">{verificationResult.receiver}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Receiver Account:</span>
                        <span className="text-white font-mono">{verificationResult.receiverAccount}</span>
                      </div>
                      <div className="flex justify-between items-center py-1 my-1 border-t border-b border-white/5">
                        <span className="text-gray-500">Amount:</span>
                        <span className="text-primary font-bold text-sm">ETB {verificationResult.amount.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Date:</span>
                        <span className="text-gray-400">{new Date(verificationResult.date).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Reference:</span>
                        <span className="text-white font-mono">{verificationResult.reference}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Reason:</span>
                        <span className="text-gray-400">{verificationResult.reason}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-400 text-sm flex flex-col items-center">
                      <XCircle className="w-8 h-8 text-red-500 mb-2 opacity-50" />
                      Transaction details not found.
                    </div>
                  )}
                </div>
              )}

              {/* Verify Button */}
              <Button 
                onClick={handleVerifyPayment} 
                className={cn(
                  "w-full h-12 text-sm font-bold tracking-wide shadow-lg transition-all",
                  verifying ? "opacity-80" : "hover:scale-[1.01]"
                )}
                disabled={verifying}
                style={{
                  background: verifying 
                    ? 'linear-gradient(90deg, #217BF4 0%, #0a4aa8 100%)' 
                    : 'linear-gradient(90deg, #100f2e 0%, #4a1d47 100%)', // Match dark vibe in screenshot
                  border: '1px solid rgba(255,255,255,0.1)'
                }}
              >
                {verifying ? 'Verifying...' : 'Verify'}
              </Button>

            </CardContent>
          </Card>

          {/* Activity Log */}
          <Card>
            <CardHeader><CardTitle>Recent Activity</CardTitle></CardHeader>
            <CardContent>
               {recentOrders.length === 0 ? <p className="text-gray-500 text-sm">No activity yet.</p> : (
                 <div className="space-y-0">
                   {recentOrders.map((order, i) => (
                     <div key={order.id} className={`flex items-center justify-between text-sm py-3 ${i !== recentOrders.length -1 ? 'border-b border-gray-800' : ''}`}>
                       <div className="flex items-center gap-3">
                         <div className={`w-2 h-2 rounded-full ${order.status === 'paid' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                         <div>
                            <p className="font-bold text-white">Table {order.table_no}</p>
                            <p className="text-xs text-gray-500 capitalize">{order.status.replace('_', ' ')}</p>
                         </div>
                       </div>
                       <div className="text-right">
                         <div className="font-medium text-white">ETB {order.total_amount}</div>
                         <div className="text-xs text-gray-500">
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
    </DashboardLayout>
  );
};

export default ManagerDashboard;