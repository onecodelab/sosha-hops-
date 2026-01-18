import React from 'react';
import { useAuth } from '../AuthContext';
import { Role } from '../types';

interface RoleGuardProps {
    /** Roles that are allowed to see the children */
    allowedRoles: Role[];
    /** Content to render if user has permission */
    children: React.ReactNode;
    /** Optional fallback content for unauthorized users */
    fallback?: React.ReactNode;
    /** If true, hides element entirely instead of showing fallback */
    hideOnly?: boolean;
}

/**
 * RoleGuard - Conditionally renders children based on user role
 * 
 * @example
 * // Hide "Edit Price" button from waiters
 * <RoleGuard allowedRoles={['owner', 'admin']} hideOnly>
 *   <Button onClick={handleEditPrice}>Edit Price</Button>
 * </RoleGuard>
 * 
 * @example
 * // Show different content per role
 * <RoleGuard allowedRoles={['manager', 'owner']} fallback={<p>View Only</p>}>
 *   <Button onClick={handleApprove}>Approve Void</Button>
 * </RoleGuard>
 */
export const RoleGuard: React.FC<RoleGuardProps> = ({
    allowedRoles,
    children,
    fallback = null,
    hideOnly = false,
}) => {
    const { profile } = useAuth();

    if (!profile) return null;

    const userRole = profile.role?.toLowerCase().trim() as Role;
    const isAllowed = allowedRoles.some(
        r => r.toLowerCase().trim() === userRole
    );

    if (isAllowed) {
        return <>{children}</>;
    }

    if (hideOnly) {
        return null;
    }

    return <>{fallback}</>;
};

export default RoleGuard;
