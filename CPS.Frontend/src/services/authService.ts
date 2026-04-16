// =============================================================================
// File        : authService.ts
// Project     : CPS — Cheque Processing System
// Module      : Auth
// Description : API calls for login, logout, password change, and session rehydration.
// Created     : 2026-04-14
// =============================================================================

import apiClient, { extractData } from './api';
import type { UserSession } from '../types';

export async function login(loginId: string, password: string, forceLogin = false): Promise<UserSession> {
  const res = await apiClient.post('/auth/login', { loginId, password, forceLogin });
  return extractData<UserSession>(res);
}

export async function logout(): Promise<void> {
  await apiClient.post('/auth/logout');
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/change-password', { currentPassword, newPassword });
}

export async function getMe(): Promise<UserSession> {
  const res = await apiClient.get('/auth/me');
  return extractData<UserSession>(res);
}
