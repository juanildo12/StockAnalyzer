import { create } from 'zustand';

interface ToastItem {
  id?: string;
  type: 'achievement' | 'levelup' | 'streak' | 'combo' | 'info';
  title: string;
  icon: string;
  coins?: number;
  xp?: number;
}

interface UIState {
  toasts: ToastItem[];
  showConfetti: boolean;
  addToast: (toast: ToastItem) => void;
  removeToast: (id: string) => void;
  triggerConfetti: () => void;
  clearConfetti: () => void;
}

let toastCounter = 0;

export const useUIStore = create<UIState>((set) => ({
  toasts: [],
  showConfetti: false,

  addToast: (toast: ToastItem) => {
    const id = `toast_${++toastCounter}`;
    set(s => ({ toasts: [...s.toasts, { ...toast, id }] }));
  },

  removeToast: (id: string) => {
    set(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
  },

  triggerConfetti: () => {
    set({ showConfetti: true });
  },

  clearConfetti: () => {
    set({ showConfetti: false });
  },
}));
