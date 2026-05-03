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

export async function saveRRImages(chequeItemId: number, data: {
  frontJpg: File;
  frontTiff: File;
  backJpg: File;
  backTiff: File;
  frontMeta: string;
  backMeta: string;
  rowVersion: string;
}): Promise<void> {
  const formData = new FormData();
  formData.append('frontJpg', data.frontJpg);
  formData.append('frontTiff', data.frontTiff);
  formData.append('backJpg', data.backJpg);
  formData.append('backTiff', data.backTiff);
  formData.append('frontMeta', data.frontMeta);
  formData.append('backMeta', data.backMeta);
  formData.append('rowVersion', data.rowVersion);
  await apiClient.post(`/rr/item/${chequeItemId}/images`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
}

export async function completeRR(batchId: number): Promise<void> {
  await apiClient.post(`/rr/${batchId}/complete`);
}

export async function releaseRRLock(batchId: number): Promise<void> {
  await apiClient.post(`/rr/${batchId}/release`);
}

export async function heartbeatRRLock(batchId: number): Promise<void> {
  await apiClient.post(`/rr/${batchId}/heartbeat`);
}
