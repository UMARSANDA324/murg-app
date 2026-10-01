import { create } from 'zustand';
import api from '../services/api';

export const useBranchStore = create((set, get) => ({
  branches: [],
  activeBranch: localStorage.getItem('murg_active_branch') || null,
  activeBranchData: null,
  loading: false,

  fetchBranches: async (currentUser = null) => {
    set({ loading: true });
    try {
      const res = await api.get('/branches');
      const branches = res.data.data || [];
      set({ branches, loading: false });

      // If user is a branch staff/cashier (not global admin), strictly lock activeBranch to their assigned facilityID
      if (currentUser && !currentUser.isGlobalAdmin && currentUser.facilityID) {
        get().setActiveBranch(currentUser.facilityID);
        return;
      }

      // For Global Admin: if no active branch is set or current active branch is invalid, set to first branch
      const currentActive = get().activeBranch;
      if (!currentActive && branches.length > 0) {
        get().setActiveBranch(branches[0].facilityID);
      } else if (currentActive) {
        const found = branches.find(b => b.facilityID === currentActive);
        if (found) {
          set({ activeBranchData: found });
        } else if (branches.length > 0) {
          get().setActiveBranch(branches[0].facilityID);
        }
      }
    } catch (err) {
      console.error('[BranchStore] Fetch failed:', err);
      set({ loading: false });
    }
  },

  setActiveBranch: (facilityID) => {
    localStorage.setItem('murg_active_branch', facilityID);
    const found = get().branches.find(b => b.facilityID === facilityID);
    set({ activeBranch: facilityID, activeBranchData: found || null });
  },
}));
