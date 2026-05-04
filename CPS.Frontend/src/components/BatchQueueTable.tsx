// =============================================================================
// File        : BatchQueueTable.tsx
// Project     : CPS — Cheque Processing System
// Module      : Shared
// Description : Reusable batch queue table for Maker, Checker, and QC list pages.
// Created     : 2026-05-03
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBatchList } from '../services/batchService';
import { useAuthStore } from '../store/authStore';
import { BatchDto, BatchStatus, BatchStatusLabels } from '../types';
import { toast } from '../store/toastStore';
import { todayIST } from '../utils/dateUtils';

// ── Icons & Chips (Mirrored from RRListPage for consistency) ──────────────────

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

const STATUS_TONE: Record<number, Tone> = { 
  0: 'neutral', 1: 'info', 2: 'warning', 3: 'success', 4: 'danger', 5: 'success', 6: 'warning',
  7: 'neutral', 8: 'info', 9: 'success',
  10: 'neutral', 11: 'info', 12: 'success',
  13: 'neutral', 14: 'info', 15: 'success',
};

function fmtAmount(n: number) {
  return n === 0 ? '—' : '₹' + n.toLocaleString('en-IN');
}

// ── BatchQueueTable Component ────────────────────────────────────────────────

interface Props {
  title: string;
  statuses: number[];
  actionLabel: string;
  actionPath: string; // e.g. "/maker"
  lockField: 'makerLockedBy' | 'checkerLockedBy' | 'qcLockedBy';
  lockNameField: 'makerLockedByName' | 'checkerLockedByName' | 'qcLockedByName';
  emptyMessage: string;
}

export function BatchQueueTable({ title, statuses, actionLabel, actionPath, lockField, lockNameField, emptyMessage }: Props) {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [batches, setBatches] = useState<BatchDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [date, setDate] = useState(todayIST);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);

  const isAdminOrDev = user?.roles?.some(r => ['Admin', 'Developer'].includes(r));

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await getBatchList({
        locationId: isAdminOrDev ? undefined : user.locationId,
        date,
        page,
        pageSize: 100
      });
      const filteredBatches = res.items.filter(b => statuses.includes(b.batchStatus));
      setBatches(filteredBatches);
      setTotalPages(res.totalPages);
    } catch {
      toast.error(`Failed to load ${title}`);
    } finally {
      setLoading(false);
    }
  }, [user, page, date, statuses, title, isAdminOrDev]);

  useEffect(() => { load(); }, [load]);

  const filtered = search.trim()
    ? batches.filter(b =>
        b.batchNo.toLowerCase().includes(search.toLowerCase()) ||
        (b.scannerID ?? '').toLowerCase().includes(search.toLowerCase())
      )
    : batches;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '300px' }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-muted)' }}>Loading {title}...</div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0, height: '100%' }}>
      <div style={{
        background: 'var(--bg-raised)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)',
        overflow: 'hidden', flex: 1, display: 'flex', flexDirection: 'column',
      }}>
        <div className="table-header-bar">
          <div className="table-header-title-row">
            <h2 style={{ margin: 0, fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--fg)', whiteSpace: 'nowrap' }}>
              {title}
            </h2>
            <Chip tone={batches.length > 0 ? 'accent' : 'neutral'}>{batches.length} pending</Chip>
          </div>
          
          <div className="table-header-actions-row">
            <div className="table-header-search">
              <Icon name="search" size={16} style={{
                position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                color: 'var(--fg-subtle)', pointerEvents: 'none',
              }} />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search batch no…"
                onFocus={() => setSearchFocus(true)}
                onBlur={() => setSearchFocus(false)}
                className="input-field"
                style={{ paddingLeft: 32 }}
              />
            </div>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Icon name="calendar_today" size={16} style={{
                position: 'absolute', left: 10, color: 'var(--fg-subtle)', pointerEvents: 'none',
              }} />
              <input
                type="date"
                value={date}
                onChange={e => { setDate(e.target.value); setPage(1); }}
                className="input-field"
                style={{ paddingLeft: 32, width: 160 }}
              />
            </div>
          </div>
        </div>

        <div className="table-scroll" style={{ flex: 1, overflow: 'auto' }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '64px 20px', textAlign: 'center' }}>
              <Icon name="inbox" size={48} style={{ color: 'var(--fg-faint)', marginBottom: 16 }} />
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--fg-subtle)' }}>{emptyMessage}</div>
            </div>
          ) : (
            <table className="table-desktop" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-sm)' }}>
              <thead>
                <tr style={{ textAlign: 'left', background: 'var(--bg)' }}>
                  {['Batch no', 'Scanner', 'Slips', 'Amount', 'Status', 'Locked By', ''].map((h, i) => (
                    <th key={i} style={{
                      padding: '10px 20px', fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)',
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
                  const lockedBy = b[lockField];
                  const lockedByName = b[lockNameField];
                  const isLockedByOther = !!lockedBy && lockedBy !== user?.userId;

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
                      <td style={{ padding: '14px 20px', color: 'var(--fg-muted)' }}>{b.scannerID ?? '—'}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right' }}>{b.totalSlips || '—'}</td>
                      <td style={{ padding: '14px 20px', textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{fmtAmount(b.totalAmount)}</td>
                      <td style={{ padding: '14px 20px' }}>
                        <Chip tone={tone}>{BatchStatusLabels[b.batchStatus]}</Chip>
                      </td>
                      <td style={{ padding: '14px 20px', color: 'var(--fg-subtle)', fontSize: '12px' }}>
                        {lockedByName ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Icon name="lock" size={14} style={{ color: isLockedByOther ? 'var(--danger)' : 'var(--success)' }} />
                            <span>{lockedByName}</span>
                          </div>
                        ) : <span style={{ opacity: 0.3 }}>—</span>}
                      </td>
                      <td style={{ padding: '10px 20px', textAlign: 'right' }}>
                        <button
                          onClick={() => !isLockedByOther && navigate(`${actionPath}/${b.batchNo}`)}
                          disabled={isLockedByOther}
                          className="btn-primary"
                          style={{ 
                            height: 30, padding: '0 12px', fontSize: 12,
                            opacity: isLockedByOther ? 0.5 : 1,
                            background: isLockedByOther ? 'var(--bg-subtle)' : undefined,
                            color: isLockedByOther ? 'var(--fg-faint)' : undefined,
                            border: isLockedByOther ? '1px solid var(--border)' : undefined
                          }}
                        >
                          {isLockedByOther ? 'Locked' : actionLabel}
                          {!isLockedByOther && <Icon name="arrow_forward" size={14} />}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
