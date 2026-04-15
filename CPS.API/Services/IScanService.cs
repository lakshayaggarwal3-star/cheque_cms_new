// =============================================================================
// File        : IScanService.cs
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Service interface for scanning session management and cheque data saving.
// Created     : 2026-04-14
// =============================================================================

using CPS.API.DTOs;

namespace CPS.API.Services;

public interface IScanService
{
    Task<ScanSessionDto> GetSessionAsync(long batchId, int userId);
    Task StartScanAsync(long batchId, StartScanRequest request, int userId);
    Task StartFeedAsync(long batchId, ScannerFeedRequest request, int userId);
    Task StopFeedAsync(long batchId, ScannerFeedRequest request, int userId);
    Task<ScanItemDto> CaptureAsync(long batchId, CaptureScanRequest request, int userId);
    Task<ScanItemDto> UploadMobileCaptureAsync(long batchId, MobileUploadScanRequest request, int userId);
    Task<ScanItemDto> SaveChequeAsync(SaveChequeRequest request, int userId);
    Task CompleteScanAsync(long batchId, int userId);
    Task ReleaseLockAsync(long batchId, int userId);
}
