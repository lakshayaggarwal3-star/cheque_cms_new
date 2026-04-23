// =============================================================================
// File        : ScanViewport.tsx
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Center column of the scan layout — thumbnail sidebar toggle +
//               image viewer (zoom, flip, pan, navigation, fullscreen entry).
// =============================================================================

import React from 'react';
import { getImageUrl } from '../../utils/imageUtils';
import { type ScanSessionDto } from '../../types';
import { Icon, IconBtn, ImagePlaceholder, Pill } from '../../components/scan';
import { ScanStep } from './ScanPage.types';

interface Props {
  session: ScanSessionDto;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  activeSlipEntryId: number | null;
  activeGroup: any;
  scanStep: ScanStep;
  isSlipView: boolean;
  viewItems: any[];
  currentViewIdx: number;
  previewFront: string | undefined | null;
  previewBack: string | undefined | null;
  flipped: boolean;
  setFlipped: React.Dispatch<React.SetStateAction<boolean>>;
  zoom: number;
  setZoom: React.Dispatch<React.SetStateAction<number>>;
  panning: boolean;
  hasMoved: React.RefObject<boolean>;
  viewerRef: React.RefObject<HTMLDivElement | null>;
  makePanHandlers: (ref: React.RefObject<HTMLDivElement | null>) => any;
  setViewerFront: (v: string | null) => void;
  setViewerBack: (v: string | null) => void;
  setViewerType: (v: string | null) => void;
  setIsFullscreen: (v: boolean) => void;
  handleNavLeft: () => void;
  handleNavRight: () => void;
  batchDate?: string;
}

// ── Thumbnail Sidebar ─────────────────────────────────────────────────────────

function ThumbnailSidebar({ session, sidebarOpen, setSidebarOpen, setViewerFront, setViewerBack, setViewerType, setFlipped }: {
  session: ScanSessionDto;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  setViewerFront: (v: string | null) => void;
  setViewerBack: (v: string | null) => void;
  setViewerType: (v: string | null) => void;
  setFlipped: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  if (!sidebarOpen) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-raised)', borderRight: '1px solid var(--border)', overflowY: 'auto', gridRow: '1 / -1' }}>
      <div style={{
        padding: '0 8px 0 16px', height: 44, boxSizing: 'border-box',
        borderBottom: '1px solid var(--border)',
        fontSize: 10, fontWeight: 700, color: 'var(--fg-subtle)',
        textTransform: 'uppercase', letterSpacing: '.05em',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg-raised)',
      }}>
        <span>Recent Scans</span>
        <button
          onClick={() => setSidebarOpen(false)}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--fg-muted)', padding: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', width: 32, height: 32, borderRadius: 'var(--r-sm)',
            transition: 'color var(--dur-fast) var(--ease)'
          }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--fg)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-muted)'}
          title="Close sidebar"
        >
          <div style={{ width: 14, height: 10, position: 'relative' }}>
            <span style={{ position: 'absolute', left: 0, top: 0, height: 2, width: 14, background: 'currentColor', transformOrigin: 'center', transform: 'translateY(4px) rotate(45deg)', transition: 'all 0.25s ease', borderRadius: 1 }} />
            <span style={{ position: 'absolute', left: 0, top: 4, height: 2, width: 14, background: 'currentColor', opacity: 0, transition: 'all 0.25s ease', borderRadius: 1 }} />
            <span style={{ position: 'absolute', left: 0, top: 8, height: 2, width: 14, background: 'currentColor', transformOrigin: 'center', transform: 'translateY(-4px) rotate(-45deg)', transition: 'all 0.25s ease', borderRadius: 1 }} />
          </div>
        </button>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4, padding: 6, overflowY: 'auto' }}>
        {session?.slipGroups && session.slipGroups.length > 0 ? (
          [...session.slipGroups].reverse().flatMap(group => [
            ...(group.cheques ?? []).slice().reverse().map((chq: any, idx: number) => (
              <button
                key={`chq-${group.slipEntryId}-${idx}`}
                onClick={() => { setViewerFront(getImageUrl(chq.frontImagePath)); setViewerBack(chq.backImagePath ? getImageUrl(chq.backImagePath) : null); setViewerType('cheque'); setFlipped(false); }}
                title={`Chq #${String(chq.chqSeq).padStart(3, '0')}`}
                style={{ width: '100%', height: 70, padding: 3, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', overflow: 'hidden', flexShrink: 0, display: 'flex', gap: 2 }}
              >
                {chq.frontImagePath && <img src={getImageUrl(chq.frontImagePath)} alt="F" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 2 }} />}
              </button>
            )),
            ...(group.slipScans ?? []).slice().reverse().map((s: any, idx: number) => (
              <button
                key={`slip-${group.slipEntryId}-${idx}`}
                onClick={() => { setViewerFront(getImageUrl(s.imagePath)); setViewerBack(null); setViewerType('slip'); setFlipped(false); }}
                title={`Slip ${group.depositSlipNo || group.slipNo}`}
                style={{ width: '100%', height: 70, padding: 3, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', overflow: 'hidden', flexShrink: 0 }}
              >
                <img src={getImageUrl(s.imagePath)} alt="slip" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 2 }} />
              </button>
            )),
          ])
        ) : (
          <div style={{ padding: '12px 8px', fontSize: 'var(--text-xs)', color: 'var(--fg-faint)', textAlign: 'center' }}>
            No items yet
          </div>
        )}
      </div>
    </div>
  );
}

// ── ScanViewport ──────────────────────────────────────────────────────────────

export function ScanViewport({
  session, sidebarOpen, setSidebarOpen,
  activeGroup, scanStep, isSlipView,
  viewItems, currentViewIdx,
  previewFront, previewBack,
  flipped, setFlipped, zoom, setZoom,
  panning, hasMoved, viewerRef, makePanHandlers,
  setViewerFront, setViewerBack, setViewerType, setIsFullscreen,
  handleNavLeft, handleNavRight, batchDate,
}: Props) {
  return (
    <div style={{
      position: 'relative',
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg)', borderRight: '1px solid var(--border)',
      overflow: 'hidden',
      flex: 1, minHeight: 0,
    }}>
      {/* Column header: hamburger + active slip info */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-raised)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            style={{
              background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--fg-muted)', padding: 0, display: 'flex', alignItems: 'center',
              justifyContent: 'center', width: 28, height: 28, borderRadius: 'var(--r-sm)'
            }}
            title="Open sidebar"
          >
            <div style={{ width: 14, height: 10, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 0, top: 0, height: 2, width: 14, background: 'currentColor', transition: 'all 0.25s ease', borderRadius: 1 }} />
              <span style={{ position: 'absolute', left: 0, top: 4, height: 2, width: 14, background: 'currentColor', transition: 'all 0.25s ease', borderRadius: 1 }} />
              <span style={{ position: 'absolute', left: 0, top: 8, height: 2, width: 14, background: 'currentColor', transition: 'all 0.25s ease', borderRadius: 1 }} />
            </div>
          </button>
        )}

        {activeGroup ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', flex: 1, minWidth: 0 }}>
            {/* Deposit Slip No (First) */}
            <Pill icon="description" title="Deposit Slip No" style={{ flex: '0 1 auto', fontWeight: 600 }}>
              {activeGroup.depositSlipNo || activeGroup.slipNo || 'N/A'}
            </Pill>

            {/* Client Name */}
            {activeGroup.clientName && (
              <Pill icon="person" title="Client Name" style={{ flex: '1 1 auto', fontWeight: 600 }}>
                {activeGroup.clientName}
              </Pill>
            )}

            {/* Pickup Point (Code Only) */}
            <Pill icon="location_on" title="Pickup Point" style={{ flex: '0 1 auto', fontWeight: 600 }}>
              {(() => {
                const pp = (activeGroup as any).pickupPoint || '';
                return pp.split(' - ')[0] || 'N/A';
              })()}
            </Pill>

            {/* Slip Amount */}
            <Pill title="Slip Amount" style={{ flex: '0 1 auto', fontWeight: 600 }}>
              ₹{activeGroup.slipAmount.toLocaleString('en-IN')}
            </Pill>

            {/* Counts */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, flex: '1 1 auto' }}>
              <Pill icon="input" title="Expected cheques" style={{ flex: 1 }}>Exp: {(activeGroup as any).totalInstruments}</Pill>
              <Pill 
                icon="check_circle" 
                title="Scanned cheques" 
                mono
                color={(activeGroup as any).cheques?.length === (activeGroup as any).totalInstruments ? 'var(--success)' : undefined}
                style={{ flex: 1 }}
              >
                Scan: {(activeGroup as any).cheques?.length ?? 0}
              </Pill>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>No active slip</div>
        )}

      </div>

      {/* Image viewer area */}
      <div style={{
        position: 'relative', flex: 1,
        background: 'var(--bg)',
        backgroundImage: 'radial-gradient(circle at 25% 25%, var(--bg-subtle), var(--bg) 60%)',
        overflow: 'hidden',
      }}>
        {/* Top-left: sequence label */}
        <div style={{
          position: 'absolute', top: 16, left: 20, zIndex: 2,
          display: 'flex', gap: 8, alignItems: 'center',
          color: 'var(--fg-subtle)', fontSize: 'var(--text-xs)',
        }}>
          <Icon name="image" size={14} />
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg)', fontWeight: 500 }}>
            {(() => {
              const targetUrl = flipped ? previewBack : previewFront;
              if (targetUrl) {
                const name = targetUrl.split(/[\\/]/).pop()?.split('?')[0];
                if (name && !name.includes('placeholder') && !name.includes('data:')) return name;
              }
              return isSlipView ? 'slip_capture.jpg' : (flipped ? 'cheque_back.jpg' : 'cheque_front.jpg');
            })()}
          </span>
          <span>·</span>
          <span>{isSlipView ? 'Slip' : (() => {
            const item = viewItems[currentViewIdx] as any;
            return item ? `Cheque #${String(item.chqSeq || 0).padStart(3, '0')}` : 'Cheque';
          })()}</span>
          <span>·</span>
          <span style={{
            padding: '2px 7px', borderRadius: 'var(--r-full)',
            fontSize: 'var(--text-xs)', fontWeight: 500,
            background: 'var(--bg-subtle)', color: 'var(--fg-muted)',
            border: '1px solid var(--border)',
          }}>
            {flipped ? 'Back' : 'Front'}
          </span>
        </div>

        {/* Top-right: zoom + flip controls */}
        <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 2, display: 'flex', gap: 2, background: 'var(--bg-raised)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: 2 }}>
          <IconBtn icon="zoom_out" tooltip="Zoom out" onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))} />
          <IconBtn icon="zoom_in" tooltip="Zoom in" onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))} />
          <IconBtn icon="fit_screen" tooltip="Reset zoom" onClick={() => setZoom(1)} />
          {!isSlipView && (
            <IconBtn icon="flip" tooltip="Flip (click image)" onClick={() => setFlipped(f => !f)} />
          )}
          <IconBtn icon="fullscreen" tooltip="Fullscreen" onClick={() => setIsFullscreen(true)} />
        </div>

        {/* The Image Viewport */}
        <div
          ref={viewerRef}
          {...makePanHandlers(viewerRef)}
          style={{
            width: '100%', height: '100%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: panning ? 'grabbing' : 'grab',
            touchAction: 'none',
          }}
          onClick={(e) => {
            if (!hasMoved.current && !isSlipView && e.detail === 1) {
              setFlipped(f => !f);
            }
          }}
        >
          {(() => {
            const currentImg = flipped ? previewBack : previewFront;
            if (currentImg) {
              return (
                <div style={{
                  position: 'relative',
                  transform: `scale(${zoom})`,
                  transition: panning ? 'none' : 'transform 0.2s ease-out',
                  transformOrigin: 'center',
                  boxShadow: 'var(--shadow-2xl)',
                }}>
                  <img
                    src={currentImg}
                    alt="Scan"
                    onError={() => {
                      // If image fails to load, we can force fallback to placeholder
                      if (flipped) setViewerBack(null);
                      else setViewerFront(null);
                    }}
                    style={{
                      maxHeight: '85vh', maxWidth: '90vw',
                      display: 'block', borderRadius: 4,
                      pointerEvents: 'none', userSelect: 'none',
                    }}
                  />
                </div>
              );
            }
            const item = viewItems[currentViewIdx] as any;
            const hasPath = !!(item ? (isSlipView ? item.imagePath : (flipped ? item.backImagePath : item.frontImagePath)) : null);
            return <ImagePlaceholder 
              label={isSlipView ? 'SLIP IMAGE' : (flipped ? 'BACK' : 'FRONT')} 
              hasPath={hasPath}
            />;
          })()}
        </div>

        {/* Navigation Arrows */}
        {viewItems.length > 1 && (
          <>
            <div style={{ position: 'absolute', left: 20, top: '50%', transform: 'translateY(-50%)', zIndex: 3 }}>
              <IconBtn icon="chevron_left" tooltip="Previous" onClick={handleNavLeft} />
            </div>
            <div style={{ position: 'absolute', right: 20, top: '50%', transform: 'translateY(-50%)', zIndex: 3 }}>
              <IconBtn icon="chevron_right" tooltip="Next" onClick={handleNavRight} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export { ThumbnailSidebar };
