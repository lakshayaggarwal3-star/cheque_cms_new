// =============================================================================
// File        : useScannerLogic.ts
// Project     : CPS — Cheque Processing System
// Module      : Scanning — Scanner Hook
// Description : Custom hook for scanner operations (Ranger, Flatbed, Mock)
// Created     : 2026-04-19
// =============================================================================

import { useState, useCallback, useEffect } from 'react';
import {
  captureCheque, completeScan, startFeed, stopFeed,
  uploadMobileCheque, uploadMobileSlipScan,
} from '../services/scanService';
import { toast } from '../store/toastStore';
import {
  rangerEnableOptions, rangerGetCaptureData, rangerPrepareToChangeOptions,
  rangerSetEndorsementOptions, rangerSetImagingOptions, rangerShutdown,
  rangerStartFeeding, rangerStartup, rangerStopFeeding,
  RangerTransportState, subscribeToRangerState, getRangerState,
  setRangerEndorsementProvider, subscribeToRangerItems,
  subscribeToRangerModel, getRangerModel,
} from '../services/rangerWebService';
import {
  flatbedConnect, flatbedDetectScanners, flatbedAutoSelect, flatbedScan,
  getFlatbedWsUrl, isFlatbedConnected, setFlatbedWsUrl as applyFlatbedWsUrl, flatbedDisconnectAction,
  type FlatbedScanner, type ScanSettings,
} from '../services/flatbedWebService';
import type { ChequeItemDto, SlipScanDto } from '../types';

type EditableImageTarget = 'slip-front' | 'cheque-front' | 'cheque-back';

interface UseScannerLogicProps {
  batchId: number;
  batchNo: string;
  activeSlipEntryId: number | null;
  nextSlipScanOrder: number;
  nextChqSeq: number;
  mockScanEnabled: boolean;
  isDeveloper?: boolean;
  onCaptureSuccess: () => Promise<void>;
  onClearCameraFiles: () => void;
  frontFile: File | null;
  backFile: File | null;
  openImageEditor: (file: File, target: EditableImageTarget) => void;
  rangerMicrEnabled?: boolean;
  rangerEndorsementEnabled?: boolean;
  rangerEndorsementUseImageName?: boolean;
  rangerEndorsementCustomText?: string;
  rangerEndorsementBatchName?: string;
}

export function useScannerLogic({
  batchId,
  batchNo,
  activeSlipEntryId,
  nextSlipScanOrder,
  nextChqSeq,
  mockScanEnabled,
  isDeveloper,
  onCaptureSuccess,
  onClearCameraFiles,
  frontFile,
  backFile,
  openImageEditor,
  rangerMicrEnabled = true,
  rangerEndorsementEnabled = false,
  rangerEndorsementUseImageName = true,
  rangerEndorsementCustomText = '',
  rangerEndorsementBatchName = '',
}: UseScannerLogicProps) {
  // Scanner state
  const [scannerChoice, setScannerChoice] = useState<'Ranger' | 'Document' | null>('Ranger');
  const [scanRoundActive, setScanRoundActive] = useState(false);
  const [feedRunning, setFeedRunning] = useState<{ Cheque: boolean; Slip: boolean }>({ Cheque: false, Slip: false });
  const [rangerState, setRangerState] = useState<RangerTransportState>(getRangerState());

  // Preview
  const [mockPreview, setMockPreview] = useState<{ front: string; back: string } | null>(null);
  const [currentSlipScan, setCurrentSlipScan] = useState<SlipScanDto | null>(null);
  const [currentCheque, setCurrentCheque] = useState<ChequeItemDto | null>(null);

  // Scanner settings
  const [rangerWsUrl, setRangerWsUrl] = useState('ws://127.0.0.1:9002');
  const [flatbedWsUrl, setFlatbedWsUrl] = useState(getFlatbedWsUrl());
  const [useFlatbedWs, setUseFlatbedWs] = useState(true);
  const [flatbedConnecting, setFlatbedConnecting] = useState(false);
  const [detectedScanners, setDetectedScanners] = useState<FlatbedScanner[]>([]);
  const [selectedScannerId, setSelectedScannerId] = useState('');
  const [flatbedResolution, setFlatbedResolution] = useState(300);
  const [flatbedMode, setFlatbedMode] = useState<ScanSettings['mode']>('Color');
  const [flatbedFormat, setFlatbedFormat] = useState<ScanSettings['format']>('JPEG');
  const [flatbedStatus, setFlatbedStatus] = useState<'idle' | 'connecting' | 'ready' | 'error'>('idle');
  const [flatbedError, setFlatbedError] = useState('');

  const [isBusy, setIsBusy] = useState(false);
  const [rangerModel, setRangerModel] = useState<string>(getRangerModel());

  // Sync Ranger state + model
  useEffect(() => {
    const unsubModel = subscribeToRangerModel((model) => setRangerModel(model));
    return () => { unsubModel(); };
  }, []);

  useEffect(() => {
    const unsubState = subscribeToRangerState((state) => {
      setRangerState(state);
      
      // Auto-update feedRunning based on hardware state
      if (state === RangerTransportState.TransportFeeding) {
        setFeedRunning({ Cheque: true, Slip: true });
      } else if (
        state === RangerTransportState.TransportReadyToFeed || 
        state === RangerTransportState.TransportShutDown ||
        state === RangerTransportState.TransportChangeOptions
      ) {
        setFeedRunning({ Cheque: false, Slip: false });
      }
    });
    
    // Set endorsement provider for dynamic endorsement (BatchName ImageName)
    setRangerEndorsementProvider(() => {
      const bName = rangerEndorsementBatchName || batchNo;
      // Use Ranger CSN macro for automatic sequencing: <CSN:start,inc,max>
      // This is more reliable for bulk scanning.
      const startSeq = String(nextChqSeq).padStart(4, '0');
      return `<CSN:${startSeq},1,9999> ${bName}`;
    });

    // Listen for items as they are scanned
    const unsubItems = subscribeToRangerItems(async (data) => {
      if (scannerChoice !== 'Ranger' || !activeSlipEntryId) return;
      
      console.log('Ranger: Item captured in pocket, uploading...', data.itemID);
      
      try {
        const front = base64ToFile(data.frontBase64, 'cheque-front.jpg');
        const back = base64ToFile(data.backBase64, 'cheque-back.jpg');
        const frontTiff = data.frontTiffBase64 ? base64ToFile(data.frontTiffBase64, 'cheque-front.tif') : undefined;
        const backTiff = data.backTiffBase64 ? base64ToFile(data.backTiffBase64, 'cheque-back.tif') : undefined;
        
        if (!front) throw new Error('No front image captured');

        // Note: We use the CURRENT nextChqSeq and then increment it
        // In a high-speed scanner, we might need a queue to avoid race conditions
        const result = await uploadMobileCheque(batchId, {
          slipEntryId: activeSlipEntryId,
          chqSeq: nextChqSeq,
          imageFront: front,
          imageBack: back,
          imageFrontTiff: frontTiff,
          imageBackTiff: backTiff,
          micrRaw: data.micrRaw || undefined,
          scanMICRRaw: data.micrRaw || undefined,
          scanMICR1: data.scanMicr1 || undefined,
          scanMICR2: data.scanMicr2 || undefined,
          scanMICR3: data.scanMicr3 || undefined,
          scannerType: 'Ranger',
        });

        setCurrentCheque(result);
        await onCaptureSuccess(); // This increments nextChqSeq and reloads session
      } catch (err: any) {
        console.error('Ranger Item Upload Error:', err);
        toast.error(`Failed to upload scanned item: ${err.message}`);
      }
    });

    return () => {
      unsubState();
      unsubItems();
      setRangerEndorsementProvider(null);
    };
  }, [scannerChoice, batchNo, nextChqSeq, activeSlipEntryId, batchId, onCaptureSuccess, rangerEndorsementBatchName]);

  // Automate Ranger Lifecycle (ShutDown -> ChangeOptions -> ReadyToFeed)
  useEffect(() => {
    // Only auto-init if we have chosen Ranger or are in a step that likely needs it
    if (scannerChoice !== 'Ranger') return;
    
    const runAutoRanger = async () => {
      try {
        if (rangerState === RangerTransportState.TransportShutDown || rangerState === RangerTransportState.TransportUnknownState) {
          console.log('Ranger: Auto-starting...');
          await rangerStartup(rangerWsUrl);
        } else if (rangerState === RangerTransportState.TransportChangeOptions) {
          console.log('Ranger: Auto-enabling options...');
          // Set options once we are in ChangeOptions state
          await rangerSetImagingOptions({ needImaging: true, needFrontGrayscale: true, needRearGrayscale: true });
          
          if (rangerEndorsementEnabled) {
            const bName = rangerEndorsementBatchName || batchNo;
            const startSeq = String(nextChqSeq).padStart(4, '0');
            const endorsementText = rangerEndorsementUseImageName
              ? `<CSN:${startSeq},1,9999> ${bName}`
              : (rangerEndorsementCustomText || '');
            await rangerSetEndorsementOptions({ enabled: true, text: endorsementText });
          } else {
            await rangerSetEndorsementOptions({ enabled: false });
          }
          
          await rangerEnableOptions();
        }
      } catch (err: any) {
        console.error('Ranger Auto-Init Error:', err);
        // toast.error(`Ranger auto-init failed: ${err.message}`);
      }
    };

    runAutoRanger();
  }, [scannerChoice, rangerState, rangerWsUrl, batchNo, nextChqSeq, rangerEndorsementEnabled, rangerEndorsementUseImageName, rangerEndorsementCustomText]);

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const makeMockImage = (doc: string, side: string) => {
    const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='1200' height='700'><rect width='100%' height='100%' fill='${side === 'Front' ? '#e7f0ff' : '#f3f4f6'}'/><rect x='40' y='40' width='1120' height='620' rx='16' fill='white' stroke='#94a3b8' stroke-width='3'/><text x='600' y='340' text-anchor='middle' font-family='Arial' font-size='40' fill='#1f2937'>${doc} ${side}</text><text x='600' y='390' text-anchor='middle' font-family='Arial' font-size='24' fill='#6b7280'>Developer Mock</text></svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  };

  const base64ToFile = (base64: string, name: string): File | undefined => {
    if (!base64) return undefined;
    const mime = base64.match(/^data:(.*?);base64,/)?.[1] ?? 'image/jpeg';
    const data = base64.includes(',') ? base64.split(',')[1] : base64;
    const bytes = new Uint8Array(atob(data).split('').map(c => c.charCodeAt(0)));
    return new File([bytes], name, { type: mime });
  };

  // ─── Feed controls ────────────────────────────────────────────────────────

  const handleStartFeed = useCallback(async (type: 'Cheque' | 'Slip') => {
    setIsBusy(true);
    try {
      if (scannerChoice === 'Ranger') {
        if (rangerState !== RangerTransportState.TransportReadyToFeed) {
          throw new Error('Ranger scanner is not ready yet. Please wait a moment.');
        }
        await rangerStartFeeding(type === 'Slip' ? 2 : 0, 0);
      } else {
        await startFeed(batchId, type);
      }
      setFeedRunning(p => ({ ...p, [type]: true }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err?.message ?? `Failed to start ${type} feed`);
    } finally {
      setIsBusy(false);
    }
  }, [scannerChoice, batchId, rangerState]);

  const handleStopFeed = useCallback(async (type: 'Cheque' | 'Slip') => {
    setIsBusy(true);
    try {
      if (scannerChoice === 'Ranger') {
        if (rangerState === RangerTransportState.TransportFeeding) {
          await rangerStopFeeding();
        }
      } else {
        await stopFeed(batchId, type);
      }
      setFeedRunning(p => ({ ...p, [type]: false }));
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err?.message ?? `Failed to stop ${type} feed`);
    } finally {
      setIsBusy(false);
    }
  }, [scannerChoice, batchId, rangerState]);

  const handleRangerStopAndCapture = useCallback(async () => {
    if (!activeSlipEntryId) return;
    setIsBusy(true);
    try {
      if (rangerState === RangerTransportState.TransportFeeding) {
        await rangerStopFeeding();
      }
      setFeedRunning(p => ({ ...p, Cheque: false }));
      
      await rangerPrepareToChangeOptions();
      const capture = rangerGetCaptureData('Both');
      const front = base64ToFile(capture.frontBase64, 'cheque-front.jpg');
      const back = base64ToFile(capture.backBase64, 'cheque-back.jpg');
      
      if (!front) {
        throw new Error('No image captured from Ranger hopper');
      }

      const result = await uploadMobileCheque(batchId, {
        slipEntryId: activeSlipEntryId,
        chqSeq: nextChqSeq,
        imageFront: front,
        imageBack: back,
        micrRaw: capture.micrRaw || undefined,
        scanMICRRaw: capture.micrRaw || undefined,
      });
      setCurrentCheque(result);
      await onCaptureSuccess();
      toast.success('Cheque captured from Ranger');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? err?.message ?? 'Failed to stop/capture Ranger feed');
    } finally {
      setIsBusy(false);
    }
  }, [activeSlipEntryId, nextChqSeq, batchId, onCaptureSuccess, rangerState]);

  // ─── Capture ──────────────────────────────────────────────────────────────

  const handleCaptureSlipScan = useCallback(async () => {
    if (!activeSlipEntryId) return;

    // Dev mock path — camera file was captured, upload it as a real entry
    if (isDeveloper && mockScanEnabled && frontFile) {
      setIsBusy(true);
      try {
        const result = await uploadMobileSlipScan(batchId, { slipEntryId: activeSlipEntryId, scanOrder: nextSlipScanOrder, image: frontFile, scannerType: 'Scanner' });
        onClearCameraFiles();
        setCurrentSlipScan(result);
        await onCaptureSuccess();
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
      const scanResult = await flatbedScan(selectedScannerId, { resolution: flatbedResolution, mode: flatbedMode, format: flatbedFormat });
      const mimeType = scanResult.format === 'PNG' ? 'image/png' : 'image/jpeg';
      const ext = scanResult.format === 'PNG' ? 'png' : 'jpg';
      const file = base64ToFile(`data:${mimeType};base64,${scanResult.image_base64}`, `slip-scan.${ext}`);
      if (!file) throw new Error('Invalid image data from scanner');
      const result = await uploadMobileSlipScan(batchId, { slipEntryId: activeSlipEntryId, scanOrder: nextSlipScanOrder, image: file });
      setCurrentSlipScan(result);
      await onCaptureSuccess();
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
  }, [activeSlipEntryId, isDeveloper, mockScanEnabled, frontFile, batchId, nextSlipScanOrder, onClearCameraFiles, onCaptureSuccess, flatbedStatus, selectedScannerId, flatbedResolution, flatbedMode, flatbedFormat]);

  const handleCaptureCheque = useCallback(async () => {
    if (!activeSlipEntryId) return;
    setIsBusy(true);
    try {
      let result: ChequeItemDto;
      if (isDeveloper && mockScanEnabled && (frontFile || backFile)) {
        result = await uploadMobileCheque(batchId, { slipEntryId: activeSlipEntryId, chqSeq: nextChqSeq, imageFront: frontFile ?? undefined, imageBack: backFile ?? undefined, scannerType: 'Scanner' });
        onClearCameraFiles();
      } else if (isDeveloper && mockScanEnabled) {
        result = await captureCheque(batchId, { slipEntryId: activeSlipEntryId, scannerType: 'Cheque' });
        setMockPreview({ front: makeMockImage('Cheque', 'Front'), back: makeMockImage('Cheque', 'Back') });
      } else {
        await rangerPrepareToChangeOptions();
        const capture = rangerGetCaptureData('Both');
        const front = base64ToFile(capture.frontBase64, 'cheque-front.jpg');
        const back = base64ToFile(capture.backBase64, 'cheque-back.jpg');
        result = await uploadMobileCheque(batchId, { slipEntryId: activeSlipEntryId, chqSeq: nextChqSeq, imageFront: front, imageBack: back, micrRaw: capture.micrRaw || undefined, scanMICRRaw: capture.micrRaw || undefined });
      }
      setCurrentCheque(result);
      await onCaptureSuccess();
      toast.success('Cheque captured');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Cheque capture failed');
    } finally {
      setIsBusy(false);
    }
  }, [activeSlipEntryId, isDeveloper, mockScanEnabled, frontFile, backFile, batchId, nextChqSeq, onClearCameraFiles, onCaptureSuccess]);

  const handleCompleteScan = useCallback(async (onComplete: () => void) => {
    setIsBusy(true);
    try {
      await completeScan(batchId);
      toast.success('Scanning completed');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to complete scanning');
      setIsBusy(false);
      return;
    }

    // Best-effort scanner cleanup — fire and forget so failures never block navigation
    if (useFlatbedWs) flatbedDisconnectAction().catch(() => {});
    if (scannerChoice === 'Ranger') rangerShutdown().catch(() => {});

    setIsBusy(false);
    onComplete();
  }, [batchId, useFlatbedWs, scannerChoice]);

  // ─── Scanner settings ─────────────────────────────────────────────────────

  const handleSaveSettings = useCallback(() => {
    applyFlatbedWsUrl(flatbedWsUrl);
    toast.success('Scanner settings saved');
  }, [flatbedWsUrl]);

  const handleDetectScanners = useCallback(async () => {
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
  }, [flatbedWsUrl]);

  const handleAutoSelectScanner = useCallback(async () => {
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
  }, []);

  // Auto-connect flatbed scanner on mount
  // Auto-connect flatbed scanner on mount
  const autoInitScanner = useCallback(async () => {
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
  }, [flatbedWsUrl]);

  const retryRanger = useCallback(async () => {
    setIsBusy(true);
    try {
      await rangerShutdown();
      // Resetting state to unknown will trigger the auto-init useEffect
      setRangerState(RangerTransportState.TransportUnknownState);
      await rangerStartup(rangerWsUrl);
      toast.success('Ranger reconnection initiated');
    } catch (err: any) {
      toast.error(`Ranger retry failed: ${err.message}`);
    } finally {
      setIsBusy(false);
    }
  }, [rangerWsUrl]);

  const cleanup = useCallback(() => {
    rangerShutdown().catch(() => {});
  }, []);

  return {
    // State
    batchNo,
    rangerMicrEnabled,
    scannerChoice,
    scanRoundActive,
    feedRunning,
    mockPreview,
    currentSlipScan,
    currentCheque,
    rangerWsUrl,
    flatbedWsUrl,
    useFlatbedWs,
    flatbedConnecting,
    detectedScanners,
    selectedScannerId,
    flatbedResolution,
    flatbedMode,
    flatbedFormat,
    flatbedStatus,
    flatbedError,
    isBusy,
    rangerState,
    rangerModel,

    // Setters
    setScannerChoice,
    setScanRoundActive,
    setFeedRunning,
    setMockPreview,
    setCurrentSlipScan,
    setCurrentCheque,
    setRangerWsUrl,
    setFlatbedWsUrl,
    setUseFlatbedWs,
    setDetectedScanners,
    setSelectedScannerId,
    setFlatbedResolution,
    setFlatbedMode,
    setFlatbedFormat,
    setFlatbedStatus,
    setFlatbedError,
    setIsBusy,

    // Actions
    handleStartFeed,
    handleStopFeed,
    handleRangerStopAndCapture,
    handleCaptureSlipScan,
    handleCaptureCheque,
    handleCompleteScan,
    handleSaveSettings,
    handleDetectScanners,
    handleAutoSelectScanner,
    autoInitScanner,
    retryRanger,
    cleanup,
  };
}
