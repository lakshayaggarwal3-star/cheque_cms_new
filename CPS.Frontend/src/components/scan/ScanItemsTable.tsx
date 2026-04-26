// =============================================================================
// File        : ScanItemsTable.tsx
// Project     : CPS — Cheque Processing System
// Module      : Scanning — Scanned Items Review Table
// Description : Full-width table showing all scanned slip/cheque images with thumbnails, MICR data, and action buttons.
// Created     : 2026-04-19
// =============================================================================

import React, { useState } from 'react';
import { getChequeImageUrl, getSlipImageUrl } from '../../utils/imageUtils';
import type { ScanSessionDto, SlipEntryDto, ChequeItemDto, SlipItemDto } from '../../types';
import { Icon } from './ScanPageUI';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ScanItemsTableProps {
  session: ScanSessionDto;
  onImageSelect: (front: string, back?: string, type?: 'slip' | 'cheque') => void;
  onClose?: () => void;
  pickupPoint?: string;
  onRescan?: (item: RescanTarget) => void;
  onDelete?: (item: DeleteTarget) => void;
}

type RescanTarget =
  | { kind: 'slip'; slipItemId: number; slipEntryId: number }
  | { kind: 'cheque'; chequeItemId: number; slipEntryId: number };

type DeleteTarget =
  | { kind: 'slip'; slipItemId: number }
  | { kind: 'cheque'; chequeItemId: number };

// ── ScanItemsTable ────────────────────────────────────────────────────────────

export function ScanItemsTable({ session, onImageSelect, onClose, pickupPoint, onRescan, onDelete }: ScanItemsTableProps) {
  const [confirmDelete, setConfirmDelete] = useState<DeleteTarget | null>(null);

  const allGroups = session.slipGroups;
  const totalItems = allGroups.reduce((n, g) => n + g.slipItems.length + g.cheques.length, 0);

  if (totalItems === 0) {
    return (
      <div style={{ background: 'var(--bg)', height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* Header (Same as main table to maintain consistency) */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 24px', borderBottom: '1px solid var(--border)',
          background: 'var(--bg-raised)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Icon name="photo_library" size={18} style={{ color: 'var(--fg-muted)' }} />
            <span style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg)' }}>Scanned Images</span>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="btn-ghost"
              style={{ display: 'flex', alignItems: 'center', gap: 6, height: 32, padding: '0 12px', fontSize: 'var(--text-xs)', fontWeight: 600 }}
            >
              <Icon name="expand_less" size={16} />
              Back to scan
            </button>
          )}
        </div>
        
        {/* Empty state content */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, opacity: 0.6 }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'var(--bg-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="image_not_supported" size={32} style={{ color: 'var(--fg-muted)' }} />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600, color: 'var(--fg)' }}>No images captured yet</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', marginTop: 4 }}>Capture your first slip or cheque to see it here.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg)' }}>

      {/* Section header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', borderBottom: '1px solid var(--border)',
        background: 'var(--bg-raised)',
        position: 'sticky', top: 0, zIndex: 5,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="photo_library" size={18} style={{ color: 'var(--fg-muted)' }} />
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg)' }}>
              Scanned Images
            </div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--fg-subtle)', marginTop: 1, display: 'flex', gap: 8 }}>
              <span>Review all captured images</span>
              {pickupPoint && (
                <>
                  <span style={{ color: 'var(--border-strong)' }}>|</span>
                  <span style={{ fontWeight: 600, color: 'var(--accent)' }}>Pickup Point: {pickupPoint}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {onClose && (
            <button
              onClick={onClose}
              className="btn-ghost"
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                height: 32, padding: '0 12px', fontSize: 'var(--text-xs)', fontWeight: 600,
                color: 'var(--fg-muted)',
              }}
            >
              <Icon name="expand_less" size={16} />
              Back to scan
            </button>
          )}

          <span style={{
            padding: '3px 10px', borderRadius: 'var(--r-full)',
            fontSize: 'var(--text-xs)', fontWeight: 600,
            background: 'var(--bg-subtle)', border: '1px solid var(--border)',
            color: 'var(--fg-muted)', fontVariantNumeric: 'tabular-nums',
          }}>
            {totalItems} item{totalItems !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 'var(--text-xs)' }}>
          <thead style={{ display: 'none' }}>
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
  const [expanded, setExpanded] = useState(true);

  const slipCount = group.slipItems.length;
  const chqCount = group.cheques.length;
  const pickupCode = group.pickupPoint ? group.pickupPoint.split(' - ')[0] : null;

  const countLabel = [
    slipCount > 0 ? `${slipCount} slip` : null,
    chqCount > 0 ? `${chqCount} chq` : null,
  ].filter(Boolean).join(' · ');

  return (
    <>
      {/* Group header row — clickable to expand/collapse */}
      <tr
        onClick={() => setExpanded(e => !e)}
        style={{ cursor: 'pointer', userSelect: 'none' }}
      >
        <td colSpan={9} style={{
          padding: '7px 16px',
          background: 'var(--bg-raised)',
          borderBottom: expanded ? '1px solid var(--border-subtle)' : '1px solid var(--border)',
          borderTop: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Expand/collapse chevron */}
            <Icon
              name={expanded ? 'expand_more' : 'chevron_right'}
              size={15}
              style={{ color: 'var(--fg-muted)', flexShrink: 0, transition: 'transform 0.15s' }}
            />

            <Icon name="receipt" size={13} style={{ color: 'var(--fg-muted)', flexShrink: 0 }} />

            {/* Slip no */}
            <span style={{ fontWeight: 700, color: 'var(--fg)', fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', flexShrink: 0 }}>
              {group.depositSlipNo || group.slipNo}
            </span>

            {/* Client name */}
            {group.clientName && (
              <span style={{ color: 'var(--fg-subtle)', fontSize: 10, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                — {group.clientName}
              </span>
            )}

            {/* Pickup point code */}
            {pickupCode && (
              <span style={{
                fontSize: 9, fontWeight: 600, padding: '1px 6px',
                background: 'var(--bg-subtle)', border: '1px solid var(--border)',
                borderRadius: 'var(--r-full)', color: 'var(--fg-muted)',
                flexShrink: 0, fontFamily: 'var(--font-mono)',
              }}>
                {pickupCode}
              </span>
            )}

            {/* Slip amount */}
            {group.slipAmount > 0 && (
              <span style={{ fontSize: 10, fontWeight: 600, color: 'var(--fg)', flexShrink: 0 }}>
                ₹{group.slipAmount.toLocaleString('en-IN')}
              </span>
            )}

            {/* Item counts */}
            <span style={{
              fontSize: 9, color: 'var(--fg-muted)', flexShrink: 0,
              padding: '1px 6px', background: 'var(--bg-subtle)',
              border: '1px solid var(--border)', borderRadius: 'var(--r-full)',
            }}>
              {countLabel || '0 items'}
            </span>
          </div>
        </td>
      </tr>

      {/* Item rows — only when expanded */}
      {expanded && group.slipItems.map((scan, idx) => (
        <SlipItemRow
          key={scan.slipItemId}
          scan={scan}
          idx={idx}
          group={group}
          onImageSelect={onImageSelect}
          onRescan={onRescan}
          onDelete={onDelete}
        />
      ))}

      {expanded && group.cheques.map(cheque => (
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

// ── SlipItemRow ───────────────────────────────────────────────────────────────

function SlipItemRow({ scan, idx, group, onImageSelect, onRescan, onDelete }: {
  scan: SlipItemDto; idx: number; group: SlipEntryDto;
  onImageSelect: (front: string, back?: string, type?: 'slip' | 'cheque') => void;
  onRescan?: (item: RescanTarget) => void;
  onDelete: (item: DeleteTarget) => void;
}) {
  const imgUrl = getSlipImageUrl(scan);

  return (
    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }} className="scan-table-row">
      {/* Thumbnail */}
      <td style={{ padding: '8px 12px' }}>
        {imgUrl ? (
          <div
            onClick={() => onImageSelect(imgUrl, undefined, 'slip')}
            style={{
              width: 130, height: 70, padding: 3, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--r-sm)', cursor: 'pointer', overflow: 'hidden', flexShrink: 0,
            }}
          >
            <img src={imgUrl} alt="Slip" style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 2 }} />
          </div>
        ) : (
          <NoImage label="Slip" />
        )}
      </td>

      <td style={{ padding: '8px 8px' }}>
        <TypeBadge type="slip" />
      </td>



      <td style={{ padding: '8px 8px', color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
        {scan.imageName || '—'}
      </td>

      <td style={{ padding: '8px 8px' }}>
        <ActionButtons
          disabled
          onRescan={onRescan ? () => onRescan({ kind: 'slip', slipItemId: scan.slipItemId, slipEntryId: group.slipEntryId }) : undefined}
          onDelete={() => onDelete({ kind: 'slip', slipItemId: scan.slipItemId })}
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
  const frontUrl = getChequeImageUrl(cheque, 'front');
  const backUrl = getChequeImageUrl(cheque, 'back');

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

      {/* Front image filename */}
      <td style={{ padding: '8px 8px', color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)', fontSize: 10 }}>
        {cheque.imageName ? `${cheque.imageName}CF` : '—'}
      </td>

      <td style={{ padding: '8px 8px' }}>
        <ActionButtons
          disabled
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
        position: 'relative',
        width: 100, height: 70, padding: 3,
        background: 'var(--bg)', border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)', overflow: 'hidden', flexShrink: 0,
        cursor: url && onClick ? 'pointer' : 'default',
      }}
    >
      {url ? (
        <img src={url} alt={label} style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 2 }} />
      ) : (
        <div style={{
          width: '100%', height: '100%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 10, color: 'var(--fg-faint)', fontWeight: 600, letterSpacing: '.04em',
        }}>
          {label}
        </div>
      )}
      {/* Front / Back label badge */}
      <span style={{
        position: 'absolute', bottom: 4, left: 4,
        fontSize: 9, fontWeight: 700, letterSpacing: '.04em',
        padding: '1px 4px', borderRadius: 3,
        background: 'rgba(0,0,0,0.55)', color: '#fff',
        pointerEvents: 'none',
      }}>{label}</span>
    </div>
  );
}

// ── NoImage ───────────────────────────────────────────────────────────────────

function NoImage({ label }: { label: string }) {
  return (
    <div style={{
      width: 130, height: 70, borderRadius: 'var(--r-sm)',
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

function ActionButtons({ onRescan, onDelete, disabled }: {
  onRescan?: () => void;
  onDelete: () => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: 'flex', gap: 4 }}>
      <ActionBtn icon="replay" label="Rescan" onClick={onRescan} disabled={disabled || !onRescan} color="var(--accent-600)" />
      <ActionBtn icon="delete" label="Delete" onClick={onDelete} disabled={disabled} color="var(--danger)" />
    </div>
  );
}

function ActionBtn({ icon, label, onClick, disabled, color }: {
  icon: string; label: string; onClick?: () => void;
  disabled?: boolean; color?: string;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      disabled={disabled}
      style={{
        height: 26, padding: '0 8px',
        display: 'inline-flex', alignItems: 'center', gap: 4,
        background: 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 'var(--r-sm)',
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? 'var(--fg-faint)' : (color ?? 'var(--fg-muted)'),
        fontSize: 10, fontWeight: 500, fontFamily: 'var(--font-sans)',
        transition: 'background 0.1s, border-color 0.1s',
        flexShrink: 0, whiteSpace: 'nowrap',
      }}
    >
      <Icon name={icon} size={12} />
      {label}
    </button>
  );
}

// ── Type/status badges ────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: 'slip' | 'cheque' }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 6px', borderRadius: 'var(--r-full)',
      fontSize: 10, fontWeight: 600, letterSpacing: '.02em',
      background: 'var(--bg-raised)',
      color: 'var(--fg-muted)',
      border: '1px solid var(--border)',
    }}>
      {type === 'slip' ? 'Slip' : 'Cheque'}
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
