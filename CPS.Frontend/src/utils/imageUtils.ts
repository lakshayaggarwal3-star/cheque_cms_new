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

/**
 * Derives the URL for a specific side of a cheque using the base name optimization.
 */
export function getChequeImageUrl(item: { imageBaseName?: string; fileExtension?: string }, side: 'front' | 'back' | 'frontTiff' | 'backTiff'): string {
  if (item.imageBaseName) {
    const suffix = (side === 'front' || side === 'frontTiff') ? 'CF' : 'CR';
    const ext = (side === 'frontTiff' || side === 'backTiff') ? '.tif' : '.jpg';
    return getImageUrl(`${item.imageBaseName}${suffix}${ext}`);
  }
  return '/placeholder-cheque.png';
}

/**
 * Derives the URL for a slip scan.
 */
export function getSlipImageUrl(scan: { imageBaseName?: string; fileExtension?: string }): string {
  if (scan.imageBaseName && scan.fileExtension) {
    // The suffix (SF or GLB) is now part of the ImageBaseName stored in DB
    return getImageUrl(`${scan.imageBaseName}${scan.fileExtension}`);
  }
  return '/placeholder-cheque.png';
}
