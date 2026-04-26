// =============================================================================
// File        : masterUploadService.ts
// Project     : CPS — Cheque Processing System
// Module      : Masters
// Description : API calls for masters grid, preview, upload, bulk apply, and global clients.
// Created     : 2026-04-14
// =============================================================================

import apiClient, { extractData } from './api';
import type { LocationDto, PagedResult } from '../types';

export interface UploadErrorDto {
  rowNumber: number;
  field: string;
  message: string;
  rowData?: string;
}

export interface UploadResultDto {
  totalRows: number;
  successRows: number;
  errorRows: number;
  status: string;
  errors: UploadErrorDto[];
}

export interface MasterDataRowDto {
  values: Record<string, string | null>;
}

export interface MasterPreviewDto {
  masterType: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  errors: UploadErrorDto[];
  rows: MasterDataRowDto[];
  parsingLogs: string[];
}

export interface ClientMasterDto {
  clientID: number;
  cityCode: string;
  clientName: string;
  address1?: string;
  address2?: string;
  pickupPointCode?: string;
  pickupPointDesc?: string;
  rcmsCode?: string;
  status?: string;
  globalClientID?: number;
  globalCode?: string;
  globalName?: string;
  isPriority?: boolean;
}

export interface GlobalClientDto {
  globalClientID: number;
  globalCode: string;
  globalName: string;
  isPriority: boolean;
  isActive: boolean;
  linkedClientCount: number;
}

export interface InternalBankDto {
  id: number;
  ebank: string;
  sortcode: string;
  name: string;
  fullname: string;
  branch: string;
}

export interface ClientCaptureRuleDto {
  id: number;
  ceid: string;
  clientCode: string;
  fieldName1: string;
  fieldName2: string;
  fieldName3: string;
  fieldName4: string;
  fieldName5: string;
}

export interface MasterUploadLogDto {
  uploadID: number;
  masterType: string;
  fileName?: string;
  uploadedBy: string;
  uploadDate: string;
  status: string;
  totalRows: number;
  successRows: number;
  errorRows: number;
}

export type MasterType = 'location' | 'client' | 'internal-bank' | 'capture-rule' | 'scb-master';

// ── Master upload / preview / apply ──────────────────────────────────────────

export interface JobStartDto {
  jobId: number;
  status: string;
  message: string;
}

export interface JobStatusDto {
  id: number;
  jobType: string;
  status: 'Pending' | 'Processing' | 'Completed' | 'Failed' | 'Cancelled';
  progressPercent: number;
  totalRows: number;
  processedRows: number;
  insertedCount: number;
  updatedCount: number;
  failedCount: number;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  errors: JobErrorDto[];
}

export interface JobErrorDto {
  rowNumber: number;
  field?: string;
  message?: string;
}

// ── Master upload / preview / apply ──────────────────────────────────────────

export async function uploadMaster(type: MasterType, file: File): Promise<JobStartDto> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post(`/masters/${type}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return extractData<JobStartDto>(res);
}

export async function getJobStatus(id: number): Promise<JobStatusDto> {
  const res = await apiClient.get(`/BackgroundJob/${id}`);
  return res.data;
}

export async function cancelJob(id: number): Promise<void> {
  await apiClient.post(`/BackgroundJob/${id}/cancel`);
}

export async function deleteJob(id: number): Promise<void> {
  await apiClient.delete(`/BackgroundJob/${id}`);
}

export async function getUserJobs(): Promise<JobStatusDto[]> {
  const res = await apiClient.get(`/BackgroundJob/user`);
  return res.data;
}

export async function previewMaster(type: MasterType, file: File): Promise<MasterPreviewDto> {
  const form = new FormData();
  form.append('file', file);
  const res = await apiClient.post(`/masters/preview/${type}`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return extractData<MasterPreviewDto>(res);
}

export async function applyMasterRows(type: MasterType, rows: MasterDataRowDto[]): Promise<UploadResultDto> {
  const res = await apiClient.post(`/masters/apply/${type}`, { rows });
  return extractData<UploadResultDto>(res);
}

export function getTemplateUrl(type: MasterType): string {
  return `/api/masters/template/${type}`;
}

export async function getUploadHistory(page = 1, pageSize = 20): Promise<PagedResult<MasterUploadLogDto>> {
  const res = await apiClient.get('/masters/history', { params: { page, pageSize } });
  return extractData<PagedResult<MasterUploadLogDto>>(res);
}

// ── Data fetch ────────────────────────────────────────────────────────────────

export async function getLocationMasterData(page = 1, pageSize = 20, query = ''): Promise<PagedResult<LocationDto>> {
  const res = await apiClient.get('/locations', { params: { page, pageSize, q: query || undefined } });
  return extractData<PagedResult<LocationDto>>(res);
}

export async function updateLocationRecord(id: number, data: Partial<LocationDto>): Promise<void> {
  await apiClient.put(`/locations/${id}`, data);
}


export async function getClientMasterData(
  page = 1,
  pageSize = 20,
  query = '',
  globalClientId?: number,
  isPriority?: boolean,
  cityCode?: string,
  clientName?: string,
  rcmsCode?: string
): Promise<PagedResult<ClientMasterDto>> {
  const res = await apiClient.get('/clients', {
    params: {
      q: query || undefined,
      page,
      pageSize,
      globalClientId: globalClientId ?? undefined,
      isPriority: isPriority !== undefined ? isPriority : undefined,
      cityCode: cityCode || undefined,
      clientName: clientName || undefined,
      rcmsCode: rcmsCode || undefined
    },
  });
  return extractData<PagedResult<ClientMasterDto>>(res);
}


export async function updateClientRecord(clientId: number, data: Partial<ClientMasterDto>): Promise<ClientMasterDto> {
  const res = await apiClient.put(`/clients/${clientId}`, data);
  return extractData<ClientMasterDto>(res);
}

// ── Global Client CRUD ────────────────────────────────────────────────────────

export async function getGlobalClients(): Promise<GlobalClientDto[]> {
  const res = await apiClient.get('/clients/global');
  return extractData<GlobalClientDto[]>(res);
}

export async function createGlobalClient(data: {
  globalCode: string;
  globalName: string;
  isPriority: boolean;
}): Promise<GlobalClientDto> {
  const res = await apiClient.post('/clients/global', data);
  return extractData<GlobalClientDto>(res);
}

export async function updateGlobalClient(
  id: number,
  data: { globalName: string; isPriority: boolean; isActive: boolean },
): Promise<void> {
  await apiClient.put(`/clients/global/${id}`, data);
}

export async function linkClientsToGlobal(globalClientId: number, clientIds: number[]): Promise<void> {
  await apiClient.post(`/clients/global/${globalClientId}/link`, { globalClientID: globalClientId, clientIDs: clientIds });
}
export async function deleteGlobalClient(id: number): Promise<void> {
  await apiClient.delete(`/clients/global/${id}`);
}

// ── Extra Masters Fetch ───────────────────────────────────────────────────────

export async function getInternalBankData(page = 1, pageSize = 20, query = ''): Promise<PagedResult<InternalBankDto>> {
  const res = await apiClient.get('/extra-masters/internal-banks', { params: { page, pageSize, q: query || undefined } });
  return extractData<PagedResult<InternalBankDto>>(res);
}

export async function getCaptureRuleData(page = 1, pageSize = 20, query = ''): Promise<PagedResult<ClientCaptureRuleDto>> {
  const res = await apiClient.get('/extra-masters/capture-rules', { params: { page, pageSize, q: query || undefined } });
  return extractData<PagedResult<ClientCaptureRuleDto>>(res);
}

// ── Background Jobs & Cleanup ──────────────────────────────────────────────────

export async function clearMaster(type: MasterType): Promise<void> {
  await apiClient.post(`/masters/clear/${type}`);
}
