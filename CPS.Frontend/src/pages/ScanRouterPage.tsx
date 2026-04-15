import React, { useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { shouldUseMobileScanFlow } from '../utils/mobileScanRouting';
import { ScanPage } from './ScanPage';
import { MobileScanPage } from './MobileScanPage';

export function ScanRouterPage() {
  const { user } = useAuthStore();
  // Keep route decision stable for this page mount; prevents mobile camera/browser
  // transitions from remounting into desktop flow or restarting scan modal.
  const useMobileFlow = useMemo(() => {
    const width = typeof window !== 'undefined' ? window.innerWidth : 0;
    return shouldUseMobileScanFlow(user, width);
  }, [user]);

  if (useMobileFlow) {
    return <MobileScanPage />;
  }

  return <ScanPage />;
}
