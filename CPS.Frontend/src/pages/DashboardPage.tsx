// =============================================================================
// File        : DashboardPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Dashboard
// Description : KPI tiles + batch table matching CPS design system exactly.
// Created     : 2026-04-14
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBatchList, getDashboard } from '../services/batchService';
import { useAuthStore } from '../store/authStore';
import { BatchDto, BatchStatus, BatchStatusLabels, DashboardSummary } from '../types';
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

type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger' | 'accent' | 'outline';

function Chip({ tone = 'neutral' as Tone, children }: { tone?: Tone; children: React.ReactNode }) {
  const styles: Record<Tone, { bg: string; color: string; border: string }> = {
    neutral: { bg: 'var(--bg-subtle)',  color: 'var(--fg-muted)',  border: 'var(--border)' },
    info:    { bg: 'var(--info-bg)',    color: 'var(--info)',      border: 'transparent' },
    success: { bg: 'var(--success-bg)', color: 'var(--success)',  border: 'transparent' },
    warning: { bg: 'var(--warning-bg)', color: 'var(--warning)',  border: 'transparent' },
    danger:  { bg: 'var(--danger-bg)',  color: 'var(--danger)',   border: 'transparent' },
    accent:  { bg: 'var(--accent-50)',  color: 'var(--accent-700)', border: 'transparent' },
    outline: { bg: 'transparent',       color: 'var(--fg-muted)', border: 'var(--border)' },
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
    outline: 'var(--fg-faint)',
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

function getAction(b: BatchDto): { label: string; path: string } | null {
  switch (b.batchStatus) {
    case BatchStatus.Created:            return { label: 'Start',    path: `/batch/${b.batchID}/details` };
    case BatchStatus.ScanningInProgress:
    case BatchStatus.ScanningPending:    return { label: 'Continue', path: `/batch/${b.batchID}/details` };
    case BatchStatus.RRPending:          return { label: 'Repair',   path: `/rr/${b.batchID}` };
    default:                             return null;
  }
}

function fmtAmount(n: number) {
  return n === 0 ? '—' : '₹' + n.toLocaleString('en-IN');
}

// ── skeleton ──────────────────────────────────────────────────────────────────

function SkeletonDashboard() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16 }}>
        {[...Array(4)].map((_, i) => (
          <div key={i} style={{
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)', height: 108,
          }} className="animate-pulse" />
        ))}
      </div>
      <div style={{
        background: 'var(--bg-raised)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', height: 320,
      }} className="animate-pulse" />
    </div>
  );
}

// ── page ──────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [batches, setBatches] = useState<BatchDto[]>([]);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [batchRes, summaryRes] = await Promise.all([
        getBatchList({ locationId: user.locationId, date: user.eodDate, page, pageSize: 20 }),
        getDashboard(user.locationId, user.eodDate),
      ]);
      setBatches(batchRes.items);
      setTotalPages(batchRes.totalPages);
      setSummary(summaryRes);
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [user, page]);

  useEffect(() => { load(); }, [load]);

  const eodDate = user?.eodDate
    ? new Date(user.eodDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    : '';

  const canCreateBatch = user?.roles.some(r => ['Scanner', 'MobileScanner', 'Admin', 'Developer'].includes(r));

  const kpis = [
    { label: 'Batches today',    value: summary?.totalBatchesToday ?? 0, delta: 'Total for today',    tone: 'neutral' as Tone, icon: 'receipt_long' },
    { label: 'Scanning pending', value: summary?.scanningPending ?? 0,   delta: 'Awaiting scan',      tone: 'warning' as Tone, icon: 'hourglass_top' },
    { label: 'RR queue',         value: summary?.rrPending ?? 0,         delta: 'Needs review',       tone: 'danger'  as Tone, icon: 'build' },
    { label: 'Completed',        value: summary?.completed ?? 0,         delta: 'Cleared today',      tone: 'success' as Tone, icon: 'task_alt' },
  ];

  const filtered = search.trim()
    ? batches.filter(b =>
        b.batchNo.toLowerCase().includes(search.toLowerCase()) ||
        (b.scannerID ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : batches;

  if (loading) return <SkeletonDashboard />;

  return (
    <div>
      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--fg)' }}>
            Dashboard
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--fg-muted)' }}>
            {user?.locationName} · EOD{' '}
            <span style={{ fontFamily: 'var(--font-mono)' }}>
              {new Date(user?.eodDate ?? '').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
            </span>
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {canCreateBatch && (
            <button
              style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '9px 16px', height: 38,
                background: 'var(--accent-500)', color: 'var(--fg-on-accent)',
                border: '1px solid var(--accent-600)',
                borderRadius: 'var(--r-md)',
                fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)',
                cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'background-color var(--dur-fast) var(--ease)',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--accent-600)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--accent-500)')}
              onClick={() => navigate('/batch/create')}
            >
              <Icon name="add" size={16} weight={500} />
              New batch
            </button>
          )}
        </div>
      </div>

      {/* KPI tiles */}
      <div className="kpi-grid">
        {kpis.map((k, i) => (
          <div key={i} style={{
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            borderRadius: 'var(--r-lg)', padding: 18,
            display: 'flex', flexDirection: 'column', gap: 12,
            boxShadow: 'var(--shadow-xs)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-muted)', textTransform: 'uppercase', letterSpacing: '.04em', fontWeight: 500 }}>
                {k.label}
              </span>
              <div style={{
                width: 28, height: 28, borderRadius: 'var(--r-md)',
                background: 'var(--bg-subtle)', color: 'var(--fg-subtle)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon name={k.icon} size={16} />
              </div>
            </div>
            <div style={{ fontSize: 'var(--text-3xl)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1, color: 'var(--fg)' }}>
              {k.value}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 'var(--text-xs)', color: 'var(--fg-muted)' }}>
              <Dot tone={k.tone} />
              <span>{k.delta}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Batch table card */}
      <div style={{
        background: 'var(--bg-raised)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)',
        overflow: 'hidden',
      }}>
        {/* Header bar */}
        <div className="table-header-bar" style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h2 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--fg)', whiteSpace: 'nowrap' }}>
              Today's batches
            </h2>
            <Chip tone="outline">{batches.length} total</Chip>
          </div>
          <div style={{ flex: 1 }} />
          {/* Search */}
          <div className="table-header-search" style={{ width: 260, position: 'relative' }}>
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
            className="table-header-filter"
            title="Filters"
            style={{
              width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              background: 'transparent', color: 'var(--fg-muted)',
              border: '1px solid transparent', borderRadius: 'var(--r-md)',
              cursor: 'pointer', transition: 'background-color var(--dur-fast) var(--ease)',
              flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--bg-hover)'; e.currentTarget.style.color = 'var(--fg)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-muted)'; }}
          >
            <Icon name="tune" size={20} />
          </button>
        </div>

        {/* Table */}
        <div className="table-scroll">
          {filtered.length === 0 ? (
            <div style={{ padding: '48px 20px', textAlign: 'center', fontSize: 'var(--text-sm)', color: 'var(--fg-subtle)' }}>
              No batches today. Create one to get started.
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
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
                  const action = getAction(b);
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
                        {action ? (
                          <button
                            onClick={() => navigate(action.path)}
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
                            {action.label}
                            <Icon name="arrow_forward" size={16} weight={500} />
                          </button>
                        ) : (
                          <Icon name="check_circle" size={16} style={{ color: 'var(--success)' }} />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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
