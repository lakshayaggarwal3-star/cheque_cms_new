// =============================================================================
// File        : locationService.ts
// Project     : CPS — Cheque Processing System
// Module      : Location
// Description : API calls for location listing and scanner retrieval.
// Created     : 2026-04-14
// =============================================================================

import apiClient, { extractData } from './api';
import type { LocationDto, ScannerDto } from '../types';

export async function getLocations(): Promise<LocationDto[]> {
  const res = await apiClient.get('/locations');
  const data = extractData<{ items: LocationDto[] }>(res);
  return data.items;
}

export async function getScanners(locationId: number): Promise<ScannerDto[]> {
  const res = await apiClient.get(`/locations/${locationId}/scanners`);
  return extractData<ScannerDto[]>(res);
}
