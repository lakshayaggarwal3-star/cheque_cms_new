// =============================================================================
// File        : ImageEditModal.tsx
// Project     : CPS — Cheque Processing System
// Module      : Shared Components
// Description : Mouse-optimized image editor for desktop scanner (sliders + controls)
// Created     : 2026-04-17
// Updated     : 2026-04-20 (desktop-only version)
// =============================================================================

import { useEffect, useMemo, useState } from 'react';

interface ImageEditModalProps {
  file: File | null;
  title: string;
  onClose: () => void;
  onSave: (file: File, previewUrl: string) => void;
}

const OUTPUT_WIDTH = 1400;
const OUTPUT_HEIGHT = 900;

export function ImageEditModal({ file, title, onClose, onSave }: ImageEditModalProps) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [grayscale, setGrayscale] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    setZoom(1); setRotation(0); setBrightness(100);
    setContrast(100); setGrayscale(0); setOffsetX(0); setOffsetY(0);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const previewStyle = useMemo(() => ({
    transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom}) rotate(${rotation}deg)`,
    filter: `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%)`,
  }), [brightness, contrast, grayscale, offsetX, offsetY, rotation, zoom]);

  if (!file || !sourceUrl) return null;

  const handleReset = () => {
    setZoom(1); setRotation(0); setBrightness(100);
    setContrast(100); setGrayscale(0); setOffsetX(0); setOffsetY(0);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const image = await loadImage(sourceUrl);
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_WIDTH;
      canvas.height = OUTPUT_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not available');
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) grayscale(${grayscale}%)`;
      ctx.translate(canvas.width / 2 + offsetX * 2, canvas.height / 2 + offsetY * 2);
      ctx.rotate((rotation * Math.PI) / 180);
      const coverScale = Math.max(canvas.width / image.width, canvas.height / image.height);
      ctx.scale(coverScale * zoom, coverScale * zoom);
      ctx.drawImage(image, -image.width / 2, -image.height / 2);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, file.type || 'image/jpeg', 0.92)
      );
      if (!blob) throw new Error('Could not save edited image');
      const editedFile = new File([blob], file.name, { type: blob.type || file.type || 'image/jpeg' });
      onSave(editedFile, URL.createObjectURL(blob));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 60,
      background: 'rgb(0 0 0 / 72%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        display: 'flex', flexDirection: 'row',
        width: '100%', maxWidth: 1100,
        height: 'calc(100dvh - 2rem)',
        borderRadius: 'var(--r-xl)',
        overflow: 'hidden',
        boxShadow: '0 32px 80px rgb(0 0 0 / 50%)',
      }}>

        {/* ── Left: dark preview panel ── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column',
          background: '#0d1117',
          minWidth: 0,
        }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', flexShrink: 0,
            borderBottom: '1px solid rgb(255 255 255 / 8%)',
          }}>
            <div>
              <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: '#f1f5f9' }}>{title}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: '#94a3b8', marginTop: 2 }}>
                Adjust brightness, contrast, rotation and position.
              </div>
            </div>
            <button
              onClick={onClose}
              style={{
                padding: '5px 12px', borderRadius: 'var(--r-md)',
                border: '1px solid rgb(255 255 255 / 15%)',
                background: 'transparent', color: '#94a3b8',
                cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 500,
                fontFamily: 'inherit',
              }}
            >Close</button>
          </div>

          {/* Image canvas */}
          <div style={{
            flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24, overflow: 'hidden',
          }}>
            <div style={{
              position: 'relative',
              width: '100%', aspectRatio: '14 / 9',
              maxHeight: '100%',
              overflow: 'hidden',
              borderRadius: 16,
              border: '1px solid rgb(255 255 255 / 10%)',
              background: 'linear-gradient(135deg, #0f172a, #0c1222)',
            }}>
              {/* Dashed inner guide */}
              <div style={{
                position: 'absolute', inset: 20,
                border: '1px dashed rgb(255 255 255 / 18%)',
                borderRadius: 8, pointerEvents: 'none', zIndex: 1,
              }} />
              <div style={{
                position: 'absolute', inset: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                overflow: 'hidden',
              }}>
                <img
                  src={sourceUrl}
                  alt="Edit preview"
                  draggable={false}
                  style={{ maxHeight: 'none', maxWidth: 'none', userSelect: 'none', objectFit: 'contain', ...previewStyle }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* ── Right: controls panel ── */}
        <div style={{
          width: 320, flexShrink: 0,
          background: 'var(--bg-raised)',
          borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Controls list */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 16px 8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <EditSlider label="Zoom" min={1} max={2.5} step={0.05} value={zoom} onChange={setZoom} display={`${(zoom * 100).toFixed(0)}%`} />
              <EditSlider label="Rotate" min={-180} max={180} step={1} value={rotation} onChange={setRotation} display={`${rotation}°`} />
              <EditSlider label="Brightness" min={60} max={160} step={1} value={brightness} onChange={setBrightness} display={`${brightness}%`} />
              <EditSlider label="Contrast" min={60} max={180} step={1} value={contrast} onChange={setContrast} display={`${contrast}%`} />
              <EditSlider label="Grayscale" min={0} max={100} step={1} value={grayscale} onChange={setGrayscale} display={`${grayscale}%`} />
              <EditSlider label="Shift ←→" min={-160} max={160} step={1} value={offsetX} onChange={setOffsetX} display={`${offsetX}`} />
              <EditSlider label="Shift ↑↓" min={-160} max={160} step={1} value={offsetY} onChange={setOffsetY} display={`${offsetY}`} />
            </div>

            {/* Reset */}
            <div style={{
              marginTop: 12, padding: '12px 14px', borderRadius: 'var(--r-md)',
              background: 'var(--bg)', border: '1px solid var(--border)',
            }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg)', marginBottom: 2 }}>Reset all</div>
              <div style={{ fontSize: 10, color: 'var(--fg-subtle)', marginBottom: 10 }}>
                Restore all adjustments to their default values.
              </div>
              <button
                type="button"
                onClick={handleReset}
                className="btn-secondary"
                style={{ width: '100%', justifyContent: 'center', fontSize: 'var(--text-xs)' }}
              >Reset adjustments</button>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '12px 16px',
            borderTop: '1px solid var(--border)',
            display: 'flex', gap: 8, flexShrink: 0,
          }}>
            <button onClick={onClose} className="btn-ghost" style={{ flex: 1, justifyContent: 'center' }}>
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn-primary"
              style={{ flex: 1, justifyContent: 'center' }}
            >
              {saving ? 'Saving…' : 'Save image'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── EditSlider ─────────────────────────────────────────────────────────────────

function EditSlider({ label, min, max, step, value, onChange, display }: {
  label: string; min: number; max: number; step: number;
  value: number; onChange: (v: number) => void; display: string;
}) {
  return (
    <div style={{
      padding: '10px 12px', borderRadius: 'var(--r-md)',
      background: 'var(--bg)', border: '1px solid var(--border)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg)' }}>{label}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums', minWidth: 36, textAlign: 'right' }}>{display}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: 'var(--accent-500)', cursor: 'pointer' }}
      />
    </div>
  );
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = src;
  });
}
