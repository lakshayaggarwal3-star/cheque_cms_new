// =============================================================================
// File        : authStore.ts
// Project     : CPS — Cheque Processing System
// Module      : Auth
// Description : Zustand store for authenticated user session state.
// Created     : 2026-04-14
// =============================================================================

import { create } from 'zustand';
import type { UserSession } from '../types';

interface AuthStore {
  user: UserSession | null;
  isAuthenticated: boolean;
  setUser: (user: UserSession) => void;
  clearUser: () => void;
  hasRole: (role: string) => boolean;
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user: null,
  isAuthenticated: false,

  setUser: (user) => set({ user, isAuthenticated: true }),

  clearUser: () => set({ user: null, isAuthenticated: false }),

  hasRole: (role: string) => {
    const { user } = get();
    if (!user) return false;
    return user.roles.includes(role) || user.roles.includes('Admin') || user.roles.includes('Developer');
  },
}));
