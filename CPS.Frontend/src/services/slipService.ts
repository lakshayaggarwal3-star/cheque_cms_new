// =============================================================================
// File        : slipService.ts
// Project     : CPS — Cheque Processing System
// Module      : Slip Entry
// Description : API calls for slip creation, update, and client auto-fill.
// Created     : 2026-04-14
// =============================================================================

import apiClient, { extractData } from './api';
import type { ClientAutoFillDto, SlipDto } from '../types';

export async function getSlipsByBatch(batchId: number): Promise<SlipDto[]> {
  const res = await apiClient.get(`/slip/${batchId}`);
  return extractData<SlipDto[]>(res);
}

export async function createSlip(data: {
  batchID: number;
  slipNo: string;
  clientCode?: string;
  clientName?: string;
  depositSlipNo?: string;
  pickupPoint?: string;
  totalInstruments: number;
  slipAmount: number;
  remarks?: string;
}): Promise<SlipDto> {
  const res = await apiClient.post('/slip', data);
  return extractData<SlipDto>(res);
}

export async function getClientAutoFill(clientCode: string): Promise<ClientAutoFillDto | null> {
  try {
    const res = await apiClient.get(`/slip/autofill/${clientCode}`);
    return extractData<ClientAutoFillDto>(res);
  } catch {
    return null;
  }
}
