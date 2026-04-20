// =============================================================================
// File        : ImageEditModalMobile.tsx
// Project     : CPS — Cheque Processing System
// Module      : Shared Components
// Description : Touch-optimized image editor for mobile scanning (pinch zoom, drag pan)
// Created     : 2026-04-20
// =============================================================================

import { useEffect, useState, useRef } from 'react';

interface ImageEditModalMobileProps {
  file: File | null;
  title: string;
  onClose: () => void;
  onSave: (file: File, previewUrl: string) => void;
}

const OUTPUT_WIDTH = 1400;
const OUTPUT_HEIGHT = 900;

export function ImageEditModalMobile({ file, title, onClose, onSave }: ImageEditModalMobileProps) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [brightness, setBrightness] = useState(100);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);
  const [saving, setSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, offsetX: 0, offsetY: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    setSourceUrl(url);
    setZoom(1);
    setRotation(0);
    setBrightness(100);
    setOffsetX(0);
    setOffsetY(0);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        offsetX,
        offsetY,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setOffsetX(dragStartRef.current.offsetX + dx / zoom);
      setOffsetY(dragStartRef.current.offsetY + dy / zoom);
    } else if (e.touches.length === 2) {
      // Pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(
        touch2.clientX - touch1.clientX,
        touch2.clientY - touch1.clientY
      );
      // Store previous distance in data attribute for next move
      const canvas = canvasRef.current;
      if (canvas) {
        const prevDist = parseFloat(canvas.dataset.prevDist || String(dist));
        if (prevDist > 0) {
          const newZoom = Math.max(0.8, Math.min(3, zoom * (dist / prevDist)));
          setZoom(newZoom);
        }
        canvas.dataset.prevDist = String(dist);
      }
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    if (canvasRef.current) {
      canvasRef.current.dataset.prevDist = '0';
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const image = await loadImage(sourceUrl!);
      const canvas = document.createElement('canvas');
      canvas.width = OUTPUT_WIDTH;
      canvas.height = OUTPUT_HEIGHT;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas not available');
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.filter = `brightness(${brightness}%)`;
      ctx.translate(canvas.width / 2 + offsetX * 2, canvas.height / 2 + offsetY * 2);
      ctx.rotate((rotation * Math.PI) / 180);
      const coverScale = Math.max(canvas.width / image.width, canvas.height / image.height);
      ctx.scale(coverScale * zoom, coverScale * zoom);
      ctx.drawImage(image, -image.width / 2, -image.height / 2);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, file!.type || 'image/jpeg', 0.92)
      );
      if (!blob) throw new Error('Could not save edited image');
      const editedFile = new File([blob], file!.name, { type: blob.type || file!.type || 'image/jpeg' });
      onSave(editedFile, URL.createObjectURL(blob));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setBrightness(100);
    setOffsetX(0);
    setOffsetY(0);
  };

  if (!file || !sourceUrl) return null;

  const previewStyle = {
    transform: `translate(${offsetX}px, ${offsetY}px) scale(${zoom}) rotate(${rotation}deg)`,
    filter: `brightness(${brightness}%)`,
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 60,
      background: 'rgb(0 0 0 / 72%)',
      display: 'flex',
      flexDirection: 'column',
      padding: 12,
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 16px',
        background: 'var(--bg-raised)',
        borderRadius: 'var(--r-lg) var(--r-lg) 0 0',
        marginBottom: -1,
      }}>
        <div>
          <div style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--fg)' }}>
            {title}
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginTop: 2 }}>
            Drag to pan • Pinch to zoom • Rotate and adjust
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--fg-muted)',
            cursor: 'pointer',
            fontSize: 'var(--text-lg)',
            padding: '4px 8px',
          }}
        >
          ✕
        </button>
      </div>

      {/* Canvas area */}
      <div
        ref={canvasRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#0d1117',
          overflow: 'hidden',
          touchAction: 'none',
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            maxWidth: '100%',
            maxHeight: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <img
            src={sourceUrl}
            alt="Edit preview"
            draggable={false}
            style={{
              maxHeight: '100%',
              maxWidth: '100%',
              userSelect: 'none',
              objectFit: 'contain',
              ...(previewStyle as any),
            }}
          />
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          background: 'var(--bg-raised)',
          borderRadius: '0 0 var(--r-lg) var(--r-lg)',
          padding: '12px 16px',
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: 8,
        }}
      >
        <div>
          <label style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', fontWeight: 500 }}>
            Brightness ({brightness}%)
          </label>
          <input
            type="range"
            min="60"
            max="160"
            step="1"
            value={brightness}
            onChange={(e) => setBrightness(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-500)', marginTop: 4 }}
          />
        </div>

        <div>
          <label style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', fontWeight: 500 }}>
            Rotate ({rotation}°)
          </label>
          <input
            type="range"
            min="-180"
            max="180"
            step="15"
            value={rotation}
            onChange={(e) => setRotation(Number(e.target.value))}
            style={{ width: '100%', accentColor: 'var(--accent-500)', marginTop: 4 }}
          />
        </div>

        <button
          onClick={handleReset}
          style={{
            padding: '8px 12px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            color: 'var(--fg)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Reset
        </button>

        <button
          onClick={onClose}
          style={{
            padding: '8px 12px',
            background: 'var(--bg)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--r-md)',
            color: 'var(--fg)',
            fontSize: 'var(--text-sm)',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          Cancel
        </button>

        <button
          onClick={handleSave}
          disabled={saving}
          style={{
            gridColumn: '1 / -1',
            padding: '10px',
            background: 'var(--accent-500)',
            color: 'var(--fg-on-accent)',
            border: 'none',
            borderRadius: 'var(--r-md)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            cursor: saving ? 'not-allowed' : 'pointer',
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? 'Saving…' : 'Save Image'}
        </button>
      </div>
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
