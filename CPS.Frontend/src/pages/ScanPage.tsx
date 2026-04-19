// =============================================================================
// File        : ScanPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Scanning screen with slip entry → slip scan → cheque scan flow and resume support.
// Created     : 2026-04-17
// =============================================================================

import { useEffect, useState, useCallback, useRef, type ReactNode, type CSSProperties } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  captureSlipScan, captureCheque, completeScan, getScanSession,
  releaseScanLock, startFeed, startScan, stopFeed, uploadMobileCheque, uploadMobileSlipScan,
} from '../services/scanService';
import { getBatch } from '../services/batchService';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';
import { getImageUrl } from '../utils/imageUtils';
import { BatchStatus, type ChequeItemDto, type ScanSessionDto, type SlipEntryDto, type SlipScanDto } from '../types';
import { SlipFormModal } from '../components/SlipFormModal';
import { useSettingsStore } from '../store/settingsStore';
import {
  rangerEnableOptions, rangerGetCaptureData, rangerPrepareToChangeOptions,
  rangerSetImagingOptions, rangerShutdown, rangerStartFeeding, rangerStartup, rangerStopFeeding,
} from '../services/rangerWebService';
import {
  flatbedConnect, flatbedDisconnect, flatbedScan, flatbedDetectScanners, flatbedAutoSelect,
  getFlatbedWsUrl, isFlatbedConnected, setFlatbedWsUrl as applyFlatbedWsUrl,
  type FlatbedScanner, type ScanSettings,
} from '../services/flatbedWebService';
import { CameraCapture } from '../components/CameraCapture';
import { RangerFeedControl } from '../components/RangerFeedControl';
import { ImageEditModal } from '../components/ImageEditModal';

// ── Types ─────────────────────────────────────────────────────────────────────

type ScanStep = 'SlipEntry' | 'SlipScan' | 'ChequeScan';
type EditableImageTarget = 'slip-front' | 'cheque-front' | 'cheque-back';

const sessionInitBatchIds = new Set<number>();

// ── Icon ──────────────────────────────────────────────────────────────────────

function Icon({ name, size = 18, style }: { name: string; size?: number; style?: CSSProperties }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
        lineHeight: 1, userSelect: 'none', flexShrink: 0, ...style,
      }}
    >{name}</span>
  );
}

// ── Pill chip ─────────────────────────────────────────────────────────────────

function Pill({ icon, children, mono }: { icon?: string; children: ReactNode; mono?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 'var(--r-full)',
      fontSize: 'var(--text-xs)', fontWeight: 500,
      background: 'var(--bg-subtle)', border: '1px solid var(--border)',
      color: 'var(--fg-muted)',
      fontFamily: mono ? 'var(--font-mono)' : undefined,
      whiteSpace: 'nowrap',
    }}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

// ── IconBtn ───────────────────────────────────────────────────────────────────

function IconBtn({ icon, tooltip, onClick, size = 34 }: { icon: string; tooltip?: string; onClick?: () => void; size?: number }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      title={tooltip}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: size, height: size,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: hover ? 'var(--bg-hover)' : 'transparent',
        border: '1px solid transparent', borderRadius: 'var(--r-md)',
        color: hover ? 'var(--fg)' : 'var(--fg-muted)',
        cursor: 'pointer',
        transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)',
        flexShrink: 0,
      }}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

// ── ScanPage ──────────────────────────────────────────────────────────────────

export function ScanPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { mockScanEnabled } = useSettingsStore();
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

  // Scanner state
  const [scannerChoice, setScannerChoice] = useState<'Ranger' | 'Document' | null>(null);
  const [scanRoundActive, setScanRoundActive] = useState(false);
  const [feedRunning, setFeedRunning] = useState<{ Cheque: boolean; Slip: boolean }>({ Cheque: false, Slip: false });

  // Preview
  const [mockPreview, setMockPreview] = useState<{ front: string; back: string } | null>(null);
  const [currentSlipScan, setCurrentSlipScan] = useState<SlipScanDto | null>(null);
  const [currentCheque, setCurrentCheque] = useState<ChequeItemDto | null>(null);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<{ file: File; target: EditableImageTarget; title: string } | null>(null);

  // Cheque viewer
  const [flipped, setFlipped] = useState(false);
  const [zoom, setZoom] = useState(1);

  // Scanner settings state
  const [rangerWsUrl, setRangerWsUrl] = useState('ws://127.0.0.1:9002');
  const [flatbedWsUrl, setFlatbedWsUrl] = useState(getFlatbedWsUrl());
  const [useFlatbedWs, setUseFlatbedWs] = useState(true);
  const [flatbedConnecting, setFlatbedConnecting] = useState(false);
  const [detectedScanners, setDetectedScanners] = useState<FlatbedScanner[]>([]);
  const [selectedScannerId, setSelectedScannerId] = useState('');
  const [flatbedResolution, setFlatbedResolution] = useState(300);
  const [flatbedMode, setFlatbedMode] = useState<ScanSettings['mode']>('Lineart');
  const [flatbedStatus, setFlatbedStatus] = useState<'idle' | 'connecting' | 'ready' | 'error'>('idle');
  const [flatbedError, setFlatbedError] = useState('');

  // Viewer override (set when user clicks an item in the sequences list)
  const [viewerFront, setViewerFront] = useState<string | null>(null);
  const [viewerBack, setViewerBack] = useState<string | null>(null);

  const [completing, setCompleting] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [pickupPointCode, setPickupPointCode] = useState('');
  const [showStartModal, setShowStartModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const makeMockImage = (doc: string, side: string) => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='700'><rect width='100%' height='100%' fill='${side === 'Front' ? '#e7f0ff' : '#f3f4f6'}'/><rect x='40' y='40' width='1120' height='620' rx='16' fill='white' stroke='#94a3b8' stroke-width='3'/><text x='600' y='340' text-anchor='middle' font-family='Arial' font-size='40' fill='#1f2937'>${doc} ${side}</text><text x='600' y='390' text-anchor='middle' font-family='Arial' font-size='24' fill='#6b7280'>Developer Mock</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const toImageSrc = (path?: string, fallback?: string) => {
    if (!path) return fallback;
    if (path.startsWith('data:')) return path;
    return getImageUrl(path);
  };

  const base64ToFile = (base64: string, name: string): File | undefined => {
    if (!base64) return undefined;
    const mime = base64.match(/^data:(.*?);base64,/)?.[1] ?? 'image/jpeg';
    const data = base64.includes(',') ? base64.split(',')[1] : base64;
    const bytes = new Uint8Array(atob(data).split('').map(c => c.charCodeAt(0)));
    return new File([bytes], name, { type: mime });
  };

  const clearCameraFiles = () => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    if (backPreview) URL.revokeObjectURL(backPreview);
    setFrontFile(null); setBackFile(null);
    setFrontPreview(null); setBackPreview(null);
  };

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
      rangerShutdown().catch(() => {});
      flatbedDisconnect();
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-connect flatbed scanner on mount
  useEffect(() => {
    const autoInit = async () => {
      setFlatbedStatus('connecting');
      setFlatbedError('');
      try {
        applyFlatbedWsUrl(flatbedWsUrl);
        if (!isFlatbedConnected()) await flatbedConnect();
        const detected = await flatbedDetectScanners();
        setDetectedScanners(detected.scanners);
        const auto = await flatbedAutoSelect();
        setSelectedScannerId(auto.scanner_id);
        setFlatbedStatus('ready');
      } catch (err: any) {
        setFlatbedStatus('error');
        setFlatbedError(err?.message ?? 'Could not connect to scanner desktop app');
      }
    };
    autoInit();
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
      if (step === 'ChequeScan') setScannerChoice('Ranger');
    } else {
      setScanStep('SlipEntry');
      setShowSlipForm(true);
    }
  };

  // ─── Feed controls ────────────────────────────────────────────────────────

  const handleStartFeed = async (type: 'Cheque' | 'Slip') => {
    setIsBusy(true);
    try {
      if (scannerChoice === 'Ranger') {
        await rangerStartup(rangerWsUrl);
        await rangerEnableOptions();
        await rangerSetImagingOptions({ needImaging: true, needFrontGrayscale: true, needRearGrayscale: true });
        await rangerStartFeeding(type === 'Slip' ? 2 : 0, 0);
      } else {
        await startFeed(id, type);
      }
      setFeedRunning(p => ({ ...p, [type]: true }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? `Failed to start ${type} feed`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleStopFeed = async (type: 'Cheque' | 'Slip') => {
    setIsBusy(true);
    try {
      if (scannerChoice === 'Ranger') await rangerStopFeeding();
      else await stopFeed(id, type);
      setFeedRunning(p => ({ ...p, [type]: false }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? `Failed to stop ${type} feed`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleRangerStopAndCapture = async () => {
    if (!activeSlipEntryId) return;
    setIsBusy(true);
    try {
      await rangerStopFeeding();
      setFeedRunning(p => ({ ...p, Cheque: false }));
      await rangerPrepareToChangeOptions();
      const capture = rangerGetCaptureData('Both');
      const front = base64ToFile(capture.frontBase64, 'cheque-front.jpg');
      const back = base64ToFile(capture.backBase64, 'cheque-back.jpg');
      const result = await uploadMobileCheque(id, {
        slipEntryId: activeSlipEntryId,
        chqSeq: nextChqSeq,
        imageFront: front,
        imageBack: back,
        micrRaw: capture.micrRaw || undefined,
      });
      setCurrentCheque(result);
      setNextChqSeq(s => s + 1);
      await loadSession();
      toast.success('Cheque captured from Ranger');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to stop/capture Ranger feed');
    } finally {
      setIsBusy(false);
    }
  };

  // ─── Capture ──────────────────────────────────────────────────────────────

  const handleCaptureSlipScan = async () => {
    if (!activeSlipEntryId) return;

    // Dev mock path — camera file was captured, upload it as a real entry
    if (user?.isDeveloper && mockScanEnabled && frontFile) {
      setIsBusy(true);
      try {
        const result = await uploadMobileSlipScan(id, { slipEntryId: activeSlipEntryId, scanOrder: nextSlipScanOrder, image: frontFile });
        clearCameraFiles();
        setCurrentSlipScan(result);
        setNextSlipScanOrder(o => o + 1);
        setViewerFront(null); setViewerBack(null);
        await loadSession();
        toast.success('Slip scan captured');
      } catch (err: any) {
        toast.error(err?.response?.data?.message ?? err?.message ?? 'Upload failed');
      } finally {
        setIsBusy(false);
      }
      return;
    }

    // Flatbed WS path — scanner must be ready, no server-side fallback
    if (!isFlatbedConnected() || flatbedStatus !== 'ready' || !selectedScannerId) {
      toast.error('Scanner not ready — check the scanner status above');
      return;
    }

    setIsBusy(true);
    try {
      const scanResult = await flatbedScan(selectedScannerId, { resolution: flatbedResolution, mode: flatbedMode });
      const mimeType = scanResult.format === 'PNG' ? 'image/png' : 'image/jpeg';
      const ext = scanResult.format === 'PNG' ? 'png' : 'jpg';
      const file = base64ToFile(`data:${mimeType};base64,${scanResult.image_base64}`, `slip-scan.${ext}`);
      if (!file) throw new Error('Invalid image data from scanner');
      const result = await uploadMobileSlipScan(id, { slipEntryId: activeSlipEntryId, scanOrder: nextSlipScanOrder, image: file });
      setCurrentSlipScan(result);
      setNextSlipScanOrder(o => o + 1);
      setViewerFront(null); setViewerBack(null);
      await loadSession();
      toast.success('Slip scan captured');
    } catch (err: any) {
      if (!isFlatbedConnected()) {
        setFlatbedStatus('error');
        setFlatbedError('Scanner disconnected during scan — reconnect and retry');
      }
      toast.error(err?.message ?? 'Slip scan failed');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCaptureChecque = async () => {
    if (!activeSlipEntryId) return;
    setIsBusy(true);
    try {
      let result: ChequeItemDto;
      if (user?.isDeveloper && mockScanEnabled && (frontFile || backFile)) {
        result = await uploadMobileCheque(id, { slipEntryId: activeSlipEntryId, chqSeq: nextChqSeq, imageFront: frontFile ?? undefined, imageBack: backFile ?? undefined });
        clearCameraFiles();
      } else if (user?.isDeveloper && mockScanEnabled) {
        result = await captureCheque(id, { slipEntryId: activeSlipEntryId, scannerType: 'Cheque' });
        setMockPreview({ front: makeMockImage('Cheque', 'Front'), back: makeMockImage('Cheque', 'Back') });
      } else {
        await rangerPrepareToChangeOptions();
        const capture = rangerGetCaptureData('Both');
        const front = base64ToFile(capture.frontBase64, 'cheque-front.jpg');
        const back = base64ToFile(capture.backBase64, 'cheque-back.jpg');
        result = await uploadMobileCheque(id, { slipEntryId: activeSlipEntryId, chqSeq: nextChqSeq, imageFront: front, imageBack: back, micrRaw: capture.micrRaw || undefined });
      }
      setCurrentCheque(result);
      setNextChqSeq(s => s + 1);
      setViewerFront(null);
      setViewerBack(null);
      await loadSession();
      toast.success('Cheque captured');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Cheque capture failed');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCompleteScan = async () => {
    setCompleting(true);
    try {
      await completeScan(id);
      toast.success('Scanning completed');
      navigate('/');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to complete scanning');
    } finally {
      setCompleting(false);
    }
  };

  // ─── Step transitions ─────────────────────────────────────────────────────

  const moveToSlipScan = () => { setScanStep('SlipScan'); setScannerChoice(null); setScanRoundActive(false); };
  const moveToChequeScan = () => { setScanStep('ChequeScan'); setScannerChoice('Ranger'); setScanRoundActive(false); };

  const startNewSlip = () => {
    setNewSlipSaved(false);
    setActiveSlipEntryId(null);
    setActiveSlipNo('');
    setNextSlipScanOrder(1);
    setNextChqSeq(1);
    setScanStep('SlipEntry');
    setScanRoundActive(false);
    setFeedRunning({ Cheque: false, Slip: false });
    setCurrentSlipScan(null);
    setCurrentCheque(null);
    setMockPreview(null);
    clearCameraFiles();
    setShowSlipForm(true);
  };

  const handleSaveSettings = () => {
    applyFlatbedWsUrl(flatbedWsUrl);
    setShowScanSettings(false);
    toast.success('Scanner settings saved');
  };

  const handleDetectScanners = async () => {
    setFlatbedConnecting(true);
    setFlatbedStatus('connecting');
    setFlatbedError('');
    try {
      applyFlatbedWsUrl(flatbedWsUrl);
      if (!isFlatbedConnected()) await flatbedConnect();
      const result = await flatbedDetectScanners();
      setDetectedScanners(result.scanners);
      const auto = await flatbedAutoSelect();
      setSelectedScannerId(auto.scanner_id);
      setFlatbedStatus('ready');
      toast.success(`Scanner ready: ${auto.scanner_id}`);
    } catch (err: any) {
      setFlatbedStatus('error');
      setFlatbedError(err?.message ?? 'Scanner detection failed');
      toast.error(err?.message ?? 'Scanner detection failed');
    } finally {
      setFlatbedConnecting(false);
    }
  };

  const handleAutoSelectScanner = async () => {
    setFlatbedConnecting(true);
    try {
      if (!isFlatbedConnected()) await flatbedConnect();
      const result = await flatbedAutoSelect();
      setSelectedScannerId(result.scanner_id);
      toast.success(`Auto-selected: ${result.scanner_id}`);
    } catch (err: any) {
      toast.error(err?.message ?? 'Auto-select failed');
    } finally {
      setFlatbedConnecting(false);
    }
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

  const previewFront = viewerFront
    ?? toImageSrc(currentCheque?.frontImagePath, mockPreview?.front)
    ?? toImageSrc(currentSlipScan?.imagePath, mockPreview?.front);
  const previewBack = viewerBack
    ?? toImageSrc(currentCheque?.backImagePath, mockPreview?.back);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100dvh - 56px)', background: 'var(--bg)' }}>

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
          {activeSlipNo && <Pill icon="description">Slip {activeSlipNo}</Pill>}
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
        <button onClick={handleCompleteScan} disabled={completing} className="btn-primary" style={{ height: 32, padding: '0 14px', gap: 6, fontSize: 'var(--text-xs)' }}>
          <Icon name="check" size={14} />
          {completing ? 'Completing…' : 'Complete scanning'}
        </button>
      </div>

      {/* ── Main layout ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 340px', minHeight: 0 }}>

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
              {scanStep === 'SlipScan' ? 'Slip' : flipped ? 'Back' : 'Front'}
            </span>
          </div>

          {/* Top-right: zoom + flip controls — always on top via zIndex */}
          <div style={{ position: 'absolute', top: 12, right: 16, zIndex: 2, display: 'flex', gap: 2, background: 'var(--bg-raised)', borderRadius: 'var(--r-md)', border: '1px solid var(--border)', padding: 2 }}>
            <IconBtn icon="zoom_out" tooltip="Zoom out" onClick={() => setZoom(z => Math.max(0.25, +(z - 0.15).toFixed(2)))} />
            <IconBtn icon="zoom_in" tooltip="Zoom in" onClick={() => setZoom(z => Math.min(4, +(z + 0.15).toFixed(2)))} />
            {scanStep !== 'SlipScan' && (
              <IconBtn icon="flip" tooltip="Flip (click image)" onClick={() => setFlipped(f => !f)} />
            )}
            <IconBtn icon="fullscreen" tooltip="Fullscreen" onClick={() => setIsFullscreen(true)} />
          </div>

          {/* Scrollable image area — overflow:auto so zoom works without clipping controls */}
          <div style={{
            flex: 1,
            overflow: 'auto',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 48,
            boxSizing: 'border-box',
          }}>
            {/* Flip card */}
            <div style={{
              perspective: '2000px',
              width: `${zoom * 100}%`,
              maxWidth: `${zoom * 900}px`,
              aspectRatio: scanStep === 'SlipScan' ? '1.41 / 1' : '2.35 / 1',
              flexShrink: 0,
              transition: 'width var(--dur) var(--ease)',
            }}>
              <div
                style={{
                  position: 'relative', width: '100%', height: '100%',
                  transformStyle: 'preserve-3d',
                  transition: 'transform var(--dur-slow) var(--ease)',
                  transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
                  cursor: 'pointer',
                }}
                onClick={() => scanStep !== 'SlipScan' && setFlipped(f => !f)}
              >
                {/* Front face */}
                <div style={{
                  position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                  background: 'var(--bg-raised)',
                  border: '1px solid var(--border-strong)',
                  boxShadow: 'var(--shadow-lg)',
                  overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {previewFront
                    ? <img src={previewFront} alt="Front" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <ImagePlaceholder label={scanStep === 'SlipScan' ? 'SLIP IMAGE' : 'FRONT'} />}
                </div>

                {/* Back face */}
                {scanStep !== 'SlipScan' && (
                  <div style={{
                    position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    background: 'var(--bg-raised)',
                    border: '1px solid var(--border-strong)',
                    boxShadow: 'var(--shadow-lg)',
                    overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {previewBack
                      ? <img src={previewBack} alt="Back" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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
        <div style={{ display: 'flex', flexDirection: 'column', background: '#fff', minWidth: 0, overflowY: 'auto' }}>

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

          {/* ── Flatbed scanner status banner ──────────────────────────────── */}
          {useFlatbedWs && flatbedStatus !== 'idle' && (
            <div style={{
              flexShrink: 0,
              display: 'flex', alignItems: 'flex-start', gap: 8,
              padding: '9px 14px',
              borderBottom: '1px solid var(--border)',
              borderLeft: `3px solid ${flatbedStatus === 'error' ? 'var(--danger)' : flatbedStatus === 'ready' ? 'var(--success)' : 'var(--accent-400)'}`,
              background: flatbedStatus === 'error' ? 'var(--danger-bg, #fff1f0)' : flatbedStatus === 'ready' ? 'var(--success-bg)' : 'var(--bg-subtle)',
            }}>
              <span className="material-symbols-outlined" style={{
                fontSize: 15, marginTop: 1, flexShrink: 0,
                fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 15`,
                color: flatbedStatus === 'error' ? 'var(--danger)' : flatbedStatus === 'ready' ? 'var(--success)' : 'var(--accent-500)',
                animation: flatbedStatus === 'connecting' ? 'spin 1s linear infinite' : 'none',
              }}>
                {flatbedStatus === 'connecting' ? 'sync' : flatbedStatus === 'ready' ? 'check_circle' : 'error'}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                {flatbedStatus === 'connecting' && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>Connecting to scanner…</span>
                )}
                {flatbedStatus === 'ready' && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--success)', fontWeight: 500 }}>
                    {selectedScannerId || 'Scanner ready'}
                  </span>
                )}
                {flatbedStatus === 'error' && (
                  <>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--danger)' }}>Scanner not available</div>
                    <div style={{ fontSize: 10, color: 'var(--danger)', marginTop: 2, wordBreak: 'break-word', opacity: 0.85 }}>{flatbedError}</div>
                  </>
                )}
              </div>
              {flatbedStatus === 'error' && (
                <button
                  onClick={handleDetectScanners}
                  disabled={flatbedConnecting}
                  className="btn-ghost"
                  style={{ fontSize: 'var(--text-xs)', height: 24, padding: '0 8px', flexShrink: 0, color: 'var(--danger)' }}
                >
                  Retry
                </button>
              )}
            </div>
          )}

          {/* ── Scan controls (fixed, non-scrolling) ──────────────────────────── */}
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
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg)', marginTop: 2 }}>{activeSlipNo}</div>
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 'var(--r-full)',
                    fontSize: 'var(--text-xs)', fontWeight: 500,
                    background: slipScansForActive.length > 0 ? 'var(--success-bg)' : 'var(--bg-subtle)',
                    color: slipScansForActive.length > 0 ? 'var(--success)' : 'var(--fg-muted)',
                    border: `1px solid ${slipScansForActive.length > 0 ? 'var(--success)' : 'var(--border)'}`,
                  }}>
                    {slipScansForActive.length} image{slipScansForActive.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {slipScansForActive.length === 0 && (
                  <div style={{ padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--warning-bg)', border: '1px solid var(--warning)', fontSize: 'var(--text-xs)', color: 'var(--warning)' }}>
                    Scan at least one slip image before moving to cheques.
                  </div>
                )}

                <ControlCard>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 8 }}>
                    {useFlatbedWs ? 'Flatbed Scanner (WebSocket)' : 'Document Scanner'}
                  </div>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', margin: '0 0 12px' }}>
                    Place the slip on the flatbed and press Scan.
                  </p>
                  <button
                    onClick={handleCaptureSlipScan}
                    disabled={isBusy || (flatbedStatus !== 'ready' && !(user?.isDeveloper && mockScanEnabled && !!frontFile))}
                    className="btn-primary"
                    style={{ width: '100%', justifyContent: 'center' }}
                    title={flatbedStatus === 'error' ? 'Scanner not connected — see status above' : flatbedStatus === 'connecting' ? 'Connecting to scanner…' : undefined}
                  >
                    <Icon name="document_scanner" size={16} />
                    {isBusy ? 'Scanning…' : flatbedStatus === 'connecting' ? 'Connecting…' : 'Scan Slip'}
                  </button>
                </ControlCard>

                {user?.isDeveloper && mockScanEnabled && (
                  <DevMockSection title="Mock — Slip Capture">
                    <CameraCapture
                      mode="slip"
                      isMockMode={true}
                      onCaptureFront={file => openImageEditor(file, 'slip-front')}
                      frontPreview={frontPreview}
                      disabled={isBusy}
                    />
                    {frontFile && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
                        <button type="button" onClick={() => frontFile && openImageEditor(frontFile, 'slip-front')} className="btn-secondary" style={{ fontSize: 'var(--text-xs)' }}>
                          Edit image
                        </button>
                        <button onClick={handleCaptureSlipScan} disabled={isBusy} className="btn-primary" style={{ fontSize: 'var(--text-xs)' }}>
                          {isBusy ? 'Uploading…' : 'Upload'}
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
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg)', marginTop: 2 }}>Slip {activeSlipNo}</div>
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 'var(--r-full)',
                    fontSize: 'var(--text-xs)', fontWeight: 500,
                    background: chequesDoneForActive > 0 ? 'var(--success-bg)' : 'var(--bg-subtle)',
                    color: chequesDoneForActive > 0 ? 'var(--success)' : 'var(--fg-muted)',
                    border: `1px solid ${chequesDoneForActive > 0 ? 'var(--success)' : 'var(--border)'}`,
                  }}>
                    {chequesDoneForActive} cheque{chequesDoneForActive !== 1 ? 's' : ''}
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
                    isRunning={feedRunning.Cheque}
                    scanType="Cheque"
                    onStartFeed={() => { setScannerChoice('Ranger'); handleStartFeed('Cheque'); }}
                    onStopFeed={handleRangerStopAndCapture}
                    isMockMode={false}
                    disabled={isBusy}
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
                      disabled={isBusy}
                    />
                    {(frontFile || backFile) && (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, marginTop: 8 }}>
                        <button type="button" onClick={() => frontFile && openImageEditor(frontFile, 'cheque-front')} disabled={!frontFile} className="btn-secondary" style={{ fontSize: 'var(--text-xs)' }}>Front</button>
                        <button type="button" onClick={() => backFile && openImageEditor(backFile, 'cheque-back')} disabled={!backFile} className="btn-secondary" style={{ fontSize: 'var(--text-xs)' }}>Back</button>
                        <button onClick={handleCaptureChecque} disabled={isBusy} className="btn-primary" style={{ fontSize: 'var(--text-xs)' }}>
                          {isBusy ? '…' : 'Upload'}
                        </button>
                      </div>
                    )}
                  </DevMockSection>
                )}

                {chequesDoneForActive > 0 && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <button onClick={startNewSlip} className="btn-secondary" style={{ justifyContent: 'center' }}>
                      <Icon name="add" size={15} />
                      New slip
                    </button>
                    <button onClick={handleCompleteScan} disabled={completing} className="btn-primary" style={{ justifyContent: 'center' }}>
                      <Icon name="check" size={15} />
                      {completing ? 'Completing…' : 'Complete'}
                    </button>
                  </div>
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

          {/* ── Recent sequences ─────────────────────────────────────────────────── */}
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
                  onImageSelect={(front, back) => { setViewerFront(front); setViewerBack(back ?? null); }}
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
                {scanStep === 'SlipScan' ? 'Slip' : flipped ? 'Back' : 'Front'}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgb(255 255 255 / 8%)', borderRadius: 'var(--r-md)', padding: 4 }}>
              <IconBtn icon="zoom_out" tooltip="Zoom out" onClick={() => setZoom(z => Math.max(0.25, +(z - 0.15).toFixed(2)))} />
              <span style={{ fontSize: 'var(--text-xs)', color: '#aaa', minWidth: 36, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>
                {Math.round(zoom * 100)}%
              </span>
              <IconBtn icon="zoom_in" tooltip="Zoom in" onClick={() => setZoom(z => Math.min(4, +(z + 0.15).toFixed(2)))} />
              {scanStep !== 'SlipScan' && (
                <IconBtn icon="flip" tooltip="Flip" onClick={() => setFlipped(f => !f)} />
              )}
              <span style={{ width: 1, height: 18, background: 'rgb(255 255 255 / 20%)', margin: '0 4px' }} />
              <IconBtn icon="fullscreen_exit" tooltip="Exit fullscreen" onClick={() => setIsFullscreen(false)} />
            </div>
          </div>

          {/* Fullscreen scrollable image area */}
          <div style={{ flex: 1, overflow: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
            <div style={{
              perspective: '2000px',
              width: `${zoom * 90}%`,
              maxWidth: `${zoom * 1200}px`,
              aspectRatio: scanStep === 'SlipScan' ? '1.41 / 1' : '2.35 / 1',
              flexShrink: 0,
              transition: 'width var(--dur) var(--ease)',
            }}>
              <div
                style={{
                  position: 'relative', width: '100%', height: '100%',
                  transformStyle: 'preserve-3d',
                  transition: 'transform var(--dur-slow) var(--ease)',
                  transform: flipped ? 'rotateY(180deg)' : 'rotateY(0)',
                  cursor: scanStep !== 'SlipScan' ? 'pointer' : 'default',
                }}
                onClick={() => scanStep !== 'SlipScan' && setFlipped(f => !f)}
              >
                <div style={{
                  position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                  background: '#111', overflow: 'hidden',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {previewFront
                    ? <img src={previewFront} alt="Front" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                    : <ImagePlaceholder label={scanStep === 'SlipScan' ? 'SLIP IMAGE' : 'FRONT'} />}
                </div>
                {scanStep !== 'SlipScan' && (
                  <div style={{
                    position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                    transform: 'rotateY(180deg)',
                    background: '#111', overflow: 'hidden',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {previewBack
                      ? <img src={previewBack} alt="Back" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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
          rangerWsUrl={rangerWsUrl}
          flatbedWsUrl={flatbedWsUrl}
          useFlatbedWs={useFlatbedWs}
          isDeveloper={!!user?.isDeveloper}
          flatbedConnecting={flatbedConnecting}
          detectedScanners={detectedScanners}
          selectedScannerId={selectedScannerId}
          flatbedResolution={flatbedResolution}
          flatbedMode={flatbedMode}
          onRangerUrlChange={setRangerWsUrl}
          onFlatbedUrlChange={setFlatbedWsUrl}
          onFlatbedWsToggle={setUseFlatbedWs}
          onDetectScanners={handleDetectScanners}
          onAutoSelect={handleAutoSelectScanner}
          onSelectScanner={setSelectedScannerId}
          onResolutionChange={setFlatbedResolution}
          onModeChange={setFlatbedMode}
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
              toast.success(`Slip ${slip.slipNo} saved — scan slip images`);
            } else {
              moveToChequeScan();
              toast.success(`Slip ${slip.slipNo} saved — scan cheques`);
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

// ── ImagePlaceholder ───────────────────────────────────────────────────────────

function ImagePlaceholder({ label }: { label: string }) {
  const isSlip = label === 'SLIP IMAGE';
  return (
    <div style={{
      width: '88%', height: '82%',
      border: '1.5px dashed var(--border-strong)',
      borderRadius: 'var(--r-lg)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      gap: 10, color: 'var(--fg-faint)',
      position: 'relative', overflow: 'hidden',
      background: 'var(--bg-subtle)',
    }}>
      {/* Simulated document lines */}
      {!isSlip && (
        <>
          <div style={{ position: 'absolute', top: '18%', left: '8%', width: '28%', height: 1, background: 'var(--border)' }} />
          <div style={{ position: 'absolute', top: '30%', left: '8%', right: '8%', height: 1, background: 'var(--border-subtle)' }} />
          <div style={{ position: 'absolute', top: '42%', left: '8%', width: '55%', height: 1, background: 'var(--border-subtle)' }} />
          <div style={{ position: 'absolute', bottom: '18%', left: '6%', right: '6%', height: 20, borderRadius: 3, background: 'var(--border-subtle)', opacity: 0.6 }} />
        </>
      )}
      {isSlip && (
        <>
          <div style={{ position: 'absolute', top: '20%', left: '8%', right: '8%', height: 1, background: 'var(--border-subtle)' }} />
          <div style={{ position: 'absolute', top: '40%', left: '8%', width: '60%', height: 1, background: 'var(--border-subtle)' }} />
          <div style={{ position: 'absolute', top: '55%', left: '8%', width: '40%', height: 1, background: 'var(--border-subtle)' }} />
        </>
      )}
      <span className="material-symbols-outlined" style={{ fontSize: 36, fontVariationSettings: `'FILL' 0, 'wght' 200, 'GRAD' 0, 'opsz' 36`, zIndex: 1 }}>
        {isSlip ? 'article' : 'credit_card'}
      </span>
      <span style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 500, zIndex: 1 }}>{label}</span>
    </div>
  );
}

// ── StepDot ────────────────────────────────────────────────────────────────────

function StepDot({ active, done, label, n, disabled }: { active: boolean; done: boolean; label: string; n: number; disabled?: boolean }) {
  const bg = done ? 'var(--success)' : active ? 'var(--accent-500)' : 'var(--border-strong)';
  const color = done || active ? '#fff' : 'var(--fg-faint)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: disabled ? 0.35 : 1 }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
        {done ? '✓' : n}
      </div>
      <span style={{ fontSize: 10, color: active ? 'var(--fg)' : 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

// ── ControlCard ────────────────────────────────────────────────────────────────

function ControlCard({ children, tone }: { children: ReactNode; tone?: 'warning' | 'default' }) {
  const bg = tone === 'warning' ? 'var(--warning-bg)' : 'var(--bg-subtle)';
  const border = tone === 'warning' ? 'var(--warning)' : 'var(--border)';
  return (
    <div style={{ padding: '14px 14px', borderRadius: 'var(--r-md)', background: bg, border: `1px solid ${border}` }}>
      {children}
    </div>
  );
}

// ── DevMockSection ─────────────────────────────────────────────────────────────

function DevMockSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: '1px solid var(--warning)', borderRadius: 'var(--r-md)', background: 'var(--warning-bg)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--warning)', fontSize: 'var(--text-xs)', fontWeight: 600, fontFamily: 'inherit' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 14` }}>code</span>
          {title}
        </span>
        <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 14`, transition: 'transform var(--dur-fast) var(--ease)', transform: open ? 'rotate(180deg)' : 'none' }}>expand_more</span>
      </button>
      {open && <div style={{ padding: '0 12px 12px' }}>{children}</div>}
    </div>
  );
}

// ── SlipGroupList ──────────────────────────────────────────────────────────────

function SlipGroupList({ groups, activeSlipEntryId, newSlipSaved, onSelect, onLockedSelect, onImageSelect }: {
  groups: SlipEntryDto[];
  activeSlipEntryId: number | null;
  newSlipSaved: boolean;
  onSelect: (g: SlipEntryDto) => void;
  onLockedSelect: () => void;
  onImageSelect: (front: string, back?: string) => void;
}) {
  return (
    <div>
      {groups.map(group => {
        const isActive = group.slipEntryId === activeSlipEntryId;
        const isLocked = newSlipSaved && !isActive;
        return (
          <SlipGroupRow
            key={group.slipEntryId}
            group={group}
            isActive={isActive}
            isLocked={isLocked}
            onSelect={() => isLocked ? onLockedSelect() : onSelect(group)}
            onImageSelect={onImageSelect}
          />
        );
      })}
    </div>
  );
}

function SlipGroupRow({ group, isActive, isLocked, onSelect, onImageSelect }: {
  group: SlipEntryDto; isActive: boolean; isLocked: boolean;
  onSelect: () => void;
  onImageSelect: (front: string, back?: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const bg = isActive ? 'var(--accent-50)' : 'transparent';
  const borderColor = isActive ? 'var(--accent-200)' : 'var(--border-subtle)';

  return (
    <div style={{ borderBottom: `1px solid ${borderColor}`, background: bg, opacity: isLocked ? 0.5 : 1 }}>
      {/* Slip entry header row */}
      <div
        onClick={() => { if (!isLocked) { onSelect(); setExpanded(e => !e); } }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: isLocked ? 'not-allowed' : 'pointer' }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 14`, color: isActive ? 'var(--accent-600)' : 'var(--fg-muted)', flexShrink: 0 }}>receipt</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: isActive ? 'var(--accent-700)' : 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
            {group.slipNo}
          </div>
          <div style={{ fontSize: 10, color: 'var(--fg-subtle)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {group.clientName || 'No client'} · ₹{group.slipAmount.toLocaleString('en-IN')}
          </div>
        </div>
        <span className="material-symbols-outlined" style={{ fontSize: 12, fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 12`, color: 'var(--fg-faint)', flexShrink: 0, transition: 'transform var(--dur-fast) var(--ease)', transform: expanded ? 'rotate(180deg)' : 'none' }}>expand_more</span>
      </div>

      {/* Expanded: slip images + cheques */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingBottom: 4 }}>
          {/* Slip scan images */}
          {group.slipScans.length > 0 && (
            <>
              <div style={{ padding: '5px 12px 2px 30px', fontSize: 10, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Slip images</div>
              {group.slipScans.map((scan, idx) => (
                <div
                  key={idx}
                  onClick={() => { if (scan.imagePath) onImageSelect(getImageUrl(scan.imagePath)); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 30px', cursor: scan.imagePath ? 'pointer' : 'default', fontSize: 11, color: 'var(--fg)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12, fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 12`, color: 'var(--fg-muted)' }}>image</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {scan.imagePath ? scan.imagePath.split(/[\\/]/).pop() : `Slip ${idx + 1}`}
                  </span>
                  {!scan.imagePath && <span style={{ color: 'var(--fg-faint)', fontSize: 10 }}>pending</span>}
                </div>
              ))}
            </>
          )}
          {/* Cheques */}
          {group.cheques.length > 0 && (
            <>
              <div style={{ padding: '5px 12px 2px 30px', fontSize: 10, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Cheques</div>
              {group.cheques.map(c => (
                <div
                  key={c.chequeItemId}
                  onClick={() => {
                    const front = c.frontImagePath ? getImageUrl(c.frontImagePath) : null;
                    const back = c.backImagePath ? getImageUrl(c.backImagePath) : undefined;
                    if (front) onImageSelect(front, back);
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 30px', cursor: (c.frontImagePath || c.backImagePath) ? 'pointer' : 'default', fontSize: 11, color: 'var(--fg)' }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 12, fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 12`, color: 'var(--fg-muted)' }}>payments</span>
                  <span style={{ fontFamily: 'var(--font-mono)' }}>#{String(c.chqSeq).padStart(2, '0')} {c.chqNo || '——'}</span>
                  {c.rrState === 0 && <span style={{ color: 'var(--warning)', fontSize: 10, fontWeight: 600, marginLeft: 'auto' }}>⚠</span>}
                  {c.rrState === 1 && <span style={{ color: 'var(--success)', fontSize: 10, marginLeft: 'auto' }}>✓</span>}
                </div>
              ))}
            </>
          )}
          {group.slipScans.length === 0 && group.cheques.length === 0 && (
            <div style={{ padding: '6px 12px 6px 30px', fontSize: 10, color: 'var(--fg-faint)' }}>No items yet</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── ScannerSettingsModal ───────────────────────────────────────────────────────

function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{ width: 36, height: 20, borderRadius: 10, background: on ? 'var(--accent-500)' : 'var(--border-strong)', position: 'relative', cursor: 'pointer', transition: 'background var(--dur-fast) var(--ease)', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 3, left: on ? 19 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left var(--dur-fast) var(--ease)', boxShadow: '0 1px 3px rgb(0 0 0 / 20%)' }} />
    </div>
  );
}

function ScannerSettingsModal({
  rangerWsUrl, flatbedWsUrl, useFlatbedWs, isDeveloper, flatbedConnecting,
  detectedScanners, selectedScannerId, flatbedResolution, flatbedMode,
  onRangerUrlChange, onFlatbedUrlChange, onFlatbedWsToggle,
  onDetectScanners, onAutoSelect, onSelectScanner,
  onResolutionChange, onModeChange,
  onSave, onClose,
}: {
  rangerWsUrl: string; flatbedWsUrl: string; useFlatbedWs: boolean;
  isDeveloper: boolean; flatbedConnecting: boolean;
  detectedScanners: FlatbedScanner[]; selectedScannerId: string;
  flatbedResolution: number; flatbedMode: ScanSettings['mode'];
  onRangerUrlChange: (v: string) => void; onFlatbedUrlChange: (v: string) => void;
  onFlatbedWsToggle: (v: boolean) => void;
  onDetectScanners: () => void; onAutoSelect: () => void;
  onSelectScanner: (id: string) => void;
  onResolutionChange: (v: number) => void; onModeChange: (v: ScanSettings['mode']) => void;
  onSave: () => void; onClose: () => void;
}) {
  const uniqueScanners = Array.from(new Map(detectedScanners.map(s => [s.name, s])).values());

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgb(0 0 0 / 50%)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div className="card" style={{ width: '100%', maxWidth: 500, maxHeight: 'calc(100dvh - 2rem)', display: 'flex', flexDirection: 'column', borderRadius: 'var(--r-xl)', boxShadow: 'var(--shadow-lg)', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '18px 22px 14px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--fg)' }}>Scanner Settings</h2>
            <p style={{ margin: '3px 0 0', fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>Configure WebSocket endpoints and scan parameters.</p>
          </div>
          <button onClick={onClose} style={{ width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', borderRadius: 'var(--r-md)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 18` }}>close</span>
          </button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 22, overflowY: 'auto' }}>

          {/* ── Ranger ── */}
          <section>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 10 }}>
              Cheque Scanner (Ranger)
            </div>
            <label className="label" style={{ display: 'block', marginBottom: 6 }}>WebSocket URL</label>
            <input className="input-field" value={rangerWsUrl} onChange={e => onRangerUrlChange(e.target.value)} placeholder="ws://127.0.0.1:9002" style={{ fontFamily: 'var(--font-mono)' }} />
            <p style={{ margin: '5px 0 0', fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>Ranger PICA cheque scanner — bulk feed mode. Will be wired when Ranger API is available.</p>
          </section>

          <div style={{ height: 1, background: 'var(--border-subtle)' }} />

          {/* ── Flatbed ── */}
          <section>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                Flatbed / Slip Scanner
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>Enable WebSocket</span>
                <Toggle on={useFlatbedWs} onToggle={() => onFlatbedWsToggle(!useFlatbedWs)} />
              </div>
            </div>

            {/* URL */}
            <label className="label" style={{ display: 'block', marginBottom: 6 }}>WebSocket URL</label>
            <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
              <input
                className="input-field"
                value={flatbedWsUrl}
                onChange={e => onFlatbedUrlChange(e.target.value)}
                placeholder="ws://127.0.0.1:8765"
                style={{ fontFamily: 'var(--font-mono)', flex: 1, opacity: useFlatbedWs ? 1 : 0.5 }}
                disabled={!useFlatbedWs}
              />
              {useFlatbedWs && (
                <button onClick={onDetectScanners} disabled={flatbedConnecting} className="btn-secondary" style={{ whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {flatbedConnecting ? 'Detecting…' : 'Detect scanners'}
                </button>
              )}
            </div>

            {/* Scanner list */}
            {useFlatbedWs && uniqueScanners.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <label className="label">Select scanner</label>
                  <button onClick={onAutoSelect} disabled={flatbedConnecting} className="btn-ghost" style={{ fontSize: 'var(--text-xs)', height: 26, padding: '0 8px' }}>
                    Auto-select
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {uniqueScanners.map(s => (
                    <div
                      key={s.name}
                      onClick={() => onSelectScanner(s.name)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '8px 12px', borderRadius: 'var(--r-md)', cursor: 'pointer',
                        border: `1px solid ${selectedScannerId === s.name ? 'var(--accent-400)' : 'var(--border)'}`,
                        background: selectedScannerId === s.name ? 'var(--accent-50)' : 'var(--bg)',
                        transition: 'background var(--dur-fast) var(--ease)',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 16`, color: selectedScannerId === s.name ? 'var(--accent-600)' : 'var(--fg-muted)' }}>scanner</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--fg)' }}>{s.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)' }}>{s.source.toUpperCase()} · {s.transport}</div>
                      </div>
                      {selectedScannerId === s.name && (
                        <span className="material-symbols-outlined" style={{ fontSize: 16, fontVariationSettings: `'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 16`, color: 'var(--accent-600)' }}>check_circle</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Scan quality settings */}
            {useFlatbedWs && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: 6 }}>Resolution (DPI)</label>
                  <select className="input-field" value={flatbedResolution} onChange={e => onResolutionChange(Number(e.target.value))}>
                    <option value={150}>150 dpi</option>
                    <option value={200}>200 dpi</option>
                    <option value={300}>300 dpi</option>
                    <option value={600}>600 dpi</option>
                  </select>
                </div>
                <div>
                  <label className="label" style={{ display: 'block', marginBottom: 6 }}>Colour Mode</label>
                  <select className="input-field" value={flatbedMode} onChange={e => onModeChange(e.target.value as ScanSettings['mode'])}>
                    <option value="Gray">Grayscale</option>
                    <option value="Color">Colour</option>
                    <option value="Lineart">Lineart (B&W)</option>
                  </select>
                </div>
              </div>
            )}
          </section>

          {isDeveloper && (
            <div style={{ padding: '10px 12px', borderRadius: 'var(--r-md)', background: 'var(--warning-bg)', border: '1px solid var(--warning)', fontSize: 'var(--text-xs)', color: 'var(--warning)' }}>
              Developer mode active — mock scanning available in scan controls (enable in Settings page).
            </div>
          )}
        </div>

        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: 10, flexShrink: 0 }}>
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={onSave} className="btn-primary">Save settings</button>
        </div>
      </div>
    </div>
  );
}
