// =============================================================================
// File        : settingsStore.ts
// Project     : CPS — Cheque Processing System
// Module      : Settings
// Description : Persisted UI/dev settings (e.g., mock scan mode).
// Created     : 2026-04-15
// =============================================================================

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface SettingsStore {
  mockScanEnabled: boolean;
  setMockScanEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      mockScanEnabled: false,
      setMockScanEnabled: (enabled) => set({ mockScanEnabled: enabled }),
    }),
    {
      name: 'cps-settings',
      version: 1,
    }
  )
);

