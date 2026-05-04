// =============================================================================
// File        : SlipMappingModal.tsx
// Project     : CPS — Cheque Processing System
// Module      : Maker
// Description : Full-screen workspace for linking global images to slip entries.
// Created     : 2026-05-04
// =============================================================================

import React, { useState, useMemo, useCallback } from 'react';
import { getChequeImageUrl, getSlipImageUrl } from '../../utils/imageUtils';
import { mapImagesToSlip } from '../../services/makerService';
import { ChequeItemDto, SlipEntryDto, SlipItemDto } from '../../types';
import { toast } from '../../store/toastStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  batchNo: string;
  allCheques: ChequeItemDto[];
  globalSlips: SlipItemDto[];
  globalSlipEntryId: number | null;
  slips: SlipEntryDto[];
}

const SLIP_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#f97316', '#ec4899',
];
const slipColor = (idx: number) => SLIP_COLORS[idx % SLIP_COLORS.length];

function Icon({ name, size = 20, style }: { name: string; size?: number; style?: React.CSSProperties }) {
  return (
    <span className="material-symbols-outlined" style={{
      fontSize: size, fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
      lineHeight: 1, userSelect: 'none', flexShrink: 0, ...style,
    }}>{name}</span>
  );
}

// ── Confirm dialog for closing with unmapped images ───────────────────────────
function CloseWarningDialog({ unmappedCount, onConfirm, onCancel }: {
  unmappedCount: number; onConfirm: () => void; onCancel: () => void;
}) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 12000,
      background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <div style={{
        background: 'var(--bg-raised)', borderRadius: 'var(--r-lg)', padding: '28px 32px',
        width: 400, boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 20 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 'var(--r-md)', background: '#f59e0b22',
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Icon name="warning" size={24} style={{ color: '#f59e0b' }} />
          </div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--fg)', marginBottom: 6 }}>
              {unmappedCount} image{unmappedCount !== 1 ? 's' : ''} not mapped yet
            </div>
            <div style={{ fontSize: 13, color: 'var(--fg-muted)', lineHeight: 1.5 }}>
              These images are still in the global bucket and haven't been linked to any slip. Close anyway?
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onCancel} className="btn-secondary" style={{ padding: '8px 20px' }}>
            Go back &amp; map
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '8px 20px', borderRadius: 'var(--r-md)', border: 'none',
              background: '#ef4444', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 13,
            }}
          >
            Close anyway
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Image card ────────────────────────────────────────────────────────────────
function ImageCard({ url, label, type, subLabel, isSelected, mappedColor, mappedLabel, activeColor, onToggle, onPreview }: {
  url: string; label: string; type: 'SLIP' | 'CHEQUE'; subLabel: string;
  isSelected: boolean; mappedColor: string | null; mappedLabel: string | null;
  activeColor: string; onToggle: () => void; onPreview: () => void;
}) {
  const borderColor = isSelected ? activeColor : (mappedColor ?? 'var(--border)');
  const isMapped = mappedColor !== null && !isSelected;

  return (
    <div
      onClick={onToggle}
      onDoubleClick={(e) => { e.stopPropagation(); onPreview(); }}
      style={{
        position: 'relative', borderRadius: 10,
        border: `2px solid ${borderColor}`,
        background: isSelected ? `${activeColor}0d` : 'var(--bg-raised)',
        cursor: 'pointer', overflow: 'hidden',
        transition: 'border-color 0.15s, box-shadow 0.15s, background 0.15s',
        boxShadow: isSelected ? `0 0 0 3px ${activeColor}30, 0 4px 16px rgba(0,0,0,0.12)` : '0 1px 4px rgba(0,0,0,0.06)',
        opacity: isMapped ? 0.65 : 1,
      }}
    >
      {/* Type badge */}
      <div style={{
        position: 'absolute', top: 8, left: 8, zIndex: 5,
        padding: '2px 7px', borderRadius: 5,
        background: type === 'SLIP' ? 'rgba(16,185,129,0.85)' : 'rgba(59,130,246,0.85)',
        color: '#fff', fontSize: 9, fontWeight: 800, letterSpacing: '0.04em',
      }}>
        {type}
      </div>

      {/* Already-mapped badge */}
      {isMapped && mappedLabel && (
        <div style={{
          position: 'absolute', top: 8, right: 8, zIndex: 5,
          padding: '2px 7px', borderRadius: 5, background: mappedColor!, color: '#fff',
          fontSize: 9, fontWeight: 700, maxWidth: 90,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          → {mappedLabel}
        </div>
      )}

      {/* Image */}
      <div style={{ width: '100%', height: 150, background: 'var(--bg-subtle)', overflow: 'hidden' }}>
        <img
          src={url}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          alt={label}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
      </div>

      {/* Footer */}
      <div style={{ padding: '8px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, color: isSelected ? activeColor : 'var(--fg-muted)', fontWeight: isSelected ? 600 : 400 }}>
          {subLabel}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 9, color: 'var(--fg-faint)' }}>dbl-click to preview</span>
        </div>
      </div>

      {/* Selected checkmark */}
      {isSelected && (
        <div style={{
          position: 'absolute', top: 8, right: 8, zIndex: 6,
          background: activeColor, color: '#fff', borderRadius: '50%',
          width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
        }}>
          <Icon name="check" size={14} />
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function SlipMappingModal({ isOpen, onClose, onSuccess, batchNo, allCheques, globalSlips, globalSlipEntryId, slips }: Props) {
  const [selectedChqIds, setSelectedChqIds] = useState<Set<number>>(new Set());
  const [selectedSlipItemIds, setSelectedSlipItemIds] = useState<Set<number>>(new Set());
  const [targetSlipId, setTargetSlipId] = useState<number | null>(null);
  const [viewingImage, setViewingImage] = useState<{ url: string; label: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [showCloseWarning, setShowCloseWarning] = useState(false);
  // Track which slipItems have been mapped in this session (for progress)
  const [sessionMappedSlipItemIds, setSessionMappedSlipItemIds] = useState<Set<number>>(new Set());
  const [sessionMappedChqIds, setSessionMappedChqIds] = useState<Set<number>>(new Set());

  const slipColorMap = useMemo(() => {
    const map = new Map<number, string>();
    slips.forEach((s, idx) => map.set(s.slipEntryId, slipColor(idx)));
    return map;
  }, [slips]);

  const activeColor = targetSlipId ? (slipColorMap.get(targetSlipId) ?? '#3b82f6') : '#3b82f6';

  const slipItemMappedTo = useMemo(() => {
    const map = new Map<number, number>();
    slips.forEach(s => s.slipItems?.forEach(si => map.set(si.slipItemId, s.slipEntryId)));
    return map;
  }, [slips]);

  const chequeMappedTo = useMemo(() => {
    const map = new Map<number, number>();
    slips.forEach(s => s.cheques?.forEach(c => map.set(c.chequeItemId, s.slipEntryId)));
    return map;
  }, [slips]);

  const unmappedCheques = useMemo(() => {
    if (globalSlipEntryId === null) return [];
    return allCheques.filter(c => c.slipEntryId === globalSlipEntryId);
  }, [allCheques, globalSlipEntryId]);

  const totalImages = globalSlips.length + unmappedCheques.length;
  const alreadyMapped = [...globalSlips].filter(s => slipItemMappedTo.has(s.slipItemId)).length
    + [...unmappedCheques].filter(c => chequeMappedTo.has(c.chequeItemId)).length;
  const sessionMapped = sessionMappedSlipItemIds.size + sessionMappedChqIds.size;
  const stillUnmapped = totalImages - alreadyMapped - sessionMapped;
  const progressPct = totalImages === 0 ? 100 : Math.round(((alreadyMapped + sessionMapped) / totalImages) * 100);

  const totalSelected = selectedChqIds.size + selectedSlipItemIds.size;

  // Which step is the user on?
  // 1 = nothing selected yet, 2 = images selected but no slip chosen, 3 = ready to map
  const step = totalSelected === 0 ? 1 : (!targetSlipId ? 2 : 3);

  const toggleChq = useCallback((id: number) => {
    setSelectedChqIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleSlip = useCallback((id: number) => {
    setSelectedSlipItemIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleMapAndNext = async () => {
    if (!targetSlipId || totalSelected === 0) return;
    setSaving(true);
    try {
      const chqIds = Array.from(selectedChqIds);
      const slipIds = Array.from(selectedSlipItemIds);
      await mapImagesToSlip(chqIds, slipIds, targetSlipId);
      toast.success(`${totalSelected} image${totalSelected !== 1 ? 's' : ''} mapped to slip`);
      // Track session progress
      setSessionMappedSlipItemIds(prev => { const n = new Set(prev); slipIds.forEach(id => n.add(id)); return n; });
      setSessionMappedChqIds(prev => { const n = new Set(prev); chqIds.forEach(id => n.add(id)); return n; });
      // Clear selection, keep target slip selected for next batch of images
      setSelectedChqIds(new Set());
      setSelectedSlipItemIds(new Set());
      onSuccess();
    } catch {
      toast.error('Failed to map images');
    } finally {
      setSaving(false);
    }
  };

  const handleClose = () => {
    if (stillUnmapped > 0) {
      setShowCloseWarning(true);
    } else {
      onClose();
    }
  };

  const confirmClose = () => {
    setShowCloseWarning(false);
    onClose();
  };

  if (!isOpen) return null;

  const targetSlip = slips.find(s => s.slipEntryId === targetSlipId);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', height: 56, borderBottom: '1px solid var(--border)',
        background: 'var(--bg-raised)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={handleClose}
            style={{
              width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)',
              background: 'transparent', color: 'var(--fg-muted)', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <Icon name="arrow_back" size={18} />
          </button>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--fg)', lineHeight: 1.2 }}>
              Slip Mapping — {batchNo}
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-faint)' }}>
              {totalImages} global image{totalImages !== 1 ? 's' : ''} · {progressPct}% mapped
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div style={{ flex: 1, maxWidth: 280, margin: '0 32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--fg-faint)' }}>
              {alreadyMapped + sessionMapped} of {totalImages} mapped
            </span>
            {stillUnmapped > 0 && (
              <span style={{ fontSize: 10, color: '#f59e0b', fontWeight: 600 }}>
                {stillUnmapped} remaining
              </span>
            )}
          </div>
          <div style={{ height: 6, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 3,
              background: progressPct === 100 ? '#10b981' : '#3b82f6',
              width: `${progressPct}%`,
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        <button
          onClick={handleClose}
          style={{
            padding: '0 20px', height: 34, borderRadius: 8,
            border: '1px solid var(--border)', background: 'transparent',
            color: 'var(--fg-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
          }}
        >
          {stillUnmapped === 0 ? 'Close' : 'Close'}
        </button>
      </div>

      {/* ── Step guide bar ──────────────────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 0,
        padding: '10px 20px', background: 'var(--bg-subtle)',
        borderBottom: '1px solid var(--border)', flexShrink: 0,
      }}>
        {[
          { n: 1, label: 'Select images from the bucket', icon: 'touch_app', done: step > 1 },
          { n: 2, label: 'Choose a target slip on the right', icon: 'playlist_add_check', done: step > 2 },
          { n: 3, label: 'Click "Map & Next" to link', icon: 'link', done: false },
        ].map((s, i) => {
          const isActive = step === s.n;
          const isDone = s.done;
          return (
            <React.Fragment key={s.n}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '4px 16px',
                borderRadius: 20,
                background: isActive ? `${activeColor}18` : 'transparent',
                border: isActive ? `1px solid ${activeColor}50` : '1px solid transparent',
                transition: 'all 0.2s',
              }}>
                <div style={{
                  width: 22, height: 22, borderRadius: '50%', flexShrink: 0,
                  background: isDone ? '#10b981' : (isActive ? activeColor : 'var(--border)'),
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isDone
                    ? <Icon name="check" size={13} style={{ color: '#fff' }} />
                    : <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? '#fff' : 'var(--fg-faint)' }}>{s.n}</span>
                  }
                </div>
                <span style={{ fontSize: 12, fontWeight: isActive ? 600 : 400, color: isActive ? 'var(--fg)' : 'var(--fg-faint)', whiteSpace: 'nowrap' }}>
                  {s.label}
                </span>
              </div>
              {i < 2 && (
                <div style={{ width: 24, height: 1, background: 'var(--border)', flexShrink: 0 }} />
              )}
            </React.Fragment>
          );
        })}

        {/* Floating action — only shown when step 3 */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {step === 3 && targetSlip && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '4px 12px', borderRadius: 20,
              background: `${activeColor}18`, border: `1px solid ${activeColor}60`,
              fontSize: 12, color: 'var(--fg)', fontWeight: 500,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: activeColor, flexShrink: 0 }} />
              <span>{totalSelected} img{totalSelected !== 1 ? 's' : ''}</span>
              <Icon name="arrow_forward" size={14} style={{ color: activeColor }} />
              <span style={{ fontWeight: 700, color: activeColor }}>{targetSlip.depositSlipNo || targetSlip.slipNo}</span>
            </div>
          )}
          <button
            onClick={handleMapAndNext}
            disabled={saving || step < 3}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '0 20px', height: 34, borderRadius: 8, border: 'none',
              background: step === 3 ? activeColor : 'var(--bg-subtle)',
              color: step === 3 ? '#fff' : 'var(--fg-faint)',
              fontWeight: 700, fontSize: 13, cursor: step === 3 ? 'pointer' : 'not-allowed',
              transition: 'all 0.2s', opacity: saving ? 0.7 : 1,
              boxShadow: step === 3 ? `0 2px 10px ${activeColor}50` : 'none',
            }}
          >
            <Icon name="link" size={16} />
            {saving ? 'Mapping...' : 'Map & Next'}
          </button>
        </div>
      </div>

      {/* ── Main body ───────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

        {/* Left: Image bucket */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Bucket header */}
          <div style={{
            padding: '10px 20px', borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Global Bucket
              </span>
              <span style={{
                padding: '1px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                background: totalImages > 0 ? '#3b82f614' : 'var(--bg-subtle)',
                color: totalImages > 0 ? '#3b82f6' : 'var(--fg-faint)',
                border: `1px solid ${totalImages > 0 ? '#3b82f630' : 'var(--border)'}`,
              }}>
                {totalImages} images
              </span>
            </div>
            {totalSelected > 0 && (
              <button
                onClick={() => { setSelectedChqIds(new Set()); setSelectedSlipItemIds(new Set()); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--fg-faint)', fontSize: 12, cursor: 'pointer' }}
              >
                Clear selection
              </button>
            )}
          </div>

          {/* Grid */}
          <div style={{
            flex: 1, padding: '16px 20px', overflowY: 'auto',
            display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 14, alignContent: 'start',
          }}>
            {globalSlips.filter(s => !sessionMappedSlipItemIds.has(s.slipItemId)).map(s => {
              const isSel = selectedSlipItemIds.has(s.slipItemId);
              const mappedTo = slipItemMappedTo.get(s.slipItemId);
              const mappedColor = mappedTo !== undefined ? (slipColorMap.get(mappedTo) ?? null) : null;
              const mappedSlip = mappedTo !== undefined ? slips.find(sl => sl.slipEntryId === mappedTo) : null;
              const mappedLabel = mappedSlip?.depositSlipNo || mappedSlip?.slipNo || null;
              return (
                <ImageCard
                  key={`slip-${s.slipItemId}`}
                  url={getSlipImageUrl(s)}
                  label={`Slip Image ${s.scanOrder}`}
                  type="SLIP"
                  subLabel={`Order #${s.scanOrder}`}
                  isSelected={isSel}
                  mappedColor={mappedColor}
                  mappedLabel={mappedLabel}
                  activeColor={activeColor}
                  onToggle={() => toggleSlip(s.slipItemId)}
                  onPreview={() => setViewingImage({ url: getSlipImageUrl(s), label: `Slip Image #${s.scanOrder}` })}
                />
              );
            })}
            {unmappedCheques.filter(c => !sessionMappedChqIds.has(c.chequeItemId)).map(c => {
              const isSel = selectedChqIds.has(c.chequeItemId);
              const mappedTo = chequeMappedTo.get(c.chequeItemId);
              const mappedColor = mappedTo !== undefined ? (slipColorMap.get(mappedTo) ?? null) : null;
              const mappedSlip = mappedTo !== undefined ? slips.find(sl => sl.slipEntryId === mappedTo) : null;
              const mappedLabel = mappedSlip?.depositSlipNo || mappedSlip?.slipNo || null;
              return (
                <ImageCard
                  key={`chq-${c.chequeItemId}`}
                  url={getChequeImageUrl(c, 'front')}
                  label={`Cheque Seq ${c.seqNo}`}
                  type="CHEQUE"
                  subLabel={`Seq #${c.seqNo}`}
                  isSelected={isSel}
                  mappedColor={mappedColor}
                  mappedLabel={mappedLabel}
                  activeColor={activeColor}
                  onToggle={() => toggleChq(c.chequeItemId)}
                  onPreview={() => setViewingImage({ url: getChequeImageUrl(c, 'front'), label: `Cheque Seq #${c.seqNo}` })}
                />
              );
            })}

            {totalImages === 0 && (
              <div style={{ gridColumn: '1 / -1', padding: '80px 0', textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', background: '#10b98122',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                }}>
                  <Icon name="check_circle" size={32} style={{ color: '#10b981' }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)', marginBottom: 6 }}>All images mapped</div>
                <div style={{ fontSize: 13, color: 'var(--fg-faint)' }}>Every global image has been linked to a slip entry.</div>
              </div>
            )}

            {totalImages > 0 && sessionMappedSlipItemIds.size + sessionMappedChqIds.size === totalImages && (
              <div style={{ gridColumn: '1 / -1', padding: '80px 0', textAlign: 'center' }}>
                <div style={{
                  width: 56, height: 56, borderRadius: '50%', background: '#10b98122',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
                }}>
                  <Icon name="task_alt" size={32} style={{ color: '#10b981' }} />
                </div>
                <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--fg)', marginBottom: 6 }}>All done!</div>
                <div style={{ fontSize: 13, color: 'var(--fg-faint)' }}>All {totalImages} images have been mapped this session.</div>
                <button
                  onClick={onClose}
                  style={{
                    marginTop: 20, padding: '10px 28px', borderRadius: 8, border: 'none',
                    background: '#10b981', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    boxShadow: '0 2px 12px #10b98140',
                  }}
                >
                  Close workspace
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right: Target slip panel */}
        <div style={{
          width: 300, background: 'var(--bg-raised)', display: 'flex', flexDirection: 'column',
          borderLeft: '1px solid var(--border)',
        }}>
          <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Target Slips
            </div>
            <div style={{ fontSize: 11, color: 'var(--fg-faint)', marginTop: 2 }}>
              Click a slip to set it as the mapping target
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {slips.length === 0 && (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--fg-faint)', fontSize: 12 }}>
                No slip entries in this batch.
              </div>
            )}

            {!targetSlipId && slips.length > 0 && (
              <div style={{
                padding: '10px 12px', borderRadius: 8, marginBottom: 4,
                background: '#f59e0b12', border: '1px dashed #f59e0b60',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <Icon name="arrow_downward" size={16} style={{ color: '#f59e0b' }} />
                <span style={{ fontSize: 12, color: '#f59e0b', fontWeight: 500 }}>
                  {totalSelected > 0 ? 'Now pick a slip below' : 'Select images first, then pick a slip'}
                </span>
              </div>
            )}

            {slips.map((s, idx) => {
              const isActive = targetSlipId === s.slipEntryId;
              const color = slipColor(idx);
              const mappedSlipImgs = s.slipItems?.length || 0;
              const mappedChqs = s.cheques?.length || 0;

              return (
                <div
                  key={s.slipEntryId}
                  onClick={() => setTargetSlipId(isActive ? null : s.slipEntryId)}
                  style={{
                    borderRadius: 10, cursor: 'pointer',
                    border: `2px solid ${isActive ? color : 'var(--border)'}`,
                    background: isActive ? `${color}10` : 'var(--bg)',
                    transition: 'all 0.15s',
                    boxShadow: isActive ? `0 0 0 3px ${color}25, 0 2px 8px rgba(0,0,0,0.06)` : 'none',
                    overflow: 'hidden',
                  }}
                >
                  {/* Color bar */}
                  <div style={{ height: 3, background: color, width: '100%' }} />

                  <div style={{ padding: '10px 12px' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: isActive ? color : 'var(--fg)' }}>
                          {s.depositSlipNo || s.slipNo}
                        </div>
                        {s.slipNo && s.depositSlipNo && (
                          <div style={{ fontSize: 10, color: 'var(--fg-faint)', marginTop: 1 }}>Slip: {s.slipNo}</div>
                        )}
                      </div>
                      {isActive && (
                        <div style={{
                          padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 700,
                          background: color, color: '#fff', flexShrink: 0,
                        }}>
                          TARGET
                        </div>
                      )}
                    </div>

                    <div style={{ fontSize: 11, color: 'var(--fg-muted)', marginTop: 4 }}>
                      {s.clientName || s.clientCode || 'No client'}
                    </div>

                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '2px 7px', borderRadius: 6,
                        background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                      }}>
                        <Icon name="receipt" size={11} style={{ color: 'var(--fg-faint)' }} />
                        <span style={{ fontSize: 10, color: 'var(--fg-muted)' }}>{mappedSlipImgs} slip img{mappedSlipImgs !== 1 ? 's' : ''}</span>
                      </div>
                      <div style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '2px 7px', borderRadius: 6,
                        background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                      }}>
                        <Icon name="payments" size={11} style={{ color: 'var(--fg-faint)' }} />
                        <span style={{ fontSize: 10, color: 'var(--fg-muted)' }}>{mappedChqs}/{s.totalInstruments} chqs</span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Fullscreen image preview ─────────────────────────────────────────── */}
      {viewingImage && (
        <FullscreenPreview
          url={viewingImage.url}
          label={viewingImage.label}
          onClose={() => setViewingImage(null)}
        />
      )}

      {/* ── Close warning ────────────────────────────────────────────────────── */}
      {showCloseWarning && (
        <CloseWarningDialog
          unmappedCount={stillUnmapped}
          onConfirm={confirmClose}
          onCancel={() => setShowCloseWarning(false)}
        />
      )}
    </div>
  );
}

// ── Fullscreen preview ────────────────────────────────────────────────────────
function FullscreenPreview({ url, label, onClose }: { url: string; label: string; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.min(4, Math.max(0.5, z - e.deltaY * 0.001)));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX - offset.x, y: e.clientY - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 11000, background: 'rgba(0,0,0,0.96)', display: 'flex', flexDirection: 'column' }}
      onWheel={handleWheel}
    >
      {/* Preview header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)',
      }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => { setZoom(1); setOffset({ x: 0, y: 0 }); }}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 12px', cursor: 'pointer', fontSize: 12 }}
          >
            Reset
          </button>
          <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.15)' }}>
            <button onClick={() => setZoom(z => Math.max(0.5, z - 0.25))} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 12px', cursor: 'pointer' }}>
              <Icon name="remove" size={16} />
            </button>
            <div style={{ padding: '6px 12px', background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 12, minWidth: 50, textAlign: 'center' }}>
              {Math.round(zoom * 100)}%
            </div>
            <button onClick={() => setZoom(z => Math.min(4, z + 0.25))} style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', padding: '6px 12px', cursor: 'pointer' }}>
              <Icon name="add" size={16} />
            </button>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', borderRadius: 6, padding: '6px 14px', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
          >
            Close
          </button>
        </div>
      </div>

      {/* Image area */}
      <div
        style={{ flex: 1, overflow: 'hidden', position: 'relative', cursor: dragging ? 'grabbing' : 'grab' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={() => setDragging(false)}
        onMouseLeave={() => setDragging(false)}
      >
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <img
            src={url}
            draggable={false}
            style={{
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: dragging ? 'none' : 'transform 0.15s ease-out',
              maxWidth: '90vw', maxHeight: '85vh',
              boxShadow: '0 8px 60px rgba(0,0,0,0.6)',
              borderRadius: 4,
              userSelect: 'none',
            }}
            alt={label}
          />
        </div>
      </div>

      {/* Hint */}
      <div style={{ padding: '8px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.3)', fontSize: 11 }}>
        Scroll to zoom · Drag to pan · Double-click image to close
      </div>
    </div>
  );
}
