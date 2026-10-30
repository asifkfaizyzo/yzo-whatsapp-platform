import { create } from 'zustand';

interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  message: string;
}

interface UIState {
  toast: ToastMessage | null;
  showToast: (type: ToastMessage['type'], message: string) => void;
  hideToast: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  toast: null,

  showToast: (type, message) => {
    const id = Date.now().toString();
    set({ toast: { id, type, message } });
    setTimeout(() => {
      set((state) => (state.toast?.id === id ? { toast: null } : state));
    }, 3500);
  },

  hideToast: () => set({ toast: null }),
}));