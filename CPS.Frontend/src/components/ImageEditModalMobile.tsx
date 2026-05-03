// =============================================================================
// File        : ImageEditModalMobile.tsx
// Project     : CPS — Cheque Processing System
// Module      : Shared Components
// Description : Mobile scanner image editor — wraps ImageCropEditor in mobile/touch mode
// Created     : 2026-04-19
// Updated     : 2026-04-20
// =============================================================================

import { ImageCropEditor } from './ImageCropEditor';

interface ImageEditModalMobileProps {
  file: File | null;
  title: string;
  onClose: () => void;
  onSave: (grayJpg: File, previewUrl: string, bwTiff: File, originalFile?: File, corners?: any[]) => void;
  initialCropFull?: boolean;
  isSlip?: boolean;
}

export function ImageEditModalMobile({ file, title, onClose, onSave, initialCropFull, isSlip = false }: ImageEditModalMobileProps) {
  if (!file) return null;
  return <ImageCropEditor file={file} title={title} onClose={onClose} onSave={onSave} mode="mobile" initialCropFull={initialCropFull} isSlip={isSlip} saveOriginal={true} />;
}
