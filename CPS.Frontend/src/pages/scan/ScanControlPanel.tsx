// =============================================================================
// File        : ScanControlPanel.tsx
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Right panel — flatbed status banner, scan controls per step,
//               recent sequences accordion, and "View all" button.
// =============================================================================

import React from 'react';
import { getImageUrl } from '../../utils/imageUtils';
import { type ScanSessionDto, BatchStatus } from '../../types';
import {
  Icon, ControlCard, DevMockSection,
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
            Flatbed: {scanner.selectedScannerId || 'Ready'}
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

  const color = isError ? 'var(--danger)' : isReady ? '#f59e0b' : isFeeding ? '#22c55e' : 'var(--fg-muted)';
  const icon = isFeeding ? 'sync' : isError ? 'error' : 'scanner';
  const label = isReady
    ? `Ranger: ${scanner.rangerModel || 'Ready'}`
    : isFeeding ? 'Feeding Cheques…'
    : isError ? 'Ranger Exception'
    : rangerState === 1 ? 'Starting Up…'
    : rangerState === 2 ? 'Configuring…'
    : rangerState === 3 ? 'Enabling…'
    : 'Ranger Connected';

  return (
    <div style={{
      flexShrink: 0,
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '9px 14px',
      borderBottom: '1px solid var(--border)',
      borderLeft: `3px solid ${color}`,
      background: isError ? 'var(--danger-bg, #fff1f0)' : 'var(--bg-raised)',
    }}>
      <span className="material-symbols-outlined" style={{
        fontSize: 15, marginTop: 1, flexShrink: 0,
        fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 15`,
        color,
        animation: isFeeding ? 'spin 1.5s linear infinite' : 'none',
      }}>
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {isError ? (
          <>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--danger)' }}>Ranger Exception</div>
            <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2, wordBreak: 'break-word', opacity: 0.85 }}>Check hardware connections</div>
          </>
        ) : (
          <span style={{ fontSize: 'var(--text-xs)', color: isReady ? 'var(--fg)' : 'var(--fg-muted)', fontWeight: isReady ? 500 : 400 }}>
            {label}
          </span>
        )}
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
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden', borderTop: '1px solid var(--border)' }}>
      <div style={{ padding: '8px 16px', flexShrink: 0, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
          Recent sequences
        </span>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>
          {session.slipGroups.length} of {Math.max(session.slipGroups.length, session.totalSlipEntries)}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 10px' }}>

        {/* Global batch slips (without-slip mode) */}
        {!session.withSlip && session.slipScans && session.slipScans.length > 0 && (
          <div style={{ marginBottom: 8, borderBottom: '1px solid var(--border-subtle)', paddingBottom: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Icon name="collections" size={13} style={{ color: 'var(--accent-500)' }} />
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--accent-500)' }}>Batch Slips</span>
              <span style={{ marginLeft: 'auto', fontSize: 9, padding: '1px 6px', background: 'var(--bg-subtle)', borderRadius: 8, color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {session.slipScans.length}
              </span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(72px, 1fr))', gap: 5 }}>
              {session.slipScans.map((s, idx) => (
                <div key={idx} onClick={() => { setViewerFront(getImageUrl(s.imagePath)); setViewerBack(null); setViewerType('slip'); setFlipped(false); }}
                  style={{ aspectRatio: '1/1', background: 'var(--bg)', border: `1px solid ${viewerFront === getImageUrl(s.imagePath) ? 'var(--accent-500)' : 'var(--border)'}`, borderRadius: 'var(--r-sm)', overflow: 'hidden', cursor: 'pointer', position: 'relative' }}>
                  <img src={getImageUrl(s.imagePath)} alt="slip" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  {viewerFront === getImageUrl(s.imagePath) && <div style={{ position: 'absolute', inset: 0, background: 'rgb(217 119 87 / 20%)' }} />}
                </div>
              ))}
            </div>
          </div>
        )}

        {session.slipGroups.length > 0 ? session.slipGroups.map((group, idx) => {
          const isActive = activeSlipEntryId === group.slipEntryId;
          const isExpanded = !!expandedGroups[String(group.slipEntryId)];
          const slipsExpanded = expandedGroups[`${group.slipEntryId}-slips`] === true;
          const chequesExpanded = expandedGroups[`${group.slipEntryId}-cheques`] === true;
          const slipCount = group.slipScans?.length ?? 0;
          const chequeCount = group.cheques?.length ?? 0;

          return (
            <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>

              {/* ── Group header — single row with all info ─────────────── */}
              <div
                onClick={() => {
                  setActiveSlipEntryId(group.slipEntryId);
                  setExpandedGroups(prev => ({ ...prev, [String(group.slipEntryId)]: !prev[String(group.slipEntryId)] }));
                }}
                style={{
                  padding: '6px 10px',
                  background: isActive ? 'var(--bg-subtle)' : 'var(--bg)',
                  border: `1px solid ${isActive ? 'var(--accent-500)' : 'var(--border)'}`,
                  borderRadius: 'var(--r-md)', cursor: 'pointer',
                  transition: 'border-color 0.15s ease, background 0.15s ease',
                  display: 'flex', alignItems: 'center', gap: 7, overflow: 'hidden',
                }}
              >
                <Icon name="person" size={13} style={{ color: isActive ? 'var(--accent-500)' : 'var(--fg-faint)', flexShrink: 0 }} />

                {/* Client name — grows and truncates */}
                <span style={{ flex: '1 1 0', minWidth: 0, fontSize: 11, fontWeight: 700, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {group.clientName || 'N/A'}
                </span>

                {/* Thin divider */}
                <span style={{ width: 1, height: 14, background: 'var(--border-strong)', flexShrink: 0, borderRadius: 1 }} />

                {/* Metadata chips — fixed width items, never wrap */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0, fontSize: 9, color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-subtle)', fontWeight: 500 }}>
                    {group.depositSlipNo || group.slipNo || '—'}
                  </span>
                  {session.withSlip && slipCount > 0 && (
                    <>
                      <span style={{ color: 'var(--border-strong)' }}>·</span>
                      <span>{slipCount} {slipCount === 1 ? 'slip' : 'slips'}</span>
                    </>
                  )}
                  <span style={{ color: 'var(--border-strong)' }}>·</span>
                  <span>{chequeCount} {chequeCount === 1 ? 'chq' : 'chqs'}</span>
                  <span style={{ color: 'var(--border-strong)' }}>·</span>
                  <span>₹{group.slipAmount.toLocaleString('en-IN')}</span>
                </div>

                <Icon name={isExpanded ? 'expand_less' : 'expand_more'} size={14} style={{ flexShrink: 0, color: 'var(--fg-muted)' }} />
              </div>

              {/* ── Expanded sub-sections ───────────────────────────────── */}
              {isExpanded && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, paddingLeft: 10, borderLeft: '2px solid var(--border)', marginLeft: 6 }}>

                  {/* Slip images section */}
                  {session.withSlip && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <button
                        onClick={e => { e.stopPropagation(); setExpandedGroups(prev => ({ ...prev, [`${group.slipEntryId}-slips`]: !prev[`${group.slipEntryId}-slips`] })); }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                          padding: '5px 8px', background: 'var(--bg-raised)', border: '1px solid var(--border)',
                          borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        <Icon name="description" size={13} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
                        <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg)', flex: 1, textAlign: 'left' }}>Slip Images</span>
                        <span style={{ fontSize: 9, padding: '1px 6px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>
                          {slipCount}
                        </span>
                        <Icon name={slipsExpanded ? 'expand_more' : 'chevron_right'} size={13} style={{ color: 'var(--fg-muted)', flexShrink: 0 }} />
                      </button>

                      {slipsExpanded && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingLeft: 4 }}>
                          {slipCount > 0 ? (group.slipScans ?? []).map((s: any, sIdx: number) => {
                            const isViewed = viewerFront === getImageUrl(s.imagePath);
                            return (
                              <div key={sIdx}
                                onClick={() => { setActiveSlipEntryId(group.slipEntryId); setViewerFront(getImageUrl(s.imagePath)); setViewerBack(null); setViewerType('slip'); setFlipped(false); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', borderRadius: 'var(--r-sm)', cursor: 'pointer', background: isViewed ? 'var(--bg-subtle)' : 'transparent', transition: 'background 0.1s' }}
                                onMouseEnter={e => !isViewed && (e.currentTarget.style.background = 'var(--bg-subtle)')}
                                onMouseLeave={e => !isViewed && (e.currentTarget.style.background = 'transparent')}
                              >
                                <Icon name="image" size={12} style={{ color: isViewed ? 'var(--accent-500)' : 'var(--fg-faint)', flexShrink: 0 }} />
                                <span style={{ flex: 1, fontSize: 10, fontWeight: isViewed ? 600 : 400, color: isViewed ? 'var(--accent)' : 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                                  Slip #{String(sIdx + 1).padStart(2, '0')}
                                </span>
                                {isViewed && <Icon name="arrow_right" size={12} style={{ color: 'var(--accent-500)', flexShrink: 0 }} />}
                              </div>
                            );
                          }) : (
                            <span style={{ fontSize: 10, color: 'var(--fg-faint)', padding: '4px 8px' }}>No slip images</span>
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Cheque images section */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <button
                      onClick={e => { e.stopPropagation(); setExpandedGroups(prev => ({ ...prev, [`${group.slipEntryId}-cheques`]: !prev[`${group.slipEntryId}-cheques`] })); }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 7, width: '100%',
                        padding: '5px 8px', background: 'var(--bg-raised)', border: '1px solid var(--border)',
                        borderRadius: 'var(--r-sm)', cursor: 'pointer', fontFamily: 'inherit',
                      }}
                    >
                      <Icon name="payments" size={13} style={{ color: 'var(--fg-subtle)', flexShrink: 0 }} />
                      <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg)', flex: 1, textAlign: 'left' }}>Cheque Images</span>
                      <span style={{ fontSize: 9, padding: '1px 6px', background: 'var(--bg-subtle)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>
                        {chequeCount}
                      </span>
                      <Icon name={chequesExpanded ? 'expand_more' : 'chevron_right'} size={13} style={{ color: 'var(--fg-muted)', flexShrink: 0 }} />
                    </button>

                    {chequesExpanded && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingLeft: 4 }}>
                        {chequeCount > 0 ? (group.cheques ?? []).map((chq: any, cIdx: number) => {
                          const isViewed = viewerFront === getImageUrl(chq.frontImagePath);
                          return (
                            <div key={cIdx}
                              onClick={() => { setActiveSlipEntryId(group.slipEntryId); setViewerFront(getImageUrl(chq.frontImagePath)); setViewerBack(chq.backImagePath ? getImageUrl(chq.backImagePath) : null); setViewerType('cheque'); setFlipped(false); }}
                              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '4px 8px', borderRadius: 'var(--r-sm)', cursor: 'pointer', background: isViewed ? 'var(--bg-subtle)' : 'transparent', transition: 'background 0.1s' }}
                              onMouseEnter={e => !isViewed && (e.currentTarget.style.background = 'var(--bg-subtle)')}
                              onMouseLeave={e => !isViewed && (e.currentTarget.style.background = 'transparent')}
                            >
                              <Icon name="payments" size={12} style={{ color: isViewed ? 'var(--accent-500)' : 'var(--fg-faint)', flexShrink: 0 }} />
                              <span style={{ flex: 1, fontSize: 10, fontWeight: isViewed ? 600 : 400, color: isViewed ? 'var(--accent)' : 'var(--fg-muted)', whiteSpace: 'nowrap' }}>
                                Cheque #{String(chq.chqSeq ?? cIdx + 1).padStart(3, '0')}
                              </span>
                              {isViewed && <Icon name="arrow_right" size={12} style={{ color: 'var(--accent-500)', flexShrink: 0 }} />}
                            </div>
                          );
                        }) : (
                          <span style={{ fontSize: 10, color: 'var(--fg-faint)', padding: '4px 8px' }}>No cheques scanned</span>
                        )}
                      </div>
                    )}
                  </div>

                </div>
              )}
            </div>
          );
        }) : (
          <div style={{ padding: '16px 8px', fontSize: 'var(--text-xs)', color: 'var(--fg-faint)', textAlign: 'center' }}>
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
  openImageEditor, startNewSlip,
}: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-raised)', minWidth: 0, overflow: 'hidden' }}>

      {/* Flatbed scanner status banner */}
      <FlatbedStatusBanner scanner={scanner} scanStep={scanStep} />
      <RangerStatusBanner scanner={scanner} scanStep={scanStep} />

      {/* Scan controls */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
        {session.batchStatus >= BatchStatus.ScanningCompleted ? (
          <div style={{
            padding: '16px 12px', background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)',
            border: '1px solid var(--border)', textAlign: 'center',
            display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center',
          }}>
            <Icon name="check_circle" size={20} style={{ color: 'var(--success, #16a34a)' }} />
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--fg)' }}>Scanning complete</div>
            <p style={{ fontSize: 10, color: 'var(--fg-faint)', margin: 0 }}>
              This batch has been scanned. Use the history below to review images.
            </p>
          </div>
        ) : activeSlipEntryId !== null && activeSlipEntryId !== session.resumeState?.activeSlipEntryId ? (
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
                    {slipScansForActive.length === 0
                      ? 'Place the slip on the flatbed and press Scan.'
                      : `${slipScansForActive.length} slip image${slipScansForActive.length !== 1 ? 's' : ''} scanned. Scan another or complete.`}
                  </p>
                  <button
                    onClick={scanner.handleCaptureSlipScan}
                    disabled={scanner.isBusy || (scanner.flatbedStatus !== 'ready' && !(isDeveloper && mockScanEnabled && !!frontFile))}
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center', height: 28, fontSize: 11 }}
                    title={scanner.flatbedStatus === 'error' ? 'Scanner not connected — see status above' : scanner.flatbedStatus === 'connecting' ? 'Connecting to scanner…' : undefined}
                  >
                    <Icon name="document_scanner" size={14} />
                    {scanner.isBusy
                      ? 'Scanning…'
                      : scanner.flatbedStatus === 'connecting'
                      ? 'Connecting…'
                      : slipScansForActive.length === 0
                      ? 'Scan Slip'
                      : `Scan Slip #${slipScansForActive.length + 1}`}
                  </button>

                  {slipScansForActive.length > 0 && (
                    <button
                      onClick={() => setConfirmComplete('slip')}
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

      {/* View all / scanned items table — always at bottom since panel is overflow:hidden */}
      <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', background: 'var(--bg-raised)', flexShrink: 0 }}>
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
