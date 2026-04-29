// =============================================================================
// File        : SessionTerminatedPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Auth
// Description : Dedicated landing page for users whose session was terminated 
//               due to a new login on another device.
// Created     : 2026-04-28
// =============================================================================

import React from 'react';
import { useNavigate } from 'react-router-dom';

export function SessionTerminatedPage() {
  const navigate = useNavigate();

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      fontFamily: 'var(--font-sans)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background decoration */}
      <div style={{
        position: 'absolute', top: '10%', right: '10%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(217,119,87,0.08) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div style={{
        maxWidth: 480,
        width: '100%',
        textAlign: 'center',
        background: 'var(--bg-raised)',
        border: '1px solid var(--border)',
        borderRadius: 24,
        padding: '48px 32px',
        boxShadow: 'var(--shadow-lg)',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Animated Icon Container */}
        <div style={{
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(217,119,87,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          margin: '0 auto 24px',
          animation: 'pulse 2s infinite ease-in-out',
        }}>
          <style>{`
            @keyframes pulse {
              0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(217,119,87,0.4); }
              70% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(217,119,87,0); }
              100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(217,119,87,0); }
            }
          `}</style>
          <span className="material-symbols-outlined" style={{ 
            fontSize: 40, color: 'var(--accent-600)',
            fontVariationSettings: "'FILL' 1, 'wght' 400"
          }}>devices</span>
        </div>

        <h1 style={{ 
          margin: '0 0 12px', 
          fontSize: 28, 
          fontWeight: 700, 
          color: 'var(--fg)',
          letterSpacing: '-0.02em'
        }}>
          Session Terminated
        </h1>

        <p style={{ 
          margin: '0 0 32px', 
          fontSize: 15, 
          color: 'var(--fg-muted)',
          lineHeight: 1.6,
        }}>
          Your account was recently signed in from another device. 
          For security reasons, your active session on this device has been closed.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <button
            onClick={() => navigate('/login')}
            style={{
              width: '100%',
              padding: '14px 24px',
              background: 'var(--accent-500)',
              color: '#fff',
              border: 'none',
              borderRadius: 12,
              fontSize: 15,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--accent-600)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--accent-500)'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>login</span>
            Sign in again
          </button>

          <button
            onClick={() => window.close()}
            style={{
              width: '100%',
              padding: '12px 24px',
              background: 'transparent',
              color: 'var(--fg-subtle)',
              border: '1px solid var(--border-strong)',
              borderRadius: 12,
              fontSize: 14,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Close this window
          </button>
        </div>

        <div style={{ 
          marginTop: 40, 
          paddingTop: 24, 
          borderTop: '1px solid var(--border-subtle)',
          fontSize: 12,
          color: 'var(--fg-faint)',
        }}>
          Security Notice: If you did not authorize a new login, please change your password immediately.
        </div>
      </div>
    </div>
  );
}
