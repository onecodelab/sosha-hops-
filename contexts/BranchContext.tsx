
import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { Branch } from '../types';
import { supabase } from '../supabase';
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
    const [activeBranchId, setActiveBranchId] = useState<string | null>(null);

    // Fetch all branches (for HQ users or to resolve the active branch)
    const { data: branches = [], isLoading } = useQuery({
        queryKey: ['branches'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('branches')
                .select('*')
                .eq('is_active', true)
                .select('*')
                .eq('is_active', true)
                .order('created_at', { ascending: true }); // Ensure main branch comes first

            if (error) throw error;
            return data as Branch[];
        },
        enabled: !!profile,
    });

    // Sync activeBranchId with profile's home_branch_id
    useEffect(() => {
        if (!isLoading && branches.length > 0) {
            if (profile?.home_branch_id) {
                // ALWAYS enforce the home branch if set
                if (activeBranchId !== profile.home_branch_id) {
                    setActiveBranchId(profile.home_branch_id);
                }
            } else if (!activeBranchId) {
                // Only if no home branch AND no active branch set, default to first
                setActiveBranchId(branches[0].id);
            }
        }
    }, [profile, branches, isLoading]);

    const switchBranch = (branchId: string) => {
        // Only Owners/Admins can switch away from their home branch
        if (profile?.role === 'owner' || profile?.role === 'admin') {
            setActiveBranchId(branchId);
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
