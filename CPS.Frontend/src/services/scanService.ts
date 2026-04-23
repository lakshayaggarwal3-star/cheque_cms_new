// =============================================================================
// File        : scanService.ts
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : API calls for scan session, slip scan images, and cheque capture.
// Created     : 2026-04-17
// =============================================================================

import apiClient, { extractData } from './api';
import type { ChequeItemDto, ScanSessionDto, SlipScanDto } from '../types';

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

// ── Slip scan images ──────────────────────────────────────────────────────────

export async function captureSlipScan(batchId: number, data: {
  slipEntryId: number;
  scanOrder: number;
  scannerType?: string;
}): Promise<SlipScanDto> {
  const res = await apiClient.post(`/scan/${batchId}/slip-scan/capture`, {
    ...data,
    scannerType: data.scannerType ?? 'Document',
  });
  return extractData<SlipScanDto>(res);
}

export async function uploadMobileSlipScan(batchId: number, data: {
  slipEntryId: number;
  scanOrder: number;
  image: File;
  scannerType?: string;
}): Promise<SlipScanDto> {
  const formData = new FormData();
  formData.append('slipEntryId', String(data.slipEntryId));
  formData.append('scanOrder', String(data.scanOrder));
  formData.append('image', data.image);
  if (data.scannerType) formData.append('scannerType', data.scannerType);

  const res = await apiClient.post(`/scan/${batchId}/slip-scan/upload-mobile`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return extractData<SlipScanDto>(res);
}

export async function uploadBulkSlipScans(batchId: number, slipEntryId: number, files: File[]): Promise<SlipScanDto[]> {
  const formData = new FormData();
  formData.append('slipEntryId', String(slipEntryId));
  formData.append('scannerType', 'Direct-Upload');
  files.forEach(f => formData.append('images', f));
  const res = await apiClient.post(`/scan/${batchId}/slip-scan/upload-bulk`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return extractData<SlipScanDto[]>(res);
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
  chqNo?: string;
  scanMICR1?: string;
  scanMICR2?: string;
  scanMICR3?: string;
  scanAmount?: number;
  frontImagePath?: string;
  backImagePath?: string;
  scannerType?: string;
  scanType?: string;
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
  imageFrontTiff?: File;
  imageBackTiff?: File;
  micrRaw?: string;
  chqNo?: string;
  scanMICR1?: string;
  scanMICR2?: string;
  scanMICR3?: string;
  scanAmount?: number;
  scannerType?: string;
}): Promise<ChequeItemDto> {
  const formData = new FormData();
  formData.append('slipEntryId', String(data.slipEntryId));
  formData.append('chqSeq', String(data.chqSeq));
  if (data.imageFront) formData.append('imageFront', data.imageFront);
  if (data.imageBack) formData.append('imageBack', data.imageBack);
  if (data.imageFrontTiff) formData.append('imageFrontTiff', data.imageFrontTiff);
  if (data.imageBackTiff) formData.append('imageBackTiff', data.imageBackTiff);
  if (data.micrRaw) formData.append('micrRaw', data.micrRaw);
  if (data.chqNo) formData.append('chqNo', data.chqNo);
  if (data.scanMICR1) formData.append('scanMICR1', data.scanMICR1);
  if (data.scanMICR2) formData.append('scanMICR2', data.scanMICR2);
  if (data.scanMICR3) formData.append('scanMICR3', data.scanMICR3);
  if (data.scanAmount != null) formData.append('scanAmount', String(data.scanAmount));
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
