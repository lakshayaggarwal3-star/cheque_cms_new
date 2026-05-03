// =============================================================================
// File        : ImageEditModal.tsx
// Project     : CPS — Cheque Processing System
// Module      : Shared Components
// Description : Desktop scanner image editor — wraps ImageCropEditor in desktop mode
// Created     : 2026-04-17
// Updated     : 2026-04-20
// =============================================================================

import { ImageCropEditor } from './ImageCropEditor';

interface ImageEditModalProps {
  file: File | null;
  title: string;
  onClose: () => void;
  onSave: (grayJpg: File, previewUrl: string, bwTiff: File, originalFile?: File, corners?: any[]) => void;
  isSlip?: boolean;
}

export function ImageEditModal({ file, title, onClose, onSave, isSlip = false }: ImageEditModalProps) {
  if (!file) return null;
  return <ImageCropEditor file={file} title={title} onClose={onClose} onSave={onSave} mode="desktop" isSlip={isSlip} saveOriginal={true} />;
}
