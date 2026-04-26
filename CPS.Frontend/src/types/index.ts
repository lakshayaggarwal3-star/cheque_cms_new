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
  2: 'Pending Batches',
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
  clusterCode?: string;
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
export interface SlipItemDto {
  slipItemId: number;
  slipEntryId: number;
  scanOrder: number;
  retryCount: number;
  imageBaseName?: string;
  imageName?: string;

  fileExtension?: string;
  imageHash?: string;
  scanStatus: string;
}

export interface ChequeItemDto {
  chequeItemId: number;
  slipEntryId: number;
  batchId: number;
  seqNo: number;
  chqSeq: number;
  chqNo?: string;
  scanChqNo?: string;
  rrChqNo?: string;
  micrRaw?: string;
  scanMICRRaw?: string;
  // Scanner MICR — raw from scanner, read-only
  scanMICR1?: string;
  scanMICR2?: string;
  scanMICR3?: string;
  // RR MICR — set during repair
  rrmicr1?: string;
  rrmicr2?: string;
  rrmicr3?: string;
  rrNotes?: string;
  rrState: number;
  retryCount: number;
  imageBaseName?: string;
  imageName?: string;

  fileExtension?: string;
  imageHash?: string;
  scanStatus: string;
}

export interface SlipEntryDto {
  slipEntryId: number;
  batchId: number;
  slipNo: string;
  clientCode?: string;
  clientName?: string;
  depositSlipNo?: string;
  pickupPoint?: string;
  totalInstruments: number;
  slipAmount: number;
  remarks?: string;
  slipStatus: number;
  createdAt: string;
  rowVersion: string;
  slipItems: SlipItemDto[];
  cheques: ChequeItemDto[];
}

// Keep SlipDto as alias for backward compat with any remaining references
export type SlipDto = SlipEntryDto;

export interface ScanResumeStateDto {
  activeSlipEntryId?: number;
  activeSlipNo?: string;
  // "SlipEntry" | "SlipScan" | "ChequeScan" | null
  resumeStep?: string | null;
  nextSlipItemOrder: number;
  nextChqSeq: number;
}

// ── Scan ──────────────────────────────────────────────────────────────────────
export interface ScanSessionDto {
  batchId: number;
  batchNo: string;
  batchStatus: number;
  withSlip?: boolean;
  scanType: string;
  scanLockedBy?: number;
  totalCheques: number;
  totalSlipEntries: number;
  totalAmount: number;
  slipGroups: SlipEntryDto[];
  slipItems?: SlipItemDto[];
  resumeState: ScanResumeStateDto;
}

// ── RR ────────────────────────────────────────────────────────────────────────
export interface RRItemDto {
  chequeItemId: number;
  batchId: number;
  slipEntryId: number;
  seqNo: number;
  chqSeq: number;
  micrRaw?: string;
  scanMICRRaw?: string;
  chqNo?: string;
  scanChqNo?: string;
  rrChqNo?: string;
  scanMICR1?: string;
  scanMICR2?: string;
  scanMICR3?: string;
  rrmicr1?: string;
  rrmicr2?: string;
  rrmicr3?: string;
  rrNotes?: string;
  rrState: number;
  rrStateLabel?: string;
  slipNo?: string;
  clientName?: string;
  slipAmount?: number;
  totalInstruments?: number;
  imageBaseName?: string;
  imageName?: string;

  fileExtension?: string;
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
  roles: string[];
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
  status?: string; // 'A' = Active, 'X' = Inactive
  globalClientID?: number;
  globalCode?: string;
  isPriority?: boolean;
}
