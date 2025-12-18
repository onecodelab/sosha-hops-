
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../supabase';
import { DashboardLayout } from '../components/DashboardLayout';
import { Card, CardContent, CardHeader, CardTitle, Input, Button, Badge, Dialog, showToast, cn } from '../components/ui';
import { Truck, Calendar, PackageCheck, AlertCircle, FileText, CheckCircle2, ArrowRight } from 'lucide-react';
import { useLanguage } from '../contexts/LanguageContext';
import { useAuth } from '../AuthContext';
import { PurchaseOrder, PurchaseOrderItem } from '../types';

interface ReceiveItem extends PurchaseOrderItem {
  received_quantity: number;
}

const ManagerReceiveGoods: React.FC = () => {
  const { t } = useLanguage();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [receiveItems, setReceiveItems] = useState<ReceiveItem[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [receivedDate, setReceivedDate] = useState(new Date().toISOString().split('T')[0]);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Fetch Pending POs
  const { data: pendingPOs, isLoading } = useQuery({
    queryKey: ['pending-pos'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('purchase_orders')
        .select(`
          *,
          supplier:suppliers(name),
          items:purchase_order_items(
            *,
            ingredient:ingredients(name, unit_type)
          )
        `)
        .eq('status', 'sent')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn("PO fetch error:", error);
        return [];
      }
      return data as PurchaseOrder[];
    }
  });

  const openReceiveModal = (po: PurchaseOrder) => {
    setSelectedPO(po);
    // Initialize receive items with ordered quantity as default
    const items = po.items?.map(item => ({
      ...item,
      received_quantity: item.ordered_quantity
    })) || [];
    setReceiveItems(items);
    setInvoiceNumber('');
    setReceivedDate(new Date().toISOString().split('T')[0]);
    setIsModalOpen(true);
  };

  const updateReceivedQty = (itemId: string, qty: number) => {
    setReceiveItems(prev => prev.map(item => 
      item.id === itemId ? { ...item, received_quantity: qty } : item
    ));
  };

  const getMatchStatus = (ordered: number, received: number) => {
    if (received === ordered) return { label: t('grn.complete'), color: 'bg-green-500/10 text-green-500 border-green-500/20' };
    if (received > ordered) return { label: t('grn.over'), color: 'bg-orange-500/10 text-orange-500 border-orange-500/20' };
    return { label: t('grn.partial'), color: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20' };
  };

  // Submit GRN Mutation
  const { mutate: confirmReceipt, isPending } = useMutation({
    mutationFn: async () => {
      if (!user || !selectedPO) throw new Error("Missing data");
      if (!invoiceNumber) throw new Error("Invoice number is required");

      const allComplete = receiveItems.every(i => i.received_quantity >= i.ordered_quantity);
      
      // 1. Create GRN
      const seq = Math.floor(Math.random() * 10000); // Simple sequence for demo
      const grnNumber = `GRN-${new Date().getFullYear()}-${String(seq).padStart(4, '0')}`;
      
      const { data: grn, error: grnError } = await supabase
        .from('goods_received_notes')
        .insert({
          po_id: selectedPO.id,
          grn_number: grnNumber,
          received_date: receivedDate,
          invoice_number: invoiceNumber,
          received_by: user.id,
          status: allComplete ? 'complete' : 'partial'
        })
        .select()
        .single();

      if (grnError) throw grnError;

      // 2. Insert GRN Items
      const grnItemsPayload = receiveItems.map(item => ({
        grn_id: grn.id,
        ingredient_id: item.ingredient_id,
        ordered_quantity: item.ordered_quantity,
        received_quantity: item.received_quantity
      }));

      const { error: itemsError } = await supabase.from('grn_items').insert(grnItemsPayload);
      if (itemsError) throw itemsError;

      // 3. Update Inventory (Create Transactions)
      // Note: Triggers might handle this in a real app, but doing it manually as requested
      const transactions = receiveItems.map(item => ({
        ingredient_id: item.ingredient_id,
        transaction_type: 'purchase',
        quantity: item.received_quantity,
        reference_type: 'grn',
        reference_id: grn.id,
        performed_by: user.id
      }));

      const { error: transError } = await supabase.from('inventory_transactions').insert(transactions);
      if (transError) {
         // Fallback if transactions table isn't set up: try updating ingredients directly
         console.warn("Transaction log failed, updating ingredients directly", transError);
         for (const item of receiveItems) {
            await supabase.rpc('increment_stock', { 
               row_id: item.ingredient_id, 
               quantity: item.received_quantity 
            });
         }
      }

      // 4. Update PO Status
      const { error: poError } = await supabase
        .from('purchase_orders')
        .update({ 
          status: allComplete ? 'received' : 'partial_received',
          received_date: receivedDate
        })
        .eq('id', selectedPO.id);

      if (poError) throw poError;
    },
    onSuccess: () => {
      showToast(t('grn.success'), 'success');
      setIsModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ['pending-pos'] });
    },
    onError: (err: any) => showToast(err.message, 'error')
  });

  return (
    <DashboardLayout title={t('grn.title')} subtitle={t('grn.subtitle')}>
      <div className="space-y-6 animate-in fade-in duration-500">
        
        {/* Pending Deliveries Table */}
        <Card className="bg-[#1A1A1A] border-gray-800">
           <CardHeader>
              <CardTitle className="text-white flex items-center gap-2">
                 <Truck className="w-5 h-5 text-blue-500" /> {t('grn.pendingDeliveries')}
              </CardTitle>
           </CardHeader>
           <CardContent className="p-0 overflow-auto">
              <table className="w-full text-sm text-left">
                 <thead className="text-xs text-gray-500 uppercase bg-black/20 border-b border-gray-800">
                    <tr>
                       <th className="px-6 py-4">{t('grn.poNumber')}</th>
                       <th className="px-6 py-4">{t('stock.supplier')}</th>
                       <th className="px-6 py-4">{t('grn.expected')}</th>
                       <th className="px-6 py-4">{t('po.total')}</th>
                       <th className="px-6 py-4 text-right">{t('grn.action')}</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-800">
                    {isLoading && <tr><td colSpan={5} className="p-8 text-center text-gray-500">{t('common.loading')}</td></tr>}
                    {!isLoading && (!pendingPOs || pendingPOs.length === 0) && (
                       <tr><td colSpan={5} className="p-8 text-center text-gray-500">{t('grn.empty')}</td></tr>
                    )}
                    {pendingPOs?.map((po) => (
                       <tr key={po.id} className="hover:bg-white/5 transition-colors">
                          <td className="px-6 py-4 font-mono font-bold text-white">{po.po_number}</td>
                          <td className="px-6 py-4 text-gray-300">{po.supplier?.name}</td>
                          <td className="px-6 py-4 text-gray-400">{new Date(po.expected_delivery).toLocaleDateString()}</td>
                          <td className="px-6 py-4 text-primary font-mono">ETB {po.total_amount.toLocaleString()}</td>
                          <td className="px-6 py-4 text-right">
                             <Button size="sm" className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => openReceiveModal(po)}>
                                <PackageCheck className="w-4 h-4 mr-2" /> {t('grn.receive')}
                             </Button>
                          </td>
                       </tr>
                    ))}
                 </tbody>
              </table>
           </CardContent>
        </Card>

        {/* Receive Modal */}
        <Dialog isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('grn.receiveModalTitle')}>
           <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">
              
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-black/20 rounded-lg border border-gray-800">
                 <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">{t('grn.poNumber')}</p>
                    <p className="text-white font-mono font-bold">{selectedPO?.po_number}</p>
                 </div>
                 <div>
                    <p className="text-xs text-gray-500 uppercase font-bold">{t('stock.supplier')}</p>
                    <p className="text-white font-bold">{selectedPO?.supplier?.name}</p>
                 </div>
              </div>

              {/* Form Fields */}
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">{t('grn.receivedDate')}</label>
                    <div className="relative">
                       <Calendar className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                       <Input 
                          type="date" 
                          value={receivedDate}
                          onChange={(e) => setReceivedDate(e.target.value)}
                          className="pl-9 bg-black/20 border-gray-800"
                       />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <label className="text-xs font-bold text-gray-500 uppercase">{t('grn.invoiceNumber')}</label>
                    <div className="relative">
                       <FileText className="absolute left-3 top-3 h-4 w-4 text-gray-500" />
                       <Input 
                          value={invoiceNumber}
                          onChange={(e) => setInvoiceNumber(e.target.value)}
                          placeholder="e.g. INV-0092"
                          className="pl-9 bg-black/20 border-gray-800"
                       />
                    </div>
                 </div>
              </div>

              {/* Verification Table */}
              <div className="border border-gray-800 rounded-lg overflow-hidden">
                 <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 uppercase bg-black/40 border-b border-gray-800">
                       <tr>
                          <th className="px-4 py-3">{t('po.ingredient')}</th>
                          <th className="px-4 py-3 w-20">{t('grn.ordered')}</th>
                          <th className="px-4 py-3 w-24">{t('grn.received')}</th>
                          <th className="px-4 py-3 w-24 text-right">{t('grn.status')}</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                       {receiveItems.map((item) => {
                          const status = getMatchStatus(item.ordered_quantity, item.received_quantity);
                          return (
                             <tr key={item.id} className="bg-[#111]">
                                <td className="px-4 py-3">
                                   <p className="font-bold text-gray-200">{item.ingredient?.name}</p>
                                   <p className="text-xs text-gray-500">{item.ingredient?.unit_type}</p>
                                </td>
                                <td className="px-4 py-3 text-gray-400 font-mono">
                                   {item.ordered_quantity}
                                </td>
                                <td className="px-4 py-3">
                                   <Input 
                                      type="number" 
                                      className="h-8 w-20 bg-black/40 border-gray-700 text-center"
                                      value={item.received_quantity}
                                      onChange={(e) => updateReceivedQty(item.id, parseFloat(e.target.value) || 0)}
                                      min="0"
                                   />
                                </td>
                                <td className="px-4 py-3 text-right">
                                   <Badge className={cn("text-[10px]", status.color)}>
                                      {status.label}
                                   </Badge>
                                </td>
                             </tr>
                          );
                       })}
                    </tbody>
                 </table>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-2">
                 <Button variant="ghost" onClick={() => setIsModalOpen(false)} disabled={isPending}>{t('common.cancel')}</Button>
                 <Button 
                    className="bg-green-600 hover:bg-green-700 text-white font-bold"
                    onClick={() => confirmReceipt()}
                    disabled={isPending || !invoiceNumber}
                 >
                    {isPending ? t('common.loading') : (
                       <span className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4" /> {t('grn.confirm')}</span>
                    )}
                 </Button>
              </div>

           </div>
        </Dialog>

      </div>
    </DashboardLayout>
  );
};

export default ManagerReceiveGoods;
