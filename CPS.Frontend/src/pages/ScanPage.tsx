// =============================================================================
// File        : ScanPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Scanning screen with slip entry → slip scan → cheque scan flow and resume support.
// Created     : 2026-04-17
// =============================================================================

import { useEffect, useState, useCallback, useRef, type ReactNode } from 'react';
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
import { CameraCapture } from '../components/CameraCapture';
import { RangerFeedControl } from '../components/RangerFeedControl';
import { ImageEditModal } from '../components/ImageEditModal';

// Scan step values
type ScanStep = 'SlipEntry' | 'SlipScan' | 'ChequeScan';
type EditableImageTarget = 'slip-front' | 'cheque-front' | 'cheque-back';

const sessionInitBatchIds = new Set<number>();

export function ScanPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { mockScanEnabled } = useSettingsStore();
  const id = parseInt(batchId!);

  const [session, setSession] = useState<ScanSessionDto | null>(null);
  const [batchDetails, setBatchDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Modal / step state
  const [showSlipForm, setShowSlipForm] = useState(false);

  // Active slip being worked on
  const [activeSlipEntryId, setActiveSlipEntryId] = useState<number | null>(null);
  const [activeSlipNo, setActiveSlipNo] = useState<string>('');
  const [nextSlipScanOrder, setNextSlipScanOrder] = useState(1);
  const [nextChqSeq, setNextChqSeq] = useState(1);
  
  // Track if a new slip entry has been saved after clicking "New Slip"
  const [newSlipSaved, setNewSlipSaved] = useState(false);

  // Current scan step
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
  
  // Camera capture state for mock mode
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<{ file: File; target: EditableImageTarget; title: string } | null>(null);

  const [completing, setCompleting] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [pickupPointCode, setPickupPointCode] = useState('');
  const [showStartModal, setShowStartModal] = useState(false);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const makeMockImage = (doc: string, side: string) => {
    const text = `${doc} ${side}`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='700'><rect width='100%' height='100%' fill='${side === 'Front' ? '#e7f0ff' : '#f3f4f6'}'/><rect x='40' y='40' width='1120' height='620' rx='16' fill='white' stroke='#94a3b8' stroke-width='3'/><text x='600' y='340' text-anchor='middle' font-family='Arial' font-size='40' fill='#1f2937'>${text}</text><text x='600' y='390' text-anchor='middle' font-family='Arial' font-size='24' fill='#6b7280'>Developer Mock</text></svg>`;
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
    setFrontFile(null);
    setBackFile(null);
    setFrontPreview(null);
    setBackPreview(null);
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
      setFrontFile(file);
      setFrontPreview(previewUrl);
      return;
    }

    if (backPreview) URL.revokeObjectURL(backPreview);
    setBackFile(file);
    setBackPreview(previewUrl);
  };

  // ─── Session load ─────────────────────────────────────────────────────────

  const loadSession = useCallback(async () => {
    try {
      const [s, batch] = await Promise.all([getScanSession(id), getBatch(id)]);
      setSession(s);
      setBatchDetails(batch);
      setPickupPointCode(batch.pickupPointCode ?? '');

      // Restore resume state from backend
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

  // On mount: load session, determine initial step
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
          // Re-acquire lock silently (resume)
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
          // Batch is in progress / locked — just display
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
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const applyResumeState = (s: ScanSessionDto, withSlip: boolean) => {
    const rs = s.resumeState;
    if (!sessionInitBatchIds.has(id)) {
      sessionInitBatchIds.add(id);
    }
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
        await rangerStartup();
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

  // Stop Ranger feed AND auto-capture — single action for bulk cheque scanning
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
    setIsBusy(true);
    try {
      let result: SlipScanDto;
      
      // Mock mode with camera: use captured file
      if (user?.isDeveloper && mockScanEnabled && frontFile) {
        result = await uploadMobileSlipScan(id, {
          slipEntryId: activeSlipEntryId,
          scanOrder: nextSlipScanOrder,
          image: frontFile,
        });
        clearCameraFiles();
      } else {
        // Real scanner or mock without camera
        result = await captureSlipScan(id, {
          slipEntryId: activeSlipEntryId,
          scanOrder: nextSlipScanOrder,
          scannerType: 'Document',
        });
        if (mockScanEnabled && user?.isDeveloper) {
          setMockPreview({ front: makeMockImage('Slip', 'Front'), back: '' });
        }
      }
      
      setCurrentSlipScan(result);
      setNextSlipScanOrder(o => o + 1);
      await loadSession();
      toast.success('Slip scan captured');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Slip scan capture failed');
    } finally {
      setIsBusy(false);
    }
  };

  const handleCaptureChecque = async () => {
    if (!activeSlipEntryId) return;
    setIsBusy(true);
    try {
      let result: ChequeItemDto;
      
      // Mock mode with camera: use captured files
      if (user?.isDeveloper && mockScanEnabled && (frontFile || backFile)) {
        result = await uploadMobileCheque(id, {
          slipEntryId: activeSlipEntryId,
          chqSeq: nextChqSeq,
          imageFront: frontFile ?? undefined,
          imageBack: backFile ?? undefined,
        });
        clearCameraFiles();
      } else if (user?.isDeveloper && mockScanEnabled) {
        // Mock mode without camera: use mock images
        result = await captureCheque(id, {
          slipEntryId: activeSlipEntryId,
          scannerType: 'Cheque',
        });
        setMockPreview({ front: makeMockImage('Cheque', 'Front'), back: makeMockImage('Cheque', 'Back') });
      } else {
        // Real Ranger scanner
        await rangerPrepareToChangeOptions();
        const capture = rangerGetCaptureData('Both');
        const front = base64ToFile(capture.frontBase64, 'cheque-front.jpg');
        const back = base64ToFile(capture.backBase64, 'cheque-back.jpg');
        result = await uploadMobileCheque(id, {
          slipEntryId: activeSlipEntryId,
          chqSeq: nextChqSeq,
          imageFront: front,
          imageBack: back,
          micrRaw: capture.micrRaw || undefined,
        });
      }
      
      setCurrentCheque(result);
      setNextChqSeq(s => s + 1);
      await loadSession();
      toast.success('Cheque captured');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Cheque capture failed');
    } finally {
      setIsBusy(false);
    }
  };

  const handleStartRound = async () => {
    const type = scanStep === 'ChequeScan' ? 'Cheque' : 'Slip';
    if (scanStep === 'ChequeScan') setScannerChoice('Ranger');
    await handleStartFeed(type);
    setScanRoundActive(true);
  };

  const handleStopRound = async () => {
    const type = scanStep === 'ChequeScan' ? 'Cheque' : 'Slip';
    if (feedRunning[type]) await handleStopFeed(type);
    setScanRoundActive(false);
    setScannerChoice(null);
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

  const moveToSlipScan = () => {
    setScanStep('SlipScan');
    setScannerChoice(null);
    setScanRoundActive(false);
  };

  const moveToChequeScan = () => {
    setScanStep('ChequeScan');
    setScannerChoice('Ranger');
    setScanRoundActive(false);
  };

  const startNewSlip = () => {
    // Lock the previous slip group - mark that new slip entry is pending
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

  // ─── Render ───────────────────────────────────────────────────────────────

  if (loading) return <div className="p-8 text-center text-gray-400 animate-pulse">Loading scan session…</div>;
  if (!session) return <div className="p-8 text-center text-red-500">Session not found</div>;

  const withSlip = session.withSlip ?? false;
  const activeGroup = session.slipGroups.find(g => g.slipEntryId === activeSlipEntryId);
  const slipScansForActive = activeGroup?.slipScans ?? [];
  const chequesDoneForActive = activeGroup?.cheques.length ?? 0;
  const isCurrentSlipScanDone = withSlip && slipScansForActive.length > 0;
  const canMoveToChequeScan = !withSlip || isCurrentSlipScanDone;

  // Image preview source
  const previewFront = toImageSrc(currentCheque?.frontImagePath, mockPreview?.front)
    || toImageSrc(currentSlipScan?.imagePath, mockPreview?.front);
  const previewBack = toImageSrc(currentCheque?.backImagePath, mockPreview?.back);

  return (
    <div className="flex flex-col min-h-[calc(100dvh-5rem)]">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-4 bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Scanning — {session.batchNo}</h1>
            <p className="text-sm text-gray-500">
              {session.scanType || 'Scan'} / {withSlip ? 'With Slip' : 'Without Slip'} &nbsp;|&nbsp;
              {session.totalSlipEntries} slips &nbsp;|&nbsp; {session.totalCheques} cheques &nbsp;|&nbsp;
              ₹{session.totalAmount.toLocaleString()}
            </p>
          </div>
          {!scanRoundActive && (
            <button onClick={handleCompleteScan} disabled={completing}
              className="mt-2 sm:mt-0 bg-green-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50">
              {completing ? 'Completing…' : '✓ Complete Batch'}
            </button>
          )}
        </div>

        {batchDetails && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-gray-200">
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Location</div>
              <div className="text-xs font-medium text-gray-900">{batchDetails.locationName}</div>
              <div className="text-[10px] text-gray-500">{batchDetails.locationCode}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Batch Date</div>
              <div className="text-xs font-medium text-gray-900">{batchDetails.batchDate}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Scanner</div>
              <div className="text-xs font-medium text-gray-900">{batchDetails.scannerID || '—'}</div>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-gray-500 uppercase">Clearing</div>
              <div className="text-xs font-medium text-gray-900">{batchDetails.clearingType === '01' ? 'CTS (01)' : 'Non-CTS (11)'}</div>
            </div>
          </div>
        )}

        {user?.isDeveloper && (
          <p className="text-xs text-orange-600 mt-2">Developer mode — mock scanning available.</p>
        )}
      </div>

      {/* ── Main area ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">

        {/* Left — image preview */}
        <div className="grid gap-3 min-h-0">
          {/* SlipScan step: single image panel (front only) */}
          {scanStep === 'SlipScan' && (
            <div className="bg-white rounded-lg shadow-sm p-3 flex flex-col min-h-0">
              <div className="text-[11px] font-semibold text-gray-500 mb-2 tracking-wide">SLIP IMAGE</div>
              <div className="flex-1 min-h-0 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                {previewFront
                  ? <img src={previewFront} alt="Slip" className="w-full h-full object-contain" />
                  : <span className="text-gray-400 text-sm">No image</span>}
              </div>
            </div>
          )}

          {/* ChequeScan step: two image panels (front + back) */}
          {scanStep !== 'SlipScan' && (
            <>
              <div className="bg-white rounded-lg shadow-sm p-3 flex flex-col min-h-0">
                <div className="text-[11px] font-semibold text-gray-500 mb-2 tracking-wide">FRONT IMAGE</div>
                <div className="flex-1 min-h-0 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                  {previewFront
                    ? <img src={previewFront} alt="Front" className="w-full h-full object-contain" />
                    : <span className="text-gray-400 text-sm">No image</span>}
                </div>
              </div>
              <div className="bg-white rounded-lg shadow-sm p-3 flex flex-col min-h-0">
                <div className="text-[11px] font-semibold text-gray-500 mb-2 tracking-wide">BACK IMAGE</div>
                <div className="flex-1 min-h-0 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
                  {previewBack
                    ? <img src={previewBack} alt="Back" className="w-full h-full object-contain" />
                    : <span className="text-gray-400 text-sm">No image</span>}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right — controls + grouped slip list */}
        <div className="space-y-3 min-h-0 overflow-y-auto">

          {/* ── Step: SlipEntry ──────────────────────────────────────────── */}
          {scanStep === 'SlipEntry' && !showSlipForm && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-800">Slip Entry Required</p>
              <p className="text-xs text-amber-700 mt-1">
                Fill in slip details before scanning {withSlip ? 'slip images and ' : ''}cheques.
              </p>
              <button onClick={() => setShowSlipForm(true)}
                className="mt-3 bg-amber-600 text-white text-sm px-4 py-2 rounded hover:bg-amber-700">
                Open Slip Entry Form
              </button>
            </div>
          )}

          {/* ── Step: SlipScan (WithSlip only) ───────────────────────────── */}
          {scanStep === 'SlipScan' && (
            <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-500">SLIP SCAN — {activeSlipNo}</div>
                <span className="text-xs text-gray-400">{slipScansForActive.length} image(s)</span>
              </div>

              {slipScansForActive.length === 0 && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded px-3 py-2">
                  Scan one or more slip images before moving to cheques.
                </p>
              )}

              <ScannerSection
                title="Document Scanner — Scan Slip"
                eyebrow="Slip Scanner"
                description="Place the slip on the flatbed and press the button. One scan per slip image."
                tone="blue"
              >
                <button
                  onClick={handleCaptureSlipScan}
                  disabled={isBusy}
                  className="w-full rounded-xl bg-sky-700 px-4 py-3 text-base font-bold text-white hover:bg-sky-800 disabled:opacity-50"
                >
                  {isBusy ? 'Scanning…' : 'Scan Slip'}
                </button>
              </ScannerSection>

              {user?.isDeveloper && mockScanEnabled && (
                <ScannerSection
                  title="Mock / Mobile Capture"
                  eyebrow="Frontend Preview Flow"
                  description="Use phone or camera capture for UI testing. Backend and device logic can be connected later."
                  tone="amber"
                >
                  <CameraCapture
                    mode="slip"
                    isMockMode={true}
                    onCaptureFront={(file) => openImageEditor(file, 'slip-front')}
                    frontPreview={frontPreview}
                    disabled={isBusy}
                  />

                  {frontFile && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => frontFile && openImageEditor(frontFile, 'slip-front')}
                        className="rounded-xl border border-amber-300 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-50"
                      >
                        Edit captured slip
                      </button>
                      <button
                        onClick={handleCaptureSlipScan}
                        disabled={isBusy}
                        className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        {isBusy ? 'Uploading…' : 'Upload slip image'}
                      </button>
                    </div>
                  )}
                </ScannerSection>
              )}

              {/* Move to cheque scan */}
              {slipScansForActive.length > 0 && !scanRoundActive && (
                <button onClick={moveToChequeScan}
                  className="w-full bg-blue-700 text-white text-sm py-2 rounded hover:bg-blue-800">
                  Scan Cheques for This Slip →
                </button>
              )}
            </div>
          )}

          {/* ── Step: ChequeScan ─────────────────────────────────────────── */}
          {scanStep === 'ChequeScan' && canMoveToChequeScan && (
            <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-semibold text-gray-500">CHEQUE SCAN — Slip {activeSlipNo}</div>
                <span className="text-xs text-gray-400">{chequesDoneForActive} cheque(s)</span>
              </div>

              <ScannerSection
                title="Ranger / PICA Cheque Scanner"
                eyebrow="Cheque Scanner — Bulk Feed"
                description="Start Feed to begin. Place cheques in the hopper. Stop Feed to finish — the scanner captures images automatically."
                tone="blue"
              >
                <RangerFeedControl
                  isRunning={feedRunning.Cheque}
                  scanType="Cheque"
                  onStartFeed={() => {
                    setScannerChoice('Ranger');
                    handleStartFeed('Cheque');
                  }}
                  onStopFeed={handleRangerStopAndCapture}
                  isMockMode={false}
                  disabled={isBusy}
                />
              </ScannerSection>

              {user?.isDeveloper && mockScanEnabled && (
                <ScannerSection
                  title="Mock / Mobile Capture"
                  eyebrow="Frontend Preview Flow"
                  description="Use camera capture for collaborator mobile scanner testing. Users can edit images before saving."
                  tone="amber"
                >
                  <CameraCapture
                    mode="cheque"
                    isMockMode={true}
                    onCaptureFront={(file) => openImageEditor(file, 'cheque-front')}
                    onCaptureBack={(file) => openImageEditor(file, 'cheque-back')}
                    frontPreview={frontPreview}
                    backPreview={backPreview}
                    disabled={isBusy}
                  />

                  {(frontFile || backFile) && (
                    <div className="grid gap-2 sm:grid-cols-3">
                      <button
                        type="button"
                        onClick={() => frontFile && openImageEditor(frontFile, 'cheque-front')}
                        disabled={!frontFile}
                        className="rounded-xl border border-amber-300 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-40"
                      >
                        Edit front
                      </button>
                      <button
                        type="button"
                        onClick={() => backFile && openImageEditor(backFile, 'cheque-back')}
                        disabled={!backFile}
                        className="rounded-xl border border-amber-300 px-4 py-2.5 text-sm font-medium text-amber-800 hover:bg-amber-50 disabled:opacity-40"
                      >
                        Edit back
                      </button>
                      <button
                        onClick={handleCaptureChecque}
                        disabled={isBusy}
                        className="rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
                      >
                        {isBusy ? 'Uploading…' : 'Upload cheque image(s)'}
                      </button>
                    </div>
                  )}
                </ScannerSection>
              )}

              {/* After cheques done — offer new slip or finish */}
              {chequesDoneForActive > 0 && !scanRoundActive && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button onClick={startNewSlip}
                    className="bg-orange-500 text-white text-sm py-2 rounded hover:bg-orange-600">
                    + New Slip
                  </button>
                  <button onClick={handleCompleteScan} disabled={completing}
                    className="bg-green-700 text-white text-sm py-2 rounded hover:bg-green-800 disabled:opacity-50">
                    {completing ? 'Completing…' : 'Complete Batch'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── Step indicator / slip scan required guard ─────────────────── */}
          {scanStep === 'ChequeScan' && !canMoveToChequeScan && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-800">
                Scan at least one slip image before scanning cheques.
              </p>
              <button onClick={() => setScanStep('SlipScan')}
                className="mt-2 bg-amber-600 text-white text-sm px-4 py-2 rounded hover:bg-amber-700">
                Go Back to Slip Scan
              </button>
            </div>
          )}

          {/* ── Grouped slip list ─────────────────────────────────────────── */}
          {session.slipGroups.length > 0 && (
            <div className="bg-white rounded-lg shadow-sm p-4">
              <div className="text-xs font-semibold text-gray-500 mb-3">
                SLIPS IN BATCH ({session.slipGroups.length})
              </div>
              <div className="space-y-3">
                {session.slipGroups.map(group => {
                  const isLocked = newSlipSaved && group.slipEntryId !== activeSlipEntryId;
                  return (
                    <SlipGroup
                      key={group.slipEntryId}
                      group={group}
                      isActive={group.slipEntryId === activeSlipEntryId}
                      isLocked={isLocked}
                      onSelect={() => {
                        if (!isLocked) {
                          setActiveSlipEntryId(group.slipEntryId);
                          setActiveSlipNo(group.slipNo);
                          setNewSlipSaved(false); // Allow continuing this group
                        } else {
                          toast.warning('Cannot return to this slip - new slip entry has been created');
                        }
                      }}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>


      {/* ── Slip form modal ───────────────────────────────────────────────── */}
      {showSlipForm && (
        <SlipFormModal
          batchId={id}
          defaultPickupPoint={pickupPointCode}
          onClose={() => setShowSlipForm(false)}
          onSaved={slip => {
            setShowSlipForm(false);
            // Mark that a new slip entry has been saved - previous groups are now locked
            setNewSlipSaved(true);
            setActiveSlipEntryId(slip.slipEntryId);
            setActiveSlipNo(slip.slipNo);
            setNextSlipScanOrder(1);
            setNextChqSeq(1);
            // After slip entry: go to SlipScan if withSlip, else ChequeScan
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

// ── SlipGroup component ────────────────────────────────────────────────────

function SlipGroup({ group, isActive, isLocked, onSelect }: {
  group: SlipEntryDto;
  isActive: boolean;
  isLocked: boolean;
  onSelect: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-lg overflow-hidden ${
      isLocked ? 'border-gray-300 bg-gray-100 opacity-60' :
      isActive ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
    }`}>
      {/* Slip header */}
      <div
        className={`flex items-center gap-2 px-3 py-2 ${isLocked ? 'cursor-not-allowed' : 'cursor-pointer hover:bg-gray-50'}`}
        onClick={() => { if (!isLocked) { onSelect(); setExpanded(e => !e); } }}
      >
        <span className="text-xs font-mono font-bold text-blue-700 w-16 shrink-0">{group.slipNo}</span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-gray-900 truncate">
            {group.clientName || 'No client'} {group.clientCode && <span className="text-gray-500">({group.clientCode})</span>}
          </div>
          <div className="text-[10px] text-gray-500">
            {group.slipScans.length} slip image(s) · {group.cheques.length} cheque(s) · ₹{group.slipAmount.toLocaleString()}
          </div>
        </div>
        <span className="text-[10px] text-gray-400">{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-200 divide-y divide-gray-100">
          {/* Slip images */}
          {group.slipScans.length > 0 && (
            <div className="px-3 py-2">
              <div className="text-[10px] font-semibold text-gray-500 mb-1">SLIP IMAGES</div>
              <div className="flex gap-2 flex-wrap">
                {group.slipScans.map(s => (
                  <div key={s.slipScanId} className="text-[10px] bg-indigo-100 text-indigo-800 px-2 py-1 rounded">
                    Image {s.scanOrder} — {s.scanStatus}
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Cheques */}
          {group.cheques.length > 0 && (
            <div className="px-3 py-2">
              <div className="text-[10px] font-semibold text-gray-500 mb-1">CHEQUES</div>
              <div className="space-y-1">
                {group.cheques.map(c => (
                  <div key={c.chequeItemId} className="flex items-center gap-2 text-[10px]">
                    <span className="font-mono text-gray-600 w-6">{String(c.chqSeq).padStart(2, '0')}</span>
                    <span className="text-gray-800">{c.chqNo || 'No Chq No'}</span>
                    <span className="text-gray-500">{c.scanMICR1 || '—'} / {c.scanMICR2 || '—'}</span>
                    {c.rrState === 0 && <span className="text-orange-600 font-semibold">⚠ RR</span>}
                    {c.rrState === 1 && <span className="text-green-600">✓</span>}
                    {c.rrState === 2 && <span className="text-blue-600">Repaired</span>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ScannerSection({
  title,
  eyebrow,
  description,
  tone,
  children,
}: {
  title: string;
  eyebrow: string;
  description: string;
  tone: 'blue' | 'amber';
  children: ReactNode;
}) {
  const tones = tone === 'blue'
    ? 'border-sky-200 bg-sky-50/70'
    : 'border-amber-200 bg-amber-50/80';

  return (
    <div className={`space-y-3 rounded-2xl border p-4 ${tones}`}>
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-gray-500">{eyebrow}</div>
        <div className="mt-1 text-sm font-semibold text-gray-900">{title}</div>
        <p className="mt-1 text-xs leading-5 text-gray-600">{description}</p>
      </div>
      {children}
    </div>
  );
}
