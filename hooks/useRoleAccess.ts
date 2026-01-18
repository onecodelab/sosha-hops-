import { useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { Role } from '../types';

/** Permission configuration for each role */
const ROLE_PERMISSIONS = {
    owner: {
        canViewInventoryCost: true,
        canViewInventoryStock: true,
        canEditMenuPrices: true,
        canViewFinancials: true,
        canApproveVoids: true,
        canEditPayRates: true,
        canViewAuditLogs: true,
        canViewSettings: true,
        canViewAnalytics: true,
    },
    admin: {
        canViewInventoryCost: true,
        canViewInventoryStock: true,
        canEditMenuPrices: true,
        canViewFinancials: true,
        canApproveVoids: true,
        canEditPayRates: true,
        canViewAuditLogs: true,
        canViewSettings: true,
        canViewAnalytics: true,
    },
    manager: {
        canViewInventoryCost: false,
        canViewInventoryStock: true,
        canEditMenuPrices: false,
        canViewFinancials: true,
        canApproveVoids: true,
        canEditPayRates: false,
        canViewAuditLogs: false,
        canViewSettings: true,
        canViewAnalytics: true,
    },
    waiter: {
        canViewInventoryCost: false,
        canViewInventoryStock: false,
        canEditMenuPrices: false,
        canViewFinancials: false,
        canApproveVoids: false,
        canEditPayRates: false,
        canViewAuditLogs: false,
        canViewSettings: false,
        canViewAnalytics: false,
    },
    kitchen: {
        canViewInventoryCost: false,
        canViewInventoryStock: true,
        canEditMenuPrices: false,
        canViewFinancials: false,
        canApproveVoids: false,
        canEditPayRates: false,
        canViewAuditLogs: false,
        canViewSettings: false,
        canViewAnalytics: false,
    },
} as const;

export type Permission = keyof typeof ROLE_PERMISSIONS.owner;

export const useRoleAccess = () => {
    const { profile } = useAuth();

    const permissions = useMemo(() => {
        const userRole = (profile?.role?.toLowerCase().trim() || 'waiter') as Role;
        return ROLE_PERMISSIONS[userRole] || ROLE_PERMISSIONS.waiter;
    }, [profile?.role]);

    const hasRole = (roles: Role[]): boolean => {
        if (!profile) return false;
        const userRole = profile.role?.toLowerCase().trim() as Role;
        return roles.some(r => r.toLowerCase().trim() === userRole);
    };

    const hasPermission = (permission: Permission): boolean => {
        return permissions[permission] ?? false;
    };

    return {
        role: profile?.role as Role | undefined,
        permissions,
        hasRole,
        hasPermission,
        isOwnerOrAdmin: hasRole(['owner', 'admin']),
        isManager: hasRole(['manager']),
        isWaiter: hasRole(['waiter']),
        isKitchen: hasRole(['kitchen']),
    };
};
