// =============================================================================
// File        : MobileScanPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Mobile camera scanning page — design-system matched, clean flow
// Created     : 2026-04-14
// Updated     : 2026-04-24
// =============================================================================

import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { getBatchByNumber } from '../services/batchService';
import { completeScan, getScanSession, startScan, uploadMobileCheque, uploadMobileSlipScan } from '../services/scanService';
import { toast } from '../store/toastStore';
import type { ScanSessionDto } from '../types';
import { BatchStatus } from '../types';
import { getChequeImageUrl, getSlipImageUrl } from '../utils/imageUtils';
import { SlipFormModal } from '../components/SlipFormModal';
import { CameraCapturePro } from '../components/CameraCapturePro';
import { ImageEditModalMobile } from '../components/ImageEditModalMobile';

// ── Types ─────────────────────────────────────────────────────────────────────

type Step =
  | 'slip-entry'      // fill in slip form
  | 'slip-capture'    // capture slip image(s)
  | 'slip-done'       // slip captured — choose next
  | 'cheque-front'    // capture cheque front
  | 'cheque-back'     // capture cheque back
  | 'cheque-review';  // review both, save or retake

type EditTarget = 'slip' | 'cheque-front' | 'cheque-back';

// ── Style constants ───────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: 'var(--bg-raised)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--r-lg)',
  boxShadow: 'var(--shadow-xs)',
  padding: 16,
};

const pill: React.CSSProperties = {
  padding: '2px 6px', borderRadius: 'var(--r-full)',
  fontSize: 10, fontWeight: 600,
  background: 'var(--bg)', border: '1px solid var(--border)',
  color: 'var(--fg-muted)',
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

// ── MobileScanPage ────────────────────────────────────────────────────────────

export function MobileScanPage() {
  const { batchNo } = useParams<{ batchNo: string }>();
  const navigate = useNavigate();
  const [id, setId] = useState<number>(0);

  const [session, setSession] = useState<ScanSessionDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [pickupPointCode, setPickupPointCode] = useState('');

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
  const totalSlipScans = useMemo(
    () => session?.slipGroups?.flatMap(g => g.slipScans ?? []).length ?? 0,
    [session?.slipGroups]
  );

  // ── Load session ─────────────────────────────────────────────────────────────

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

        const scanSession = await getScanSession(batchId);
        setSession(scanSession);
        setPickupPointCode(batch.pickupPointCode ?? '');

        // Resume — find latest active slip
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
            setStep(scanSession.withSlip ? 'slip-entry' : 'cheque-front');
            if (scanSession.withSlip) setShowSlipForm(true);
          } catch (e: any) {
            toast.error(e?.response?.data?.message ?? 'Failed to start scan');
          } finally {
            setBusy(false);
          }
        } else {
          // Already in progress
          setStep(scanSession.withSlip ? 'slip-done' : 'cheque-front');
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

  // ── Capture actions ──────────────────────────────────────────────────────────

  const openCamera = (mode: 'slip' | 'cheque') => {
    setCameraMode(mode);
    setShowCamera(true);
  };

  const onCameraCapture = (file: File, _position: 'front' | 'back') => {
    setShowCamera(false);
    if (step === 'slip-capture') {
      setSlipFile(file);
      setSlipPreview(URL.createObjectURL(file));
    } else if (step === 'cheque-front') {
      setFrontFile(file);
      setFrontPreview(URL.createObjectURL(file));
      // Auto-open camera for back
      setTimeout(() => {
        setStep('cheque-back');
        openCamera('cheque');
      }, 300);
    } else if (step === 'cheque-back') {
      setBackFile(file);
      setBackPreview(URL.createObjectURL(file));
      setStep('cheque-review');
    }
  };

  const saveSlipImage = async () => {
    if (!slipFile || !activeSlipId) return;
    setBusy(true);
    try {
      const group = session?.slipGroups?.find(g => g.slipEntryId === activeSlipId);
      const order = (group?.slipScans?.length ?? 0) + 1;
      await uploadMobileSlipScan(id, { slipEntryId: activeSlipId, scanOrder: order, image: slipFile });
      toast.success('Slip image saved');
      setSlipFile(null);
      setSlipPreview(null);
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

  // ── Render helpers ────────────────────────────────────────────────────────────

  if (loading) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--fg-muted)' }}>Loading scan session…</div>
  );
  if (!session) return (
    <div style={{ padding: 32, textAlign: 'center', color: 'var(--danger)' }}>Session not found</div>
  );

  const withSlip = session.withSlip ?? false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 32 }}>

      {/* ── Header card ── */}
      <div style={card}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
          <div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 600 }}>
              Mobile Scanner
            </div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--fg)', marginTop: 2 }}>
              {session.batchNo}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Chip icon="receipt" label={withSlip ? 'With Slip' : 'No Slip'} />
            <Chip icon="credit_card" label={`${allCheques.length} cheques`} />
            <Chip icon="article" label={`${totalSlipScans} slip imgs`} />
          </div>
        </div>
      </div>

      {/* ── Active slip indicator ── */}
      {withSlip && activeSlipNo && (
        <div style={{ ...card, background: 'var(--accent-50)', border: '1px solid var(--accent-200)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--accent-600)' }}>receipt</span>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--accent-600)', fontWeight: 600 }}>Active Slip</div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--fg)' }}>{activeSlipNo}</div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step panel ── */}
      <div style={card}>
        {/* Step: Slip entry */}
        {step === 'slip-entry' && (
          <StepPanel
            icon="edit_note"
            title="Fill Slip Entry"
            subtitle="Enter deposit slip details before capturing images"
            accent="var(--warning)"
          >
            <ActionBtn icon="edit_note" label="Open Slip Form" onClick={() => setShowSlipForm(true)} />
          </StepPanel>
        )}

        {/* Step: Capture slip image */}
        {step === 'slip-capture' && (
          <StepPanel icon="article" title="Capture Slip Image" subtitle={`Slip ${activeSlipNo} — open camera to scan`} accent="var(--accent-500)">
            {slipFile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <img src={slipPreview!} alt="slip" style={{ width: '100%', aspectRatio: '1/1.4', objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-subtle)' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                  <OutlineBtn icon="camera_alt" label="Retake" onClick={() => openCamera('slip')} />
                  <OutlineBtn icon="edit" label="Edit" onClick={() => setEditState({ file: slipFile, target: 'slip', title: 'Edit Slip' })} />
                  <PrimaryBtn icon="check" label={busy ? 'Saving…' : 'Save'} onClick={saveSlipImage} disabled={busy} />
                </div>
              </div>
            ) : (
              <ActionBtn icon="camera_alt" label="Open Camera" onClick={() => openCamera('slip')} />
            )}
          </StepPanel>
        )}

        {/* Step: Slip done — choose next */}
        {step === 'slip-done' && (
          <StepPanel icon="check_circle" title="Slip Image Saved" subtitle="What would you like to do next?" accent="var(--success)">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <OutlineBtn icon="add_a_photo" label="Capture Another Slip Image" onClick={() => { setSlipFile(null); setSlipPreview(null); setStep('slip-capture'); }} />
              <PrimaryBtn icon="credit_card" label="Scan Cheques for This Slip" onClick={() => setStep('cheque-front')} />
              <OutlineBtn icon="receipt_long" label="New Slip Entry" onClick={() => { setActiveSlipId(null); setActiveSlipNo(''); setShowSlipForm(true); setStep('slip-entry'); }} />
            </div>
          </StepPanel>
        )}

        {/* Step: Cheque front */}
        {step === 'cheque-front' && (
          <StepPanel icon="credit_card" title="Capture Cheque Front" subtitle="Open camera — after front captured, back will open automatically" accent="var(--accent-500)">
            {frontFile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <img src={frontPreview!} alt="front" style={{ width: '100%', aspectRatio: '85.6/54', objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-subtle)' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <OutlineBtn icon="camera_alt" label="Retake Front" onClick={() => { setFrontFile(null); setFrontPreview(null); openCamera('cheque'); }} />
                  <PrimaryBtn icon="flip" label="Capture Back →" onClick={() => { setStep('cheque-back'); openCamera('cheque'); }} />
                </div>
              </div>
            ) : (
              <ActionBtn icon="camera_alt" label="Open Camera (Front)" onClick={() => openCamera('cheque')} />
            )}
          </StepPanel>
        )}

        {/* Step: Cheque back */}
        {step === 'cheque-back' && (
          <StepPanel icon="flip" title="Capture Cheque Back" subtitle="Now capture the back/reverse side of the cheque" accent="var(--info)">
            {backFile ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <img src={backPreview!} alt="back" style={{ width: '100%', aspectRatio: '85.6/54', objectFit: 'contain', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--bg-subtle)' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <OutlineBtn icon="camera_alt" label="Retake Back" onClick={() => { setBackFile(null); setBackPreview(null); openCamera('cheque'); }} />
                  <PrimaryBtn icon="check_circle" label="Review Both" onClick={() => setStep('cheque-review')} />
                </div>
              </div>
            ) : (
              <ActionBtn icon="camera_alt" label="Open Camera (Back)" onClick={() => openCamera('cheque')} />
            )}
          </StepPanel>
        )}

        {/* Step: Review both images + MICR + save */}
        {step === 'cheque-review' && (
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
              <PrimaryBtn icon="save" label={busy ? 'Saving…' : 'Save Cheque'} onClick={saveCheque} disabled={busy || (!frontFile && !backFile)} />
              {withSlip && (
                <OutlineBtn icon="receipt_long" label="New Slip Entry" onClick={() => { setActiveSlipId(null); setActiveSlipNo(''); setShowSlipForm(true); setStep('slip-entry'); }} />
              )}
              <DangerBtn icon="task_alt" label={busy ? 'Completing…' : 'Complete Batch'} onClick={handleComplete} disabled={busy} />
            </div>
          </div>
        )}
      </div>

      {/* ── Scanned items — mobile card list ── */}
      {session.slipGroups && session.slipGroups.length > 0 && (
        <div style={card}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 12 }}>
            Scanned Items
          </div>

          {session.slipGroups.map(group => (
            <div key={group.slipEntryId} style={{ marginBottom: 12 }}>
              {/* Slip header row */}
              {withSlip && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6,
                  padding: '6px 10px', borderRadius: 'var(--r-md)',
                  background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--fg-muted)' }}>receipt</span>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--fg)', flex: 1 }}>
                    Slip {group.depositSlipNo ?? group.slipNo}
                  </span>
                  <span style={pill}>{group.slipScans?.length ?? 0} img</span>
                  <span style={pill}>{group.cheques?.length ?? 0} chq</span>
                </div>
              )}

              {/* Slip scan thumbnails */}
              {(group.slipScans ?? []).length > 0 && (
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 4, marginBottom: 6 }}>
                  {group.slipScans.map(s => (
                    <img key={s.slipScanId}
                      src={getSlipImageUrl(s)}
                      alt="slip"
                      style={{ height: 56, width: 40, objectFit: 'cover', borderRadius: 6, border: '1px solid var(--border)', flexShrink: 0 }}
                    />
                  ))}
                </div>
              )}

              {/* Cheque rows */}
              {(group.cheques ?? []).map(chq => (
                <div key={chq.chequeItemId} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '8px', borderRadius: 'var(--r-md)',
                  border: '1px solid var(--border)', background: 'var(--bg)', marginBottom: 4,
                }}>
                  {/* Thumbnail */}
                  <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                    {chq.imageBaseName && (
                      <img src={getChequeImageUrl(chq, 'front')} alt="F"
                        style={{ width: 44, height: 28, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)' }} />
                    )}
                    {chq.imageBaseName && (
                      <img src={getChequeImageUrl(chq, 'back')} alt="B"
                        style={{ width: 44, height: 28, objectFit: 'cover', borderRadius: 4, border: '1px solid var(--border)', opacity: 0.7 }} />
                    )}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--fg)' }}>
                      #{String(chq.chqSeq).padStart(3, '0')}
                      <span style={{ marginLeft: 6, color: 'var(--fg-muted)', fontWeight: 500 }}>
                        Scan: {chq.scanChqNo || chq.chqNo || '—'}
                      </span>
                      {chq.rrChqNo && chq.rrChqNo !== chq.scanChqNo && (
                        <span style={{ marginLeft: 8, color: 'var(--success)', fontWeight: 600 }}>
                          RR: {chq.rrChqNo}
                        </span>
                      )}
                    </div>
                    {(chq.scanMICR1 || chq.scanMICR2 || chq.scanMICRRaw) && (
                      <div style={{ fontSize: 10, color: 'var(--fg-muted)', fontFamily: 'var(--font-mono)', marginTop: 1 }}>
                        {chq.scanMICRRaw ? (
                          <div style={{ color: 'var(--accent)', fontSize: 9, opacity: 0.8, marginBottom: 2 }}>RAW: {chq.scanMICRRaw}</div>
                        ) : null}
                        {[chq.scanMICR1, chq.scanMICR2, chq.scanMICR3].filter(Boolean).join(' · ')}
                      </div>
                    )}
                  </div>

                  {/* Status */}
                  <StatusPill status={chq.scanStatus} />
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {/* ── Modals ── */}
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
          onClose={() => setEditState(null)}
          onSave={(file, previewUrl) => {
            if (editState.target === 'slip') { setSlipFile(file); setSlipPreview(previewUrl); }
            else if (editState.target === 'cheque-front') { setFrontFile(file); setFrontPreview(previewUrl); }
            else { setBackFile(file); setBackPreview(previewUrl); }
            setEditState(null);
            toast.success('Image updated');
          }}
        />
      )}

      {showCamera && (
        <CameraCapturePro
          mode={cameraMode}
          onCapture={onCameraCapture}
          onClose={() => setShowCamera(false)}
        />
      )}
    </div>
  );
}

// ── Small Components ──────────────────────────────────────────────────────────

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
      padding: '3px 8px', borderRadius: 'var(--r-full)',
      background: 'var(--bg-subtle)', border: '1px solid var(--border)',
      fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', fontWeight: 500,
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 12 }}>{icon}</span>
      {label}
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
