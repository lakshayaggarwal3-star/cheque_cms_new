// =============================================================================
// File        : ToastProvider.tsx
// Project     : CPS — Cheque Processing System
// Module      : UI
// Description : Global toast notification renderer — styled as a clean marker pill UI.
// Created     : 2026-04-14
// =============================================================================

import React from 'react';
import { useToastStore } from '../store/toastStore';

// Minimal internal icon component matching your app's standard material-symbols
function Icon({ name, color }: { name: string; color?: string }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: 22,
        color: color || 'inherit',
        fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {name}
    </span>
  );
}

export function ToastProvider() {
  const { toasts, removeToast } = useToastStore();

  const getStyleParams = (type: string) => {
    switch (type) {
      case 'success': 
        return { icon: 'check_circle', color: 'var(--success, #16a34a)' };
      case 'error': 
        return { icon: 'error', color: 'var(--danger, #dc2626)' };
      case 'warning':
        return { icon: 'warning', color: 'var(--warning, #eab308)' };
      default: 
        return { icon: 'info', color: 'var(--info, #3b82f6)' };
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 12, 
      alignItems: 'flex-end', // Lock pills closely to the right
      pointerEvents: 'none'
    }}>
      {toasts.map((t) => {
        const p = getStyleParams(t.type);
        return (
          <div
            key={t.id}
            onClick={() => removeToast(t.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '12px 24px', 
              background: 'var(--bg-raised, #ffffff)', 
              color: 'var(--fg, #000000)', // Black text 
              border: `1px solid var(--border-subtle, #eaeaea)`, 
              borderRadius: '999px', // Distinct extreme Pill shape from your reference screenshot
              boxShadow: '0 8px 30px rgba(0, 0, 0, 0.12)', // Clean floating elevated shadow
              pointerEvents: 'auto',
              fontFamily: 'inherit',
              fontSize: '13px', 
              fontWeight: 500,
              letterSpacing: '0.01em',
              animation: 'fadeInToast 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              cursor: 'pointer', // Indicates it can be dismissed natively
            }}
          >
            <Icon name={p.icon} color={p.color} />
            <span style={{ 
              whiteSpace: 'nowrap', // Prevents wrapping locally
              paddingTop: 3 // Aligns handwritten baselines slightly better with strictly circular icons
            }}>
              {t.message}
            </span>
          </div>
        );
      })}
      
      <style>{`
        @keyframes fadeInToast {
          from { opacity: 0; transform: translateY(-16px) scale(0.95); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  );
}
