// =============================================================================
// File        : RRListPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : RR (Reject Repair)
// Description : Lists all RR-pending batches for the current location/day.
// Created     : 2026-04-20
// Refactored  : 2026-04-24 (Aligned with AllBatchesPage design)
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBatchList } from '../services/batchService';
import { useAuthStore } from '../store/authStore';
import { BatchDto, BatchStatus, BatchStatusLabels } from '../types';
import { toast } from '../store/toastStore';

// ── primitives ────────────────────────────────────────────────────────────────

function Icon({ name, size = 20, weight = 400, style }: {
  name: string; size?: number; weight?: number; style?: React.CSSProperties;
}) {
  return (
    <span className="material-symbols-outlined" style={{
      fontSize: size,
      fontVariationSettings: `'FILL' 0, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size}`,
      lineHeight: 1, userSelect: 'none', flexShrink: 0,
      ...style,
    }}>{name}</span>
  );
}

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent';

function Chip({ tone = 'neutral' as Tone, children }: { tone?: Tone; children: React.ReactNode }) {
  const styles: Record<Tone, { bg: string; color: string; border: string }> = {
    neutral: { bg: 'var(--bg-subtle)',  color: 'var(--fg-muted)',  border: 'var(--border)' },
    info:    { bg: 'var(--info-bg)',    color: 'var(--info)',      border: 'transparent' },
    success: { bg: 'var(--success-bg)', color: 'var(--success)',  border: 'transparent' },
    warning: { bg: 'var(--warning-bg)', color: 'var(--warning)',  border: 'transparent' },
    danger:  { bg: 'var(--danger-bg)',  color: 'var(--danger)',   border: 'transparent' },
    accent:  { bg: 'var(--accent-50)',  color: 'var(--accent-700)', border: 'transparent' },
  };
  const s = styles[tone];
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '4px 10px', borderRadius: 'var(--r-full)',
      fontSize: 'var(--text-xs)', fontWeight: 500,
      background: s.bg, color: s.color,
      border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>{children}</span>
  );
}

function Dot({ tone = 'neutral' as Tone }: { tone?: Tone }) {
  const colors: Record<Tone, string> = {
    neutral: 'var(--fg-faint)',
    info:    'var(--info)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    danger:  'var(--danger)',
    accent:  'var(--accent-500)',
  };
  return (
    <span style={{
      display: 'inline-block', width: 6, height: 6,
      borderRadius: '50%', background: colors[tone], flexShrink: 0,
    }} />
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────

const STATUS_TONE: Record<number, Tone> = { 0: 'neutral', 1: 'info', 2: 'warning', 3: 'success', 4: 'danger', 5: 'success' };

function fmtAmount(n: number) {
  return n === 0 ? '—' : '₹' + n.toLocaleString('en-IN');
}

// ── page ──────────────────────────────────────────────────────────────────────

export function RRListPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [batches, setBatches] = useState<BatchDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await getBatchList({ locationId: user.locationId, page, pageSize: 100 });
      const rrPending = res.items.filter(b => b.batchStatus === BatchStatus.RRPending);
      setBatches(rrPending);
      setTotalPages(res.totalPages);
    } catch {
      toast.error('Failed to load RR queue');
    } finally {
      setLoading(false);
    }
  }, [user, page]);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? batches.filter(b =>
        b.batchNo.toLowerCase().includes(search.toLowerCase()) ||
        (b.scannerID ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : batches;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-muted)' }}>Loading RR queue...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
      {/* Table card */}
      <div style={{
        background: 'var(--bg-raised)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)',
        overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column',
      }}>
        {/* Header bar */}
        <div className="table-header-bar">
          <div className="table-header-title-row">
            <h2 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--fg)', whiteSpace: 'nowrap' }}>
              Repair Pending
            </h2>
            <Chip tone={batches.length > 0 ? 'danger' : 'neutral'}>{batches.length} total</Chip>
          </div>
          
          <div className="table-header-actions-row">
            {/* Search */}
            <div className="table-header-search">
              <Icon name="search" size={16} style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--fg-subtle)', pointerEvents: 'none',
              }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search batch no or scanner…"
                onFocus={() => setSearchFocus(true)}
                onBlur={() => setSearchFocus(false)}
                style={{
                  width: '100%', boxSizing: 'border-box',
                  padding: '9px 12px 9px 32px',
                  background: 'var(--bg-input)', color: 'var(--fg)',
                  border: `1px solid ${searchFocus ? 'var(--accent-500)' : 'var(--border-strong)'}`,
                  borderRadius: 'var(--r-md)',
                  fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)',
                  outline: 'none',
                  boxShadow: searchFocus ? 'var(--shadow-focus)' : 'none',
                  transition: 'border-color var(--dur-fast) var(--ease), box-shadow var(--dur-fast) var(--ease)',
                }}
              />
            </div>
            {/* Filter icon button */}
            <button
              title="Filters"
              style={{
                width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                background: 'transparent', color: 'var(--fg-muted)',
                border: '1px solid var(--border)', borderRadius: 'var(--r-md)',
                cursor: 'pointer', transition: 'background-color var(--dur-fast) var(--ease)',
                flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--fg)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-muted)'; }}
            >
              <Icon name="tune" size={20} />
            </button>
          </div>
        </div>

        {/* Table/Cards */}
        <div className="table-scroll" style={{ flex: 1, overflow: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--fg-subtle)' }}>
              No batches pending repair today.
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <table className="table-desktop" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
                <thead>
                  <tr style={{ textAlign: 'left', background: 'var(--bg)' }}>
                    {['Batch no', 'Scanner', 'Slips', 'Amount', 'Status', ''].map((h, i) => (
                      <th key={i} style={{
                        padding: '10px 20px',
                        fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)',
                        fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em',
                        borderBottom: '1px solid var(--border)',
                        textAlign: ['Slips', 'Amount'].includes(h) ? 'right' : 'left',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(b => {
                    const tone = STATUS_TONE[b.batchStatus] ?? 'neutral';
                    return (
                      <tr key={b.batchID} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                      >
                        <td style={{ padding: '14px 20px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <Dot tone={tone} />
                            <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--fg)' }}>
                              {b.batchNo}
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '14px 20px', color: 'var(--fg-muted)' }}>
                          {b.scannerID ?? '—'}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--fg)', fontVariantNumeric: 'tabular-nums' }}>
                          {b.totalSlips || '—'}
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--fg)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                          {fmtAmount(b.totalAmount)}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <Chip tone={tone}>{BatchStatusLabels[b.batchStatus]}</Chip>
                        </td>
                        <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                          <button
                            onClick={() => navigate(`/rr/${b.batchID}`)}
                            style={{
                              display: 'inline-flex', alignItems: 'center', gap: 6,
                              padding: '6px 12px', height: 30,
                              background: 'transparent', color: 'var(--fg)',
                              border: '1px solid transparent',
                              borderRadius: 'var(--r-md)',
                              fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)',
                              cursor: 'pointer',
                              transition: 'background-color var(--dur-fast) var(--ease)',
                            }}
                            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                          >
                            Repair
                            <Icon name="arrow_forward" size={16} weight={500} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Mobile Cards */}
              <div className="mobile-batch-cards">
                {filtered.map(b => {
                  const tone = STATUS_TONE[b.batchStatus] ?? 'neutral';
                  return (
                    <div key={b.batchID} className="batch-card">
                      <div className="batch-card-header">
                        <div className="batch-card-no-group">
                          <Dot tone={tone} />
                          <span>{b.batchNo}</span>
                        </div>
                        <Chip tone={tone}>{BatchStatusLabels[b.batchStatus]}</Chip>
                      </div>
                      <div className="batch-card-grid">
                        <div className="batch-card-item">
                          <span className="batch-card-label">Scanner</span>
                          <span className="batch-card-value">{b.scannerID || '—'}</span>
                        </div>
                        <div className="batch-card-item" style={{ textAlign: 'right' }}>
                          <span className="batch-card-label">Slips</span>
                          <span className="batch-card-value">{b.totalSlips || '0'}</span>
                        </div>
                        <div className="batch-card-item">
                          <span className="batch-card-label">Amount</span>
                          <span className="batch-card-value" style={{ fontFamily: 'var(--font-mono)' }}>{fmtAmount(b.totalAmount)}</span>
                        </div>
                      </div>
                      <button className="batch-card-action" onClick={() => navigate(`/rr/${b.batchID}`)}>
                        Repair
                        <Icon name="arrow_forward" size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            borderTop: '1px solid var(--border)',
            display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: 16,
          }}>
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              style={{
                padding: '6px 12px', borderRadius: 'var(--r-md)',
                background: 'var(--bg-raised)', color: 'var(--fg)',
                border: '1px solid var(--border-strong)',
                fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)',
                cursor: page === 1 ? 'not-allowed' : 'pointer', opacity: page === 1 ? 0.4 : 1,
              }}
            >Prev</button>
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-muted)' }}>
              Page {page} of {totalPages}
            </span>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              style={{
                padding: '6px 12px', borderRadius: 'var(--r-md)',
                background: 'var(--bg-raised)', color: 'var(--fg)',
                border: '1px solid var(--border-strong)',
                fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)',
                cursor: page === totalPages ? 'not-allowed' : 'pointer', opacity: page === totalPages ? 0.4 : 1,
              }}
            >Next</button>
          </div>
        )}
      </div>
    </div>
  );
}
