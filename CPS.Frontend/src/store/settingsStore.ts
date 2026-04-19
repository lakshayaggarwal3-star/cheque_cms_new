// =============================================================================
// File        : settingsStore.ts
// Project     : CPS — Cheque Processing System
// Module      : Settings
// Description : Persisted UI/dev settings (theme, mock scan mode, Ranger options).
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
  // Ranger scan options
  rangerMicrEnabled: boolean;
  setRangerMicrEnabled: (v: boolean) => void;
  rangerEndorsementEnabled: boolean;
  setRangerEndorsementEnabled: (v: boolean) => void;
  rangerEndorsementUseImageName: boolean;
  setRangerEndorsementUseImageName: (v: boolean) => void;
  rangerEndorsementCustomText: string;
  setRangerEndorsementCustomText: (v: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      mockScanEnabled: false,
      setMockScanEnabled: (enabled) => set({ mockScanEnabled: enabled }),
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      // Ranger scan options
      rangerMicrEnabled: true,
      setRangerMicrEnabled: (v) => set({ rangerMicrEnabled: v }),
      rangerEndorsementEnabled: false,
      setRangerEndorsementEnabled: (v) => set({ rangerEndorsementEnabled: v }),
      rangerEndorsementUseImageName: true,
      setRangerEndorsementUseImageName: (v) => set({ rangerEndorsementUseImageName: v }),
      rangerEndorsementCustomText: '',
      setRangerEndorsementCustomText: (v) => set({ rangerEndorsementCustomText: v }),
    }),
    {
      name: 'cps-settings',
      version: 2,
    }
  )
);
