
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PurchaseOrder, PurchaseOrderItem, POActivityLog } from '../types';
import { Card, CardContent, CardHeader, CardTitle, Button, Input, cn, showToast, Badge, Dialog } from './ui';
import { POApprovalBadge } from './POApprovalBadge';
import { POAuditTimeline } from './POAuditTimeline';
import { usePendingPO } from '../hooks/usePendingPO';
import { useRoleAccess } from '../hooks/useRoleAccess';
import { supabase } from '../supabase';
import {
    X, Truck, Calendar, DollarSign, User, FileText,
    CheckCircle, XCircle, Edit3, Send, AlertTriangle, Lock, Trash2
} from 'lucide-react';

interface PODetailViewProps {
    po: PurchaseOrder;
    isOpen: boolean;
    onClose: () => void;
}

export const PODetailView: React.FC<PODetailViewProps> = ({ po, isOpen, onClose }) => {
    const navigate = useNavigate();
    const { isOwnerOrAdmin } = useRoleAccess();
    const {
        approvePO, approveAndSendPO, rejectPO, requestRevision,
        withdrawPO, sendPO, fetchActivityLog, deletePO, submitForApproval, analyzeRisk
    } = usePendingPO();

    const [items, setItems] = useState<PurchaseOrderItem[]>([]);
    const [activityLog, setActivityLog] = useState<POActivityLog[]>([]);
    const [dynamicRisks, setDynamicRisks] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [actionNotes, setActionNotes] = useState('');
    const [showRejectDialog, setShowRejectDialog] = useState(false);
    const [showRevisionDialog, setShowRevisionDialog] = useState(false);

    useEffect(() => {
        if (isOpen && po) {
            loadDetails();
        }
    }, [isOpen, po?.id]);

    const loadDetails = async () => {
        setLoading(true);
        try {
            // Fetch PO Items
            const { data: itemsData } = await supabase
                .from('purchase_order_items')
                .select(`*, ingredient:ingredients(name, unit_type)`)
                .eq('po_id', po.id);
            setItems(itemsData || []);

            // Fetch Activity Log
            const logs = await fetchActivityLog(po.id);
            setActivityLog(logs);

            // Analyze Risks (Smart Warnings)
            const risks = await analyzeRisk(po.id);
            setDynamicRisks(risks);

        } catch (err) {
            console.error('Load details error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleApprove = async () => {
        await approvePO(po.id, actionNotes || undefined);
        onClose();
    };

    const handleApproveAndSend = async () => {
        await approveAndSendPO(po.id, actionNotes || undefined);
        onClose();
    };

    const handleReject = async () => {
        if (!actionNotes.trim()) {
            showToast('Rejection reason is required', 'error');
            return;
        }
        await rejectPO(po.id, actionNotes);
        setShowRejectDialog(false);
        onClose();
    };

    const handleRequestRevision = async () => {
        if (!actionNotes.trim()) {
            showToast('Please specify what needs to be changed', 'error');
            return;
        }
        await requestRevision(po.id, actionNotes);
        setShowRevisionDialog(false);
        onClose();
    };

    const handleWithdraw = async () => {
        if (confirm('Withdraw this PO? It will return to draft status.')) {
            await withdrawPO(po.id);
            onClose();
        }
    };

    const handleSend = async () => {
        await sendPO(po.id);
        onClose();
    };

    const canManagerEdit = !isOwnerOrAdmin && po.status === 'needs_revision';
    const canOwnerAct = isOwnerOrAdmin && ['pending', 'pending_approval', 'needs_revision'].includes(po.status);
    const canSend = isOwnerOrAdmin && po.status === 'approved';
    const canWithdraw = !isOwnerOrAdmin && ['pending', 'pending_approval', 'needs_revision'].includes(po.status);

    // Risk warnings
    const riskWarnings: string[] = [];
    if (po.total_amount > 50000) riskWarnings.push('High value order (> 50k ETB)');
    if (po.risk_flags && po.risk_flags.length > 0) riskWarnings.push(...po.risk_flags);
    riskWarnings.push(...dynamicRisks);

    return (
        <Dialog isOpen={isOpen} onClose={onClose} title={`PO Details: ${po.po_number}`}>
            <div className="space-y-6 max-h-[80vh] overflow-y-auto pr-2 custom-scrollbar">

                {/* Header Info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-1">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Status</p>
                        <POApprovalBadge status={po.status} />
                    </div>
                    <div className="space-y-1">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                            <Truck className="w-3 h-3" /> Supplier
                        </p>
                        <p className="text-sm font-bold text-white">{po.supplier?.name || 'Unknown'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                            <User className="w-3 h-3" /> Created By
                        </p>
                        <p className="text-sm font-medium text-gray-300">{po.creator?.full_name || 'Unknown'}</p>
                    </div>
                    <div className="space-y-1">
                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Expected Delivery
                        </p>
                        <p className="text-sm font-medium text-gray-300">{new Date(po.expected_delivery).toLocaleDateString()}</p>
                    </div>
                </div>

                {/* Risk Warnings */}
                {riskWarnings.length > 0 && (
                    <div className="p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl space-y-2">
                        <p className="text-xs font-black text-orange-500 uppercase flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4" /> Risk Warnings
                        </p>
                        <ul className="space-y-1">
                            {riskWarnings.map((warning, i) => (
                                <li key={i} className="text-sm text-orange-400">• {warning}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Items Table */}
                <Card className="bg-black/40 border-white/10">
                    <CardHeader className="py-3 border-b border-white/10">
                        <CardTitle className="text-sm font-bold text-white flex items-center gap-2">
                            <FileText className="w-4 h-4 text-primary" /> Order Items
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                        <table className="w-full text-sm">
                            <thead className="bg-black/40 text-[10px] text-gray-500 uppercase">
                                <tr>
                                    <th className="px-4 py-3 text-left">Item</th>
                                    <th className="px-4 py-3 text-center">Qty</th>
                                    <th className="px-4 py-3 text-right">Unit Price</th>
                                    <th className="px-4 py-3 text-right">Subtotal</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {items.map(item => (
                                    <tr key={item.id} className="hover:bg-white/5">
                                        <td className="px-4 py-3 font-medium text-white">{item.ingredient?.name || 'Unknown'}</td>
                                        <td className="px-4 py-3 text-center text-gray-300">
                                            {item.ordered_quantity} {item.ingredient?.unit_type}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-400 font-mono">
                                            ETB {item.unit_price?.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-white font-mono font-bold">
                                            ETB {(item.ordered_quantity * (item.unit_price || 0)).toLocaleString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                            <tfoot className="bg-primary/10 border-t border-primary/20">
                                <tr>
                                    <td colSpan={3} className="px-4 py-4 text-right font-black text-primary uppercase text-xs">
                                        Total Amount
                                    </td>
                                    <td className="px-4 py-4 text-right font-black text-primary text-lg font-mono">
                                        ETB {po.total_amount.toLocaleString()}
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </CardContent>
                </Card>

                {/* Activity Timeline */}
                <Card className="bg-black/40 border-white/10">
                    <CardHeader className="py-3 border-b border-white/10">
                        <CardTitle className="text-sm font-bold text-white">Activity Trail</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4">
                        <POAuditTimeline logs={activityLog} />
                    </CardContent>
                </Card>

                {/* Notes Input */}
                {(canOwnerAct || canManagerEdit) && (
                    <div className="space-y-2">
                        <label className="text-xs font-bold text-gray-500 uppercase">Add Notes (Optional)</label>
                        <Input
                            placeholder="Enter notes for this action..."
                            value={actionNotes}
                            onChange={(e) => setActionNotes(e.target.value)}
                            className="bg-black/40 border-white/10"
                        />
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-3 pt-4 border-t border-white/10">
                    {/* Draft Actions (Manager) */}
                    {po.status === 'draft' && !isOwnerOrAdmin && (
                        <>
                            <Button
                                onClick={async () => {
                                    await submitForApproval(po.id);
                                    onClose();
                                }}
                                className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold flex-1"
                            >
                                <Send className="w-4 h-4 mr-2" /> Submit for Approval
                            </Button>
                            <Button
                                onClick={() => {
                                    onClose();
                                    // Merge fetched items into the PO object before navigating
                                    const poWithItems = { ...po, items };
                                    setTimeout(() => navigate('/manager/create-po', { state: { editPO: poWithItems } }), 100);
                                }}
                                variant="secondary"
                                className="bg-white/10 text-white hover:bg-white/20 flex-1"
                            >
                                <Edit3 className="w-4 h-4 mr-2" /> Edit Draft
                            </Button>
                            <Button
                                onClick={async () => {
                                    if (confirm('Are you sure you want to delete this draft?')) {
                                        await deletePO(po.id);
                                        onClose();
                                    }
                                }}
                                variant="ghost"
                                className="text-red-500 hover:text-red-400 hover:bg-red-500/10"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </>
                    )}

                    {/* Owner Actions */}
                    {canOwnerAct && (
                        <>
                            <Button
                                onClick={handleApproveAndSend}
                                className="bg-green-600 hover:bg-green-700 text-white font-bold flex-1"
                            >
                                <CheckCircle className="w-4 h-4 mr-2" /> Approve & Send
                            </Button>
                            <Button
                                onClick={handleApprove}
                                variant="outline"
                                className="border-green-500/50 text-green-500 hover:bg-green-500/10"
                            >
                                <Lock className="w-4 h-4 mr-2" /> Approve (Hold)
                            </Button>
                            <Button
                                onClick={() => setShowRevisionDialog(true)}
                                variant="outline"
                                className="border-orange-500/50 text-orange-500 hover:bg-orange-500/10"
                            >
                                <Edit3 className="w-4 h-4 mr-2" /> Request Changes
                            </Button>
                            <Button
                                onClick={() => setShowRejectDialog(true)}
                                variant="outline"
                                className="border-red-500/50 text-red-500 hover:bg-red-500/10"
                            >
                                <XCircle className="w-4 h-4 mr-2" /> Reject
                            </Button>
                        </>
                    )}

                    {/* Send button for approved POs */}
                    {canSend && (
                        <Button
                            onClick={handleSend}
                            className="bg-blue-600 hover:bg-blue-700 text-white font-bold flex-1"
                        >
                            <Send className="w-4 h-4 mr-2" /> Send to Supplier
                        </Button>
                    )}

                    {/* Manager Withdraw */}
                    {canWithdraw && (
                        <Button
                            onClick={handleWithdraw}
                            variant="outline"
                            className="border-gray-500/50 text-gray-400 hover:bg-gray-500/10"
                        >
                            Withdraw PO
                        </Button>
                    )}

                    {/* Manager Edit (Needs Revision) */}
                    {canManagerEdit && (
                        <Button
                            onClick={() => {
                                onClose();
                                const poWithItems = { ...po, items };
                                setTimeout(() => navigate('/manager/create-po', { state: { editPO: poWithItems } }), 100);
                            }}
                            className="bg-yellow-600 hover:bg-yellow-700 text-white font-bold flex-1"
                        >
                            <Edit3 className="w-4 h-4 mr-2" /> Edit & Resubmit
                        </Button>
                    )}

                    <Button variant="ghost" onClick={onClose} className="text-gray-500">
                        Close
                    </Button>
                </div>
            </div>

            {/* Reject Dialog */}
            <Dialog isOpen={showRejectDialog} onClose={() => setShowRejectDialog(false)} title="Reject PO">
                <div className="space-y-4">
                    <p className="text-sm text-gray-400">Please provide a reason for rejection:</p>
                    <Input
                        placeholder="Rejection reason (required)"
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        className="bg-black/40 border-white/10"
                    />
                    <div className="flex gap-3">
                        <Button onClick={handleReject} className="bg-red-600 hover:bg-red-700 text-white flex-1">
                            Confirm Rejection
                        </Button>
                        <Button variant="ghost" onClick={() => setShowRejectDialog(false)}>Cancel</Button>
                    </div>
                </div>
            </Dialog>

            {/* Revision Dialog */}
            <Dialog isOpen={showRevisionDialog} onClose={() => setShowRevisionDialog(false)} title="Request Changes">
                <div className="space-y-4">
                    <p className="text-sm text-gray-400">What changes are needed?</p>
                    <Input
                        placeholder="Specify required changes..."
                        value={actionNotes}
                        onChange={(e) => setActionNotes(e.target.value)}
                        className="bg-black/40 border-white/10"
                    />
                    <div className="flex gap-3">
                        <Button onClick={handleRequestRevision} className="bg-orange-600 hover:bg-orange-700 text-white flex-1">
                            Request Revision
                        </Button>
                        <Button variant="ghost" onClick={() => setShowRevisionDialog(false)}>Cancel</Button>
                    </div>
                </div>
            </Dialog>
        </Dialog>
    );
};
