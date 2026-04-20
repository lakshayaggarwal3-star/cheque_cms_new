// =============================================================================
// File        : MobileScanPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Mobile camera-based scanning page for slip images and cheques.
// Created     : 2026-04-14
// =============================================================================

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getBatch } from '../services/batchService';
import { completeScan, getScanSession, startScan, uploadMobileCheque, uploadMobileSlipScan } from '../services/scanService';
import { toast } from '../store/toastStore';
import type { ChequeItemDto, SlipScanDto, ScanSessionDto } from '../types';
import { BatchStatus } from '../types';
import { getImageUrl } from '../utils/imageUtils';
import { SlipFormModal } from '../components/SlipFormModal';
import { CameraCapture } from '../components/CameraCapture';
import { ImageEditModal } from '../components/ImageEditModal';

type ScanTarget = 'Slip' | 'Cheque';
type MobileScanStep = 'SlipScan' | 'ChequeScan';
type EditableImageTarget = 'slip-front' | 'cheque-front' | 'cheque-back';

export function MobileScanPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const id = Number(batchId);

  const [session, setSession] = useState<ScanSessionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [scanTarget, setScanTarget] = useState<ScanTarget>('Slip');
  const [scanStep, setScanStep] = useState<MobileScanStep>('SlipScan');
  const [slipScansCount, setSlipScansCount] = useState(0);
  const [showSlipForm, setShowSlipForm] = useState(false);
  const [slipCreated, setSlipCreated] = useState(false);
  const [activeSlipId, setActiveSlipId] = useState<number | null>(null);
  const [pickupPointCode, setPickupPointCode] = useState('');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [editorState, setEditorState] = useState<{ file: File; target: EditableImageTarget; title: string } | null>(null);
  const [currentCheque, setCurrentCheque] = useState<ChequeItemDto | null>(null);
  const [currentSlipScan, setCurrentSlipScan] = useState<SlipScanDto | null>(null);
  const [micr, setMicr] = useState({ chqNo: '', micr1: '', micr2: '', micr3: '' });

  const hasSlipScanForActiveSlip = useMemo(() => {
    if (!activeSlipId || !session?.slipGroups) return false;
    const activeGroup = session.slipGroups.find(g => g.slipEntryId === activeSlipId);
    return (activeGroup?.slipScans?.length ?? 0) > 0;
  }, [activeSlipId, session?.slipGroups]);

  const canSwitchToCheque = !session?.withSlip || hasSlipScanForActiveSlip;

  const allCheques = useMemo(
    () => session?.slipGroups?.flatMap(g => g.cheques ?? []) ?? [],
    [session?.slipGroups]
  );

  const clearSelectedPhotos = () => {
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

  const loadSession = useCallback(async () => {
    try {
      const [scanSession, batch] = await Promise.all([getScanSession(id), getBatch(id)]);
      setSession(scanSession);
      setPickupPointCode(batch.pickupPointCode ?? '');

      if (scanSession.slipGroups && scanSession.slipGroups.length > 0) {
        setSlipCreated(true);
        const latest = scanSession.slipGroups[scanSession.slipGroups.length - 1];
        setActiveSlipId(latest.slipEntryId);
      }

      // Auto-start scanning with settings from batch creation
      if (scanSession.batchStatus === BatchStatus.Created || scanSession.batchStatus === BatchStatus.ScanningPending) {
        setBusy(true);
        try {
          const withSlip = scanSession.withSlip ?? false;
          const scanType = scanSession.scanType ?? 'Scan';
          await startScan(id, withSlip, scanType);
          setSlipCreated(!withSlip);
          setActiveSlipId(null);
          setScanTarget(withSlip ? 'Slip' : 'Cheque');
          if (withSlip) setShowSlipForm(true);
        } catch (err: any) {
          toast.error(err?.response?.data?.message ?? 'Failed to start scanning');
        } finally {
          setBusy(false);
        }
      }
    } catch {
      toast.error('Failed to load mobile scan session');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    loadSession();
    return () => {
      // Mobile camera/file picker can temporarily background/unmount this page on some devices.
      // Releasing lock here causes the batch to jump back to Scan/Rescan start unexpectedly.
    };
  }, [id, loadSession]);

  useEffect(() => {
    return () => { if (frontPreview) URL.revokeObjectURL(frontPreview); };
  }, [frontPreview]);

  useEffect(() => {
    return () => { if (backPreview) URL.revokeObjectURL(backPreview); };
  }, [backPreview]);

  const handleStart = async (withSlip: boolean, scanType: 'Scan' | 'Rescan' = 'Scan') => {
    setBusy(true);
    try {
      await startScan(id, withSlip, scanType);
      setSlipCreated(!withSlip);
      setActiveSlipId(null);
      setScanTarget(withSlip ? 'Slip' : 'Cheque');
      if (withSlip) setShowSlipForm(true);
      await loadSession();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to start scanning');
    } finally {
      setBusy(false);
    }
  };

  const handleCapture = async () => {
    if (!session) return;
    if (session.withSlip && !activeSlipId) {
      toast.error('Create slip entry first');
      return;
    }
    if (!frontFile && !backFile) {
      toast.error('Capture at least one image');
      return;
    }
    setBusy(true);
    try {
      if (scanStep === 'SlipScan') {
        // Slip scanning - only front image needed
        if (!activeSlipId) { toast.error('No active slip'); return; }
        if (!frontFile) { toast.error('Capture slip image first'); return; }
        
        const activeGroup = session.slipGroups?.find(g => g.slipEntryId === activeSlipId);
        const nextScanOrder = (activeGroup?.slipScans?.length ?? 0) + 1;
        const slipScan = await uploadMobileSlipScan(id, {
          slipEntryId: activeSlipId,
          scanOrder: nextScanOrder,
          image: frontFile,
        });
        toast.success('Slip image uploaded');
        setCurrentSlipScan(slipScan);
        setCurrentCheque(null);
        clearSelectedPhotos();
        setSlipScansCount(prev => prev + 1);
        await loadSession();
        // Stay in slip mode - user can capture multiple slip images
      } else {
        // Cheque scanning - front and/or back images
        const slipEntryId = session.withSlip
          ? activeSlipId ?? session.slipGroups?.[0]?.slipEntryId ?? 0
          : session.slipGroups?.[0]?.slipEntryId ?? 0;
        const activeGroup = session.slipGroups?.find(g => g.slipEntryId === slipEntryId);
        const nextChqSeq = (activeGroup?.cheques?.length ?? 0) + 1;
        const cheque = await uploadMobileCheque(id, {
          slipEntryId,
          chqSeq: nextChqSeq,
          imageFront: frontFile ?? undefined,
          imageBack: backFile ?? undefined,
          chqNo: micr.chqNo || undefined,
          scanMICR1: micr.micr1 || undefined,
          scanMICR2: micr.micr2 || undefined,
          scanMICR3: micr.micr3 || undefined,
        });
        toast.success('Cheque image uploaded');
        setCurrentCheque(cheque);
        setCurrentSlipScan(null);
        clearSelectedPhotos();
        setMicr({ chqNo: '', micr1: '', micr2: '', micr3: '' });
        await loadSession();
        // Stay in cheque mode - user can capture multiple cheques
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const moveToChequeScan = () => {
    if (slipScansCount === 0) {
      toast.warning('Please capture at least one slip image first');
      return;
    }
    clearSelectedPhotos();
    setScanStep('ChequeScan');
    toast.success('Now capturing cheques');
  };

  const startNewSlipEntry = () => {
    setActiveSlipId(null);
    setSlipScansCount(0);
    clearSelectedPhotos();
    setScanStep('SlipScan');
    setShowSlipForm(true);
  };

  const handleComplete = async () => {
    setBusy(true);
    try {
      await completeScan(id);
      toast.success('Scanning completed');
      navigate('/');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to complete scanning');
    } finally {
      setBusy(false);
    }
  };

  const latestFrontPath = currentCheque?.frontImagePath ?? currentSlipScan?.imagePath ?? null;
  const latestBackPath = currentCheque?.backImagePath ?? null;

  if (loading) return <div className="p-6 text-center text-gray-400 animate-pulse">Loading mobile scan...</div>;
  if (!session) return <div className="p-6 text-center text-red-500">Session not found</div>;

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h1 className="text-lg font-bold text-gray-900">Mobile Scan - {session.batchNo}</h1>
        <p className="text-xs text-gray-500 mt-1">
          {session.withSlip ? 'With Slip' : 'Without Slip'} | Cheques: {session.totalCheques} | Slips: {session.totalSlipEntries}
        </p>
      </div>

      {session.withSlip && !slipCreated && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <p className="text-sm text-amber-800 font-medium">Create slip entry before capturing images.</p>
          <button
            type="button"
            onClick={() => setShowSlipForm(true)}
            className="mt-3 w-full bg-amber-600 text-white py-2 rounded-lg"
          >
            Open Slip Entry
          </button>
        </div>
      )}

      {(!session.withSlip || slipCreated) && (
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
          {/* Step Indicator */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex-1">
              <div className="text-xs font-semibold text-gray-500">
                {scanStep === 'SlipScan' ? 'SLIP SCANNING' : 'CHEQUE SCANNING'}
              </div>
              {session.withSlip && scanStep === 'SlipScan' && (
                <div className="text-xs text-gray-400 mt-0.5">
                  {slipScansCount} image(s) captured
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
              Collaborator Mobile Scanner
            </div>
            <div className="mt-1 text-sm font-semibold text-slate-900">
              {scanStep === 'SlipScan' ? 'Slip capture mode' : 'Cheque capture mode'}
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-600">
              Capture with a mobile device, edit the image in the next modal, then save it back into the batch.
            </p>

            <div className="mt-4">
              <CameraCapture
                mode={scanStep === 'SlipScan' ? 'slip' : 'cheque'}
                isMockMode={false}
                onCaptureFront={(file) => openImageEditor(file, scanStep === 'SlipScan' ? 'slip-front' : 'cheque-front')}
                onCaptureBack={scanStep === 'ChequeScan' ? (file) => openImageEditor(file, 'cheque-back') : undefined}
                frontPreview={frontPreview}
                backPreview={scanStep === 'ChequeScan' ? backPreview : undefined}
                disabled={busy}
              />
            </div>

            {(frontFile || backFile) && (
              <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => frontFile && openImageEditor(frontFile, scanStep === 'SlipScan' ? 'slip-front' : 'cheque-front')}
                  disabled={!frontFile}
                  className="rounded-xl border border-emerald-300 px-4 py-2.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
                >
                  Edit front
                </button>
                {scanStep === 'ChequeScan' ? (
                  <button
                    type="button"
                    onClick={() => backFile && openImageEditor(backFile, 'cheque-back')}
                    disabled={!backFile}
                    className="rounded-xl border border-emerald-300 px-4 py-2.5 text-sm font-medium text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
                  >
                    Edit back
                  </button>
                ) : (
                  <div className="rounded-xl border border-dashed border-emerald-200 px-4 py-2.5 text-center text-sm text-emerald-700">
                    Single image slip scan
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={busy || (!frontFile && !backFile)}
                  className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800 disabled:opacity-50"
                >
                  {busy ? 'Uploading...' : (scanStep === 'SlipScan' ? 'Save slip image' : 'Save cheque image(s)')}
                </button>
              </div>
            )}
          </div>

          {/* MICR fields for cheque scanning */}
          {scanStep === 'ChequeScan' && (
            <div className="grid grid-cols-2 gap-2">
              <input
                value={micr.chqNo}
                onChange={(e) => setMicr(m => ({ ...m, chqNo: e.target.value }))}
                placeholder="Cheque No"
                maxLength={6}
                className="border rounded px-2 py-2 text-sm"
              />
              <input
                value={micr.micr1}
                onChange={(e) => setMicr(m => ({ ...m, micr1: e.target.value }))}
                placeholder="MICR1"
                maxLength={9}
                className="border rounded px-2 py-2 text-sm"
              />
              <input
                value={micr.micr2}
                onChange={(e) => setMicr(m => ({ ...m, micr2: e.target.value }))}
                placeholder="MICR2"
                maxLength={6}
                className="border rounded px-2 py-2 text-sm"
              />
              <input
                value={micr.micr3}
                onChange={(e) => setMicr(m => ({ ...m, micr3: e.target.value }))}
                placeholder="MICR3"
                maxLength={3}
                className="border rounded px-2 py-2 text-sm"
              />
            </div>
          )}

          {/* Navigation Buttons */}
          {session.withSlip && scanStep === 'SlipScan' && slipScansCount > 0 && (
            <button
              type="button"
              onClick={moveToChequeScan}
              className="w-full bg-blue-700 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-blue-800"
            >
              Start Cheque Scanning →
            </button>
          )}

          {scanStep === 'ChequeScan' && (
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button
                type="button"
                onClick={startNewSlipEntry}
                className="bg-orange-500 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-orange-600"
              >
                + New Slip Entry
              </button>
              <button
                type="button"
                onClick={handleComplete}
                disabled={busy}
                className="bg-green-700 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-green-800 disabled:opacity-50"
              >
                {busy ? 'Completing...' : '✓ Complete Batch'}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="text-xs font-semibold text-gray-500 mb-2">
          Scanned Items ({allCheques.length} cheques)
        </div>
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {session.slipGroups?.map(slip => (
            <div key={slip.slipEntryId} className="border border-gray-200 rounded p-2">
              <div className="text-xs font-semibold text-gray-700 mb-1">
                Slip {slip.slipNo} — {slip.cheques?.length ?? 0} cheques, {slip.slipScans?.length ?? 0} slip images
              </div>
              {slip.cheques?.map(cheque => (
                <button
                  type="button"
                  key={cheque.chequeItemId}
                  onClick={() => setCurrentCheque(cheque)}
                  className="w-full text-left px-2 py-1 rounded hover:bg-gray-50 text-xs text-gray-600"
                >
                  Cheque #{String(cheque.chqSeq).padStart(2, '0')} — {cheque.scanStatus}
                </button>
              ))}
            </div>
          ))}
          {(!session.slipGroups || session.slipGroups.length === 0) && (
            <p className="text-sm text-gray-400">No captures yet</p>
          )}
        </div>
      </div>


      {showSlipForm && (
        <SlipFormModal
          batchId={id}
          defaultPickupPoint={pickupPointCode}
          onClose={() => setShowSlipForm(false)}
          onSaved={(slip) => {
            setShowSlipForm(false);
            setSlipCreated(true);
            setActiveSlipId(slip.slipEntryId);
            setScanTarget('Slip');
            loadSession();
            toast.success('Slip entry saved');
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
