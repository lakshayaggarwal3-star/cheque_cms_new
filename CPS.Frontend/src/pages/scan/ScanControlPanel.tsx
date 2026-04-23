// =============================================================================
// File        : ScanControlPanel.tsx
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Right panel — flatbed status banner, scan controls per step,
//               recent sequences accordion, and "View all" button.
// =============================================================================

import React from 'react';
import { getImageUrl } from '../../utils/imageUtils';
import { type ScanSessionDto } from '../../types';
import {
  Icon, IconBtn, ControlCard, DevMockSection, ScanItemsTable,
} from '../../components/scan';
import { CameraCapture } from '../../components/CameraCapture';
import { RangerFeedControl } from '../../components/RangerFeedControl';
import { ScanStep } from './ScanPage.types';

interface Props {
  session: ScanSessionDto;
  scanner: any; // ReturnType<typeof useScannerLogic>
  scanStep: ScanStep;
  activeSlipEntryId: number | null;
  activeGroup: any;
  slipScansForActive: any[];
  canMoveToChequeScan: boolean;
  withSlip: boolean;
  isDeveloper: boolean | undefined;
  mockScanEnabled: boolean;
  completing: boolean;
  frontFile: File | null;
  backFile: File | null;
  frontPreview: string | null;
  backPreview: string | null;
  showTable: boolean;
  setShowTable: React.Dispatch<React.SetStateAction<boolean>>;
  expandedGroups: Record<string, boolean>;
  setExpandedGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  viewerFront: string | null;
  setViewerFront: (v: string | null) => void;
  setViewerBack: (v: string | null) => void;
  setViewerType: (v: string | null) => void;
  setFlipped: React.Dispatch<React.SetStateAction<boolean>>;
  setActiveSlipEntryId: (id: number | null) => void;
  setScanStep: (step: ScanStep) => void;
  setShowSlipForm: (v: boolean) => void;
  setConfirmComplete: (v: 'slip' | 'cheque' | null) => void;
  openImageEditor: (file: File, target: 'slip-front' | 'cheque-front' | 'cheque-back') => void;
  startNewSlip: () => void;
  onImageSelect: (front: string, back: string | undefined, type: string | undefined) => void;
}

// ── Flatbed scanner status banner ─────────────────────────────────────────────

function FlatbedStatusBanner({ scanner, scanStep }: { scanner: any; scanStep: ScanStep }) {
  if (!scanner.useFlatbedWs || scanner.flatbedStatus === 'idle' || scanStep !== 'SlipScan') return null;

  return (
    <div style={{
      flexShrink: 0,
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '9px 14px',
      borderBottom: '1px solid var(--border)',
      borderLeft: `3px solid ${scanner.flatbedStatus === 'error' ? 'var(--danger)' : 'var(--border-strong)'}`,
      background: scanner.flatbedStatus === 'error' ? 'var(--danger-bg, #fff1f0)' : 'var(--bg-raised)',
    }}>
      <span className="material-symbols-outlined" style={{
        fontSize: 15, marginTop: 1, flexShrink: 0,
        fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 15`,
        color: scanner.flatbedStatus === 'error' ? 'var(--danger)' : 'var(--fg-muted)',
        animation: scanner.flatbedStatus === 'connecting' ? 'spin 1s linear infinite' : 'none',
      }}>
        {scanner.flatbedStatus === 'connecting' ? 'sync' : scanner.flatbedStatus === 'ready' ? 'scanner' : 'error'}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {scanner.flatbedStatus === 'connecting' && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>Connecting to scanner…</span>
        )}
        {scanner.flatbedStatus === 'ready' && (
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg)', fontWeight: 500 }}>
            {scanner.selectedScannerId || 'Scanner ready'}
          </span>
        )}
        {scanner.flatbedStatus === 'error' && (
          <>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--danger)' }}>Scanner not available</div>
            <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2, wordBreak: 'break-word', opacity: 0.85 }}>{scanner.flatbedError}</div>
          </>
        )}
      </div>
      {scanner.flatbedStatus === 'error' && (
        <button
          onClick={scanner.handleDetectScanners}
          disabled={scanner.flatbedConnecting}
          className="btn-ghost"
          style={{ fontSize: 'var(--text-xs)', height: 24, padding: '0 8px', flexShrink: 0, color: 'var(--danger)' }}
        >
          Retry
        </button>
      )}
    </div>
  );
}

// ── Ranger scanner status banner ─────────────────────────────────────────────

function RangerStatusBanner({ scanner, scanStep }: { scanner: any; scanStep: ScanStep }) {
  if (scanner.rangerState === 0 || scanStep !== 'ChequeScan') return null;

  const rangerState = scanner.rangerState;
  const isError = rangerState === 6;
  const isReady = rangerState === 4;
  const isFeeding = rangerState === 5;

  const getStatusInfo = () => {
    switch (rangerState) {
      case 1: return { label: 'Starting Up...', sub: 'Initializing connection...', color: 'var(--fg-muted)', icon: 'sync' };
      case 2: return { label: 'Configuring...', sub: 'Setting capture options...', color: 'var(--fg-muted)', icon: 'settings' };
      case 3: return { label: 'Enabling...', sub: 'Activating sensors...', color: 'var(--fg-muted)', icon: 'power' };
      case 4: return { label: 'Ready to Feed', sub: 'Hopper is ready for feed.', color: '#f59e0b', icon: 'scanner' };
      case 5: return { label: 'Feeding Cheques...', sub: 'Items are being captured.', color: '#22c55e', icon: 'sync' };
      case 6: return { label: 'Ranger Exception', sub: 'Please check hardware connections.', color: 'var(--danger)', icon: 'error' };
      default: return { label: 'Ranger Connected', sub: 'Please wait...', color: 'var(--fg-muted)', icon: 'scanner' };
    }
  };

  const info = getStatusInfo();

  return (
    <div style={{
      flexShrink: 0,
      display: 'flex', alignItems: 'flex-start', gap: 8,
      padding: '9px 14px',
      borderBottom: '1px solid var(--border)',
      borderLeft: `3px solid ${info.color}`,
      background: isError ? 'var(--danger-bg, #fff1f0)' : 'var(--bg-raised)',
    }}>
      <div style={{ position: 'relative', marginTop: 1 }}>
        <span className="material-symbols-outlined" style={{
          fontSize: 16, flexShrink: 0,
          color: info.color,
          animation: isFeeding ? 'spin 1.5s linear infinite' : 'none',
        }}>
          {info.icon}
        </span>
        <div style={{ 
          position: 'absolute', bottom: -1, right: -1, 
          width: 7, height: 7, borderRadius: '50%', 
          background: info.color, border: '1.5px solid var(--bg-raised)',
          boxShadow: isFeeding ? `0 0 4px ${info.color}` : 'none'
        }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: isError ? 'var(--danger)' : 'var(--fg)' }}>
          {info.label}
        </div>
        <div style={{ fontSize: 10, color: 'var(--fg-muted)', marginTop: 2 }}>
          {info.sub}
        </div>
      </div>
      {isError && (
        <button
          onClick={() => window.location.reload()}
          className="btn-ghost"
          style={{ fontSize: 'var(--text-xs)', height: 24, padding: '0 8px', flexShrink: 0, color: 'var(--danger)' }}
        >
          Reset
        </button>
      )}
    </div>
  );
}

// ── Recent sequences accordion ────────────────────────────────────────────────

function RecentSequences({
  session, activeSlipEntryId, setActiveSlipEntryId,
  expandedGroups, setExpandedGroups,
  viewerFront, setViewerFront, setViewerBack, setViewerType, setFlipped,
}: {
  session: ScanSessionDto;
  activeSlipEntryId: number | null;
  setActiveSlipEntryId: (id: number | null) => void;
  expandedGroups: Record<string, boolean>;
  setExpandedGroups: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  viewerFront: string | null;
  setViewerFront: (v: string | null) => void;
  setViewerBack: (v: string | null) => void;
  setViewerType: (v: string | null) => void;
  setFlipped: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, borderTop: '1px solid var(--border)' }}>
      <div style={{ padding: '8px 16px', flexShrink: 0, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Recent sequences
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {session.slipGroups.length} of {Math.max(session.slipGroups.length, session.totalSlipEntries)}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 12px' }}>
        {!session.withSlip && session.slipScans && session.slipScans.length > 0 && (
          <div style={{ marginBottom: 10, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 10 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent-500)', textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Icon name="collections" size={14} />
              Batch Slips (Global)
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6 }}>
              {session.slipScans.map((s, idx) => (
                <div
                  key={idx}
                  onClick={() => { setViewerFront(getImageUrl(s.imagePath)); setViewerBack(null); setViewerType('slip'); setFlipped(false); }}
                  style={{
                    aspectRatio: '1/1', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)',
                    overflow: 'hidden', cursor: 'pointer', position: 'relative'
                  }}
                >
                  <img src={getImageUrl(s.imagePath)} alt="slip" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {viewerFront === getImageUrl(s.imagePath) && (
                    <div style={{ position: 'absolute', inset: 0, background: 'rgb(217 119 87 / 20%)', border: '2px solid var(--accent-500)', borderRadius: 'inherit' }} />
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
        {session.slipGroups.length > 0 ? (
          session.slipGroups.map((group, idx) => (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {/* Group header row */}
              <div
                onClick={() => {
                  setActiveSlipEntryId(group.slipEntryId);
                  const key = String(group.slipEntryId);
                  setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
                }}
                style={{
                  padding: '10px 12px',
                  background: activeSlipEntryId === group.slipEntryId ? 'var(--bg-subtle)' : 'var(--bg-raised)',
                  border: `1px solid ${activeSlipEntryId === group.slipEntryId ? 'var(--border-strong)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-md)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  fontSize: 'var(--text-xs)',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2px 10px', alignItems: 'center', marginBottom: 2 }}>
                    {/* Client Name */}
                    <span title="Client" style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--fg)', fontWeight: 700, fontSize: '11px' }}>
                      <Icon name="person" size={13} style={{ color: 'var(--accent-500)' }} />
                      {group.clientName || 'N/A'}
                    </span>
                    {/* Pickup Point */}
                    <span title="Pickup Point" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--fg-muted)', fontSize: 10, fontWeight: 500 }}>
                      <Icon name="location_on" size={11} />
                      {((group as any).pickupPoint || '').split(' - ')[0] || 'N/A'}
                    </span>
                    {/* Deposit Slip No */}
                    <span title="Deposit Slip No" style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--fg-muted)', fontSize: 10, fontWeight: 500 }}>
                      <Icon name="description" size={11} />
                      {group.depositSlipNo || group.slipNo || 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontSize: 10, color: 'var(--fg-muted)', opacity: 0.8 }}>
                    <span>{(group.slipScans?.length ?? 0)} slip</span>
                    <span>{group.cheques?.length ?? 0} chq</span>
                    <span>₹ {group.slipAmount.toLocaleString('en-IN')}</span>
                  </div>
                </div>
                <Icon name={expandedGroups[String(group.slipEntryId)] ? 'expand_less' : 'expand_more'} size={16} />
              </div>

              {/* Collapsible sub-sections */}
              {expandedGroups[String(group.slipEntryId)] && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 12, borderLeft: '1px solid var(--border)', marginLeft: 8, marginTop: 4 }}>

                  {/* Slip images (ONLY if WithSlip) */}
                  {session.withSlip && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          const key = `${group.slipEntryId}-slips`;
                          setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
                          cursor: 'pointer', fontSize: 10, fontWeight: 700, color: 'var(--fg-subtle)',
                          textTransform: 'uppercase', letterSpacing: '.02em'
                        }}
                      >
                        <Icon name={expandedGroups[`${group.slipEntryId}-slips`] === true ? 'expand_more' : 'chevron_right'} size={12} />
                        <span>Slip Images ({(group.slipScans?.length ?? 0)})</span>
                      </div>

                      {expandedGroups[`${group.slipEntryId}-slips`] === true && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 4 }}>
                          {(group.slipScans ?? []).length > 0 ? (group.slipScans ?? []).map((s: any, sIdx: number) => {
                            const isViewed = viewerFront === getImageUrl(s.imagePath);
                            return (
                              <div
                                key={`slip-${sIdx}`}
                                onClick={() => { setViewerFront(getImageUrl(s.imagePath)); setViewerBack(null); setViewerType('slip'); setFlipped(false); }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 8, fontSize: '11px',
                                  color: isViewed ? 'var(--accent)' : 'var(--fg-muted)',
                                  padding: '4px 6px', cursor: 'pointer', borderRadius: 'var(--r-sm)',
                                  background: isViewed ? 'var(--bg-subtle)' : 'transparent',
                                  transition: 'all 0.1s ease'
                                }}
                                onMouseEnter={e => !isViewed && (e.currentTarget.style.background = 'var(--bg-subtle)')}
                                onMouseLeave={e => !isViewed && (e.currentTarget.style.background = 'transparent')}
                              >
                                <Icon name="image" size={12} style={{ color: isViewed ? 'var(--accent)' : undefined }} />
                                <span style={{
                                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                                  fontFamily: 'var(--font-mono)', fontSize: 10,
                                  fontWeight: isViewed ? 600 : 400
                                }}>
                                  {s.imagePath?.split(/[\\/]/).pop()?.split('?')[0] || `slip_${sIdx + 1}.jpg`}
                                </span>
                                {isViewed && <Icon name="play_arrow" size={12} style={{ color: 'var(--accent)' }} />}
                              </div>
                            );
                          }) : (
                            <div style={{ fontSize: 10, color: 'var(--fg-faint)', padding: '4px 0' }}>No slip images</div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  {/* Cheque images */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div
                      onClick={(e) => {
                        e.stopPropagation();
                        const key = `${group.slipEntryId}-cheques`;
                        setExpandedGroups(prev => ({ ...prev, [key]: !prev[key] }));
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0',
                        cursor: 'pointer', fontSize: 10, fontWeight: 700, color: 'var(--fg-subtle)',
                        textTransform: 'uppercase', letterSpacing: '.02em'
                      }}
                    >
                      <Icon name={expandedGroups[`${group.slipEntryId}-cheques`] === true ? 'expand_more' : 'chevron_right'} size={12} />
                      <span>Cheque Images ({(group.cheques?.length ?? 0)})</span>
                    </div>

                    {expandedGroups[`${group.slipEntryId}-cheques`] === true && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 4 }}>
                        {(group.cheques ?? []).length > 0 ? (group.cheques ?? []).map((chq: any, cIdx: number) => {
                          const isViewed = viewerFront === getImageUrl(chq.frontImagePath);
                          return (
                            <div
                              key={`chq-${cIdx}`}
                              onClick={() => { setViewerFront(getImageUrl(chq.frontImagePath)); setViewerBack(chq.backImagePath ? getImageUrl(chq.backImagePath) : null); setViewerType('cheque'); setFlipped(false); }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 8, fontSize: '11px',
                                color: isViewed ? 'var(--accent)' : 'var(--fg-muted)',
                                padding: '4px 6px', cursor: 'pointer', borderRadius: 'var(--r-sm)',
                                background: isViewed ? 'var(--bg-subtle)' : 'transparent',
                                transition: 'all 0.1s ease'
                              }}
                              onMouseEnter={e => !isViewed && (e.currentTarget.style.background = 'var(--bg-subtle)')}
                              onMouseLeave={e => !isViewed && (e.currentTarget.style.background = 'transparent')}
                            >
                              <Icon name="payments" size={12} style={{ color: isViewed ? 'var(--accent)' : undefined }} />
                              <span style={{
                                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1,
                                fontFamily: 'var(--font-mono)', fontSize: 10,
                                fontWeight: isViewed ? 600 : 400
                              }}>
                                {chq.frontImagePath?.split(/[\\/]/).pop()?.split('?')[0] || `chq_${cIdx + 1}.jpg`}
                              </span>
                              {isViewed && <Icon name="play_arrow" size={12} style={{ color: 'var(--accent)' }} />}
                            </div>
                          );
                        }) : (
                          <div style={{ fontSize: 10, color: 'var(--fg-faint)', padding: '4px 0' }}>No cheques scanned</div>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          ))
        ) : (
          <div style={{ padding: '12px 8px', fontSize: 'var(--text-xs)', color: 'var(--fg-faint)', textAlign: 'center' }}>
            No sequences yet
          </div>
        )}
      </div>
    </div>
  );
}

// ── ScanControlPanel ──────────────────────────────────────────────────────────

export function ScanControlPanel({
  session, scanner, scanStep,
  activeGroup, slipScansForActive, canMoveToChequeScan, withSlip,
  isDeveloper, mockScanEnabled, completing,
  frontFile, backFile, frontPreview, backPreview,
  showTable, setShowTable,
  expandedGroups, setExpandedGroups,
  viewerFront, setViewerFront, setViewerBack, setViewerType, setFlipped,
  activeSlipEntryId, setActiveSlipEntryId,
  setScanStep, setShowSlipForm, setConfirmComplete,
  openImageEditor, startNewSlip, onImageSelect,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-raised)', minWidth: 0, overflowY: 'auto' }}>

      {/* Flatbed scanner status banner */}
      <FlatbedStatusBanner scanner={scanner} scanStep={scanStep} />
      <RangerStatusBanner scanner={scanner} scanStep={scanStep} />

      {/* Scan controls */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        {activeSlipEntryId !== session.resumeState?.activeSlipEntryId ? (
          <div style={{
            padding: '16px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)',
            border: '1px dotted var(--border)', textAlign: 'center',
            display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center'
          }}>
            <Icon name="history" size={20} style={{ color: 'var(--fg-faint)' }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg-muted)' }}>Viewing history</div>
            <p style={{ fontSize: 10, color: 'var(--fg-faint)', margin: 0 }}>Scanning controls are disabled for completed sequences.</p>
            <button
              onClick={() => {
                if (session.resumeState?.activeSlipEntryId) {
                  setActiveSlipEntryId(session.resumeState.activeSlipEntryId);
                } else {
                  startNewSlip();
                }
              }}
              className="btn-ghost"
              style={{ fontSize: 10, height: 24, marginTop: 4 }}
            >
              Back to active scanning
            </button>
          </div>
        ) : (
          <>
            {/* SlipEntry step — prompt to open slip form */}
            {scanStep === 'SlipEntry' && !activeSlipEntryId && (
              <ControlCard tone="warning">
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)', marginBottom: 2 }}>
                  Slip entry required
                </div>
                <p style={{ fontSize: 11, color: 'var(--fg-muted)', margin: '0 0 8px', lineHeight: 1.3 }}>
                  Fill in the deposit slip details before scanning {withSlip ? 'slip images and ' : ''}cheques.
                </p>
                <button onClick={() => setShowSlipForm(true)} className="btn-primary" style={{ width: '100%', height: 28, fontSize: 11 }}>
                  <Icon name="edit_note" size={14} />
                  Open slip entry form
                </button>
              </ControlCard>
            )}

            {/* SlipScan step */}
            {scanStep === 'SlipScan' && (
              <>
                <ControlCard>
                  <div style={{ fontSize: 10, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>
                    {scanner.useFlatbedWs ? 'Flatbed Scanner (WebSocket)' : 'Document Scanner'}
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--fg-muted)', margin: '0 0 8px' }}>
                    Place the slip on the flatbed and press Scan.
                  </p>
                  <button
                    onClick={scanner.handleCaptureSlipScan}
                    disabled={scanner.isBusy || (scanner.flatbedStatus !== 'ready' && !(isDeveloper && mockScanEnabled && !!frontFile))}
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', height: 28, fontSize: 11 }}
                    title={scanner.flatbedStatus === 'error' ? 'Scanner not connected — see status above' : scanner.flatbedStatus === 'connecting' ? 'Connecting to scanner…' : undefined}
                  >
                    <Icon name="document_scanner" size={14} />
                    {scanner.isBusy ? 'Scanning…' : scanner.flatbedStatus === 'connecting' ? 'Connecting…' : 'Scan Slip'}
                  </button>

                  {slipScansForActive.length > 0 && (
                    <button
                      onClick={() => setConfirmComplete('slip')}
                      disabled={slipScansForActive.length === 0}
                      className="btn-primary"
                      style={{ width: '100%', justifyContent: 'center', height: 28, fontSize: 11, marginTop: 8 }}
                    >
                      Complete slip scanning
                      <Icon name="arrow_forward" size={14} />
                    </button>
                  )}
                </ControlCard>

                {isDeveloper && mockScanEnabled && (
                  <DevMockSection title="Mock — Slip Capture">
                    <CameraCapture
                      mode="slip"
                      isMockMode={true}
                      onCaptureFront={file => openImageEditor(file, 'slip-front')}
                      frontPreview={frontPreview}
                      disabled={scanner.isBusy}
                    />
                    {frontFile && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                        <button type="button" onClick={() => frontFile && openImageEditor(frontFile, 'slip-front')} className="btn-secondary" style={{ fontSize: 'var(--text-xs)' }}>
                          Edit image
                        </button>
                        <button onClick={scanner.handleCaptureSlipScan} disabled={scanner.isBusy} className="btn-primary" style={{ fontSize: 'var(--text-xs)' }}>
                          {scanner.isBusy ? 'Uploading…' : 'Upload'}
                        </button>
                      </div>
                    )}
                  </DevMockSection>
                )}
              </>
            )}

            {/* ChequeScan step */}
            {scanStep === 'ChequeScan' && canMoveToChequeScan && (
              <>
                <ControlCard>
                  <div style={{ fontSize: 10, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 4 }}>
                    Cheque Scanner (Ranger)
                  </div>
                  <p style={{ fontSize: 11, color: 'var(--fg-muted)', margin: '0 0 8px' }}>
                    Place cheques in the hopper. Start feed, then stop to capture.
                  </p>
                  <RangerFeedControl
                    isRunning={scanner.feedRunning.Cheque}
                    rangerState={scanner.rangerState}
                    onStartFeed={() => { scanner.handleStartFeed('Cheque'); }}
                    onStopFeed={scanner.handleRangerStopAndCapture}
                    disabled={scanner.isBusy || (activeGroup && activeGroup.cheques.length >= activeGroup.totalInstruments)}
                    title={activeGroup && activeGroup.cheques.length >= activeGroup.totalInstruments ? 'Expected cheque count already reached' : undefined}
                  />
                  {activeGroup && (
                    <button
                      onClick={() => setConfirmComplete('cheque')}
                      disabled={scanner.isBusy || completing || activeGroup.cheques.length !== activeGroup.totalInstruments}
                      className="btn-primary"
                      style={{ width: '100%', justifyContent: 'center', height: 28, fontSize: 11, marginTop: 8 }}
                      title={activeGroup.cheques.length !== activeGroup.totalInstruments ? `Need ${activeGroup.totalInstruments} cheques (scanned ${activeGroup.cheques.length})` : undefined}
                    >
                      <Icon name="check_circle" size={14} />
                      Complete cheque scanning
                    </button>
                  )}
                </ControlCard>

                {isDeveloper && mockScanEnabled && (
                  <DevMockSection title="Mock — Cheque Capture">
                    <CameraCapture
                      mode="cheque"
                      isMockMode={true}
                      onCaptureFront={file => openImageEditor(file, 'cheque-front')}
                      onCaptureBack={file => openImageEditor(file, 'cheque-back')}
                      frontPreview={frontPreview}
                      backPreview={backPreview}
                      disabled={scanner.isBusy}
                    />
                    {(frontFile || backFile) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8 }}>
                        <button type="button" onClick={() => frontFile && openImageEditor(frontFile, 'cheque-front')} disabled={!frontFile} className="btn-secondary" style={{ fontSize: 'var(--text-xs)' }}>Front</button>
                        <button type="button" onClick={() => backFile && openImageEditor(backFile, 'cheque-back')} disabled={!backFile} className="btn-secondary" style={{ fontSize: 'var(--text-xs)' }}>Back</button>
                        <button onClick={scanner.handleCaptureCheque} disabled={scanner.isBusy} className="btn-primary" style={{ fontSize: 'var(--text-xs)' }}>
                          {scanner.isBusy ? '…' : 'Upload'}
                        </button>
                      </div>
                    )}
                  </DevMockSection>
                )}
              </>
            )}


            {/* Guard: slip scan required before cheque */}
            {scanStep === 'ChequeScan' && !canMoveToChequeScan && (
              <ControlCard tone="warning">
                <p style={{ fontSize: 12, color: 'var(--fg)', margin: '0 0 8px' }}>
                  Scan at least one slip image before scanning cheques.
                </p>
                <button onClick={() => setScanStep('SlipScan')} className="btn-secondary" style={{ width: '100%', justifyContent: 'center', height: 28, fontSize: 11 }}>
                  <Icon name="arrow_back" size={14} />
                  Back to slip scan
                </button>
              </ControlCard>
            )}
          </>
        )}
      </div>

      {/* Recent sequences accordion */}
      <RecentSequences
        session={session}
        activeSlipEntryId={activeSlipEntryId}
        setActiveSlipEntryId={setActiveSlipEntryId}
        expandedGroups={expandedGroups}
        setExpandedGroups={setExpandedGroups}
        viewerFront={viewerFront}
        setViewerFront={setViewerFront}
        setViewerBack={setViewerBack}
        setViewerType={setViewerType}
        setFlipped={setFlipped}
      />

      {/* View all / scanned items table overlay */}
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', background: 'var(--bg-raised)', flexShrink: 0 }}>
        <button
          onClick={() => setShowTable(t => !t)}
          className="btn-secondary"
          style={{ width: '100%', justifyContent: 'center' }}
          title={showTable ? 'Back to scan view' : 'View all items'}
        >
          <Icon name={showTable ? 'expand_less' : 'expand_more'} size={15} />
          {showTable ? 'Back to scan view' : 'View all'}
        </button>
      </div>
    </div>
  );
}
