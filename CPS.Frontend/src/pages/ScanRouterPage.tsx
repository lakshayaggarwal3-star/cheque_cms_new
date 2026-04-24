import { useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useSettingsStore } from '../store/settingsStore';
import { ScanPage } from './ScanPage';
import { MobileScanPage } from './MobileScanPage';

export function ScanRouterPage() {
  const { batchNo } = useParams<{ batchNo: string }>();
  const { user } = useAuthStore();
  const { entryMode } = useSettingsStore();

  // Keep route decision stable for this page mount; prevents mobile camera/browser
  // transitions from remounting into desktop flow or restarting scan modal.
  const useMobileFlow = useMemo(() => {
    const isDev = !!user?.isDeveloper;
    const isMobileScanner = !!user?.roles?.includes('MobileScanner');
    const isScanner = !!user?.roles?.includes('Scanner');
    const hasBoth = isMobileScanner && isScanner;

    // Developer or dual-role users: strictly follow the explicit entryMode setting
    if (isDev || hasBoth) {
      return entryMode === 'mobile';
    }

    // Single-role users: strictly follow their assigned role
    if (isMobileScanner) return true;
    if (isScanner) return false;

    // Fallback: Default to desktop flow if no specific roles match
    return false;
  }, [user, entryMode]);

  if (useMobileFlow) {
    return <MobileScanPage key={batchNo} />;
  }

  return <ScanPage key={batchNo} />;
}
