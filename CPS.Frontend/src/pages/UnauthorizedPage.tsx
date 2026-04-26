// =============================================================================
// File        : UnauthorizedPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Auth
// Description : 403 page shown when a user lacks the required role for a route.
// Created     : 2026-04-14
// =============================================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function UnauthorizedPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  const isImageViewerOnly = user?.roles?.includes('ImageViewer') && user.roles.length === 1;

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)]" style={{ color: 'var(--fg)' }}>
      <div className="text-center max-w-md w-full p-10 rounded-3xl border border-[var(--border)] bg-[var(--bg-raised)] shadow-2xl shadow-blue-500/5">
        <div className="w-20 h-20 bg-rose-500/10 text-rose-500 rounded-full flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 00-2 2zm10-11V7a4 4 0 00-8 0v4" />
          </svg>
        </div>
        
        <h1 className="text-2xl font-bold uppercase tracking-tight mb-3">Security Restriction</h1>
        
        {isImageViewerOnly ? (
          <>
            <p className="text-sm opacity-60 leading-relaxed mb-8">
              Your account is configured for <strong className="text-emerald-500">Document Review</strong> access only. 
              The application dashboard and operational modules are restricted for your role.
            </p>
            <div className="bg-[var(--bg-subtle)] border border-[var(--border-subtle)] rounded-2xl p-4 mb-8 text-left">
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mb-2">Notice:</p>
              <p className="text-xs opacity-70 italic">
                "Please use direct image links provided by your administrator to view cheque records."
              </p>
            </div>
          </>
        ) : (
          <p className="text-sm opacity-60 leading-relaxed mb-8">
            You do not have the required security clearance to access this module. 
            If you believe this is an error, please contact your system administrator.
          </p>
        )}

        <div className="flex flex-col gap-3">
          {!isImageViewerOnly && (
            <button
              onClick={() => navigate('/')}
              className="btn-primary py-3 rounded-xl font-bold text-xs shadow-lg shadow-blue-500/20"
            >
              Back to Dashboard
            </button>
          )}
          <button
            onClick={() => {
               // Logout logic is handled by the authStore if we wanted to force it, 
               // but a simple redirect to login is cleaner
               window.location.href = '/login';
            }}
            className="py-3 rounded-xl font-bold text-xs border border-[var(--border)] hover:bg-[var(--bg-hover)] transition-colors"
          >
            Switch Account
          </button>
        </div>
      </div>
    </div>
  );
}
