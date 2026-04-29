// =============================================================================
// File        : MobileScanPage.tsx
// Project     : CPS \u2014 Cheque Processing System
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Mobile camera scanning page — design-system matched, clean flow
// Created     : 2026-04-14
// Updated     : 2026-04-27
// =============================================================================

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getBatchByNumber } from '../services/batchService';
import { completeChequePhase, completeScan, completeSlipPhase, getScanSession, releaseScanLock, startScan, uploadMobileCheque, uploadMobileSlipItem } from '../services/scanService';
import { useAuthStore } from '../store/authStore';
import { toast } from '../store/toastStore';
import type { ScanSessionDto } from '../types';
import { BatchStatus } from '../types';
import { getChequeImageUrl, getSlipImageUrl } from '../utils/imageUtils';
import { SlipFormModal } from '../components/SlipFormModal';
import { CameraCapturePro } from '../components/CameraCapturePro';
import { ImageEditModalMobile } from '../components/ImageEditModalMobile';

// -- Types ---------------------------------------------------------------------

type Step =
  | 'slip-entry'      // fill in slip form
  | 'slip-capture'    // capture slip image(s)
  | 'slip-done'       // slip captured \u2014 choose next
  | 'cheque-front'    // capture cheque front
  | 'cheque-back'     // capture cheque back
  | 'cheque-review';  // review both, save or retake

type EditTarget = 'slip' | 'cheque-front' | 'cheque-back';

// -- Style constants -----------------------------------------------------------

const card: React.CSSProperties = {
  background: 'var(--bg-raised)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-lg)',
  boxShadow: 'var(--shadow-xs)',
  padding: 16,
};

const pill: React.CSSProperties = {
  padding: '4px 10px', borderRadius: 'var(--r-md)',
  fontSize: 11, fontWeight: 600,
  background: 'var(--bg-subtle)', border: '1px solid var(--border)',
  color: 'var(--fg)',
};

const thumbBtn: React.CSSProperties = {
  position: 'absolute', top: 4, right: 4,
  width: 24, height: 24, borderRadius: '50%',
  background: 'rgba(0,0,0,0.6)', border: 'none',
  color: '#fff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const missingThumb: React.CSSProperties = {
  width: '100%', aspectRatio: '85.6/54',
  borderRadius: 8, border: '1px dashed var(--border)',
  background: 'var(--bg-subtle)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

// â”€â”€ MobileScanPage â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

export function MobileScanPage() {
  const { batchNo } = useParams<{ batchNo: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [id, setId] = useState<number>(0);

  const [session, setSession] = useState<ScanSessionDto | null>(null);
  const [batchDetails, setBatchDetails] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pickupPointCode, setPickupPointCode] = useState('');
  const [fsImage, setFsImage] = useState<string | null>(null);

  const [step, setStep] = useState<Step>('slip-entry');
  const [activeSlipId, setActiveSlipId] = useState<number | null>(null);
  const [activeSlipNo, setActiveSlipNo] = useState('');

  // Captured files per step
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [frontFileOriginal, setFrontFileOriginal] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [frontBBox, setFrontBBox] = useState<string | null>(null);

  const [backFile, setBackFile] = useState<File | null>(null);
  const [backFileOriginal, setBackFileOriginal] = useState<File | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [backBBox, setBackBBox] = useState<string | null>(null);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // MICR
  const [micr, setMicr] = useState({ chqNo: '', micr1: '', micr2: '', micr3: '' });

  // Modals
  const [showSlipForm, setShowSlipForm] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState<'slip' | 'cheque'>('slip');
  const [editState, setEditState] = useState<{ file: File; target: EditTarget; title: string; isScan?: boolean; isSlip?: boolean } | null>(null);

  // -- Inactivity Lock Logic --
  const [lastActivity, setLastActivity] = useState(Date.now());
  const INACTIVITY_LIMIT = 5 * 60 * 1000; // 5 minutes in ms
  const WARNING_LIMIT = 4.5 * 60 * 1000; // 4.5 minutes in ms (show toast warning)
  const [hasWarned, setHasWarned] = useState(false);

  const allSlipsDone = (session?.slipGroups?.length ?? 0) === (session?.totalSlipEntries ?? 0);
  const allChequesDone = session?.slipGroups?.length ? session.slipGroups.every(g => (g.cheques?.length ?? 0) === g.totalInstruments) : false;
  const canCompleteBatch = allSlipsDone && allChequesDone && (session?.slipGroups?.length ?? 0) > 0;

  // -- Inactivity Monitoring --
  useEffect(() => {
    const updateActivity = () => {
      setLastActivity(Date.now());
      setHasWarned(false);
    };
    window.addEventListener('touchstart', updateActivity);
    window.addEventListener('mousedown', updateActivity);
    window.addEventListener('scroll', updateActivity);
    window.addEventListener('keydown', updateActivity);
    return () => {
      window.removeEventListener('touchstart', updateActivity);
      window.removeEventListener('mousedown', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      window.removeEventListener('keydown', updateActivity);
    };
  }, []);

  const handleAutoRelease = useCallback(async () => {
    if (!id) return;
    try {
      await releaseScanLock(id);
      toast.warning('Session released due to inactivity');
    } finally {
      navigate('/all-batches');
    }
  }, [id, navigate]);

  useEffect(() => {
    if (loading || !id) return;
    const timer = setInterval(() => {
      const now = Date.now();
      const elapsed = now - lastActivity;

      if (elapsed > INACTIVITY_LIMIT) {
        handleAutoRelease();
      } else if (elapsed > WARNING_LIMIT && !hasWarned) {
        setHasWarned(true);
        toast.info('Session expiring soon due to inactivity...');
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [id, loading, lastActivity, hasWarned, handleAutoRelease]);

  // -- Release lock on unmount --
  useEffect(() => {
    return () => {
      if (id) {
        releaseScanLock(id).catch(() => {});
      }
    };
  }, [id]);

  // -- Load session --------------------------------------------------------------

  useEffect(() => {
    const init = async () => {
      if (!batchNo) {
        toast.error('Batch number not found');
        setLoading(false);
        return;
      }
      try {
        const batch = await getBatchByNumber(batchNo);
        const batchId = batch.batchID;
        setId(batchId);
        setBatchDetails(batch);
        setPickupPointCode(batch.pickupPointCode ?? '');

        const scanSession = await getScanSession(batchId);
        setSession(scanSession);

        if (scanSession.resumeState?.activeSlipEntryId) {
          const rs = scanSession.resumeState;
          setActiveSlipId(rs.activeSlipEntryId ?? null);
          setActiveSlipNo(rs.activeSlipNo ?? '');
          
          if (rs.resumeStep === 'SlipScan') {
            setStep('slip-capture');
          } else if (rs.resumeStep === 'ChequeScan') {
            setStep('cheque-front');
          } else {
            setStep('slip-entry');
          }
        } else {
           setActiveSlipId(null);
           setActiveSlipNo('');
        }

        const isStartable = 
          scanSession.batchStatus === BatchStatus.Created || 
          scanSession.batchStatus === BatchStatus.ScanningPending || 
          scanSession.batchStatus === BatchStatus.ScanningInProgress;

        if (isStartable) {
           setBusy(true);
           try {
             await startScan(batchId, scanSession.withSlip ?? false, scanSession.scanType ?? 'Scan');
             
             const fresh = await getScanSession(batchId);
             setSession(fresh);
             
             if (!scanSession.resumeState?.activeSlipEntryId) {
                setStep('slip-entry');
                setShowSlipForm(true);
             }
           } catch (e: any) {
             const msg = e?.response?.data?.message ?? 'Failed to start capture';
             toast.error(msg);
           } finally {
             setBusy(false);
           }
        }
      } catch {
        toast.error('Failed to load scan session');
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [batchNo]);

  useEffect(() => () => { if (frontPreview) URL.revokeObjectURL(frontPreview); }, [frontPreview]);
  useEffect(() => () => { if (backPreview) URL.revokeObjectURL(backPreview); }, [backPreview]);

  // -- Capture actions -----------------------------------------------------------

  const openCamera = (mode: 'slip' | 'cheque') => {
    setCameraMode(mode);
    setShowCamera(true);
  };

  const onCameraCapture = (file: File, _position: 'front' | 'back', isScan: boolean) => {
    setShowCamera(false);
    const editTitle = isScan ? 'Review Scan' : 'Edit Image';
    if (step === 'slip-capture') {
      setEditState({ file, target: 'slip', title: `Review Slip ${isScan ? 'Scan' : 'Capture'}`, isScan, isSlip: true });
    } else if (step === 'cheque-front') {
      setEditState({ file, target: 'cheque-front', title: `Review Front ${isScan ? 'Scan' : 'Capture'}`, isScan, isSlip: false });
    } else if (step === 'cheque-back') {
      setEditState({ file, target: 'cheque-back', title: `Review Back ${isScan ? 'Scan' : 'Capture'}`, isScan, isSlip: false });
    }
  };

  const uploadSlipFile = async (file: File, original?: File | null, bbox?: string | null) => {
    setBusy(true);
    try {
      const group = session?.slipGroups?.find(g => g.slipEntryId === activeSlipId);
      const order = (group?.slipItems?.length ?? 0) + 1;
      await uploadMobileSlipItem(id, { 
        slipEntryId: activeSlipId!, 
        scanOrder: order, 
        image: file,
        imageOriginal: original ?? undefined,
        bbox: bbox ?? undefined
      });
      toast.success('Slip image saved');
      if (id > 0) {
        const fresh = await getScanSession(id);
        setSession(fresh);
      }
      setStep('slip-done');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const saveCheque = async () => {
    if (!frontFile && !backFile) return;
    setBusy(true);
    try {
      const slipEntryId = activeSlipId ?? session?.slipGroups?.[0]?.slipEntryId ?? 0;
      const group = session?.slipGroups?.find(g => g.slipEntryId === slipEntryId);
      const seq = (group?.cheques?.length ?? 0) + 1;
      await uploadMobileCheque(id, {
        slipEntryId,
        chqSeq: seq,
        imageFront: frontFile ?? undefined,
        imageBack: backFile ?? undefined,
        imageFrontOriginal: frontFileOriginal ?? undefined,
        imageBackOriginal: backFileOriginal ?? undefined,
        bboxFront: frontBBox ?? undefined,
        bboxBack: backBBox ?? undefined,
        chqNo: micr.chqNo || undefined,
        scanMICR1: micr.micr1 || undefined,
        scanMICR2: micr.micr2 || undefined,
        scanMICR3: micr.micr3 || undefined,
      });
      toast.success(`Cheque #${seq} saved`);
      setFrontFile(null); setFrontPreview(null); setFrontFileOriginal(null); setFrontBBox(null);
      setBackFile(null); setBackPreview(null); setBackFileOriginal(null); setBackBBox(null);
      setMicr({ chqNo: '', micr1: '', micr2: '', micr3: '' });
      if (id > 0) {
        const fresh = await getScanSession(id);
        setSession(fresh);
      }
      setStep('cheque-front');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    setBusy(true);
    try {
      await completeScan(id);
      toast.success('Scanning completed');
      navigate('/all-batches');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to complete');
    } finally {
      setBusy(false);
    }
  };

  // -- Render helpers ------------------------------------------------------------

  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-muted)' }}>Loading capture session...</div>
  );
  if (!session) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--danger)' }}>Session not found</div>
  );

  const withSlip = session.withSlip ?? false;
  
  const isLockedByOther = session.scanLockedBy && session.scanLockedBy !== user?.userId;

  if (isLockedByOther) {
    return (
      <div style={{ padding: 40, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80vh', gap: 24 }}>
        <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-subtle)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span className="material-symbols-outlined" style={{ fontSize: 32, color: 'var(--danger)' }}>lock</span>
        </div>
        <div>
          <h2 style={{ margin: '0 0 8px', fontSize: 20, fontWeight: 700 }}>Batch Locked</h2>
          <p style={{ color: 'var(--fg-muted)', maxWidth: 280, fontSize: 13, lineHeight: 1.5 }}>
            This batch is currently being scanned by another user (User ID: {session.scanLockedBy}).
          </p>
        </div>
        <button onClick={() => navigate('/all-batches')} className="btn-primary" style={{ width: 'auto', padding: '10px 20px' }}>Back to Batches</button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 32 }}>

      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>
              Batch Context
            </div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--fg)', marginTop: 2 }}>
              {session.batchNo}
            </div>
            {batchDetails && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', marginTop: 2 }}>
                Ref: {batchDetails.summRefNo} {"\u00b7"} Cluster: {batchDetails.clusterCode || "\u2014"}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <Chip icon="receipt_long" label={`Slips: ${session.slipGroups?.length ?? 0} / ${batchDetails?.totalSlips ?? session.totalSlipEntries ?? 0}`} />
            {batchDetails?.totalAmount > 0 && (
              <Chip icon="payments" label={`\u20b9${(batchDetails?.totalAmount || 0).toLocaleString('en-IN')}`} />
            )}
          </div>
        </div>
      </div>

      {withSlip && activeSlipNo && (
        <div style={{ ...card, background: 'var(--bg-raised)', border: '1px solid var(--border-strong)', padding: 12 }}>
          {(() => {
            const activeGroup = session?.slipGroups?.find(g => g.slipEntryId === activeSlipId);
            if (!activeGroup) return null;
            return (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 'var(--r-md)', background: 'var(--accent-100)', color: 'var(--accent-600)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>receipt_long</span>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--fg)' }}>Slip {activeGroup.depositSlipNo || activeGroup.slipNo}</div>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--accent-600)' }}>{"\u20b9"}{(activeGroup.slipAmount || 0).toLocaleString('en-IN')}</div>
                  </div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div>Client: {activeGroup.clientName} ({activeGroup.clientCode || "\u2014"})</div>
                    <div>Pickup: {activeGroup.pickupPoint || "\u2014"}</div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                      <span>Cheques: {activeGroup.cheques?.length || 0} / {activeGroup.totalInstruments}</span>
                      <span>Slip Imgs: {activeGroup.slipItems?.length || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      <div style={{ ...card, padding: 16 }}>
        {frontFile || backFile ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--success)' }}>check_circle</span>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--fg)' }}>Review Cheque Images</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>Edit or retake if needed, then save</div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 4 }}>FRONT</div>
                  {frontFile ? (
                    <div style={{ position: 'relative' }}>
                      <img src={frontPreview!} alt="front" style={{ width: '100%', aspectRatio: '85.6/54', objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)' }} />
                      <button onClick={() => frontFile && setEditState({ file: frontFile, target: 'cheque-front', title: 'Edit Cheque Front' })} style={thumbBtn}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                      </button>
                    </div>
                  ) : (
                    <div style={missingThumb}>
                      <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--fg-faint)' }}>image_not_supported</span>
                    </div>
                  )}
                  <OutlineBtn icon="camera_alt" label="Retake" onClick={() => { setFrontFile(null); setFrontPreview(null); setStep('cheque-front'); openCamera('cheque'); }} style={{ marginTop: 6, fontSize: 12 }} />
                </div>
                <div>
                  <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 4 }}>BACK</div>
                  {backFile ? (
                    <div style={{ position: 'relative' }}>
                      <img src={backPreview!} alt="back" style={{ width: '100%', aspectRatio: '85.6/54', objectFit: 'contain', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-subtle)' }} />
                      <button onClick={() => backFile && setEditState({ file: backFile, target: 'cheque-back', title: 'Edit Cheque Back' })} style={thumbBtn}>
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                      </button>
                    </div>
                  ) : (
                    <div style={missingThumb}>
                      <span className="material-symbols-outlined" style={{ fontSize: 24, color: 'var(--fg-faint)' }}>image_not_supported</span>
                    </div>
                  )}
                  <OutlineBtn icon="camera_alt" label="Retake" onClick={() => { setBackFile(null); setBackPreview(null); setStep('cheque-back'); openCamera('cheque'); }} style={{ marginTop: 6, fontSize: 12 }} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                <PrimaryBtn icon="save" label={busy ? 'Saving...' : 'Save Cheque'} onClick={saveCheque} disabled={busy || (!frontFile && !backFile)} />
                <OutlineBtn icon="delete" label="Discard & Retake" onClick={() => {
                  setFrontFile(null); setFrontPreview(null); setBackFile(null); setBackPreview(null); setStep('cheque-front'); openCamera('cheque');
                }} />
              </div>
            </div>
        ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <>
                {!activeSlipId && !allSlipsDone && (
                   <PrimaryBtn icon="add_circle" label="New Slip Entry" onClick={() => setShowSlipForm(true)} />
                )}
                {activeSlipId && (
                   <>
                     {(() => {
                       const activeGroup = session?.slipGroups?.find(g => g.slipEntryId === activeSlipId);
                       const slipItemsCount = activeGroup?.slipItems?.length || 0;
                       const expectedChqs = activeGroup?.totalInstruments || 0;
                       const capturedChqs = activeGroup?.cheques?.length || 0;
                       return (
                         <>
                           {withSlip && step.startsWith('slip') && (
                             <>
                               <PrimaryBtn icon="camera_alt" label={`Capture Slip Image (${slipItemsCount + 1})`} onClick={() => { setStep('slip-capture'); openCamera('slip'); }} />
                               {slipItemsCount > 0 && (
                                 <OutlineBtn icon="check_circle" label="Complete Slip Capture" onClick={async () => {
                                   if (!activeSlipId) return;
                                   setBusy(true);
                                   try {
                                     await completeSlipPhase(id, activeSlipId);
                                     const fresh = await getScanSession(id);
                                     setSession(fresh);
                                     setStep('cheque-front');
                                     toast.success('Slip capture completed');
                                   } catch (e: any) {
                                     toast.error(e?.response?.data?.message ?? 'Failed to complete slip phase');
                                   } finally {
                                     setBusy(false);
                                   }
                                 }} />
                               )}
                             </>
                           )}
                           {step.startsWith('cheque') && (
                             <>
                               <PrimaryBtn icon="credit_card" label={`Capture Cheques (${capturedChqs} / ${expectedChqs})`} onClick={() => { setStep('cheque-front'); setFrontFile(null); setFrontPreview(null); setBackFile(null); setBackPreview(null); openCamera('cheque'); }} disabled={capturedChqs >= expectedChqs} />
                               <OutlineBtn icon="done_all" label="Complete Cheque Capture" onClick={async () => {
                                 if (!activeSlipId) return;
                                 if (capturedChqs !== expectedChqs) {
                                   toast.error(`Cannot complete: Scanned ${capturedChqs} of ${expectedChqs} expected cheques. Please scan all instruments.`);
                                   return;
                                 }
                                 setBusy(true);
                                 try {
                                   await completeChequePhase(id, activeSlipId);
                                   const fresh = await getScanSession(id);
                                   setSession(fresh);
                                   setActiveSlipId(null);
                                   setStep('slip-entry');
                                   toast.success('Cheque capture completed');
                                 } catch (e: any) {
                                   toast.error(e?.response?.data?.message ?? 'Failed to complete cheque phase');
                                 } finally {
                                   setBusy(false);
                                 }
                               }} />
                             </>
                           )}
                         </>
                       );
                     })()}
                   </>
                )}
                {!activeSlipId && (
                  <>
                    <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                    <DangerBtn 
                      icon="task_alt" 
                      label={busy ? 'Completing...' : 'Complete Batch'} 
                      onClick={handleComplete} 
                      disabled={busy || !canCompleteBatch} 
                    />
                  </>
                )}
              </>
            </div>
        )}
      </div>

      {session.slipGroups && session.slipGroups.length > 0 && (
        <div style={{ marginTop: 'auto', paddingTop: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', marginBottom: 8 }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.04em' }}>
              Recent Sequences
            </span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', fontVariantNumeric: 'tabular-nums' }}>
              {session.slipGroups.length} of {Math.max(session.slipGroups.length, session.totalSlipEntries || 0)}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '0 16px 16px 16px' }}>
            {session.slipGroups.map((group, idx) => {
              const isActive = activeSlipId === group.slipEntryId;
              const isExpanded = !!expandedGroups[String(group.slipEntryId)];
              const slipsExpanded = expandedGroups[`${group.slipEntryId}-slips`] === true;
              const chequesExpanded = expandedGroups[`${group.slipEntryId}-cheques`] === true;
              const slipCount = group.slipItems?.length ?? 0;
              const chequeCount = group.cheques?.length ?? 0;

              return (
                <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div
                    onClick={() => {
                      setActiveSlipId(group.slipEntryId);
                      setExpandedGroups(prev => ({ ...prev, [String(group.slipEntryId)]: !prev[String(group.slipEntryId)] }));
                    }}
                    style={{
                      padding: '8px 12px',
                      background: isActive ? 'var(--bg-subtle)' : 'var(--bg-raised)',
                      border: `1px solid ${isActive ? 'var(--accent-500)' : 'var(--border)'}`,
                      borderRadius: 'var(--r-md)', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', gap: 8,
                      transition: 'border-color 0.15s ease, background 0.15s ease',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16, color: isActive ? 'var(--accent-500)' : 'var(--fg-faint)', flexShrink: 0 }}>person</span>

                    <span style={{ flex: '1 1 0', minWidth: 0, fontSize: 12, fontWeight: 700, color: 'var(--fg)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {group.clientName || 'N/A'}
                    </span>

                    <span style={{ width: 1, height: 16, background: 'var(--border-strong)', flexShrink: 0, borderRadius: 1 }} />

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, fontSize: 10, color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--fg-subtle)', fontWeight: 500 }}>
                        {group.depositSlipNo || group.slipNo || "\u2014"}
                      </span>
                      {withSlip && slipCount > 0 && (
                        <>
                          <span style={{ color: 'var(--border-strong)' }}>{"\u00b7"}</span>
                          <span>{slipCount} img</span>
                        </>
                      )}
                      <span style={{ color: 'var(--border-strong)' }}>{"\u00b7"}</span>
                      <span>{chequeCount} chq</span>
                    </div>

                    <span className="material-symbols-outlined" style={{ fontSize: 16, flexShrink: 0, color: 'var(--fg-muted)' }}>
                      {isExpanded ? 'expand_less' : 'expand_more'}
                    </span>
                  </div>

                  {isExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 12, borderLeft: '2px solid var(--border-subtle)', marginLeft: 8, marginBottom: 8, marginTop: 2 }}>
                      
                      {withSlip && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div
                            onClick={() => setExpandedGroups(prev => ({ ...prev, [`${group.slipEntryId}-slips`]: !prev[`${group.slipEntryId}-slips`] }))}
                            style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-subtle)', padding: '6px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--fg-subtle)' }}>description</span>
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg)', flex: 1 }}>Slip Images</span>
                            <span style={{ fontSize: 10, padding: '2px 8px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', color: 'var(--fg-muted)' }}>{slipCount}</span>
                            <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--fg-muted)' }}>{slipsExpanded ? 'expand_more' : 'chevron_right'}</span>
                          </div>

                          {slipsExpanded && (
                            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '4px 0 8px 0', scrollbarWidth: 'none' }}>
                              {slipCount > 0 ? group.slipItems!.map((s) => (
                                <img key={`s-${s.slipItemId}`} onClick={() => setFsImage(getSlipImageUrl(s))} src={getSlipImageUrl(s)} alt="slip" style={{ width: 48, height: 68, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }} />
                              )) : <span style={{ fontSize: 11, color: 'var(--fg-faint)', paddingLeft: 4 }}>No slip images</span>}
                            </div>
                          )}
                        </div>
                      )}

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div
                          onClick={() => setExpandedGroups(prev => ({ ...prev, [`${group.slipEntryId}-cheques`]: !prev[`${group.slipEntryId}-cheques`] }))}
                          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg-subtle)', padding: '6px 10px', borderRadius: 'var(--r-sm)', cursor: 'pointer' }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--fg-subtle)' }}>payments</span>
                          <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--fg)', flex: 1 }}>Cheque Images</span>
                          <span style={{ fontSize: 10, padding: '2px 8px', background: 'var(--bg)', borderRadius: 10, border: '1px solid var(--border)', color: 'var(--fg-muted)' }}>{chequeCount}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--fg-muted)' }}>{chequesExpanded ? 'expand_more' : 'chevron_right'}</span>
                        </div>

                        {chequesExpanded && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 4 }}>
                            {chequeCount > 0 ? group.cheques!.map((c, cIdx) => (
                              <div key={`c-${c.chequeItemId}`} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--bg)', padding: '8px', borderRadius: 'var(--r-sm)', border: '1px solid var(--border)' }}>
                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                  <img onClick={() => setFsImage(getChequeImageUrl(c, 'front'))} src={getChequeImageUrl(c, 'front')} alt="F" style={{ width: 44, height: 28, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }} />
                                  <img onClick={() => setFsImage(getChequeImageUrl(c, 'back'))} src={getChequeImageUrl(c, 'back')} alt="B" style={{ width: 44, height: 28, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)', opacity: 0.8 }} />
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg)' }}>#{String(c.chqSeq ?? cIdx + 1).padStart(3, '0')}</div>
                                  <div style={{ fontSize: 9, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', marginTop: 2 }}>
                                    {[c.scanMICR1, c.scanMICR2, c.scanMICR3].filter(Boolean).join(' \u00b7 ') || 'No MICR'}
                                  </div>
                                </div>
                              </div>
                            )) : <span style={{ fontSize: 11, color: 'var(--fg-faint)', paddingLeft: 4 }}>No cheques captured</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {fsImage && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: '#000', display: 'flex', flexDirection: 'column' }}>
           <div style={{ padding: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ color: '#fff', fontSize: 'var(--text-sm)', fontWeight: 600 }}>Image Viewer</div>
              <button onClick={() => setFsImage(null)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', color: '#fff', width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                 <span className="material-symbols-outlined">close</span>
              </button>
           </div>
           <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, overflow: 'auto' }}>
              <img src={fsImage} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} alt="Fullscreen view" />
           </div>
        </div>
      )}

      {showSlipForm && (
        <SlipFormModal
          batchId={id}
          defaultPickupPoint={pickupPointCode}
          onClose={() => setShowSlipForm(false)}
          onSaved={slip => {
            setShowSlipForm(false);
            setActiveSlipId(slip.slipEntryId);
            setActiveSlipNo(slip.depositSlipNo ?? slip.slipNo ?? '');
            if (id > 0) {
              getScanSession(id).then(fresh => setSession(fresh)).catch(() => {});
            }
            toast.success('Slip entry saved');
            setStep('slip-capture');
          }}
        />
      )}

      {editState && (
        <ImageEditModalMobile
          file={editState.file}
          title={editState.title}
          initialCropFull={editState.isScan}
          isSlip={editState.isSlip}
          onClose={() => setEditState(null)}
          onSave={(file, previewUrl, originalFile, corners) => {
            const bbox = corners ? JSON.stringify(corners) : null;
            if (editState.target === 'slip') {
              setEditState(null);
              uploadSlipFile(file, originalFile, bbox);
            } else if (editState.target === 'cheque-front') {
              setFrontFile(file);
              setFrontPreview(previewUrl);
              if (originalFile) setFrontFileOriginal(originalFile);
              if (bbox) setFrontBBox(bbox);
              setEditState(null);
              // Auto-open camera for back after front is edited & saved
              setTimeout(() => {
                setStep('cheque-back');
                openCamera('cheque');
              }, 300);
            } else {
              setBackFile(file);
              setBackPreview(previewUrl);
              if (originalFile) setBackFileOriginal(originalFile);
              if (bbox) setBackBBox(bbox);
              setEditState(null);
              setStep('cheque-review');
            }
          }}
        />
      )}

      {showCamera && (
        <CameraCapturePro
          mode={cameraMode}
          side={step === 'cheque-back' ? 'back' : 'front'}
          onCapture={onCameraCapture}
          onClose={() => {
            setShowCamera(false);
            if (step === 'cheque-back') {
               setStep('cheque-review');
            }
          }}
        />
      )}
    </div>
  );
}

// -- Small Components ----------------------------------------------------------

function StepPanel({ icon, title, subtitle, accent, children }: {
  icon: string; title: string; subtitle: string; accent: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 'var(--r-md)', background: accent, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 20, color: '#fff' }}>{icon}</span>
        </div>
        <div>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--fg)' }}>{title}</div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>{subtitle}</div>
        </div>
      </div>
      {children}
    </div>
  );
}

function ActionBtn({ icon, label, onClick }: { icon: string; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '14px', borderRadius: 'var(--r-lg)',
      background: 'var(--accent-500)', color: 'var(--fg-on-accent)',
      border: 'none', fontSize: 'var(--text-sm)', fontWeight: 600,
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      fontFamily: 'inherit',
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{icon}</span>
      {label}
    </button>
  );
}

function PrimaryBtn({ icon, label, onClick, disabled }: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: '11px', borderRadius: 'var(--r-md)',
      background: disabled ? 'var(--bg-subtle)' : 'var(--accent-500)',
      color: disabled ? 'var(--fg-muted)' : 'var(--fg-on-accent)',
      border: '1px solid transparent', fontSize: 'var(--text-sm)', fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      fontFamily: 'inherit',
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
      {label}
    </button>
  );
}

function OutlineBtn({ icon, label, onClick, style: extraStyle }: { icon: string; label: string; onClick: () => void; style?: React.CSSProperties }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', padding: '11px', borderRadius: 'var(--r-md)',
      background: 'var(--bg)', color: 'var(--fg)',
      border: '1px solid var(--border-strong)', fontSize: 'var(--text-sm)', fontWeight: 500,
      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      fontFamily: 'inherit', ...extraStyle,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
      {label}
    </button>
  );
}

function DangerBtn({ icon, label, onClick, disabled }: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      width: '100%', padding: '11px', borderRadius: 'var(--r-md)',
      background: 'var(--bg)', color: 'var(--danger)',
      border: '1px solid var(--danger)', fontSize: 'var(--text-sm)', fontWeight: 600,
      cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
      fontFamily: 'inherit',
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{icon}</span>
      {label}
    </button>
  );
}

function Chip({ icon, label }: { icon: string; label: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '4px 10px', borderRadius: 'var(--r-md)',
      background: 'var(--bg-raised)', border: '1px solid var(--border-strong)',
      fontSize: 11, color: 'var(--fg)', fontWeight: 600,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--accent-500)' }}>{icon}</span>
      <span style={{ paddingTop: 1 }}>{label}</span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, { bg: string; color: string }> = {
    Captured:      { bg: 'var(--success-bg)', color: 'var(--success)' },
    Failed:        { bg: 'var(--danger-bg)',  color: 'var(--danger)'  },
    RetryPending:  { bg: 'var(--warning-bg)', color: 'var(--warning)' },
    Pending:       { bg: 'var(--bg-subtle)',  color: 'var(--fg-muted)'},
  };
  const s = map[status] ?? map['Pending'];
  return (
    <span style={{
      padding: '2px 7px', borderRadius: 'var(--r-full)',
      fontSize: 10, fontWeight: 600,
      background: s.bg, color: s.color, whiteSpace: 'nowrap',
    }}>{status}</span>
  );
}
