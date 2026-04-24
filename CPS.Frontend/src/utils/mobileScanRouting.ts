/**
 * Utility to detect if the current device is a mobile device based on User Agent or touch capabilities.
 * Note: Flow routing should primarily use User Roles and Settings.
 */
export function getIsMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  
  const hasCoarseTouchPointer = typeof window !== 'undefined' && 
                                typeof window.matchMedia === 'function' && 
                                window.matchMedia('(pointer: coarse)').matches;
                                
  const ua = navigator.userAgent || '';
  return /Android|iPhone|iPad|iPod|IEMobile|Opera Mini|Mobile/i.test(ua) || hasCoarseTouchPointer;
}

