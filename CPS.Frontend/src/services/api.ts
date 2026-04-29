// =============================================================================
// File        : api.ts
// Project     : CPS — Cheque Processing System
// Module      : Services
// Description : Axios instance with httpOnly cookie auth and 401 redirect interceptor.
// Created     : 2026-04-14
// =============================================================================

import axios from 'axios';
import type { ApiResponse } from '../types';

const apiClient = axios.create({
  baseURL: '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let isAuthRedirectInProgress = false;

// Response interceptor — redirect to login on 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const requestUrl = String(error.config?.url ?? '');
      const currentPath = window.location.pathname;
      const isAuthMeRequest = requestUrl.includes('/auth/me');
      const isOnLoginPage = currentPath === '/login';

      let message = '';
      if (typeof error.response?.data === 'string') {
        try {
          const parsed = JSON.parse(error.response.data);
          message = parsed.message || parsed.Message || error.response.data;
        } catch {
          message = error.response.data;
        }
      } else {
        message = error.response?.data?.message || error.response?.data?.Message || '';
      }

      const isSessionConflict = error.response?.headers['x-session-conflict'] === 'true' ||
                                message.toLowerCase().includes('device') ||
                                message.toLowerCase().includes('another device');

      // 1. Priority: Session conflict redirect
      if (isSessionConflict) {
        if (!isAuthRedirectInProgress && !isOnLoginPage) {
          isAuthRedirectInProgress = true;
          window.location.href = '/login?reason=session_terminated';
          return Promise.reject(error);
        }
      }

      // 2. Fallback: General 401 redirect to login (if not already on login page)
      if (!isOnLoginPage && !isAuthRedirectInProgress) {
        isAuthRedirectInProgress = true;
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);

export default apiClient;

// Helper to extract typed data from response
export function extractData<T>(response: { data: ApiResponse<T> }): T {
  if (!response.data.success) {
    throw new Error(response.data.message ?? 'An error occurred');
  }
  return response.data.data as T;
}
