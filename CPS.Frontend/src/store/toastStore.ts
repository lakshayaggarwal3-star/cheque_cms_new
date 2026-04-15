// =============================================================================
// File        : toastStore.ts
// Project     : CPS — Cheque Processing System
// Module      : UI
// Description : Zustand store for global toast notification queue.
// Created     : 2026-04-14
// =============================================================================

import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning';

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastStore {
  toasts: Toast[];
  addToast: (type: ToastType, message: string) => void;
  removeToast: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (type, message) => {
    const id = Math.random().toString(36).slice(2);
    set((state) => ({
      toasts: [...state.toasts.slice(-2), { id, type, message }], // max 3
    }));
    // Auto-dismiss success/warning
    if (type !== 'error') {
      setTimeout(() => {
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) }));
      }, type === 'success' ? 3000 : 5000);
    }
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

// Convenience helpers
export const toast = {
  success: (msg: string) => useToastStore.getState().addToast('success', msg),
  error: (msg: string) => useToastStore.getState().addToast('error', msg),
  warning: (msg: string) => useToastStore.getState().addToast('warning', msg),
};
