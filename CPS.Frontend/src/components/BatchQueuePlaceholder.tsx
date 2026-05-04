// =============================================================================
// File        : BatchQueuePlaceholder.tsx
// Project     : CPS — Cheque Processing System
// Module      : Shared
// Description : Empty state card for queue pages pending Phase 2 implementation.
// Created     : 2026-05-03
// =============================================================================

import React from 'react';

interface Props {
  title: string;
  subtitle: string;
  icon: string;
}

export function BatchQueuePlaceholder({ title, subtitle, icon }: Props) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '400px', background: 'var(--bg-raised)', border: '1px solid var(--border)',
      borderRadius: 'var(--r-lg)', margin: '20px 0', padding: 40, textAlign: 'center'
    }}>
      <div style={{
        width: 80, height: 80, borderRadius: '50%', background: 'var(--bg-subtle)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 24,
        color: 'var(--fg-faint)'
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 40 }}>{icon}</span>
      </div>
      <h2 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 600, color: 'var(--fg)' }}>{title}</h2>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--fg-muted)', maxWidth: 400, lineHeight: 1.5 }}>
        {subtitle}
      </p>
      
      <div style={{
        marginTop: 40, padding: '16px 24px', background: 'var(--accent-50)',
        border: '1px solid var(--accent-200)', borderRadius: 'var(--r-md)',
        display: 'flex', alignItems: 'center', gap: 12, color: 'var(--accent-700)'
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: 20 }}>info</span>
        <div style={{ textAlign: 'left' }}>
          <div style={{ fontWeight: 600, fontSize: 13 }}>Phase 2 Implementation</div>
          <div style={{ fontSize: 12, opacity: 0.8 }}>This queue is currently in development.</div>
        </div>
      </div>
    </div>
  );
}
