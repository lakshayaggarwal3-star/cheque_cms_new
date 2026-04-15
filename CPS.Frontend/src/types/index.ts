// =============================================================================
// File        : index.ts
// Project     : CPS — Cheque Processing System
// Module      : Shared Types
// Description : TypeScript type definitions for API responses, enums, and shared data shapes.
// Created     : 2026-04-14
// =============================================================================

// ── API envelope ──────────────────────────────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errorCode?: string;
  details?: Array<{ field: string; message: string }>;
}

export interface PagedResult<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// ── Enums ─────────────────────────────────────────────────────────────────────
export enum BatchStatus {
  Created = 0,
  ScanningInProgress = 1,
  ScanningPending = 2,
  ScanningCompleted = 3,
  RRPending = 4,
  RRCompleted = 5,
}

export const BatchStatusLabels: Record<number, string> = {
  0: 'Created — Scanning Not Started',
  1: 'Scanning In Progress',
  2: 'Scanning Pending',
  3: 'Scanning Completed',
  4: 'RR Pending',
  5: 'RR Completed',
};

export enum RRState {
  NeedsReview = 0,
  Approved = 1,
  Repaired = 2,
}

// ── Auth ──────────────────────────────────────────────────────────────────────
export interface UserSession {
  userId: number;
  employeeId: string;
  username: string;
  roles: string[];
  locationId: number;
  locationName: string;
  eodDate: string;
  isDeveloper: boolean;
}

// ── Batch ─────────────────────────────────────────────────────────────────────
export interface BatchDto {
  batchID: number;
  /** Internal system number — auto-generated: {PIFPrefix}{DDMMYYYY}{seq:D2} */
  batchNo: string;
  /** Operator-entered from the physical PIF paper form */
  summRefNo?: string;
  /** Operator-entered Processing Instruction Form number — must equal summRefNo */
  pif?: string;
  locationID: number;
  locationName: string;
  locationCode: string;
  scannerMappingID?: number;
  scannerID?: string;
  pickupPointCode?: string;
  batchDate: string;
  clearingType: string;
  isPDC: boolean;
  pdcDate?: string;
  totalSlips: number;
  totalAmount: number;
  scanType: string;
  withSlip?: boolean;
  batchStatus: number;
  batchStatusLabel: string;
  createdByName: string;
  createdAt: string;
}

export interface DashboardSummary {
  totalBatchesToday: number;
  scanningPending: number;
  rrPending: number;
  completed: number;
}

// ── Location ──────────────────────────────────────────────────────────────────
export interface LocationDto {
  locationID: number;
  locationName: string;
  locationCode: string;
  grid?: string;
  state?: string;
  clusterCode?: string;
  zone?: string;
  locType?: string;
  pifPrefix?: string;
  isActive: boolean;
  scanners: ScannerDto[];
  finance?: LocationFinanceDto | null;
}

export interface LocationFinanceDto {
  bofd?: string;
  preTrun?: string;
  depositAccount?: string;
  ifsc?: string;
}

export interface ScannerDto {
  scannerMappingID: number;
  scannerID: string;
  scannerModel?: string;
  scannerType?: string;
  isActive: boolean;
}

// ── Slip ──────────────────────────────────────────────────────────────────────
export interface SlipDto {
  slipID: number;
  batchID: number;
  slipNo: string;
  clientCode?: string;
  clientName?: string;
  depositSlipNo?: string;
  pickupPoint?: string;
  totalInstruments: number;
  slipAmount: number;
  remarks?: string;
  slipStatus: number;
  linkedCheques: number;
  createdAt: string;
  rowVersion: string;
}

// ── Scan ──────────────────────────────────────────────────────────────────────
export interface ScanItemDto {
  scanID: number;
  batchID: number;
  seqNo: number;
  isSlip: boolean;
  slipID?: number;
  imageFrontPath?: string;
  imageBackPath?: string;
  micrRaw?: string;
  chqNo?: string;
  micr1?: string;
  micr2?: string;
  micr3?: string;
  scannerType: string;
  scanStatus: string;
  scanError?: string;
  retryCount: number;
  rrState: number;
}

export interface ScanSessionDto {
  batchID: number;
  batchNo: string;
  batchStatus: number;
  withSlip?: boolean;
  scanType: string;
  scanLockedBy?: number;
  totalScanned: number;
  totalSlips: number;
  items: ScanItemDto[];
}

// ── RR ────────────────────────────────────────────────────────────────────────
export interface RRItemDto {
  scanID: number;
  batchID: number;
  seqNo: number;
  isSlip: boolean;
  imageFrontPath?: string;
  imageBackPath?: string;
  micrRaw?: string;
  chqNo?: string;
  micr1?: string;
  micr2?: string;
  micr3?: string;
  rrState: number;
  rrStateLabel?: string;
  slipID?: number;
  slipNo?: string;
  clientName?: string;
  slipAmount?: number;
  totalInstruments?: number;
  rowVersion: string;
}

// ── User ──────────────────────────────────────────────────────────────────────
export interface UserDto {
  userID: number;
  employeeID: string;
  username: string;
  email?: string;
  isActive: boolean;
  isLocked: boolean;
  roleScanner: boolean;
  roleMobileScanner: boolean;
  roleMaker: boolean;
  roleChecker: boolean;
  roleAdmin: boolean;
  isDeveloper: boolean;
  defaultLocationID?: number;
  defaultLocationName?: string;
  createdAt?: string;
}

// ── Client ────────────────────────────────────────────────────────────────────
export interface ClientAutoFillDto {
  cityCode: string;
  clientName: string;
  pickupPointCode?: string;
  pickupPointDesc?: string;
  rcmsCode?: string;
}
