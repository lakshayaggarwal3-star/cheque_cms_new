// =============================================================================
// File        : imageUtils.ts
// Project     : CPS — Cheque Processing System
// Module      : Utils
// Description : Utility for constructing authenticated image URLs — used on every page with images.
// Created     : 2026-04-14
// =============================================================================

/**
 * Constructs the full authenticated image URL from a relative path stored in the DB.
 * Uses /api/images/ endpoint (requires JWT cookie — sent automatically).
 * Always use this function — never construct image URLs inline.
 */
export function getImageUrl(relativePath: string | null | undefined): string {
  if (!relativePath) return '/placeholder-cheque.png';
  // Normalize slashes for URL
  const normalized = relativePath.replace(/\\/g, '/');
  return `${window.location.origin}/api/images/${normalized}`;
}
