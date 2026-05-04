// =============================================================================
// File        : UploadSlipModal.tsx
// Project     : CPS — Cheque Processing System
// Module      : Slip Images
// Description : Full-screen modal for uploading bulk slip images to any batch.
//               Reusable from AllBatches, Dashboard, ScanList, RRList pages.
// Created     : 2026-05-03
// =============================================================================

import React, { useRef, useState, useCallback } from 'react';
import { uploadBulkSlipItems } from '../services/scanService';
import { toast } from '../store/toastStore';

// ── Primitives ────────────────────────────────────────────────────────────────

function Icon({ name, size = 20, style }: { name: string; size?: number; style?: React.CSSProperties }) {
  return (
    <span className="material-symbols-outlined" style={{
      fontSize: size,
      fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
      lineHeight: 1, userSelect: 'none', flexShrink: 0,
      ...style,
    }}>{name}</span>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface UploadFile {
  file: File;
  previewUrl: string;
}

type ViewMode = 'grid' | 'preview';

interface Props {
  batchId: number;
  batchNo: string;
  onClose: () => void;
  onSuccess?: () => void;
}

// ── UploadSlipModal ───────────────────────────────────────────────────────────

export function UploadSlipModal({ batchId, batchNo, onClose, onSuccess }: Props) {
  const [files, setFiles] = useState<UploadFile[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [previewIdx, setPreviewIdx] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback((incoming: FileList | File[]) => {
    const existingNames = new Set(files.map(f => f.file.name));
    const incomingArr = Array.from(incoming);
    
    const unique = incomingArr.filter(f => {
      const isValidType = f.type.startsWith('image/') || /\.(pdf|tif|tiff)$/i.test(f.name);
      if (!isValidType) return false;
      
      const isDuplicate = existingNames.has(f.name);
      return !isDuplicate;
    });

    if (unique.length < incomingArr.length) {
      const diff = incomingArr.length - unique.length;
      toast.warning(`${diff} duplicate file${diff !== 1 ? 's' : ''} skipped.`);
    }

    if (unique.length === 0) return;

    const mapped: UploadFile[] = unique.map(f => ({ file: f, previewUrl: URL.createObjectURL(f) }));
    setFiles(prev => [...prev, ...mapped]);
  }, [files]);
  

  const removeFile = useCallback((idx: number) => {
    setFiles(prev => {
      URL.revokeObjectURL(prev[idx].previewUrl);
      const next = prev.filter((_, i) => i !== idx);
      return next;
    });
    setPreviewIdx(i => Math.min(i, Math.max(0, files.length - 2)));
  }, [files.length]);

  const clearAll = useCallback(() => {
    setFiles(prev => { prev.forEach(f => URL.revokeObjectURL(f.previewUrl)); return []; });
  }, []);

  const handleSubmit = async () => {
    if (files.length === 0) { toast.error('No files selected.'); return; }
    setUploading(true);
    try {
      await uploadBulkSlipItems(batchId, 0, files.map(f => f.file));
      toast.success(`${files.length} slip image${files.length !== 1 ? 's' : ''} uploaded to batch ${batchNo}`);
      files.forEach(f => URL.revokeObjectURL(f.previewUrl));
      setFiles([]);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleClose = () => {
    if (!uploading) {
      clearAll();
      onClose();
    }
  };

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 20000,
        display: 'flex', justifyContent: 'center', alignItems: 'center',
        background: 'rgba(0,0,0,0.6)',
        padding: '12px',
        overflowY: 'auto',
      }}
      onClick={e => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div style={{
        width: '95%', maxWidth: 1200,
        maxHeight: 'calc(100vh - 40px)',
        background: 'var(--bg-raised)',
        borderRadius: 'var(--r-lg)',
        border: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>

        {/* Header */}
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--bg)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}>
            <Icon name="upload_file" size={20} style={{ color: 'var(--accent-500)' }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Upload Slip Images
              </div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Batch: {batchNo}
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {files.length > 0 && (
              <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', padding: 2, gap: 2 }}>
                <button
                  onClick={() => setViewMode('grid')}
                  title="Grid view"
                  style={{
                    padding: '4px 8px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer',
                    background: viewMode === 'grid' ? 'var(--bg-raised)' : 'transparent',
                    color: viewMode === 'grid' ? 'var(--fg)' : 'var(--fg-faint)',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <Icon name="grid_view" size={16} />
                </button>
                <button
                  onClick={() => { setViewMode('preview'); setPreviewIdx(0); }}
                  title="Preview view"
                  style={{
                    padding: '4px 8px', borderRadius: 'var(--r-sm)', border: 'none', cursor: 'pointer',
                    background: viewMode === 'preview' ? 'var(--bg-raised)' : 'transparent',
                    color: viewMode === 'preview' ? 'var(--fg)' : 'var(--fg-faint)',
                    display: 'flex', alignItems: 'center',
                  }}
                >
                  <Icon name="crop_original" size={16} />
                </button>
              </div>
            )}
            <button
              onClick={handleClose}
              disabled={uploading}
              className="btn-ghost"
              style={{ color: 'var(--fg-faint)', padding: 4 }}
            >
              <Icon name="close" size={20} />
            </button>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{
          padding: '10px 16px', borderBottom: '1px solid var(--border)',
          display: 'flex', gap: 8, flexShrink: 0,
        }}>
          <button
            onClick={() => inputRef.current?.click()}
            className="btn-secondary"
            style={{ flex: 1, height: 32, gap: 6, fontSize: 12, padding: '0 12px' }}
            disabled={uploading}
          >
            <Icon name="add_photo_alternate" size={14} />
            Add Images
          </button>
          <input
            ref={inputRef}
            type="file"
            hidden
            multiple
            accept="image/*,.pdf,.tif,.tiff"
            onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }}
          />
          {files.length > 0 && (
            <button
              onClick={clearAll}
              className="btn-ghost"
              style={{ height: 32, color: 'var(--danger)', fontSize: 12, padding: '0 12px' }}
              disabled={uploading}
            >
              Clear All
            </button>
          )}
        </div>

        {/* Body — drop zone */}
        <div
          style={{ flex: 1, overflow: 'auto', position: 'relative', minHeight: 0 }}
          onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={e => { e.preventDefault(); setIsDragOver(false); addFiles(e.dataTransfer.files); }}
        >
          {isDragOver && (
            <div style={{
              position: 'absolute', inset: 12, zIndex: 10,
              background: 'rgba(var(--accent-500-rgb),0.12)',
              border: '2px dashed var(--accent-500)',
              borderRadius: 'var(--r-md)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <span style={{ color: 'var(--accent-500)', fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                Drop images here
              </span>
            </div>
          )}

          {files.length === 0 ? (
            <div
              style={{
                height: '100%', minHeight: 240,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 16, padding: 32, cursor: 'pointer',
              }}
              onClick={() => inputRef.current?.click()}
            >
              <div style={{
                width: 72, height: 72, borderRadius: '50%',
                background: 'var(--bg-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name="cloud_upload" size={32} style={{ color: 'var(--accent-400)' }} />
              </div>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontWeight: 600, margin: 0, color: 'var(--fg)' }}>Drag &amp; drop images here</p>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', marginTop: 4 }}>
                  or click to browse • JPEG, PNG, TIFF, PDF
                </p>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
              gap: 10, padding: 14,
            }}>
              {files.map((uf, i) => (
                <div
                  key={i}
                  style={{
                    position: 'relative', borderRadius: 'var(--r-md)',
                    overflow: 'hidden', border: '1px solid var(--border)',
                    background: 'var(--bg-subtle)', cursor: 'pointer',
                  }}
                  onClick={() => { setPreviewIdx(i); setViewMode('preview'); }}
                >
                  <img
                    src={uf.previewUrl}
                    alt={uf.file.name}
                    style={{ width: '100%', aspectRatio: '3/4', objectFit: 'cover', display: 'block' }}
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                  <div style={{
                    padding: '5px 7px', fontSize: 9,
                    color: 'var(--fg-subtle)', whiteSpace: 'nowrap',
                    overflow: 'hidden', textOverflow: 'ellipsis',
                  }}>
                    {uf.file.name}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); removeFile(i); }}
                    style={{
                      position: 'absolute', top: 4, right: 4,
                      width: 20, height: 20, borderRadius: '50%',
                      background: 'rgba(0,0,0,0.6)', border: 'none',
                      cursor: 'pointer', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', color: '#fff',
                    }}
                  >
                    <Icon name="close" size={12} />
                  </button>
                  <div style={{
                    position: 'absolute', top: 4, left: 4,
                    background: 'rgba(0,0,0,0.5)', color: '#fff',
                    fontSize: 9, padding: '1px 5px', borderRadius: 4, fontWeight: 700,
                  }}>
                    {i + 1}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, height: '100%' }}>
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, minHeight: 0, height: '100%', overflow: 'hidden' }}>
                <img
                  src={files[previewIdx]?.previewUrl}
                  alt="preview"
                  style={{
                    display: 'block',
                    maxWidth: '100%', maxHeight: '100%',
                    width: 'auto', height: 'auto',
                    objectFit: 'contain', borderRadius: 'var(--r-md)',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.35)',
                  }}
                />
              </div>
              <div style={{
                padding: '10px 16px', borderTop: '1px solid var(--border)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                flexShrink: 0,
              }}>
                <button
                  onClick={() => setPreviewIdx(i => Math.max(0, i - 1))}
                  disabled={previewIdx === 0}
                  className="btn-ghost"
                  style={{ height: 28 }}
                >
                  <Icon name="chevron_left" size={18} />
                </button>
                <span style={{ 
                  fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                  margin: '0 8px', flex: 1, textAlign: 'center'
                }}>
                  {previewIdx + 1} / {files.length} — {files[previewIdx]?.file.name}
                </span>
                <button
                  onClick={() => setPreviewIdx(i => Math.min(files.length - 1, i + 1))}
                  disabled={previewIdx === files.length - 1}
                  className="btn-ghost"
                  style={{ height: 28 }}
                >
                  <Icon name="chevron_right" size={18} />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid var(--border)',
          background: 'var(--bg)', display: 'flex', gap: 10, flexShrink: 0,
        }}>
          <button
            onClick={handleClose}
            className="btn-secondary"
            style={{ flex: 1, height: 38, fontSize: 'var(--text-xs)' }}
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={files.length === 0 || uploading}
            className="btn-primary"
            style={{ flex: 2, height: 34, fontSize: 13, gap: 6 }}
          >
            <Icon name="upload" size={14} />
            {uploading
              ? 'Uploading…'
              : `Upload ${files.length > 0 ? files.length : ''}`}
          </button>
        </div>
      </div>
    </div>
  );
}
