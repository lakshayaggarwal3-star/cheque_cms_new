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
  onSave: (file: File, previewUrl: string) => void;
}

export function ImageEditModal({ file, title, onClose, onSave }: ImageEditModalProps) {
  if (!file) return null;
  return <ImageCropEditor file={file} title={title} onClose={onClose} onSave={onSave} mode="desktop" />;
}
