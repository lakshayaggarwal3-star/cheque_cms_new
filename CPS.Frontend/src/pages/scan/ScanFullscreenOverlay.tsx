// =============================================================================
// File        : ScanFullscreenOverlay.tsx
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Black fullscreen image viewer overlay (fixed inset: 0).
// =============================================================================

import React from 'react';
import { type ScanSessionDto } from '../../types';
import { IconBtn, ImagePlaceholder } from '../../components/scan';

interface Props {
  session: ScanSessionDto;
  isSlipView: boolean;
  scanStep: string;
  previewFront: string | undefined | null;
  previewBack: string | undefined | null;
  flipped: boolean;
  setFlipped: React.Dispatch<React.SetStateAction<boolean>>;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  nextChqSeq: number;
  panning: boolean;
  hasMoved: React.RefObject<boolean>;
  fsPanOffset: { x: number; y: number };
  setFsPanOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  viewerFsRef: React.RefObject<HTMLDivElement | null>;
  makePanHandlers: (setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>) => any;
  onClose: () => void;
}

export function ScanFullscreenOverlay({
  session, isSlipView, scanStep,
  previewFront, previewBack,
  flipped, setFlipped,
  zoom, setZoom,
  nextChqSeq, panning, hasMoved,
  fsPanOffset, setFsPanOffset, viewerFsRef, makePanHandlers, onClose,
}: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000', zIndex: 1000,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        padding: '8px 16px', background: 'rgb(0 0 0 / 80%)', flexShrink: 0, gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgb(255 255 255 / 8%)', borderRadius: 'var(--r-md)', padding: 4 }}>
          <IconBtn icon="zoom_out" tooltip="Zoom out" onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))} />
          <span style={{ fontSize: 'var(--text-xs)', color: '#aaa', minWidth: 36, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(zoom * 100)}%
          </span>
          <IconBtn icon="zoom_in" tooltip="Zoom in" onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))} />
          <IconBtn icon="fit_screen" tooltip="Reset zoom" onClick={() => { setZoom(1); setFsPanOffset({ x: 0, y: 0 }); }} />
          {!isSlipView && (
            <IconBtn icon="flip" tooltip="Flip" onClick={() => setFlipped(f => !f)} />
          )}
          <span style={{ width: 1, height: 18, background: 'rgb(255 255 255 / 20%)', margin: '0 4px' }} />
          <IconBtn icon="fullscreen_exit" tooltip="Exit fullscreen" onClick={onClose} />
        </div>
      </div>

      {/* Pannable image area — overflow:hidden, image moves via translate+scale */}
      <div
        ref={viewerFsRef}
        {...makePanHandlers(setFsPanOffset)}
        style={{
          flex: 1, overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: panning ? 'grabbing' : 'grab',
          userSelect: 'none', touchAction: 'none',
        }}
        onClick={() => !isSlipView && !hasMoved.current && setFlipped(f => !f)}
      >
        {(previewFront || previewBack) ? (
          <img
            src={flipped ? (previewBack ?? previewFront ?? '') : (previewFront ?? '')}
            alt={flipped ? 'Back' : 'Front'}
            style={{
              maxHeight: '94%', maxWidth: '94%',
              display: 'block', borderRadius: 6,
              pointerEvents: 'none', userSelect: 'none', flexShrink: 0,
              transform: `translate(${fsPanOffset.x}px, ${fsPanOffset.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: panning ? 'none' : 'transform 0.15s ease-out',
            }}
          />
        ) : (
          <ImagePlaceholder label={isSlipView ? 'SLIP IMAGE' : (flipped ? 'BACK' : 'FRONT')} />
        )}
      </div>
    </div>
  );
}
