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

  const { register, handleSubmit, getValues, formState: { errors } } = useForm<LoginForm>({
    defaultValues: { loginId: 'DEV001', password: 'Dev@1234' },
  });

  const onSubmit = async (data: LoginForm) => {
    setError('');
    setIsSubmitting(true);
    try {
      const user = await login(data.loginId, data.password, false);
      setUser(user);
      
      const params = new URLSearchParams(window.location.search);
      const returnUrl = params.get('returnUrl');
      if (returnUrl) {
        window.location.href = returnUrl; // Use window.location.href for external/API paths
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
    const { loginId, password } = getValues();
    setIsSubmitting(true);
    try {
      const user = await login(loginId, password, true);
      setUser(user);

      const params = new URLSearchParams(window.location.search);
      const returnUrl = params.get('returnUrl');
      if (returnUrl) {
        window.location.href = returnUrl;
      } else {
        navigate('/');
      }
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
      minHeight: '100vh',
      background: 'var(--bg)', color: 'var(--fg)',
      fontFamily: 'var(--font-sans)',
      position: 'relative', overflow: 'hidden',
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', padding: '24px 16px' }}>
        <div style={{ width: '100%', maxWidth: 420, position: 'relative', zIndex: 1 }}>

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
                Welcome back
              </h1>
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--fg-muted)' }}>
                Sign in with your SCB employee credentials.
              </p>
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
              {error && (
                <div style={{ borderRadius: 8, padding: '10px 12px', display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--danger-bg)', border: '1px solid var(--danger)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 18, marginTop: 1, color: 'var(--danger)', flexShrink: 0 }}>warning</span>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--danger)' }}>{error}</p>
                </div>
              )}

              {/* Sign in button */}
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  marginTop: 4, width: '100%',
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  padding: '12px 20px', height: 44,
                  background: 'var(--accent-500)', color: 'var(--fg-on-accent)',
                  fontWeight: 500, fontSize: 15, borderRadius: 10,
                  border: '1px solid var(--accent-600)',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer', fontFamily: 'inherit',
                  transition: 'background-color 120ms ease', opacity: isSubmitting ? 0.8 : 1,
                }}
                onMouseEnter={e => { if (!isSubmitting) (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-600)'; }}
                onMouseLeave={e => { if (!isSubmitting) (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-500)'; }}
              >
                {isSubmitting ? 'Signing in…' : 'Sign in'}
                {!isSubmitting && <span className="material-symbols-outlined" style={{ fontSize: 20, lineHeight: 1, fontWeight: 500 }}>arrow_forward</span>}
              </button>
            </form>

            {/* Divider + Demo + Force login */}
            <div style={{
              marginTop: 24, paddingTop: 20,
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 11, display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-subtle)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, lineHeight: 1 }}>info</span>
                Demo: DEV001 / Dev@1234
              </span>
              <span onClick={() => setShowForceLoginModal(true)}
                style={{ fontSize: 11, color: 'var(--accent-700)', cursor: 'pointer', textDecoration: 'none' }}>
                Simulate force login →
              </span>
            </div>
          </div>

          {/* Footer */}
          <p style={{ textAlign: 'center', marginTop: 24, fontSize: 11, color: 'var(--fg-subtle)' }}>
            Standard Chartered Bank · Ahmedabad Processing Centre
          </p>
        </div>
      </div>

      {/* Force Login Modal */}
      {showForceLoginModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgb(31 30 29 / 40%)',
            backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', padding: 16, zIndex: 50,
          }}
          onClick={() => setShowForceLoginModal(false)}
        >
          <div
            style={{
              maxWidth: 420, width: '100%', borderRadius: 14, padding: 24,
              background: 'var(--bg-raised)', border: '1px solid var(--border)',
              boxShadow: 'var(--shadow-md)',
            }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                background: 'var(--warning-bg)', color: 'var(--warning)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 22, lineHeight: 1 }}>warning</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 600, color: 'var(--fg)' }}>Session already active</h3>
                <p style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.55, color: 'var(--fg-muted)' }}>
                  Your account is signed in on another device. Forcing login here will terminate that session; any unsaved work will be lost.
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowForceLoginModal(false)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '9px 16px', height: 38, background: 'var(--bg-raised)',
                  color: 'var(--fg)', border: '1px solid var(--border-strong)',
                  borderRadius: 10, fontSize: 13, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                  transition: 'background-color 120ms ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
              >Cancel</button>
              <button
                onClick={handleForceLogin}
                disabled={isSubmitting}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '9px 16px', height: 38,
                  background: 'var(--accent-500)', color: 'var(--fg-on-accent)',
                  borderRadius: 10, border: '1px solid var(--accent-600)',
                  fontSize: 13, fontWeight: 500, fontFamily: 'inherit',
                  cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  transition: 'background-color 120ms ease', opacity: isSubmitting ? 0.8 : 1,
                }}
                onMouseEnter={e => { if (!isSubmitting) (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-600)'; }}
                onMouseLeave={e => { if (!isSubmitting) (e.currentTarget as HTMLButtonElement).style.background = 'var(--accent-500)'; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16, lineHeight: 1 }}>login</span>
                {isSubmitting ? 'Signing in…' : 'Force sign in'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
