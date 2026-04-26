// =============================================================================
// File        : userSettingService.ts
// Project     : CPS — Cheque Processing System
// Module      : User Settings
// Description : API calls for per-user key-value settings.
// Created     : 2026-04-24
// =============================================================================

import apiClient from './api';

export async function getUserSettings(): Promise<Record<string, string>> {
  const res = await apiClient.get('/users/me/settings');
  return res.data.data ?? {};
}

export async function setUserSetting(key: string, value: string): Promise<void> {
  await apiClient.put(`/users/me/settings/${key}`, { value });
}
