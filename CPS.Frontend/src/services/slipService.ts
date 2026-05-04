// =============================================================================
// File        : slipService.ts
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : API calls for SlipEntry creation, update, and client auto-fill.
// Created     : 2026-04-17
// =============================================================================

import apiClient, { extractData } from './api';
import type { ClientAutoFillDto, SlipEntryDto } from '../types';

export async function getSlipsByBatch(batchId: number): Promise<SlipEntryDto[]> {
  const res = await apiClient.get(`/slip/${batchId}`);
  return extractData<SlipEntryDto[]>(res);
}

export async function getSlip(slipId: number): Promise<SlipEntryDto> {
  const res = await apiClient.get(`/slip/detail/${slipId}`);
  return extractData<SlipEntryDto>(res);
}

export async function getClientsByLocation(): Promise<ClientAutoFillDto[]> {
  const res = await apiClient.get('/slip/clients-by-location');
  return extractData<ClientAutoFillDto[]>(res);
}

export async function createSlipEntry(data: {
  batchId: number;
  clientCode?: string;
  clientName?: string;
  depositSlipNo?: string;
  pickupPoint?: string;
  totalInstruments: number;
  slipAmount: number;
  remarks?: string;
}): Promise<SlipEntryDto> {
  const res = await apiClient.post('/slip', data);
  return extractData<SlipEntryDto>(res);
}

export async function updateSlipEntry(slipEntryId: number, data: {
  clientCode?: string;
  clientName?: string;
  depositSlipNo?: string;
  pickupPoint?: string;
  totalInstruments: number;
  slipAmount: number;
  remarks?: string;
  rowVersion: string;
}): Promise<SlipEntryDto> {
  const res = await apiClient.put(`/slip/${slipEntryId}`, data);
  return extractData<SlipEntryDto>(res);
}

export async function getClientAutoFill(clientCode: string): Promise<ClientAutoFillDto | null> {
  try {
    const res = await apiClient.get(`/slip/autofill/${clientCode}`);
    return extractData<ClientAutoFillDto>(res);
  } catch {
    return null;
  }
}
