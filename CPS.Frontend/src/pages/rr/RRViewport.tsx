// =============================================================================
// File        : RRViewport.tsx
// Project     : CPS — Cheque Processing System
// Module      : Reject Repair
// Description : Premium image viewer for RR page with zoom, rotate, pan, 
//               and front/back toggle.
// =============================================================================

import React, { useState, useRef } from 'react';
import { Icon, IconBtn, ImagePlaceholder } from '../../components/scan';

interface Props {
  previewFront: string | null;
  previewBack: string | null;
  filename?: string;
  itemTitle?: string;
}

export function RRViewport({ previewFront, previewBack, filename, itemTitle }: Props) {
  const [flipped, setFlipped] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [panning, setPanning] = useState(false);
  
  const viewerRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const hasMoved = useRef(false);

  const makePanHandlers = () => ({
    onMouseDown: (e: React.MouseEvent) => {
      const el = viewerRef.current;
      if (!el) return;
      hasMoved.current = false;
      panRef.current = { 
        active: true, 
        startX: e.clientX, 
        startY: e.clientY, 
        scrollLeft: el.scrollLeft, 
        scrollTop: el.scrollTop 
      };
      setPanning(true);
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (!panRef.current.active) return;
      const el = viewerRef.current;
      if (!el) return;
      e.preventDefault();
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) hasMoved.current = true;
      el.scrollLeft = panRef.current.scrollLeft - dx;
      el.scrollTop = panRef.current.scrollTop - dy;
    },
    onMouseUp: () => { panRef.current.active = false; setPanning(false); },
    onMouseLeave: () => { panRef.current.active = false; setPanning(false); },
  });

  const handleRotate = () => {
    setRotation(r => (r + 90) % 360);
  };

  const currentImage = flipped ? (previewBack || previewFront) : previewFront;

  return (
    <div style={{
      position: 'relative',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-xl)', overflow: 'hidden', flex: 1, minHeight: 400
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-raised)', zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>
          <Icon name="image" size={14} />
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg)', fontWeight: 500 }}>
            {filename || 'cheque_image.jpg'}
          </span>
          {itemTitle && (
            <>
              <span>·</span>
              <span>{itemTitle}</span>
            </>
          )}
          <span>·</span>
          <span style={{
            padding: '2px 7px', borderRadius: 'var(--r-full)',
            fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
            background: 'var(--bg-subtle)', color: 'var(--fg-muted)',
            border: '1px solid var(--border)',
          }}>
            {flipped ? 'Back' : 'Front'}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 2, background: 'var(--bg)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: 2 }}>
          <IconBtn icon="zoom_out" tooltip="Zoom out" onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))} />
          <IconBtn icon="zoom_in" tooltip="Zoom in" onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))} />
          <IconBtn icon="fit_screen" tooltip="Reset" onClick={() => { setZoom(1); setRotation(0); }} />
          <IconBtn icon="rotate_right" tooltip="Rotate 90°" onClick={handleRotate} />
          <IconBtn icon="flip" tooltip="Flip (click image)" onClick={() => setFlipped(f => !f)} />
        </div>
      </div>

      {/* Viewer Area */}
      <div
        ref={viewerRef}
        {...makePanHandlers()}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          background: 'var(--bg)',
          backgroundImage: 'radial-gradient(circle at 25% 25%, var(--bg-subtle), var(--bg) 60%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: panning ? 'grabbing' : 'grab',
          touchAction: 'none'
        }}
        onClick={(e) => {
          if (!hasMoved.current && e.detail === 1) {
            setFlipped(f => !f);
          }
        }}
      >
        {currentImage ? (
          <div style={{
            position: 'relative',
            transform: `scale(${zoom}) rotate(${rotation}deg)`,
            transition: panning ? 'none' : 'transform 0.2s ease-out',
            transformOrigin: 'center',
            boxShadow: 'var(--shadow-2xl)',
          }}>
            <img
              src={currentImage}
              alt="RR View"
              style={{
                maxHeight: '75vh', maxWidth: '85vw',
                display: 'block', borderRadius: 4,
                pointerEvents: 'none', userSelect: 'none',
              }}
            />
          </div>
        ) : (
          <ImagePlaceholder label={flipped ? 'BACK' : 'FRONT'} />
        )}
      </div>

      {/* Navigation Help */}
      <div style={{ 
        position: 'absolute', bottom: 12, left: '50%', transform: 'translateX(-50%)',
        fontSize: 10, color: 'var(--fg-faint)', pointerEvents: 'none',
        background: 'rgba(0,0,0,0.05)', padding: '2px 8px', borderRadius: 'var(--r-full)'
      }}>
        Click image to flip · Drag to pan · Scroll to zoom
      </div>
    </div>
  );
}
