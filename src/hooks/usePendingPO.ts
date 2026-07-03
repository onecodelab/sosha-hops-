
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { PurchaseOrder, POActivityLog, POStatus, POActionType } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useBranch } from '../contexts/BranchContext';
import { showToast } from '../components/ui';

export const usePendingPO = () => {
    const { user } = useAuth();
    const { activeBranchId } = useBranch();
    const queryClient = useQueryClient();

    // Fetch pending POs (pending_approval, needs_revision, approved but not sent)
    const { data: pendingPOs, isLoading } = useQuery({
        queryKey: ['pending-pos'],
        queryFn: async () => {
            if (!activeBranchId) return [];

            const { data, error } = await supabase
                .from('purchase_orders')
                .select(`
          *,
          supplier:suppliers(name),
          creator:profiles!created_by(full_name)
        `)
                .eq('branch_id', activeBranchId)
                .in('status', ['draft', 'pending_approval', 'pending', 'needs_revision', 'approved'])
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Pending PO fetch error:', error);
                showToast(`Failed to load POs: ${error.message}`, 'error');
                return [];
            }
            return data as PurchaseOrder[];
        }
    });

    // Fetch activity log for a specific PO
    const fetchActivityLog = async (poId: string): Promise<POActivityLog[]> => {
        const { data, error } = await supabase
            .from('po_activity_log')
            .select(`
        *,
        performer:profiles(full_name, role)
      `)
            .eq('po_id', poId)
            .order('created_at', { ascending: true });

        if (error) {
            console.error('Activity log fetch error:', error);
            return [];
        }
        return data as POActivityLog[];
    };

    // Log an action
    const logAction = async (poId: string, actionType: POActionType, notes?: string) => {
        if (!user) return;
        await supabase.from('po_activity_log').insert({
            po_id: poId,
            action_type: actionType,
            performed_by: user.id,
            notes
        });
    };

    // Update PO status
    const { mutateAsync: updateStatus } = useMutation({
        mutationFn: async ({ poId, status, notes }: { poId: string; status: POStatus; notes?: string }) => {
            const updateData: any = { status };

            if (status === 'approved' && user) {
                updateData.approved_by = user.id;
                updateData.approved_at = new Date().toISOString();
            }
            if (notes) {
                updateData.approval_notes = notes;
            }

            const { error } = await supabase
                .from('purchase_orders')
                .update(updateData)
                .eq('id', poId);

            if (error) throw error;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['pending-pos'] });
            queryClient.invalidateQueries({ queryKey: ['purchase-orders'] });
        }
    });

    // Approve PO
    const approvePO = async (poId: string, notes?: string) => {
        await updateStatus({ poId, status: 'approved', notes });
        await logAction(poId, 'approved', notes);
        showToast('PO Approved', 'success');
    };

    // Approve & Send
    const approveAndSendPO = async (poId: string, notes?: string) => {
        await updateStatus({ poId, status: 'sent', notes });
        await logAction(poId, 'approved', notes);
        await logAction(poId, 'sent', 'Auto-sent after approval');
        showToast('PO Approved & Sent to Supplier', 'success');
    };

    // Reject PO
    const rejectPO = async (poId: string, reason: string) => {
        await updateStatus({ poId, status: 'draft', notes: reason });
        await logAction(poId, 'rejected', reason);
        showToast('PO Rejected', 'success');
    };

    // Request Revision
    const requestRevision = async (poId: string, reason: string) => {
        await updateStatus({ poId, status: 'needs_revision', notes: reason });
        await logAction(poId, 'revision_requested', reason);
        showToast('Revision Requested', 'success');
    };

    // Withdraw PO (Manager)
    const withdrawPO = async (poId: string) => {
        await updateStatus({ poId, status: 'draft' });
        await logAction(poId, 'withdrawn');
        showToast('PO Withdrawn', 'success');
    };

    // Submit for Approval (Manager)
    const submitForApproval = async (poId: string, notes?: string) => {
        await updateStatus({ poId, status: 'pending_approval', notes });
        await logAction(poId, 'submitted', notes);
        showToast('Submitted for Owner Approval', 'success');
    };

    // Delete Draft (Manager)
    const deletePO = async (poId: string) => {
        const { error } = await supabase.from('purchase_orders').delete().eq('id', poId);
        if (error) {
            console.error('Delete error:', error);
            showToast('Failed to delete draft', 'error');
            return;
        }
        queryClient.invalidateQueries({ queryKey: ['pending-pos'] });
        showToast('Draft Deleted', 'success');
    };

    // Send approved PO
    const sendPO = async (poId: string) => {
        await updateStatus({ poId, status: 'sent' });
        await logAction(poId, 'sent');
        showToast('PO Sent to Supplier', 'success');
    };

    // Verify received PO (Manager)
    const verifyPO = async (poId: string) => {
        await updateStatus({ poId, status: 'verified' });
        await logAction(poId, 'received', 'Manager verified numbers and items match');
        showToast('PO Verified & Reconciled', 'success');
    };

    // Analyze Risk (Price/Qty spikes)
    const analyzeRisk = async (poId: string) => {
        const warnings: string[] = [];

        // Fetch current PO items
        const { data: currentItems } = await supabase
            .from('purchase_order_items')
            .select('*, ingredient:ingredients(name)')
            .eq('po_id', poId);

        if (!currentItems) return warnings;

        // Check each item against history
        for (const item of currentItems) {
            // Get last 3 approved PO items for this ingredient
            const { data: history } = await supabase
                .from('purchase_order_items')
                .select('unit_price, ordered_quantity, purchase_orders!inner(status, created_at)')
                .eq('ingredient_id', item.ingredient_id)
                .eq('purchase_orders.status', 'received') // Compare against actual received/approved
                .order('created_at', { foreignTable: 'purchase_orders', ascending: false })
                .limit(3);

            if (history && history.length > 0) {
                // Check Price
                const lastPrice = history[0].unit_price;
                if (item.unit_price > lastPrice) {
                    const diff = ((item.unit_price - lastPrice) / lastPrice * 100).toFixed(0);
                    warnings.push(`Price hike for ${item.ingredient?.name}: +${diff}% vs last order`);
                }

                // Check Quantity
                const avgQty = history.reduce((sum, h) => sum + h.ordered_quantity, 0) / history.length;
                if (item.ordered_quantity > avgQty * 2) {
                    warnings.push(`Unusual Qty for ${item.ingredient?.name}: ${item.ordered_quantity} (Avg: ${avgQty.toFixed(0)})`);
                }
            }
        }

        return warnings;
    };

    return {
        pendingPOs,
        isLoading,
        fetchActivityLog,
        approvePO,
        approveAndSendPO,
        rejectPO,
        requestRevision,
        withdrawPO,
        submitForApproval,
        deletePO,
        sendPO,
        verifyPO,
        logAction,
        analyzeRisk
    };
};
