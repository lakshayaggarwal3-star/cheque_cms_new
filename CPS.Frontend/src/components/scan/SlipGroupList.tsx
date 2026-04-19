// =============================================================================
// File        : SlipGroupList.tsx
// Project     : CPS — Cheque Processing System
// Module      : Scanning — Slip Group List
// Description : Components for displaying slip groups and their items
// Created     : 2026-04-19
// =============================================================================

import { useState } from 'react';
import { getImageUrl } from '../../utils/imageUtils';
import type { SlipEntryDto } from '../../types';
import { Icon } from './ScanPageUI';

// ── SlipGroupList ──────────────────────────────────────────────────────────────

export function SlipGroupList({ groups, activeSlipEntryId, newSlipSaved, onSelect, onLockedSelect, onImageSelect }: {
  groups: SlipEntryDto[];
  activeSlipEntryId: number | null;
  newSlipSaved: boolean;
  onSelect: (g: SlipEntryDto) => void;
  onLockedSelect?: () => void;
  onImageSelect: (front: string, back?: string, type?: 'slip' | 'cheque') => void;
}) {
  return (
    <div>
      {groups.map(group => {
        const isActive = group.slipEntryId === activeSlipEntryId;
        const isLocked = newSlipSaved && !isActive;
        return (
          <SlipGroupRow
            key={group.slipEntryId}
            group={group}
            isActive={isActive}
            isLocked={isLocked}
            onSelect={() => isLocked ? onLockedSelect?.() : onSelect(group)}
            onImageSelect={onImageSelect}
          />
        );
      })}
    </div>
  );
}

// ── SlipGroupRow ───────────────────────────────────────────────────────────────

export function SlipGroupRow({ group, isActive, isLocked, onSelect, onImageSelect }: {
  group: SlipEntryDto; isActive: boolean; isLocked: boolean;
  onSelect: () => void;
  onImageSelect: (front: string, back?: string, type?: 'slip' | 'cheque') => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const bg = isActive ? 'var(--accent-50)' : 'transparent';
  const borderColor = isActive ? 'var(--accent-200)' : 'var(--border-subtle)';

  return (
    <div style={{ borderBottom: `1px solid ${borderColor}`, background: bg }}>
      {/* Slip entry header row — locked groups can expand but not become active */}
      <div
        onClick={() => { if (!isLocked) onSelect(); setExpanded(e => !e); }}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 12px', cursor: 'pointer' }}
      >
        <Icon name="receipt" size={14} style={{ color: isActive ? 'var(--accent-600)' : 'var(--fg-muted)', flexShrink: 0 }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: isActive ? 'var(--accent-700)' : 'var(--fg)', fontFamily: 'var(--font-mono)' }}>
            {group.depositSlipNo || group.slipNo}
          </div>
          <div style={{ fontSize: 10, color: 'var(--fg-subtle)', marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {group.clientName || 'No client'} · ₹{group.slipAmount.toLocaleString('en-IN')}
          </div>
        </div>
        {isLocked && (
          <Icon name="lock" size={11} style={{ color: 'var(--fg-faint)', flexShrink: 0 }} />
        )}
        <Icon
          name="expand_more"
          size={12}
          style={{
            color: 'var(--fg-faint)',
            flexShrink: 0,
            transition: 'transform var(--dur-fast) var(--ease)',
            transform: expanded ? 'rotate(180deg)' : 'none',
          }}
        />
      </div>

      {/* Expanded: slip images + cheques */}
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingBottom: 4 }}>
          {/* Slip scan images */}
          {group.slipScans.length > 0 && (
            <>
              <div style={{ padding: '5px 12px 2px 30px', fontSize: 10, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Slip images</div>
              {group.slipScans.map((scan: any, idx: number) => (
                <div
                  key={idx}
                  onClick={() => { if (scan.imagePath) onImageSelect(getImageUrl(scan.imagePath), undefined, 'slip'); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 30px', cursor: scan.imagePath ? 'pointer' : 'default', fontSize: 11, color: 'var(--fg)' }}
                >
                  <Icon name="image" size={12} style={{ color: 'var(--fg-muted)' }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {scan.imagePath ? scan.imagePath.split(/[\\/]/).pop() : `Slip ${idx + 1}`}
                  </span>
                  {!scan.imagePath && <span style={{ color: 'var(--fg-faint)', fontSize: 10 }}>pending</span>}
                </div>
              ))}
            </>
          )}
          {/* Cheques */}
          {group.cheques.length > 0 && (
            <>
              <div style={{ padding: '5px 12px 2px 30px', fontSize: 10, color: 'var(--fg-subtle)', textTransform: 'uppercase', letterSpacing: '.04em' }}>Cheques</div>
              {group.cheques.map((c: any) => (
                <div
                  key={c.chequeItemId}
                  onClick={() => {
                    const front = c.frontImagePath ? getImageUrl(c.frontImagePath) : null;
                    const back = c.backImagePath ? getImageUrl(c.backImagePath) : undefined;
                    if (front) onImageSelect(front, back, 'cheque');
                  }}
                  style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 12px 5px 30px', cursor: (c.frontImagePath || c.backImagePath) ? 'pointer' : 'default', fontSize: 11, color: 'var(--fg)' }}
                >
                  <Icon name="payments" size={12} style={{ color: 'var(--fg-muted)' }} />
                  <span style={{ fontFamily: 'var(--font-mono)' }}>#{String(c.chqSeq).padStart(2, '0')} {c.chqNo || '——'}</span>
                  {c.rrState === 0 && <span style={{ color: 'var(--warning)', fontSize: 10, fontWeight: 600, marginLeft: 'auto' }}>⚠</span>}
                  {c.rrState === 1 && <span style={{ color: 'var(--success)', fontSize: 10, marginLeft: 'auto' }}>✓</span>}
                </div>
              ))}
            </>
          )}
          {group.slipScans.length === 0 && group.cheques.length === 0 && (
            <div style={{ padding: '6px 12px 6px 30px', fontSize: 10, color: 'var(--fg-faint)' }}>No items yet</div>
          )}
        </div>
      )}
    </div>
  );
}
