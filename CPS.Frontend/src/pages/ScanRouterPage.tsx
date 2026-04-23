import React, { useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { shouldUseMobileScanFlow } from '../utils/mobileScanRouting';
import { ScanPage } from './ScanPage';
import { MobileScanPage } from './MobileScanPage';

export function ScanRouterPage() {
  const { user } = useAuthStore();
  const { entryMode } = useSettingsStore();

  // Keep route decision stable for this page mount; prevents mobile camera/browser
  // transitions from remounting into desktop flow or restarting scan modal.
  const useMobileFlow = useMemo(() => {
    const isDev = !!user?.isDeveloper;
    const isMobileScanner = !!user?.roles?.includes('MobileScanner');
    const isScanner = !!user?.roles?.includes('Scanner');
    const hasBoth = isMobileScanner && isScanner;

    if ((hasBoth || isDev) && entryMode === 'mobile') return true;
    if (isMobileScanner && !isScanner && !isDev) return true;

    const width = typeof window !== 'undefined' ? window.innerWidth : 0;
    return shouldUseMobileScanFlow(user, width);
  }, [user, entryMode]);

  if (useMobileFlow) {
    return <MobileScanPage />;
  }

  return <ScanPage />;
}
