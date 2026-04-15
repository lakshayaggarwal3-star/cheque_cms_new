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
  eodDate: string;
}

export function LoginPage() {
  const navigate = useNavigate();
  const { setUser } = useAuthStore();
  const [error, setError] = useState('');
  const [forceLogin, setForceLogin] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>({
    defaultValues: { eodDate: new Date().toISOString().slice(0, 10) }
  });

  const onSubmit = async (data: LoginForm) => {
    setError('');
    setIsSubmitting(true);
    try {
      const user = await login(data.loginId, data.password, data.eodDate, forceLogin);
      setUser(user);
      navigate('/');
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.message ?? 'Login failed';
      if (msg.includes('already logged in')) {
        setForceLogin(true);
        setError(msg + ' Click Login again to force login.');
      } else {
        setError(msg);
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                EOD Date
              </label>
              <input
                {...register('eodDate', { required: 'EOD date is required' })}
                type="date"
                max={new Date().toISOString().slice(0, 10)}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {errors.eodDate && <p className="text-red-500 text-xs mt-1">{errors.eodDate.message}</p>}
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {forceLogin && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="force"
                  checked={forceLogin}
                  onChange={() => setForceLogin(!forceLogin)}
                  className="rounded"
                />
                <label htmlFor="force" className="text-sm text-orange-700">
                  Force login (override existing session)
                </label>
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
    </div>
  );
}
