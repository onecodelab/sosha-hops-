
import React from 'react';
import { POActivityLog, POActionType } from '../types';
import {
    PlusCircle, Send, CheckCircle, XCircle, Edit3,
    ArrowLeft, Truck, Package, MessageSquare
} from 'lucide-react';
import { cn } from './ui';

interface POAuditTimelineProps {
    logs: POActivityLog[];
    className?: string;
}

const actionConfig: Record<POActionType, { label: string; icon: React.ElementType; color: string }> = {
    created: { label: 'PO Created', icon: PlusCircle, color: 'text-blue-400' },
    submitted: { label: 'Submitted for Approval', icon: Send, color: 'text-yellow-500' },
    approved: { label: 'Approved by Owner', icon: CheckCircle, color: 'text-green-500' },
    rejected: { label: 'Rejected by Owner', icon: XCircle, color: 'text-red-500' },
    revision_requested: { label: 'Changes Requested', icon: Edit3, color: 'text-orange-500' },
    sent: { label: 'Sent to Supplier', icon: Truck, color: 'text-blue-500' },
    withdrawn: { label: 'Withdrawn by Manager', icon: ArrowLeft, color: 'text-gray-400' },
    edited: { label: 'Edited', icon: Edit3, color: 'text-gray-500' },
    received: { label: 'Goods Received', icon: Package, color: 'text-emerald-500' }
};

export const POAuditTimeline: React.FC<POAuditTimelineProps> = ({ logs, className }) => {
    if (!logs || logs.length === 0) {
        return (
            <div className={cn("text-center py-8 text-gray-500 text-sm", className)}>
                No activity recorded yet.
            </div>
        );
    }

    return (
        <div className={cn("space-y-0", className)}>
            {logs.map((log, index) => {
                const config = actionConfig[log.action_type] || actionConfig.created;
                const Icon = config.icon;
                const isLast = index === logs.length - 1;

                return (
                    <div key={log.id} className="flex gap-4">
                        {/* Timeline Line & Icon */}
                        <div className="flex flex-col items-center">
                            <div className={cn("w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center", config.color)}>
                                <Icon className="w-4 h-4" />
                            </div>
                            {!isLast && <div className="w-px h-full bg-white/10 min-h-[40px]" />}
                        </div>

                        {/* Content */}
                        <div className="pb-6 flex-1">
                            <p className={cn("font-bold text-sm", config.color)}>{config.label}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                                {log.performer?.full_name || 'System'} • {new Date(log.created_at).toLocaleString()}
                            </p>
                            {log.notes && (
                                <div className="mt-2 p-3 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300 flex items-start gap-2">
                                    <MessageSquare className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
                                    <span>{log.notes}</span>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })}
        </div>
    );
};
