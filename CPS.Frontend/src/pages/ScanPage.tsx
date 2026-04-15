// =============================================================================
// File        : ScanPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Scanning screen with slip/cheque mode, image preview, and MICR data entry.
// Created     : 2026-04-14
// =============================================================================

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { captureScan, completeScan, getScanSession, releaseScanLock, startFeed, startScan, stopFeed, uploadMobileScan } from '../services/scanService';
import { getBatch } from '../services/batchService';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';
import { getImageUrl } from '../utils/imageUtils';
import { BatchStatus, ScanItemDto, ScanSessionDto } from '../types';
import { SlipFormModal } from '../components/SlipFormModal';
import { useSettingsStore } from '../store/settingsStore';
import { getSlipsByBatch } from '../services/slipService';
import { rangerEnableOptions, rangerGetCaptureData, rangerPrepareToChangeOptions, rangerSetImagingOptions, rangerShutdown, rangerStartFeeding, rangerStartup, rangerStopFeeding } from '../services/rangerWebService';

/** One-time default Slip/Cheque per batch (survives React Strict Mode remounts; never reset by loadSession after capture). */
const initialScanTargetAppliedBatchIds = new Set<number>();

export function ScanPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { mockScanEnabled } = useSettingsStore();
  const [session, setSession] = useState<ScanSessionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [showStartModal, setShowStartModal] = useState(false);
  const [startStep, setStartStep] = useState<'scanType' | 'slipMode'>('scanType');
  const [selectedScanType, setSelectedScanType] = useState<'Scan' | 'Rescan'>('Scan');
  const [showSlipForm, setShowSlipForm] = useState(false);
  const [slipCreated, setSlipCreated] = useState(false);
  /** Current slip entry in the batch — slip + cheque scans link to this ID in the API. */
  const [activeSlipId, setActiveSlipId] = useState<number | null>(null);
  const [scanTarget, setScanTarget] = useState<'Cheque' | 'Slip'>('Cheque');
  const [pickupPointCode, setPickupPointCode] = useState('');
  const [scannerChoice, setScannerChoice] = useState<'Ranger' | 'Document' | null>(null);
  const [slipSide, setSlipSide] = useState<'Front' | 'Back' | 'Both'>('Both');
  const [scanRoundActive, setScanRoundActive] = useState(false);
  const [feedRunning, setFeedRunning] = useState<{ Cheque: boolean; Slip: boolean }>({ Cheque: false, Slip: false });
  const [mockPreview, setMockPreview] = useState<{ front: string; back: string } | null>(null);
  const [currentItem, setCurrentItem] = useState<ScanItemDto | null>(null);
  const [completing, setCompleting] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  /** Always read current Slip/Cheque in async capture (avoids stale state after await loadSession). */
  const scanTargetRef = useRef(scanTarget);
  scanTargetRef.current = scanTarget;

  const id = parseInt(batchId!);

  const hasSlipScanForActiveSlip =
    !!activeSlipId &&
    !!session?.items.some((i) => i.isSlip && i.slipID === activeSlipId);
  const hasChequeScanForActiveSlip =
    !!activeSlipId &&
    !!session?.items.some((i) => !i.isSlip && i.slipID === activeSlipId);
  /** After at least one slip page + one cheque for this slip entry, user may add another slip entry (top button). */
  const showNewSlipEntry =
    !!session?.withSlip && slipCreated && hasSlipScanForActiveSlip && hasChequeScanForActiveSlip;

  const controlsVisible =
    (scanTarget === 'Cheque' || scannerChoice !== null) && scanRoundActive;
  const canCaptureOrComplete =
    controlsVisible &&
    !feedRunning.Cheque &&
    !feedRunning.Slip &&
    !(session?.withSlip && scanTarget === 'Slip' && !slipCreated) &&
    !(session?.withSlip && !activeSlipId);

  const makeMockImage = (doc: 'Cheque' | 'Slip', side: 'Front' | 'Back') => {
    const text = `${doc} ${side} Image`;
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='700'><rect width='100%' height='100%' fill='${side === 'Front' ? '#e7f0ff' : '#f3f4f6'}'/><rect x='40' y='40' width='1120' height='620' rx='16' fill='white' stroke='#94a3b8' stroke-width='3'/><text x='600' y='340' text-anchor='middle' font-family='Arial' font-size='40' fill='#1f2937'>${text}</text><text x='600' y='390' text-anchor='middle' font-family='Arial' font-size='24' fill='#6b7280'>Developer Mock Preview</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const toImageSrc = (rawPath?: string, fallback?: string) => {
    if (!rawPath) return fallback;
    if (rawPath.startsWith('data:')) return rawPath;
    return getImageUrl(rawPath);
  };

  const base64ToFile = (base64: string, fileName: string): File | undefined => {
    if (!base64) return undefined;
    const mimeMatch = base64.match(/^data:(.*?);base64,/);
    const mime = mimeMatch?.[1] ?? 'image/jpeg';
    const data = base64.includes(',') ? base64.split(',')[1] : base64;
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new File([bytes], fileName, { type: mime });
  };

  const loadSession = useCallback(async () => {
    try {
      const [s, batch] = await Promise.all([getScanSession(id), getBatch(id)]);
      setSession(s);
      setPickupPointCode(batch.pickupPointCode ?? '');
      if (s.withSlip && s.items.some(i => i.isSlip)) setSlipCreated(true);
      if (s.withSlip) {
        try {
          const slips = await getSlipsByBatch(id);
          if (slips.length) {
            const latest = slips.reduce((a, b) => (a.slipID >= b.slipID ? a : b));
            setActiveSlipId(latest.slipID);
          }
        } catch {
          /* keep activeSlipId */
        }
      }
      if (s.batchStatus === BatchStatus.Created || s.batchStatus === BatchStatus.ScanningPending) {
        setShowStartModal(true);
        setStartStep('scanType');
      }
    } catch {
      toast.error('Failed to load scan session');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!session) return;
    if (Number(session.batchID) !== id) return;
    if (initialScanTargetAppliedBatchIds.has(id)) return;
    initialScanTargetAppliedBatchIds.add(id);
    setScanTarget(session.withSlip ? 'Slip' : 'Cheque');
  }, [session, id]);

  useEffect(() => {
    loadSession();
    // Release lock on unmount (navigating away)
    return () => {
      releaseScanLock(id).catch(() => {});
      rangerShutdown().catch(() => {});
    };
  }, [id, loadSession]);

  const handleStart = async (withSlip: boolean) => {
    try {
      await startScan(id, withSlip, selectedScanType);
      setShowStartModal(false);
      setScannerChoice(null);
      setScanRoundActive(false);
      setFeedRunning({ Cheque: false, Slip: false });
      setMockPreview(null);
      if (withSlip) {
        setSlipCreated(false);
        setActiveSlipId(null);
        setScanTarget('Slip');
        setShowSlipForm(true);
      } else {
        setSlipCreated(true);
        setScanTarget('Cheque');
        setScannerChoice('Ranger');
      }
      await loadSession();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to start scanning');
    }
  };

  const handleStartFeed = async (scannerType: 'Cheque' | 'Slip') => {
    setIsBusy(true);
    try {
      if (scannerChoice === 'Ranger') {
        await rangerStartup();
        await rangerEnableOptions();
        await rangerSetImagingOptions({
          needImaging: true,
          needFrontGrayscale: true,
          needRearGrayscale: true,
        });
        const feedType = scannerType === 'Slip' ? 2 : 0;
        await rangerStartFeeding(feedType, 0);
      } else {
        await startFeed(id, scannerType);
      }
      setFeedRunning(prev => ({ ...prev, [scannerType]: true }));
      toast.success(`${scannerType} feed started`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? `Failed to start ${scannerType} feed`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleStopFeed = async (scannerType: 'Cheque' | 'Slip') => {
    setIsBusy(true);
    try {
      if (scannerChoice === 'Ranger') {
        await rangerStopFeeding();
      } else {
        await stopFeed(id, scannerType);
      }
      setFeedRunning(prev => ({ ...prev, [scannerType]: false }));
      toast.success(`${scannerType} feed stopped`);
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? `Failed to stop ${scannerType} feed`);
    } finally {
      setIsBusy(false);
    }
  };

  const handleCapture = async (force?: boolean) => {
    const isSlip = scanTargetRef.current === 'Slip';
    if (!force && !canCaptureOrComplete) return;
    setIsBusy(true);
    try {
      const item = scannerChoice === 'Ranger'
        ? await (async () => {
            const capture = rangerGetCaptureData(isSlip ? slipSide : 'Both');
            const frontFile = base64ToFile(capture.frontBase64, `${isSlip ? 'slip' : 'cheque'}-front.jpg`);
            const backFile = base64ToFile(capture.backBase64, `${isSlip ? 'slip' : 'cheque'}-back.jpg`);
            return uploadMobileScan(id, {
              isSlip,
              slipID: session?.withSlip && activeSlipId ? activeSlipId : undefined,
              scannerType: isSlip
                ? `Ranger-Web-Slip-${slipSide}`
                : 'Ranger-Web-Cheque-Both',
              imageFront: frontFile,
              imageBack: backFile,
              micrRaw: capture.micrRaw || undefined,
            });
          })()
        : await captureScan(id, {
            isSlip,
            slipID: session?.withSlip && activeSlipId ? activeSlipId : undefined,
            scannerType: isSlip
              ? `${scannerChoice ?? 'Ranger'}-Slip-${slipSide}`
              : 'Ranger-Cheque-Both',
          });
      setCurrentItem(item);
      if (mockScanEnabled && user?.isDeveloper) {
        const frontOnly = isSlip && slipSide === 'Front';
        const backOnly = isSlip && slipSide === 'Back';
        setMockPreview({
          front: backOnly ? '' : makeMockImage(isSlip ? 'Slip' : 'Cheque', 'Front'),
          back: frontOnly ? '' : makeMockImage(isSlip ? 'Slip' : 'Cheque', 'Back'),
        });
      } else {
        setMockPreview(null);
      }
      await loadSession();
      toast.success(isSlip ? 'Slip captured' : 'Cheque captured');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Capture failed');
    } finally {
      setIsBusy(false);
    }
  };

  const handleStartRound = async () => {
    if (scanTarget === 'Cheque') setScannerChoice('Ranger');
    await handleStartFeed(scanTarget === 'Cheque' ? 'Cheque' : 'Slip');
    setScanRoundActive(true);
  };

  const handleStopRound = async () => {
    const wasSlip = scanTarget === 'Slip';
    if (scanTarget === 'Cheque' ? feedRunning.Cheque : feedRunning.Slip) {
      await handleStopFeed(scanTarget === 'Cheque' ? 'Cheque' : 'Slip');
    }
    setScanRoundActive(false);
    if (wasSlip && session?.withSlip) {
      setScanTarget('Cheque');
      setScannerChoice('Ranger');
    } else {
      setScannerChoice(null);
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

  if (loading) return <div className="p-8 text-center text-gray-400 animate-pulse">Loading scan session...</div>;

  if (!session) return <div className="p-8 text-center text-red-500">Session not found</div>;

  return (
    <div className="flex flex-col min-h-[calc(100dvh-5rem)]">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Scanning — {session.batchNo}</h1>
          <p className="text-sm text-gray-500">
            Mode: {session.scanType || 'Scan'} / {session.withSlip ? 'With Slip' : 'Without Slip'} |
            Scanned: {session.totalScanned} cheques | {session.totalSlips} slips
          </p>
          {user?.isDeveloper && (
            <p className="text-xs text-orange-600 mt-1">Developer mock scanner mode available (visual mock images).</p>
          )}
        </div>
        <div className="ml-auto flex gap-2">
          {(!scanRoundActive) && (
            <button
              onClick={handleCompleteScan}
              disabled={completing}
              className="bg-green-700 text-white text-sm px-4 py-2 rounded-lg hover:bg-green-800 disabled:opacity-50"
            >
              {completing ? 'Completing...' : '✓ Complete Batch'}
            </button>
          )}
        </div>
      </div>

      {/* Main scan layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 flex-1 min-h-0">
        {/* Image preview */}
        <div className="grid grid-cols-2 lg:grid-cols-1 gap-3 min-h-0">
          <div className="bg-white rounded-lg shadow-sm p-3 flex flex-col min-h-0">
            <div className="text-[11px] font-semibold text-gray-500 mb-2 tracking-wide">FRONT IMAGE</div>
            <div className="flex-1 min-h-0 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
              {currentItem?.imageFrontPath || mockPreview?.front ? (
                <img
                  src={toImageSrc(currentItem?.imageFrontPath, mockPreview?.front)}
                  alt="Cheque front"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-gray-400 text-sm">{mockPreview?.front ? 'Mock front preview' : 'No image'}</span>
              )}
            </div>
          </div>
          <div className="bg-white rounded-lg shadow-sm p-3 flex flex-col min-h-0">
            <div className="text-[11px] font-semibold text-gray-500 mb-2 tracking-wide">BACK IMAGE</div>
            <div className="flex-1 min-h-0 bg-gray-100 rounded flex items-center justify-center overflow-hidden">
              {currentItem?.imageBackPath || mockPreview?.back ? (
                <img
                  src={toImageSrc(currentItem?.imageBackPath, mockPreview?.back)}
                  alt="Cheque back"
                  className="w-full h-full object-contain"
                />
              ) : (
                <span className="text-gray-400 text-sm">{mockPreview?.back ? 'Mock back preview' : 'No image'}</span>
              )}
            </div>
          </div>
        </div>

        {/* Controls + scan list */}
        <div className="space-y-3 min-h-0">
          {session.withSlip && !slipCreated && !scanRoundActive && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-amber-800">Slip entry</p>
              <p className="text-xs text-amber-700 mt-1">Save slip details first (modal), then you can scan slip pages and cheques for this slip.</p>
              <button
                type="button"
                onClick={() => setShowSlipForm(true)}
                className="mt-3 bg-amber-600 text-white text-sm px-4 py-2 rounded hover:bg-amber-700"
              >
                Open Slip Entry
              </button>
            </div>
          )}

          {/* Scan setup: after slip entry modal, user picks Slip/Cheque + scanner. New Slip Entry only after slip + cheque for current slip (top). */}
          {!scanRoundActive && (!session.withSlip || slipCreated) && (
            <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
              <div className="text-xs font-semibold text-gray-500">SCAN SETUP</div>

              {session.withSlip && showNewSlipEntry && (
                <button
                  type="button"
                  onClick={() => setShowSlipForm(true)}
                  className="w-full bg-orange-500 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-orange-600"
                >
                  + New Slip Entry
                </button>
              )}

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { setScanTarget('Slip'); setScannerChoice(null); }}
                  className={`text-sm py-2 rounded ${scanTarget === 'Slip' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-700'}`}
                >
                  Slip
                </button>
                <button
                  type="button"
                  onClick={() => { setScanTarget('Cheque'); setScannerChoice('Ranger'); }}
                  disabled={session.withSlip && slipCreated && !hasSlipScanForActiveSlip}
                  className={`text-sm py-2 rounded ${scanTarget === 'Cheque' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'}
                    disabled:opacity-50 disabled:cursor-not-allowed`}
                  title={session.withSlip && slipCreated && !hasSlipScanForActiveSlip ? 'Scan at least one slip page for this slip entry first' : undefined}
                >
                  Cheque
                </button>
              </div>

              {session.withSlip && slipCreated && !hasSlipScanForActiveSlip && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                  Slip entry is saved — scan one or more <span className="font-semibold">slip pages</span> first (each capture adds a row). Then you can scan cheques for this slip.
                </p>
              )}
              {session.withSlip && slipCreated && hasSlipScanForActiveSlip && !hasChequeScanForActiveSlip && (
                <p className="text-xs text-gray-600">
                  You can add more slip pages or switch to <span className="font-semibold">Cheque</span> to scan instruments linked to this slip.
                </p>
              )}

              {scanTarget === 'Slip' && (
                <>
                  <div className="text-xs font-semibold text-gray-500">Scanner</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setScannerChoice('Document')}
                      className={`text-sm py-2 rounded ${scannerChoice === 'Document' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      Document
                    </button>
                    <button
                      type="button"
                      onClick={() => setScannerChoice('Ranger')}
                      className={`text-sm py-2 rounded ${scannerChoice === 'Ranger' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      Ranger
                    </button>
                  </div>
                </>
              )}

              {scanTarget === 'Slip' && scannerChoice && (
                <div className="grid grid-cols-3 gap-2">
                  {(['Front', 'Back', 'Both'] as const).map(side => (
                    <button
                      key={side}
                      type="button"
                      onClick={() => setSlipSide(side)}
                      className={`text-xs py-2 rounded ${slipSide === side ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      {side}
                    </button>
                  ))}
                </div>
              )}

              {(scanTarget === 'Cheque' || scannerChoice) && (
                <button
                  type="button"
                  onClick={handleStartRound}
                  className="w-full bg-green-700 text-white text-sm py-2 rounded hover:bg-green-800"
                >
                  {scanTarget === 'Slip' && scannerChoice === 'Document' ? 'Start Scanning' : 'Start Scanner'}
                </button>
              )}

              {user?.isDeveloper && mockScanEnabled && (
                <p className="text-xs text-orange-600">
                  Mock scan mode is on in Settings — use Mock Capture while scanning for fake images.
                </p>
              )}
            </div>
          )}

          {controlsVisible && (
          <div className="bg-white rounded-lg shadow-sm p-4">
            <div className="text-xs font-semibold text-gray-500 mb-3">
              {scanTarget === 'Cheque' ? 'RANGER CHEQUE CONTROLS' : `${scannerChoice} SLIP CONTROLS`}
            </div>
            {scannerChoice === 'Document' ? (
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleStartRound}
                  disabled={isBusy}
                  className="bg-blue-600 text-white text-sm py-2 rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Start Scanning
                </button>
                <button
                  onClick={async () => {
                    await handleStopRound();
                  }}
                  disabled={isBusy}
                  className="bg-gray-600 text-white text-sm py-2 rounded hover:bg-gray-700 disabled:opacity-50"
                >
                  Stop Scanning
                </button>
              </div>
            ) : (
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => handleStartFeed(scanTarget === 'Cheque' ? 'Cheque' : 'Slip')}
                disabled={isBusy}
                className="bg-blue-600 text-white text-sm py-2 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Start Scanner
              </button>
              <button
                onClick={() => handleStartFeed(scanTarget === 'Cheque' ? 'Cheque' : 'Slip')}
                disabled={isBusy}
                className="bg-indigo-600 text-white text-sm py-2 rounded hover:bg-indigo-700 disabled:opacity-50"
              >
                Start Feeding
              </button>
              <button
                onClick={() => handleStopFeed(scanTarget === 'Cheque' ? 'Cheque' : 'Slip')}
                disabled={isBusy}
                className="bg-gray-600 text-white text-sm py-2 rounded hover:bg-gray-700 disabled:opacity-50"
              >
                Stop Feeding
              </button>
                <button
                  onClick={handleStopRound}
                  disabled={isBusy}
                  className="bg-green-700 text-white text-sm py-2 rounded hover:bg-green-800 disabled:opacity-50"
                >
                  Stop Scanning
                </button>
            </div>
            )}
            <p className="mt-3 text-xs text-gray-500">
              Use <span className="font-medium">Mock Capture</span> (when enabled in Settings) to record a scan, or your scanner&apos;s hardware trigger in production.
            </p>
            {scannerChoice === 'Ranger' && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  onClick={async () => {
                    setIsBusy(true);
                    try {
                      await rangerEnableOptions();
                      toast.success('Ranger options enabled');
                    } catch (err: any) {
                      toast.error(err?.message ?? 'Failed to enable Ranger options');
                    } finally {
                      setIsBusy(false);
                    }
                  }}
                  disabled={isBusy}
                  className="border border-blue-300 text-blue-700 text-sm py-2 rounded disabled:opacity-50"
                >
                  Enable Options
                </button>
                <button
                  onClick={async () => {
                    setIsBusy(true);
                    try {
                      await rangerPrepareToChangeOptions();
                      toast.success('Ranger ready for option changes');
                    } catch (err: any) {
                      toast.error(err?.message ?? 'Failed to prepare Ranger options');
                    } finally {
                      setIsBusy(false);
                    }
                  }}
                  disabled={isBusy}
                  className="border border-indigo-300 text-indigo-700 text-sm py-2 rounded disabled:opacity-50"
                >
                  Change Options
                </button>
              </div>
            )}
          </div>
          )}

          {/* Scanned items list */}
          <div className="bg-white rounded-lg shadow-sm p-4 max-h-[28dvh] lg:max-h-96 overflow-y-auto">
            <div className="text-xs font-semibold text-gray-500 mb-3">
              SCANNED ITEMS ({session.items.length})
            </div>
            {session.items.length === 0 ? (
              <p className="text-sm text-gray-400">No items scanned yet</p>
            ) : (
              <div className="space-y-2">
                {session.items.map((item) => (
                  <div
                    key={item.scanID}
                    onClick={() => setCurrentItem(item)}
                    className={`flex items-center gap-3 p-2 rounded cursor-pointer hover:bg-gray-50
                      ${currentItem?.scanID === item.scanID ? 'bg-blue-50 border border-blue-200' : ''}`}
                  >
                    <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-xs font-mono">
                      {String(item.seqNo).padStart(3, '0')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium">
                        {item.isSlip ? '📄 Slip' : '🏦 Cheque'}
                        {item.chqNo && ` — ${item.chqNo}`}
                      </div>
                      <div className="text-xs text-gray-500 truncate">
                        {item.scanStatus === 'Captured' ? '✓ Captured' : item.scanStatus}
                        {item.rrState === 0 && !item.isSlip && ' ⚠ MICR Error'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Floating mock capture (bottom-right) */}
      {user?.isDeveloper && mockScanEnabled && controlsVisible && !(session.withSlip && !activeSlipId) && !(session.withSlip && scanTarget === 'Slip' && !slipCreated) && (
        <button
          type="button"
          onClick={() => handleCapture(true)}
          disabled={isBusy}
          className="fixed bottom-6 right-6 z-50 bg-orange-600 text-white text-sm font-semibold px-4 py-3 rounded-full shadow-lg hover:bg-orange-700 active:scale-[0.99]"
        >
          Mock Capture
        </button>
      )}

      {/* Start modal */}
      {showStartModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Start Scanning</h2>
            {startStep === 'scanType' ? (
              <>
                <p className="text-sm text-gray-500 mb-5">Choose scan mode</p>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setSelectedScanType('Scan');
                      setStartStep('slipMode');
                    }}
                    className="w-full bg-blue-700 text-white py-3 rounded-lg font-medium hover:bg-blue-800"
                  >
                    Scan
                  </button>
                  <button
                    onClick={() => {
                      setSelectedScanType('Rescan');
                      setStartStep('slipMode');
                    }}
                    className="w-full bg-indigo-700 text-white py-3 rounded-lg font-medium hover:bg-indigo-800"
                  >
                    Rescan
                  </button>
                  <button
                    onClick={() => navigate('/')}
                    className="w-full text-gray-500 text-sm py-2"
                  >
                    Cancel
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-500 mb-5">Mode: {selectedScanType}. Choose slip option.</p>
                <div className="space-y-3">
                  <button
                    onClick={() => handleStart(true)}
                    className="w-full bg-blue-700 text-white py-3 rounded-lg font-medium hover:bg-blue-800"
                  >
                    With Slip (Slip + Cheques)
                  </button>
                  <button
                    onClick={() => handleStart(false)}
                    className="w-full bg-gray-100 text-gray-800 py-3 rounded-lg font-medium hover:bg-gray-200"
                  >
                    Without Slip (Cheques only)
                  </button>
                  <button
                    onClick={() => setStartStep('scanType')}
                    className="w-full text-gray-500 text-sm py-2"
                  >
                    Back
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Slip form modal */}
      {showSlipForm && session && (
        <SlipFormModal
          batchId={id}
          defaultPickupPoint={pickupPointCode}
          onClose={() => setShowSlipForm(false)}
          onSaved={(slip) => {
            setShowSlipForm(false);
            setSlipCreated(true);
            setActiveSlipId(slip.slipID);
            setScanTarget('Slip');
            setScannerChoice(null);
            loadSession();
            toast.success('Slip entry saved — scan slip pages, then cheques');
          }}
        />
      )}
    </div>
  );
}
