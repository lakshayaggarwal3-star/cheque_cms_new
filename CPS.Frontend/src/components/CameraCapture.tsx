// =============================================================================
// File        : CameraCapture.tsx
// Project     : CPS — Cheque Processing System
// Module      : Shared Components
// Description : File-upload capture component for slip (1 image) and cheque (2 images).
// Created     : 2026-04-17
// =============================================================================

import { useRef } from 'react';

interface CameraCaptureProps {
  mode: 'slip' | 'cheque';
  isMockMode?: boolean;
  onCaptureFront: (file: File) => void;
  onCaptureBack?: (file: File) => void;
  frontPreview?: string | null;
  backPreview?: string | null;
  disabled?: boolean;
}

export function CameraCapture({
  mode,
  onCaptureFront,
  onCaptureBack,
  frontPreview,
  backPreview,
  disabled = false,
}: CameraCaptureProps) {
  const frontRef = useRef<HTMLInputElement | null>(null);
  const backRef = useRef<HTMLInputElement | null>(null);
  const isCheque = mode === 'cheque';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <input ref={frontRef} type="file" accept="image/*" style={{ display: 'none' }}
        onChange={e => { const f = e.target.files?.[0]; if (f) { onCaptureFront(f); e.target.value = ''; } }} />
      {isCheque && (
        <input ref={backRef} type="file" accept="image/*" style={{ display: 'none' }}
          onChange={e => { const f = e.target.files?.[0]; if (f) { onCaptureBack?.(f); e.target.value = ''; } }} />
      )}

      {isCheque ? (
        /* Side-by-side for cheque front + back */
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <UploadZone
            label="Front"
            preview={frontPreview}
            disabled={disabled}
            onClick={() => frontRef.current?.click()}
          />
          <UploadZone
            label="Back"
            preview={backPreview}
            disabled={disabled}
            onClick={() => backRef.current?.click()}
          />
        </div>
      ) : (
        <UploadZone
          label="Slip Image"
          preview={frontPreview}
          disabled={disabled}
          onClick={() => frontRef.current?.click()}
        />
      )}
    </div>
  );
}

// ── UploadZone ─────────────────────────────────────────────────────────────────

function UploadZone({ label, preview, disabled, onClick }: {
  label: string; preview?: string | null; disabled: boolean; onClick: () => void;
}) {
  if (preview) {
    return (
      <div style={{ position: 'relative', borderRadius: 'var(--r-md)', overflow: 'hidden', border: '1px solid var(--success, #16a34a)', cursor: disabled ? 'not-allowed' : 'pointer' }} onClick={disabled ? undefined : onClick}>
        <img
          src={preview}
          alt={label}
          style={{ display: 'block', width: '100%', aspectRatio: label === 'Slip Image' ? '1 / 1.4' : '2.4 / 1', objectFit: 'contain', background: 'var(--bg-raised)' }}
        />
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgb(0 0 0 / 0%)',
          display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'space-between',
          padding: 6,
        }}>
          <span style={{
            background: 'var(--success, #16a34a)', color: '#fff',
            borderRadius: 'var(--r-full)', padding: '1px 6px',
            fontSize: 10, fontWeight: 700,
          }}>✓</span>
          <span style={{
            background: 'rgb(0 0 0 / 55%)', color: '#fff',
            borderRadius: 'var(--r-full)', padding: '2px 7px',
            fontSize: 9, fontWeight: 600, letterSpacing: '.02em',
          }}>Retake</span>
        </div>
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0,
          padding: '4px 6px',
          background: 'linear-gradient(0deg, rgb(0 0 0 / 40%) 0%, transparent 100%)',
          fontSize: 9, fontWeight: 600, color: '#fff', letterSpacing: '.05em', textTransform: 'uppercase',
        }}>{label}</div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 5,
        width: '100%',
        aspectRatio: label === 'Slip Image' ? '1 / 1.4' : '2.4 / 1',
        minHeight: label === 'Slip Image' ? 100 : 60,
        borderRadius: 'var(--r-md)',
        border: '1.5px dashed var(--border-strong)',
        background: 'var(--bg)',
        color: 'var(--fg-muted)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        transition: 'border-color 0.15s ease, background 0.15s ease',
        fontFamily: 'inherit',
      }}
    >
      <span
        className="material-symbols-outlined"
        style={{ fontSize: 20, fontVariationSettings: `'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 20`, color: 'var(--fg-faint)' }}
      >upload_file</span>
      <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '.04em', textTransform: 'uppercase' }}>{label}</span>
    </button>
  );
}
