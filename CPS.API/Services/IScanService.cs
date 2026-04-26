// =============================================================================
// File        : IScanService.cs
// Project     : CPS — Cheque Processing System
// Module      : Scanning
// Description : Service interface for scanning session, slip scan, and cheque capture.
// Created     : 2026-04-17
// =============================================================================

using CPS.API.DTOs;

namespace CPS.API.Services;

public interface IScanService
{
    Task<ScanSessionDto> GetSessionAsync(long batchId, int userId);
    Task StartScanAsync(long batchId, StartScanRequest request, int userId);
    Task StartFeedAsync(long batchId, ScannerFeedRequest request, int userId);
    Task StopFeedAsync(long batchId, ScannerFeedRequest request, int userId);

    // Slip item image operations
    Task<SlipItemDto> CaptureSlipItemAsync(long batchId, CaptureSlipItemRequest request, int userId);
    Task<SlipItemDto> UploadMobileSlipItemAsync(long batchId, MobileUploadSlipItemRequest request, int userId);
    Task<List<SlipItemDto>> UploadBulkSlipItemsAsync(long batchId, BulkSlipItemUploadRequest request, int userId);


    // Cheque operations
    Task<ChequeItemDto> CaptureChequeAsync(long batchId, CaptureChequeRequest request, int userId);
    Task<ChequeItemDto> SaveChequeItemAsync(SaveChequeItemRequest request, int userId);
    Task<ChequeItemDto> UploadMobileChequeAsync(long batchId, MobileUploadChequeRequest request, int userId);

    Task UpdateSlipStatusAsync(long batchId, long slipEntryId, CPS.API.Models.SlipStatus status, int userId);

    Task CompleteScanAsync(long batchId, int userId);
    Task ReleaseLockAsync(long batchId, int userId);
    Task ReopenBatchAsync(long batchId, int userId);
}
