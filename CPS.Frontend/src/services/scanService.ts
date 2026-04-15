// =============================================================================
// File        : scanService.ts
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : API calls for scan session management and cheque data saving.
// Created     : 2026-04-14
// =============================================================================

import apiClient, { extractData } from './api';
import type { ScanItemDto, ScanSessionDto } from '../types';

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

export async function captureScan(batchId: number, data: {
  isSlip: boolean;
  slipID?: number;
  scannerType: string;
}): Promise<ScanItemDto> {
  const res = await apiClient.post(`/scan/${batchId}/capture`, data);
  return extractData<ScanItemDto>(res);
}

export async function saveCheque(batchId: number, data: {
  seqNo?: number;
  isSlip?: boolean;
  slipID?: number;
  imageFrontPath?: string;
  imageBackPath?: string;
  micrRaw?: string;
  chqNo?: string;
  micr1?: string;
  micr2?: string;
  micr3?: string;
  scannerType?: string;
  scanType?: string;
}): Promise<ScanItemDto> {
  const res = await apiClient.post(`/scan/${batchId}/save-cheque`, data);
  return extractData<ScanItemDto>(res);
}

export async function uploadMobileScan(batchId: number, data: {
  isSlip: boolean;
  slipID?: number;
  scannerType?: string;
  imageFront?: File;
  imageBack?: File;
  micrRaw?: string;
  chqNo?: string;
  micr1?: string;
  micr2?: string;
  micr3?: string;
}): Promise<ScanItemDto> {
  const formData = new FormData();
  formData.append('isSlip', String(data.isSlip));
  if (data.slipID) formData.append('slipID', String(data.slipID));
  if (data.scannerType) formData.append('scannerType', data.scannerType);
  if (data.imageFront) formData.append('imageFront', data.imageFront);
  if (data.imageBack) formData.append('imageBack', data.imageBack);
  if (data.micrRaw) formData.append('micrRaw', data.micrRaw);
  if (data.chqNo) formData.append('chqNo', data.chqNo);
  if (data.micr1) formData.append('micr1', data.micr1);
  if (data.micr2) formData.append('micr2', data.micr2);
  if (data.micr3) formData.append('micr3', data.micr3);

  const res = await apiClient.post(`/scan/${batchId}/upload-mobile`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return extractData<ScanItemDto>(res);
}

export async function completeScan(batchId: number): Promise<void> {
  await apiClient.post(`/scan/${batchId}/complete`);
}

export async function releaseScanLock(batchId: number): Promise<void> {
  await apiClient.post(`/scan/${batchId}/release-lock`);
}
