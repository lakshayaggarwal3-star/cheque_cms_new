// =============================================================================
// File        : ScanListPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Lists all scanning-pending batches for the current location/day.
// Created     : 2026-04-20
// =============================================================================

import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getBatchList } from '../services/batchService';
import { useAuthStore } from '../store/authStore';
import { BatchDto, BatchStatus, BatchStatusLabels } from '../types';
import { toast } from '../store/toastStore';

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  return (
    <span className="material-symbols-outlined" style={{
      fontSize: size,
      fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
      lineHeight: 1, userSelect: 'none', flexShrink: 0,
    }}>{name}</span>
  );
}

const STATUS_TONE: Record<number, { bg: string; color: string; border: string }> = {
  1: { bg: 'var(--info-bg)',    color: 'var(--info)',    border: 'transparent' },
  2: { bg: 'var(--warning-bg)', color: 'var(--warning)', border: 'transparent' },
};

function StatusChip({ status }: { status: number }) {
  const s = STATUS_TONE[status] ?? { bg: 'var(--bg-subtle)', color: 'var(--fg-muted)', border: 'var(--border)' };
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '4px 10px', borderRadius: 'var(--r-full)',
      fontSize: 'var(--text-xs)', fontWeight: 500,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      {BatchStatusLabels[status] ?? `Status ${status}`}
    </span>
  );
}

function SkeletonRows() {
  return (
    <>
      {[...Array(4)].map((_, i) => (
        <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
          {[...Array(6)].map((_, j) => (
            <td key={j} style={{ padding: '14px 20px' }}>
              <div style={{ height: 14, borderRadius: 6, background: 'var(--bg-subtle)' }} className="animate-pulse" />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function ScanListPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [batches, setBatches] = useState<BatchDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await getBatchList({ locationId: user.locationId, date: user.eodDate, pageSize: 100 });
      const pending = res.items.filter(b =>
        b.batchStatus === BatchStatus.ScanningInProgress || b.batchStatus === BatchStatus.ScanningPending
      );
      setBatches(pending);
    } catch {
      toast.error('Failed to load scanning queue');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 'var(--text-2xl)', fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--fg)' }}>
            Scanning Queue
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: 'var(--text-sm)', color: 'var(--fg-muted)' }}>
            Batches pending or in-progress scan — {user?.locationName}
          </p>
        </div>
        <button
          onClick={load}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', height: 36,
            background: 'var(--bg-raised)', color: 'var(--fg)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--r-md)',
            fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
          }}
        >
          <Icon name="refresh" size={15} />
          Refresh
        </button>
      </div>

      <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', boxShadow: 'var(--shadow-xs)', overflow: 'hidden' }}>
        <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="document_scanner" size={16} />
          <span style={{ fontSize: 'var(--text-md)', fontWeight: 600, color: 'var(--fg)' }}>Pending batches</span>
          <span style={{
            padding: '3px 8px', borderRadius: 'var(--r-full)', fontSize: 'var(--text-xs)', fontWeight: 500,
            background: 'var(--bg-subtle)', border: '1px solid var(--border)', color: 'var(--fg-muted)',
          }}>{batches.length}</span>
        </div>

        <div style={{ overflowX: 'auto' }}>
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
              {loading ? (
                <SkeletonRows />
              ) : batches.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: 'var(--fg-subtle)', fontSize: 'var(--text-sm)' }}>
                    No batches pending scan today.
                  </td>
                </tr>
              ) : batches.map(b => (
                <tr key={b.batchID} style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-subtle)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <td style={{ padding: '14px 20px' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 500, color: 'var(--fg)' }}>{b.batchNo}</span>
                  </td>
                  <td style={{ padding: '14px 20px', color: 'var(--fg-muted)' }}>{b.scannerID ?? '—'}</td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--fg)', fontVariantNumeric: 'tabular-nums' }}>{b.totalSlips || '—'}</td>
                  <td style={{ padding: '14px 20px', textAlign: 'right', color: 'var(--fg)', fontVariantNumeric: 'tabular-nums', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)' }}>
                    {b.totalAmount === 0 ? '—' : '₹' + b.totalAmount.toLocaleString('en-IN')}
                  </td>
                  <td style={{ padding: '14px 20px' }}><StatusChip status={b.batchStatus} /></td>
                  <td style={{ padding: '14px 20px', textAlign: 'right' }}>
                    <button
                      onClick={() => navigate(`/scan/${b.batchID}`)}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px', height: 30,
                        background: 'var(--accent-500)', color: 'var(--fg-on-accent)',
                        border: '1px solid var(--accent-600)',
                        borderRadius: 'var(--r-md)',
                        fontSize: 'var(--text-xs)', fontWeight: 500, fontFamily: 'var(--font-sans)',
                        cursor: 'pointer',
                      }}
                    >
                      Continue
                      <Icon name="arrow_forward" size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
