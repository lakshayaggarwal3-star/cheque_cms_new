// =============================================================================
// File        : RRViewport.tsx
// Project     : CPS — Cheque Processing System
// Module      : Reject Repair
// Description : Premium image viewer for RR page with zoom, rotate, pan.
// =============================================================================

import React, { useState, useRef } from 'react';
import { Icon, IconBtn, ImagePlaceholder } from '../../components/scan';

interface Props {
  previewFront: string | null;
  previewBack: string | null;
  imageBaseName?: string;
  filename?: string;
  itemTitle?: string;
  hasFrontPath?: boolean;
  hasBackPath?: boolean;
  setIsFullscreen?: (val: boolean) => void;
  isZoomed?: boolean;
  layout?: 'side' | 'bottom';
  imageType?: 'gray' | 'bitonal';
  setImageType?: (val: 'gray' | 'bitonal') => void;
}

export function RRViewport({ 
  previewFront, previewBack, imageBaseName, filename, itemTitle, hasFrontPath, hasBackPath,
  setIsFullscreen, isZoomed = false, layout = 'bottom', imageType = 'bitonal', setImageType
}: Props) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0); 
  const [panning, setPanning] = useState(false);
  const [frontError, setFrontError] = useState(false);
  const [backError, setBackError] = useState(false);
  
  const viewerRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ active: false, startX: 0, startY: 0, initialX: 0, initialY: 0 });

  React.useEffect(() => {
    setFrontError(false);
    setBackError(false);
    setOffset({ x: 0, y: 0 });
    setZoom(1);
    // Keep imageType persistent across items as users usually prefer one mode
  }, [previewFront, previewBack]);

  React.useEffect(() => {
    if (isZoomed) {
      setOffset({ x: 0, y: -120 }); 
    } else {
      setOffset({ x: 0, y: 0 });
    }
  }, [isZoomed]);



  const makePanHandlers = () => ({
    onMouseDown: (e: React.MouseEvent) => {
      if (zoom <= 1 && !isZoomed) return;
      panRef.current = {
        active: true,
        startX: e.clientX,
        startY: e.clientY,
        initialX: offset.x,
        initialY: offset.y
      };
      setPanning(true);
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (!panRef.current.active) return;
      const dx = e.clientX - panRef.current.startX;
      const dy = e.clientY - panRef.current.startY;
      setOffset({
        x: panRef.current.initialX + dx,
        y: panRef.current.initialY + dy
      });
    },
    onMouseUp: () => { panRef.current.active = false; setPanning(false); },
    onMouseLeave: () => { panRef.current.active = false; setPanning(false); },
  });

  return (
    <div style={{
      position: 'relative',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-xl)', overflow: 'hidden', flex: 1, minHeight: 0
    }}>
      {/* Header bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: layout === 'side' ? '4px 12px' : '8px 16px', 
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-raised)', zIndex: 10,
        minHeight: layout === 'side' ? 32 : 44
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>
          <Icon name="image" size={14} />
          <span style={{ 
            fontFamily: 'var(--font-mono)', color: 'var(--accent-500)', fontWeight: 700,
            fontSize: layout === 'side' ? 10 : 12,
            maxWidth: layout === 'side' ? 140 : 'none',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
          }}>
            #{(() => {
              const name = filename || 'cheque_image.jpg';
              return name.split(/[\\/]/).pop()?.split('?')[0] || name;
            })()}
          </span>
        </div>

        <div style={{ 
          display: 'flex', gap: 6, alignItems: 'center', background: 'var(--bg)', borderRadius: 'var(--r-md)', 
          border: '1px solid var(--border)', padding: '2px 4px',
          scale: layout === 'side' ? '0.8' : '1',
          transformOrigin: 'right center'
        }}>
          {/* Image Type Toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-subtle)', borderRadius: 'var(--r-sm)', padding: 2, marginRight: 4 }}>
            <button 
              onClick={() => setImageType && setImageType('bitonal')}
              style={{ 
                border: 'none', background: imageType === 'bitonal' ? 'var(--accent-500)' : 'transparent',
                color: imageType === 'bitonal' ? '#fff' : 'var(--fg-muted)',
                fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--r-xs)', cursor: 'pointer'
              }}
            >BW</button>
            <button 
              onClick={() => setImageType && setImageType('gray')}
              style={{ 
                border: 'none', background: imageType === 'gray' ? 'var(--accent-500)' : 'transparent',
                color: imageType === 'gray' ? '#fff' : 'var(--fg-muted)',
                fontSize: 9, fontWeight: 700, padding: '2px 6px', borderRadius: 'var(--r-xs)', cursor: 'pointer'
              }}
            >GRAY</button>
          </div>

          <IconBtn icon="zoom_out" tooltip="Zoom out" onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))} />
          <IconBtn icon="zoom_in" tooltip="Zoom in" onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))} />
          <IconBtn icon="fit_screen" tooltip="Reset" onClick={() => { setZoom(1); setRotation(0); setOffset({x:0, y:0}); }} />
          <IconBtn icon="fullscreen" tooltip="Fullscreen" onClick={() => setIsFullscreen && setIsFullscreen(true)} />
        </div>
      </div>

      {/* Viewer Area: Side-by-Side */}
      <div
        ref={viewerRef}
        {...makePanHandlers()}
        style={{
          flex: 1, position: 'relative', overflow: 'hidden',
          background: 'var(--bg)',
          backgroundImage: 'radial-gradient(circle at 25% 25%, var(--bg-subtle), var(--bg) 60%)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: (zoom > 1 || isZoomed) ? (panning ? 'grabbing' : 'grab') : 'default',
          touchAction: 'none', userSelect: 'none',
          padding: layout === 'side' ? '8px 12px' : 20, gap: layout === 'side' ? 8 : 24
        }}
      >
        <div style={{ 
          display: 'flex', 
          flexDirection: (layout === 'side' && !isZoomed) ? 'column' : 'row',
          gap: layout === 'side' ? 8 : 24, width: '100%', height: '100%', 
          justifyContent: 'center', alignItems: 'center',
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom}) rotate(${rotation}deg)`,
          transformOrigin: 'center center',
          transition: panning ? 'none' : 'transform 0.4s cubic-bezier(0.2, 0, 0.2, 1)'
        }}>
          <div style={{ 
            flex: (isZoomed || layout === 'side') ? 'none' : 1, 
            width: (isZoomed || layout === 'side') ? '100%' : 'auto', 
            maxWidth: isZoomed ? 1200 : (layout === 'side' ? 800 : '48%'), 
            maxHeight: (layout === 'side' && !isZoomed) ? '46%' : 'none',
            display: 'flex', flexDirection: 'column', gap: layout === 'side' ? 4 : 8 
          }}>
            {!isZoomed && <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.1em', textAlign: 'center' }}>FRONT</div>}
            <div style={{ position: 'relative', flex: 1, aspectRatio: '2.35 / 1', background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
              {!frontError && hasFrontPath ? (
                <img 
                  src={imageType === 'bitonal' ? previewFront || '' : (imageBaseName ? `${window.location.origin}/api/images/${imageBaseName}CF.jpg` : previewFront || '')} 
                  alt="Front" 
                  draggable={false}
                  style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
                  onError={() => setFrontError(true)}
                />
              ) : (
                <ImagePlaceholder label="FRONT" hasPath={hasFrontPath || frontError} />
              )}
            </div>
          </div>

          {/* Back Side - Hidden when zoomed */}
          {!isZoomed && (
            <div style={{ 
              flex: (layout === 'side') ? 'none' : 1, 
              width: (layout === 'side') ? '100%' : 'auto', 
              maxWidth: (layout === 'side' ? 800 : '48%'), 
              maxHeight: (layout === 'side') ? '46%' : 'none',
              display: 'flex', flexDirection: 'column', gap: layout === 'side' ? 4 : 8 
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.1em', textAlign: 'center' }}>BACK</div>
              <div style={{ position: 'relative', flex: 1, aspectRatio: '2.35 / 1', background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', overflow: 'hidden' }}>
                {!backError && hasBackPath ? (
                  <img 
                    src={imageType === 'bitonal' ? previewBack || '' : (imageBaseName ? `${window.location.origin}/api/images/${imageBaseName}CR.jpg` : previewBack || '')} 
                    alt="Back" 
                    draggable={false}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none', userSelect: 'none' }}
                    onError={() => setBackError(true)}
                  />
                ) : (
                  <ImagePlaceholder label="BACK" hasPath={hasBackPath || backError} />
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
