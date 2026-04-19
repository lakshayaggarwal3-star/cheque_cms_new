// =============================================================================
// File        : ScanPageUI.tsx
// Project     : CPS — Cheque Processing System
// Module      : Scanning — UI Components
// Description : Reusable UI components for ScanPage (Icon, Pill, IconBtn, etc.)
// Created     : 2026-04-19
// =============================================================================

import { useState, type ReactNode, type CSSProperties } from 'react';

// ── Icon ──────────────────────────────────────────────────────────────────────

export function Icon({ name, size = 18, style }: { name: string; size?: number; style?: CSSProperties }) {
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

// ── Pill chip ─────────────────────────────────────────────────────────────────

export function Pill({ icon, children, mono }: { icon?: string; children: ReactNode; mono?: boolean }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '3px 8px', borderRadius: 'var(--r-full)',
      fontSize: 'var(--text-xs)', fontWeight: 500,
      background: 'var(--bg-subtle)', border: '1px solid var(--border)',
      color: 'var(--fg-muted)',
      fontFamily: mono ? 'var(--font-mono)' : undefined,
      whiteSpace: 'nowrap',
    }}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

// ── IconBtn ───────────────────────────────────────────────────────────────────

export function IconBtn({ icon, tooltip, onClick, size = 34 }: { icon: string; tooltip?: string; onClick?: () => void; size?: number }) {
  const [hover, setHover] = useState(false);
  return (
    <button
      title={tooltip}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: size, height: size,
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        background: hover ? 'var(--bg-hover)' : 'transparent',
        border: '1px solid transparent', borderRadius: 'var(--r-md)',
        color: hover ? 'var(--fg)' : 'var(--fg-muted)',
        cursor: 'pointer',
        transition: 'background var(--dur-fast) var(--ease), color var(--dur-fast) var(--ease)',
        flexShrink: 0,
      }}
    >
      <Icon name={icon} size={16} />
    </button>
  );
}

// ── ImagePlaceholder ───────────────────────────────────────────────────────────

export function ImagePlaceholder({ label }: { label: string }) {
  const isSlip = label === 'SLIP IMAGE';
  const isBack = label === 'BACK';
  
  return (
    <div style={{
      width: '100%', 
      maxHeight: isSlip ? '60vh' : 'none',
      aspectRatio: isSlip ? '1 / 1.41' : '2.35 / 1',
      background: isBack ? 'repeating-linear-gradient(45deg, var(--bg-subtle), var(--bg-subtle) 10px, var(--bg-raised) 10px, var(--bg-raised) 20px)' : 'var(--bg-raised)',
      border: '1px solid var(--border)',
      borderRadius: isSlip ? 'var(--r-md)' : '14px',
      boxShadow: 'var(--shadow-lg)',
      position: 'relative', overflow: 'hidden',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {/* Decorative details */}
      {!isSlip && (
        <div style={{ position: 'absolute', inset: '6%', opacity: 0.8, pointerEvents: 'none' }}>
           {isBack ? (
             <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <div style={{ textAlign: 'center', letterSpacing: '.3em', fontWeight: 600, fontSize: 13, color: 'var(--fg-muted)', marginTop: '2%' }}>REVERSE · ENDORSEMENTS</div>
                <div style={{ position: 'absolute', top: '30%', left: '0', right: '0', height: 1, borderTop: '1px dashed var(--border-strong)' }} />
                <div style={{ position: 'absolute', top: '45%', left: '0', right: '0', height: 1, borderTop: '1px dashed var(--border-strong)' }} />
                <div style={{ position: 'absolute', top: '60%', left: '0', right: '0', height: 1, borderTop: '1px dashed var(--border-strong)' }} />
                <div style={{ position: 'absolute', bottom: '0', left: '2%', right: '2%', height: '15%', border: '1px dashed var(--border-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, letterSpacing: '.1em', color: 'var(--fg-muted)', background: 'var(--bg-raised)' }}>FOR SCB CLEARING USE · STAMP & SIGN</div>
             </div>
           ) : (
             <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--fg-subtle)' }}>STANDARD CHARTERED BANK</div>
                <div style={{ fontSize: 9, color: 'var(--fg-faint)', marginTop: 2 }}>Navrangpura, Ahmedabad · IFSC SCBL0036054</div>
                <div style={{ position: 'absolute', top: '30%', left: 0, right: '25%', height: 1, borderTop: '1px dashed var(--border-strong)' }}>
                  <span style={{ position: 'absolute', top: -14, fontSize: 10, color: 'var(--fg-muted)' }}>PAY</span>
                </div>
                <div style={{ position: 'absolute', top: '30%', right: 0, fontSize: 10, color: 'var(--fg-muted)' }}>DATE ...................</div>
                
                <div style={{ position: 'absolute', top: '55%', left: 0, right: '35%', height: 1, borderTop: '1px dashed var(--border-strong)' }}>
                  <span style={{ position: 'absolute', top: -14, fontSize: 10, color: 'var(--fg-muted)' }}>RUPEES</span>
                </div>
                <div style={{ position: 'absolute', top: '45%', right: '2%', width: '25%', height: '18%', border: '1px solid var(--border-strong)', borderRadius: 4, background: 'var(--bg-subtle)' }} />
                
                <div style={{ position: 'absolute', bottom: '0%', left: '0%', fontFamily: 'monospace', fontSize: 16, letterSpacing: '.2em', color: 'var(--fg-subtle)' }}>⑈100000⑈ 380002001 123456 31</div>
                <div style={{ position: 'absolute', bottom: '20%', right: '2%', fontFamily: 'cursive', fontSize: 18, color: 'var(--fg-muted)' }}>R. Mehta</div>
             </div>
           )}
        </div>
      )}
      {isSlip && (
        <div style={{ position: 'absolute', inset: '10%', opacity: 0.6, pointerEvents: 'none' }}>
            <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: '.1em', color: 'var(--fg-subtle)', textAlign: 'center', marginBottom: '15%' }}>DEPOSIT SLIP</div>
            <div style={{ width: '100%', height: 1, borderTop: '1px solid var(--border-strong)', marginBottom: '10%' }} />
            <div style={{ width: '100%', height: 1, borderTop: '1px solid var(--border-strong)', marginBottom: '10%' }} />
            <div style={{ width: '100%', height: 1, borderTop: '1px solid var(--border-strong)', marginBottom: '10%' }} />
            <div style={{ width: '60%', height: 1, borderTop: '1px solid var(--border-strong)' }} />
        </div>
      )}

      {/* Floating Center Label */}
      <div style={{ 
        zIndex: 2, background: 'rgba(255,255,255,0.7)', padding: '12px 24px', 
        borderRadius: 8, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
        backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)', color: 'var(--fg-muted)', border: '1px solid var(--border-subtle)'
      }}>
          <span className="material-symbols-outlined" style={{ fontSize: 24, fontVariationSettings: `'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24` }}>
            {isSlip ? 'article' : 'credit_card'}
          </span>
          <span style={{ fontSize: 'var(--text-xs)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 600 }}>{label}</span>
      </div>
    </div>
  );
}

// ── StepDot ────────────────────────────────────────────────────────────────────

export function StepDot({ active, done, label, n, disabled }: { active: boolean; done: boolean; label: string; n: number; disabled?: boolean }) {
  const bg = done ? 'var(--fg-muted)' : active ? 'var(--accent-500)' : 'var(--border-strong)';
  const color = done || active ? '#fff' : 'var(--fg-faint)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, opacity: disabled ? 0.35 : 1 }}>
      <div style={{ width: 22, height: 22, borderRadius: '50%', background: bg, color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 600, flexShrink: 0 }}>
        {done ? '✓' : n}
      </div>
      <span style={{ fontSize: 10, color: active ? 'var(--fg)' : 'var(--fg-subtle)', whiteSpace: 'nowrap' }}>{label}</span>
    </div>
  );
}

// ── ControlCard ────────────────────────────────────────────────────────────────

export function ControlCard({ children, tone }: { children: ReactNode; tone?: 'warning' | 'default' }) {
  const bg = tone === 'warning' ? 'var(--bg-raised)' : 'var(--bg-subtle)';
  const border = tone === 'warning' ? 'var(--border-strong)' : 'var(--border)';
  return (
    <div style={{ padding: '14px 14px', borderRadius: 'var(--r-md)', background: bg, border: `1px solid ${border}` }}>
      {children}
    </div>
  );
}

// ── DevMockSection ─────────────────────────────────────────────────────────────

export function DevMockSection({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 'var(--r-md)', background: 'var(--bg-subtle)', overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 12px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--fg-muted)', fontSize: 'var(--text-xs)', fontWeight: 600, fontFamily: 'inherit' }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 14` }}>code</span>
          {title}
        </span>
        <span className="material-symbols-outlined" style={{ fontSize: 14, fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 14`, transition: 'transform var(--dur-fast) var(--ease)', transform: open ? 'rotate(180deg)' : 'none' }}>expand_more</span>
      </button>
      {open && <div style={{ padding: '0 12px 12px' }}>{children}</div>}
    </div>
  );
}

// ── Toggle ─────────────────────────────────────────────────────────────────────

export function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{ width: 36, height: 20, borderRadius: 10, background: on ? 'var(--accent-500)' : 'var(--border-strong)', position: 'relative', cursor: 'pointer', transition: 'background var(--dur-fast) var(--ease)', flexShrink: 0 }}>
      <div style={{ position: 'absolute', top: 3, left: on ? 19 : 3, width: 14, height: 14, borderRadius: '50%', background: '#fff', transition: 'left var(--dur-fast) var(--ease)', boxShadow: '0 1px 3px rgb(0 0 0 / 20%)' }} />
    </div>
  );
}
