// =============================================================================
// File        : MobileScanPage.tsx
// Project     : CPS â€” Cheque Processing System
// Module      : Scanning
// Description : Mobile camera scanning page â€” design-system matched, clean flow
// Created     : 2026-04-14
// Updated     : 2026-04-24
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getBatchByNumber } from '../services/batchService';
import { completeScan, getScanSession, startScan, uploadMobileCheque, uploadMobileSlipItem } from '../services/scanService';
import { toast } from '../store/toastStore';
import type { ScanSessionDto } from '../types';
import { BatchStatus } from '../types';
import { getChequeImageUrl, getSlipImageUrl } from '../utils/imageUtils';
import { SlipFormModal } from '../components/SlipFormModal';
import { CameraCapturePro } from '../components/CameraCapturePro';
import { ImageEditModalMobile } from '../components/ImageEditModalMobile';

// â”€â”€ Types â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

type Step =
  | 'slip-entry'      // fill in slip form
  | 'slip-capture'    // capture slip image(s)
  | 'slip-done'       // slip captured â€” choose next
  | 'cheque-front'    // capture cheque front
  | 'cheque-back'     // capture cheque back
  | 'cheque-review';  // review both, save or retake

type EditTarget = 'slip' | 'cheque-front' | 'cheque-back';

// â”€â”€ Style constants â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreview, setSlipPreview] = useState<string | null>(null);
  const [frontFile, setFrontFile] = useState<File | null>(null);
  const [frontPreview, setFrontPreview] = useState<string | null>(null);
  const [backFile, setBackFile] = useState<File | null>(null);
  const [backPreview, setBackPreview] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // MICR
  const [micr, setMicr] = useState({ chqNo: '', micr1: '', micr2: '', micr3: '' });

  // Modals
  const [showSlipForm, setShowSlipForm] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [cameraMode, setCameraMode] = useState<'slip' | 'cheque'>('slip');
  const [editState, setEditState] = useState<{ file: File; target: EditTarget; title: string } | null>(null);

  const allCheques = useMemo(
    () => session?.slipGroups?.flatMap(g => g.cheques ?? []) ?? [],
    [session?.slipGroups]
  );
  const totalSlipItems = useMemo(
    () => session?.slipGroups?.flatMap(g => g.slipItems ?? []).length ?? 0,
    [session?.slipGroups]
  );

  const allSlipsDone = (session?.slipGroups?.length ?? 0) >= (batchDetails?.totalSlips ?? session?.totalSlipEntries ?? 0);
  const allChequesDone = session?.slipGroups?.length ? session.slipGroups.every(g => (g.cheques?.length ?? 0) >= g.totalInstruments) : false;
  const canCompleteBatch = allSlipsDone && allChequesDone;

  // â”€â”€ Load session â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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

        // Resume â€” find latest active slip
        if (scanSession.slipGroups?.length) {
          const latest = scanSession.slipGroups[scanSession.slipGroups.length - 1];
          setActiveSlipId(latest.slipEntryId);
          setActiveSlipNo(latest.depositSlipNo ?? latest.slipNo ?? '');
        }

        // Auto-start if not started yet
        if (scanSession.batchStatus === BatchStatus.Created || scanSession.batchStatus === BatchStatus.ScanningPending) {
          setBusy(true);
          try {
            await startScan(batchId, scanSession.withSlip ?? false, scanSession.scanType ?? 'Scan');
            setStep('slip-entry');
            setShowSlipForm(true);
          } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Failed to start capture');
          } finally {
            setBusy(false);
          }
        } else {
          // Already in progress — Resume intelligently
          if (scanSession.withSlip) {
            const latest = scanSession.slipGroups?.[scanSession.slipGroups.length - 1];
            const hasSlips = (latest?.slipItems?.length ?? 0) > 0;
            const needsCheques = (latest?.cheques?.length ?? 0) < (latest?.totalInstruments ?? 0);

            if (hasSlips && needsCheques) {
              setStep('cheque-front');
            } else {
              setStep('slip-done');
            }
          } else {
            setStep('cheque-front');
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

  useEffect(() => () => { if (slipPreview) URL.revokeObjectURL(slipPreview); }, [slipPreview]);
  useEffect(() => () => { if (frontPreview) URL.revokeObjectURL(frontPreview); }, [frontPreview]);
  useEffect(() => () => { if (backPreview) URL.revokeObjectURL(backPreview); }, [backPreview]);

  // â”€â”€ Capture actions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const openCamera = (mode: 'slip' | 'cheque') => {
    setCameraMode(mode);
    setShowCamera(true);
  };

  const onCameraCapture = (file: File, _position: 'front' | 'back') => {
    setShowCamera(false);
    if (step === 'slip-capture') {
      // Open edit modal immediately â€” user edits then saves
      setEditState({ file, target: 'slip', title: 'Edit Slip Image' });
    } else if (step === 'cheque-front') {
      // Open edit modal for front; after save, auto-open camera for back
      setEditState({ file, target: 'cheque-front', title: 'Edit Cheque Front' });
    } else if (step === 'cheque-back') {
      // Open edit modal for back; after save, move to review
      setEditState({ file, target: 'cheque-back', title: 'Edit Cheque Back' });
    }
  };

  const uploadSlipFile = async (file: File) => {
    if (!activeSlipId) return;
    setBusy(true);
    try {
      const group = session?.slipGroups?.find(g => g.slipEntryId === activeSlipId);
      const order = (group?.slipItems?.length ?? 0) + 1;
      await uploadMobileSlipItem(id, { slipEntryId: activeSlipId, scanOrder: order, image: file });
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
        chqNo: micr.chqNo || undefined,
        scanMICR1: micr.micr1 || undefined,
        scanMICR2: micr.micr2 || undefined,
        scanMICR3: micr.micr3 || undefined,
      });
      toast.success(`Cheque #${seq} saved`);
      setFrontFile(null); setFrontPreview(null);
      setBackFile(null); setBackPreview(null);
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
      navigate('/');
    } catch (e: any) {
      toast.error(e?.response?.data?.message ?? 'Failed to complete');
    } finally {
      setBusy(false);
    }
  };

  // â”€â”€ Render helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-muted)' }}>Loading capture sessionâ€¦</div>
  );
  if (!session) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--danger)' }}>Session not found</div>
  );

  const withSlip = session.withSlip ?? false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 32 }}>

      {/* â”€â”€ Header card â”€â”€ */}
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

      {/* â”€â”€ Active slip indicator â”€â”€ */}
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
                      <span>Cheques: {activeGroup.cheques?.length || 0} / {activeGroup.totalInstruments} expected</span>
                      <span>Slip Imgs: {activeGroup.slipItems?.length || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* â”€â”€ Control Actions â”€â”€ */}
      <div style={{ ...card, padding: 16 }}>
        {frontFile || backFile ? (
            /* Reviewing Cheques */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 20, color: 'var(--success)' }}>check_circle</span>
                <div>
                  <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--fg)' }}>Review Cheque Images</div>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>Edit or retake if needed, then save</div>
                </div>
              </div>

              {/* Thumbnails */}
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

              {/* MICR */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { key: 'chqNo', label: 'Cheque No', max: 6 },
                  { key: 'micr1', label: 'MICR 1', max: 9 },
                  { key: 'micr2', label: 'MICR 2', max: 6 },
                  { key: 'micr3', label: 'MICR 3', max: 3 },
                ].map(f => (
                  <div key={f.key}>
                    <label style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-muted)', display: 'block', marginBottom: 4 }}>{f.label}</label>
                    <input
                      value={micr[f.key as keyof typeof micr]}
                      onChange={e => setMicr(m => ({ ...m, [f.key]: e.target.value }))}
                      maxLength={f.max}
                      style={{
                        width: '100%', boxSizing: 'border-box', padding: '8px 10px',
                        background: 'var(--bg-input)', border: '1px solid var(--border-strong)',
                        borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)',
                        fontFamily: 'var(--font-mono)', color: 'var(--fg)', outline: 'none',
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Save / next actions */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
                <PrimaryBtn icon="save" label={busy ? 'Savingâ€¦' : 'Save Cheque'} onClick={saveCheque} disabled={busy || (!frontFile && !backFile)} />
                <OutlineBtn icon="delete" label="Discard & Retake" onClick={() => {
                  setFrontFile(null); setFrontPreview(null); setBackFile(null); setBackPreview(null); setStep('cheque-front'); openCamera('cheque');
                }} />
              </div>
            </div>
        ) : (
            /* Unified Action Buttons */
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <>
                {!activeSlipId ? (
                   <PrimaryBtn icon="add_circle" label="New Slip Entry" onClick={() => setShowSlipForm(true)} />
                ) : (
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
                                 <OutlineBtn icon="check_circle" label="Complete Slip Capture" onClick={() => setStep('cheque-front')} />
                               )}
                             </>
                           )}
                           {step.startsWith('cheque') && (
                             <>
                               <PrimaryBtn icon="credit_card" label={`Capture Cheques (${capturedChqs} / ${expectedChqs} expected)`} onClick={() => { setStep('cheque-front'); setFrontFile(null); setFrontPreview(null); setBackFile(null); setBackPreview(null); openCamera('cheque'); }} />
                               <OutlineBtn icon="done_all" label="Complete Cheque Capture" onClick={() => { setActiveSlipId(null); setStep('slip-entry'); }} />
                             </>
                           )}
                         </>
                       );
                     })()}
                   </>
                )}
                {!activeSlipId && canCompleteBatch && (
                  <>
                    <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />
                    <DangerBtn icon="task_alt" label={busy ? 'Completing...' : 'Complete Batch'} onClick={handleComplete} disabled={busy} />
                  </>
                )}
              </>
            </div>
        )}
      </div>

      {/* â”€â”€ Scanned items â€” mobile vertical accordion â”€â”€ */}
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
                  {/* Group header */}
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

                  {/* Expanded content */}
                  {isExpanded && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 12, borderLeft: '2px solid var(--border-subtle)', marginLeft: 8, marginBottom: 8, marginTop: 2 }}>
                      
                      {/* Slip images */}
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

                      {/* Cheque images */}
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

      {/* â”€â”€ Fullscreen Image Viewer â”€â”€ */}
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

      {/* â”€â”€ Modals â”€â”€ */}
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
          onClose={() => {
            // If user cancels edit, discard the capture and go back to controls
            if (editState.target === 'slip') { setSlipFile(null); setSlipPreview(null); }
            else if (editState.target === 'cheque-front') { setFrontFile(null); setFrontPreview(null); }
            else { setBackFile(null); setBackPreview(null); }
            setEditState(null);
          }}
          onSave={(file, previewUrl) => {
            if (editState.target === 'slip') {
              setEditState(null);
              uploadSlipFile(file);
            } else if (editState.target === 'cheque-front') {
              setFrontFile(file);
              setFrontPreview(previewUrl);
              setEditState(null);
              // Auto-open camera for back after front is edited & saved
              setTimeout(() => {
                setStep('cheque-back');
                openCamera('cheque');
              }, 300);
            } else {
              setBackFile(file);
              setBackPreview(previewUrl);
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

// â”€â”€ Small Components â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
