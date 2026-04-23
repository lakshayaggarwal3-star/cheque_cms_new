// =============================================================================
// File        : RRPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : RR (Reject Repair)
// Description : Reject-Repair screen with image viewer, MICR edit, approve, and complete.
// Created     : 2026-04-14
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRRItems, saveRRCorrection, completeRR } from '../services/rrService';
import { toast } from '../store/toastStore';
import { getImageUrl } from '../utils/imageUtils';
import { RRItemDto, RRState } from '../types';
import { Icon, Pill } from '../components/scan';
import { RRViewport } from './rr/RRViewport';

export function RRPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const navigate = useNavigate();
  const [items, setItems] = useState<RRItemDto[]>([]);
  const [current, setCurrent] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [micr, setMicr] = useState({ chqNo: '', micr1: '', micr2: '', micr3: '' });

  const id = Number(batchId);

  const loadItems = useCallback(async () => {
    if (!Number.isFinite(id) || id <= 0) {
      setLoadError('Invalid RR batch. Open RR from Dashboard for a valid batch.');
      setLoading(false);
      return;
    }

    try {
      setLoadError(null);
      const data = await getRRItems(id);
      setItems(data);
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
    } catch {
      setLoadError('Unable to load RR items for this batch.');
      toast.error('Failed to load RR items');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const item = items[current];
  const pendingItems = items.filter(i => i.rrState === RRState.NeedsReview);
  const isLastPending = pendingItems.length <= 1;
  const currentSlipItems = item
    ? items.filter(i => i.slipEntryId === item.slipEntryId)
    : [];
  const currentSlipPosition = item
    ? currentSlipItems.findIndex(i => i.chequeItemId === item.chequeItemId) + 1
    : 0;

  const handleApproveAndNext = async () => {
    if (!item) return;
    setSaving(true);
    try {
      await saveRRCorrection(item.chequeItemId, {
        chqNo: micr.chqNo,
        rrmicr1: micr.micr1,
        rrmicr2: micr.micr2,
        rrmicr3: micr.micr3,
        approve: false,
        rowVersion: item.rowVersion,
      });
      const updated = await getRRItems(id);
      setItems(updated);

      const nextPendingIndex = updated.findIndex(i => i.rrState === RRState.NeedsReview);
      if (nextPendingIndex >= 0) {
        const nextItem = updated[nextPendingIndex];
        setCurrent(nextPendingIndex);
        setMicr({
          chqNo: nextItem.chqNo ?? '',
          micr1: nextItem.rrmicr1 ?? nextItem.scanMICR1 ?? '',
          micr2: nextItem.rrmicr2 ?? nextItem.scanMICR2 ?? '',
          micr3: nextItem.rrmicr3 ?? nextItem.scanMICR3 ?? '',
        });
        toast.success('Saved. Moving to next item.');
      } else {
        toast.success('All items reviewed.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    try {
      await completeRR(id);
      toast.success('RR completed successfully');
      navigate('/');
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Cannot complete RR');
    }
  };

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: 'var(--fg-faint)', fontSize: 'var(--text-sm)' }}>
        Loading RR items...
      </div>
    );
  }

  if (loadError) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--fg)', marginBottom: 8 }}>RR Page Unavailable</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-muted)', marginBottom: 24 }}>{loadError}</p>
        <button onClick={() => navigate('/')} className="btn-primary">
          Back to Dashboard
        </button>
      </div>
    );
  }

  if (pendingItems.length === 0) {
    return (
      <div style={{ padding: 80, textAlign: 'center' }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✓</div>
        <h2 style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--fg)', marginBottom: 8 }}>All Items Reviewed</h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-muted)', marginBottom: 32 }}>No more items need repair in this batch.</p>
        <button onClick={handleComplete} className="btn-primary" style={{ background: 'var(--success)', borderColor: 'var(--success)' }}>
          Finalize Batch
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Action Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid var(--border)', background: 'var(--bg-raised)', flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h1 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 700, color: 'var(--fg)' }}>
            Reject Repair
          </h1>
          <Pill icon="pending_actions" color="var(--warning)">
            Pending: {pendingItems.length}
          </Pill>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={handleComplete} className="btn-primary" style={{ height: 32, padding: '0 14px', fontSize: 'var(--text-xs)', background: 'var(--success)', borderColor: 'var(--success)' }}>
            <Icon name="verified" size={14} />
            Complete RR
          </button>
        </div>
      </div>

      {item && (
        <div style={{ 
          flex: 1, display: 'grid', gridTemplateColumns: '1fr 380px', 
          gap: 0, overflow: 'hidden', background: 'var(--bg)' 
        }}>
          {/* Main Viewport */}
          <div style={{ padding: 16, display: 'flex', flexDirection: 'column', minWidth: 0, overflowY: 'auto' }}>
            <RRViewport 
              previewFront={item.imageFrontPath ? getImageUrl(item.imageFrontPath) : null}
              previewBack={item.imageBackPath ? getImageUrl(item.imageBackPath) : null}
              filename={item.imageFrontPath?.split(/[\\/]/).pop()}
              itemTitle={`Cheque Seq #${item.chqSeq}`}
            />
          </div>

          {/* Right Sidebar: MICR + Slip info */}
          {/* Right Sidebar: MICR + Slip info */}
          <div style={{ 
            borderLeft: '1px solid var(--border)', background: 'var(--bg-raised)', 
            padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12, overflow: 'hidden' 
          }}>
            {/* Raw Scan Values */}
            <div className="card" style={{ padding: 12, background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--fg-faint)', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '.05em' }}>
                Captured Scan MICR
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--fg-muted)', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 9, opacity: 0.6 }}>CHQ</span>
                  <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{item.chqNo ?? '—'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 9, opacity: 0.6 }}>MICR1</span>
                  <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{item.scanMICR1 ?? '—'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 9, opacity: 0.6 }}>MICR2</span>
                  <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{item.scanMICR2 ?? '—'}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: 9, opacity: 0.6 }}>MICR3</span>
                  <span style={{ color: 'var(--fg)', fontWeight: 600 }}>{item.scanMICR3 ?? '—'}</span>
                </div>
              </div>
            </div>

            {/* Repair Inputs */}
            <div className="card" style={{ padding: 16, flexShrink: 0 }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--fg-faint)', textTransform: 'uppercase', marginBottom: 12, letterSpacing: '.05em' }}>
                Repair / Correct Values
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px 12px' }}>
                {[
                  { label: 'Cheque No (6)', key: 'chqNo', maxLen: 6, icon: 'tag' },
                  { label: 'MICR1 (9)', key: 'micr1', maxLen: 9, icon: 'digits' },
                  { label: 'MICR2 (6)', key: 'micr2', maxLen: 6, icon: 'location_on' },
                  { label: 'MICR3 (2)', key: 'micr3', maxLen: 2, icon: 'category' },
                ].map(({ label, key, maxLen, icon }) => (
                  <div key={key}>
                    <label style={{ display: 'block', fontSize: 10, fontWeight: 500, color: 'var(--fg-muted)', marginBottom: 4 }}>
                      {label}
                    </label>
                    <div style={{ position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', color: 'var(--fg-faint)' }}>
                        <Icon name={icon} size={12} />
                      </span>
                      <input
                        value={micr[key as keyof typeof micr]}
                        onChange={(e) => setMicr(m => ({ ...m, [key]: e.target.value }))}
                        maxLength={maxLen}
                        className="input-field"
                        style={{ paddingLeft: 26, paddingRight: 8, height: 32, fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={handleApproveAndNext}
                disabled={saving}
                className="btn-primary"
                style={{ width: '100%', height: 38, marginTop: 16, fontSize: 'var(--text-xs)', gap: 6 }}
              >
                <Icon name="check_circle" size={16} />
                {saving ? 'Saving...' : (isLastPending ? 'Approve & Finish' : 'Approve & Next')}
              </button>
            </div>

            {/* Slip Context */}
            {item.slipNo && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '.05em' }}>
                  Slip Context
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <Pill icon="receipt" title="Slip Number" style={{ padding: '1px 6px', fontSize: 10 }}>No: {item.slipNo}</Pill>
                  <Pill icon="payments" title="Slip Amount" style={{ padding: '1px 6px', fontSize: 10 }}>₹ {item.slipAmount?.toLocaleString('en-IN') ?? '—'}</Pill>
                  <Pill icon="person" title="Client" style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', padding: '1px 6px', fontSize: 10 }}>{item.clientName || '—'}</Pill>
                  <Pill icon="pin" title="Item position" style={{ padding: '1px 6px', fontSize: 10 }}>{currentSlipPosition} / {currentSlipItems.length}</Pill>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
