import { create } from 'zustand';

interface ToastInfo {
  message: string;
  type: 'success' | 'error' | 'info';
  duration?: number;
}

interface ConfettiInfo {
  title?: string;
  subtitle?: string;
}

interface UIState {
  toast: ToastInfo | null;
  confetti: ConfettiInfo | null;
  setToast: (message: string, type?: 'success' | 'error' | 'info', duration?: number) => void;
  hideToast: () => void;
  showConfetti: (title?: string, subtitle?: string) => void;
  hideConfetti: () => void;
}

export const useUIStore = create<UIState>((set) => ({
  toast: null,
  confetti: null,

  setToast: (message, type = 'info', duration = 2000) => {
    set({ toast: { message, type, duration } });
  },

  hideToast: () => {
    set({ toast: null });
  },

  showConfetti: (title, subtitle) => {
    set({ confetti: { title, subtitle } });
  },

  hideConfetti: () => {
    set({ confetti: null });
  },
}));
