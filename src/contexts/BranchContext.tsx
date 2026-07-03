
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Branch } from '@/types';
import { supabase } from '@/lib/supabase';
import { useQuery } from '@tanstack/react-query';

interface BranchContextType {
    activeBranchId: string | null;
    activeBranch: Branch | null;
    branches: Branch[];
    isLoading: boolean;
    switchBranch: (branchId: string) => void;
}

const BranchContext = createContext<BranchContextType>({
    activeBranchId: null,
    activeBranch: null,
    branches: [],
    isLoading: true,
    switchBranch: () => { },
});

export const useBranch = () => useContext(BranchContext);

export const BranchProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { profile } = useAuth();
    const [activeBranchId, setActiveBranchId] = useState<string | null>(() => {
        return localStorage.getItem('baro-active-branch-id');
    });

    // Fetch all branches (for HQ users or to resolve the active branch)
    const { data: rawBranches = [], isLoading } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('branches')
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: true }); // Ensure main branch comes first

            if (error) throw error;

            // Deduplicate by name if multiple "Main Branch" or other duplicates exist
            const uniqueBranches: Branch[] = [];
            const names = new Set();
            (data || []).forEach(branch => {
                const lowerName = branch.name.toLowerCase();
                if (!names.has(lowerName)) {
                    names.add(lowerName);
                    uniqueBranches.push(branch as Branch);
                }
            });

            return uniqueBranches;
        },
        enabled: !!profile,
    });

    const branches = rawBranches;

    // Handle initial branch assignment
    useEffect(() => {
        if (!isLoading && branches.length > 0) {
            // Priority 1: Already selected (from state or localStorage init)
            if (activeBranchId && branches.some(b => b.id === activeBranchId)) {
                return;
            }

            // Priority 2: Profile's home branch
            if (profile?.home_branch_id) {
                setActiveBranchId(profile.home_branch_id);
                localStorage.setItem('baro-active-branch-id', profile.home_branch_id);
            }
            // Priority 3: First available branch
            else if (!activeBranchId) {
                setActiveBranchId(branches[0].id);
                localStorage.setItem('baro-active-branch-id', branches[0].id);
            }
        }
    }, [profile, branches, isLoading]);

    const switchBranch = (branchId: string) => {
        // Only Owners/Admins/Managers can switch branches
        const allowedRoles = ['owner', 'admin', 'manager'];
        if (profile?.role && allowedRoles.includes(profile.role)) {
            setActiveBranchId(branchId);
            localStorage.setItem('baro-active-branch-id', branchId);
        }
    };

    const activeBranch = branches.find(b => b.id === activeBranchId) || null;

    return (
        <BranchContext.Provider value={{
            activeBranchId,
            activeBranch,
            branches,
            isLoading,
            switchBranch,
        }}>
            {children}
        </BranchContext.Provider>
    );
};
