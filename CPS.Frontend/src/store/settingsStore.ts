// =============================================================================
// File        : settingsStore.ts
// Project     : CPS — Cheque Processing System
// Module      : Settings
// Description : Persisted UI/dev settings (theme, mock scan mode).
// Created     : 2026-04-15
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type Theme = 'light' | 'dark';

interface SettingsStore {
  mockScanEnabled: boolean;
  setMockScanEnabled: (enabled: boolean) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      mockScanEnabled: false,
      setMockScanEnabled: (enabled) => set({ mockScanEnabled: enabled }),
      theme: 'light',
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'cps-settings',
      version: 1,
    }
  )
);

