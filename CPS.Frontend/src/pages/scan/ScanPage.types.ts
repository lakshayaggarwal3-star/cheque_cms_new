// =============================================================================
// File        : ScanPage.types.ts
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Shared type definitions for the ScanPage module.
// =============================================================================

export type ScanStep = 'SlipEntry' | 'SlipScan' | 'ChequeScan';
export type EditableImageTarget = 'slip-front' | 'cheque-front' | 'cheque-back';

/** Module-level set to prevent duplicate session init calls per batch. */
export const sessionInitBatchIds = new Set<number>();
