// =============================================================================
// File        : UnauthorizedPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Auth
// Description : 403 page shown when a user lacks the required role for a route.
// Created     : 2026-04-14
// =============================================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';

export function UnauthorizedPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="text-center max-w-sm">
        <div className="text-6xl mb-4">🔒</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-500 text-sm mb-6">
          You don't have permission to view this page. Contact your administrator if you believe this is an error.
        </p>
        <button
          onClick={() => navigate('/')}
          className="bg-blue-700 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-800 transition-colors"
        >
          Go to Dashboard
        </button>
      </div>
    </div>
  );
}
