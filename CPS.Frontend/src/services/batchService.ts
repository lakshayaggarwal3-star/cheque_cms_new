// =============================================================================
// File        : batchService.ts
// Project     : CPS — Cheque Processing System
// Module      : Batch
// Description : API calls for batch creation, listing, and dashboard.
// Created     : 2026-04-14
// =============================================================================

import apiClient, { extractData } from './api';
import type { BatchDto, DashboardSummary, PagedResult } from '../types';

export async function getBatchList(params: {
  locationId?: number;
  date?: string;
  status?: number;
  page?: number;
  pageSize?: number;
}): Promise<PagedResult<BatchDto>> {
  const res = await apiClient.get('/batch', { params });
  return extractData<PagedResult<BatchDto>>(res);
}

export async function getBatch(id: number): Promise<BatchDto> {
  const res = await apiClient.get(`/batch/${id}`);
  return extractData<BatchDto>(res);
}

export async function getBatchByNumber(batchNo: string): Promise<BatchDto> {
  const res = await apiClient.get(`/batch/by-number/${batchNo}`);
  return extractData<BatchDto>(res);
}

export async function createBatch(data: {
  locationID: number;
  scannerMappingID: number;
  pickupPointCode?: string;
  batchDate: string;
  clearingType: string;
  isPDC: boolean;
  pdcDate?: string;
  totalSlips: number;
  totalAmount: number;
  summRefNo?: string;
  pif?: string;
}): Promise<BatchDto> {
  const res = await apiClient.post('/batch', data);
  return extractData<BatchDto>(res);
}

export async function updateBatch(batchId: number, data: {
  totalSlips: number;
  totalAmount: number;
  isPDC: boolean;
  pdcDate?: string;
  summRefNo?: string;
  pif?: string;
  scanType?: string;
  withSlip?: boolean;
}): Promise<BatchDto> {
  const res = await apiClient.put(`/batch/${batchId}`, data);
  return extractData<BatchDto>(res);
}

export async function getDashboard(locationId: number, date: string): Promise<DashboardSummary> {
  const res = await apiClient.get('/batch/dashboard', { params: { locationId, date } });
  return extractData<DashboardSummary>(res);
}

export async function updateBatchStatus(id: number, newStatus: number, reason?: string): Promise<void> {
  await apiClient.put(`/batch/${id}/status`, { newStatus, reason });
}
