// =============================================================================
// File        : rrService.ts
// Project     : CPS — Cheque Processing System
// Module      : RR (Reject Repair)
// Description : API calls for RR item retrieval, corrections, and completion.
// Created     : 2026-04-14
// =============================================================================

import apiClient, { extractData } from './api';
import type { RRItemDto } from '../types';

export async function getRRItems(batchId: number): Promise<RRItemDto[]> {
  const res = await apiClient.get(`/rr/${batchId}`);
  return extractData<RRItemDto[]>(res);
}

export async function getRRItem(scanId: number): Promise<RRItemDto> {
  const res = await apiClient.get(`/rr/item/${scanId}`);
  return extractData<RRItemDto>(res);
}

export async function saveRRCorrection(scanId: number, data: {
  chqNo?: string;
  micr1?: string;
  micr2?: string;
  micr3?: string;
  approve?: boolean;
  rowVersion: string;
}): Promise<RRItemDto> {
  const res = await apiClient.put(`/rr/item/${scanId}`, data);
  return extractData<RRItemDto>(res);
}

export async function completeRR(batchId: number): Promise<void> {
  await apiClient.post(`/rr/${batchId}/complete`);
}
