import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRRItems, saveRRCorrection, completeRR } from '../services/rrService';
import { getBatchByNumber } from '../services/batchService';
import { toast } from '../store/toastStore';
import { getChequeImageUrl } from '../utils/imageUtils';
import { RRItemDto, RRState, BatchDto } from '../types';
import { Icon, Pill } from '../components/scan';
import { RRViewport } from './rr/RRViewport';

export function RRPage() {
  const { batchNo } = useParams<{ batchNo: string }>();
  const navigate = useNavigate();
  const [batch, setBatch] = useState<BatchDto | null>(null);
  const [items, setItems] = useState<RRItemDto[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [micr, setMicr] = useState({ chqNo: '', micr1: '', micr2: '', micr3: '' });
  const [micrLayout, setMicrLayout] = useState<'bottom' | 'side'>('side');
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  const loadItems = useCallback(async () => {
    if (!batchNo) {
      setLoadError('Invalid RR batch number.');
      setLoading(false);
      return;
    }

    try {
      setLoadError(null);
      const bDetails = await getBatchByNumber(batchNo);
      setBatch(bDetails);

      const data = await getRRItems(bDetails.batchID);
      setItems(data);
      if (data.length > 0) {
        // Initially, land on the first pending item, or the first item if all are done
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
      toast.error('Failed to load RR items');
    } finally {
      setLoading(false);
    }
  }, [batchNo]);

  useEffect(() => { loadItems(); }, [loadItems]);

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
  }, [batch?.batchID, loading, lastActivity, hasWarned, handleAutoRelease]);

  useEffect(() => {
    if (!loading && items.length > 0) {
      const timer = setTimeout(() => {
        if (firstInputRef.current) {
          firstInputRef.current.focus();
          firstInputRef.current.select();
        }
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [loading, current, items.length]);

  const item = items[current];
  const pendingItems = items.filter(i => i.rrState === RRState.NeedsReview);
  const completedCount = items.filter(i => i.rrState !== RRState.NeedsReview).length;
  const totalCount = items.length;
  const isLastPending = pendingItems.length <= 1;

  const handleApproveAndNext = async () => {
    if (!item || !batch) return;
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
        padding: '10px 24px', borderBottom: '1px solid #1a1a1b',
        background: '#111111', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ 
            width: 32, height: 32, borderRadius: 'var(--r-md)', background: 'var(--danger-bg)', 
            color: 'var(--danger)', display: 'flex', alignItems: 'center', justifyContent: 'center' 
          }}>
            <Icon name="build" size={18} />
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 700, color: '#fff', lineHeight: 1.2 }}>
              Reject & Repair
            </h1>
            <div style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 600 }}>
              {completedCount} of {totalCount} completed
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, overflow: 'hidden' }}>
          <Pill icon="tag" mono style={{ background: 'rgba(255,255,255,0.05)', color: '#ccc', border: '1px solid rgba(255,255,255,0.08)' }}>Batch: {batch?.batchNo}</Pill>
          <Pill icon="receipt_long" style={{ background: 'rgba(255,255,255,0.05)', color: '#ccc', border: '1px solid rgba(255,255,255,0.08)' }}>Ref: {batch?.summRefNo || '—'}</Pill>
          <Pill icon="grid_view" style={{ background: 'rgba(255,255,255,0.05)', color: '#ccc', border: '1px solid rgba(255,255,255,0.08)' }}>Cluster: {batch?.clusterCode || '—'}</Pill>
          <Pill icon="location_on" style={{ background: 'rgba(255,255,255,0.05)', color: '#ccc', border: '1px solid rgba(255,255,255,0.08)' }}>{batch?.locationCode}</Pill>
          <Pill icon="category" style={{ background: 'rgba(255,255,255,0.05)', color: '#ccc', border: '1px solid rgba(255,255,255,0.08)' }}>{batch?.clearingType}</Pill>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button 
            onClick={() => setMicrLayout(l => l === 'bottom' ? 'side' : 'bottom')}
            className="btn-secondary"
            style={{ height: 32, padding: '0 12px', fontSize: 'var(--text-xs)', gap: 6, background: '#222', borderColor: '#333', color: '#fff' }}
          >
            <Icon name={micrLayout === 'side' ? 'view_sidebar' : 'view_headline'} size={14} />
            {micrLayout === 'side' ? 'Side Layout' : 'Bottom Layout'}
          </button>
          
          <button 
            onClick={handleComplete} 
            disabled={pendingItems.length > 0}
            className="btn-primary" 
            style={{ 
              height: 32, padding: '0 16px', fontSize: 'var(--text-xs)', 
              background: pendingItems.length > 0 ? '#222' : 'var(--success)', 
              borderColor: pendingItems.length > 0 ? '#333' : 'var(--success)',
              color: pendingItems.length > 0 ? '#666' : '#fff'
            }}
          >
            <Icon name="verified" size={14} />
            Complete RR
          </button>
        </div>
      </div>

      {/* ── Secondary Header (Unified Dark Style) ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '8px 24px', borderBottom: '1px solid #1a1a1b',
        background: '#111111', flexShrink: 0, overflowX: 'auto', scrollbarWidth: 'none'
      }}>
        <div style={{ color: '#555', fontSize: 9, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.1em', marginRight: 4 }}>
          SLIP CONTEXT
        </div>
        <Pill icon="receipt_long" mono style={{ background: 'rgba(255,255,255,0.03)', color: 'var(--accent)', border: '1px solid rgba(255,255,255,0.06)' }}>
          Slip: {item?.slipNo || '—'}
        </Pill>
        <Pill icon="payments" style={{ background: 'rgba(255,255,255,0.03)', color: '#fff', border: '1px solid rgba(255,255,255,0.06)' }}>
          Amt: ₹{item?.slipAmount?.toLocaleString('en-IN') ?? '—'}
        </Pill>
        <Pill icon="person" style={{ background: 'rgba(255,255,255,0.03)', color: '#fff', border: '1px solid rgba(255,255,255,0.06)' }}>
          {item?.clientName || '—'}
        </Pill>
        <Pill icon="pin" style={{ background: 'rgba(255,255,255,0.03)', color: '#fff', border: '1px solid rgba(255,255,255,0.06)' }}>
          Seq: {item?.chqSeq}
        </Pill>
      </div>

      {/* ── Main Layout ── */}
      <div style={{ 
        flex: 1, display: 'grid', 
        gridTemplateColumns: `260px 1fr${micrLayout === 'side' ? ' 340px' : ''}`, 
        minHeight: 0, overflow: 'hidden' 
      }}>
        
        {/* Sidebar: Sequences */}
        <div style={{ 
          borderRight: '1px solid var(--border)', background: 'var(--bg-raised)', 
          display: 'flex', flexDirection: 'column', overflow: 'hidden' 
        }}>
          <div style={{ padding: '12px 16px', fontSize: 10, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
            Queue Sequences
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px 16px' }}>
            {items.map((it, idx) => {
              const isSelected = idx === current;
              const isDone = it.rrState !== RRState.NeedsReview;
              return (
                <button
                  key={it.chequeItemId}
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
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', margin: '4px 0', borderRadius: 'var(--r-md)',
                    border: isSelected ? '1px solid var(--accent-300)' : '1px solid transparent',
                    background: isSelected ? 'var(--accent-50)' : 'transparent',
                    cursor: 'pointer', textAlign: 'left', transition: 'all 0.2s ease',
                    boxShadow: isSelected ? '0 2px 8px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  <div style={{ 
                    width: 24, height: 24, borderRadius: '50%', 
                    background: isDone ? 'var(--success-bg)' : (isSelected ? 'var(--accent-100)' : 'var(--bg-subtle)'),
                    color: isDone ? 'var(--success)' : (isSelected ? 'var(--accent-700)' : 'var(--fg-muted)'),
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700,
                    flexShrink: 0
                  }}>
                    {isDone ? <Icon name="check" size={14} /> : idx + 1}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: isSelected ? 'var(--accent-900)' : 'var(--fg)' }}>Item #{idx + 1}</span>
                      <span style={{ fontSize: 9, color: 'var(--fg-muted)', fontWeight: 600 }}>Seq {it.chqSeq}</span>
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--fg-faint)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontWeight: 500 }}>
                      {it.chqNo ? `Chq: ${it.chqNo}` : 'MICR ERR'} • Slip {it.slipNo}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Center: Image + Bottom MICR if configured */}
        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden', background: '#111' }}>
          <div style={{ flex: 1, padding: 16, display: 'flex', flexDirection: 'column' }}>
            {item && (
              <RRViewport 
                previewFront={getChequeImageUrl(item, 'front')}
                previewBack={getChequeImageUrl(item, 'back')}
                filename={`${item.imageName || 'CHQ_SEQ_' + item.chqSeq}CF${item.fileExtension?.split(',')[0] || '.jpg'}`}
                itemTitle={`Sequence #${item.chqSeq}`}
              />
            )}
          </div>
          {micrLayout === 'bottom' && (
            <div style={{ borderTop: '1px solid #1a1a1b', background: 'var(--bg-raised)', padding: '12px 16px' }}>
              <MICRPanel 
                item={item} micr={micr} setMicr={setMicr} 
                saving={saving} onSave={handleApproveAndNext} 
                isLast={isLastPending} firstInputRef={firstInputRef}
                onKeyDown={handleKeyDown}
                layout="bottom"
              />
            </div>
          )}
        </div>

        {/* Right: MICR if configured */}
        {micrLayout === 'side' && (
          <div style={{ borderLeft: '1px solid var(--border)', background: 'var(--bg-raised)', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
            <div style={{ padding: 16 }}>
              <MICRPanel 
                item={item} micr={micr} setMicr={setMicr} 
                saving={saving} onSave={handleApproveAndNext} 
                isLast={isLastPending} firstInputRef={firstInputRef}
                onKeyDown={handleKeyDown}
                layout="side"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-component: MICR Entry Panel ──

function MICRPanel({ 
  item, micr, setMicr, saving, onSave, isLast, firstInputRef, onKeyDown, layout 
}: { 
  item: RRItemDto, micr: any, setMicr: any, saving: boolean, onSave: any, isLast: boolean, 
  firstInputRef: any, onKeyDown: any, layout: 'side' | 'bottom'
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
        gridTemplateColumns: layout === 'bottom' ? 'repeat(4, 1fr) 140px' : '1fr', 
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
            marginTop: layout === 'bottom' ? 0 : 6
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
      background: isMobileBatch ? 'rgba(99, 102, 241, 0.02)' : 'rgba(0,0,0,0.03)', 
      border: '1px solid var(--border)', 
      borderRadius: 'var(--r-md)', padding: isCompact ? '10px 14px' : 16, 
      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.01)',
      minHeight: layout === 'bottom' ? 90 : 120
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--accent-700)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
          Scanned MICR Details
        </div>
        {isMobileBatch && (
          <div style={{ fontSize: 8, fontWeight: 700, color: 'var(--accent)', background: 'var(--accent-100)', padding: '2px 6px', borderRadius: 4 }}>
            MOBILE CAPTURE
          </div>
        )}
      </div>
      
      <div style={{ 
        fontFamily: 'var(--font-mono)', fontSize: 13, color: isMobileBatch ? 'var(--fg-faint)' : 'var(--fg)', 
        fontWeight: 700, background: 'var(--bg)', padding: '6px 10px', 
        borderRadius: 'var(--r-sm)', border: '1px solid var(--border-strong)',
        marginBottom: 10, textAlign: 'center', letterSpacing: '0.05em',
        minHeight: 28, display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>
        {item.scanMICRRaw || item.micrRaw || (isMobileBatch ? 'NO MICR DATA' : 'XXXXXXXXXXXX')}
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
