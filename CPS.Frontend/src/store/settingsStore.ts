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
type EntryMode = 'scanner' | 'mobile';

interface SettingsStore {
  mockScanEnabled: boolean;
  setMockScanEnabled: (enabled: boolean) => void;
  theme: Theme;
  setTheme: (theme: Theme) => void;
  entryMode: EntryMode;
  setEntryMode: (mode: EntryMode) => void;
  // Ranger scan options
  rangerMicrEnabled: boolean;
  setRangerMicrEnabled: (v: boolean) => void;
  rangerEndorsementEnabled: boolean;
  setRangerEndorsementEnabled: (v: boolean) => void;
  rangerEndorsementUseImageName: boolean;
  setRangerEndorsementUseImageName: (v: boolean) => void;
  rangerEndorsementCustomText: string;
  setRangerEndorsementCustomText: (v: string) => void;
  rangerEndorsementBatchName: string;
  setRangerEndorsementBatchName: (v: string) => void;
}

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      mockScanEnabled: false,
      setMockScanEnabled: (enabled) => set({ mockScanEnabled: enabled }),
      theme: 'light',
      setTheme: (theme) => set({ theme }),
      entryMode: 'scanner',
      setEntryMode: (mode) => set({ entryMode: mode }),
      // Ranger scan options
      rangerMicrEnabled: true,
      setRangerMicrEnabled: (v) => set({ rangerMicrEnabled: v }),
      rangerEndorsementEnabled: true,
      setRangerEndorsementEnabled: (v) => set({ rangerEndorsementEnabled: v }),
      rangerEndorsementUseImageName: true,
      setRangerEndorsementUseImageName: (v) => set({ rangerEndorsementUseImageName: v }),
      rangerEndorsementCustomText: '',
      setRangerEndorsementCustomText: (v) => set({ rangerEndorsementCustomText: v }),
      rangerEndorsementBatchName: '',
      setRangerEndorsementBatchName: (v) => set({ rangerEndorsementBatchName: v }),
    }),
    {
      name: 'cps-settings',
      version: 4,
    }
  )
);
