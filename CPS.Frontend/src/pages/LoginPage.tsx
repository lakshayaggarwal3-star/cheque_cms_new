// =============================================================================
// File        : LoginPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Auth
// Description : Login page matching CPS design system exactly.
// Created     : 2026-04-14
// =============================================================================

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { login } from '../services/authService';
import { useAuthStore } from '../store/authStore';
import { syncUserSettings } from '../store/settingsStore';

interface LoginForm {
  loginId: string;
  password: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [error, setError] = useState('');
  const [showForceLoginModal, setShowForceLoginModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [pendingCreds, setPendingCreds] = useState<LoginForm | null>(null);

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<LoginForm>({
    defaultValues: { loginId: 'DEV001', password: 'Dev@1234' },
  });

  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('reason') === 'session_terminated') {
      setError('Session Terminated: A new login was detected on another device.');
    }
  }, []);

  const onSubmit = async (data: LoginForm) => {
    if (showForceLoginModal) return;
    setPendingCreds(data);
    
    setError('');
    setIsSubmitting(true);
    try {
      const user = await login(data.loginId, data.password, false);
      setUser(user);
      syncUserSettings();
      
      const params = new URLSearchParams(window.location.search);
      const returnUrl = params.get('returnUrl');
      if (returnUrl) {
        window.location.href = returnUrl;
      } else {
        navigate('/');
      }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Login failed';
      if (msg.toLowerCase().includes('already logged in') || msg.toLowerCase().includes('session')) {
        setShowForceLoginModal(true);
        setError('');
      } else {
        setError(msg);
        setShowForceLoginModal(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForceLogin = async () => {
    const creds = pendingCreds || getValues();
    const { loginId, password } = creds;
    setIsSubmitting(true);
    try {
      const user = await login(loginId, password, true);
      setUser(user);
      syncUserSettings();

      const params = new URLSearchParams(window.location.search);
      const returnUrl = params.get('returnUrl');
      window.location.href = returnUrl || '/';
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Login failed';
      setError(msg);
      setShowForceLoginModal(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: '100dvh',
      background: 'var(--bg)', color: 'var(--fg)',
      fontFamily: 'var(--font-sans)',
      position: 'relative', overflow: 'auto',
      display: 'flex', flexDirection: 'column',
    }}>
      {/* Radial gradient overlays */}
      <div style={{
        position: 'absolute', top: '-25%', right: '-15%',
        width: 600, height: 600, pointerEvents: 'none',
        background: 'radial-gradient(circle at center, rgb(217 119 87 / 12%), transparent 60%)',
      }} />
      <div style={{
        position: 'absolute', bottom: '-30%', left: '-20%',
        width: 700, height: 700, pointerEvents: 'none',
        background: 'radial-gradient(circle at center, rgb(60 108 140 / 8%), transparent 60%)',
      }} />

      {/* Center container */}
      <div style={{ 
        flex: 1,
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        padding: '16px',
        overflow: 'hidden'
      }}>
        <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

          {/* Session Terminated Notice */}
          {error.includes('logged out') && (
            <div style={{
              background: 'var(--bg-raised)', border: '1px solid var(--accent-200)',
              borderRadius: 14, padding: '16px 20px', marginBottom: 20,
              display: 'flex', gap: 14, alignItems: 'center',
              boxShadow: '0 4px 20px rgba(217, 119, 87, 0.1)',
              animation: 'slideDown 0.4s ease-out',
            }}>
              <style>{`
                @keyframes slideDown {
                  from { transform: translateY(-10px); opacity: 0; }
                  to { transform: translateY(0); opacity: 1; }
                }
              `}</style>
              <div style={{
                width: 40, height: 40, borderRadius: '50%', background: 'rgba(217,119,87,0.1)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
              }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--accent-600)', fontSize: 22 }}>devices</span>
              </div>
              <div style={{ flex: 1 }}>
                <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: 'var(--fg)' }}>Session Terminated</h4>
                <p style={{ margin: '2px 0 0', fontSize: 11, color: 'var(--fg-muted)', lineHeight: 1.4 }}>
                  {error}
                </p>
              </div>
            </div>
          )}

          {/* Logo + App name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center', marginBottom: 32 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgb(217 119 87 / 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ fontSize: 18, fontWeight: 700, color: 'var(--accent-500)', lineHeight: 1 }}>C</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', lineHeight: 1 }}>
              <span style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--fg)' }}>CPS</span>
              <span style={{ fontSize: 11, marginTop: 3, color: 'var(--fg-subtle)' }}>Cheque Processing System</span>
            </div>
          </div>

          {/* Card */}
          <div style={{
            background: 'var(--bg-raised)', border: '1px solid var(--border)',
            borderRadius: 14, boxShadow: 'var(--shadow-md)', padding: 32,
          }}>
            <div style={{ marginBottom: 24 }}>
              <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--fg)' }}>
                Welcome
              </h1>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              {/* Employee ID */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)' }}>
                  Employee ID
                </label>
                <div style={{ position: 'relative' }}>
                  <span className="material-symbols-outlined" style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 16, lineHeight: 1, pointerEvents: 'none', color: 'var(--fg-subtle)',
                  }}>badge</span>
                  <input
                    {...register('loginId', { required: 'Login ID is required' })}
                    placeholder="DEV001"
                    autoComplete="username"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '9px 12px 9px 32px',
                      background: 'var(--bg-input)', color: 'var(--fg)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 10, fontSize: 13, fontFamily: 'inherit', outline: 'none',
                      transition: 'border-color 120ms ease, box-shadow 120ms ease',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-500)'; e.currentTarget.style.boxShadow = 'var(--shadow-focus)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
                {errors.loginId && (
                  <p style={{ margin: 0, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--danger)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>
                    {errors.loginId.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 11, fontWeight: 500, textTransform: 'uppercase', letterSpacing: '.04em', color: 'var(--fg-muted)' }}>
                  Password
                </label>
                <div style={{ position: 'relative' }}>
                  <span className="material-symbols-outlined" style={{
                    position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 16, lineHeight: 1, pointerEvents: 'none', color: 'var(--fg-subtle)',
                  }}>lock</span>
                  <input
                    {...register('password', { required: 'Password is required' })}
                    type="password"
                    placeholder="••••••••"
                    autoComplete="current-password"
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      padding: '9px 12px 9px 32px',
                      background: 'var(--bg-input)', color: 'var(--fg)',
                      border: '1px solid var(--border-strong)',
                      borderRadius: 10, fontSize: 13, fontFamily: 'inherit', outline: 'none',
                      transition: 'border-color 120ms ease, box-shadow 120ms ease',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent-500)'; e.currentTarget.style.boxShadow = 'var(--shadow-focus)'; }}
                    onBlur={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.boxShadow = 'none'; }}
                  />
                </div>
                {errors.password && (
                  <p style={{ margin: 0, fontSize: 11, display: 'flex', alignItems: 'center', gap: 4, color: 'var(--danger)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>error</span>
                    {errors.password.message}
                  </p>
                )}
              </div>

              {/* Keep me signed in + Forgot password */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, cursor: 'pointer', color: 'var(--fg-muted)' }}>
                  <input type="checkbox" checked={keepSignedIn} onChange={e => setKeepSignedIn(e.target.checked)} style={{ accentColor: 'var(--accent-500)' }} />
                  Keep me signed in
                </label>
                <span style={{ fontSize: 13, color: 'var(--accent-700)', cursor: 'pointer', textDecoration: 'none' }}>
                  Forgot password?
                </span>
              </div>

              {/* API error */}
              {error && !error.includes('logged out') && (
                <div style={{ borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--danger-bg)', border: '1px solid var(--danger)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, marginTop: 1, color: 'var(--danger)', flexShrink: 0 }}>warning</span>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>
                </div>
              )}

              {/* Sign in button — always type=submit, always inside form */}
              {!showForceLoginModal && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    marginTop: 4, width: '100%',
                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    padding: '12px 20px', height: 48,
                    background: 'var(--accent-500)', color: '#fff',
                    fontWeight: 600, fontSize: 15, borderRadius: 10,
                    border: '1px solid var(--accent-600)',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    opacity: isSubmitting ? 0.8 : 1,
                  }}
                >
                  {isSubmitting ? 'Signing in…' : 'Sign in'}
                  {!isSubmitting && <span className="material-symbols-outlined" style={{ fontSize: 20, lineHeight: 1 }}>arrow_forward</span>}
                </button>
              )}
            </form>

            {/* ── Force Login section — OUTSIDE <form> so mobile browsers can't intercept the tap ── */}
            {showForceLoginModal && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                {/* Info notice */}
                <div style={{
                  borderRadius: 10, padding: '10px 14px',
                  background: 'rgba(217, 119, 87, 0.08)',
                  border: '1px solid rgba(217, 119, 87, 0.4)',
                  display: 'flex', gap: 10, alignItems: 'flex-start',
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: 'var(--fg)' }}>Account active on another device</p>
                    <p style={{ margin: '3px 0 0', fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.4 }}>
                      Tap the button below to terminate that session and sign in here.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowForceLoginModal(false)}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--fg-subtle)', fontSize: 20, lineHeight: 1, padding: 0, flexShrink: 0 }}
                  >×</button>
                </div>

                {/* Force Sign In button — OUTSIDE form, pure onClick/onTouchEnd */}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => handleForceLogin()}
                  onTouchEnd={(e) => { e.preventDefault(); if (!isSubmitting) handleForceLogin(); }}
                  style={{
                    width: '100%', height: 48,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    background: 'var(--accent-500)', color: '#fff',
                    fontWeight: 600, fontSize: 15, borderRadius: 10,
                    border: '1px solid var(--accent-600)',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                    opacity: isSubmitting ? 0.8 : 1,
                  }}
                >
                  {isSubmitting ? 'Signing in…' : 'Force Sign In'}
                </button>
              </div>
            )}

          </div>

          {/* Footer */}
          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'var(--fg-subtle)' }}>
            Standard Chartered Bank · Ahmedabad Processing Centre
          </p>
        </div>
      </div>

      {/* Session Terminated Modal */}
      {error.includes('Session Terminated') && (
        <div
          className="modal-overlay-container"
          style={{
            position: 'fixed', inset: 0, background: 'rgb(31 30 29 / 60%)',
            backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 16, zIndex: 100,
            animation: 'fadeIn 0.3s ease-out',
            overflowY: 'auto',
          }}
          onClick={() => setError('')}
        >
          <style>{`
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            @keyframes scaleIn { from { transform: scale(0.95); opacity: 0; } to { transform: scale(1); opacity: 1; } }
          `}</style>
          <div
            style={{
              maxWidth: 400, width: '100%', borderRadius: 20, padding: 32,
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.3)',
              textAlign: 'center',
              animation: 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{
              width: 64, height: 64, borderRadius: '50%', background: 'rgba(217,119,87,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px',
            }}>
              <span className="material-symbols-outlined" style={{ color: 'var(--accent-600)', fontSize: 32 }}>devices</span>
            </div>
            <h3 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 700, color: 'var(--fg)' }}>Session Terminated</h3>
            <p style={{ margin: '0 0 24px', fontSize: 14, color: 'var(--fg-muted)', lineHeight: 1.6 }}>
              {error}
            </p>
            <button
              onClick={() => setError('')}
              style={{
                width: '100%', padding: '12px', background: 'var(--accent-500)',
                color: '#fff', border: 'none', borderRadius: 12,
                fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >Got it</button>
          </div>
        </div>
      )}
    </div>
  );
}
