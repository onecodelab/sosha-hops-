
import React, { useState, useEffect } from 'react';
import { Dialog, Button, Input, Badge, cn, Card } from './ui';
import { supabase } from '../supabase';
import { Loader2, QrCode, Search, CheckCircle2, XCircle, Receipt, Calendar, Clock, MapPin } from 'lucide-react';
import QRScanner from './QRScanner';

interface ReceiptVerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ReceiptVerificationModal: React.FC<ReceiptVerificationModalProps> = ({ isOpen, onClose }) => {
  const [orderId, setOrderId] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setOrderId('');
      setOrderData(null);
      setError(null);
    }
  }, [isOpen]);

  const verifyReceipt = async (idToVerify: string) => {
    if (!idToVerify) return;
    setLoading(true);
    setError(null);
    setOrderData(null);

    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items (
            quantity,
            price,
            menu_item:menu_items (name, category)
          )
        `)
        .eq('id', idToVerify)
        .single();

      if (error) throw error;
      setOrderData(data);
    } catch (err) {
      setError('Order not found or invalid ID.');
    } finally {
      setLoading(false);
    }
  };

  const handleScan = (data: string) => {
    setIsScannerOpen(false);
    setOrderId(data);
    verifyReceipt(data);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'served': return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'cancelled': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  return (
    <Dialog isOpen={isOpen} onClose={onClose} title="Verify Receipt">
      <div className="space-y-6 min-h-[300px]">
        
        {/* Search Input */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
            <Input 
              placeholder="Enter Order ID..." 
              value={orderId}
              onChange={(e) => setOrderId(e.target.value)}
              className="pl-9 font-mono uppercase"
              onKeyDown={(e) => e.key === 'Enter' && verifyReceipt(orderId)}
            />
          </div>
          <Button variant="secondary" onClick={() => setIsScannerOpen(true)}>
             <QrCode className="w-4 h-4 mr-2" /> Scan
          </Button>
          <Button onClick={() => verifyReceipt(orderId)} disabled={loading || !orderId}>
             {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
          </Button>
        </div>

        {/* Content Area */}
        <div className="bg-[#111] rounded-xl border border-gray-800 min-h-[200px] flex flex-col justify-center items-center p-6 relative overflow-hidden">
           
           {/* Empty State */}
           {!orderData && !loading && !error && (
              <div className="text-center text-gray-500">
                 <Receipt className="w-12 h-12 mx-auto mb-3 opacity-20" />
                 <p className="text-sm">Enter an Order ID to verify details</p>
              </div>
           )}

           {/* Loading State */}
           {loading && (
              <div className="flex flex-col items-center text-primary">
                 <Loader2 className="w-8 h-8 animate-spin mb-2" />
                 <span className="text-xs">Fetching records...</span>
              </div>
           )}

           {/* Error State */}
           {error && (
              <div className="text-center text-red-500 animate-in fade-in zoom-in">
                 <XCircle className="w-12 h-12 mx-auto mb-3" />
                 <p className="font-bold">Invalid Receipt</p>
                 <p className="text-xs mt-1 text-red-400">{error}</p>
              </div>
           )}

           {/* Valid Order Data */}
           {orderData && (
              <div className="w-full space-y-4 animate-in slide-in-from-bottom-2 fade-in duration-300 text-left">
                 
                 {/* Header Status */}
                 <div className="flex justify-between items-start border-b border-gray-800 pb-4">
                    <div>
                       <div className="flex items-center gap-2 mb-1">
                          <Badge variant="outline" className={cn("uppercase", getStatusColor(orderData.status))}>
                             {orderData.status}
                          </Badge>
                          <span className="text-xs font-mono text-gray-500">#{orderData.id.slice(0,8)}</span>
                       </div>
                       <p className="text-xs text-gray-400 flex items-center gap-1">
                          <Calendar className="w-3 h-3" /> {new Date(orderData.created_at).toLocaleDateString()} 
                          <Clock className="w-3 h-3 ml-2" /> {new Date(orderData.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                       </p>
                    </div>
                    <div className="text-right">
                       <p className="text-2xl font-bold text-white">ETB {orderData.total_amount.toLocaleString()}</p>
                       <p className="text-xs text-gray-500">{orderData.payment_method || 'Unpaid'}</p>
                    </div>
                 </div>

                 {/* Order Details */}
                 <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="p-3 bg-black/40 rounded-lg">
                       <p className="text-xs text-gray-500 uppercase font-bold mb-1">Table</p>
                       <div className="flex items-center gap-2 text-white font-bold">
                          <MapPin className="w-4 h-4 text-primary" /> {orderData.table_number}
                       </div>
                    </div>
                    <div className="p-3 bg-black/40 rounded-lg">
                       <p className="text-xs text-gray-500 uppercase font-bold mb-1">Items</p>
                       <div className="flex items-center gap-2 text-white font-bold">
                          <Receipt className="w-4 h-4 text-blue-500" /> {orderData.order_items?.length || 0} Items
                       </div>
                    </div>
                 </div>

                 {/* Item List */}
                 <div className="space-y-1 max-h-[150px] overflow-y-auto pr-2 custom-scrollbar">
                    <p className="text-xs text-gray-500 uppercase font-bold sticky top-0 bg-[#111] py-1">Order Summary</p>
                    {orderData.order_items?.map((item: any, i: number) => (
                       <div key={i} className="flex justify-between text-sm py-1 border-b border-gray-800/50 last:border-0">
                          <span className="text-gray-300"><span className="text-primary font-bold text-xs mr-2">{item.quantity}x</span> {item.menu_item?.name || 'Unknown Item'}</span>
                          <span className="text-gray-500 font-mono">{(item.price * item.quantity).toLocaleString()}</span>
                       </div>
                    ))}
                 </div>

                 {/* Validation Footer */}
                 <div className="pt-2 flex items-center justify-center gap-2 text-green-500 font-bold bg-green-500/5 p-2 rounded-lg border border-green-500/10">
                    <CheckCircle2 className="w-5 h-5" /> Valid Record Found
                 </div>
              </div>
           )}

        </div>
      </div>

      {isScannerOpen && (
        <QRScanner 
          onScan={handleScan} 
          onClose={() => setIsScannerOpen(false)} 
        />
      )}
    </Dialog>
  );
};
