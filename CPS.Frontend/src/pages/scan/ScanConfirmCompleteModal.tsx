// =============================================================================
// File        : ScanConfirmCompleteModal.tsx
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Confirmation dialog before completing slip or cheque scanning.
// =============================================================================

import React from 'react';
import { Icon } from '../../components/scan';

interface Props {
  type: 'slip' | 'cheque' | 'batch';
  onCancel: () => void;
  onConfirm: () => void;
}

export function ScanConfirmCompleteModal({ type, onCancel, onConfirm }: Props) {
  const isBatch = type === 'batch';
  const titleText = isBatch ? 'Complete Entire Batch?' : `Complete ${type} scanning?`;
  
  const iconName = isBatch ? 'verified' : (type === 'slip' ? 'description' : 'fact_check');
  
  const bodyText = isBatch 
    ? 'Are you sure you want to finalize this entire batch? This will release the scan lock and move the batch to the next processing stage.'
    : `Are you sure all ${type === 'slip' ? 'slip images' : 'cheques'} for this entry have been scanned correctly? This phase will be marked as finished.`;

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 20
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 24, textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', background: 'var(--accent-50)',
          color: 'var(--accent-600)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', margin: '0 auto 16px'
        }}>
          <Icon name={iconName} size={32} />
        </div>
        <h3 style={{ margin: '0 0 8px', fontSize: 'var(--text-lg)', color: 'var(--fg)' }}>
          {titleText}
        </h3>
        <p style={{ margin: '0 0 24px', fontSize: 'var(--text-sm)', color: 'var(--fg-muted)', lineHeight: 1.5 }}>
          {bodyText}
        </p>
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={onCancel}
            className="btn-secondary"
            style={{ flex: 1, height: 40, justifyContent: 'center' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="btn-primary"
            style={{ flex: 1, height: 40, justifyContent: 'center' }}
          >
            Yes, Complete
          </button>
        </div>
      </div>
    </div>
  );
}
