import { create } from 'zustand';

export const useCallStore = create((set) => ({
  activeCall: null, // { wacid, status, direction, contactId, fromNumber, ctaPayload, startTime, duration }
  
  // Modifiers
  setCall: (callData) => set({ activeCall: callData }),
  updateCallStatus: (status, wacid) => set((state) => ({ 
    activeCall: state.activeCall ? { ...state.activeCall, status, ...(wacid && { wacid }) } : null 
  })),
  clearCall: () => set({ activeCall: null }),
}));
