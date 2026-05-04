// =============================================================================
// File        : makerService.ts
// Project     : CPS — Cheque Processing System
// Module      : Maker
// Description : API calls for Maker data entry and verification.
// Created     : 2026-05-03
// =============================================================================

import apiClient, { extractData } from './api';
import type { ChequeItemDto } from '../types';

export async function getMakerItems(batchId: number): Promise<ChequeItemDto[]> {
  // We can reuse the existing cheque fetching or a specialized Maker endpoint
  const res = await apiClient.get(`/cheque/batch/${batchId}`);
  return extractData<ChequeItemDto[]>(res);
}

export async function saveMakerEntry(chequeItemId: number, data: {
  amount: number;
  beneficiary: string;
  date: string;
  micr1?: string;
  micr2?: string;
  micr3?: string;
  chqNo?: string;
  complete?: boolean;
  rowVersion: string;
}): Promise<ChequeItemDto> {
  const res = await apiClient.put(`/cheque/${chequeItemId}/maker`, data);
  return extractData<ChequeItemDto>(res);
}

export async function releaseMakerLock(batchId: number): Promise<void> {
  await apiClient.post(`/batch/${batchId}/release-lock`, { phase: 'Maker' });
}

export async function mapImagesToSlip(chequeItemIds: number[], slipItemIds: number[], slipEntryId: number): Promise<void> {
  await apiClient.post('/cheque/map-to-slip', { chequeItemIds, slipItemIds, slipEntryId });
}
