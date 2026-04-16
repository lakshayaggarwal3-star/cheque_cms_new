// =============================================================================
// File        : LoginPage.tsx
// Project     : CPS — Cheque Processing System
// Module      : Auth
// Description : Login page with EmployeeID/Username, password, EOD date, and force login.
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

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const onSubmit = async (data: LoginForm) => {
    setError('');
    setIsSubmitting(true);
    try {
      const user = await login(data.loginId, data.password, showForceLoginModal);
      setUser(user);
      navigate('/');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Login failed';
      if (msg.includes('already logged in')) {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-900 to-blue-700 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="p-8">
          <div className="text-center mb-8">
            <div className="text-3xl font-bold text-blue-900">CPS</div>
            <div className="text-gray-500 text-sm mt-1">Cheque Processing System</div>
            <div className="text-gray-400 text-xs mt-1">Standard Chartered Bank</div>
            <div className="mt-3 rounded-md bg-blue-50 border border-blue-100 px-3 py-2 text-xs text-blue-800">
              Demo Login: <span className="font-semibold">DEV001 / Dev@1234</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Employee ID / Username
              </label>
              <input
                {...register('loginId', { required: 'Login ID is required' })}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter Employee ID or Username"
                autoComplete="username"
              />
              {errors.loginId && <p className="text-red-500 text-xs mt-1">{errors.loginId.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                {...register('password', { required: 'Password is required', minLength: { value: 8, message: 'Min 8 characters' } })}
                type="password"
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Password"
                autoComplete="current-password"
              />
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-700 hover:bg-blue-800 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
            >
              {isSubmitting ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>

      {/* Force Login Modal */}
      {showForceLoginModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
            <div className="text-center mb-4">
              <div className="mx-auto w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Already Logged In</h3>
              <p className="text-sm text-gray-600">
                Your account is currently active on another device or browser session.
              </p>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
              <p className="text-xs text-orange-800">
                <strong>Warning:</strong> Forcing login will terminate the existing session. Any unsaved work in the other session will be lost.
              </p>
            </div>

            <div className="space-y-3">
              <button
                onClick={async () => {
                  const loginId = (document.querySelector('input[name="loginId"]') as HTMLInputElement)?.value;
                  const password = (document.querySelector('input[name="password"]') as HTMLInputElement)?.value;
                  if (loginId && password) {
                    setIsSubmitting(true);
                    try {
                      const user = await login(loginId, password, true);
                      setUser(user);
                      navigate('/');
                    } catch (err: any) {
                      const msg = err?.response?.data?.message ?? err?.message ?? 'Login failed';
                      setError(msg);
                      setShowForceLoginModal(false);
                    } finally {
                      setIsSubmitting(false);
                    }
                  }
                }}
                disabled={isSubmitting}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                {isSubmitting ? 'Logging in...' : 'Yes, Login Here'}
              </button>
              <button
                onClick={() => {
                  setShowForceLoginModal(false);
                  setError('Login cancelled. User is still active on another session.');
                }}
                disabled={isSubmitting}
                className="w-full border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 font-medium py-2.5 rounded-lg transition-colors text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
