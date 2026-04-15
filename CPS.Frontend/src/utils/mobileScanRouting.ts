import type { UserSession } from '../types';

const MOBILE_SCREEN_MAX_WIDTH = 1024;

function hasCoarseTouchPointer(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(pointer: coarse)').matches;
}

function getIsMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(ua) || hasCoarseTouchPointer();
}

export function getMobileScanSignals(user: UserSession | null, screenWidth: number) {
  const hasMobileRole = !!user?.roles.includes('MobileScanner');
  const isMobileDevice = getIsMobileDevice();
  const isSmallScreen = screenWidth > 0 && screenWidth <= MOBILE_SCREEN_MAX_WIDTH;
  return { hasMobileRole, isMobileDevice, isSmallScreen };
}

export function shouldUseMobileScanFlow(user: UserSession | null, screenWidth: number): boolean {
  const signals = getMobileScanSignals(user, screenWidth);
  const score = Number(signals.hasMobileRole) + Number(signals.isMobileDevice) + Number(signals.isSmallScreen);
  return score >= 2;
}
