// =============================================================================
// File        : ScanItemsTable.tsx
// Project     : CPS — Cheque Processing System
// Module      : Scanning — Scanned Items Review Table
// Description : Full-width table showing all scanned slip/cheque images with thumbnails, MICR data, and action buttons.
// Created     : 2026-04-19
// =============================================================================

import React, { useState } from 'react';
import { getImageUrl } from '../../utils/imageUtils';
import type { ScanSessionDto, SlipEntryDto, ChequeItemDto, SlipScanDto } from '../../types';
import { Icon } from './ScanPageUI';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScanItemsTableProps {
  session: ScanSessionDto;
  onImageSelect: (front: string, back?: string, type?: 'slip' | 'cheque') => void;
  onRescan?: (item: RescanTarget) => void;
  onDelete?: (item: DeleteTarget) => void;
}

type RescanTarget =
  | { kind: 'slip'; slipScanId: number; slipEntryId: number }
  | { kind: 'cheque'; chequeItemId: number; slipEntryId: number };

type DeleteTarget =
  | { kind: 'slip'; slipScanId: number }
  | { kind: 'cheque'; chequeItemId: number };

// ── ScanItemsTable ────────────────────────────────────────────────────────────

export function ScanItemsTable({ session, onImageSelect, onRescan, onDelete }: ScanItemsTableProps) {
  const [confirmDelete, setConfirmDelete] = useState<DeleteTarget | null>(null);

  const allGroups = session.slipGroups;
  const totalItems = allGroups.reduce((n, g) => n + g.slipScans.length + g.cheques.length, 0);

  if (totalItems === 0) return null;

  return (
    <div style={{ background: 'var(--bg)', borderTop: '2px solid var(--border)' }}>

      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 24px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-raised)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="photo_library" size={18} style={{ color: 'var(--fg-muted)' }} />
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg)' }}>
              Scanned Images
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', marginTop: 1 }}>
              Review all captured images — scroll down to see this panel
            </div>
          </div>
        </div>
        <span style={{
          padding: '3px 10px', borderRadius: 'var(--r-full)',
          fontSize: 'var(--text-xs)', fontWeight: 600,
          background: 'var(--bg-subtle)', border: '1px solid var(--border)',
          color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums',
        }}>
          {totalItems} item{totalItems !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
          <thead>
            <tr style={{ background: 'var(--bg-subtle)', borderBottom: '1px solid var(--border)' }}>
              <Th style={{ width: 180 }}>Image</Th>
              <Th style={{ width: 60 }}>Type</Th>
              <Th style={{ width: 70 }}>Seq</Th>
              <Th>Slip Ref</Th>
              <Th>Client</Th>
              <Th>MICR / Notes</Th>
              <Th style={{ width: 80 }}>Amount</Th>
              <Th style={{ width: 70 }}>Status</Th>
              <Th style={{ width: 96 }}>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {allGroups.map(group => (
              <GroupRows
                key={group.slipEntryId}
                group={group}
                onImageSelect={onImageSelect}
                onRescan={onRescan}
                onDelete={id => setConfirmDelete(id)}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Delete confirmation */}
      {confirmDelete && (
        <DeleteConfirmBanner
          target={confirmDelete}
          onConfirm={() => {
            onDelete?.(confirmDelete);
            setConfirmDelete(null);
          }}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </div>
  );
}

// ── GroupRows ─────────────────────────────────────────────────────────────────

function GroupRows({ group, onImageSelect, onRescan, onDelete }: {
  group: SlipEntryDto;
  onImageSelect: (front: string, back?: string, type?: 'slip' | 'cheque') => void;
  onRescan?: (item: RescanTarget) => void;
  onDelete: (item: DeleteTarget) => void;
}) {
  return (
    <>
      {/* Group separator row */}
      <tr>
        <td colSpan={9} style={{
          padding: '6px 16px',
          background: 'var(--bg-raised)',
          borderBottom: '1px solid var(--border-subtle)',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="receipt" size={13} style={{ color: 'var(--fg-muted)' }} />
            <span style={{ fontWeight: 600, color: 'var(--fg)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)' }}>
              {group.depositSlipNo || group.slipNo}
            </span>
            {group.clientName && (
              <span style={{ color: 'var(--fg-subtle)' }}>— {group.clientName}</span>
            )}
            <span style={{ color: 'var(--fg-faint)', marginLeft: 'auto', fontSize: 10 }}>
              ₹{group.slipAmount.toLocaleString('en-IN')} · {group.cheques.length} chq · {group.slipScans.length} slip img
            </span>
          </div>
        </td>
      </tr>

      {/* Slip scan rows */}
      {group.slipScans.map((scan, idx) => (
        <SlipScanRow
          key={scan.slipScanId}
          scan={scan}
          idx={idx}
          group={group}
          onImageSelect={onImageSelect}
          onRescan={onRescan}
          onDelete={onDelete}
        />
      ))}

      {/* Cheque rows */}
      {group.cheques.map(cheque => (
        <ChequeRow
          key={cheque.chequeItemId}
          cheque={cheque}
          group={group}
          onImageSelect={onImageSelect}
          onRescan={onRescan}
          onDelete={onDelete}
        />
      ))}
    </>
  );
}

// ── SlipScanRow ───────────────────────────────────────────────────────────────

function SlipScanRow({ scan, idx, group, onImageSelect, onRescan, onDelete }: {
  scan: SlipScanDto; idx: number; group: SlipEntryDto;
  onImageSelect: (front: string, back?: string, type?: 'slip' | 'cheque') => void;
  onRescan?: (item: RescanTarget) => void;
  onDelete: (item: DeleteTarget) => void;
}) {
  const imgUrl = scan.imagePath ? getImageUrl(scan.imagePath) : null;

  return (
    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }} className="scan-table-row">
      {/* Thumbnail */}
      <td style={{ padding: '8px 12px' }}>
        {imgUrl ? (
          <div
            onClick={() => onImageSelect(imgUrl, undefined, 'slip')}
            style={{
              width: 120, height: 76, borderRadius: 'var(--r-sm)',
              overflow: 'hidden', cursor: 'pointer', position: 'relative',
              border: '1px solid var(--border)', background: 'var(--bg-subtle)',
              flexShrink: 0,
            }}
          >
            <img src={imgUrl} alt="Slip" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <div style={{
              position: 'absolute', inset: 0, background: 'transparent',
              transition: 'background 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="open_in_full" size={16} style={{ color: '#fff', opacity: 0, transition: 'opacity 0.15s' }} />
            </div>
          </div>
        ) : (
          <NoImage label="Slip" />
        )}
      </td>

      <td style={{ padding: '8px 8px' }}>
        <TypeBadge type="slip" />
      </td>

      <td style={{ padding: '8px 8px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
        S_{String(idx + 1).padStart(4, '0')}
      </td>

      <td style={{ padding: '8px 8px', color: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
        {group.depositSlipNo || group.slipNo}
      </td>

      <td style={{ padding: '8px 8px', color: 'var(--fg-muted)' }}>
        {group.clientName || '—'}
      </td>

      <td style={{ padding: '8px 8px', color: 'var(--fg-faint)' }}>—</td>

      <td style={{ padding: '8px 8px', color: 'var(--fg)' }}>
        ₹{group.slipAmount.toLocaleString('en-IN')}
      </td>

      <td style={{ padding: '8px 8px' }}>
        <ScanStatusBadge status={scan.scanStatus} />
      </td>

      <td style={{ padding: '8px 8px' }}>
        <ActionButtons
          onRescan={onRescan ? () => onRescan({ kind: 'slip', slipScanId: scan.slipScanId, slipEntryId: group.slipEntryId }) : undefined}
          onDelete={() => onDelete({ kind: 'slip', slipScanId: scan.slipScanId })}
        />
      </td>
    </tr>
  );
}

// ── ChequeRow ─────────────────────────────────────────────────────────────────

function ChequeRow({ cheque, group, onImageSelect, onRescan, onDelete }: {
  cheque: ChequeItemDto; group: SlipEntryDto;
  onImageSelect: (front: string, back?: string, type?: 'slip' | 'cheque') => void;
  onRescan?: (item: RescanTarget) => void;
  onDelete: (item: DeleteTarget) => void;
}) {
  const frontUrl = cheque.frontImagePath ? getImageUrl(cheque.frontImagePath) : null;
  const backUrl = cheque.backImagePath ? getImageUrl(cheque.backImagePath) : null;

  const micr = [cheque.scanMICR1, cheque.scanMICR2, cheque.scanMICR3].filter(Boolean).join(' / ');

  return (
    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }} className="scan-table-row">
      {/* Thumbnails — front + back side by side */}
      <td style={{ padding: '8px 12px' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <Thumb
            url={frontUrl}
            label="F"
            onClick={frontUrl ? () => onImageSelect(frontUrl, backUrl ?? undefined, 'cheque') : undefined}
          />
          <Thumb
            url={backUrl}
            label="B"
            onClick={backUrl ? () => onImageSelect(frontUrl ?? backUrl!, backUrl ?? undefined, 'cheque') : undefined}
          />
        </div>
      </td>

      <td style={{ padding: '8px 8px' }}>
        <TypeBadge type="cheque" />
      </td>

      <td style={{ padding: '8px 8px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)' }}>
        #{String(cheque.chqSeq).padStart(4, '0')}
      </td>

      <td style={{ padding: '8px 8px', color: 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
        {cheque.chqNo || '—'}
      </td>

      <td style={{ padding: '8px 8px', color: 'var(--fg-muted)' }}>
        {group.clientName || '—'}
      </td>

      <td style={{ padding: '8px 8px', fontFamily: 'var(--font-mono)', color: 'var(--fg-muted)', fontSize: 10 }}>
        {micr || (cheque.micrRaw || '—')}
      </td>

      <td style={{ padding: '8px 8px', color: 'var(--fg)' }}>
        {cheque.scanAmount != null ? `₹${cheque.scanAmount.toLocaleString('en-IN')}` : '—'}
      </td>

      <td style={{ padding: '8px 8px' }}>
        <RRStateBadge state={cheque.rrState} scanStatus={cheque.scanStatus} />
      </td>

      <td style={{ padding: '8px 8px' }}>
        <ActionButtons
          onRescan={onRescan ? () => onRescan({ kind: 'cheque', chequeItemId: cheque.chequeItemId, slipEntryId: cheque.slipEntryId }) : undefined}
          onDelete={() => onDelete({ kind: 'cheque', chequeItemId: cheque.chequeItemId })}
        />
      </td>
    </tr>
  );
}

// ── Thumb ─────────────────────────────────────────────────────────────────────

function Thumb({ url, label, onClick }: { url: string | null; label: string; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{
        width: 82, height: 52, borderRadius: 'var(--r-sm)',
        overflow: 'hidden', position: 'relative',
        border: `1px solid ${url ? 'var(--border)' : 'var(--border-subtle)'}`,
        background: 'var(--bg-subtle)',
        cursor: url && onClick ? 'pointer' : 'default',
        flexShrink: 0,
      }}
    >
      {url ? (
        <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: 'var(--fg-faint)', fontWeight: 600, letterSpacing: '.04em',
        }}>
          {label}
        </div>
      )}
    </div>
  );
}

// ── NoImage ───────────────────────────────────────────────────────────────────

function NoImage({ label }: { label: string }) {
  return (
    <div style={{
      width: 120, height: 76, borderRadius: 'var(--r-sm)',
      border: '1px dashed var(--border)',
      background: 'var(--bg-subtle)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 4,
    }}>
      <Icon name="hide_image" size={18} style={{ color: 'var(--fg-faint)' }} />
      <span style={{ fontSize: 9, color: 'var(--fg-faint)', textTransform: 'uppercase', letterSpacing: '.04em' }}>{label}</span>
    </div>
  );
}

// ── ActionButtons ─────────────────────────────────────────────────────────────

function ActionButtons({ onRescan, onDelete }: {
  onRescan?: () => void;
  onDelete: () => void;
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <ActionBtn
        icon="replay"
        tooltip={onRescan ? 'Rescan' : 'Rescan not available'}
        onClick={onRescan}
        disabled={!onRescan}
        color="var(--accent-600)"
      />
      <ActionBtn
        icon="delete"
        tooltip="Delete"
        onClick={onDelete}
        color="var(--danger)"
      />
    </div>
  );
}

function ActionBtn({ icon, tooltip, onClick, disabled, color }: {
  icon: string; tooltip?: string; onClick?: () => void;
  disabled?: boolean; color?: string;
}) {
  return (
    <button
      type="button"
      title={tooltip}
      onClick={onClick}
      disabled={disabled}
      style={{
        width: 28, height: 28,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? 'var(--fg-faint)' : (color ?? 'var(--fg-muted)'),
        transition: 'background 0.1s, border-color 0.1s',
        flexShrink: 0,
      }}
    >
      <Icon name={icon} size={14} />
    </button>
  );
}

// ── Type/status badges ────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: 'slip' | 'cheque' }) {
  const isSlip = type === 'slip';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 6px', borderRadius: 'var(--r-full)',
      fontSize: 10, fontWeight: 600, letterSpacing: '.02em',
      background: isSlip ? 'var(--bg-subtle)' : 'var(--accent-50)',
      color: isSlip ? 'var(--fg-muted)' : 'var(--accent-700)',
      border: `1px solid ${isSlip ? 'var(--border)' : 'var(--accent-200)'}`,
    }}>
      {isSlip ? 'Slip' : 'Cheque'}
    </span>
  );
}

function ScanStatusBadge({ status }: { status: string }) {
  const ok = status === 'Captured';
  const fail = status === 'Failed';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 6px', borderRadius: 'var(--r-full)',
      fontSize: 10, fontWeight: 600,
      background: ok ? 'var(--success-bg, #f0fdf4)' : fail ? 'var(--danger-bg, #fef2f2)' : 'var(--bg-subtle)',
      color: ok ? 'var(--success, #16a34a)' : fail ? 'var(--danger, #dc2626)' : 'var(--fg-muted)',
      border: `1px solid ${ok ? 'var(--success, #16a34a)' : fail ? 'var(--danger, #dc2626)' : 'var(--border)'}`,
    }}>
      {ok ? '✓' : fail ? '✗' : '…'} {status}
    </span>
  );
}

function RRStateBadge({ state, scanStatus }: { state: number; scanStatus: string }) {
  if (scanStatus !== 'Captured') return <ScanStatusBadge status={scanStatus} />;
  if (state === 0) return (
    <span style={{
      display: 'inline-flex', padding: '2px 6px', borderRadius: 'var(--r-full)',
      fontSize: 10, fontWeight: 600,
      background: 'var(--warning-bg, #fffbeb)', color: 'var(--warning, #d97706)',
      border: '1px solid var(--warning, #d97706)',
    }}>⚠ RR</span>
  );
  if (state === 1) return (
    <span style={{
      display: 'inline-flex', padding: '2px 6px', borderRadius: 'var(--r-full)',
      fontSize: 10, fontWeight: 600,
      background: 'var(--success-bg, #f0fdf4)', color: 'var(--success, #16a34a)',
      border: '1px solid var(--success, #16a34a)',
    }}>✓ OK</span>
  );
  return (
    <span style={{
      display: 'inline-flex', padding: '2px 6px', borderRadius: 'var(--r-full)',
      fontSize: 10, fontWeight: 600,
      background: 'var(--info-bg, #eff6ff)', color: 'var(--info, #2563eb)',
      border: '1px solid var(--info, #3b82f6)',
    }}>✓ Fixed</span>
  );
}

// ── DeleteConfirmBanner ───────────────────────────────────────────────────────

function DeleteConfirmBanner({ target, onConfirm, onCancel }: {
  target: DeleteTarget;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const label = target.kind === 'slip' ? 'slip image' : 'cheque record';
  return (
    <div style={{
      position: 'sticky', bottom: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 24px', gap: 12,
      background: 'var(--danger-bg, #fef2f2)',
      borderTop: '1px solid var(--danger, #dc2626)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Icon name="warning" size={16} style={{ color: 'var(--danger)' }} />
        <span style={{ fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--danger)' }}>
          Delete this {label}? This cannot be undone.
        </span>
      </div>
      <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
        <button onClick={onCancel} className="btn-ghost" style={{ height: 30, fontSize: 'var(--text-xs)', padding: '0 12px' }}>
          Cancel
        </button>
        <button
          onClick={onConfirm}
          style={{
            height: 30, padding: '0 14px', borderRadius: 'var(--r-md)',
            background: 'var(--danger, #dc2626)', color: '#fff',
            border: 'none', cursor: 'pointer', fontSize: 'var(--text-xs)', fontWeight: 600,
            fontFamily: 'inherit',
          }}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

// ── Th ────────────────────────────────────────────────────────────────────────

function Th({ children, style }: { children?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <th style={{
      padding: '8px 8px 8px 8px',
      textAlign: 'left',
      fontSize: 10,
      fontWeight: 700,
      color: 'var(--fg-subtle)',
      textTransform: 'uppercase',
      letterSpacing: '.04em',
      borderBottom: '1px solid var(--border)',
      whiteSpace: 'nowrap',
      ...style,
    }}>
      {children}
    </th>
  );
}
