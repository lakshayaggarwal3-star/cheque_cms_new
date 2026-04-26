// =============================================================================
// File        : BatchFormUI.tsx
// Project     : CPS — Cheque Processing System
// Module      : Batch — UI Components
// Description : Reusable UI components for BatchCreatePage
// Created     : 2026-04-19
// =============================================================================

import React from 'react';

// ── Icon ─────────────────────────────────────────────────────────────────────

export function Icon({ name, size = 20, style }: { name: string; size?: number; style?: React.CSSProperties }) {
  return (
    <span
      className="material-symbols-outlined"
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' ${size}`,
        lineHeight: 1, userSelect: 'none', flexShrink: 0, ...style,
      }}
    >{name}</span>
  );
}

// ── Segmented ─────────────────────────────────────────────────────────────────

export function Segmented({ options, value, onChange, disabled }: {
  options: { id: string; label: string; icon?: string }[];
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', padding: 3, height: 38,
      background: 'var(--bg-subtle)', borderRadius: 'var(--r-md)',
      border: '1px solid var(--border)', opacity: disabled ? 0.55 : 1,
    }}>
      {options.map(o => {
        const active = value === o.id;
        return (
          <button key={o.id} type="button"
            onClick={() => !disabled && onChange(o.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              padding: '0 14px', height: '100%', minHeight: 32, fontSize: 'var(--text-sm)', fontWeight: 500,
              color: active ? 'var(--fg-on-accent)' : 'var(--fg-muted)',
              background: active ? 'var(--accent-500)' : 'transparent',
              border: 'none', borderRadius: 'calc(var(--r-md) - 3px)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              boxShadow: active ? 'var(--shadow-xs)' : 'none',
              fontFamily: 'inherit', whiteSpace: 'nowrap',
              transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)',
            }}>
            {o.icon && <Icon name={o.icon} size={14} />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── ReadStat ──────────────────────────────────────────────────────────────────

export function ReadStat({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <div style={{
        fontSize: '0.6rem', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: '.08em',
        color: 'var(--fg)', lineHeight: 1.2,
      }}>{label}</div>
      <div style={{
        fontSize: '0.9rem', fontWeight: 400, color: 'var(--fg-muted)',
        fontFamily: mono ? 'var(--font-mono)' : 'inherit',
        lineHeight: 1.4, letterSpacing: '0.01em',
      }}>{value}</div>
    </div>
  );
}

// ── FormField ─────────────────────────────────────────────────────────────────

export function FormField({ label, required, error, children }: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{ fontSize: 'var(--text-xs)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)', display: 'block', marginBottom: 6 }}>
        {label} {required && <span style={{ color: 'var(--danger)' }}>*</span>}
      </label>
      {children}
      {error && <div style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)', marginTop: 4 }}>{error}</div>}
    </div>
  );
}

// ── Input ─────────────────────────────────────────────────────────────────────

export function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      style={{
        width: '100%', boxSizing: 'border-box', padding: '7px 10px',
        background: 'var(--bg-input)', border: '1px solid var(--border-strong)',
        borderRadius: 'var(--r-md)', fontSize: 'var(--text-sm)', outline: 'none', color: 'var(--fg)',
        ...props.style,
      }}
    />
  );
}

// ── Select ────────────────────────────────────────────────────────────────────

export function Select({ ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{
        width: '100%', boxSizing: 'border-box',
        padding: '7px 10px', background: 'var(--bg-input)', color: 'var(--fg)',
        border: '1px solid var(--border-strong)', borderRadius: 'var(--r-md)',
        fontSize: 'var(--text-sm)', fontFamily: 'var(--font-sans)', outline: 'none', cursor: 'pointer',
        ...props.style,
      }}
    />
  );
}
