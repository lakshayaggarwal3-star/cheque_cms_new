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

      // Avoid hard reload loops when bootstrapping auth on login page.
      if (!isAuthMeRequest && !isOnLoginPage && !isAuthRedirectInProgress) {
        isAuthRedirectInProgress = true;
        window.location.replace('/login');
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
