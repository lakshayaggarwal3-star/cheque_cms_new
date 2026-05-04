// =============================================================================
// File        : QCPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : QC
// Description : Quality Control mismatch resolution screen — placeholder for Phase 2.
// Created     : 2026-05-03
// =============================================================================

import React from 'react';
import { useParams } from 'react-router-dom';

export function QCPage() {
  const { batchNo } = useParams();
  
  return (
    <div style={{ padding: 20 }}>
      <div style={{ background: 'var(--bg-raised)', border: '1px solid var(--border)', borderRadius: 'var(--r-lg)', padding: 40, textAlign: 'center' }}>
        <h2 style={{ color: 'var(--fg)' }}>QC Review — {batchNo}</h2>
        <p style={{ color: 'var(--fg-muted)' }}>This is where the QC mismatch resolution screen will be built.</p>
        <div style={{ marginTop: 24, padding: 20, border: '1px dashed var(--border)', borderRadius: 'var(--r-md)', color: 'var(--fg-subtle)' }}>
           [ Form Implementation Coming Soon ]
        </div>
      </div>
    </div>
  );
}
