// =============================================================================
// File        : ScanPage.tsx (REFACTORED)
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Scanning screen with slip entry → slip scan → cheque scan flow.
//               REFACTORED: Components and logic extracted to separate files.
// Created     : 2026-04-17
// Refactored  : 2026-04-19
// =============================================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getScanSession, releaseScanLock, startScan } from '../services/scanService';
import { getBatch } from '../services/batchService';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';
import { getImageUrl } from '../utils/imageUtils';
import { BatchStatus, type ScanSessionDto } from '../types';
import { SlipFormModal } from '../components/SlipFormModal';
import { useSettingsStore } from '../store/settingsStore';
import { CameraCapture } from '../components/CameraCapture';
import { RangerFeedControl } from '../components/RangerFeedControl';
import { ImageEditModal } from '../components/ImageEditModal';
import { useScannerLogic } from '../hooks/useScannerLogic';
import {
  Icon, Pill, IconBtn, ImagePlaceholder, StepDot, ControlCard, DevMockSection,
  SlipGroupList, ScannerSettingsModal, ScanItemsTable,
} from '../components/scan';

// ── Types ─────────────────────────────────────────────────────────────────────

type ScanStep = 'SlipEntry' | 'SlipScan' | 'ChequeScan';
type EditableImageTarget = 'slip-front' | 'cheque-front' | 'cheque-back';

const sessionInitBatchIds = new Set<number>();

// ── ScanPage ──────────────────────────────────────────────────────────────────

export function ScanPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const {
    mockScanEnabled,
    rangerMicrEnabled, setRangerMicrEnabled,
    rangerEndorsementEnabled, setRangerEndorsementEnabled,
    rangerEndorsementUseImageName, setRangerEndorsementUseImageName,
    rangerEndorsementCustomText, setRangerEndorsementCustomText,
  } = useSettingsStore();
  const id = parseInt(batchId!);

  const [session, setSession] = useState<ScanSessionDto | null>(null);
  const [batchDetails, setBatchDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showSlipForm, setShowSlipForm] = useState(false);
  const [showScanSettings, setShowScanSettings] = useState(false);

  // Active slip
  const [activeSlipEntryId, setActiveSlipEntryId] = useState<number | null>(null);
  const [activeSlipNo, setActiveSlipNo] = useState<string>('');
  const [nextSlipScanOrder, setNextSlipScanOrder] = useState(1);
  const [nextChqSeq, setNextChqSeq] = useState(1);
  const [newSlipSaved, setNewSlipSaved] = useState(false);

  // Scan step
  const [scanStep, setScanStep] = useState<ScanStep>('SlipEntry');
  const scanStepRef = useRef<ScanStep>('SlipEntry');
  scanStepRef.current = scanStep;

  // Preview
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<{ file: File; target: EditableImageTarget; title: string } | null>(null);

  // Cheque viewer
  const [flipped, setFlipped] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Pan/drag state
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerFsRef = useRef<HTMLDivElement>(null);
  const panRef = useRef({ active: false, startX: 0, startY: 0, scrollLeft: 0, scrollTop: 0 });
  const hasMoved = useRef(false);
  const [panning, setPanning] = useState(false);

  const makePanHandlers = (scrollRef: React.RefObject<HTMLDivElement>) => ({
    onMouseDown: (e: React.MouseEvent) => {
      const el = scrollRef.current;
      if (!el) return;
      hasMoved.current = false;
      panRef.current = { active: true, startX: e.clientX, startY: e.clientY, scrollLeft: el.scrollLeft, scrollTop: el.scrollTop };
      setPanning(true);
    },
    onMouseMove: (e: React.MouseEvent) => {
      if (!panRef.current.active) return;
      const el = scrollRef.current;
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

  // Viewer override
  const [viewerFront, setViewerFront] = useState<string | null>(null);
  const [viewerBack, setViewerBack] = useState<string | null>(null);
  const [viewerType, setViewerType] = useState<string | null>(null);

  // Clear viewer when moving steps
  useEffect(() => { setViewerFront(null); setViewerBack(null); setViewerType(null); }, [scanStep]);

  const [completing, setCompleting] = useState(false);
  const [pickupPointCode, setPickupPointCode] = useState('');
  const [showStartModal, setShowStartModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const toImageSrc = (path?: string, fallback?: string) => {
    if (!path) return fallback;
    if (path.startsWith('data:')) return path;
    return getImageUrl(path);
  };

  const clearCameraFiles = useCallback(() => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    if (backPreview) URL.revokeObjectURL(backPreview);
    setFrontFile(null); setBackFile(null);
    setFrontPreview(null); setBackPreview(null);
  }, [frontPreview, backPreview]);

  const openImageEditor = (file: File, target: EditableImageTarget) => {
    const titleMap: Record<EditableImageTarget, string> = {
      'slip-front': 'Edit slip image',
      'cheque-front': 'Edit cheque front image',
      'cheque-back': 'Edit cheque back image',
    };
    setEditorState({ file, target, title: titleMap[target] });
  };

  const applyEditedImage = (target: EditableImageTarget, file: File, previewUrl: string) => {
    if (target === 'slip-front' || target === 'cheque-front') {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
      setFrontFile(file); setFrontPreview(previewUrl);
      return;
    }
    if (backPreview) URL.revokeObjectURL(backPreview);
    setBackFile(file); setBackPreview(previewUrl);
  };

  // Use scanner logic hook
  const scanner = useScannerLogic({
    batchId: id,
    activeSlipEntryId,
    nextSlipScanOrder,
    nextChqSeq,
    mockScanEnabled,
    isDeveloper: user?.isDeveloper,
    rangerMicrEnabled,
    rangerEndorsementEnabled,
    rangerEndorsementUseImageName,
    rangerEndorsementCustomText,
    onCaptureSuccess: async () => {
      setNextChqSeq(s => s + 1);
      setViewerFront(null);
      setViewerBack(null);
      setViewerType(null);
      await loadSession();
    },
    onClearCameraFiles: clearCameraFiles,
    frontFile,
    backFile,
    openImageEditor,
  });

  // ─── Session load ─────────────────────────────────────────────────────────

  const loadSession = useCallback(async () => {
    try {
      const [s, batch] = await Promise.all([getScanSession(id), getBatch(id)]);
      setSession(s);
      setBatchDetails(batch);
      setPickupPointCode(batch.pickupPointCode ?? '');
      const rs = s.resumeState;
      if (rs.activeSlipEntryId) {
        setActiveSlipEntryId(rs.activeSlipEntryId);
        setActiveSlipNo(rs.activeSlipNo ?? '');
        setNextSlipScanOrder(rs.nextSlipScanOrder);
        setNextChqSeq(rs.nextChqSeq);
      }
    } catch {
      toast.error('Failed to load scan session');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const init = async () => {
      try {
        const [s, batch] = await Promise.all([getScanSession(id), getBatch(id)]);
        setSession(s);
        setBatchDetails(batch);
        setPickupPointCode(batch.pickupPointCode ?? '');

        const isStartable =
          s.batchStatus === BatchStatus.Created || s.batchStatus === BatchStatus.ScanningPending;

        if (isStartable) {
          try {
            await startScan(id, s.withSlip!, s.scanType);
            const fresh = await getScanSession(id);
            setSession(fresh);
            applyResumeState(fresh, s.withSlip!);
          } catch (err: any) {
            toast.error(err?.response?.data?.message ?? 'Failed to resume scan session');
            setShowStartModal(true);
          }
        } else {
          const rs = s.resumeState;
          if (rs.activeSlipEntryId) {
            setActiveSlipEntryId(rs.activeSlipEntryId);
            setActiveSlipNo(rs.activeSlipNo ?? '');
            setNextSlipScanOrder(rs.nextSlipScanOrder);
            setNextChqSeq(rs.nextChqSeq);
            setScanStep(rs.resumeStep as ScanStep ?? 'ChequeScan');
          }
        }
      } catch {
        toast.error('Failed to load scan session');
      } finally {
        setLoading(false);
      }
    };
    init();
    return () => {
      releaseScanLock(id).catch(() => {});
      scanner.cleanup();
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-connect flatbed scanner on mount
  useEffect(() => {
    scanner.autoInitScanner();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const applyResumeState = (s: ScanSessionDto, withSlip: boolean) => {
    if (!sessionInitBatchIds.has(id)) sessionInitBatchIds.add(id);
    const rs = s.resumeState;
    if (rs.activeSlipEntryId) {
      setActiveSlipEntryId(rs.activeSlipEntryId);
      setActiveSlipNo(rs.activeSlipNo ?? '');
      setNextSlipScanOrder(rs.nextSlipScanOrder);
      setNextChqSeq(rs.nextChqSeq);
      const step = (rs.resumeStep as ScanStep) ?? 'SlipEntry';
      setScanStep(step);
      if (step === 'ChequeScan') scanner.setScannerChoice('Ranger');
    } else {
      setScanStep('SlipEntry');
      setShowSlipForm(true);
    }
  };

  // ─── Step transitions ─────────────────────────────────────────────────────

  const moveToSlipScan = () => { setScanStep('SlipScan'); scanner.setScannerChoice(null); scanner.setScanRoundActive(false); };
  const moveToChequeScan = () => { setScanStep('ChequeScan'); scanner.setScannerChoice('Ranger'); scanner.setScanRoundActive(false); };

  const startNewSlip = () => {
    // Block if current slip has nothing scanned yet
    if (activeSlipEntryId !== null && activeGroup) {
      const hasScans = (activeGroup.slipScans?.length ?? 0) > 0 || (activeGroup.cheques?.length ?? 0) > 0;
      if (!hasScans) {
        toast.warning('Scan at least one item for the current slip before creating a new one.');
        return;
      }
    }
    setNewSlipSaved(false);
    setActiveSlipEntryId(null);
    setActiveSlipNo('');
    setNextSlipScanOrder(1);
    setNextChqSeq(1);
    setScanStep('SlipEntry');
    scanner.setScanRoundActive(false);
    scanner.setFeedRunning({ Cheque: false, Slip: false });
    scanner.setCurrentSlipScan(null);
    scanner.setCurrentCheque(null);
    scanner.setMockPreview(null);
    clearCameraFiles();
    setShowSlipForm(true);
  };

  const handleSaveSettings = () => {
    scanner.handleSaveSettings();
    setShowScanSettings(false);
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--fg-subtle)', fontSize: 'var(--text-sm)' }}>
        Loading scan session…
      </div>
    );
  }
  if (!session) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--danger)', fontSize: 'var(--text-sm)' }}>
        Session not found
      </div>
    );
  }

  const withSlip = session.withSlip ?? false;
  const activeGroup = session.slipGroups.find(g => g.slipEntryId === activeSlipEntryId);
  const slipScansForActive = activeGroup?.slipScans ?? [];
  const chequesDoneForActive = activeGroup?.cheques.length ?? 0;
  const isCurrentSlipScanDone = withSlip && slipScansForActive.length > 0;
  const canMoveToChequeScan = !withSlip || isCurrentSlipScanDone;

  const isSlipView = viewerType === 'slip' || (viewerType === null && scanStep === 'SlipScan');

  const previewFront = viewerFront
    ?? toImageSrc(scanner.currentCheque?.frontImagePath, scanner.mockPreview?.front)
    ?? toImageSrc(scanner.currentSlipScan?.imagePath, scanner.mockPreview?.front);
  const previewBack = viewerBack
    ?? toImageSrc(scanner.currentCheque?.backImagePath, scanner.mockPreview?.back);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* ── Scan viewport — fills screen; table below is scrolled to ─────── */}
      <div style={{ height: 'calc(100dvh - 56px)', display: 'flex', flexDirection: 'column', flexShrink: 0 }}>

      {/* ── Action bar ─────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 20px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-raised)', flexShrink: 0, flexWrap: 'wrap',
      }}>
        <button
          onClick={() => navigate('/')}
          className="btn-ghost"
          style={{ gap: 6, padding: '6px 10px', height: 32 }}
        >
          <Icon name="arrow_back" size={15} />
          Exit
        </button>

        <span style={{ width: 1, height: 20, background: 'var(--border)', flexShrink: 0 }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, flexWrap: 'wrap' }}>
          <Pill icon="receipt_long" mono>{session.batchNo}</Pill>
          <Pill icon="category">
            {session.scanType || 'Scan'} · {' '}
            {batchDetails?.clearingType === '01' ? 'Regular' :
             batchDetails?.clearingType === '02' ? 'High Value' :
             batchDetails?.clearingType === '03' ? 'CTS' :
             batchDetails?.clearingType === '11' ? 'Non-CTS' : 
             batchDetails?.clearingType || 'Scan'}
          </Pill>
          {batchDetails?.scannerID && <Pill icon="print">{batchDetails.scannerID}</Pill>}
          {activeSlipNo && <Pill icon="description">Slip {activeGroup?.depositSlipNo || activeSlipNo}</Pill>}
          <Pill>
            {(() => {
              const n = session.totalSlipEntries;
              if (n === 0) return '0 slips';
              const s = ["th", "st", "nd", "rd"], v = n % 100;
              const ord = s[(v - 20) % 10] || s[v] || s[0];
              return `${n}${ord} slip batch`;
            })()}
          </Pill>
          <Pill mono>₹{session.totalAmount.toLocaleString('en-IN')}</Pill>
        </div>

        {/* Scanner settings */}
        <button
          onClick={() => setShowScanSettings(true)}
          className="btn-secondary"
          style={{ height: 32, padding: '0 12px', gap: 6, fontSize: 'var(--text-xs)', display: 'inline-flex', alignItems: 'center', flexShrink: 0 }}
        >
          <Icon name="tune" size={14} />
          Scanner settings
        </button>

        {/* New slip */}
        <button onClick={startNewSlip} className="btn-secondary" style={{ height: 32, padding: '0 12px', gap: 6, fontSize: 'var(--text-xs)' }}>
          <Icon name="add" size={14} />
          New slip
        </button>

        {/* Complete */}
        <button
          onClick={() => scanner.handleCompleteScan(() => navigate('/'))}
          disabled={scanner.isBusy || completing}
          className="btn-primary"
          style={{ height: 32, padding: '0 14px', gap: 6, fontSize: 'var(--text-xs)' }}
        >
          <Icon name="check" size={14} />
          {scanner.isBusy || completing ? 'Completing…' : 'Complete batch'}
        </button>
      </div>

      {/* ── Main layout ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 480px', minHeight: 0 }}>

        {/* Left: cheque viewer ─────────────────────────────────────────────── */}
        <div style={{
          position: 'relative',
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg)', borderRight: '1px solid var(--border)',
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
            <span>Sequence</span>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg)', fontWeight: 500 }}>
              #{String(Math.max(1, nextChqSeq - 1)).padStart(4, '0')}
            </span>
            <span>·</span>
            <span style={{
              padding: '2px 7px', borderRadius: 'var(--r-full)',
              fontSize: 'var(--text-xs)', fontWeight: 500,
              background: flipped ? 'var(--info-bg)' : 'var(--bg-subtle)',
              color: flipped ? 'var(--info)' : 'var(--fg-muted)',
              border: `1px solid ${flipped ? 'var(--info)' : 'var(--border)'}`,
            }}>
              {isSlipView ? 'Slip' : flipped ? 'Back' : 'Front'}
            </span>
          </div>

          {/* Top-right: zoom + flip controls */}
          <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 2, display: 'flex', gap: 2, background: 'var(--bg-raised)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: 2 }}>
            <IconBtn icon="zoom_out" tooltip="Zoom out" onClick={() => setZoom(z => Math.max(0.25, +(z - 0.25).toFixed(2)))} />
            <IconBtn icon="zoom_in" tooltip="Zoom in" onClick={() => setZoom(z => Math.min(4, +(z + 0.25).toFixed(2)))} />
            {!isSlipView && (
              <IconBtn icon="flip" tooltip="Flip (click image)" onClick={() => setFlipped(f => !f)} />
            )}
            <IconBtn icon="fullscreen" tooltip="Fullscreen" onClick={() => setIsFullscreen(true)} />
          </div>

          {/* Scrollable image area */}
          <div
            ref={viewerRef}
            {...makePanHandlers(viewerRef as React.RefObject<HTMLDivElement>)}
            style={{
              flex: 1,
              overflow: 'auto',
              display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
              padding: 40,
              boxSizing: 'border-box',
              cursor: panning ? 'grabbing' : 'grab',
              userSelect: 'none',
            }}
          >
            {/* Flip card — pixel-width so zoom works correctly */}
            <div style={{
              width: `${Math.max(200, Math.round(640 * zoom))}px`,
              flexShrink: 0,
              transition: 'width 0.15s ease',
            }}>
              <div
                style={{
                  position: 'relative', width: '100%',
                  transformStyle: 'preserve-3d',
                  perspective: '2000px',
                  transition: 'transform var(--dur-slow) var(--ease)',
                  transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
                  cursor: !isSlipView ? (panning ? 'grabbing' : 'pointer') : (panning ? 'grabbing' : 'default'),
                }}
                onClick={() => !isSlipView && !hasMoved.current && setFlipped(f => !f)}
              >
                {/* Front face */}
                <div style={{ position: 'relative', width: '100%', backfaceVisibility: 'hidden' }}>
                  {previewFront
                    ? <img src={previewFront} alt="Front" style={{ display: 'block', width: '100%', height: 'auto', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '4px', boxShadow: 'var(--shadow-lg)' }} />
                    : <ImagePlaceholder label={isSlipView ? 'SLIP IMAGE' : 'FRONT'} />}
                </div>

                {/* Back face */}
                {!isSlipView && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {previewBack
                      ? <img src={previewBack} alt="Back" style={{ display: 'block', width: '100%', height: 'auto', background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: '4px', boxShadow: 'var(--shadow-lg)' }} />
                      : <ImagePlaceholder label="BACK" />}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bottom nav controls */}
          {scanStep !== 'SlipScan' && (
            <div style={{
              position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
              display: 'flex', alignItems: 'center', gap: 6, zIndex: 2,
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              borderRadius: 'var(--r-full)', padding: '4px 8px',
              boxShadow: 'var(--shadow-sm)',
            }}>
              <IconBtn icon="chevron_left" size={28} />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', padding: '0 4px', fontVariantNumeric: 'tabular-nums' }}>
                {Math.max(1, nextChqSeq - 1)} / {session.totalCheques || '—'}
              </span>
              <IconBtn icon="chevron_right" size={28} />
              <span style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 2px' }} />
              <IconBtn icon="delete" tooltip="Delete sequence" size={28} />
              <IconBtn icon="flag" tooltip="Flag for RR" size={28} />
            </div>
          )}
        </div>

        {/* Right: scan controls ─────────────────────────────────────────────── */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--bg-raised)', minWidth: 0, overflowY: 'auto' }}>

          {/* Step header */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 6 }}>
              Scan step
            </div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <StepDot active={scanStep === 'SlipEntry'} done={scanStep !== 'SlipEntry'} label="Entry" n={1} />
              <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <StepDot active={scanStep === 'SlipScan'} done={scanStep === 'ChequeScan'} label="Slip Scan" n={2} disabled={!withSlip} />
              <span style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              <StepDot active={scanStep === 'ChequeScan'} done={false} label="Cheques" n={3} />
            </div>
          </div>

          {/* ── Flatbed scanner status banner — only on SlipScan step ────── */}
          {scanner.useFlatbedWs && scanner.flatbedStatus !== 'idle' && scanStep === 'SlipScan' && (
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
          )}

          {/* ── Scan controls ─────────────────────────────────────────────── */}
          <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12, padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>

            {/* SlipEntry step */}
            {scanStep === 'SlipEntry' && !showSlipForm && (
              <ControlCard tone="warning">
                <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg)', marginBottom: 4 }}>
                  Slip entry required
                </div>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', margin: '0 0 12px' }}>
                  Fill in the deposit slip details before scanning {withSlip ? 'slip images and ' : ''}cheques.
                </p>
                <button onClick={() => setShowSlipForm(true)} className="btn-primary" style={{ width: '100%' }}>
                  <Icon name="edit_note" size={16} />
                  Open slip entry form
                </button>
              </ControlCard>
            )}

            {/* SlipScan step */}
            {scanStep === 'SlipScan' && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Slip scan</div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg)', marginTop: 2 }}>{activeGroup?.depositSlipNo || activeSlipNo}</div>
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 'var(--r-full)',
                    fontSize: 10, fontWeight: 600,
                    background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                    color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums',
                  }}>
                    {slipScansForActive.length} img
                  </span>
                </div>

                {slipScansForActive.length === 0 && (
                  <div style={{ padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--bg-raised)', border: '1px solid var(--border)', fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
                    Scan at least one slip image before moving to cheques.
                  </div>
                )}

                <ControlCard>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
                    {scanner.useFlatbedWs ? 'Flatbed Scanner (WebSocket)' : 'Document Scanner'}
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', margin: '0 0 12px' }}>
                    Place the slip on the flatbed and press Scan.
                  </p>
                  <button
                    onClick={scanner.handleCaptureSlipScan}
                    disabled={scanner.isBusy || (scanner.flatbedStatus !== 'ready' && !(user?.isDeveloper && mockScanEnabled && !!frontFile))}
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    title={scanner.flatbedStatus === 'error' ? 'Scanner not connected — see status above' : scanner.flatbedStatus === 'connecting' ? 'Connecting to scanner…' : undefined}
                  >
                    <Icon name="document_scanner" size={16} />
                    {scanner.isBusy ? 'Scanning…' : scanner.flatbedStatus === 'connecting' ? 'Connecting…' : 'Scan Slip'}
                  </button>
                </ControlCard>

                {user?.isDeveloper && mockScanEnabled && (
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

                {slipScansForActive.length > 0 && (
                  <button onClick={moveToChequeScan} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                    Scan cheques for this slip
                    <Icon name="arrow_forward" size={15} />
                  </button>
                )}
              </>
            )}

            {/* ChequeScan step */}
            {scanStep === 'ChequeScan' && canMoveToChequeScan && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Cheque scan</div>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg)', marginTop: 2 }}>Slip {activeGroup?.depositSlipNo || activeSlipNo}</div>
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 'var(--r-full)',
                    fontSize: 10, fontWeight: 600,
                    background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                    color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums',
                  }}>
                    {chequesDoneForActive} chq
                  </span>
                </div>

                <ControlCard>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
                    Cheque Scanner (Ranger)
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', margin: '0 0 12px' }}>
                    Place cheques in the hopper. Start feed, then stop to capture.
                  </p>
                  <RangerFeedControl
                    isRunning={scanner.feedRunning.Cheque}
                    scanType="Cheque"
                    onStartFeed={() => { scanner.setScannerChoice('Ranger'); scanner.handleStartFeed('Cheque'); }}
                    onStopFeed={scanner.handleRangerStopAndCapture}
                    isMockMode={false}
                    disabled={scanner.isBusy}
                  />
                </ControlCard>

                {user?.isDeveloper && mockScanEnabled && (
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

                {chequesDoneForActive > 0 && (
                  <button onClick={startNewSlip} disabled={scanner.isBusy} className="btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
                    <Icon name="check" size={15} />
                    Complete Slip
                  </button>
                )}
              </>
            )}

            {/* Guard: slip scan required before cheque */}
            {scanStep === 'ChequeScan' && !canMoveToChequeScan && (
              <ControlCard tone="warning">
                <p style={{ fontSize: 'var(--text-sm)', color: 'var(--fg)', margin: '0 0 10px' }}>
                  Scan at least one slip image before scanning cheques.
                </p>
                <button onClick={() => setScanStep('SlipScan')} className="btn-secondary" style={{ width: '100%', justifyContent: 'center' }}>
                  <Icon name="arrow_back" size={15} />
                  Back to slip scan
                </button>
              </ControlCard>
            )}
          </div>

          {/* ── Recent sequences ──────────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '8px 16px', flexShrink: 0, borderBottom: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Recent sequences
              </span>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>
                {session.slipGroups.length} of {Math.max(session.slipGroups.length, session.totalSlipEntries)}
              </span>
            </div>
            <div>
              {session.slipGroups.length > 0 ? (
                <SlipGroupList
                  groups={session.slipGroups}
                  activeSlipEntryId={activeSlipEntryId}
                  newSlipSaved={newSlipSaved}
                  onSelect={(group) => {
                    setActiveSlipEntryId(group.slipEntryId);
                    setActiveSlipNo(group.slipNo);
                    setNewSlipSaved(false);
                  }}
                  onLockedSelect={() => toast.warning('Cannot return to this slip — a new slip entry was created')}
                  onImageSelect={(front, back, type) => { setViewerFront(front); setViewerBack(back ?? null); setViewerType(type ?? null); setFlipped(false); }}
                />
              ) : (
                <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--fg-faint)', fontSize: 'var(--text-xs)' }}>
                  No sequences yet — create a new slip to begin.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      </div>{/* end scan viewport */}

      {/* ── Scanned items table — scroll down to review ───────────────────── */}
      <ScanItemsTable
        session={session}
        onImageSelect={(front, back, type) => {
          setViewerFront(front);
          setViewerBack(back ?? null);
          setViewerType(type ?? null);
          setFlipped(false);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
      />

      {/* ── Fullscreen overlay ─────────────────────────────────────────────── */}
      {isFullscreen && (
        <div style={{
          position: 'fixed', inset: 0, background: '#000', zIndex: 1000,
          display: 'flex', flexDirection: 'column',
        }}>
          {/* Fullscreen toolbar */}
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
                background: flipped ? 'rgb(96 165 250 / 20%)' : 'rgb(255 255 255 / 10%)',
                color: flipped ? '#60a5fa' : '#aaa',
                border: `1px solid ${flipped ? '#60a5fa' : 'rgb(255 255 255 / 15%)'}`,
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
              {!isSlipView && (
                <IconBtn icon="flip" tooltip="Flip" onClick={() => setFlipped(f => !f)} />
              )}
              <span style={{ width: 1, height: 18, background: 'rgb(255 255 255 / 20%)', margin: '0 4px' }} />
              <IconBtn icon="fullscreen_exit" tooltip="Exit fullscreen" onClick={() => setIsFullscreen(false)} />
            </div>
          </div>

          {/* Fullscreen scrollable image area */}
          <div
            ref={viewerFsRef}
            {...makePanHandlers(viewerFsRef as React.RefObject<HTMLDivElement>)}
            style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: 32, cursor: panning ? 'grabbing' : 'grab', userSelect: 'none' }}
          >
            <div style={{
              width: `${Math.max(300, Math.round(900 * zoom))}px`,
              flexShrink: 0,
              transition: 'width 0.15s ease',
            }}>
              <div
                style={{
                  position: 'relative', width: '100%',
                  transformStyle: 'preserve-3d',
                  perspective: '2000px',
                  transition: 'transform var(--dur-slow) var(--ease)',
                  transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
                  cursor: !isSlipView ? (panning ? 'grabbing' : 'pointer') : (panning ? 'grabbing' : 'default'),
                }}
                onClick={() => !isSlipView && !hasMoved.current && setFlipped(f => !f)}
              >
                <div style={{ position: 'relative', width: '100%', backfaceVisibility: 'hidden' }}>
                  {previewFront
                    ? <img src={previewFront} alt="Front" style={{ display: 'block', width: '100%', height: 'auto', background: '#111', border: '1px solid #333', borderRadius: 4 }} />
                    : <ImagePlaceholder label={isSlipView ? 'SLIP IMAGE' : 'FRONT'} />}
                </div>
                {!isSlipView && (
                  <div style={{
                    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                    backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {previewBack
                      ? <img src={previewBack} alt="Back" style={{ display: 'block', width: '100%', height: 'auto', background: '#111', border: '1px solid #333', borderRadius: 4 }} />
                      : <ImagePlaceholder label="BACK" />}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fullscreen bottom nav */}
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
      )}

      {/* ── Scanner settings modal ─────────────────────────────────────────── */}
      {showScanSettings && (
        <ScannerSettingsModal
          rangerWsUrl={scanner.rangerWsUrl}
          flatbedWsUrl={scanner.flatbedWsUrl}
          useFlatbedWs={scanner.useFlatbedWs}
          isDeveloper={!!user?.isDeveloper}
          flatbedConnecting={scanner.flatbedConnecting}
          detectedScanners={scanner.detectedScanners}
          selectedScannerId={scanner.selectedScannerId}
          flatbedResolution={scanner.flatbedResolution}
          flatbedMode={scanner.flatbedMode}
          rangerMicrEnabled={rangerMicrEnabled}
          rangerEndorsementEnabled={rangerEndorsementEnabled}
          rangerEndorsementUseImageName={rangerEndorsementUseImageName}
          rangerEndorsementCustomText={rangerEndorsementCustomText}
          onRangerUrlChange={scanner.setRangerWsUrl}
          onFlatbedUrlChange={scanner.setFlatbedWsUrl}
          onFlatbedWsToggle={scanner.setUseFlatbedWs}
          onDetectScanners={scanner.handleDetectScanners}
          onAutoSelect={scanner.handleAutoSelectScanner}
          onSelectScanner={scanner.setSelectedScannerId}
          onResolutionChange={scanner.setFlatbedResolution}
          onModeChange={scanner.setFlatbedMode}
          onRangerMicrChange={setRangerMicrEnabled}
          onRangerEndorsementChange={setRangerEndorsementEnabled}
          onRangerEndorsementModeChange={setRangerEndorsementUseImageName}
          onRangerEndorsementTextChange={setRangerEndorsementCustomText}
          onSave={handleSaveSettings}
          onClose={() => setShowScanSettings(false)}
        />
      )}

      {/* ── Slip form modal ────────────────────────────────────────────────── */}
      {showSlipForm && (
        <SlipFormModal
          batchId={id}
          defaultPickupPoint={pickupPointCode}
          onClose={() => setShowSlipForm(false)}
          onSaved={slip => {
            setShowSlipForm(false);
            setNewSlipSaved(true);
            setActiveSlipEntryId(slip.slipEntryId);
            setActiveSlipNo(slip.slipNo);
            setNextSlipScanOrder(1);
            setNextChqSeq(1);
            if (withSlip) {
              moveToSlipScan();
              toast.success(`Slip ${slip.depositSlipNo || slip.slipNo} saved — scan slip images`);
            } else {
              moveToChequeScan();
              toast.success(`Slip ${slip.depositSlipNo || slip.slipNo} saved — scan cheques`);
            }
            loadSession();
          }}
        />
      )}

      {/* ── Image editor ───────────────────────────────────────────────────── */}
      {editorState && (
        <ImageEditModal
          file={editorState.file}
          title={editorState.title}
          onClose={() => setEditorState(null)}
          onSave={(file, previewUrl) => {
            applyEditedImage(editorState.target, file, previewUrl);
            setEditorState(null);
            toast.success('Edited image saved');
          }}
        />
      )}
    </div>
  );
}
