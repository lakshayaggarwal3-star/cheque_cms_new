// =============================================================================
// File        : systemService.ts
// Project     : CPS — Cheque Processing System
// Module      : System
// Description : API calls for system admin/developer utilities.
// Created     : 2026-04-14
// =============================================================================

import apiClient from './api';
import { extractData } from './api';

export interface RoleCatalogDto {
  key: string;
  name: string;
  description: string;
}

export async function getRoleCatalog(): Promise<RoleCatalogDto[]> {
  const res = await apiClient.get('/system/roles');
  return extractData<RoleCatalogDto[]>(res);
}

export async function resetOperationalData(): Promise<void> {
  await apiClient.post('/system/developer/reset-operational-data');
}
