// =============================================================================
// File        : ScanViewport.tsx
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Center column of the scan layout — thumbnail sidebar toggle +
//               image viewer (zoom, flip, pan, navigation, fullscreen entry).
// =============================================================================

import React from 'react';
import { getChequeImageUrl, getSlipImageUrl } from '../../utils/imageUtils';
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
  panOffset: { x: number; y: number };
  setPanOffset: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>;
  viewerRef: React.RefObject<HTMLDivElement | null>;
  makePanHandlers: (setPan: React.Dispatch<React.SetStateAction<{ x: number; y: number }>>) => any;
  setIsFullscreen: (v: boolean) => void;
  handleNavLeft: () => void;
  handleNavRight: () => void;
  setViewerFront: (v: string | null) => void;
  setViewerBack: (v: string | null) => void;
  setViewerType: (v: string | null) => void;
}

// ── Thumbnail Sidebar ─────────────────────────────────────────────────────────

function ThumbnailSidebar({ session, sidebarOpen, setSidebarOpen, setViewerFront, setViewerBack, setViewerType, setFlipped, viewerFront }: {
  session: ScanSessionDto;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  setViewerFront: (v: string | null) => void;
  setViewerBack: (v: string | null) => void;
  setViewerType: (v: string | null) => void;
  setFlipped: React.Dispatch<React.SetStateAction<boolean>>;
  viewerFront: string | null | undefined;
}) {
  const [expandedGroups, setExpandedGroups] = React.useState<Record<number, boolean>>({});

  React.useEffect(() => {
    if (session?.slipGroups) {
      const initial: Record<number, boolean> = {};
      session.slipGroups.forEach(g => { initial[g.slipEntryId] = true; });
      setExpandedGroups(prev => ({ ...initial, ...prev }));
    }
  }, [session?.slipGroups]);

  if (!sidebarOpen) return null;

  const toggleGroup = (id: number) => {
    setExpandedGroups(prev => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    /* Absolute overlay — does NOT affect viewport column width */
    <div style={{
      width: 172,
      display: 'flex', flexDirection: 'column',
      background: 'var(--bg-raised)', borderRight: '1px solid var(--border)',
      overflow: 'hidden',
      flexShrink: 0,
      animation: 'slideIn 0.2s ease-out',
    }}>
      <div style={{
        padding: '0 6px 0 14px', height: 44, boxSizing: 'border-box',
        borderBottom: '1px solid var(--border)',
        fontSize: 10, fontWeight: 700, color: 'var(--fg-subtle)',
        textTransform: 'uppercase', letterSpacing: '.05em',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'var(--bg-raised)', flexShrink: 0,
      }}>
        <span>Recent Scans</span>
        <button
          onClick={() => setSidebarOpen(false)}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: 'var(--fg-muted)', padding: 0, display: 'flex', alignItems: 'center',
            justifyContent: 'center', width: 32, height: 32, borderRadius: 'var(--r-sm)',
          }}
          title="Close sidebar"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>menu_open</span>
        </button>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, padding: '10px 8px', overflowY: 'auto' }}>
        {session?.slipGroups && session.slipGroups.length > 0 ? (
          [...session.slipGroups].reverse().map(group => {
            const hasItems = (group.cheques?.length ?? 0) > 0 || (group.slipItems?.length ?? 0) > 0;
            if (!hasItems) return null;

            const isExpanded = expandedGroups[group.slipEntryId] ?? true;

            return (
              <div key={group.slipEntryId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {/* Section Header for the Slip — Collapsible */}
                <button 
                  onClick={() => toggleGroup(group.slipEntryId)}
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: 4, 
                    padding: '4px 6px', background: 'var(--bg-subtle)', borderRadius: 6,
                    border: '1px solid var(--border-subtle)', cursor: 'pointer',
                    width: '100%', textAlign: 'left',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ 
                    fontSize: 14, color: 'var(--accent-500)',
                    transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
                    transition: 'transform 0.2s ease'
                  }}>expand_more</span>
                  <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--fg-muted)', flex: 1, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {group.depositSlipNo || group.slipNo || 'N/A'}
                  </span>
                </button>

                {/* Grid of items for this slip */}
                {isExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4, borderLeft: '1px solid var(--border-subtle)', marginLeft: 6 }}>
                  {/* Cheques */}
                  {group.cheques && [...group.cheques].reverse().map((chq: any, idx: number) => {
                    const isViewed = viewerFront === getChequeImageUrl(chq, 'front');
                    return (
                      <button
                        key={`chq-${chq.chequeItemId || idx}`}
                        onClick={() => { setViewerFront(getChequeImageUrl(chq, 'front')); setViewerBack(getChequeImageUrl(chq, 'back')); setViewerType('cheque'); setFlipped(false); }}
                        style={{ 
                          width: '100%', padding: 4, background: isViewed ? 'var(--bg-subtle)' : 'var(--bg)', 
                          border: `1px solid ${isViewed ? 'var(--accent-500)' : 'var(--border)'}`, 
                          borderRadius: 'var(--r-md)', cursor: 'pointer', overflow: 'hidden', 
                          display: 'flex', flexDirection: 'column', gap: 4,
                          transition: 'all 0.15s ease',
                          boxShadow: isViewed ? '0 0 0 1px var(--accent-500)' : 'none',
                        }}
                      >
                        <div style={{ width: '100%', height: 64, overflow: 'hidden', borderRadius: 'var(--r-sm)', background: 'var(--bg-subtle)' }}>
                          {chq.imageBaseName ? (
                            <img src={getChequeImageUrl(chq, 'front')} alt="chq" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          ) : (
                            <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--fg-faint)' }}>payments</span>
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-500)' }}>Chq</span>
                            <span style={{ fontSize: 9, fontWeight: 700, color: isViewed ? 'var(--fg)' : 'var(--fg-muted)' }}>#{String(chq.chqSeq).padStart(3, '0')}</span>
                          </div>
                          {chq.chqNo && (
                            <span style={{ fontSize: 8, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>{chq.chqNo}</span>
                          )}
                        </div>
                      </button>
                    );
                  })}

                    {/* Slips */}
                    {group.slipItems && [...group.slipItems].reverse().map((s: any, sIdx: number) => {
                      const isViewed = viewerFront === getSlipImageUrl(s);
                      return (
                        <button
                          key={`slip-${s.slipItemId || sIdx}`}
                          onClick={() => { setViewerFront(getSlipImageUrl(s)); setViewerBack(null); setViewerType('slip'); setFlipped(false); }}
                          style={{ 
                            width: '100%', padding: 4, background: isViewed ? 'var(--bg-subtle)' : 'var(--bg)', 
                            border: `1px solid ${isViewed ? 'var(--accent-500)' : 'var(--border)'}`, 
                            borderRadius: 'var(--r-md)', cursor: 'pointer', overflow: 'hidden', 
                            display: 'flex', flexDirection: 'column', gap: 4,
                            transition: 'all 0.15s ease',
                            boxShadow: isViewed ? '0 0 0 1px var(--accent-500)' : 'none',
                          }}
                        >
                          <div style={{ width: '100%', height: 64, overflow: 'hidden', borderRadius: 'var(--r-sm)', background: 'var(--bg-subtle)' }}>
                            <img src={getSlipImageUrl(s)} alt="slip" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3, padding: '0 2px' }}>
                            <span style={{ fontSize: 10, fontWeight: 700, color: isViewed ? 'var(--fg)' : 'var(--fg-subtle)' }}>Slip</span>
                            <span style={{ fontSize: 9, fontWeight: 700, color: isViewed ? 'var(--fg)' : 'var(--fg-muted)' }}>#{String(sIdx + 1).padStart(2, '0')}</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        ) : (
          <div style={{ padding: '24px 8px', textAlign: 'center' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--fg-faint)', marginBottom: 8 }}>history</span>
            <div style={{ fontSize: 11, color: 'var(--fg-faint)' }}>No items yet</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── ScanViewport ──────────────────────────────────────────────────────────────

export function ScanViewport({
  session, sidebarOpen, setSidebarOpen,
  activeGroup, isSlipView,
  viewItems, currentViewIdx,
  previewFront, previewBack,
  flipped, setFlipped, zoom, setZoom,
  panning, hasMoved, panOffset, setPanOffset, viewerRef, makePanHandlers,
  setIsFullscreen,
  handleNavLeft, handleNavRight,
  setViewerFront, setViewerBack, setViewerType,
}: Props) {
  // Track the exact pixel size of the image viewer area so images always fit,
  // regardless of sidebar state or window size — updated via ResizeObserver.
  const [viewerDims, setViewerDims] = React.useState({ w: 900, h: 500 });
  React.useEffect(() => {
    if (!viewerRef.current) return;
    const ro = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      setViewerDims({ w: Math.floor(width), h: Math.floor(height) });
    });
    ro.observe(viewerRef.current);
    return () => ro.disconnect();
  }, [viewerRef]);

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
        padding: '8px 24px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-raised)', flexShrink: 0, flexWrap: 'nowrap',
        overflow: 'hidden', zIndex: 10,
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
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>menu</span>
          </button>
        )}
        {/* ... activeGroup info ... */}


        {activeGroup ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'nowrap', flex: 1, minWidth: 0, overflow: 'hidden' }}>
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              <Pill icon="input" title="Total cheques">Total: {(activeGroup as any).totalInstruments}</Pill>
              <Pill
                icon="check_circle"
                title="Scanned cheques"
                mono
                color={(activeGroup as any).cheques?.length === (activeGroup as any).totalInstruments ? 'var(--success)' : undefined}
              >
                Scan: {(activeGroup as any).cheques?.length ?? 0}
              </Pill>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>No active slip</div>
        )}
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0, position: 'relative' }}>
        {/* Thumbnail sidebar — occupies space in the row */}
        <ThumbnailSidebar
          session={session}
          sidebarOpen={sidebarOpen}
          setSidebarOpen={setSidebarOpen}
          setViewerFront={setViewerFront}
          setViewerBack={setViewerBack}
          setViewerType={setViewerType}
          setFlipped={setFlipped}
          viewerFront={previewFront}
        />

        {/* Image viewer area — takes remaining space */}
        <div style={{
          position: 'relative', flex: 1,
          background: 'var(--bg)',
          backgroundImage: 'radial-gradient(circle at 25% 25%, var(--bg-subtle), var(--bg) 60%)',
          overflow: 'hidden',
        }}>
          {/* Top-left: sequence label */}
          <div style={{
            position: 'absolute', top: 16, left: 32, zIndex: 2,
            display: 'flex', gap: 6, alignItems: 'center',
            padding: '4px 10px',
            background: 'var(--bg-raised)',
            borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)',
            color: 'var(--fg)',
            fontSize: 11,
            boxShadow: 'var(--shadow-sm)',
          }}>
            <Icon name="image" size={14} style={{ color: 'var(--accent-400)' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {(() => {
                const targetUrl = flipped ? previewBack : previewFront;
                if (targetUrl) {
                  const name = targetUrl.split(/[\\/]/).pop()?.split('?')[0];
                  if (name && !name.includes('placeholder') && !name.includes('data:')) return name;
                }
                return isSlipView ? 'slip_capture.jpg' : (flipped ? 'cheque_back.jpg' : 'cheque_front.jpg');
              })()}
            </span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{ fontWeight: 600 }}>
              {isSlipView ? 'Slip' : (() => {
                const item = viewItems[currentViewIdx] as any;
                return item ? `Cheque #${String(item.chqSeq || 0).padStart(3, '0')}` : 'Cheque';
              })()}
            </span>
            <span style={{ opacity: 0.4 }}>·</span>
            <span style={{
              fontSize: 10, fontWeight: 800,
              textTransform: 'uppercase',
              color: 'var(--accent-400)',
              letterSpacing: '0.02em',
            }}>
              {flipped ? 'Back' : 'Front'}
            </span>
          </div>

          {/* Top-right: zoom + flip controls */}
          <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 2, display: 'flex', gap: 2, background: 'var(--bg-raised)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: 2 }}>
            <IconBtn icon="zoom_out" tooltip="Zoom out" onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))} />
            <IconBtn icon="zoom_in" tooltip="Zoom in" onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))} />
            <IconBtn icon="fit_screen" tooltip="Reset zoom" onClick={() => { setZoom(1); setPanOffset({ x: 0, y: 0 }); }} />
            {!isSlipView && (
              <IconBtn icon="flip" tooltip="Flip (click image)" onClick={() => setFlipped(f => !f)} />
            )}
            <IconBtn icon="fullscreen" tooltip="Fullscreen" onClick={() => setIsFullscreen(true)} />
          </div>

          {/* The Image Viewport — overflow:hidden; image pans via transform */}
          <div
            ref={viewerRef}
            {...makePanHandlers(setPanOffset)}
            style={{
              width: '100%', height: '100%',
              overflow: 'hidden',
              position: 'relative',
              cursor: panning ? 'grabbing' : 'grab',
              touchAction: 'none', userSelect: 'none',
            }}
          >
            {(() => {
              const hasFront = !!previewFront;
              const hasBack = !!previewBack;
              // Exact pixel constraints from ResizeObserver — updates whenever sidebar opens/closes.
              const imgMaxW = viewerDims.w - 40;   // 20px breathing room each side
              const imgMaxH = Math.floor(viewerDims.h * 0.9);

              if (hasFront || hasBack) {
                return (
                  /* Pan + zoom wrapper — absolute centering avoids the flex left-clip bug
                     where justify-content:center pins overflowing children to the left edge */
                  <div style={{
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    transform: `translate(calc(-50% + ${panOffset.x}px), calc(-50% + ${panOffset.y}px)) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: panning ? 'none' : 'transform 0.15s ease-out',
                    transformStyle: 'preserve-3d',
                  }}>
                    {/* 3-D flip card — click only on this, not on background */}
                    <div
                      style={{
                        position: 'relative',
                        transformStyle: 'preserve-3d',
                        transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                        transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
                        borderRadius: 4,
                        boxShadow: 'var(--shadow-2xl)',
                        cursor: isSlipView ? 'default' : 'pointer',
                      }}
                      onClick={() => {
                        if (!hasMoved.current && !isSlipView) setFlipped(f => !f);
                      }}
                    >
                      {/* Front face */}
                      <img
                        src={previewFront ?? ''}
                        alt="Front"
                        style={{
                          display: 'block', borderRadius: 4,
                          maxHeight: imgMaxH, maxWidth: imgMaxW,
                          pointerEvents: 'none', userSelect: 'none',
                          backfaceVisibility: 'hidden',
                          WebkitBackfaceVisibility: 'hidden',
                        }}
                      />
                      {/* Back face */}
                      {!isSlipView && (
                        <img
                          src={hasBack ? (previewBack ?? '') : (previewFront ?? '')}
                          alt="Back"
                          style={{
                            display: 'block', borderRadius: 4,
                            maxHeight: imgMaxH, maxWidth: imgMaxW,
                            pointerEvents: 'none', userSelect: 'none',
                            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
                            objectFit: 'cover',
                            backfaceVisibility: 'hidden',
                            WebkitBackfaceVisibility: 'hidden',
                            transform: 'rotateY(180deg)',
                          }}
                        />
                      )}
                    </div>
                  </div>
                );
              }
              const item = viewItems[currentViewIdx] as any;
              const hasPath = !!(item?.imageBaseName);

              if (isSlipView) {
                return (
                  <div style={{
                    position: 'absolute', top: '50%', left: '50%',
                    transform: `translate(calc(-50% + ${panOffset.x}px), calc(-50% + ${panOffset.y}px)) scale(${zoom})`,
                    transformOrigin: 'center center',
                    transition: panning ? 'none' : 'transform 0.15s ease-out',
                    width: 360,
                    height: 560,
                  }}>
                    <ImagePlaceholder label="SLIP IMAGE" hasPath={hasPath} />
                  </div>
                );
              }

              return (
                <div style={{
                  position: 'absolute',
                  top: '50%',
                  left: '50%',
                  transform: `translate(calc(-50% + ${panOffset.x}px), calc(-50% + ${panOffset.y}px)) scale(${zoom})`,
                  transformOrigin: 'center center',
                  transition: panning ? 'none' : 'transform 0.15s ease-out',
                  transformStyle: 'preserve-3d',
                }}>
                  <div
                    style={{
                      position: 'relative',
                      transformStyle: 'preserve-3d',
                      transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
                      transition: 'transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)',
                      cursor: 'pointer',
                      width: 660,
                      height: 310,
                    }}
                    onClick={() => setFlipped(f => !f)}
                  >
                    <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}>
                      <ImagePlaceholder label="FRONT" hasPath={hasPath} />
                    </div>
                    <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                      <ImagePlaceholder label="BACK" hasPath={hasPath} />
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Bottom Navigation Pill */}
          {viewItems.length > 0 && (
            <div style={{
              position: 'absolute', bottom: 28, left: '50%', transform: 'translateX(-50%)', zIndex: 10,
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '4px 8px',
              background: 'var(--bg-raised)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--r-full)',
              boxShadow: 'var(--shadow-xl)',
            }}>
              <IconBtn
                icon="chevron_left"
                size={28}
                onClick={handleNavLeft}
                disabled={currentViewIdx === 0}
              />

              <div style={{
                height: 18, width: 1,
                background: 'var(--border)',
                margin: '0 4px'
              }} />

              <span style={{
                fontSize: 10, fontWeight: 700, color: 'var(--fg)',
                minWidth: 44, textAlign: 'center', userSelect: 'none',
                fontFamily: 'var(--font-mono)', letterSpacing: '0.02em',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2
              }}>
                <span style={{ color: 'var(--accent-400)' }}>
                  {currentViewIdx === -1 || currentViewIdx === viewItems.length ? 'LATEST SCAN' : (currentViewIdx + 1)}
                </span>
                <span style={{ opacity: 0.3, fontSize: 8 }}>/</span>
                <span style={{ opacity: 0.6 }}>{viewItems.length}</span>
              </span>

              <div style={{
                height: 18, width: 1,
                background: 'var(--border)',
                margin: '0 4px'
              }} />

              <IconBtn
                icon="chevron_right"
                size={28}
                onClick={handleNavRight}
                disabled={currentViewIdx === viewItems.length || (currentViewIdx === -1 && viewItems.length > 0)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export { ThumbnailSidebar };

