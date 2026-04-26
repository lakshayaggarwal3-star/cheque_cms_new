// =============================================================================
// File        : RangerFeedControl.tsx
// Project     : CPS — Cheque Processing System
// Module      : Shared Components
// Description : Ranger scanner feed controls (Start/Stop) for bulk scanning.
// Created     : 2026-04-17
// =============================================================================

import { Icon } from './scan/ScanPageUI';

interface RangerFeedControlProps {
  isRunning: boolean;
  rangerState: number;
  onStartFeed: () => void;
  onStopFeed: () => void;
  disabled?: boolean;
  title?: string;
}

export function RangerFeedControl({
  isRunning,
  rangerState,
  onStartFeed,
  onStopFeed,
  disabled = false,
  title,
}: RangerFeedControlProps) {
  // State 5 = Feeding, 4 = ReadyToFeed
  const isFeeding = rangerState === 5 || isRunning;
  const isReady = rangerState === 4;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button
          type="button"
          onClick={onStartFeed}
          disabled={isFeeding || !isReady || disabled}
          className="btn-primary"
          title={!isReady ? 'Waiting for scanner to become ready...' : title}
          style={{ flex: 1, justifyContent: 'center', gap: 6, height: 36, fontSize: 12 }}
        >
          <Icon name="play_arrow" size={18} />
          {isFeeding ? 'Scanning in Progress...' : 'Start Feeding'}
        </button>
      </div>
      {!isFeeding && isReady && (
        <div style={{ fontSize: 10, color: 'var(--fg-faint)', textAlign: 'center', marginTop: -4 }}>
          Scanner will automatically stop when the hopper is empty.
        </div>
      )}
    </div>
  );
}
