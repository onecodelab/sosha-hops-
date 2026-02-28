import { useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { Role } from '../types';

/** Permission configuration for all 8 roles */
const ROLE_PERMISSIONS = {
    super_admin: {
        canViewAllOrgs: true,
        canManageRestaurants: true,
        canViewOwnOrgData: true,
        canManageStaff: false,
        canManageMenu: false,
        canManageOrders: false,
        canViewPurchaseOrders: false,
        canUpdatePOStatus: false,
        canViewApplications: true,
        // Legacy permissions (kept for backward compat)
        canViewInventoryCost: false,
        canViewInventoryStock: false,
        canEditMenuPrices: false,
        canViewFinancials: false,
        canApproveVoids: false,
        canEditPayRates: false,
        canViewAuditLogs: true,
        canViewSettings: false,
        canViewAnalytics: false,
    },
    owner: {
        canViewAllOrgs: false,
        canManageRestaurants: false,
        canViewOwnOrgData: true,
        canManageStaff: true,
        canManageMenu: true,
        canManageOrders: true,
        canViewPurchaseOrders: true,
        canUpdatePOStatus: false,
        canViewApplications: false,
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
        canViewAllOrgs: false,
        canManageRestaurants: false,
        canViewOwnOrgData: true,
        canManageStaff: true,
        canManageMenu: true,
        canManageOrders: true,
        canViewPurchaseOrders: true,
        canUpdatePOStatus: false,
        canViewApplications: false,
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
        canViewAllOrgs: false,
        canManageRestaurants: false,
        canViewOwnOrgData: true,
        canManageStaff: false,
        canManageMenu: true,
        canManageOrders: true,
        canViewPurchaseOrders: true,
        canUpdatePOStatus: false,
        canViewApplications: false,
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
        canViewAllOrgs: false,
        canManageRestaurants: false,
        canViewOwnOrgData: true,
        canManageStaff: false,
        canManageMenu: false,
        canManageOrders: true,
        canViewPurchaseOrders: false,
        canUpdatePOStatus: false,
        canViewApplications: false,
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
        canViewAllOrgs: false,
        canManageRestaurants: false,
        canViewOwnOrgData: true,
        canManageStaff: false,
        canManageMenu: false,
        canManageOrders: true,
        canViewPurchaseOrders: false,
        canUpdatePOStatus: false,
        canViewApplications: false,
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
    supplier: {
        canViewAllOrgs: false,
        canManageRestaurants: false,
        canViewOwnOrgData: false,
        canManageStaff: false,
        canManageMenu: false,
        canManageOrders: false,
        canViewPurchaseOrders: true,
        canUpdatePOStatus: true,
        canViewApplications: false,
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
    driver: {
        canViewAllOrgs: false,
        canManageRestaurants: false,
        canViewOwnOrgData: false,
        canManageStaff: false,
        canManageMenu: false,
        canManageOrders: false,
        canViewPurchaseOrders: false,
        canUpdatePOStatus: false,
        canViewApplications: false,
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
        isSuperAdmin: hasRole(['super_admin']),
        isSupplier: hasRole(['supplier']),
        isDriver: hasRole(['driver']),
    };
};
