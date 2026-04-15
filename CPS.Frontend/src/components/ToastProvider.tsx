// =============================================================================
// File        : ToastProvider.tsx
// Project     : CPS — Cheque Processing System
// Module      : UI
// Description : Global toast notification renderer — placed at root of app.
// Created     : 2026-04-14
// =============================================================================

import React from 'react';
import { useToastStore } from '../store/toastStore';

export function ToastProvider() {
  const { toasts, removeToast } = useToastStore();

  const colors = {
    success: 'bg-green-600 text-white',
    error: 'bg-red-600 text-white',
    warning: 'bg-yellow-500 text-white',
  };

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full sm:top-4 sm:right-4 top-16 left-4">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-start gap-3 p-3 rounded shadow-lg ${colors[t.type]} animate-fade-in`}
        >
          <span className="flex-1 text-sm">{t.message}</span>
          <button
            onClick={() => removeToast(t.id)}
            className="text-white opacity-70 hover:opacity-100 text-lg leading-none"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
