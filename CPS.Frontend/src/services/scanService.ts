// =============================================================================
// File        : scanService.ts
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : API calls for scan session, slip scan images, and cheque capture.
// Created     : 2026-04-17
// =============================================================================

import apiClient, { extractData } from './api';
import type { ChequeItemDto, ScanSessionDto, SlipItemDto } from '../types';

export async function getScanSession(batchId: number): Promise<ScanSessionDto> {
  const res = await apiClient.get(`/scan/${batchId}`);
  return extractData<ScanSessionDto>(res);
}

export async function startScan(batchId: number, withSlip: boolean, scanType: string): Promise<void> {
  await apiClient.post(`/scan/${batchId}/start`, { withSlip, scanType });
}

export async function startFeed(batchId: number, scannerType: 'Cheque' | 'Slip'): Promise<void> {
  await apiClient.post(`/scan/${batchId}/feed/start`, { scannerType });
}

export async function stopFeed(batchId: number, scannerType: 'Cheque' | 'Slip'): Promise<void> {
  await apiClient.post(`/scan/${batchId}/feed/stop`, { scannerType });
}

// ── Slip item images ──────────────────────────────────────────────────────────

export async function captureSlipItem(batchId: number, data: {
  slipEntryId: number;
  scanOrder: number;
  scannerType?: string;
}): Promise<SlipItemDto> {
  const res = await apiClient.post(`/scan/${batchId}/slip-item/capture`, {
    ...data,
    scannerType: data.scannerType ?? 'Document',
  });
  return extractData<SlipItemDto>(res);
}

export async function uploadMobileSlipItem(batchId: number, data: {
  slipEntryId: number;
  scanOrder: number;
  image: File;
  imageOriginal?: File;
  bbox?: string;
  scannerType?: string;
}): Promise<SlipItemDto> {
  const formData = new FormData();
  formData.append('slipEntryId', String(data.slipEntryId));
  formData.append('scanOrder', String(data.scanOrder));
  formData.append('image', data.image);
  if (data.imageOriginal) formData.append('imageOriginal', data.imageOriginal);
  if (data.bbox) formData.append('bbox', data.bbox);
  if (data.scannerType) formData.append('scannerType', data.scannerType);

  const res = await apiClient.post(`/scan/${batchId}/slip-item/upload-mobile`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return extractData<SlipItemDto>(res);
}

export async function uploadBulkSlipItems(batchId: number, slipEntryId: number, files: File[]): Promise<SlipItemDto[]> {
  const formData = new FormData();
  formData.append('slipEntryId', String(slipEntryId));
  formData.append('scannerType', 'Direct-Upload');
  files.forEach(f => formData.append('images', f));
  const res = await apiClient.post(`/scan/${batchId}/slip-item/upload-bulk`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return extractData<SlipItemDto[]>(res);
}


// ── Cheque capture ────────────────────────────────────────────────────────────

export async function captureCheque(batchId: number, data: {
  slipEntryId: number;
  scannerType?: string;
}): Promise<ChequeItemDto> {
  const res = await apiClient.post(`/scan/${batchId}/cheque/capture`, {
    ...data,
    scannerType: data.scannerType ?? 'Cheque',
  });
  return extractData<ChequeItemDto>(res);
}

export async function saveChequeItem(batchId: number, data: {
  slipEntryId: number;
  chqSeq: number;
  micrRaw?: string;
  scanMICRRaw?: string;
  chqNo?: string;
  scanChqNo?: string;
  rrChqNo?: string;
  scanMICR1?: string;
  scanMICR2?: string;
  scanMICR3?: string;
  frontImagePath?: string;
  backImagePath?: string;
  scannerType?: string;
  scanType?: string;
  seqNo?: number;
}): Promise<ChequeItemDto> {
  const res = await apiClient.post(`/scan/${batchId}/cheque/save`, {
    batchId,
    ...data,
    scannerType: data.scannerType ?? 'Cheque',
    scanType: data.scanType ?? 'Scan',
  });
  return extractData<ChequeItemDto>(res);
}

export async function uploadMobileCheque(batchId: number, data: {
  slipEntryId: number;
  chqSeq: number;
  imageFront?: File;
  imageBack?: File;
  imageFrontOriginal?: File;
  imageBackOriginal?: File;
  imageFrontTiff?: File;
  imageBackTiff?: File;
  micrRaw?: string;
  scanMICRRaw?: string;
  chqNo?: string;
  scanChqNo?: string;
  rrChqNo?: string;
  scanMICR1?: string;
  scanMICR2?: string;
  scanMICR3?: string;
  bboxFront?: string;
  bboxBack?: string;
  scannerType?: string;
}): Promise<ChequeItemDto> {
  const formData = new FormData();
  formData.append('slipEntryId', String(data.slipEntryId));
  formData.append('chqSeq', String(data.chqSeq));
  if (data.imageFront) formData.append('imageFront', data.imageFront);
  if (data.imageBack) formData.append('imageBack', data.imageBack);
  if (data.imageFrontOriginal) formData.append('imageFrontOriginal', data.imageFrontOriginal);
  if (data.imageBackOriginal) formData.append('imageBackOriginal', data.imageBackOriginal);
  if (data.imageFrontTiff) formData.append('imageFrontTiff', data.imageFrontTiff);
  if (data.imageBackTiff) formData.append('imageBackTiff', data.imageBackTiff);
  if (data.bboxFront) formData.append('bboxFront', data.bboxFront);
  if (data.bboxBack) formData.append('bboxBack', data.bboxBack);
  if (data.micrRaw) formData.append('micrRaw', data.micrRaw);
  if (data.scanMICRRaw) formData.append('scanMICRRaw', data.scanMICRRaw);
  if (data.chqNo) formData.append('chqNo', data.chqNo);
  if (data.scanChqNo) formData.append('scanChqNo', data.scanChqNo);
  if (data.rrChqNo) formData.append('rrChqNo', data.rrChqNo);
  if (data.scanMICR1) formData.append('scanMICR1', data.scanMICR1);
  if (data.scanMICR2) formData.append('scanMICR2', data.scanMICR2);
  if (data.scanMICR3) formData.append('scanMICR3', data.scanMICR3);
  if (data.scannerType) formData.append('scannerType', data.scannerType);

  const res = await apiClient.post(`/scan/${batchId}/cheque/upload-mobile`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return extractData<ChequeItemDto>(res);
}

// ── Session control ───────────────────────────────────────────────────────────

export async function completeScan(batchId: number): Promise<void> {
  await apiClient.post(`/scan/${batchId}/complete`);
}

export async function completeSlipPhase(batchId: number, slipEntryId: number): Promise<void> {
  await apiClient.post(`/scan/${batchId}/slip/${slipEntryId}/complete-slip`);
}

export async function completeChequePhase(batchId: number, slipEntryId: number): Promise<void> {
  await apiClient.post(`/scan/${batchId}/slip/${slipEntryId}/complete-cheque`);
}

export async function releaseScanLock(batchId: number): Promise<void> {
  await apiClient.post(`/scan/${batchId}/release-lock`);
}

export async function reopenBatch(batchId: number): Promise<void> {
  await apiClient.post(`/scan/${batchId}/reopen`);
}
