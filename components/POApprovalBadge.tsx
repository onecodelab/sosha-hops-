
import React from 'react';
import { Badge, cn } from './ui';
import { Clock, CheckCircle, XCircle, Edit3, Send, AlertTriangle, Package } from 'lucide-react';
import { POStatus } from '../types';

interface POApprovalBadgeProps {
    status: POStatus;
    className?: string;
}

const statusConfig: Record<POStatus, { label: string; icon: React.ElementType; className: string }> = {
    draft: {
        label: 'Draft',
        icon: Edit3,
        className: 'bg-gray-500/10 text-gray-400 border-gray-500/20'
    },
    pending: {
        label: 'Pending Approval',
        icon: Clock,
        className: 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20 animate-pulse'
    },
    needs_revision: {
        label: 'Needs Revision',
        icon: AlertTriangle,
        className: 'bg-orange-500/10 text-orange-500 border-orange-500/20'
    },
    approved: {
        label: 'Approved',
        icon: CheckCircle,
        className: 'bg-green-500/10 text-green-500 border-green-500/20'
    },
    sent: {
        label: 'Sent to Supplier',
        icon: Send,
        className: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    },
    partial_received: {
        label: 'Partially Received',
        icon: Package,
        className: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    },
    received: {
        label: 'Received',
        icon: CheckCircle,
        className: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
    }
};

export const POApprovalBadge: React.FC<POApprovalBadgeProps> = ({ status, className }) => {
    const config = statusConfig[status] || statusConfig.draft;
    const Icon = config.icon;

    return (
        <Badge className={cn("flex items-center gap-1.5 px-2.5 py-1 font-bold text-[10px] uppercase tracking-wider border", config.className, className)}>
            <Icon className="w-3 h-3" />
            {config.label}
        </Badge>
    );
};
