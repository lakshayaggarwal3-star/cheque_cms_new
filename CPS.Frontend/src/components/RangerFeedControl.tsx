// =============================================================================
// File        : RangerFeedControl.tsx
// Project     : CPS — Cheque Processing System
// Module      : Shared Components
// Description : Ranger scanner feed controls (Start/Stop) for bulk scanning.
// Created     : 2026-04-17
// =============================================================================

interface RangerFeedControlProps {
  isRunning: boolean;
  scanType: 'Cheque' | 'Slip';
  onStartFeed: () => void;
  onStopFeed: () => void;
  isMockMode?: boolean;
  disabled?: boolean;
}

export function RangerFeedControl({
  isRunning,
  scanType,
  onStartFeed,
  onStopFeed,
  isMockMode = false,
  disabled = false,
}: RangerFeedControlProps) {
  return (
    <div style={{
      border: `1px solid ${isRunning ? 'var(--success, #16a34a)' : 'var(--border)'}`,
      borderRadius: 'var(--r-md)',
      background: isRunning ? 'var(--success-bg, #f0fdf4)' : 'var(--bg-raised)',
      padding: '12px 14px',
      transition: 'border-color 0.2s ease, background 0.2s ease',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{
          width: 30, height: 30, borderRadius: 'var(--r-sm)',
          background: 'var(--bg-subtle)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        }}>
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 16, fontVariationSettings: `'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 16`, color: 'var(--fg-muted)' }}
          >developer_board</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--fg)', lineHeight: 1.2 }}>
            Ranger Scanner
          </div>
          <div style={{ fontSize: 10, color: 'var(--fg-subtle)', marginTop: 1 }}>
            {scanType} · {isMockMode ? 'Mock' : 'Bulk Scan'}
          </div>
        </div>

        {/* Status badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '3px 8px', borderRadius: 'var(--r-full)',
          border: `1px solid ${isRunning ? 'var(--success, #16a34a)' : 'var(--border-strong)'}`,
          background: isRunning ? 'transparent' : 'var(--bg-subtle)',
        }}>
          <span style={{
            width: 6, height: 6, borderRadius: '50%',
            background: isRunning ? 'var(--success, #16a34a)' : 'var(--fg-faint)',
            boxShadow: isRunning ? '0 0 0 2px var(--success-bg, #dcfce7)' : 'none',
          }} />
          <span style={{
            fontSize: 10, fontWeight: 600,
            color: isRunning ? 'var(--success, #16a34a)' : 'var(--fg-muted)',
          }}>
            {isRunning ? 'Running' : 'Stopped'}
          </span>
        </div>
      </div>

      {/* Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        <button
          type="button"
          onClick={onStartFeed}
          disabled={isRunning || disabled}
          className="btn-primary"
          style={{ justifyContent: 'center', gap: 6, whiteSpace: 'nowrap' }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 15, fontVariationSettings: `'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 15` }}
          >play_circle</span>
          Start Feed
        </button>

        <button
          type="button"
          onClick={onStopFeed}
          disabled={!isRunning || disabled}
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            height: 36, padding: '0 12px', borderRadius: 'var(--r-md)',
            fontSize: 'var(--text-sm)', fontWeight: 500, fontFamily: 'inherit',
            background: (!isRunning || disabled) ? 'var(--bg-subtle)' : 'var(--danger-bg, #fef2f2)',
            color: (!isRunning || disabled) ? 'var(--fg-faint)' : 'var(--danger, #dc2626)',
            border: `1px solid ${(!isRunning || disabled) ? 'var(--border)' : 'var(--danger, #dc2626)'}`,
            cursor: (!isRunning || disabled) ? 'not-allowed' : 'pointer',
            transition: 'background 0.15s ease, border-color 0.15s ease, color 0.15s ease',
            whiteSpace: 'nowrap',
          }}
        >
          <span
            className="material-symbols-outlined"
            style={{ fontSize: 15, fontVariationSettings: `'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 15` }}
          >stop_circle</span>
          Stop Feed
        </button>
      </div>
    </div>
  );
}
