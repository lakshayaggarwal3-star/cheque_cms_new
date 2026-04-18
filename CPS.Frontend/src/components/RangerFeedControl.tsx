// =============================================================================
// File        : RangerFeedControl.tsx
// Project     : CPS — Cheque Processing System
// Module      : Shared Components
// Description : Ranger scanner feed controls (Start/Stop) for bulk scanning.
// Created     : 2026-04-17
// =============================================================================

import React from 'react';

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
    <div className={`rounded-lg border-2 p-4 ${
      isRunning 
        ? 'border-green-300 bg-green-50' 
        : 'border-gray-200 bg-gray-50'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
          </svg>
          <div>
            <h3 className="text-sm font-bold text-gray-900">Ranger Scanner</h3>
            <p className="text-xs text-gray-500">
              {scanType} | {isMockMode ? 'Mock Mode (One-by-One)' : 'Bulk Scan'}
            </p>
          </div>
        </div>

        {/* Status Indicator */}
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full ${
            isRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-300'
          }`} />
          <span className={`text-xs font-semibold ${
            isRunning ? 'text-green-700' : 'text-gray-500'
          }`}>
            {isRunning ? 'Running' : 'Stopped'}
          </span>
        </div>
      </div>

      {/* Control Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <button
          type="button"
          onClick={onStartFeed}
          disabled={isRunning || disabled}
          className="bg-green-600 text-white py-3 rounded-xl text-sm font-bold
            hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center justify-center gap-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" />
          </svg>
          Start Feed
        </button>

        <button
          type="button"
          onClick={onStopFeed}
          disabled={!isRunning || disabled}
          className="bg-red-600 text-white py-3 rounded-xl text-sm font-bold
            hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed
            flex items-center justify-center gap-2 transition-colors"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
          </svg>
          Stop Feed
        </button>
      </div>

      {/* Info Message */}
      {isMockMode && (
        <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-2">
          <p className="text-xs text-orange-700 flex items-start gap-1.5">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
            <span>
              <strong>Mock Mode:</strong> Cheques will be captured one-by-one with mock images. 
              Real Ranger scanner captures in bulk automatically.
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
