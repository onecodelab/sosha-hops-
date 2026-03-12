import React, { useEffect, useState } from 'react';
import { Dialog, Button, cn } from './ui';
import { Order } from '../types';
import { supabase } from '../supabase';
import { Printer, X } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../AuthContext';
import { QRCodeSVG } from 'qrcode.react';
import { buildMerchantQR, BANK_EMV_CONFIG } from '../lib/emvqr';

interface OrderDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: Order | null;
}

const DASHED = '- - - - - - - - - - - - - - - - - - - - - - - -';
const SOLID = '————————————————————————————';

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ isOpen, onClose, order }) => {
    const { user, profile } = useAuth();
    const [customerName, setCustomerName] = useState<string>('Walk-in');
    const [selectedPayBank, setSelectedPayBank] = useState(0);

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

    // Fetch active bank settings for payment QR
    const { data: activeBanks = [] } = useQuery({
        queryKey: ['bank_settings_active_odm', profile?.organization_id],
        queryFn: async () => {
            if (!profile?.organization_id) return [];
            const { data } = await supabase
                .from('bank_settings')
                .select('*')
                .eq('organization_id', profile.organization_id)
                .eq('is_active', true);
            return (data || []).filter((b: any) => b.account_number && b.account_number.trim() !== '');
        },
        enabled: !!profile?.organization_id,
    });

    useEffect(() => {
        if (!order || !isOpen) return;
        // Try to get customer name from order_payments reference or verification
        const fetchCustomerInfo = async () => {
            const { data } = await supabase
                .from('order_payments')
                .select('payment_method, reference')
                .eq('order_id', order.id)
                .order('created_at', { ascending: false })
                .limit(1);
            if (data && data.length > 0 && data[0].reference) {
                // If we have a reference, the customer used digital payment
                setCustomerName(data[0].reference ? 'Verified Payer' : 'Walk-in');
            } else {
                setCustomerName('Walk-in');
            }
        };
        fetchCustomerInfo();
    }, [order, isOpen]);

    if (!order) return null;

    const subtotal = order.subtotal_amount || parseFloat((order.total_amount / 1.15).toFixed(2));
    const vat = order.vat_amount || parseFloat((order.total_amount - subtotal).toFixed(2));
    const total = order.total_amount || 0;
    const tip = order.tip_amount || 0;
    const itemCount = order.order_items?.reduce((sum, item: any) => sum + (item.quantity || 1), 0) || 0;

    const orderDate = new Date(order.created_at);
    const dateStr = orderDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' });
    const timeStr = orderDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    const getPaymentLabel = (method: string) => {
        const map: Record<string, string> = {
            cash: 'Cash', cbe: 'CBE Transfer', telebirr: 'Telebirr',
            abyssinia: 'Bank of Abyssinia', dashen: 'Dashen Bank',
            cbebirr: 'CBE Birr'
        };
        return map[method] || method || 'Cash';
    };

    const handlePrint = () => {
        window.print();
    };

    return (
        <Dialog isOpen={isOpen} onClose={onClose} title="" maxWidth="max-w-sm">
            <div className="flex flex-col">
                {/* Receipt Paper */}
                <div
                    id="receipt-content"
                    className="bg-white text-black font-mono text-[11px] leading-relaxed p-5 rounded-lg shadow-inner mx-auto w-full max-w-[320px]"
                    style={{ fontFamily: "'Courier New', Courier, monospace" }}
                >
                    {/* TIN */}
                    <div className="text-center mb-1">
                        <p className="text-[10px] tracking-wider">TIN: 0043819230</p>
                    </div>

                    <p className="text-center text-[9px] text-gray-400 mb-1">{DASHED}</p>

                    {/* Business Name */}
                    <div className="text-center mb-1">
                        <h3 className="font-black text-sm uppercase tracking-tight leading-tight">
                            {restaurantName}
                        </h3>
                        <p className="text-[9px] text-gray-600 leading-tight font-mono">Location: {locationName}</p>
                    </div>

                    {/* FS No & Date */}
                    <div className="flex justify-between text-[9px] text-gray-600 mt-1">
                        <span>FS No.{order.order_number || order.id.slice(0, 7)}</span>
                        <span>{dateStr}</span>
                        <span>{timeStr}</span>
                    </div>

                    <p className="text-center text-[9px] text-gray-400 my-1">{DASHED}</p>

                    {/* Invoice Type */}
                    <div className="text-center mb-2">
                        <p className="font-black text-xs uppercase tracking-widest">
                            {order.payment_method === 'cash' ? 'CASH INVOICE' : 'BANK INVOICE'}
                        </p>
                    </div>

                    {/* Customer / Invoice / Operator */}
                    <div className="space-y-0.5 text-[10px] mb-2">
                        <p>Customer: <span className="font-bold uppercase">{customerName}</span></p>
                        <p>Invoice: <span className="font-bold">ORD-{order.order_number || order.id.slice(0, 8)}</span></p>
                        <p>Operator: <span className="font-bold uppercase">{order.waiter?.full_name || profile?.full_name || user?.user_metadata?.full_name || 'Staff'}</span></p>
                        <p>Table: <span className="font-bold">T-{order.table_number || 'N/A'}</span></p>
                    </div>

                    <p className="text-center text-[9px] text-gray-400 my-1">{DASHED}</p>

                    {/* Items Header */}
                    <div className="flex text-[9px] font-black uppercase tracking-wider text-gray-500 mb-1">
                        <span className="flex-1">Description</span>
                        <span className="w-8 text-center">Qty</span>
                        <span className="w-16 text-right">Price</span>
                        <span className="w-20 text-right">Amount</span>
                    </div>

                    {/* Items */}
                    <div className="space-y-1 mb-2">
                        {order.order_items?.map((item: any, i: number) => {
                            const lineTotal = (item.price || 0) * (item.quantity || 1);
                            return (
                                <div key={i} className="flex text-[10px]">
                                    <span className="flex-1 truncate pr-1 uppercase">{item.menu_item?.name || 'Item'}</span>
                                    <span className="w-8 text-center">{item.quantity}</span>
                                    <span className="w-16 text-right">{(item.price || 0).toLocaleString()}</span>
                                    <span className="w-20 text-right font-bold">{lineTotal.toLocaleString()}</span>
                                </div>
                            );
                        })}
                    </div>

                    <p className="text-center text-[9px] text-gray-400 my-1">{DASHED}</p>

                    {/* Tax Breakdown */}
                    <div className="space-y-1 text-[10px]">
                        <div className="flex justify-between">
                            <span>TXBL 1</span>
                            <span className="font-bold">*{subtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="flex justify-between">
                            <span>TAX1 15%</span>
                            <span className="font-bold">*{vat.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    </div>

                    <p className="text-center text-[9px] text-gray-400 my-2">{DASHED}</p>

                    {/* TOTAL */}
                    <div className="flex justify-between text-sm font-black">
                        <span>TOTAL</span>
                        <span>*{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>

                    <p className="text-center text-[9px] text-gray-400 my-2">{DASHED}</p>

                    {/* Payment Method */}
                    <div className="flex justify-between text-[11px] font-bold">
                        <span>{getPaymentLabel(order.payment_method || 'cash')}</span>
                        <span>*{total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                    </div>

                    {/* Tip (if any) */}
                    {tip > 0 && (
                        <div className="flex justify-between text-[10px] text-gray-600 mt-1">
                            <span>Tip (Gratuity)</span>
                            <span className="font-bold">+{tip.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                    )}

                    {/* Item Count */}
                    <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                        <span>ITEM#</span>
                        <span className="font-bold">{itemCount}</span>
                    </div>

                    <p className="text-center text-[9px] text-gray-400 my-2">{DASHED}</p>

                    {/* ERCA & Payment QR Footer */}
                    <div className="mt-4 flex flex-col items-center">
                        <div className="flex items-start justify-center gap-4">
                            {/* ERCA Fiscal QR */}
                            <div className="text-center flex flex-col items-center">
                                <QRCodeSVG
                                    value={`TIN:0043819230|INV:ORD-${order.order_number || order.id.slice(0, 8)}|DATE:${new Date(order.created_at).toISOString()}|TOTAL:${total}|VAT:${vat}`}
                                    size={60}
                                    level="M"
                                    className="mb-1"
                                />
                                <span className="font-black text-[9px] tracking-wide">ERCA</span>
                            </div>

                            {/* Payment QR (per bank) */}
                            {activeBanks.length > 0 && (
                                <div className="text-center flex flex-col items-center">
                                    <QRCodeSVG
                                        value={buildMerchantQR({
                                            bankKey: activeBanks[selectedPayBank]?.bank_key,
                                            accountNumber: activeBanks[selectedPayBank]?.account_number,
                                            merchantName: restaurantName,
                                            amount: total,
                                        })}
                                        size={60}
                                        level="M"
                                        className="mb-1"
                                    />
                                    {/* Bank Tabs */}
                                    <div className="flex gap-1 mt-1">
                                        {activeBanks.map((b: any, i: number) => {
                                            const emvCfg = BANK_EMV_CONFIG[b.bank_key];
                                            return (
                                                <button key={b.id}
                                                    onClick={() => setSelectedPayBank(i)}
                                                    className={cn(
                                                        "px-1.5 py-0.5 rounded text-[7px] font-black uppercase transition-all",
                                                        i === selectedPayBank
                                                            ? "bg-black text-white"
                                                            : "bg-gray-200 text-gray-500 hover:bg-gray-300"
                                                    )}
                                                >
                                                    {emvCfg?.label || b.bank_key}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                        <p className="text-[9px] text-gray-500 font-mono mt-2">FG{order.id.slice(0, 8).toUpperCase()}</p>
                        <p className="text-[9px] text-gray-400 mt-1 tracking-wider">Powered by Baro OS</p>
                    </div>
                </div>

                {/* Action Buttons (not printed) */}
                <div className="flex gap-3 mt-4 px-2 print:hidden">
                    <Button
                        onClick={handlePrint}
                        variant="outline"
                        className="flex-1 border-white/10 bg-white/5 h-11 rounded-xl font-black uppercase tracking-widest hover:bg-white/10 text-xs"
                    >
                        <Printer className="w-4 h-4 mr-2" /> Print
                    </Button>
                    <Button
                        onClick={onClose}
                        variant="outline"
                        className="flex-1 border-white/10 bg-white/5 h-11 rounded-xl font-black uppercase tracking-widest hover:bg-white/10 text-xs"
                    >
                        Close
                    </Button>
                </div>
            </div>
        </Dialog>
    );
};
