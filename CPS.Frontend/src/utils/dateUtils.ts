// =============================================================================
// File        : dateUtils.ts
// Project     : CPS — Cheque Processing System
// Module      : Shared Utils
// Description : IST-aware date helpers — always use these instead of toISOString().
// Created     : 2026-05-03
// =============================================================================

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30

/** Returns today's date as YYYY-MM-DD in IST (browser local time). */
export function todayIST(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Converts any UTC ISO string from the API to IST and returns YYYY-MM-DD.
 * Use this when displaying dates received from the backend.
 */
export function utcToISTDate(utcString: string): string {
  const utc = new Date(utcString);
  const ist = new Date(utc.getTime() + IST_OFFSET_MS);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, '0')}-${String(ist.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Converts any UTC ISO string from the API to IST and returns a readable string.
 * e.g. "03 May 2026 14:32"
 */
export function utcToISTDisplay(utcString: string | null | undefined): string {
  if (!utcString) return '—';
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const utc = new Date(utcString);
  const ist = new Date(utc.getTime() + IST_OFFSET_MS);
  const dd   = String(ist.getUTCDate()).padStart(2, '0');
  const mon  = months[ist.getUTCMonth()];
  const yyyy = ist.getUTCFullYear();
  const hh   = String(ist.getUTCHours()).padStart(2, '0');
  const mm   = String(ist.getUTCMinutes()).padStart(2, '0');
  return `${dd} ${mon} ${yyyy} ${hh}:${mm}`;
}
