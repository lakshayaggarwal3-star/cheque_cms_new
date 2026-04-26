// =============================================================================
// File        : rrService.ts
// Project     : CPS — Cheque Processing System
// Module      : RR (Reject Repair)
// Description : API calls for RR cheque item retrieval, corrections, and completion.
// Created     : 2026-04-17
// =============================================================================

import apiClient, { extractData } from './api';
import type { RRItemDto } from '../types';

export async function getRRItems(batchId: number): Promise<RRItemDto[]> {
  const res = await apiClient.get(`/rr/${batchId}`);
  return extractData<RRItemDto[]>(res);
}

export async function getRRItem(chequeItemId: number): Promise<RRItemDto> {
  const res = await apiClient.get(`/rr/item/${chequeItemId}`);
  return extractData<RRItemDto>(res);
}

export async function saveRRCorrection(chequeItemId: number, data: {
  chqNo?: string;
  scanChqNo?: string;
  rrChqNo?: string;
  rrmicr1?: string;
  rrmicr2?: string;
  rrmicr3?: string;
  rrNotes?: string;
  approve?: boolean;
  rowVersion: string;
}): Promise<RRItemDto> {
  const res = await apiClient.put(`/rr/item/${chequeItemId}`, {
    chqNo: data.chqNo,
    scanChqNo: data.scanChqNo,
    rrChqNo: data.rrChqNo,
    RRMICR1: data.rrmicr1,
    RRMICR2: data.rrmicr2,
    RRMICR3: data.rrmicr3,
    RRNotes: data.rrNotes,
    Approve: data.approve ?? false,
    RowVersion: data.rowVersion,
  });
  return extractData<RRItemDto>(res);
}

export async function completeRR(batchId: number): Promise<void> {
  await apiClient.post(`/rr/${batchId}/complete`);
}
