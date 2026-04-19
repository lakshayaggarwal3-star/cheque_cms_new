// =============================================================================
// File        : useTheme.ts
// Project     : CPS — Cheque Processing System
// Module      : Theme
// Description : Hook for managing light/dark theme preference.
// Created     : 2026-04-19
// =============================================================================

import { useEffect } from 'react';
import { useSettingsStore } from '../store/settingsStore';

export function useTheme() {
  const { theme, setTheme } = useSettingsStore();

  useEffect(() => {
    const html = document.documentElement;
    if (theme === 'dark') {
      html.classList.add('dark');
    } else {
      html.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  return { theme, setTheme, toggleTheme };
}
