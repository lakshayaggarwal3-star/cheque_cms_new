import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getBatch } from '../services/batchService';
import { completeScan, getScanSession, startScan, uploadMobileScan } from '../services/scanService';
import { getSlipsByBatch } from '../services/slipService';
import { toast } from '../store/toastStore';
import type { ScanItemDto, ScanSessionDto } from '../types';
import { BatchStatus } from '../types';
import { getImageUrl } from '../utils/imageUtils';
import { SlipFormModal } from '../components/SlipFormModal';

type ScanTarget = 'Slip' | 'Cheque';

export function MobileScanPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const id = Number(batchId);

  const [session, setSession] = useState<ScanSessionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [startStep, setStartStep] = useState<'scanType' | 'slipMode'>('scanType');
  const [selectedScanType, setSelectedScanType] = useState<'Scan' | 'Rescan'>('Scan');
  const [scanTarget, setScanTarget] = useState<ScanTarget>('Cheque');
  const [showSlipForm, setShowSlipForm] = useState(false);
  const [slipCreated, setSlipCreated] = useState(false);
  const [activeSlipId, setActiveSlipId] = useState<number | null>(null);
  const [pickupPointCode, setPickupPointCode] = useState('');
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [currentItem, setCurrentItem] = useState<ScanItemDto | null>(null);
  const [micr, setMicr] = useState({ chqNo: '', micr1: '', micr2: '', micr3: '' });
  const frontInputRef = useRef<HTMLInputElement | null>(null);
  const backInputRef = useRef<HTMLInputElement | null>(null);

  const hasSlipScanForActiveSlip = useMemo(() => !!activeSlipId && !!session?.items.some((i) => i.isSlip && i.slipID === activeSlipId), [activeSlipId, session?.items]);
  const canSwitchToCheque = !session?.withSlip || !session.withSlip || hasSlipScanForActiveSlip;

  const clearSelectedPhotos = () => {
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    if (backPreview) URL.revokeObjectURL(backPreview);
    setFrontFile(null);
    setBackFile(null);
    setFrontPreview(null);
    setBackPreview(null);
  };

  const loadSession = useCallback(async () => {
    try {
      const [scanSession, batch] = await Promise.all([getScanSession(id), getBatch(id)]);
      setSession(scanSession);
      setPickupPointCode(batch.pickupPointCode ?? '');
      if (scanSession.withSlip && scanSession.items.some(i => i.isSlip)) setSlipCreated(true);
      if (scanSession.withSlip) {
        const slips = await getSlipsByBatch(id);
        if (slips.length > 0) {
          const latest = slips.reduce((a, b) => (a.slipID >= b.slipID ? a : b));
          setActiveSlipId(latest.slipID);
        }
      }
      if (scanSession.items.length > 0) {
        const latest = scanSession.items[scanSession.items.length - 1];
        setCurrentItem(prev => prev ?? latest);
      }
      if (scanSession.batchStatus === BatchStatus.Created || scanSession.batchStatus === BatchStatus.ScanningPending) {
        setShowStartModal(true);
        setStartStep('scanType');
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
      // Keep lock until explicit completion/navigation; backend stale-lock timeout still protects abandoned sessions.
    };
  }, [id, loadSession]);

  useEffect(() => {
    return () => {
      if (frontPreview) URL.revokeObjectURL(frontPreview);
    };
  }, [frontPreview]);

  useEffect(() => {
    return () => {
      if (backPreview) URL.revokeObjectURL(backPreview);
    };
  }, [backPreview]);

  const handleStart = async (withSlip: boolean) => {
    setBusy(true);
    try {
      await startScan(id, withSlip, selectedScanType);
      setShowStartModal(false);
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
      const item = await uploadMobileScan(id, {
        isSlip: scanTarget === 'Slip',
        slipID: session.withSlip ? activeSlipId ?? undefined : undefined,
        scannerType: 'Mobile-Camera',
        imageFront: frontFile ?? undefined,
        imageBack: backFile ?? undefined,
        chqNo: micr.chqNo || undefined,
        micr1: micr.micr1 || undefined,
        micr2: micr.micr2 || undefined,
        micr3: micr.micr3 || undefined,
      });
      toast.success(scanTarget === 'Slip' ? 'Slip image uploaded' : 'Cheque image uploaded');
      setCurrentItem(item);
      clearSelectedPhotos();
      setMicr({ chqNo: '', micr1: '', micr2: '', micr3: '' });
      await loadSession();
      if (scanTarget === 'Slip') setScanTarget('Cheque');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Upload failed');
    } finally {
      setBusy(false);
    }
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

  const selectFrontFile = (file?: File | null) => {
    if (!file) return;
    if (frontPreview) URL.revokeObjectURL(frontPreview);
    setFrontFile(file);
    setFrontPreview(URL.createObjectURL(file));
  };

  const selectBackFile = (file?: File | null) => {
    if (!file) return;
    if (backPreview) URL.revokeObjectURL(backPreview);
    setBackFile(file);
    setBackPreview(URL.createObjectURL(file));
  };

  if (loading) return <div className="p-6 text-center text-gray-400 animate-pulse">Loading mobile scan...</div>;
  if (!session) return <div className="p-6 text-center text-red-500">Session not found</div>;

  return (
    <div className="space-y-4 pb-20">
      <div className="bg-white rounded-lg shadow-sm p-4">
        <h1 className="text-lg font-bold text-gray-900">Mobile Scan - {session.batchNo}</h1>
        <p className="text-xs text-gray-500 mt-1">
          {session.withSlip ? 'With Slip' : 'Without Slip'} | Cheques: {session.totalScanned} | Slips: {session.totalSlips}
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
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setScanTarget('Slip')}
              className={`py-2 rounded text-sm ${scanTarget === 'Slip' ? 'bg-indigo-700 text-white' : 'bg-gray-100 text-gray-700'}`}
            >
              Slip
            </button>
            <button
              type="button"
              onClick={() => setScanTarget('Cheque')}
              disabled={!canSwitchToCheque}
              className={`py-2 rounded text-sm ${scanTarget === 'Cheque' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700'} disabled:opacity-50`}
            >
              Cheque
            </button>
          </div>

          {session.withSlip && slipCreated && (
            <button
              type="button"
              onClick={() => setShowSlipForm(true)}
              className="w-full border border-orange-500 text-orange-700 py-2 rounded-lg text-sm"
            >
              + New Slip Entry
            </button>
          )}

          <div className="space-y-2">
            <label htmlFor="mobile-front" className="block text-xs text-gray-600">Front Image</label>
            <input
              ref={frontInputRef}
              id="mobile-front"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => selectFrontFile(e.target.files?.[0])}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => frontInputRef.current?.click()}
              className="w-full border border-blue-300 text-blue-700 py-2 rounded-lg text-sm font-medium hover:bg-blue-50"
            >
              {frontFile ? 'Retake Front Image' : 'Capture Front Image'}
            </button>
            {frontPreview && <img src={frontPreview} alt="Front preview" className="w-full max-h-56 object-contain bg-gray-50 rounded border" />}
          </div>

          <div className="space-y-2">
            <label htmlFor="mobile-back" className="block text-xs text-gray-600">Back Image</label>
            <input
              ref={backInputRef}
              id="mobile-back"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(e) => selectBackFile(e.target.files?.[0])}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => backInputRef.current?.click()}
              className="w-full border border-blue-300 text-blue-700 py-2 rounded-lg text-sm font-medium hover:bg-blue-50"
            >
              {backFile ? 'Retake Back Image' : 'Capture Back Image'}
            </button>
            {backPreview && <img src={backPreview} alt="Back preview" className="w-full max-h-56 object-contain bg-gray-50 rounded border" />}
          </div>

          {scanTarget === 'Cheque' && (
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

          <button
            type="button"
            onClick={handleCapture}
            disabled={busy}
            className="w-full bg-green-700 text-white py-2 rounded-lg disabled:opacity-50"
          >
            {busy ? 'Uploading...' : 'Capture & Upload'}
          </button>
        </div>
      )}

      {currentItem && (
        <div className="bg-white rounded-lg shadow-sm p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-500">Latest Captured</p>
          {currentItem.imageFrontPath && (
            <img src={getImageUrl(currentItem.imageFrontPath)} alt="Latest front" className="w-full max-h-56 object-contain bg-gray-50 rounded border" />
          )}
          {currentItem.imageBackPath && (
            <img src={getImageUrl(currentItem.imageBackPath)} alt="Latest back" className="w-full max-h-56 object-contain bg-gray-50 rounded border" />
          )}
        </div>
      )}

      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="text-xs font-semibold text-gray-500 mb-2">Scanned Items ({session.items.length})</div>
        <div className="space-y-2 max-h-56 overflow-y-auto">
          {session.items.map(item => (
            <button
              type="button"
              key={item.scanID}
              onClick={() => setCurrentItem(item)}
              className="w-full text-left p-2 rounded border border-gray-200"
            >
              <div className="text-sm font-medium">{item.isSlip ? 'Slip' : 'Cheque'} #{String(item.seqNo).padStart(3, '0')}</div>
              <div className="text-xs text-gray-500">{item.scanStatus}</div>
            </button>
          ))}
          {session.items.length === 0 && <p className="text-sm text-gray-400">No captures yet</p>}
        </div>
      </div>

      <button
        type="button"
        onClick={handleComplete}
        disabled={busy}
        className="w-full bg-blue-700 text-white py-3 rounded-lg disabled:opacity-50"
      >
        Complete Batch
      </button>

      {showStartModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-2">Start Mobile Scanning</h2>
            {startStep === 'scanType' ? (
              <div className="space-y-3">
                <button
                  onClick={() => { setSelectedScanType('Scan'); setStartStep('slipMode'); }}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-medium"
                >
                  Scan
                </button>
                <button
                  onClick={() => { setSelectedScanType('Rescan'); setStartStep('slipMode'); }}
                  className="w-full bg-indigo-700 text-white py-3 rounded-lg font-medium"
                >
                  Rescan
                </button>
                <button onClick={() => navigate('/')} className="w-full text-gray-500 text-sm py-2">Cancel</button>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={() => handleStart(true)}
                  disabled={busy}
                  className="w-full bg-blue-700 text-white py-3 rounded-lg font-medium"
                >
                  With Slip
                </button>
                <button
                  onClick={() => handleStart(false)}
                  disabled={busy}
                  className="w-full bg-gray-100 text-gray-800 py-3 rounded-lg font-medium"
                >
                  Without Slip
                </button>
                <button onClick={() => setStartStep('scanType')} className="w-full text-gray-500 text-sm py-2">Back</button>
              </div>
            )}
          </div>
        </div>
      )}

      {showSlipForm && (
        <SlipFormModal
          batchId={id}
          defaultPickupPoint={pickupPointCode}
          onClose={() => setShowSlipForm(false)}
          onSaved={(slip) => {
            setShowSlipForm(false);
            setSlipCreated(true);
            setActiveSlipId(slip.slipID);
            setScanTarget('Slip');
            loadSession();
            toast.success('Slip entry saved');
          }}
        />
      )}
    </div>
  );
}
