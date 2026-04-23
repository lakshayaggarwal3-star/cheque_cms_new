// =============================================================================
// File        : ScanFullscreenOverlay.tsx
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Black fullscreen image viewer overlay (fixed inset: 0).
// =============================================================================

import React from 'react';
import { type ScanSessionDto } from '../../types';
import { Icon, IconBtn, ImagePlaceholder } from '../../components/scan';

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
  viewerFsRef: React.RefObject<HTMLDivElement | null>;
  makePanHandlers: (ref: React.RefObject<HTMLDivElement | null>) => any;
  onClose: () => void;
}

export function ScanFullscreenOverlay({
  session, isSlipView, scanStep,
  previewFront, previewBack,
  flipped, setFlipped,
  zoom, setZoom,
  nextChqSeq, panning, hasMoved,
  viewerFsRef, makePanHandlers, onClose,
}: Props) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#000', zIndex: 1000,
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 16px', background: 'rgb(0 0 0 / 80%)', flexShrink: 0, gap: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ccc', fontSize: 'var(--text-xs)' }}>
          <Icon name="image" size={14} style={{ color: '#aaa' }} />
          <span>Sequence</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: '#fff', fontWeight: 500 }}>
            #{String(Math.max(1, nextChqSeq - 1)).padStart(4, '0')}
          </span>
          <span style={{
            padding: '2px 7px', borderRadius: 'var(--r-full)',
            fontSize: 'var(--text-xs)', fontWeight: 500,
            background: 'rgb(255 255 255 / 10%)',
            color: '#aaa',
            border: 'rgb(255 255 255 / 15%)',
          }}>
            {isSlipView ? 'Slip' : flipped ? 'Back' : 'Front'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgb(255 255 255 / 8%)', borderRadius: 'var(--r-md)', padding: 4 }}>
          <IconBtn icon="zoom_out" tooltip="Zoom out" onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))} />
          <span style={{ fontSize: 'var(--text-xs)', color: '#aaa', minWidth: 36, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
            {Math.round(zoom * 100)}%
          </span>
          <IconBtn icon="zoom_in" tooltip="Zoom in" onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))} />
          <IconBtn icon="fit_screen" tooltip="Reset zoom" onClick={() => setZoom(1)} />
          {!isSlipView && (
            <IconBtn icon="flip" tooltip="Flip" onClick={() => setFlipped(f => !f)} />
          )}
          <span style={{ width: 1, height: 18, background: 'rgb(255 255 255 / 20%)', margin: '0 4px' }} />
          <IconBtn icon="fullscreen_exit" tooltip="Exit fullscreen" onClick={onClose} />
        </div>
      </div>

      {/* Scrollable / pannable image */}
      <div
        ref={viewerFsRef}
        {...makePanHandlers(viewerFsRef)}
        style={{ flex: 1, overflow: 'auto', display: 'flex', padding: 32, cursor: panning ? 'grabbing' : 'grab', userSelect: 'none' }}
      >
        <div style={{
          margin: 'auto',
          width: `${Math.round(100 * zoom)}%`,
          height: `${Math.round(100 * zoom)}%`,
          minWidth: '100%', minHeight: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
          transition: 'width 0.15s ease, height 0.15s ease',
        }}>
          <div
            style={{
              position: 'relative', width: '100%', height: '100%',
              transformStyle: 'preserve-3d',
              perspective: '2000px',
              transition: 'transform var(--dur-slow) var(--ease)',
              transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
              cursor: !isSlipView ? (panning ? 'grabbing' : 'pointer') : (panning ? 'grabbing' : 'default'),
            }}
            onClick={() => !isSlipView && !hasMoved.current && setFlipped(f => !f)}
          >
            <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              {previewFront
                ? <img src={previewFront} alt="Front" style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                : <ImagePlaceholder label={isSlipView ? 'SLIP IMAGE' : 'FRONT'} />}
            </div>
            {!isSlipView && (
              <div style={{
                position: 'absolute', inset: 0,
                backfaceVisibility: 'hidden',
                transform: 'rotateY(180deg)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {previewBack
                  ? <img src={previewBack} alt="Back" style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                  : <ImagePlaceholder label="BACK" />}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom nav */}
      {scanStep !== 'SlipScan' && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '8px 16px', background: 'rgb(0 0 0 / 80%)', flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgb(255 255 255 / 8%)', borderRadius: 'var(--r-full)', padding: '4px 8px' }}>
            <IconBtn icon="chevron_left" size={28} />
            <span style={{ fontSize: 'var(--text-xs)', color: '#aaa', padding: '0 4px', fontVariantNumeric: 'tabular-nums' }}>
              {Math.max(1, nextChqSeq - 1)} / {session.totalCheques || '—'}
            </span>
            <IconBtn icon="chevron_right" size={28} />
            <span style={{ width: 1, height: 18, background: 'rgb(255 255 255 / 20%)', margin: '0 2px' }} />
            <IconBtn icon="delete" tooltip="Delete sequence" size={28} />
            <IconBtn icon="flag" tooltip="Flag for RR" size={28} />
          </div>
        </div>
      )}
    </div>
  );
}
