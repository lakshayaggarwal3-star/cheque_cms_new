import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRRItems, saveRRCorrection, completeRR } from '../services/rrService';
import { getBatchByNumber } from '../services/batchService';
import { getScanSession } from '../services/scanService';
import { toast } from '../store/toastStore';
import { getChequeImageUrl } from '../utils/imageUtils';
import { RRItemDto, RRState, BatchDto, ScanSessionDto } from '../types';
import { Icon, Pill } from '../components/scan';
import { ScanFullscreenOverlay } from './scan';
import { RRViewport } from './rr/RRViewport';

export function RRPage() {
  const { batchNo } = useParams<{ batchNo: string }>();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<BatchDto | null>(null);
  const [session, setSession] = useState<ScanSessionDto | null>(null);
  const [items, setItems] = useState<RRItemDto[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [micr, setMicr] = useState({ chqNo: '', micr1: '', micr2: '', micr3: '' });
  const [micrLayout, setMicrLayout] = useState<'bottom' | 'side'>('bottom');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isZoomed, setIsZoomed] = useState(false);
  const [flipped, setFlipped] = useState(false);
  const [imageType, setImageType] = useState<'bitonal' | 'gray'>('bitonal');
  const [fsZoom, setFsZoom] = useState(1);
  const [fsOffset, setFsOffset] = useState({ x: 0, y: 0 });
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (items.length > 0) {
      const activeEl = document.getElementById(`rr-item-${current}`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [current, items.length]);

  useEffect(() => {
    async function load() {
      if (!batchNo) {
        setLoadError('Invalid RR batch number.');
        setLoading(false);
        return;
      }
      try {
        const b = await getBatchByNumber(batchNo);
        setBatch(b);
        const data = await getRRItems(b.batchID);
        setItems(data);
        
        // Also load session to get slip details (client name, deposit slip no)
        try {
          const sess = await getScanSession(b.batchID);
          setSession(sess);
        } catch (sessErr) {
          console.warn('Could not load scan session for RR details', sessErr);
        }

        if (data.length > 0) {
          const firstPendingIndex = data.findIndex(d => d.rrState === RRState.NeedsReview);
          const targetIndex = firstPendingIndex >= 0 ? firstPendingIndex : 0;
          const first = data[targetIndex];
          setCurrent(targetIndex);
          setMicr({
            chqNo: first.chqNo ?? '',
            micr1: first.rrmicr1 ?? first.scanMICR1 ?? '',
            micr2: first.rrmicr2 ?? first.scanMICR2 ?? '',
            micr3: first.rrmicr3 ?? first.scanMICR3 ?? '',
          });
        }
      } catch (err: any) {
        setLoadError(err?.response?.data?.message ?? 'Unable to load RR items.');
        toast.error('Failed to load RR data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [batchNo]);

  // -- Inactivity Lock Logic --
  const [lastActivity, setLastActivity] = useState(Date.now());
  const INACTIVITY_LIMIT = 5 * 60 * 1000;
  const WARNING_LIMIT = 4.5 * 60 * 1000;
  const [hasWarned, setHasWarned] = useState(false);

  useEffect(() => {
    const updateActivity = () => { setLastActivity(Date.now()); setHasWarned(false); };
    window.addEventListener('mousedown', updateActivity);
    window.addEventListener('scroll', updateActivity);
    window.addEventListener('keydown', updateActivity);
    return () => {
      window.removeEventListener('mousedown', updateActivity);
      window.removeEventListener('scroll', updateActivity);
      window.removeEventListener('keydown', updateActivity);
    };
  }, []);

  const handleAutoRelease = useCallback(async () => {
    if (!batch?.batchID) return;
    try {
      const { releaseScanLock } = await import('../services/scanService');
      await releaseScanLock(batch.batchID);
      toast.warning('Session released due to inactivity');
    } finally {
      navigate('/all-batches');
    }
  }, [batch?.batchID, navigate]);

  useEffect(() => {
    if (loading || !batch?.batchID) return;
    const timer = setInterval(() => {
      const elapsed = Date.now() - lastActivity;
      if (elapsed > INACTIVITY_LIMIT) {
        handleAutoRelease();
      } else if (elapsed > WARNING_LIMIT && !hasWarned) {
        setHasWarned(true);
        toast.info('Session expiring soon due to inactivity...');
      }
    }, 5000);
    return () => clearInterval(timer);
  }, [batch?.batchID, loading, lastActivity, hasWarned, handleAutoRelease, INACTIVITY_LIMIT, WARNING_LIMIT]);

  const item = items[current];
  const activeSlip = session?.slipGroups?.find(g => g.slipEntryId === item?.slipEntryId);
  const displaySlipNo = activeSlip?.depositSlipNo || item?.depositSlipNo || item?.slipNo || '—';
  const displayClientName = activeSlip?.clientName || item?.clientName || '—';

  const pendingItems = items.filter(i => i.rrState === RRState.NeedsReview);
  const completedCount = items.filter(i => i.rrState !== RRState.NeedsReview).length;
  const totalCount = items.length;
  const isLastPending = pendingItems.length <= 1;

  const handleApproveAndNext = async () => {
    if (!item || !batch) return;
    setIsZoomed(false);
    setSaving(true);
    try {
      // Set approve: true to move the item to 'Approved' state
      await saveRRCorrection(item.chequeItemId, {
        chqNo: micr.chqNo,
        rrChqNo: micr.chqNo,
        rrmicr1: micr.micr1,
        rrmicr2: micr.micr2,
        rrmicr3: micr.micr3,
        approve: true, 
        rowVersion: item.rowVersion,
      });
      
      const updated = await getRRItems(batch.batchID);
      setItems(updated);

      // Find the next item that still needs review
      const nextPendingIndex = updated.findIndex((i, idx) => idx > current && i.rrState === RRState.NeedsReview);
      const anyPendingIndex = updated.findIndex(i => i.rrState === RRState.NeedsReview);
      
      const targetIndex = nextPendingIndex >= 0 ? nextPendingIndex : (anyPendingIndex >= 0 ? anyPendingIndex : -1);

      if (targetIndex >= 0) {
        const nextItem = updated[targetIndex];
        setCurrent(targetIndex);
        setMicr({
          chqNo: nextItem.chqNo ?? '',
          micr1: nextItem.rrmicr1 ?? nextItem.scanMICR1 ?? '',
          micr2: nextItem.rrmicr2 ?? nextItem.scanMICR2 ?? '',
          micr3: nextItem.rrmicr3 ?? nextItem.scanMICR3 ?? '',
        });
        toast.success('Approved. Moving to next.');
      } else {
        toast.success('Batch review complete. You can still revisit items or click Complete RR.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to approve item');
    } finally {
      setSaving(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent, nextId?: string) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (nextId) {
        const nextEl = document.getElementById(nextId);
        if (nextEl) {
          nextEl.focus();
          (nextEl as any).select?.();
        }
      } else {
        handleApproveAndNext();
      }
    }
  };

  const handleComplete = async () => {
    if (!batch) return;
    try {
      await completeRR(batch.batchID);
      toast.success('RR completed successfully');
      navigate('/all-batches');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Cannot complete RR');
    }
  };

  useEffect(() => {
    return () => {
      if (batch?.batchID) {
        import('../services/scanService').then(m => m.releaseScanLock(batch.batchID)).catch(() => {});
      }
    };
  }, [batch?.batchID]);





  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: 'var(--fg-muted)', fontSize: 'var(--text-sm)' }}>
        Loading Reject Repair session...
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <Icon name="error" size={48} style={{ color: 'var(--danger)', marginBottom: 16 }} />
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--fg)', marginBottom: 8 }}>RR Batch Unavailable</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-muted)', marginBottom: 24 }}>{loadError}</p>
        <button onClick={() => navigate('/all-batches')} className="btn-primary">
          Back to All Batches
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)', overflow: 'hidden' }}>
      
      {/* ── Top Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 24,
        padding: '10px 24px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-raised)', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ 
            width: 32, height: 32, borderRadius: 'var(--r-md)', background: 'var(--danger-bg)', 
            color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' 
          }}>
            <Icon name="build" size={18} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--fg)', lineHeight: 1.2 }}>
              Reject & Repair
            </h1>
            <div style={{ fontSize: 10, color: 'var(--accent-500)', fontWeight: 600 }}>
              {completedCount} of {totalCount} completed
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, overflow: 'hidden' }}>
          <Pill icon="tag" mono title="Batch Number" style={{ background: 'var(--bg-subtle)', color: 'var(--fg-muted)', border: '1px solid var(--border)' }}>Batch: {batch?.batchNo}</Pill>
          <Pill icon="receipt_long" title="Summary Reference Number" style={{ background: 'var(--bg-subtle)', color: 'var(--fg-muted)', border: '1px solid var(--border)' }}>Ref: {batch?.summRefNo || '—'}</Pill>
          <Pill icon="grid_view" title="Cluster Code" style={{ background: 'var(--bg-subtle)', color: 'var(--fg-muted)', border: '1px solid var(--border)' }}>Cluster: {batch?.clusterCode || '—'}</Pill>
          <Pill icon="location_on" title="Location" style={{ background: 'var(--bg-subtle)', color: 'var(--fg-muted)', border: '1px solid var(--border)' }}>{batch?.locationCode}</Pill>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button 
            onClick={() => setMicrLayout(l => l === 'bottom' ? 'side' : 'bottom')}
            className="btn-secondary"
            style={{ height: 32, padding: '0 12px', fontSize: 'var(--text-xs)', gap: 6 }}
          >
            <Icon name={micrLayout === 'bottom' ? 'view_sidebar' : 'view_headline'} size={14} />
            {micrLayout === 'bottom' ? 'Side Layout' : 'Bottom Layout'}
          </button>
          
          <button 
            onClick={handleComplete} 
            disabled={pendingItems.length > 0}
            className="btn-primary" 
            style={{ 
              height: 32, padding: '0 16px', fontSize: 'var(--text-xs)', 
              opacity: pendingItems.length > 0 ? 0.5 : 1
            }}
          >
            <Icon name="verified" size={14} />
            Complete RR
          </button>
        </div>
      </div>

      {micrLayout === 'bottom' && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '8px 24px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-raised)', flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none'
        }}>
          <div style={{ color: 'var(--fg-faint)', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', marginRight: 4 }}>
            SLIP CONTEXT
          </div>
          <Pill icon="receipt_long" mono title="Deposit Slip Number" style={{ background: 'var(--bg-subtle)', color: 'var(--accent-500)', border: '1px solid var(--border)' }}>
            Deposit Slip No: {displaySlipNo}
          </Pill>
          <Pill icon="payments" title="Slip Amount" style={{ background: 'var(--bg-subtle)', color: 'var(--fg)', border: '1px solid var(--border)' }}>
            Amt: ₹{item?.slipAmount?.toLocaleString('en-IN') ?? '—'}
          </Pill>
          <Pill icon="person" title="Client Name" style={{ background: 'var(--bg-subtle)', color: 'var(--fg)', border: '1px solid var(--border)' }}>
            {displayClientName}
          </Pill>
        </div>
      )}

      {/* ── Main Layout ── */}
      <div style={{ 
        flex: 1, display: 'grid', 
        gridTemplateColumns: `160px 1fr${micrLayout === 'side' ? ' 340px' : ''}`, 
        minHeight: 0, overflow: 'hidden' 
      }}>
        
        {/* Left: Queue Sidebar */}
        <div style={{ 
          width: 160, borderRight: '1px solid var(--border)', 
          background: 'var(--bg-raised)', display: 'flex', flexDirection: 'column',
          flexShrink: 0,
        }}>
          <div style={{ 
            padding: '8px 12px', height: 44, boxSizing: 'border-box',
            borderBottom: '1px solid var(--border)',
            fontSize: 9, fontWeight: 700, color: 'var(--fg-faint)',
            textTransform: 'uppercase', letterSpacing: '.05em',
            display: 'flex', alignItems: 'center', background: 'var(--bg-raised)',
          }}>
            Queue
          </div>
          <div className="custom-scrollbar" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '8px' }}>
            {items.map((it, idx) => {
              const isSelected = idx === current;
              const isDone = it.rrState !== RRState.NeedsReview;
              return (
                <button
                  key={it.slipEntryId + idx}
                  id={`rr-item-${idx}`}
                  onClick={() => {
                    setCurrent(idx);
                    setMicr({
                      chqNo: it.chqNo ?? '',
                      micr1: it.rrmicr1 ?? it.scanMICR1 ?? '',
                      micr2: it.rrmicr2 ?? it.scanMICR2 ?? '',
                      micr3: it.rrmicr3 ?? it.scanMICR3 ?? '',
                    });
                  }}
                  style={{ 
                    width: '100%', padding: '12px 10px', display: 'flex', alignItems: 'center', gap: 10, 
                    background: isSelected ? 'rgba(249, 115, 22, 0.15)' : (isDone ? 'rgba(34, 197, 94, 0.1)' : 'transparent'),
                    border: 'none', borderLeft: isSelected ? '3px solid var(--accent-500)' : '3px solid transparent',
                    borderBottom: '1px solid var(--border-faint)',
                    cursor: 'pointer', transition: 'all 0.2s ease', position: 'relative',
                    borderRadius: isSelected ? 'var(--r-md)' : '0'
                  }}
                >
                  <div style={{ 
                    width: 20, height: 20, borderRadius: '50%', 
                    background: isDone ? 'rgba(34, 197, 94, 0.2)' : (isSelected ? 'var(--accent-500)' : 'var(--bg-subtle)'),
                    color: isDone ? '#22c55e' : (isSelected ? 'var(--fg-on-accent)' : 'var(--fg-muted)'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 700,
                    flexShrink: 0
                  }}>
                    {idx + 1}
                  </div>
                  <div style={{ 
                    width: 80, height: 48, borderRadius: 'var(--r-sm)', background: 'var(--bg-subtle)', 
                    overflow: 'hidden', border: '1px solid var(--border)', flexShrink: 0,
                    boxShadow: isSelected ? '0 4px 12px rgba(0,0,0,0.2)' : 'none'
                  }}>
                    <img 
                      src={getChequeImageUrl(it, 'front')} 
                      alt="thumb" 
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: Image + Bottom MICR if configured */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', background: 'var(--bg)', flex: 1 }}>
          <div style={{ flex: 1, padding: '12px 16px', display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
            {item && (
              <RRViewport 
                previewFront={getChequeImageUrl(item, imageType === 'bitonal' ? 'frontTiff' : 'front')}
                previewBack={getChequeImageUrl(item, imageType === 'bitonal' ? 'backTiff' : 'back')}
                imageBaseName={item.imageBaseName}
                hasFrontPath={!!item.imageBaseName}
                hasBackPath={!!item.imageBaseName}
                filename={item.imageName || item.imageBaseName || `CHQ_SEQ_${item.chqSeq}CF.tif`}
                itemTitle={`Sequence #${item.chqSeq}`}
                setIsFullscreen={setIsFullscreen}
                isZoomed={isZoomed}
                layout={micrLayout}
                imageType={imageType}
                setImageType={setImageType}
              />
            )}
          </div>
          {micrLayout === 'bottom' && (
            <div style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-raised)', padding: '10px 16px 16px 16px', flexShrink: 0 }}>
              <MICRPanel 
                item={item} micr={micr} setMicr={setMicr} 
                saving={saving} onSave={handleApproveAndNext} 
                isLast={isLastPending} firstInputRef={firstInputRef}
                onKeyDown={handleKeyDown}
                layout="bottom"
                setIsZoomed={setIsZoomed}
              />
            </div>
          )}
        </div>

        {/* Right: MICR if configured */}
        {micrLayout === 'side' && (
          <div style={{ 
            borderLeft: '1px solid var(--border)', background: 'var(--bg-raised)', 
            display: 'flex', flexDirection: 'column', width: 340, flexShrink: 0
          }}>
            <div style={{ padding: 16, flex: '0 0 auto', overflowY: 'auto' }}>
              <MICRPanel 
                item={item} micr={micr} setMicr={setMicr} 
                saving={saving} onSave={handleApproveAndNext} 
                isLast={isLastPending} firstInputRef={firstInputRef}
                onKeyDown={handleKeyDown}
                layout="side"
                setIsZoomed={setIsZoomed}
              />
            </div>

            {/* Slip Context at Bottom of Side Panel */}
            <div style={{ 
              padding: 16, borderTop: '1px solid var(--border)', background: 'var(--bg)',
              display: 'flex', flexDirection: 'column', gap: 8
            }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 4 }}>
                Slip Context
              </div>
              <Pill icon="receipt_long" mono title="Deposit Slip Number" style={{ background: 'var(--bg-subtle)', color: 'var(--accent-500)', border: '1px solid var(--border)', width: '100%' }}>
                No: {displaySlipNo}
              </Pill>
              <Pill icon="payments" title="Slip Amount" style={{ background: 'var(--bg-subtle)', color: 'var(--fg)', border: '1px solid var(--border)', width: '100%' }}>
                Amt: ₹{item?.slipAmount?.toLocaleString('en-IN') ?? '—'}
              </Pill>
              <Pill icon="person" title="Client Name" style={{ background: 'var(--bg-subtle)', color: 'var(--fg)', border: '1px solid var(--border)', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayClientName}
              </Pill>
            </div>
          </div>
        )}
      </div>
      {/* ── Fullscreen overlay ── */}
      {isFullscreen && session && item && (
        <ScanFullscreenOverlay
          session={session}
          isSlipView={false}
          scanStep="ChequeScan"
          previewFront={getChequeImageUrl(item, imageType === 'bitonal' ? 'frontTiff' : 'front')}
          previewBack={getChequeImageUrl(item, imageType === 'bitonal' ? 'backTiff' : 'back')}
          flipped={flipped}
          setFlipped={setFlipped}
          zoom={fsZoom}
          setZoom={setFsZoom} 
          nextChqSeq={item.chqSeq}
          panning={false} // Components internally handles panning state if setZoom/setPan provided
          hasMoved={{ current: false }}
          fsPanOffset={fsOffset}
          setFsPanOffset={setFsOffset}
          viewerFsRef={{ current: null }}
          makePanHandlers={(setPan: any) => {
            let start = { x: 0, y: 0 };
            return {
              onMouseDown: (e: React.MouseEvent) => {
                start = { x: e.clientX - fsOffset.x, y: e.clientY - fsOffset.y };
                const move = (em: MouseEvent) => setFsOffset({ x: em.clientX - start.x, y: em.clientY - start.y });
                const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
                window.addEventListener('mousemove', move);
                window.addEventListener('mouseup', up);
              }
            };
          }}
          onClose={() => { setIsFullscreen(false); setFsZoom(1); setFsOffset({ x: 0, y: 0 }); }}
        />
      )}
    </div>
  );
}

// ── Sub-component: MICR Entry Panel ──

function MICRPanel({ 
  item, micr, setMicr, saving, onSave, isLast, firstInputRef, onKeyDown, layout, setIsZoomed
}: { 
  item: RRItemDto, micr: any, setMicr: any, saving: boolean, onSave: any, isLast: boolean, 
  firstInputRef: any, onKeyDown: any, layout: 'side' | 'bottom', setIsZoomed: any
}) {
  const isCompact = true;
  const isMobileBatch = !item.scanMICRRaw && !item.scanChqNo && !item.scanMICR1;

  const handleInputChange = (key: string, val: string, maxLen: number, nextId: string) => {
    setMicr((prev: any) => ({ ...prev, [key]: val }));
    if (val.length === maxLen && nextId) {
      setTimeout(() => {
        const nextEl = document.getElementById(nextId);
        if (nextEl) {
          nextEl.focus();
          (nextEl as any).select?.();
        }
      }, 10);
    }
  };

  const inputs = [
    { label: 'Cheque No', key: 'chqNo', maxLen: 6, icon: 'tag', id: 'rr_chqNo', nextId: 'rr_micr1' },
    { label: 'MICR 1', key: 'micr1', maxLen: 9, icon: 'numbers', id: 'rr_micr1', nextId: 'rr_micr2' },
    { label: 'MICR 2', key: 'micr2', maxLen: 6, icon: 'apartment', id: 'rr_micr2', nextId: 'rr_micr3' },
    { label: 'MICR 3', key: 'micr3', maxLen: 2, icon: 'category', id: 'rr_micr3', nextId: '' },
  ];

  const repairSection = (
    <div>
      <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--fg-faint)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '.05em' }}>
        {item.rrState === RRState.NeedsReview ? 'Repair / Correction' : 'Re-verify Details'}
      </div>
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: layout === 'bottom' ? 'repeat(4, 1fr) 180px' : '1fr', 
        gap: 10, alignItems: 'end'
      }}>
        {inputs.map(({ label, key, maxLen, icon, id: inputId, nextId }) => (
          <div key={key}>
            <label style={{ display: 'block', fontSize: 9, fontWeight: 600, color: 'var(--fg-muted)', marginBottom: 4 }}>
              {label}
            </label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-faint)' }}>
                <Icon name={icon} size={12} />
              </span>
              <input
                id={inputId}
                ref={key === 'chqNo' ? firstInputRef : null}
                value={micr[key as keyof typeof micr]}
                onChange={(e) => handleInputChange(key, e.target.value, maxLen, nextId)}
                onKeyDown={(e) => onKeyDown(e, nextId)}
                onFocus={() => setIsZoomed(true)}
                onBlur={() => setIsZoomed(false)}
                maxLength={maxLen}
                autoComplete="off"
                className="input-field"
                style={{ 
                  paddingLeft: 28, paddingRight: 6, height: 34, 
                  fontFamily: 'var(--font-mono)', fontSize: '13px', fontWeight: 600,
                  borderColor: 'var(--border-strong)'
                }}
              />
            </div>
          </div>
        ))}

        <button
          onClick={onSave}
          disabled={saving}
          className="btn-primary"
          style={{ 
            height: 34, fontSize: 'var(--text-xs)', gap: 6, 
            boxShadow: '0 2px 8px rgba(99, 102, 241, 0.15)',
            marginTop: layout === 'bottom' ? 0 : 6,
            whiteSpace: 'nowrap'
          }}
        >
          <Icon name="verified" size={14} />
          {saving ? 'Saving...' : (item.rrState === RRState.NeedsReview ? (isLast ? 'Approve' : 'Approve & Next') : 'Update')}
        </button>
      </div>
    </div>
  );

  const scannedDetails = (
    <div style={{ 
      background: 'var(--bg-subtle)', 
      border: isMobileBatch ? '2px solid var(--accent-500)' : '1px solid var(--border)', 
      borderRadius: 'var(--r-md)', padding: layout === 'side' ? '6px 10px' : (isCompact ? '8px 12px' : 16), 
      boxShadow: 'var(--shadow-sm)',
      minHeight: layout === 'side' ? 40 : (layout === 'bottom' ? 60 : 120),
      width: '100%',
      overflow: 'hidden'
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-700)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Scanned MICR Details
        </div>
        {isMobileBatch && (
          <div style={{ 
            fontSize: 8, fontWeight: 800, color: 'var(--accent-600)', 
            background: 'rgba(249, 115, 22, 0.1)', 
            border: '1px solid rgba(249, 115, 22, 0.2)',
            padding: '2px 6px', borderRadius: 4, letterSpacing: '0.05em',
            textTransform: 'uppercase'
          }}>
            Mobile Capture
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
        {[
          { label: 'SCAN CHQ', val: item.scanChqNo },
          { label: 'MICR 1', val: item.scanMICR1 },
          { label: 'MICR 2', val: item.scanMICR2 },
          { label: 'MICR 3', val: item.scanMICR3 },
        ].map(s => (
          <div key={s.label} style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: 'var(--fg-muted)', fontWeight: 600 }}>{s.label}</div>
            <div style={{ fontSize: 11, color: s.val ? 'var(--fg)' : 'var(--fg-faint)', fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{s.val || '—'}</div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {layout === 'side' ? (
        <>
          {scannedDetails}
          {repairSection}
        </>
      ) : (
        <>
          {repairSection}
          {scannedDetails}
        </>
      )}
    </div>
  );
}
